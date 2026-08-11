import {
	matchCommand,
	matchTool,
	request,
	type PermissionsAPI,
	type SimpleCommand,
} from "@thurstonsand/pi-permissions";

// ---------------------------------------------------------------------------
// Gates: publishing GitHub content through the `gh` CLI
// ---------------------------------------------------------------------------
//
// Three hooks, one intent — confront the Approver before content becomes
// visible on GitHub (issues, pull requests, and their comments/reviews appear
// in discussions): the Approver checks the formatting and that the wording
// accurately manifests their thoughts before anyone else sees it.
//
//   - `gh issue publish`: issue content — create / edit / comment
//   - `gh pr publish`:    pull request content — create / edit / comment /
//                         review
//   - `gh api …`:         write requests (POST/PATCH) to issue/PR endpoints
//
// Read-only (`list`, `status`, `view`, `diff`, GET `gh api`), state-only
// (`close`, `reopen`, `merge`, `delete`, `transfer`, `pin`/`unpin`,
// `lock`/`unlock`), branch-only (`develop`, `checkout`), and non-content
// commands stay ungated. GraphQL (`gh api graphql`) cannot be inspected
// structurally and is not gated.

// gh's global flags that take a value — the subcommand walk must skip the
// value so `gh -R owner/repo issue create` still sees `issue` first.
const GH_VALUE_FLAGS = ["-R", "--repo", "--hostname"];

// Program-scoped content verbs. The verb is the second positional after the
// program; `new` is the documented alias of `issue create`.
const ISSUE_VERBS = new Set(["create", "new", "edit", "comment"]);
const PR_VERBS = new Set(["create", "edit", "comment", "review"]);

// Guidance varies by program and verb so the Approver knows exactly what will
// become visible.
function contentGuidance(kind: "issue" | "pr", verb: string): string {
	const kindName = kind === "issue" ? "issue" : "pull request";
	const article = kind === "issue" ? "an" : "a";
	switch (verb) {
		case "create":
		case "new":
			return `This will create a new ${kindName} publicly on GitHub. Verify the title and body are formatted well and accurately manifest your thoughts before publishing.`;
		case "edit":
			return `This will edit an existing ${kindName} publicly on GitHub. Verify the changed fields are formatted well and accurately manifest your thoughts before publishing.`;
		case "comment":
			return `This will post a comment on ${article} ${kindName} publicly on GitHub. Verify the comment text is formatted well and accurately manifests your thoughts before publishing.`;
		case "review":
			return "This will submit a pull request review publicly on GitHub. Verify the review body and decision are formatted well and accurately manifest your thoughts before publishing.";
		default:
			return "";
	}
}

function publishVerb(
	command: SimpleCommand,
	valueFlags: readonly string[],
): string | undefined {
	return command.positionals({ valueFlags })[1]?.text;
}

/**
 * Gate one `gh <program> <verb>` surface. The subcommand matcher guarantees
 * positionals[0] is the program, so positionals[1] is always the verb.
 */
function contentGate(kind: "issue" | "pr", verbs: ReadonlySet<string>) {
	return matchCommand({
		program: "gh",
		subcommands: [kind],
		valueFlags: GH_VALUE_FLAGS,
		where: (command) => {
			const verb = publishVerb(command, GH_VALUE_FLAGS);
			return (
				verb !== undefined &&
				verbs.has(verb) &&
				// --help/-h only prints help; nothing is published.
				!command.hasFlag("--help", "-h")
			);
		},
		onMatch: ({ commands }) => {
			const verb = publishVerb(commands[0], GH_VALUE_FLAGS) ?? "create";

			return request({
				// Whole invocations are highlighted: the command IS the content
				// being published, so the full span is the evidence to review.
				guidance: contentGuidance(kind, verb),
				highlight: commands.map((command) => command.span),
				approveLabel: "Publish",
				rejectLabel: "Cancel",
			});
		},
	});
}

const ghIssuePublish = contentGate("issue", ISSUE_VERBS);
const ghPrPublish = contentGate("pr", PR_VERBS);

// ---------------------------------------------------------------------------
// Gate: gh api writes to issue/PR content endpoints
// ---------------------------------------------------------------------------
//
// `gh api` is a general REST client, so the policy is structural: only a
// write method (POST/PATCH) against an issue/PR content endpoint decides.
// The URL is the first positional after `api`; the method defaults to GET
// unless `-X`/`--method` says otherwise. GET (including with `-f` fields)
// stays read-only and ungated.

const GH_API_VALUE_FLAGS = [
	...GH_VALUE_FLAGS,
	"-X",
	"--method",
	"-f",
	"--field",
	"-F",
	"--raw-field",
	"-H",
	"--header",
	"-i",
	"--input",
	"-q",
	"--jq",
	"--template",
	"-o",
	"--output",
];

const API_WRITE_METHODS = new Set(["POST", "PATCH"]);

// Issue/PR content endpoints: the collection, an item, and their comment and
// review children. State endpoints such as `/issues/1/lock` do not match.
const API_ISSUE_PR_ENDPOINT =
	/^\/?repos\/[^/]+\/[^/]+\/(?:issues(?:\/\d+(?:\/comments(?:\/\d+)?)?)?|pulls(?:\/\d+(?:\/(?:comments|reviews)(?:\/\d+)?)?)?)\/?$/;

function apiUrl(command: SimpleCommand): string | undefined {
	return command.positionals({ valueFlags: GH_API_VALUE_FLAGS })[1]?.text;
}

function apiMethod(command: SimpleCommand): string | undefined {
	const args = command.args;
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (!arg) continue;
		if (arg.text === "-X" || arg.text === "--method") {
			const value = args[index + 1];
			if (value && !value.text.startsWith("-")) {
				return value.text.toUpperCase();
			}
		} else if (arg.text.startsWith("--method=")) {
			return arg.text.slice("--method=".length).toUpperCase();
		}
	}
	return undefined;
}

const ghApiIssuePr = matchCommand({
	program: "gh",
	subcommands: ["api"],
	valueFlags: GH_API_VALUE_FLAGS,
	where: (command) => {
		const url = apiUrl(command);
		const method = apiMethod(command) ?? "GET";
		return (
			url !== undefined &&
			API_WRITE_METHODS.has(method) &&
			API_ISSUE_PR_ENDPOINT.test(url)
		);
	},
	onMatch: ({ commands }) =>
		request({
			guidance:
				"This will submit a GitHub API request that writes issue or pull request content (visible in discussions). Verify the endpoint, method, and fields before approving.",
			highlight: commands.map((command) => command.span),
			approveLabel: "Send",
			rejectLabel: "Cancel",
		}),
});

// ---------------------------------------------------------------------------
// Registration — add further gh gates below (gh release, gh gist, …)
// ---------------------------------------------------------------------------

export default function permissions(api: PermissionsAPI) {
	api.onToolUse({
		name: "gh issue publish",
		description:
			"Ask before publishing issue content to GitHub (create, edit, or comment).",
		handler(input) {
			return matchTool(input.tool, { bash: ghIssuePublish });
		},
	});

	api.onToolUse({
		name: "gh pr publish",
		description:
			"Ask before publishing pull request content to GitHub (create, edit, comment, or review).",
		handler(input) {
			return matchTool(input.tool, { bash: ghPrPublish });
		},
	});

	api.onToolUse({
		name: "gh api issue/pr write",
		description:
			"Ask before a gh api write request (POST/PATCH) to an issue or pull request endpoint.",
		handler(input) {
			return matchTool(input.tool, { bash: ghApiIssuePr });
		},
	});
}
