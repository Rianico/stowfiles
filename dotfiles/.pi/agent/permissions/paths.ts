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
	matchTool,
	parseShellCommand,
	request,
} from "@rianico/pi-permission-lsz";
import type { PermissionsAPI } from "@rianico/pi-permission-lsz";

// ---------------------------------------------------------------------------
// Gate: file access outside the current working directory
// ---------------------------------------------------------------------------
//
// The verdict is made on the *physical* path, not the lexical one: symlinks
// are resolved before comparing against the workspace, so a link whose real
// target lies inside the workspace passes without prompting, and a path that
// escapes the workspace through a symlink (even one rooted inside the
// workspace) still prompts. The SDK only resolves paths lexically, so this
// module resolves realpaths itself.
//
// Two accepted gaps: `~user` forms cannot be expanded portably and are
// treated as outside; a dangling symlink cannot be followed, but any
// operation through it fails anyway, so nothing can leak.

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
// Outside-workspace reads of reference content are expected and should not prompt:
// - Pi reference (Homebrew): docs, examples —
//   /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs,
//   /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/examples
// - Coding-agent skills/prompts (Pi / Codex / Claude compat):
//   global ~/.pi/agent/skills, ~/.pi/agent/prompts, ~/.claude/skills,
//   ~/.codex/skills, ~/stowfiles/dotfiles/.pi/agent/prompts, …
//   and project-local .pi/skills, .claude/skills, .agent/skills, etc.
// Gathered here so every read-only request
// (read/grep/find/ls/read_skill, bash cat/bat/rg/grep/fd/find/ls/eza)
// bypasses by default; edit/write remain gated.
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
// (e.g. ~/.pi, ~/.claude, ~/.codex). Read-only probes bypass; edit/write remain gated.
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

function isGlobalConfigPath(path: string): boolean {
	const normalized = path.replace(/\\/g, "/");
	return (
		GLOBAL_CONFIG_MARKERS.some((m) => normalized.includes(m)) ||
		GLOBAL_CONFIG_SUFFIXES.some((s) => normalized.endsWith(s))
	);
}

function isGlobalConfigAbsolutePath(absolute: string, real: string | undefined): boolean {
	return isGlobalConfigPath(absolute) || (real !== undefined && isGlobalConfigPath(real));
}

// Pi docs/examples installed via Homebrew — read-only reference content that agents
// routinely inspect (docs, examples, extensions, skills, etc.). Access via `read` or
// bash `cat`/`rg`/`fd`/`find`/`grep` should not prompt.
const PI_DOCS_ROOT =
	"/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs";
const PI_EXAMPLES_ROOT =
	"/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/examples";
const PI_REFERENCE_ROOTS = [PI_DOCS_ROOT, PI_EXAMPLES_ROOT] as const;
const PI_ALLOWED_ROOTS = PI_REFERENCE_ROOTS;

function isPiReferencePath(path: string): boolean {
	const normalized = path.replace(/\\/g, "/");
	return PI_REFERENCE_ROOTS.some(
		(root) =>
			normalized === root ||
			normalized.startsWith(`${root}/`) ||
			normalized.includes(`${root}/`),
	);
}

function isPiReferenceAbsolutePath(
	absolute: string,
	real: string | undefined,
): boolean {
	return (
		isPiReferencePath(absolute) || (real !== undefined && isPiReferencePath(real))
	);
}

// Back-compat aliases — deprecated, prefer isPiReference*/isReadOnlyBypass*
function isPiDocsPath(path: string): boolean {
	return isPiReferencePath(path);
}

function isPiExamplesPath(path: string): boolean {
	return isPiReferencePath(path);
}

function isPiDocsAbsolutePath(
	absolute: string,
	real: string | undefined,
): boolean {
	return isPiReferenceAbsolutePath(absolute, real);
}

function isPiExamplesAbsolutePath(
	absolute: string,
	real: string | undefined,
): boolean {
	return isPiReferenceAbsolutePath(absolute, real);
}

function isPiAllowedPath(path: string): boolean {
	return isPiReferencePath(path);
}

function isPiAllowedAbsolutePath(
	absolute: string,
	real: string | undefined,
): boolean {
	return isPiReferenceAbsolutePath(absolute, real);
}

// Single set for every read-only bash probe that may bypass (cat/bat/rg/grep/fd/find/ls/eza)
const READONLY_BYPASS_PROGRAMS = new Set([
	"cat",
	"bat",
	"rg",
	"grep",
	"fd",
	"find",
	"ls",
	"eza",
]) as ReadonlySet<string>;
const PI_DOCS_ALLOWED_PROGRAMS = READONLY_BYPASS_PROGRAMS;

function isCodingAgentSkillPath(path: string): boolean {
	const normalized = path.replace(/\\/g, "/");
	return SKILL_PATH_MARKERS.some((marker) => normalized.includes(marker));
}

function isSkillAbsolutePath(
	absolute: string,
	real: string | undefined,
): boolean {
	return (
		isCodingAgentSkillPath(absolute) ||
		(real !== undefined && isCodingAgentSkillPath(real))
	);
}

/** Gathered read-only allowlist: Pi reference + skills/prompts. */
function isReadOnlyBypassPath(path: string): boolean {
	return isPiReferencePath(path) || isCodingAgentSkillPath(path) || isGlobalConfigPath(path);
}

function isReadOnlyBypassAbsolutePath(
	absolute: string,
	real: string | undefined,
): boolean {
	return (
		isPiReferenceAbsolutePath(absolute, real) ||
		isSkillAbsolutePath(absolute, real) ||
		isGlobalConfigAbsolutePath(absolute, real)
	);
}

async function bashTouchesReadOnlyBypass(command: string): Promise<boolean> {
	if (!isReadOnlyBypassPath(command)) return false;
	try {
		const parsed = await parseShellCommand(command);
		return parsed.commands.some((cmd) => {
			const program = cmd.programName ?? cmd.program?.text ?? "";
			if (!READONLY_BYPASS_PROGRAMS.has(program)) return false;
			if (isReadOnlyBypassPath(cmd.program?.text ?? "")) return true;
			return cmd.args.some((arg) => isReadOnlyBypassPath(arg.text));
		});
	} catch {
		// Fallback: raw command already contains a bypass marker and a read-only program
		return [...READONLY_BYPASS_PROGRAMS].some(
			(prog) => command.includes(prog) && isReadOnlyBypassPath(command),
		);
	}
}

async function bashTouchesSkillPath(command: string): Promise<boolean> {
	// Legacy alias — prefer bashTouchesReadOnlyBypass (gathered allowlist).
	// Now gated to read-only programs so `rm`/`cp` etc. touching a skill path still prompt.
	if (!isCodingAgentSkillPath(command)) return false;
	try {
		const parsed = await parseShellCommand(command);
		return parsed.commands.some((cmd) => {
			const program = cmd.programName ?? cmd.program?.text ?? "";
			if (!READONLY_BYPASS_PROGRAMS.has(program)) return false;
			if (isCodingAgentSkillPath(cmd.program?.text ?? "")) return true;
			return cmd.args.some((arg) => isCodingAgentSkillPath(arg.text));
		});
	} catch {
		return [...READONLY_BYPASS_PROGRAMS].some(
			(prog) => command.includes(prog) && isCodingAgentSkillPath(command),
		);
	}
}

async function bashTouchesPiDocsAllowed(command: string): Promise<boolean> {
	if (!isPiDocsPath(command)) return false;
	try {
		const parsed = await parseShellCommand(command);
		return parsed.commands.some((cmd) => {
			const program = cmd.programName ?? cmd.program?.text ?? "";
			if (!PI_DOCS_ALLOWED_PROGRAMS.has(program)) return false;
			if (isPiDocsPath(cmd.program?.text ?? "")) return true;
			return cmd.args.some((arg) => isPiDocsPath(arg.text));
		});
	} catch {
		// Fallback: raw string already contains docs marker and allowed program text
		return [...PI_DOCS_ALLOWED_PROGRAMS].some((prog) => command.includes(prog));
	}
}
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

	const absolute = isAbsolute(expanded)
		? resolve(expanded)
		: resolve(cwd, expanded);

	// Decide on the physical path; fall back to the lexical path only when no
	// component along the way resolves.
	const real = realTarget(absolute);
	const inside =
		real === undefined ? !isOutside(cwd, absolute) : !isOutside(realCwd, real);

	if (inside) return undefined;

	// Gathered read-only allowlist (Pi docs/examples + skills/prompts):
	// bypass only for read-only operations; edit/write remain gated.
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
			"Ask before reading or writing files outside the current working directory.",
		handler(input) {
			const realCwd = realTarget(resolve(input.cwd)) ?? input.cwd;
			return matchTool(input.tool, {
				read: (tool) =>
					pathVerdict(tool, input.cwd, realCwd, { allowReadOnlyBypass: true }),
				edit: (tool) =>
					pathVerdict(tool, input.cwd, realCwd, { allowReadOnlyBypass: false }),
				write: (tool) =>
					pathVerdict(tool, input.cwd, realCwd, { allowReadOnlyBypass: false }),
				grep: (tool) =>
					pathVerdict(tool, input.cwd, realCwd, { allowReadOnlyBypass: true }),
				find: (tool) =>
					pathVerdict(tool, input.cwd, realCwd, { allowReadOnlyBypass: true }),
				ls: (tool) =>
					pathVerdict(tool, input.cwd, realCwd, { allowReadOnlyBypass: true }),
				bash: async (tool) => {
					// Gathered read-only bypass: Pi docs/examples + skills/prompts
					// Only cat/bat/rg/grep/fd/find/ls/eza touching an allowlisted path bypass.
					if (await bashTouchesReadOnlyBypass(tool.command)) return undefined;
					return undefined;
				},
				custom: {
					// `read_skill` (pi-better-edit) is a plain-text skill loader that
					// bypasses served-state. It should never prompt when the target
					// is a coding-agent skill path (Pi / Claude / Codex). For other
					// locations fall back to the same outside-workspace check as `read`.
					read_skill: (tool) => {
						const raw = (tool.input as Record<string, unknown>)["path"];
						const p = typeof raw === "string" ? raw : tool.detail;
						if (isReadOnlyBypassPath(p)) return undefined;
						// Reuse pathVerdict semantics for non-skill read_skill targets
						// by synthesizing a PathTool from the custom input.
						const synthetic: PathTool = {
							path: typeof raw === "string" ? raw : undefined,
							absolutePath:
								typeof raw === "string"
									? isAbsolute(expandHome(raw))
										? resolve(expandHome(raw))
										: resolve(input.cwd, expandHome(raw))
									: undefined,
							detail: tool.detail,
						};
						if (synthetic.path === undefined) return undefined;
						return pathVerdict(synthetic, input.cwd, realCwd, {
							allowReadOnlyBypass: true,
						});
					},
				},
			});
		},
	});
}
