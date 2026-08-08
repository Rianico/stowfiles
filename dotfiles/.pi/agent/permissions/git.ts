import {
	gitValueFlags,
	matchCommand,
	matchTool,
	request,
	type HighlightSpan,
	type PermissionsAPI,
	type SimpleCommand,
} from "@thurstonsand/pi-permissions";

// ---------------------------------------------------------------------------
// Gate: git commit
// ---------------------------------------------------------------------------
//
// `--dry-run` performs no commit, so it is excluded rather than prompting.
// Note `-n` is NOT excluded here: for `commit` it means `--no-verify`, and the
// commit does happen.

const gitCommit = matchCommand({
	program: "git",
	subcommands: ["commit"],
	valueFlags: gitValueFlags,
	where: (command) => !command.hasFlag("--dry-run"),
	onMatch: ({ commands }) => {
		const highlight = commands.flatMap((command) => {
			const message = messageSpans(command);
			return message.length > 0 ? message : [command.span];
		});

		return request({
			guidance: "Review the commit message before approving.",
			highlight,
			approveLabel: "Commit",
			rejectLabel: "Cancel commit",
		});
	},
});

// ---------------------------------------------------------------------------
// Gate: git push
// ---------------------------------------------------------------------------
//
// Force-push detection covers the exact spellings plus the `=`-value forms
// (`--force-with-lease=<ref>:<expect>`) that the SDK's `hasFlag` cannot match.
// `-n`/`--dry-run` performs no push, so it is excluded rather than prompting.

const FORCE_FLAGS = [
	"-f",
	"--force",
	"--force-with-lease",
	"--force-if-includes",
];
const FORCE_VALUE_FLAGS = ["--force-with-lease=", "--force-if-includes="];

const gitPush = matchCommand({
	program: "git",
	subcommands: ["push"],
	valueFlags: gitValueFlags,
	where: (command) => !command.hasFlag("--dry-run", "-n"),
	onMatch: ({ commands }) => {
		const forcePush = commands.some(
			(command) =>
				command.hasFlag(...FORCE_FLAGS) ||
				command.args.some((arg) =>
					FORCE_VALUE_FLAGS.some((flag) => arg.text.startsWith(flag)),
				),
		);

		return request({
			guidance: forcePush
				? "Force push detected — review the remote, branch, and rewritten history before approving."
				: "Review the remote, branch, and any force flags before approving.",
			highlight: commands.map((command) => command.span),
			approveLabel: "Push",
			rejectLabel: "Cancel push",
		});
	},
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const MESSAGE_LONG_FLAGS = ["--message", "--file"];
const MESSAGE_SHORT_CHARS = ["m", "F"];

/**
 * Collect the tokens that carry a commit message so the Approver can review
 * exactly that evidence: `-m`/`--message` values, `-F`/`--file` targets, and
 * combined short forms such as `-am` or `-aF`. A value attached to the flag
 * token itself (`-mfoo`, `--message=inline`) is highlighted as part of that
 * token; a separate value token is highlighted and skipped. Returns an empty
 * array when the invocation carries no explicit message flag.
 */
function messageSpans(command: SimpleCommand): HighlightSpan[] {
	const spans: HighlightSpan[] = [];
	const args = command.args;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (!arg) continue;

		const text = arg.text;
		const isLongMessage = MESSAGE_LONG_FLAGS.some(
			(flag) => text === flag || text.startsWith(`${flag}=`),
		);
		const shortBody = /^-[^-]/.test(text) ? text.slice(1) : "";
		const messageCharIndex = [...shortBody].findIndex((char) =>
			MESSAGE_SHORT_CHARS.includes(char),
		);
		const isShortMessage = shortBody.length > 0 && messageCharIndex !== -1;

		if (!isLongMessage && !isShortMessage) continue;

		spans.push(arg);
		const valueAttached =
			text.includes("=") ||
			(isShortMessage && shortBody.slice(messageCharIndex + 1) !== "");
		if (valueAttached) continue;

		const value = args[index + 1];
		if (value) {
			spans.push(value);
			index += 1;
		}
	}

	return spans;
}

// ---------------------------------------------------------------------------
// Registration — add further git gates below (rebase, reset --hard, …)
// ---------------------------------------------------------------------------

export default function permissions(api: PermissionsAPI) {
	api.onToolUse({
		name: "git commit",
		description: "Ask before the agent creates a commit.",
		handler(input) {
			return matchTool(input.tool, { bash: gitCommit });
		},
	});

	api.onToolUse({
		name: "git push",
		description: "Ask before the agent pushes commits to a remote.",
		handler(input) {
			return matchTool(input.tool, { bash: gitPush });
		},
	});
}
