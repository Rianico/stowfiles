import type {
	PermissionsAPI,
	ToolUsePermissionHook,
} from "@thurstonsand/pi-permissions";

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
	const spans = (Array.isArray(highlight) ? highlight : []) as Array<{
		start: number;
		end: number;
	}>;
	return spans.map((span) => command.slice(span.start, span.end));
}
