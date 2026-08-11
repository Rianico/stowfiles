import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import paths from "../paths.ts";
import { loadHooks, promptOf, run } from "./helpers.ts";

const hooks = loadHooks(paths);
const outside = hooks.get("outside workspace");

const CWD = "/Users/zhengxk/projects/example";

function pathTool(toolName: string, overrides: Record<string, unknown> = {}) {
	return {
		toolName,
		input: {},
		detail: String(overrides.path ?? overrides.absolutePath ?? ""),
		...overrides,
	};
}

function decide(tool: unknown, cwd: string = CWD) {
	return run(outside!, tool, cwd);
}

describe("outside workspace gate", () => {
	it("registers the hook", () => {
		expect(outside).toBeDefined();
	});

	it("passes reads inside the cwd", async () => {
		const decision = await decide(
			pathTool("read", {
				path: "src/main.ts",
				absolutePath: `${CWD}/src/main.ts`,
				projectPath: "src/main.ts",
			}),
		);
		expect(decision).toBeUndefined();
	});

	it("passes absolute paths inside the cwd", async () => {
		const decision = await decide(
			pathTool("read", {
				path: `${CWD}/src/main.ts`,
				absolutePath: `${CWD}/src/main.ts`,
				projectPath: "src/main.ts",
			}),
		);
		expect(decision).toBeUndefined();
	});

	it("asks for absolute paths outside the cwd", async () => {
		const decision = await decide(
			pathTool("read", {
				path: "/Users/zhengxk/other/secret.txt",
				absolutePath: "/Users/zhengxk/other/secret.txt",
				projectPath: undefined,
			}),
		);
		const prompt = promptOf(decision);
		expect(prompt).toBeDefined();
		expect(prompt?.guidance).toContain("/Users/zhengxk/other/secret.txt");
	});

	it("asks for relative paths escaping the cwd", async () => {
		const decision = await decide(
			pathTool("write", {
				path: "../../outside.txt",
				absolutePath: "/Users/zhengxk/outside.txt",
				projectPath: undefined,
			}),
		);
		expect(promptOf(decision)).toBeDefined();
	});

	it("asks for home-relative reads that the SDK misclassifies as inside", async () => {
		// The SDK resolves `~/x` against cwd, so projectPath gets set; the module
		// must expand `~` itself and notice the escape.
		const decision = await decide(
			pathTool("read", {
				path: "~/notes.txt",
				absolutePath: `${CWD}/~/notes.txt`,
				projectPath: "~/notes.txt",
			}),
		);
		const prompt = promptOf(decision);
		expect(prompt).toBeDefined();
		expect(prompt?.guidance).toContain(homedir());
	});

	it("asks for ~user/... reads even when the SDK misclassifies them as inside", async () => {
		const decision = await decide(
			pathTool("read", {
				path: "~other/notes.txt",
				absolutePath: `${CWD}/~other/notes.txt`,
				projectPath: "~other/notes.txt",
			}),
		);
		expect(promptOf(decision)).toBeDefined();
	});

	it("passes home-relative reads when the cwd is the home directory", async () => {
		const decision = await decide(
			pathTool("read", {
				path: "~/notes.txt",
				absolutePath: `${homedir()}/notes.txt`,
				projectPath: "notes.txt",
			}),
			homedir(),
		);
		expect(decision).toBeUndefined();
	});

	it("passes optional-path tools invoked without a path", async () => {
		const decision = await decide(
			pathTool("grep", {
				path: undefined,
				absolutePath: undefined,
				projectPath: undefined,
			}),
		);
		expect(decision).toBeUndefined();
	});

	it("asks for edits outside the cwd", async () => {
		const decision = await decide(
			pathTool("edit", {
				path: "/tmp/scratch/config.ts",
				absolutePath: "/tmp/scratch/config.ts",
				projectPath: undefined,
			}),
		);
		expect(promptOf(decision)).toBeDefined();
	});

	it("passes finds inside the cwd", async () => {
		const decision = await decide(
			pathTool("find", {
				path: "src",
				absolutePath: `${CWD}/src`,
				projectPath: "src",
			}),
		);
		expect(decision).toBeUndefined();
	});
});

describe("outside workspace gate — symlink resolution", () => {
	let root: string;
	let ws: string; // real workspace directory
	let outsideDir: string; // real directory outside the workspace

	beforeAll(() => {
		root = mkdtempSync(join(tmpdir(), "pi-perm-"));
		ws = join(root, "ws");
		outsideDir = join(root, "outside");
		mkdirSync(ws);
		mkdirSync(join(ws, "src"));
		mkdirSync(outsideDir);
		// Workspace-internal symlink that escapes the workspace.
		symlinkSync(outsideDir, join(ws, "escape"));
		// Outside symlink whose real target is inside the workspace.
		symlinkSync(ws, join(root, "via-link"));
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("passes a symlink whose real target is inside the workspace", async () => {
		const decision = await decide(
			pathTool("read", {
				path: join(root, "via-link", "src", "main.ts"),
				absolutePath: join(root, "via-link", "src", "main.ts"),
				projectPath: undefined, // lexical path escapes the workspace
			}),
			ws,
		);
		expect(decision).toBeUndefined();
	});

	it("passes creating a new file through a symlink into the workspace", async () => {
		const decision = await decide(
			pathTool("write", {
				path: join(root, "via-link", "newfile.txt"),
				absolutePath: join(root, "via-link", "newfile.txt"),
				projectPath: undefined,
			}),
			ws,
		);
		expect(decision).toBeUndefined();
	});

	it("asks when a workspace-internal symlink escapes the workspace", async () => {
		const decision = await decide(
			pathTool("read", {
				path: join(ws, "escape", "secret.txt"),
				absolutePath: join(ws, "escape", "secret.txt"),
				projectPath: "escape/secret.txt", // lexical path looks inside
			}),
			ws,
		);
		const prompt = promptOf(decision);
		expect(prompt).toBeDefined();
		expect(prompt?.guidance).toContain(
			join(realpathSync(outsideDir), "secret.txt"),
		);
	});

	it("asks when writing through a workspace-internal symlink that escapes", async () => {
		const decision = await decide(
			pathTool("write", {
				path: join(ws, "escape", "new.txt"),
				absolutePath: join(ws, "escape", "new.txt"),
				projectPath: "escape/new.txt",
			}),
			ws,
		);
		expect(promptOf(decision)).toBeDefined();
	});
});
