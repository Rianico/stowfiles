import { describe, expect, it } from "vitest";
import gh from "../gh.ts";
import {
	bashInput,
	highlightSlices,
	loadHooks,
	promptOf,
	run,
} from "./helpers.ts";

const hooks = loadHooks(gh);
const publish = hooks.get("gh issue publish");
const prPublish = hooks.get("gh pr publish");
const apiWrite = hooks.get("gh api issue/pr write");

function publishDecision(command: string) {
	return run(publish!, bashInput(command), "/tmp/proj");
}

function prDecision(command: string) {
	return run(prPublish!, bashInput(command), "/tmp/proj");
}

function apiDecision(command: string) {
	return run(apiWrite!, bashInput(command), "/tmp/proj");
}

function guidanceOf(decision: unknown): string {
	return promptOf(decision)?.guidance ?? "";
}

describe("gh issue publish gate", () => {
	it("registers the hook", () => {
		expect(publish).toBeDefined();
	});

	// --- triggers: one case per publishing verb ---

	it("asks before creating an issue", async () => {
		const decision = await publishDecision(
			'gh issue create -t "Fix typos" -b "Detailed body"',
		);
		expect(promptOf(decision)).toBeDefined();
		expect(guidanceOf(decision)).toContain("create a new issue");
	});

	it("asks before creating an issue via the `new` alias", async () => {
		const decision = await publishDecision('gh issue new -t "Fix typos"');
		expect(promptOf(decision)).toBeDefined();
		expect(guidanceOf(decision)).toContain("create a new issue");
	});

	it("asks before editing an issue", async () => {
		const decision = await publishDecision(
			'gh issue edit 42 --title "New title"',
		);
		expect(promptOf(decision)).toBeDefined();
		expect(guidanceOf(decision)).toContain("edit an existing issue");
	});

	it("asks before commenting on an issue", async () => {
		const decision = await publishDecision(
			'gh issue comment 42 -b "Looks good to me"',
		);
		expect(promptOf(decision)).toBeDefined();
		expect(guidanceOf(decision)).toContain("post a comment");
	});

	// --- trigger variations: flags, wrappers, compound calls ---

	it("resolves the verb past gh global value flags", async () => {
		const decision = await publishDecision(
			'gh -R owner/repo issue create -t "x"',
		);
		expect(promptOf(decision)).toBeDefined();
	});

	it("resolves through sudo and shell -c payloads", async () => {
		expect(
			promptOf(await publishDecision('sudo gh issue create -t "x"')),
		).toBeDefined();
		expect(
			promptOf(await publishDecision(`bash -c 'gh issue create -t "x"'`)),
		).toBeDefined();
	});

	it("highlights every publishing invocation in a compound command", async () => {
		const command = 'gh issue comment 1 -b "a" && gh issue create -t "b"';
		const decision = await publishDecision(command);
		const slices = highlightSlices(command, promptOf(decision)?.highlight);
		expect(slices).toContain('gh issue comment 1 -b "a"');
		expect(slices).toContain('gh issue create -t "b"');
	});

	it("highlights the whole invocation — the content is the evidence", async () => {
		const command = 'gh issue create -t "Fix typos" -b "Detailed body"';
		const decision = await publishDecision(command);
		const slices = highlightSlices(command, promptOf(decision)?.highlight);
		expect(slices).toContain(command);
	});

	it("uses Publish/Cancel labels", async () => {
		const decision = await publishDecision('gh issue create -t "x"');
		expect(promptOf(decision)?.approveLabel).toBe("Publish");
		expect(promptOf(decision)?.rejectLabel).toBe("Cancel");
	});

	// --- near misses: these must NOT prompt ---

	it("does NOT prompt for read-only subcommands", async () => {
		expect(await publishDecision("gh issue list")).toBeUndefined();
		expect(await publishDecision("gh issue view 42")).toBeUndefined();
		expect(await publishDecision("gh issue status")).toBeUndefined();
	});

	it("does NOT prompt for state-only subcommands", async () => {
		expect(await publishDecision("gh issue close 42")).toBeUndefined();
		expect(await publishDecision("gh issue reopen 42")).toBeUndefined();
		expect(await publishDecision("gh issue delete 42")).toBeUndefined();
		expect(
			await publishDecision("gh issue transfer 42 owner/repo"),
		).toBeUndefined();
		expect(await publishDecision("gh issue pin 42")).toBeUndefined();
		expect(await publishDecision("gh issue unpin 42")).toBeUndefined();
		expect(await publishDecision("gh issue lock 42")).toBeUndefined();
		expect(await publishDecision("gh issue unlock 42")).toBeUndefined();
	});

	it("does NOT prompt for branch-only `develop`", async () => {
		expect(await publishDecision("gh issue develop 42")).toBeUndefined();
	});

	it("does NOT prompt for help invocations (nothing is published)", async () => {
		expect(await publishDecision("gh issue create --help")).toBeUndefined();
		expect(await publishDecision("gh issue edit -h")).toBeUndefined();
	});

	it("does NOT prompt for non-issue gh commands", async () => {
		expect(await publishDecision('gh pr create -t "PR title"')).toBeUndefined();
		expect(
			await publishDecision("gh api repos/owner/repo/issues -f title=x"),
		).toBeUndefined();
	});

	it("does NOT prompt when the verb position is missing or not a verb", async () => {
		expect(await publishDecision("gh issue")).toBeUndefined();
		expect(await publishDecision("gh issue 42")).toBeUndefined();
	});

	it("does NOT prompt for quoted mentions", async () => {
		expect(await publishDecision('echo "gh issue create"')).toBeUndefined();
		expect(
			await publishDecision('echo "run: gh issue comment 1 -b hi"'),
		).toBeUndefined();
	});
});

describe("gh pr publish gate", () => {
	it("registers the hook", () => {
		expect(prPublish).toBeDefined();
	});

	it("asks before creating a pull request", async () => {
		const decision = await prDecision(
			'gh pr create -t "Add feature" -b "Description"',
		);
		expect(promptOf(decision)).toBeDefined();
		expect(guidanceOf(decision)).toContain("create a new pull request");
	});

	it("asks before editing a pull request", async () => {
		const decision = await prDecision('gh pr edit 42 --title "New title"');
		expect(promptOf(decision)).toBeDefined();
		expect(guidanceOf(decision)).toContain("edit an existing pull request");
	});

	it("asks before commenting on a pull request", async () => {
		const decision = await prDecision('gh pr comment 42 -b "Looks good"');
		expect(promptOf(decision)).toBeDefined();
		expect(guidanceOf(decision)).toContain("post a comment on a pull request");
	});

	it("asks before submitting a review", async () => {
		const decision = await prDecision('gh pr review 42 --approve -b "LGTM"');
		expect(promptOf(decision)).toBeDefined();
		expect(guidanceOf(decision)).toContain("submit a pull request review");
	});

	it("resolves the verb past gh global value flags", async () => {
		const decision = await prDecision('gh -R owner/repo pr create -t "x"');
		expect(promptOf(decision)).toBeDefined();
	});

	it("uses Publish/Cancel labels", async () => {
		const decision = await prDecision('gh pr create -t "x"');
		expect(promptOf(decision)?.approveLabel).toBe("Publish");
		expect(promptOf(decision)?.rejectLabel).toBe("Cancel");
	});

	it("does NOT prompt for read-only or state-only pr commands", async () => {
		expect(await prDecision("gh pr list")).toBeUndefined();
		expect(await prDecision("gh pr view 42")).toBeUndefined();
		expect(await prDecision("gh pr diff")).toBeUndefined();
		expect(await prDecision("gh pr status")).toBeUndefined();
		expect(await prDecision("gh pr merge 42")).toBeUndefined();
		expect(await prDecision("gh pr close 42")).toBeUndefined();
		expect(await prDecision("gh pr lock 42")).toBeUndefined();
		expect(await prDecision("gh pr ready 42")).toBeUndefined();
		expect(await prDecision("gh pr checkout 42")).toBeUndefined();
	});

	it("does NOT prompt for help invocations", async () => {
		expect(await prDecision("gh pr create --help")).toBeUndefined();
	});

	it("does NOT prompt for issue commands (handled by the issue hook)", async () => {
		expect(await prDecision('gh issue create -t "x"')).toBeUndefined();
	});
});

describe("gh api issue/pr write gate", () => {
	it("registers the hook", () => {
		expect(apiWrite).toBeDefined();
	});

	it("asks before POSTing an issue", async () => {
		const decision = await apiDecision(
			"gh api -X POST repos/o/r/issues -f title=x -f body=y",
		);
		expect(promptOf(decision)).toBeDefined();
	});

	it("asks when the method flag follows the URL", async () => {
		const decision = await apiDecision("gh api repos/o/r/issues --method POST");
		expect(promptOf(decision)).toBeDefined();
	});

	it("asks before PATCHing an issue", async () => {
		const decision = await apiDecision(
			"gh api --method=PATCH repos/o/r/issues/1 -f body=edited",
		);
		expect(promptOf(decision)).toBeDefined();
	});

	it("asks before POSTing a PR, a PR review, and a comment", async () => {
		expect(
			promptOf(
				await apiDecision(
					"gh api -X POST repos/o/r/pulls -f title=t -f head=b",
				),
			),
		).toBeDefined();
		expect(
			promptOf(
				await apiDecision(
					"gh api -X POST repos/o/r/pulls/1/reviews -f body=r",
				),
			),
		).toBeDefined();
		expect(
			promptOf(
				await apiDecision(
					"gh api -X POST repos/o/r/issues/1/comments -f body=c",
				),
			),
		).toBeDefined();
	});

	it("uses Send/Cancel labels", async () => {
		const decision = await apiDecision("gh api -X POST repos/o/r/issues -f title=x");
		expect(promptOf(decision)?.approveLabel).toBe("Send");
		expect(promptOf(decision)?.rejectLabel).toBe("Cancel");
	});

	it("does NOT prompt for GET requests (default method)", async () => {
		expect(await apiDecision("gh api repos/o/r/issues")).toBeUndefined();
		expect(await apiDecision("gh api repos/o/r/issues/1")).toBeUndefined();
		expect(await apiDecision("gh api repos/o/r/issues -f state=open")).toBeUndefined();
	});

	it("does NOT prompt for state, metadata, or non-content endpoints", async () => {
		expect(
			await apiDecision("gh api -X PUT repos/o/r/issues/1/lock"),
		).toBeUndefined();
		expect(
			await apiDecision("gh api -X DELETE repos/o/r/issues/1/comments/5"),
		).toBeUndefined();
		expect(
			await apiDecision("gh api -X POST repos/o/r/issues/1/assignees"),
		).toBeUndefined();
	});

	it("does NOT prompt for graphql or non-issue/pr endpoints", async () => {
		expect(await apiDecision("gh api graphql -f query=query{}")).toBeUndefined();
		expect(await apiDecision("gh api -X POST repos/o/r/releases")).toBeUndefined();
	});

	it("does NOT prompt for help", async () => {
		expect(await apiDecision("gh api --help")).toBeUndefined();
	});
});
