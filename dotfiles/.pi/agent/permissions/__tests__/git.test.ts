import { describe, expect, it } from "vitest";
import git from "../git.ts";
import { bashInput, blockOf, loadHooks, run } from "./helpers.ts";

const hooks = loadHooks(git);
const push = hooks.get("git push");
const reset = hooks.get("git reset --hard");

function pushDecision(command: string) {
	return run(push!, bashInput(command), "/tmp/proj");
}

function resetDecision(command: string) {
	return run(reset!, bashInput(command), "/tmp/proj");
}

describe("git push gate", () => {
	it("registers both hooks", () => {
		expect(push).toBeDefined();
		expect(reset).toBeDefined();
	});

	// --- open: ordinary pushes ---

	it("allows a plain push", async () => {
		expect(await pushDecision("git push origin main")).toBeUndefined();
	});

	it("allows new-branch publishes with -u", async () => {
		expect(
			await pushDecision("git push -u origin feat/new-branch"),
		).toBeUndefined();
	});

	it("allows new-branch publishes with --set-upstream", async () => {
		expect(
			await pushDecision("git push --set-upstream origin feat/new-branch"),
		).toBeUndefined();
	});

	it("allows a non-deleting refspec", async () => {
		expect(await pushDecision("git push origin main:release")).toBeUndefined();
	});

	it("does NOT block --dry-run (no push happens)", async () => {
		expect(await pushDecision("git push --dry-run origin main")).toBeUndefined();
	});

	it("does NOT block -n (push dry-run shorthand)", async () => {
		expect(await pushDecision("git push -n origin main")).toBeUndefined();
	});

	it("does NOT block a delete dry-run", async () => {
		expect(
			await pushDecision("git push --delete --dry-run origin old-branch"),
		).toBeUndefined();
	});

	// --- blocked: deletion ---

	it("blocks branch deletion with --delete", async () => {
		expect(blockOf(await pushDecision("git push origin --delete old-branch"))).toContain(
			"Branch-deletion push blocked",
		);
	});

	it("blocks branch deletion with -d", async () => {
		expect(blockOf(await pushDecision("git push -d origin old-branch"))).toContain(
			"Branch-deletion push blocked",
		);
	});

	it("blocks branch deletion with a colon refspec", async () => {
		expect(blockOf(await pushDecision("git push origin :old-branch"))).toContain(
			"Branch-deletion push blocked",
		);
	});

	// --- blocked: remote ref destruction ---

	it("blocks --mirror", async () => {
		expect(blockOf(await pushDecision("git push --mirror origin"))).toContain(
			"Mirror push blocked",
		);
	});

	it("blocks --prune", async () => {
		expect(blockOf(await pushDecision("git push --prune origin"))).toContain(
			"Pruning push blocked",
		);
	});

	it("blocks --prune=now", async () => {
		expect(blockOf(await pushDecision("git push --prune=now origin"))).toContain(
			"Pruning push blocked",
		);
	});

	// --- blocked: history rewrite ---

	it("blocks -f", async () => {
		expect(blockOf(await pushDecision("git push -f origin main"))).toContain(
			"Force push blocked",
		);
	});

	it("blocks --force", async () => {
		expect(blockOf(await pushDecision("git push --force origin main"))).toContain(
			"Force push blocked",
		);
	});

	it("blocks --force-with-lease with a refspec value", async () => {
		expect(
			blockOf(await pushDecision("git push --force-with-lease=origin/main")),
		).toContain("Force push blocked");
	});

	it("blocks --force-with-lease with an expectation value", async () => {
		expect(
			blockOf(
				await pushDecision(
					"git push --force-with-lease=main:1234abcd origin main",
				),
			),
		).toContain("Force push blocked");
	});

	it("blocks --force-if-includes", async () => {
		expect(
			blockOf(await pushDecision("git push --force-if-includes origin main")),
		).toContain("Force push blocked");
	});

	it("blocks a +refspec force push", async () => {
		expect(blockOf(await pushDecision("git push origin +main"))).toContain(
			"Force push blocked",
		);
	});

	it("blocks a force push combined with -u", async () => {
		expect(
			blockOf(await pushDecision("git push -u -f origin feat/new-branch")),
		).toContain("Force push blocked");
	});

	// --- structure and near misses ---

	it("resolves the subcommand past value-taking global flags", async () => {
		expect(
			blockOf(await pushDecision("git -C /tmp/other push --force origin main")),
		).toContain("Force push blocked");
	});

	it("blocks through a shell -c payload", async () => {
		expect(
			blockOf(await pushDecision("bash -c 'git push --force origin main'")),
		).toContain("Force push blocked");
	});

	it("ignores non-push commands", async () => {
		expect(await pushDecision("git pull origin main")).toBeUndefined();
		expect(await pushDecision("git pushd")).toBeUndefined();
	});

	it("ignores quoted mentions", async () => {
		expect(await pushDecision('echo "git push --force"')).toBeUndefined();
	});
});

describe("git reset --hard gate", () => {
	it("blocks a hard reset", async () => {
		expect(blockOf(await resetDecision("git reset --hard HEAD"))).toContain(
			"Hard reset blocked",
		);
	});

	it("blocks a hard reset with an explicit target", async () => {
		expect(
			blockOf(await resetDecision("git reset --hard origin/main")),
		).toContain("Hard reset blocked");
	});

	it("blocks a bare hard reset", async () => {
		expect(blockOf(await resetDecision("git reset --hard"))).toContain(
			"Hard reset blocked",
		);
	});

	it("resolves the subcommand past value-taking global flags", async () => {
		expect(
			blockOf(await resetDecision("git -C /tmp/other reset --hard HEAD")),
		).toContain("Hard reset blocked");
	});

	it("allows --soft", async () => {
		expect(await resetDecision("git reset --soft HEAD~1")).toBeUndefined();
	});

	it("allows --mixed", async () => {
		expect(await resetDecision("git reset --mixed HEAD")).toBeUndefined();
	});

	it("allows a reset without a mode flag", async () => {
		expect(await resetDecision("git reset HEAD")).toBeUndefined();
	});

	it("ignores non-reset commands", async () => {
		expect(await resetDecision("git status")).toBeUndefined();
		expect(await resetDecision("git revert HEAD")).toBeUndefined();
		expect(await resetDecision("echo git reset --hard")).toBeUndefined();
	});
});
