import { vi } from "vitest";

// The SDK's tool-input.ts imports one runtime value from pi's core package
// (everything else is type-only). Stub just that function; the real
// implementation is `event.toolName === toolName`.
vi.mock("@earendil-works/pi-coding-agent", () => ({
	isToolCallEventType: (toolName: string, event: { toolName?: unknown }) =>
		event?.toolName === toolName,
}));
