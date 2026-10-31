import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import paths from "../paths.ts";
import { bashInput, blockOf, loadHooks, promptOf, run } from "./helpers.ts";

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

function bash(command: string, cwd: string = CWD) {
	return run(outside!, bashInput(command), cwd);
}

describe("outside workspace gate", () => {
	it("registers the hook", () => {
		expect(outside).toBeDefined();
	});

	// --- inspection tools are never judged ---

	it("never asks for reads outside the cwd", async () => {
		expect(
			await decide(
				pathTool("read", {
					path: "/Users/zhengxk/other/secret.txt",
					absolutePath: "/Users/zhengxk/other/secret.txt",
					projectPath: undefined,
				}),
			),
		).toBeUndefined();
	});

	it("never asks for home-relative reads", async () => {
		expect(
			await decide(
				pathTool("read", {
					path: "~other/notes.txt",
					absolutePath: `${CWD}/~other/notes.txt`,
					projectPath: "~other/notes.txt",
				}),
			),
		).toBeUndefined();
	});

	it("never asks for grep, find, or ls outside the cwd", async () => {
		expect(
			await decide(
				pathTool("grep", {
					path: "/Users/zhengxk/other/secret.txt",
					absolutePath: "/Users/zhengxk/other/secret.txt",
				}),
			),
		).toBeUndefined();
		expect(
			await decide(
				pathTool("find", {
					path: "/Users/zhengxk/other",
					absolutePath: "/Users/zhengxk/other",
				}),
			),
		).toBeUndefined();
		expect(
			await decide(
				pathTool("ls", {
					path: "/Users/zhengxk/other",
					absolutePath: "/Users/zhengxk/other",
				}),
			),
		).toBeUndefined();
	});

	it("passes inspection inside the cwd", async () => {
		expect(
			await decide(
				pathTool("grep", {
					path: "src/main.ts",
					absolutePath: `${CWD}/src/main.ts`,
					projectPath: "src/main.ts",
				}),
			),
		).toBeUndefined();
	});

	it("passes optional-path tools invoked without a path", async () => {
		expect(await decide(pathTool("grep", { path: undefined }))).toBeUndefined();
	});

	// --- mutations ask outside the workspace ---

	it("asks for edits outside the cwd", async () => {
		const decision = await decide(
			pathTool("edit", {
				path: "/Users/zhengxk/other/config.ts",
				absolutePath: "/Users/zhengxk/other/config.ts",
			}),
		);
		const prompt = promptOf(decision);
		expect(prompt).toBeDefined();
		expect(prompt?.guidance).toContain("/Users/zhengxk/other/config.ts");
	});

	it("asks for relative paths escaping the cwd", async () => {
		expect(
			promptOf(
				await decide(
					pathTool("write", {
						path: "../../outside.txt",
						absolutePath: "/Users/zhengxk/outside.txt",
					}),
				),
			),
		).toBeDefined();
	});

	it("asks for home-relative writes the SDK misclassifies as inside", async () => {
		const prompt = promptOf(
			await decide(
				pathTool("write", {
					path: "~/notes.txt",
					absolutePath: `${CWD}/~/notes.txt`,
					projectPath: "~/notes.txt",
				}),
			),
		);
		expect(prompt).toBeDefined();
		expect(prompt?.guidance).toContain(homedir());
	});

	it("asks for ~user/... writes even when the SDK misclassifies them", async () => {
		expect(
			promptOf(
				await decide(
					pathTool("write", {
						path: "~other/notes.txt",
						absolutePath: `${CWD}/~other/notes.txt`,
						projectPath: "~other/notes.txt",
					}),
				),
			),
		).toBeDefined();
	});

	it("asks for writes to system temp (mutations never bypass)", async () => {
		expect(
			promptOf(
				await decide(
					pathTool("write", {
						path: "/tmp/scratch/output.txt",
						absolutePath: "/tmp/scratch/output.txt",
					}),
				),
			),
		).toBeDefined();
	});

	it("asks for writes into the agent config tree", async () => {
		const target = join(homedir(), ".pi/agent/settings.json");
		expect(
			promptOf(
				await decide(
					pathTool("write", { path: target, absolutePath: target }),
				),
			),
		).toBeDefined();
	});

	// --- read_skill ---

	it("passes read_skill for a coding-agent skill path", async () => {
		const skill = join(homedir(), ".agents/skills/show-me/SKILL.md");
		expect(await decide(pathTool("read_skill", { path: skill }))).toBeUndefined();
	});

	it("passes read_skill for the agent git cache", async () => {
		const gitPath = join(homedir(), ".pi/agent/git/sessions/state.json");
		expect(await decide(pathTool("read_skill", { path: gitPath }))).toBeUndefined();
	});

	it("asks for read_skill outside the cwd and the allowlist", async () => {
		const target = "/Users/zhengxk/other/x.md";
		expect(
			promptOf(
				await decide({
					toolName: "read_skill",
					input: { path: target },
					detail: target,
				}),
			),
		).toBeDefined();
	});
});

describe("bash path gate", () => {
	// --- blocked: write-capable programs outside the workspace ---

	it("blocks copying out of the workspace", async () => {
		expect(blockOf(await bash("cp notes.md ~/notes.md"))).toContain("Bash blocked");
	});

	it("blocks a relative escape", async () => {
		expect(blockOf(await bash("rm -rf ../other"))).toContain("Bash blocked");
	});

	it("blocks a --flag=value target outside the workspace", async () => {
		expect(
			blockOf(await bash("npx tsc --outDir=/Users/zhengxk/other/build")),
		).toContain("Bash blocked");
	});

	it("blocks a redirect that writes outside the workspace", async () => {
		expect(blockOf(await bash("cat notes.md > ~/export.md"))).toContain(
			"Bash blocked",
		);
	});

	it("blocks a program that reads another tree", async () => {
		expect(blockOf(await bash("git -C ../other status"))).toContain("Bash blocked");
	});

	it("blocks after a preceding cd outside the workspace", async () => {
		expect(blockOf(await bash("cd /etc && cp hosts ./hosts"))).toContain(
			"Bash blocked",
		);
	});

	// --- open: read-only programs may inspect outside paths ---

	it("allows cat, grep, find, and ls outside the workspace", async () => {
		expect(await bash("cat /etc/hosts")).toBeUndefined();
		expect(await bash("grep -r root /etc/hosts")).toBeUndefined();
		expect(await bash("find /usr/local -name '*.sh'")).toBeUndefined();
		expect(await bash("ls /usr/local/bin")).toBeUndefined();
		expect(await bash("rg TODO /Users/zhengxk/other")).toBeUndefined();
	});

	it("allows read-only inspection to follow a cd", async () => {
		expect(await bash("cd /etc && cat hosts")).toBeUndefined();
	});

	// --- open: allowlisted roots ---

	it("allows writing to system temp", async () => {
		expect(await bash("cp notes.md /tmp/out.md")).toBeUndefined();
	});

	it("allows copying out of the agent config tree", async () => {
		expect(await bash("cp ~/.pi/agent/settings.json ./snapshot.json")).toBeUndefined();
	});

	it("allows redirecting to device sinks", async () => {
		expect(await bash("echo hi > /dev/null")).toBeUndefined();
		expect(await bash("make 2>&1")).toBeUndefined();
	});

	// --- near misses ---

	it("allows workspace-relative commands", async () => {
		expect(await bash("cp src/main.ts src/main.bak.ts")).toBeUndefined();
		expect(await bash("npm run build")).toBeUndefined();
		expect(await bash("git status")).toBeUndefined();
	});

	it("allows a bare relative name that cannot escape", async () => {
		expect(await bash("cp *.md backup")).toBeUndefined();
	});

	it("allows an absolute path inside the workspace", async () => {
		expect(await bash(`cp ${CWD}/a.ts ${CWD}/b.ts`)).toBeUndefined();
	});

	it("ignores quoted mentions", async () => {
		expect(await bash('echo "cp x ~/secret"')).toBeUndefined();
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
		expect(
			await decide(
				pathTool("write", {
					path: join(root, "via-link", "src", "main.ts"),
					absolutePath: join(root, "via-link", "src", "main.ts"),
					projectPath: undefined, // lexical path escapes the workspace
				}),
				ws,
			),
		).toBeUndefined();
	});

	it("asks when writing through a workspace-internal symlink that escapes", async () => {
		const prompt = promptOf(
			await decide(
				pathTool("write", {
					path: join(ws, "escape", "new.txt"),
					absolutePath: join(ws, "escape", "new.txt"),
					projectPath: "escape/new.txt",
				}),
				ws,
			),
		);
		expect(prompt?.guidance).toContain(join(realpathSync(outsideDir), "new.txt"));
	});

	it("blocks bash writes through a workspace-internal symlink that escapes", async () => {
		expect(
			blockOf(await bash("cp src/main.ts escape/new.txt", ws)),
		).toContain("Bash blocked");
	});

	it("allows bash reads through a workspace-internal symlink that escapes", async () => {
		expect(await bash("cat escape/secret.txt", ws)).toBeUndefined();
	});

	it("never asks for reads through a workspace-internal symlink that escapes", async () => {
		expect(
			await decide(
				pathTool("read", {
					path: join(ws, "escape", "secret.txt"),
					absolutePath: join(ws, "escape", "secret.txt"),
					projectPath: "escape/secret.txt",
				}),
				ws,
			),
		).toBeUndefined();
	});
});
