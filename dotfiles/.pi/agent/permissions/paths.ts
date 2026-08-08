import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
	matchTool,
	request,
	type PermissionsAPI,
} from "@thurstonsand/pi-permissions";

// ---------------------------------------------------------------------------
// Gate: file access outside the current working directory
// ---------------------------------------------------------------------------
//
// The SDK only sets `projectPath` when the resolved path is inside `input.cwd`,
// so an undefined `projectPath` means the call escapes the workspace. One gap:
// the SDK's resolver does not expand `~`, so home-relative paths would be
// misclassified as inside. We expand those ourselves before deciding. `~user`
// forms cannot be expanded portably, so they are treated as outside rather
// than silently passing.

function looksLikeHomePath(path: string): boolean {
	return path.startsWith("~");
}

function expandHome(path: string): string {
	if (path === "~") return homedir();
	if (path.startsWith("~/")) return join(homedir(), path.slice(2));
	return path; // ~user/... — cannot resolve; treated as outside below
}

function isOutsideCwd(path: string, cwd: string): boolean {
	if (path.startsWith("~")) return true; // unexpanded ~user/... forms
	const absolute = isAbsolute(path) ? resolve(path) : resolve(cwd, path);
	const rel = relative(cwd, absolute);
	return rel !== "" && (rel.startsWith("..") || isAbsolute(rel));
}

interface PathTool {
	path?: string;
	absolutePath?: string;
	projectPath?: string;
	detail: string;
}

function pathVerdict(tool: PathTool, cwd: string) {
	if (tool.path === undefined) return undefined; // optional-path tools default to the cwd

	const homeRelative = looksLikeHomePath(tool.path);
	if (tool.projectPath !== undefined && !homeRelative) return undefined; // inside cwd

	const expanded = homeRelative ? expandHome(tool.path) : tool.path;
	if (tool.projectPath !== undefined && !isOutsideCwd(expanded, cwd))
		return undefined;

	const target = homeRelative ? expanded : (tool.absolutePath ?? tool.path);
	return request({
		guidance: `Accessing ${target}, which is outside the current working directory (${cwd}). Verify before approving.`,
		highlight: [{ start: 0, end: tool.detail.length }],
		approveLabel: "Access",
		rejectLabel: "Cancel",
	});
}

// ---------------------------------------------------------------------------
// Registration — add further path gates below (symlink escapes, dotfile dirs, …)
// ---------------------------------------------------------------------------

export default function permissions(api: PermissionsAPI) {
	api.onToolUse({
		name: "outside workspace",
		description:
			"Ask before reading or writing files outside the current working directory.",
		handler(input) {
			return matchTool(input.tool, {
				read: (tool) => pathVerdict(tool, input.cwd),
				edit: (tool) => pathVerdict(tool, input.cwd),
				write: (tool) => pathVerdict(tool, input.cwd),
				grep: (tool) => pathVerdict(tool, input.cwd),
				find: (tool) => pathVerdict(tool, input.cwd),
				ls: (tool) => pathVerdict(tool, input.cwd),
			});
		},
	});
}
