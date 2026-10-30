/**
 * Shared harness for the vendored rules-injector suites.
 *
 * A registered extension is driven through the seams it actually registered: session
 * start, prompt start, tool result, compaction, and its command. Assertions in the suites
 * read the resulting notifications, section bodies and messages — the extension's
 * internal state is never inspected.
 */
import type {
	BeforeAgentStartEvent,
	CustomMessageDraft,
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionCommandOptions,
	ExtensionContext,
	ExtensionUI,
	SendMessageOptions,
	SessionCompactEvent,
	SessionStartEvent,
	ToolResultEvent,
} from "@earendil-works/pi-coding-agent";

/** A pi extension factory: the default export shape of every injector here. */
export type Injector = (pi: ExtensionAPI) => void;

export interface Notification {
	message: string;
	type: string | undefined;
}

export interface SentMessage {
	draft: CustomMessageDraft;
	options: SendMessageOptions | undefined;
}

interface CommandInvocation {
	name: string;
	description?: string;
	handler: (args: string, ctx: ExtensionCommandContext) => Promise<void> | void;
}

type Handler = (event: unknown, ctx: ExtensionContext) => unknown;

/** The seams one registered extension exposes, phrased in runtime events. */
export interface Harness {
	notifications: Notification[];
	messages: SentMessage[];
	startSession(reason: SessionStartEvent["reason"]): Promise<void>;
	/** Run one prompt start and return the handler's result plus the sections it wrote. */
	promptStart(): Promise<{ result: unknown; sections: Record<string, string> }>;
	toolResult(toolName: string, input: Record<string, unknown>): void;
	compact(reason?: SessionCompactEvent["reason"]): Promise<void>;
	runRulesCommand(args?: string): Promise<string[]>;
}

/** Register `injector` against a stub API rooted at `projectRoot`. */
export function createHarness(injector: Injector, projectRoot: string): Harness {
	const handlers = new Map<string, Handler>();
	const notifications: Notification[] = [];
	const messages: SentMessage[] = [];
	let command: CommandInvocation | undefined;

	const ui: ExtensionUI = {
		notify(message, type) {
			notifications.push({ message, type });
		},
	};
	const ctx: ExtensionContext = { cwd: projectRoot, ui };

	const api = {
		on(name: string, handler: Handler) {
			handlers.set(name, handler);
		},
		registerCommand(name: string, options: ExtensionCommandOptions) {
			command = { name, ...options };
		},
		appendEntry() {},
		sendMessage(draft: CustomMessageDraft, options?: SendMessageOptions) {
			messages.push({ draft, options });
		},
	} as unknown as ExtensionAPI;

	injector(api);

	function handler(name: string): Handler {
		const registered = handlers.get(name);
		if (registered === undefined) throw new Error(`${name} hook was not registered`);
		return registered;
	}

	return {
		notifications,
		messages,
		async startSession(reason) {
			await handler("session_start")({ type: "session_start", reason }, ctx);
		},
		async promptStart() {
			const event: BeforeAgentStartEvent = {
				type: "before_agent_start",
				systemPrompt: "preamble",
				systemPromptOptions: { cwd: projectRoot, sections: {}, skills: [] },
			};
			const result = await handler("before_agent_start")(event, ctx);
			return { result, sections: event.systemPromptOptions.sections };
		},
		toolResult(toolName, input) {
			const event: ToolResultEvent = {
				type: "tool_result",
				toolName,
				input,
				content: [],
				isError: false,
			};
			handler("tool_result")(event, ctx);
		},
		async compact(reason = "manual") {
			await handler("session_compact")({ type: "session_compact", reason }, ctx);
		},
		async runRulesCommand(args = "") {
			if (command === undefined) throw new Error("/rules command was not registered");
			notifications.length = 0;
			await command.handler(args, ctx);
			return notifications.map((notification) => notification.message);
		},
	};
}

/** The message body as text; a custom-message draft may also carry image parts. */
export function messageText(
	content: CustomMessageDraft["content"] | undefined,
): string {
	if (typeof content === "string") return content;
	if (content === undefined) return "";
	return content
		.map((part) => (part.type === "text" ? part.text : ""))
		.join("");
}
