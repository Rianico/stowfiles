// Minimal ambient types for the single pi-core module the SDK's tool-input.ts
// imports at runtime (`isToolCallEventType`) and for its tool-event types.
// The shapes mirror @earendil-works/pi-coding-agent's ToolCallEvent family so
// the SDK's typecheck graph resolves without installing pi itself.
declare module "@earendil-works/pi-coding-agent" {
	interface ToolCallEventBase {
		toolName: string;
		input: Record<string, unknown>;
		detail: string;
	}

	interface BashToolCallEvent extends ToolCallEventBase {
		toolName: "bash";
		input: { command: string };
	}
	interface ReadToolCallEvent extends ToolCallEventBase {
		toolName: "read";
		input: { path: string };
	}
	interface EditToolCallEvent extends ToolCallEventBase {
		toolName: "edit";
		input: { path: string };
	}
	interface WriteToolCallEvent extends ToolCallEventBase {
		toolName: "write";
		input: { path: string };
	}
	interface GrepToolCallEvent extends ToolCallEventBase {
		toolName: "grep";
		input: { path?: string };
	}
	interface FindToolCallEvent extends ToolCallEventBase {
		toolName: "find";
		input: { path?: string };
	}
	interface LsToolCallEvent extends ToolCallEventBase {
		toolName: "ls";
		input: { path?: string };
	}
	interface CustomToolCallEvent extends ToolCallEventBase {
		toolName: string;
		input: Record<string, unknown>;
	}

	type ToolCallEvent =
		| BashToolCallEvent
		| ReadToolCallEvent
		| EditToolCallEvent
		| WriteToolCallEvent
		| GrepToolCallEvent
		| FindToolCallEvent
		| LsToolCallEvent
		| CustomToolCallEvent;

	export function isToolCallEventType<TName extends string>(
		toolName: TName,
		event: { toolName: string },
	): event is Extract<ToolCallEvent, { toolName: TName }>;
}
