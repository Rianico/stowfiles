import { describe, expect, it } from "vitest";
import git from "../git.ts";
import {
	bashInput,
	highlightSlices,
	loadHooks,
	promptOf,
	run,
} from "./helpers.ts";

const hooks = loadHooks(git);
const commit = hooks.get("git commit");
const push = hooks.get("git push");

function commitDecision(command: string) {
	return run(commit!, bashInput(command), "/tmp/proj");
}

function pushDecision(command: string) {
	return run(push!, bashInput(command), "/tmp/proj");
}

function guidanceOf(decision: unknown): string {
	return promptOf(decision)?.guidance ?? "";
}

describe("git commit gate", () => {
	it("registers both hooks", () => {
		expect(commit).toBeDefined();
		expect(push).toBeDefined();
	});

	it("asks on a real commit", async () => {
		const decision = await commitDecision('git commit -m "fix the bug"');
		expect(promptOf(decision)).toBeDefined();
	});

	it("highlights the commit message", async () => {
		const decision = await commitDecision('git commit -m "fix the bug"');
		const slices = highlightSlices(
			'git commit -m "fix the bug"',
			promptOf(decision)?.highlight,
		);
		expect(slices.some((slice) => slice.includes("fix the bug"))).toBe(true);
		expect(slices.some((slice) => slice.includes("git commit"))).toBe(false);
	});

	it("highlights combined short -am message", async () => {
		const decision = await commitDecision('git commit -am "all + message"');
		const slices = highlightSlices(
			'git commit -am "all + message"',
			promptOf(decision)?.highlight,
		);
		expect(slices.some((slice) => slice.includes("all + message"))).toBe(true);
		expect(slices.some((slice) => slice.includes("git commit"))).toBe(false);
	});

	it("highlights the message file of combined short -aF", async () => {
		const decision = await commitDecision("git commit -aF msgfile.txt");
		const slices = highlightSlices(
			"git commit -aF msgfile.txt",
			promptOf(decision)?.highlight,
		);
		expect(slices.some((slice) => slice.includes("msgfile.txt"))).toBe(true);
		expect(slices.some((slice) => slice.includes("git commit"))).toBe(false);
	});

	it("highlights --message= inline value without consuming the next argument", async () => {
		const decision = await commitDecision("git commit --message=inline extra");
		const slices = highlightSlices(
			"git commit --message=inline extra",
			promptOf(decision)?.highlight,
		);
		expect(slices.some((slice) => slice.includes("inline"))).toBe(true);
		expect(slices.some((slice) => slice.includes("extra"))).toBe(false);
	});

	it("falls back to the whole command when no explicit message is present", async () => {
		const decision = await commitDecision("git commit --amend");
		const slices = highlightSlices(
			"git commit --amend",
			promptOf(decision)?.highlight,
		);
		expect(slices).toContain("git commit --amend");
	});

	it("does NOT prompt for --dry-run (no commit happens)", async () => {
		const decision = await commitDecision("git commit --dry-run");
		expect(decision).toBeUndefined();
	});

	it("still prompts for -n (--no-verify) — the commit does happen", async () => {
		const decision = await commitDecision('git commit -n -m "skipping checks"');
		expect(promptOf(decision)).toBeDefined();
	});

	it("ignores non-commit commands", async () => {
		expect(await commitDecision("git status")).toBeUndefined();
		expect(await commitDecision("git log --oneline")).toBeUndefined();
		expect(await commitDecision("echo git commit")).toBeUndefined();
	});

	it("resolves the subcommand past value-taking global flags", async () => {
		const decision = await commitDecision(
			'git -C /tmp/other commit -m "elsewhere"',
		);
		expect(promptOf(decision)).toBeDefined();
	});
});

describe("git push gate", () => {
	it("asks on a plain push with non-force guidance", async () => {
		const decision = await pushDecision("git push origin main");
		expect(promptOf(decision)).toBeDefined();
		expect(guidanceOf(decision)).not.toContain("Force push detected");
	});

	it("flags -f as a force push", async () => {
		const decision = await pushDecision("git push -f origin main");
		expect(guidanceOf(decision)).toContain("Force push detected");
	});

	it("flags --force as a force push", async () => {
		const decision = await pushDecision("git push --force origin main");
		expect(guidanceOf(decision)).toContain("Force push detected");
	});

	it("flags --force-with-lease with a refspec value as a force push", async () => {
		const decision = await pushDecision(
			"git push --force-with-lease=origin/main",
		);
		expect(guidanceOf(decision)).toContain("Force push detected");
	});

	it("flags --force-with-lease with an expectation value as a force push", async () => {
		const decision = await pushDecision(
			"git push --force-with-lease=main:1234abcd origin main",
		);
		expect(guidanceOf(decision)).toContain("Force push detected");
	});

	it("flags --force-if-includes as a force push", async () => {
		const decision = await pushDecision(
			"git push --force-if-includes origin main",
		);
		expect(guidanceOf(decision)).toContain("Force push detected");
	});

	it("does NOT prompt for --dry-run (no push happens)", async () => {
		expect(
			await pushDecision("git push --dry-run origin main"),
		).toBeUndefined();
	});

	it("does NOT prompt for -n (push dry-run shorthand)", async () => {
		expect(await pushDecision("git push -n origin main")).toBeUndefined();
	});

	it("suppresses the prompt even when a force flag is combined with --dry-run", async () => {
		expect(
			await pushDecision("git push -f --dry-run origin main"),
		).toBeUndefined();
	});

	it("ignores non-push commands", async () => {
		expect(await pushDecision("git pull origin main")).toBeUndefined();
		expect(await pushDecision("git pushd")).toBeUndefined();
	});
});
