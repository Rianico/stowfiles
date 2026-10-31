import {
	block,
	matchTool,
	parseShellCommand,
	type PermissionDecision,
	type PermissionsAPI,
	type SimpleCommand,
} from "@rianico/pi-permission-lsz";

// ---------------------------------------------------------------------------
// Gates: publishing destructive GitHub operations / destroying remote state
// ---------------------------------------------------------------------------
//
// Policy: only irreversible loss of remote state is blocked. Publishing content
// (issue and pull request create / edit / comment / review) stays open — the
// Approver already reviews the draft in the session, so a second prompt adds
// nothing.
//
// Blocked:
//   - `gh repo delete`, `gh issue delete`, `gh release delete`,
//     `gh release delete-asset` — the resource is gone.
//   - `gh api` with a DELETE method — same act through the REST surface.
//   - `gh api` PUT/PATCH against a `/git/refs` endpoint — a ref update can
//     rewind or overwrite published history when it is forced.
//
// Everything else is open: reads, state-only verbs (close, reopen, merge,
// lock), branch-only verbs (develop, checkout), and content publishing.

// gh's global flags that take a value — the subcommand walk must skip the
// value so `gh -R owner/repo issue create` still sees `issue` first.
const GH_VALUE_FLAGS = ["-R", "--repo", "--hostname"] as const;

const API_VALUE_FLAGS = [
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
] as const;

// `<resource> <verb>` pairs that delete remote state permanently.
const DELETED_RESOURCES: Readonly<Record<string, readonly string[]>> = {
	repo: ["delete"],
	issue: ["delete"],
	release: ["delete", "delete-asset"],
};

const DESTRUCTIVE_METHODS = new Set(["DELETE"]);

// A ref write is the API spelling of a force push.
const REWRITE_METHODS = new Set(["PUT", "PATCH"]);
const REF_ENDPOINT = /\/git\/refs(?:\/|$)/;

function apiMethod(command: SimpleCommand): string | undefined {
	const args = command.args;
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (!arg) continue;
		if (arg.text === "-X" || arg.text === "--method") {
			const value = args[index + 1];
			if (value && !value.text.startsWith("-")) return value.text.toUpperCase();
		} else if (arg.text.startsWith("--method=")) {
			return arg.text.slice("--method=".length).toUpperCase();
		}
	}
	return undefined;
}

/** `gh <resource> <verb>` for resources whose verb deletes them. */
function resourceVerdict(
	commands: readonly SimpleCommand[],
): PermissionDecision | undefined {
	for (const command of commands) {
		if (command.programName !== "gh") continue;
		// --help/-h only prints usage; nothing is deleted.
		if (command.hasFlag("--help", "-h")) continue;
		const words = command.positionals({ valueFlags: API_VALUE_FLAGS });
		const resource = words[0]?.text;
		const verb = words[1]?.text;
		if (resource === undefined || resource === "api") continue;
		if (verb === undefined) continue;
		const verbs = DELETED_RESOURCES[resource];
		if (!verbs?.includes(verb)) continue;
		return block(
			`Blocked: "gh ${resource} ${verb}" deletes remote state permanently. ` +
				"Ask the Approver to run it if this is intended.",
		);
	}
	return undefined;
}

/** `gh api` writes that delete or rewind remote state. */
function apiVerdict(
	commands: readonly SimpleCommand[],
): PermissionDecision | undefined {
	for (const command of commands) {
		if (command.programName !== "gh") continue;
		if (command.hasFlag("--help", "-h")) continue;
		const words = command.positionals({ valueFlags: API_VALUE_FLAGS });
		if (words[0]?.text !== "api") continue;
		const url = words[1]?.text;
		if (url === undefined) continue;

		const method = apiMethod(command) ?? "GET";
		if (DESTRUCTIVE_METHODS.has(method)) {
			return block(
				`Blocked: "gh api -X ${method} ${url}" deletes remote state permanently. ` +
					"Ask the Approver to run it if this is intended.",
			);
		}
		if (REWRITE_METHODS.has(method) && REF_ENDPOINT.test(url)) {
			return block(
				`Blocked: writing ${url} with ${method} rewrites a published ref. ` +
					"Ask the Approver to run it if this is intended.",
			);
		}
	}
	return undefined;
}


// ---------------------------------------------------------------------------
// Registration — add further gh gates below (gh secret delete, …)
// ---------------------------------------------------------------------------

export default function permissions(api: PermissionsAPI) {
	api.onToolUse({
		name: "gh resource delete",
		description:
			"Block gh commands that delete a repository, issue, or release.",
		async handler(input) {
			return matchTool(input.tool, {
				async bash(tool) {
					const parsed = await parseShellCommand(tool.command);
					return resourceVerdict(parsed.commands);
				},
			});
		},
	});

	api.onToolUse({
		name: "gh api destructive write",
		description:
			"Block gh api DELETE calls and ref rewrites that destroy remote state.",
		async handler(input) {
			return matchTool(input.tool, {
				async bash(tool) {
					const parsed = await parseShellCommand(tool.command);
					return apiVerdict(parsed.commands);
				},
			});
		},
	});
}
