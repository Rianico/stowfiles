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
const push = hooks.get("git push");
const reset = hooks.get("git reset --hard");

function pushDecision(command: string) {
	return run(push!, bashInput(command), "/tmp/proj");
}

function resetDecision(command: string) {
	return run(reset!, bashInput(command), "/tmp/proj");
}

function guidanceOf(decision: unknown): string {
	return promptOf(decision)?.guidance ?? "";
}

describe("git push gate", () => {
	it("registers both hooks", () => {
		expect(push).toBeDefined();
		expect(reset).toBeDefined();
	});

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

describe("git reset --hard gate", () => {
	it("asks on a hard reset", async () => {
		const decision = await resetDecision("git reset --hard HEAD");
		expect(promptOf(decision)).toBeDefined();
	});

	it("highlights the whole hard reset invocation", async () => {
		const decision = await resetDecision("git reset --hard HEAD");
		const slices = highlightSlices(
			"git reset --hard HEAD",
			promptOf(decision)?.highlight,
		);
		expect(slices.some((slice) => slice === "git reset --hard HEAD")).toBe(
			true,
		);
	});

	it("asks on hard reset with explicit target", async () => {
		const decision = await resetDecision(
			"git reset --hard origin/main",
		);
		expect(promptOf(decision)).toBeDefined();
	});

	it("asks on bare hard reset without target", async () => {
		const decision = await resetDecision("git reset --hard");
		expect(promptOf(decision)).toBeDefined();
	});

	it("resolves the subcommand past value-taking global flags", async () => {
		const decision = await resetDecision(
			"git -C /tmp/other reset --hard HEAD",
		);
		expect(promptOf(decision)).toBeDefined();
	});

	it("does NOT prompt for --soft", async () => {
		expect(await resetDecision("git reset --soft HEAD~1")).toBeUndefined();
	});

	it("does NOT prompt for --mixed", async () => {
		expect(await resetDecision("git reset --mixed HEAD")).toBeUndefined();
	});

	it("does NOT prompt for reset without a mode flag", async () => {
		expect(await resetDecision("git reset HEAD")).toBeUndefined();
	});

	it("ignores non-reset commands", async () => {
		expect(await resetDecision("git status")).toBeUndefined();
		expect(await resetDecision("git revert HEAD")).toBeUndefined();
		expect(await resetDecision("echo git reset --hard")).toBeUndefined();
	});
});
