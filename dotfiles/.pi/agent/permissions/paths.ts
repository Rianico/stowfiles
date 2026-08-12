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
	request,
	type PermissionsAPI,
} from "pi-permission-lsz";

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

function pathVerdict(tool: PathTool, cwd: string, realCwd: string) {
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
		real !== undefined ? !isOutside(realCwd, real) : !isOutside(cwd, absolute);

	if (inside) return undefined;

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
				read: (tool) => pathVerdict(tool, input.cwd, realCwd),
				edit: (tool) => pathVerdict(tool, input.cwd, realCwd),
				write: (tool) => pathVerdict(tool, input.cwd, realCwd),
				grep: (tool) => pathVerdict(tool, input.cwd, realCwd),
				find: (tool) => pathVerdict(tool, input.cwd, realCwd),
				ls: (tool) => pathVerdict(tool, input.cwd, realCwd),
			});
		},
	});
}
