import { describe, expect, it } from "vitest";
import gh from "../gh.ts";
import { bashInput, blockOf, loadHooks, run } from "./helpers.ts";

const hooks = loadHooks(gh);
const resourceDelete = hooks.get("gh resource delete");
const apiWrite = hooks.get("gh api destructive write");

function resourceDecision(command: string) {
	return run(resourceDelete!, bashInput(command), "/tmp/proj");
}

function apiDecision(command: string) {
	return run(apiWrite!, bashInput(command), "/tmp/proj");
}

describe("gh resource delete gate", () => {
	it("registers both hooks", () => {
		expect(resourceDelete).toBeDefined();
		expect(apiWrite).toBeDefined();
	});

	// --- blocked: permanent deletion of remote state ---

	it("blocks gh repo delete", async () => {
		expect(blockOf(await resourceDecision("gh repo delete owner/repo"))).toContain(
			"deletes remote state permanently",
		);
	});

	it("blocks gh issue delete", async () => {
		expect(blockOf(await resourceDecision("gh issue delete 42"))).toContain(
			"deletes remote state permanently",
		);
	});

	it("blocks gh release delete", async () => {
		expect(
			blockOf(await resourceDecision("gh release delete v1.0.0")),
		).toContain("deletes remote state permanently");
	});

	it("blocks gh release delete-asset", async () => {
		expect(
			blockOf(await resourceDecision("gh release delete-asset v1.0.0 app.dmg")),
		).toContain("deletes remote state permanently");
	});

	it("resolves past gh global value flags", async () => {
		expect(
			blockOf(await resourceDecision("gh -R owner/repo issue delete 42")),
		).toContain("deletes remote state permanently");
	});

	it("resolves through sudo and shell -c payloads", async () => {
		expect(blockOf(await resourceDecision("sudo gh repo delete owner/repo"))).toContain(
			"deletes remote state permanently",
		);
		expect(
			blockOf(await resourceDecision("bash -c 'gh issue delete 42'")),
		).toContain("deletes remote state permanently");
	});

	it("blocks inside a compound command", async () => {
		expect(
			blockOf(await resourceDecision("gh issue close 1 && gh issue delete 2")),
		).toContain("deletes remote state permanently");
	});

	// --- open: publishing content ---

	it("does NOT block publishing issue content", async () => {
		expect(
			await resourceDecision('gh issue create -t "Fix typos" -b "Body"'),
		).toBeUndefined();
		expect(await resourceDecision("gh issue new -t x")).toBeUndefined();
		expect(await resourceDecision("gh issue edit 42 --title x")).toBeUndefined();
		expect(await resourceDecision("gh issue comment 42 -b hi")).toBeUndefined();
	});

	it("does NOT block publishing pull request content", async () => {
		expect(await resourceDecision("gh pr create -t x -b y")).toBeUndefined();
		expect(await resourceDecision("gh pr edit 42 --title x")).toBeUndefined();
		expect(await resourceDecision("gh pr comment 42 -b hi")).toBeUndefined();
		expect(
			await resourceDecision("gh pr review 42 --approve -b LGTM"),
		).toBeUndefined();
	});

	it("does NOT block state-only or read-only verbs", async () => {
		expect(await resourceDecision("gh issue close 42")).toBeUndefined();
		expect(await resourceDecision("gh issue transfer 42 owner/repo")).toBeUndefined();
		expect(await resourceDecision("gh pr merge 42")).toBeUndefined();
		expect(await resourceDecision("gh issue list")).toBeUndefined();
		expect(await resourceDecision("gh repo view owner/repo")).toBeUndefined();
	});

	it("does NOT block help or quoted mentions", async () => {
		expect(await resourceDecision("gh repo delete --help")).toBeUndefined();
		expect(await resourceDecision('echo "gh repo delete owner/repo"')).toBeUndefined();
	});
});

describe("gh api destructive write gate", () => {
	it("blocks a DELETE request", async () => {
		expect(
			blockOf(await apiDecision("gh api -X DELETE repos/o/r/issues/1")),
		).toContain("deletes remote state permanently");
	});

	it("blocks a DELETE request spelled as --method=", async () => {
		expect(
			blockOf(
				await apiDecision(
					"gh api repos/o/r/issues/1/comments/5 --method=DELETE",
				),
			),
		).toContain("deletes remote state permanently");
	});

	it("blocks a forced ref update", async () => {
		expect(
			blockOf(
				await apiDecision(
					"gh api -X PATCH repos/o/r/git/refs/heads/main -f sha=1234 -F force=true",
				),
			),
		).toContain("rewrites a published ref");
	});

	it("blocks a PUT ref update", async () => {
		expect(
			blockOf(await apiDecision("gh api -X PUT repos/o/r/git/refs/heads/main")),
		).toContain("rewrites a published ref");
	});

	it("blocks through sudo", async () => {
		expect(
			blockOf(await apiDecision("sudo gh api -X DELETE repos/o/r/releases/1")),
		).toContain("deletes remote state permanently");
	});

	// --- open: reads and content writes ---

	it("does NOT block GET requests", async () => {
		expect(await apiDecision("gh api repos/o/r/issues")).toBeUndefined();
		expect(await apiDecision("gh api repos/o/r/issues -f state=open")).toBeUndefined();
	});

	it("does NOT block POSTing content", async () => {
		expect(
			await apiDecision("gh api -X POST repos/o/r/issues -f title=x"),
		).toBeUndefined();
		expect(
			await apiDecision("gh api -X POST repos/o/r/pulls/1/reviews -f body=r"),
		).toBeUndefined();
	});

	it("does NOT block state endpoints", async () => {
		expect(await apiDecision("gh api -X PUT repos/o/r/issues/1/lock")).toBeUndefined();
	});

	it("does NOT block graphql or help", async () => {
		expect(await apiDecision("gh api graphql -f query=query{}")).toBeUndefined();
		expect(await apiDecision("gh api --help")).toBeUndefined();
	});

	it("does NOT block quoted mentions", async () => {
		expect(
			await apiDecision('echo "gh api -X DELETE repos/o/r/issues/1"'),
		).toBeUndefined();
	});
});
