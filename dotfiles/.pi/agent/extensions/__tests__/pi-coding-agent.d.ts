/**
 * Minimal stub for the pi SDK's extension surface.
 *
 * The extensions directory is not an npm package: `env-injector.ts` imports the SDK's
 * types only (`import type`), so typechecking needs just the members this extension
 * touches. Shapes mirror `@earendil-works/pi-coding-agent` 1.3.0
 * (`dist/core/extensions/types.d.ts`) — update them when the SDK moves.
 */
declare module "@earendil-works/pi-coding-agent" {
	export type InputSource = "interactive" | "rpc" | "extension";

	export interface ImageContent {
		type: "image";
		data: string;
		mimeType?: string;
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

	export interface BeforeAgentStartEvent {
		systemPrompt: string;
	}

	export interface BeforeAgentStartEventResult {
		message?: unknown;
		systemPrompt?: string;
	}

	export interface ExtensionAPI {
		on(
			name: "input",
			handler: (event: InputEvent) => Promise<InputEventResult> | InputEventResult,
		): void;
		on(
			name: "before_agent_start",
			handler: (
				event: BeforeAgentStartEvent,
			) =>
				| Promise<BeforeAgentStartEventResult | undefined>
				| BeforeAgentStartEventResult
				| undefined,
		): void;
	}
}
