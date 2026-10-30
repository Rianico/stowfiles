/**
 * Probe for the named-section seam exposed by the SDK stub. No injector is loaded: the
 * test pins the shape a `before_agent_start` handler compiles against — sections carried
 * on `systemPromptOptions`, contributed bodies stored bare, and a return value that may be
 * nothing or a replacement prompt.
 */
import { describe, expect, it } from "vitest";
import type {
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult,
} from "@earendil-works/pi-coding-agent";

/** The runtime's section-name rule; the stub documents it, this pin keeps them aligned. */
const SECTION_NAME = /^[a-z][a-z0-9_-]*$/;

function startEvent(): BeforeAgentStartEvent {
	return {
		type: "before_agent_start",
		systemPrompt: "preamble",
		systemPromptOptions: { cwd: "/tmp/probe", sections: {}, skills: [] },
	};
}

describe("named-section seam", () => {
	it("types a handler that contributes a section and returns nothing or a replacement prompt", () => {
		const event = startEvent();

		const contribute = (e: BeforeAgentStartEvent): BeforeAgentStartEventResult | undefined => {
			e.systemPromptOptions.sections["probe-section"] = "- sample body";
			return undefined;
		};

		expect(contribute(event)).toBeUndefined();

		const sections = event.systemPromptOptions.sections;
		expect(Object.keys(sections)).toEqual(["probe-section"]);
		for (const name of Object.keys(sections)) {
			expect(SECTION_NAME.test(name)).toBe(true);
			expect(name).not.toBe("preamble");
			expect(sections[name]?.startsWith(`<${name}>`)).toBe(false);
		}

		const replace = (e: BeforeAgentStartEvent): BeforeAgentStartEventResult => ({
			systemPrompt: `${e.systemPrompt}\nreplacement`,
		});
		expect(replace(event).systemPrompt).toBe("preamble\nreplacement");
	});
});
