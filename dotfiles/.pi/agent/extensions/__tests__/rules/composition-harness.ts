/**
 * Combined harness for the multi-injector composition suites.
 *
 * Every injector registers against ONE stub API, so their handlers observe the same
 * prompt event in registration order — the runtime's contract: sections accumulate and
 * no handler replaces the prompt. Section names appear only as data here; there is no
 * shared name registry, which is what the disjoint-keys case proves.
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
	SessionStartEvent,
	Skill,
	ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import type { Injector, Notification, SentMessage } from "./harness.ts";

type Handler = (event: unknown, ctx: ExtensionContext) => unknown;

export interface CompositionHarness {
	notifications: Notification[];
	messages: SentMessage[];
	startSession(reason: SessionStartEvent["reason"]): Promise<void>;
	/** Drive every prompt-start handler over one event and render the result. */
	promptStart(): Promise<{
		results: unknown[];
		sections: Record<string, string>;
		prompt: string;
	}>;
	toolResult(toolName: string, input: Record<string, unknown>): void;
}

/**
 * The runtime's fencing rule: `preamble` is untagged, every other section is wrapped as
 * `<name>…</name>`, and an empty body is dropped.
 */
export function renderSections(sections: Record<string, string>): string {
	return Object.entries(sections)
		.filter(([, body]) => body !== "")
		.map(([name, body]) => (name === "preamble" ? body : `<${name}>\n${body}\n</${name}>`))
		.join("\n");
}

/** Register `injectors` in order against one stub API rooted at `projectRoot`. */
export function createCompositionHarness(
	injectors: readonly Injector[],
	projectRoot: string,
	skills: Skill[],
): CompositionHarness {
	const handlers = new Map<string, Handler[]>();
	const notifications: Notification[] = [];
	const messages: SentMessage[] = [];

	const ui: ExtensionUI = {
		notify(message, type) {
			notifications.push({ message, type });
		},
	};
	const ctx: ExtensionContext = { cwd: projectRoot, ui };

	const api = {
		on(name: string, handler: Handler) {
			const registered = handlers.get(name) ?? [];
			registered.push(handler);
			handlers.set(name, registered);
		},
		registerCommand(_name: string, _options: ExtensionCommandOptions) {},
		appendEntry() {},
		sendMessage(draft: CustomMessageDraft, options?: SendMessageOptions) {
			messages.push({ draft, options });
		},
	} as unknown as ExtensionAPI;

	for (const injector of injectors) injector(api);

	function handlersFor(name: string): Handler[] {
		return handlers.get(name) ?? [];
	}

	return {
		notifications,
		messages,
		async startSession(reason) {
			for (const handler of handlersFor("session_start")) {
				await handler({ type: "session_start", reason }, ctx);
			}
		},
		async promptStart() {
			const event: BeforeAgentStartEvent = {
				type: "before_agent_start",
				systemPrompt: "preamble",
				systemPromptOptions: { cwd: projectRoot, sections: {}, skills },
			};
			const results: unknown[] = [];
			for (const handler of handlersFor("before_agent_start")) {
				results.push(await handler(event, ctx));
			}
			const { sections } = event.systemPromptOptions;
			return { results, sections, prompt: renderSections(sections) };
		},
		toolResult(toolName, input) {
			const event: ToolResultEvent = {
				type: "tool_result",
				toolName,
				input,
				content: [],
				isError: false,
			};
			for (const handler of handlersFor("tool_result")) handler(event, ctx);
		},
	};
}
