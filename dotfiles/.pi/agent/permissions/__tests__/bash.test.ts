import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import bash from "../bash.ts";
import { bashInput, blockOf, loadHooks, run } from "./helpers.ts";

const hooks = loadHooks(bash);
const rm = hooks.get("rm");

// A real file that existed before this module loaded: the permission module's
// own package.json. Anything older than the session is outside the allowance.
const AGENT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const OLD_FILE = join(AGENT_DIR, "package.json");

const CWD = "/tmp/proj";

function decide(command: string, cwd: string = CWD) {
	return run(rm!, bashInput(command), cwd);
}

describe("rm gate", () => {
	it("registers the hook", () => {
		expect(rm).toBeDefined();
	});

	// --- allowed: inside the workspace ---

	it("allows removing a relative path inside the workspace", async () => {
		expect(await decide("rm dist/bundle.js")).toBeUndefined();
	});

	it("allows recursive removal inside the workspace", async () => {
		expect(await decide("rm -rf node_modules")).toBeUndefined();
	});

	it("allows forced removal inside the workspace", async () => {
		expect(await decide("rm -f coverage/summary.json")).toBeUndefined();
	});

	it("allows removing a workspace file that already existed", async () => {
		expect(await decide("rm package.json", AGENT_DIR)).toBeUndefined();
	});

	// --- allowed: created during this session ---

	it("allows removing a file created in this session outside the workspace", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-rm-"));
		const file = join(dir, "scratch.txt");
		writeFileSync(file, "scratch");
		expect(await decide(`rm ${file}`)).toBeUndefined();
	});

	it("allows removing a target that does not exist", async () => {
		expect(await decide("rm -rf /tmp/pi-nonexistent-dir")).toBeUndefined();
	});

	// --- blocked: outside the workspace, predating the session ---

	it("blocks removing an existing file outside the workspace", async () => {
		const reason = blockOf(await decide(`rm ${OLD_FILE}`));
		expect(reason).toContain("Removal blocked");
		expect(reason).toContain(OLD_FILE);
	});

	it("blocks recursive removal of an existing directory outside the workspace", async () => {
		expect(blockOf(await decide(`rm -rf ${AGENT_DIR}`))).toContain(
			"Removal blocked",
		);
	});

	it("blocks via a relative escape", async () => {
		expect(
			blockOf(await decide("rm -rf ../package.json", join(AGENT_DIR, "__tests__"))),
		).toContain("Removal blocked");
	});

	it("blocks removing the home directory", async () => {
		expect(blockOf(await decide("rm -rf ~"))).toContain("Removal blocked");
	});

	it("blocks removing the filesystem root", async () => {
		expect(blockOf(await decide("rm -rf /"))).toContain("Removal blocked");
	});

	it("blocks unresolvable ~user targets", async () => {
		expect(blockOf(await decide("rm ~other/notes.txt"))).toContain(
			"Removal blocked",
		);
	});

	it("blocks a quoted absolute path", async () => {
		expect(blockOf(await decide(`rm "${OLD_FILE}"`))).toContain(
			"Removal blocked",
		);
	});

	// --- structure: wrappers, chains, cd ---

	it("resolves through sudo", async () => {
		expect(blockOf(await decide(`sudo rm ${OLD_FILE}`))).toBeDefined();
	});

	it("resolves through a shell -c payload", async () => {
		expect(blockOf(await decide(`bash -c 'rm ${OLD_FILE}'`))).toBeDefined();
	});

	it("blocks inside a compound command", async () => {
		expect(blockOf(await decide(`echo hi && rm ${OLD_FILE}`))).toBeDefined();
	});

	it("judges a later target against a preceding cd", async () => {
		expect(
			blockOf(await decide(`cd ${AGENT_DIR} && rm package.json`)),
		).toBeDefined();
	});

	it("allows a cd into the workspace followed by a relative removal", async () => {
		expect(await decide(`cd ${AGENT_DIR} && rm -rf dist`)).toBeUndefined();
	});

	// --- near misses ---

	it("ignores quoted mentions", async () => {
		expect(await decide('echo "rm -rf /etc/hosts"')).toBeUndefined();
	});

	it("ignores git rm (not the rm program)", async () => {
		expect(await decide("git rm old.txt")).toBeUndefined();
	});

	it("ignores non-bash tools", async () => {
		const decision = await run(
			rm!,
			{
				toolName: "read",
				input: {},
				detail: "/etc/hosts",
				path: "/etc/hosts",
				absolutePath: "/etc/hosts",
			},
			CWD,
		);
		expect(decision).toBeUndefined();
	});
});
