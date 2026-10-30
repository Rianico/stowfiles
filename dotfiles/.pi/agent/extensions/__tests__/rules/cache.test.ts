/**
 * Checksum cache — verification gating, refresh bookkeeping, corrupt-cache rebuild
 * (ported from the retired `pi-better-rules` package).
 *
 * The cache is exercised through its hooks, so the assertions read filesystem state and
 * the I/O the cache actually performed: the set of file paths it read, never a call
 * count. Fixtures live under the OS temp dir and are removed afterwards.
 */
import {
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CacheHooks } from "../../rules-injector/cache.ts";
import {
	CHECKSUM_FILENAME,
	globalCachePath,
	projectCachePath,
	refreshCache,
	sha256Hex,
	verifyChecksums,
} from "../../rules-injector/cache.ts";

const tmpDirs: string[] = [];

afterEach(async () => {
	while (tmpDirs.length > 0) {
		const dir = tmpDirs.pop();
		if (dir !== undefined) {
			await rm(dir, { recursive: true, force: true });
		}
	}
});

async function makeTree(files: Record<string, string>): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "rules-cache-"));
	tmpDirs.push(dir);
	for (const [rel, content] of Object.entries(files)) {
		const abs = join(dir, rel);
		await mkdir(dirname(abs), { recursive: true });
		await writeFile(abs, content);
	}
	return dir;
}

async function listMarkdown(dir: string): Promise<string[]> {
	const out: string[] = [];
	const walk = async (current: string): Promise<void> => {
		for (const entry of await readdir(current, { withFileTypes: true })) {
			const abs = join(current, entry.name);
			if (entry.isDirectory()) {
				await walk(abs);
			} else if (entry.name.endsWith(".md")) {
				out.push(abs);
			}
		}
	};
	await walk(dir);
	return out.sort();
}

/** The file paths the cache touched, split by operation. */
interface IoLog {
	reads: string[];
	stats: string[];
}

function makeHooks(dir: string, log: IoLog): CacheHooks {
	return {
		listFiles: () => listMarkdown(dir),
		readFile: async (absPath: string) => {
			log.reads.push(absPath);
			return readFile(absPath, "utf8");
		},
		statFile: async (absPath: string) => {
			log.stats.push(absPath);
			const s = await stat(absPath);
			return { mtimeMs: s.mtimeMs, size: s.size };
		},
	};
}

function resetIoLog(log: IoLog): void {
	log.reads.length = 0;
	log.stats.length = 0;
}

describe("sha256Hex", () => {
	it("matches the sha256 known vector", () => {
		expect(sha256Hex("abc")).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});
});

describe("cache paths", () => {
	it("exposes the checksum filename and cache locations", () => {
		expect(CHECKSUM_FILENAME).toBe("pi-better-rules-checksums.json");
		expect(globalCachePath("/home/tester")).toBe(
			"/home/tester/.pi/agent/cache/pi-better-rules-checksums.json",
		);
		expect(projectCachePath("/repo")).toBe(
			"/repo/.pi/.cache/pi-better-rules-checksums.json",
		);
	});
});

describe("refreshCache", () => {
	it("reports added files and persists the checksum map", async () => {
		const dir = await makeTree({ "a.md": "# alpha\n", "sub/b.md": "# beta\n" });
		const cachePath = join(dir, ".cache", CHECKSUM_FILENAME);
		const log: IoLog = { reads: [], stats: [] };

		const report = await refreshCache(cachePath, makeHooks(dir, log));

		expect(report.added).toEqual([join(dir, "a.md"), join(dir, "sub/b.md")]);
		expect(report.refreshed).toEqual([]);
		expect(report.removed).toEqual([]);
		expect(report.unchanged).toEqual([]);

		const persisted = JSON.parse(await readFile(cachePath, "utf8")) as Record<
			string,
			{ checksum: string }
		>;
		expect(persisted[join(dir, "a.md")]?.checksum).toBe(sha256Hex("# alpha\n"));
		expect(persisted[join(dir, "sub/b.md")]?.checksum).toBe(sha256Hex("# beta\n"));
	});

	it("re-reads nothing when file stats are unchanged (stat pre-filter)", async () => {
		const dir = await makeTree({ "a.md": "# alpha\n", "b.md": "# beta\n" });
		const cachePath = join(dir, ".cache", CHECKSUM_FILENAME);
		const log: IoLog = { reads: [], stats: [] };
		const hooks = makeHooks(dir, log);
		await refreshCache(cachePath, hooks);
		resetIoLog(log);

		const report = await refreshCache(cachePath, hooks);

		expect(report.added).toEqual([]);
		expect(report.refreshed).toEqual([]);
		expect(report.removed).toEqual([]);
		expect(report.unchanged).toEqual([join(dir, "a.md"), join(dir, "b.md")]);
		expect(log.reads).toEqual([]);
	});

	it("reports only modified files as refreshed", async () => {
		const dir = await makeTree({ "a.md": "# alpha\n", "b.md": "# beta\n" });
		const cachePath = join(dir, ".cache", CHECKSUM_FILENAME);
		const log: IoLog = { reads: [], stats: [] };
		const hooks = makeHooks(dir, log);
		await refreshCache(cachePath, hooks);

		await writeFile(join(dir, "b.md"), "# beta changed with more text\n");
		resetIoLog(log);
		const report = await refreshCache(cachePath, hooks);

		expect(report.refreshed).toEqual([join(dir, "b.md")]);
		expect(report.unchanged).toEqual([join(dir, "a.md")]);
		expect(report.added).toEqual([]);
		expect(report.removed).toEqual([]);
		expect(log.reads).toEqual([join(dir, "b.md")]);
	});

	it("reports deleted files as removed and drops them from the map", async () => {
		const dir = await makeTree({ "a.md": "# alpha\n", "b.md": "# beta\n" });
		const cachePath = join(dir, ".cache", CHECKSUM_FILENAME);
		const log: IoLog = { reads: [], stats: [] };
		await refreshCache(cachePath, makeHooks(dir, log));

		await rm(join(dir, "b.md"));
		const report = await refreshCache(cachePath, makeHooks(dir, { reads: [], stats: [] }));

		expect(report.removed).toEqual([join(dir, "b.md")]);
		expect(report.unchanged).toEqual([join(dir, "a.md")]);
		const persisted = JSON.parse(await readFile(cachePath, "utf8")) as Record<
			string,
			unknown
		>;
		expect(persisted[join(dir, "b.md")]).toBeUndefined();
	});

	it("reports new files as added", async () => {
		const dir = await makeTree({ "a.md": "# alpha\n" });
		const cachePath = join(dir, ".cache", CHECKSUM_FILENAME);
		const log: IoLog = { reads: [], stats: [] };
		await refreshCache(cachePath, makeHooks(dir, log));

		await writeFile(join(dir, "c.md"), "# gamma\n");
		const report = await refreshCache(cachePath, makeHooks(dir, { reads: [], stats: [] }));

		expect(report.added).toEqual([join(dir, "c.md")]);
		expect(report.unchanged).toEqual([join(dir, "a.md")]);
	});

	it("rebuilds a corrupt cache with a warning, treating everything as added", async () => {
		const dir = await makeTree({ "a.md": "# alpha\n", "b.md": "# beta\n" });
		const cachePath = join(dir, ".cache", CHECKSUM_FILENAME);
		await mkdir(dirname(cachePath), { recursive: true });
		await writeFile(cachePath, "{not valid json");
		const warnings: string[] = [];

		const report = await refreshCache(
			cachePath,
			makeHooks(dir, { reads: [], stats: [] }),
			(message) => {
				warnings.push(message);
			},
		);

		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatch(/corrupt/i);
		expect(report.added).toEqual([join(dir, "a.md"), join(dir, "b.md")]);
		expect(report.refreshed).toEqual([]);
		const persisted = JSON.parse(await readFile(cachePath, "utf8")) as Record<
			string,
			{ checksum: string }
		>;
		expect(persisted[join(dir, "a.md")]?.checksum).toBe(sha256Hex("# alpha\n"));
	});
});

describe("verifyChecksums (/reload path)", () => {
	it("reports unchanged without re-reading and leaves the cache file untouched", async () => {
		const dir = await makeTree({ "a.md": "# alpha\n", "b.md": "# beta\n" });
		const cachePath = join(dir, ".cache", CHECKSUM_FILENAME);
		const log: IoLog = { reads: [], stats: [] };
		const hooks = makeHooks(dir, log);
		await refreshCache(cachePath, hooks);
		const before = await readFile(cachePath, "utf8");
		resetIoLog(log);

		const result = await verifyChecksums(cachePath, hooks);

		expect(result.unchanged).toBe(true);
		expect(result.changed).toEqual([]);
		expect(log.reads).toEqual([]);
		expect(await readFile(cachePath, "utf8")).toBe(before);
	});

	it("reports changed files so the caller rescans", async () => {
		const dir = await makeTree({ "a.md": "# alpha\n", "b.md": "# beta\n" });
		const cachePath = join(dir, ".cache", CHECKSUM_FILENAME);
		const hooks = makeHooks(dir, { reads: [], stats: [] });
		await refreshCache(cachePath, hooks);

		await writeFile(join(dir, "a.md"), "# alpha with much more content here\n");
		const result = await verifyChecksums(cachePath, hooks);

		expect(result.unchanged).toBe(false);
		expect(result.changed).toEqual([join(dir, "a.md")]);
	});
});
