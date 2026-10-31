import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import {
	basename,
	dirname,
	isAbsolute,
	join,
	relative,
	resolve,
} from "node:path";
import {
	block,
	matchTool,
	parseShellCommand,
	request,
	type PermissionDecision,
	type PermissionsAPI,
	type SimpleCommand,
} from "@rianico/pi-permission-lsz";

// ---------------------------------------------------------------------------
// Gate: the workspace boundary
// ---------------------------------------------------------------------------
//
// The verdict is made on the *physical* path, not the lexical one: symlinks
// are resolved before comparing against the workspace, so a link whose real
// target lies inside the workspace passes without prompting, and a path that
// escapes the workspace through a symlink (even one rooted inside the
// workspace) is still caught. The SDK only resolves paths lexically, so this
// module resolves realpaths itself.
//
// Two accepted gaps: `~user` forms cannot be expanded portably and are
// treated as outside; a dangling symlink cannot be followed, but any
// operation through it fails anyway, so nothing can leak.
//
// Scope of each tool:
//   - `read`, `grep`, `find`, `ls` inspect only, so they may reach anywhere and
//     are not judged here.
//   - `edit`, `write`, and `read_skill` request approval for targets outside
//     the workspace; read-only allowlist roots skip the prompt.
//   - `bash` is judged structurally on the parsed command: any operand or
//     redirect that resolves outside the workspace blocks the call, except for
//     read-only programs (grep/find/ls/cat/…) which may inspect outside paths.

function looksLikeHomePath(path: string): boolean {
	return path.startsWith("~");
}

function expandHome(path: string): string {
	if (path === "~") return homedir();
	if (path.startsWith("~/")) return join(homedir(), path.slice(2));
	return path; // ~user/... — cannot resolve; treated as outside below
}

/**
 * Resolve `path` to its physical location, following symlinks. When the path
 * itself does not exist (e.g. a file about to be created), the nearest
 * existing ancestor is resolved and the missing tail is reattached. Returns
 * undefined when no component along the way resolves (dangling symlink,
 * unreachable tree); callers then fall back to the lexical path.
 */
function realTarget(path: string): string | undefined {
	let current = path;
	const tail: string[] = [];
	for (;;) {
		try {
			return join(realpathSync(current), ...tail);
		} catch {
			const parent = dirname(current);
			if (parent === current) return undefined; // hit the root without resolving
			tail.unshift(basename(current));
			current = parent;
		}
	}
}

/** True when absolute `path` lies outside absolute `base`. */
function isOutside(base: string, path: string): boolean {
	const rel = relative(base, path);
	return rel !== "" && (rel.startsWith("..") || isAbsolute(rel));
}

// ---------------------------------------------------------------------------
// Allowlist: read-only reference content (gathered)
// ---------------------------------------------------------------------------
//
// Outside-workspace access to reference content is expected and should not
// prompt:
// - Pi reference (Homebrew): docs, examples —
//   /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs,
//   /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/examples
// - Coding-agent skills/prompts (Pi / Codex / Claude compat):
//   global ~/.pi/agent/skills, ~/.pi/agent/prompts, ~/.claude/skills,
//   ~/.codex/skills, ~/stowfiles/dotfiles/.pi/agent/prompts, …
//   and project-local .pi/skills, .claude/skills, .agent/skills, etc.
// - System temp (/tmp; macOS resolves to /private/tmp — both forms match):
//   agent scratch output, test fixtures, file-passing between commands.
// - Pi agent git cache (.pi/agent/git — global ~/.pi/agent/git or any
//   <root>/.pi/agent/git): pi-internal VCS state the agent routinely inspects.
//
// `edit`/`write` remain gated inside a project workspace, but the gathered
// roots are cheap to reach, so a bash command that only moves bytes between
// them and the workspace is not a boundary crossing worth blocking.
//
// Skill markers are dot-prefixed roots — substring match is intentional so
// both absolute (/Users/x/.pi/agent/skills/foo/SKILL.md) and expanded
// home (~/.codex/skills/...) forms match without requiring the file to exist.
// A plain `skills/` substring is NOT whitelisted to avoid overly broad bypass.
const SKILL_PATH_MARKERS = [
	".pi/agent/skills",
	".pi/skills",
	".agents/skills",
	".agent/skills",
	".claude/skills",
	".codex/skills",
	".cursor/skills",
	".pi/agent/prompts",
] as const;

// Global dot-configs that are expected to be read outside the workspace
// (e.g. ~/.pi, ~/.claude, ~/.codex).
const GLOBAL_CONFIG_MARKERS = [
	"/.pi/",
	"/.claude/",
	"/.codex/",
	"/.cursor/",
	"/.agents/",
	"/.agent/",
] as const;

const GLOBAL_CONFIG_SUFFIXES = [
	"/.pi",
	"/.claude",
	"/.codex",
	"/.cursor",
	"/.agents",
	"/.agent",
] as const;

const TMP_ROOTS = ["/tmp", "/private/tmp"] as const;

const AGENT_GIT_MARKERS = [".pi/agent/git"] as const;

// Pi docs/examples installed via Homebrew — read-only reference content that
// agents routinely inspect (docs, examples, extensions, skills, etc.).
const PI_DOCS_ROOT =
	"/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs";
const PI_EXAMPLES_ROOT =
	"/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/examples";
const PI_REFERENCE_ROOTS = [PI_DOCS_ROOT, PI_EXAMPLES_ROOT] as const;

function normalize(path: string): string {
	return path.replace(/\\/g, "/");
}

function isGlobalConfigPath(path: string): boolean {
	const normalized = normalize(path);
	return (
		GLOBAL_CONFIG_MARKERS.some((marker) => normalized.includes(marker)) ||
		GLOBAL_CONFIG_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
	);
}

function isTmpPath(path: string): boolean {
	const normalized = normalize(path);
	return TMP_ROOTS.some(
		(root) => normalized === root || normalized.startsWith(`${root}/`),
	);
}

function isAgentGitPath(path: string): boolean {
	const normalized = normalize(path);
	return AGENT_GIT_MARKERS.some((marker) => normalized.includes(marker));
}

function isPiReferencePath(path: string): boolean {
	const normalized = normalize(path);
	return PI_REFERENCE_ROOTS.some(
		(root) =>
			normalized === root ||
			normalized.startsWith(`${root}/`) ||
			normalized.includes(`${root}/`),
	);
}

function isCodingAgentSkillPath(path: string): boolean {
	const normalized = normalize(path);
	return SKILL_PATH_MARKERS.some((marker) => normalized.includes(marker));
}

/** Gathered read-only allowlist, lexical form. */
function isReadOnlyBypassPath(path: string): boolean {
	return (
		isPiReferencePath(path) ||
		isCodingAgentSkillPath(path) ||
		isGlobalConfigPath(path) ||
		isTmpPath(path) ||
		isAgentGitPath(path)
	);
}

/** Gathered read-only allowlist, judged on both the lexical and physical path. */
function isReadOnlyBypassAbsolutePath(
	absolute: string,
	real: string | undefined,
): boolean {
	return (
		isReadOnlyBypassPath(absolute) ||
		(real !== undefined && isReadOnlyBypassPath(real))
	);
}

// ---------------------------------------------------------------------------
// Bash: structural path inspection
// ---------------------------------------------------------------------------
//
// Programs that cannot write the filesystem. They may reach outside the
// workspace: inspecting another tree leaks nothing, and `cd` only moves the
// shell. Anything not listed here is treated as write-capable, so its path
// operands must stay inside the workspace (or inside an allowlisted root).
const READ_ONLY_PROGRAMS = new Set([
	"cat",
	"bat",
	"rg",
	"grep",
	"fd",
	"find",
	"ls",
	"eza",
	"head",
	"tail",
	"wc",
	"stat",
	"file",
	"diff",
	"du",
	"jq",
	"tree",
	"xxd",
	"od",
	"realpath",
	"which",
	"pwd",
	"cd",
	"pushd",
	"popd",
]);

// Redirect targets that are never a boundary crossing.
const DEVICE_SINKS = ["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty"];

function isDeviceSink(path: string): boolean {
	return (
		DEVICE_SINKS.includes(path) ||
		path === "/dev/fd" ||
		path.startsWith("/dev/fd/")
	);
}

/** True when a token can name a location outside the cwd. */
function looksLikePath(text: string): boolean {
	return (
		text === "." ||
		text === ".." ||
		text.startsWith("~") ||
		text.includes("/")
	);
}

/**
 * Path-shaped operands of one command. A bare relative name (`dist`, `*.md`)
 * cannot escape the workspace, so only tokens with a separator, a `..`, or a
 * `~` prefix are resolved. `--flag=value` contributes its value.
 */
function pathOperands(command: SimpleCommand): string[] {
	const operands: string[] = [];
	for (const arg of command.args) {
		const text = arg.text;
		if (text === "--") continue;
		if (text.startsWith("-")) {
			const equals = text.indexOf("=");
			if (equals === -1) continue; // a flag; its value is a separate token
			const value = text.slice(equals + 1);
			if (looksLikePath(value)) operands.push(value);
			continue;
		}
		if (looksLikePath(text)) operands.push(text);
	}
	return operands;
}

/**
 * Redirect targets inside one command's source slice (`> out`, `>> out`,
 * `&> out`). Descriptor duplications (`2>&1`) name no path and are skipped.
 */
function redirectTargets(source: string): string[] {
	const targets: string[] = [];
	let index = 0;
	while (index < source.length) {
		if (source[index] !== ">") {
			index += 1;
			continue;
		}
		let cursor = index + 1;
		if (source[cursor] === ">") cursor += 1;
		while (source[cursor] === " " || source[cursor] === "\t") cursor += 1;
		if (source[cursor] === "&") {
			cursor += 1;
			if (/[0-9-]/.test(source[cursor] ?? "")) {
				index = cursor; // `>&2` duplicates a descriptor
				continue;
			}
		}
		const { text, end } = readToken(source, cursor);
		if (text !== "") targets.push(text);
		index = Math.max(end, index + 1);
	}
	return targets;
}

function readToken(
	source: string,
	start: number,
): { text: string; end: number } {
	const quote = source[start];
	if (quote === '"' || quote === "'") {
		const close = source.indexOf(quote, start + 1);
		const end = close === -1 ? source.length : close;
		return { text: source.slice(start + 1, end), end: end + 1 };
	}
	let end = start;
	while (end < source.length && !/[\s;|&)]/.test(source[end] ?? "")) end += 1;
	return { text: source.slice(start, end), end };
}

/** Commands in source order, so `cd` updates are applied left to right. */
function orderedCommands(commands: readonly SimpleCommand[]): SimpleCommand[] {
	return [...commands].sort((a, b) => a.span.start - b.span.start);
}

function cwdAfter(command: SimpleCommand, cwd: string): string {
	if (command.programName !== "cd") return cwd;
	const [target] = command.positionals();
	if (!target) return cwd;
	const expanded = expandHome(target.text);
	if (expanded.startsWith("~")) return cwd;
	return isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
}

/** True when `text` names a location outside the workspace and its allowlist. */
function crossesBoundary(
	text: string,
	cwd: string,
	realCwd: string,
): boolean {
	const expanded = expandHome(text);
	if (expanded.startsWith("~")) return true; // ~user/...: unresolvable, assume outside
	const absolute = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
	const real = realTarget(absolute);
	const inside =
		real === undefined ? !isOutside(cwd, absolute) : !isOutside(realCwd, real);
	if (inside) return false;
	return !isReadOnlyBypassAbsolutePath(absolute, real);
}

async function bashVerdict(
	command: string,
	cwd: string,
	realCwd: string,
): Promise<PermissionDecision | undefined> {
	const parsed = await parseShellCommand(command);
	const offenders = new Set<string>();
	let currentCwd = resolve(cwd);

	for (const parsedCommand of orderedCommands(parsed.commands)) {
		const slice = command.slice(parsedCommand.span.start, parsedCommand.span.end);
		for (const target of redirectTargets(slice)) {
			if (isDeviceSink(target)) continue;
			if (crossesBoundary(target, currentCwd, realCwd)) offenders.add(target);
		}
		if (!READ_ONLY_PROGRAMS.has(parsedCommand.programName ?? "")) {
			for (const operand of pathOperands(parsedCommand)) {
				if (crossesBoundary(operand, currentCwd, realCwd)) offenders.add(operand);
			}
		}
		currentCwd = cwdAfter(parsedCommand, currentCwd);
	}

	if (offenders.size === 0) return undefined;
	return block(
		`Bash blocked: ${[...offenders].join(", ")} — outside the workspace (${cwd}). ` +
			"Read-only inspection may reach outside; commands that write must stay inside the workspace. " +
			"Run the command from the target directory, or ask the Approver.",
	);
}

// ---------------------------------------------------------------------------
// File tools
// ---------------------------------------------------------------------------

interface PathTool {
	path?: string;
	absolutePath?: string;
	projectPath?: string;
	detail: string;
}

function outsideRequest(
	target: string,
	absolute: string,
	real: string | undefined,
	cwd: string,
	detail: string,
) {
	const guidance =
		real !== undefined && real !== absolute
			? `Accessing ${target} (resolves to ${real}), which is outside the current working directory (${cwd}). Verify before approving.`
			: `Accessing ${target}, which is outside the current working directory (${cwd}). Verify before approving.`;
	return request({
		guidance,
		highlight: [{ start: 0, end: detail.length }],
		approveLabel: "Access",
		rejectLabel: "Cancel",
	});
}

function pathVerdict(
	tool: PathTool,
	cwd: string,
	realCwd: string,
	opts: { allowReadOnlyBypass?: boolean } = {},
) {
	const allowReadOnlyBypass = opts.allowReadOnlyBypass ?? true;
	if (tool.path === undefined) return undefined; // optional-path tools default to the cwd

	const homeRelative = looksLikeHomePath(tool.path);
	const expanded = homeRelative ? expandHome(tool.path) : tool.path;
	const target = homeRelative ? expanded : (tool.absolutePath ?? tool.path);

	// Unexpanded `~user/...` forms cannot be resolved portably; assume outside.
	if (expanded.startsWith("~")) {
		return outsideRequest(expanded, expanded, undefined, cwd, tool.detail);
	}

	const absolute = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);

	// Decide on the physical path; fall back to the lexical path only when no
	// component along the way resolves.
	const real = realTarget(absolute);
	const inside =
		real === undefined ? !isOutside(cwd, absolute) : !isOutside(realCwd, real);

	if (inside) return undefined;

	// Gathered read-only allowlist (reference + skills + global configs + temp + agent git).
	if (allowReadOnlyBypass && isReadOnlyBypassAbsolutePath(absolute, real))
		return undefined;

	return outsideRequest(target, absolute, real, cwd, tool.detail);
}

// ---------------------------------------------------------------------------
// Registration — add further path gates below (dotfile dirs, project roots, …)
// ---------------------------------------------------------------------------

export default function permissions(api: PermissionsAPI) {
	api.onToolUse({
		name: "outside workspace",
		description:
			"Block bash that writes outside the workspace; ask before editing or writing files there.",
		handler(input) {
			const realCwd = realTarget(resolve(input.cwd)) ?? input.cwd;
			return matchTool(input.tool, {
				// Inspection only — these may reach outside the workspace.
				read: () => undefined,
				grep: () => undefined,
				find: () => undefined,
				ls: () => undefined,
				// Mutations: ask, never bypass, so a stray write stays visible.
				edit: (tool) =>
					pathVerdict(tool, input.cwd, realCwd, { allowReadOnlyBypass: false }),
				write: (tool) =>
					pathVerdict(tool, input.cwd, realCwd, { allowReadOnlyBypass: false }),
				bash: (tool) => bashVerdict(tool.command, input.cwd, realCwd),
				custom: {
					// `read_skill` (pi-better-edit) is a plain-text skill loader that
					// bypasses served-state. It should never prompt when the target
					// is a coding-agent skill path (Pi / Claude / Codex). For other
					// locations fall back to the same outside-workspace check as `read`.
					read_skill: (tool) => {
						const raw = (tool.input as Record<string, unknown>).path;
						const candidate = typeof raw === "string" ? raw : tool.detail;
						if (isReadOnlyBypassPath(candidate)) return undefined;
						if (typeof raw !== "string") return undefined;

						const expanded = expandHome(raw);
						const synthetic: PathTool = {
							path: raw,
							absolutePath: isAbsolute(expanded)
								? resolve(expanded)
								: resolve(input.cwd, expanded),
							detail: tool.detail,
						};
						return pathVerdict(synthetic, input.cwd, realCwd, {
							allowReadOnlyBypass: true,
						});
					},
				},
			});
		},
	});
}
