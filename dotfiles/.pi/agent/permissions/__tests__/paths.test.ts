import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
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
