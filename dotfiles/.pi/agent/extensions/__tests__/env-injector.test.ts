import { describe, expect, it } from "vitest";
import type {
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult,
	ExtensionAPI,
	InputEvent,
	InputEventResult,
} from "@earendil-works/pi-coding-agent";
import envInjector, {
	buildStaticBlock,
	detectOsType,
	detectShell,
	formatMessageTimePrefix,
	hasMessageTimePrefix,
	needsTimestamp,
	prependTimestamp,
} from "../env-injector.ts";

const NOW = new Date("2026-10-21T16:30:00.000Z");

type Handler = (event: InputEvent) => Promise<InputEventResult>;

/** Register the extension against a stub API and hand back its `input` hook. */
function loadInputHook(): Handler {
	const handlers = new Map<string, Handler>();
	envInjector({
		on: (name: string, handler: Handler) => {
			handlers.set(name, handler);
		},
	} as unknown as ExtensionAPI);
	const handler = handlers.get("input");
	if (handler === undefined) throw new Error("input hook was not registered");
	return handler;
}

type BeforeAgentStartHandler = (
	event: BeforeAgentStartEvent,
) =>
	| Promise<BeforeAgentStartEventResult | undefined>
	| BeforeAgentStartEventResult
	| undefined;

/** Register the extension against a stub API and hand back its `before_agent_start` hook. */
function loadBeforeAgentStartHook(): BeforeAgentStartHandler {
	const handlers = new Map<string, BeforeAgentStartHandler>();
	envInjector({
		on: (name: string, handler: BeforeAgentStartHandler) => {
			handlers.set(name, handler);
		},
	} as unknown as ExtensionAPI);
	const handler = handlers.get("before_agent_start");
	if (handler === undefined) throw new Error("before_agent_start hook was not registered");
	return handler;
}

/** A runtime-shaped prompt state with no sections yet. */
function startEvent(): BeforeAgentStartEvent {
	return {
		type: "before_agent_start",
		systemPrompt: "preamble",
		systemPromptOptions: { cwd: process.cwd(), sections: {}, skills: [] },
	};
}

describe("Message Time Prefix", () => {
	it("writes the instant as a bracketed UTC ISO stamp", () => {
		expect(formatMessageTimePrefix(NOW)).toBe("[2026-10-21T16:30:00.000Z]");
		expect(prependTimestamp("fix the rail", NOW)).toBe("[2026-10-21T16:30:00.000Z]\nfix the rail");
	});

	it("recognises every prefix it writes (writer and recogniser cannot drift)", () => {
		for (const iso of [
			"2026-10-21T16:30:00.000Z",
			"2026-01-01T00:00:00.000Z",
			"2026-12-31T23:59:59.999Z",
			"1999-07-04T09:05:06.007Z",
		]) {
			const stamp = formatMessageTimePrefix(new Date(iso));
			expect(hasMessageTimePrefix(stamp)).toBe(true);
			expect(hasMessageTimePrefix(`${stamp}\nbody`)).toBe(true);
			expect(needsTimestamp(`${stamp}\nbody`)).toBe(false);
		}
	});

	it("tolerates leading whitespace (a pasted or quoted prefix)", () => {
		const stamped = "[2026-10-21T16:00:56.341Z]\nbody";
		for (const text of [` ${stamped}`, `\n\t${stamped}`, `  \n  ${stamped}`]) {
			expect(hasMessageTimePrefix(text)).toBe(true);
			expect(needsTimestamp(text)).toBe(false);
		}
	});

	it("accepts a prefix without milliseconds (written by an older build)", () => {
		expect(hasMessageTimePrefix("[2026-10-21T16:00:56Z]\nbody")).toBe(true);
		expect(needsTimestamp("[2026-10-21T16:00:56Z]\nbody")).toBe(false);
	});

	it("stamps text that carries no prefix", () => {
		for (const text of ["hello", "  hello", "[1] footnote", "[BUG-12] ticket", "- bullet"]) {
			expect(hasMessageTimePrefix(text)).toBe(false);
			expect(needsTimestamp(text)).toBe(true);
		}
	});

	it("leaves blank input alone", () => {
		for (const text of ["", " ", "\n\n", "\t"]) {
			expect(needsTimestamp(text)).toBe(false);
		}
	});

	it("recognises the injector's own shape only — other spellings are stamped", () => {
		for (const text of [
			"[2026-10-21 16:00:56] space separator",
			"[2026-10-21T23:00:56+08:00] offset",
			"[2026-10-21T16:00Z] minute precision",
			"[2026-10-21] date only",
			"[15:42] clock only",
		]) {
			expect(hasMessageTimePrefix(text)).toBe(false);
			expect(needsTimestamp(text)).toBe(true);
		}
	});
});

describe("input hook", () => {
	const input = loadInputHook();

	it("returns a stamped message byte-identical — origin time is never restamped", async () => {
		const text = "[2026-10-21T16:00:56.341Z]\n/skill:grill-with-docs hi";
		await expect(input({ type: "input", source: "interactive", text })).resolves.toEqual({
			action: "continue",
		});
	});

	it("stamps a fresh message and passes images through", async () => {
		const images: NonNullable<InputEvent["images"]> = [{ type: "image", data: "x" }];
		const result = await input({ type: "input", source: "interactive", text: "hello", images });
		expect(result.action).toBe("transform");
		if (result.action === "transform") {
			expect(result.text).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\nhello$/);
			expect(result.images).toBe(images);
		}
	});

	it("never stamps extension-authored text", async () => {
		await expect(input({ type: "input", source: "extension", text: "hello" })).resolves.toEqual({
			action: "continue",
		});
	});

	it("never stamps blank text", async () => {
		await expect(input({ type: "input", source: "interactive", text: "   " })).resolves.toEqual({
			action: "continue",
		});
	});
});

describe("env section", () => {
	const beforeAgentStart = loadBeforeAgentStartHook();

	it("contributes an `env` section and returns no replacement prompt", async () => {
		const event = startEvent();

		expect(await beforeAgentStart(event)).toBeUndefined();
		expect(event.systemPrompt).toBe("preamble");

		const names = Object.keys(event.systemPromptOptions.sections);
		expect(names).toEqual(["env"]);
		for (const name of names) {
			expect(name).toMatch(/^[a-z][a-z0-9_-]*$/);
			expect(name).not.toBe("preamble");
		}
	});

	it("carries the machine facts without repeating its own outer fence", async () => {
		const event = startEvent();
		await beforeAgentStart(event);
		const body = event.systemPromptOptions.sections["env"] ?? "";

		expect(body).toContain(`- os_type: ${detectOsType()}`);
		expect(body).toContain(`- shell: ${await detectShell()}`);
		expect(body).not.toContain("<env>");
		expect(body).not.toContain("</env>");
		// Every fact is its own bullet line; nothing rides along on the fence line.
		expect(body.split("\n").every((line) => line.startsWith("- "))).toBe(true);
		// The runtime adds the fence exactly once; the exported builder still emits it.
		expect(buildStaticBlock("macOS (Darwin 24.1.0, arm64)", "zsh 5.9")).toBe(
			"<env>\n- os_type: macOS (Darwin 24.1.0, arm64)\n- shell: zsh 5.9\n</env>",
		);
	});

	it("is idempotent: a second run over the same event is byte-identical", async () => {
		const event = startEvent();
		await beforeAgentStart(event);
		const first = JSON.stringify(event.systemPromptOptions.sections);

		await beforeAgentStart(event);
		expect(JSON.stringify(event.systemPromptOptions.sections)).toBe(first);

		const fresh = startEvent();
		await beforeAgentStart(fresh);
		expect(JSON.stringify(fresh.systemPromptOptions.sections)).toBe(first);
	});
});
