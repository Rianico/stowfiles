import type {
	PermissionsAPI,
	ToolUsePermissionHook,
} from "@rianico/pi-permission-lsz";

export type Registered = Pick<ToolUsePermissionHook, "name" | "handler">;

export function loadHooks(
	module: (api: PermissionsAPI) => void,
): Map<string, Registered> {
	const hooks = new Map<string, Registered>();
	module({
		onToolUse: (hook) => hooks.set(hook.name, hook),
	} as PermissionsAPI);
	return hooks;
}

export function bashInput(command: string) {
	return {
		toolName: "bash" as const,
		input: { command },
		detail: command,
		command,
	};
}

export function run(hook: Registered, tool: unknown, cwd: string) {
	return hook.handler({ cwd, permissionRoot: cwd, tool } as never);
}

export interface RequestPromptShape {
	guidance?: string;
	highlight?: unknown;
	approveLabel?: string;
	editLabel?: string;
	rejectLabel?: string;
}

export function promptOf(decision: unknown): RequestPromptShape | undefined {
	if (
		typeof decision === "object" &&
		decision !== null &&
		(decision as { decision?: string }).decision === "request"
	) {
		return (decision as { prompt?: RequestPromptShape }).prompt;
	}
	return undefined;
}

export function highlightSlices(command: string, highlight: unknown): string[] {
	return resolveHighlightSpans(command, highlight).map((span) =>
		command.slice(span.start, span.end),
	);
}

// matchCommand now merges the matched command's identity into the hook's
// highlight as a lazy function; resolve it against the command under test.
function resolveHighlightSpans(
	command: string,
	highlight: unknown,
): Array<{ start: number; end: number }> {
	if (typeof highlight === "function") {
		try {
			return resolveHighlightSpans(command, (highlight as (detail: string) => unknown)(command));
		} catch {
			return [];
		}
	}
	if (Array.isArray(highlight)) {
		return highlight as Array<{ start: number; end: number }>;
	}
	return [];
}
