/**
 * Parity — the vendored entry and its source of truth in the development repository must
 * render the same `user-rules` section body for one fixture tree.
 *
 * The development repository is read-only and may not exist on another machine: the path
 * comes from `PI_BETTER_RULES_DEV`, falls back to the author's checkout, and the case is
 * skipped when that entry file is absent. Nothing from it is written or imported at
 * module scope, so the suite stays green without it.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import rulesInjector from "../../rules-injector/index.ts";
import { createHarness, type Injector } from "./harness.ts";

const DEV_ENTRY =
	process.env.PI_BETTER_RULES_DEV !== undefined
		? path.join(process.env.PI_BETTER_RULES_DEV, "src", "index.ts")
		: "/Users/zhengxk/development/ai/pi-better-rules/src/index.ts";

const DEV_ENTRY_PRESENT = fs.existsSync(DEV_ENTRY);
if (!DEV_ENTRY_PRESENT) {
	console.warn(
		`[rules parity] SKIPPED: no development entry at ${DEV_ENTRY}. ` +
			"The vendored rules entry is unverified against its source in this run; set " +
			"PI_BETTER_RULES_DEV to the development repository to run the parity check.",
	);
}

const UNSCOPED_GLOBAL = "Never leak secrets.";
const UNSCOPED_PROJECT = "Read the spec before editing.";
const SCOPED_PROJECT = "Use the shared clock.";

let homeRoot: string;
let projectRoot: string;

beforeEach(() => {
	homeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rules-parity-home-"));
	projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rules-parity-project-"));
	vi.stubEnv("HOME", homeRoot);

	const rules = [
		[path.join(homeRoot, ".pi", "agent", "rules"), "house-rules.md", `# House rules\n\n${UNSCOPED_GLOBAL}\n`],
		[path.join(projectRoot, ".pi", "rules"), "project.md", `# Project rules\n\n${UNSCOPED_PROJECT}\n`],
		[
			path.join(projectRoot, ".pi", "rules"),
			"typescript/ts.md",
			`---\npaths:\n  - src/**/*.ts\n---\n\n# TypeScript rules\n\n${SCOPED_PROJECT}\n`,
		],
	] as const;
	for (const [dir, rel, body] of rules) {
		const abs = path.join(dir, rel);
		fs.mkdirSync(path.dirname(abs), { recursive: true });
		fs.writeFileSync(abs, body, "utf8");
	}
});

afterEach(() => {
	vi.unstubAllEnvs();
	fs.rmSync(homeRoot, { recursive: true, force: true });
	fs.rmSync(projectRoot, { recursive: true, force: true });
});

describe("parity with the development repository", () => {
	it.skipIf(!DEV_ENTRY_PRESENT)(
		"renders the same user-rules section body as its source of truth",
		async () => {
			const source: { default: Injector } = await import(
				/* @vite-ignore */ pathToFileURL(DEV_ENTRY).href
			);

			const vendored = createHarness(rulesInjector, projectRoot);
			await vendored.startSession("startup");

			const development = createHarness(source.default, projectRoot);
			await development.startSession("startup");

			const vendoredBody = (await vendored.promptStart()).sections["user-rules"];
			const developmentBody = (await development.promptStart()).sections["user-rules"];

			expect(vendoredBody).toBeDefined();
			expect(vendoredBody).toContain(UNSCOPED_GLOBAL);
			expect(vendoredBody).toContain(UNSCOPED_PROJECT);
			expect(vendoredBody).not.toContain(SCOPED_PROJECT);
			expect(vendoredBody).toBe(developmentBody);
		},
	);
});
