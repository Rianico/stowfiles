/**
 * Minimal stub for the pi SDK's extension surface.
 *
 * The extensions directory is not an npm package: the injectors import the SDK's types
 * only (`import type`), so typechecking needs just the members they touch. Shapes mirror
 * `@earendil-works/pi-coding-agent` 1.3.0 (`dist/core/extensions/types.d.ts`) — update
 * them when the SDK moves.
 *
 * Two deliberate narrowings, both driven by what the injectors read:
 * - context and event objects carry only the fields the injectors use, so a fixture can
 *   build one without the runtime's session manager, model registry, and so on;
 * - the prompt options stay in the runtime's *normalised* form — `sections`, `cwd` and
 *   `skills` are required — so a router-facing fixture cannot silently omit a collection
 *   the normaliser guarantees. `rules-injector/index.ts` declares a narrower view of
 *   event; structural compatibility still holds because extra required fields on the
 *   fixture side are assignable to that view.
 */
declare module "@earendil-works/pi-coding-agent" {
	export type InputSource = "interactive" | "rpc" | "extension";

	export interface ImageContent {
		type: "image";
		data: string;
		mimeType?: string;
	}

	export interface TextContent {
		type: "text";
		text: string;
	}

	export interface InputEvent {
		type: "input";
		text: string;
		images?: ImageContent[];
		source: InputSource;
		streamingBehavior?: "steer" | "followUp";
	}

	export type InputEventResult =
		| { action: "continue" }
		| { action: "transform"; text: string; images?: ImageContent[] }
		| { action: "handled" };

	/**
	 * A loaded skill, as the runtime hands it to `before_agent_start` handlers.
	 * `disableModelInvocation` mirrors the SDK: a skill with `disable-model-invocation: true`
	 * is withheld from `<available_skills>` and can only be invoked explicitly.
	 */
	export interface Skill {
		name: string;
		filePath: string;
		disableModelInvocation: boolean;
	}

	/**
	 * The mutable prompt sections a `before_agent_start` handler receives. The SDK's
	 * options also carry tool and context-file inputs; the named-section seam and the
	 * loaded-skills list are mirrored here because they are what the injectors read.
	 *
	 * Runtime rules a section must respect:
	 * - a key matches `/^[a-z][a-z0-9_-]*$/` and is not `preamble`, which is reserved for
	 *   the untagged prompt prefix;
	 * - the runtime renders the body as `<key>…</key>`, so a body must not repeat its own
	 *   outer wrapper, and an empty body is dropped.
	 */
	export interface SystemPromptOptions {
		/** Additional XML-wrapped prompt sections keyed by tag name. */
		sections: Record<string, string>;
		/** Working directory. */
		cwd: string;
		/** Pre-loaded skills for this cwd; always present after normalisation. */
		skills: Skill[];
	}

	export interface BeforeAgentStartEvent {
		type: "before_agent_start";
		/** Current prompt text, rendered from the sections and earlier handlers' changes. */
		readonly systemPrompt: string;
		systemPromptOptions: SystemPromptOptions;
	}

	/**
	 * The prompt-start payload a handler receives for a user-started run. The runtime's
	 * event is a union: a user run carries `prompt`, while an idle custom-message run
	 * carries `message` instead. Handlers in this directory read only the sections, and
	 * `rules-injector/index.ts` declares `prompt` as required, so that variant is mirrored
	 */
	export interface UserPromptStartEvent extends BeforeAgentStartEvent {
		readonly prompt: string;
	}
	export interface BeforeAgentStartEventResult {
		message?: unknown;
		/** Replace the complete prompt for this turn; the runtime then renders no sections. */
		systemPrompt?: string;
	}

	export interface SessionStartEvent {
		type: "session_start";
		/** Why this session start happened. */
		reason: "startup" | "reload" | "new" | "resume" | "fork";
	}

	export interface ToolResultEvent {
		type: "tool_result";
		toolName: string;
		input: Record<string, unknown>;
		details?: unknown;
		content: TextContent[];
		isError: boolean;
	}

	export interface SessionCompactEvent {
		type: "session_compact";
		/** What triggered the compaction: manual, the context threshold, or overflow recovery. */
		reason: "manual" | "threshold" | "overflow";
	}

	export interface ExtensionUI {
		notify(message: string, type?: "info" | "warning" | "error"): void;
	}

	export interface ExtensionContext {
		/** Current working directory. */
		readonly cwd: string;
		readonly ui: ExtensionUI;
	}

	export interface ExtensionCommandContext {
		readonly cwd: string;
		readonly ui: ExtensionUI;
	}

	export interface ExtensionCommandOptions {
		readonly description?: string;
		readonly handler: (
			args: string,
			ctx: ExtensionCommandContext,
		) => Promise<void> | void;
	}

	/** A hidden (`display: false`) or visible custom message the runtime appends to the session. */
	export interface CustomMessageDraft {
		customType: string;
		content: string | (TextContent | ImageContent)[];
		display: boolean;
	}

	export interface SendMessageOptions {
		/** Start an agent turn for this message; default false while the agent is streaming. */
		triggerTurn?: boolean;
		deliverAs?: "steer" | "followUp" | "nextTurn";
	}

	export interface ExtensionAPI {
		on(
			event: "session_start",
			handler: (event: SessionStartEvent, ctx: ExtensionContext) => unknown,
		): void;
		on(
			event: "tool_result",
			handler: (event: ToolResultEvent, ctx: ExtensionContext) => unknown,
		): void;
		on(
			event: "before_agent_start",
			handler: (event: UserPromptStartEvent, ctx: ExtensionContext) => void | Promise<void>,
		): void;
		on(
			event: "session_compact",
			handler: (event: SessionCompactEvent, ctx: ExtensionContext) => unknown,
		): void;
		on(
			name: "input",
			handler: (
				event: InputEvent,
				ctx: ExtensionContext,
			) => Promise<InputEventResult> | InputEventResult,
		): void;
		registerCommand(name: string, options: ExtensionCommandOptions): void;
		appendEntry<T = unknown>(customType: string, data?: T): void;
		sendMessage(message: CustomMessageDraft, options?: SendMessageOptions): void;
	}
}
