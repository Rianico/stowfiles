/**
 * Composition contract across the three REAL prompt-block owners: `env-injector`,
 * `skill-router-injector` and the vendored `rules-injector`.
 *
 * One prompt event is shared by all three handlers, exactly as the runtime delivers it:
 * each handler returns no replacement prompt, every body stays unfenced, and the runtime
 * fences each non-empty section once. Rules come from a temporary global/project tree —
 * no test here hand-supplies a section that an injector owns.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Skill } from "@earendil-works/pi-coding-agent";
import envInjector from "../env-injector.ts";
import rulesInjector from "../rules-injector.ts";
import skillRouterInjector from "../skill-router-injector.ts";
import {
	createCompositionHarness,
	renderSections,
} from "./rules/composition-harness.ts";
import { messageText } from "./rules/harness.ts";

const UNSCOPED_TEXT = "Never leak secrets.";
const SCOPED_TEXT = "Use the shared clock.";
const ROUTER_LEAF = "- `beta-leaf -- Leaf used by the composition fixture.`";

let homeRoot: string;
let projectRoot: string;
let fixtureRoot: string;
let skills: Skill[];

function writeFileParts(base: string, parts: string[], content: string): string {
	const file = path.join(base, ...parts);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content, "utf8");
	return file;
}

function writeRule(dir: string, rel: string, body: string): void {
	writeFileParts(dir, [rel], body);
}

/** One real router with one real leaf: the router section derives its ledger from disk. */
function buildSkills(): Skill[] {
	const routerDir = path.join(fixtureRoot, "alpha-router");
	const leafDir = path.join(routerDir, "subskills", "beta-leaf");
	fs.mkdirSync(leafDir, { recursive: true });
	fs.writeFileSync(
		path.join(routerDir, "SKILL.md"),
		"---\nname: alpha-router\ndescription: Router with one leaf.\n---\n\n# alpha-router\n",
		"utf8",
	);
	fs.writeFileSync(
		path.join(leafDir, "SKILL.md"),
		"---\nname: beta-leaf\ndescription: Leaf used by the composition fixture.\n---\n",
		"utf8",
	);
	return [
		{
			name: "alpha-router",
			filePath: path.join(routerDir, "SKILL.md"),
			disableModelInvocation: false,
		},
	];
}

beforeEach(() => {
	homeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "composition-home-"));
	projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "composition-project-"));
	fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "composition-skills-"));
	vi.stubEnv("HOME", homeRoot);

	writeRule(
		path.join(homeRoot, ".pi", "agent", "rules"),
		"house-rules.md",
		`# House rules\n\n${UNSCOPED_TEXT}\n`,
	);
	writeRule(
		path.join(projectRoot, ".pi", "rules"),
		"typescript/ts-rules.md",
		`---\npaths:\n  - src/**/*.ts\n---\n\n# TypeScript rules\n\n${SCOPED_TEXT}\n`,
	);
	skills = buildSkills();
});

afterEach(() => {
	vi.unstubAllEnvs();
	fs.rmSync(homeRoot, { recursive: true, force: true });
	fs.rmSync(projectRoot, { recursive: true, force: true });
	fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

/** Register just the given owners over the same fixture tree. */
function harnessFor(...injectors: ((typeof envInjector) | (typeof rulesInjector) | (typeof skillRouterInjector))[]) {
	return createCompositionHarness(injectors, projectRoot, skills);
}

describe("prompt composition over the real injectors", () => {
	it("publishes exactly one fence per owner with no replacement prompt", async () => {
		const harness = harnessFor(envInjector, skillRouterInjector, rulesInjector);
		await harness.startSession("startup");

		const { results, sections, prompt } = await harness.promptStart();

		expect(results).toEqual([undefined, undefined, undefined]);
		expect(Object.keys(sections)).toEqual(["env", "skill-router", "user-rules"]);

		for (const name of Object.keys(sections)) {
			const body = sections[name] ?? "";
			expect(body).not.toBe("");
			expect(body).not.toContain(`<${name}>`);
			expect(body).not.toContain(`</${name}>`);
		}

		for (const fence of ["env", "skill-router", "user-rules"]) {
			expect(prompt.match(new RegExp(`<${fence}>`, "g"))).toHaveLength(1);
			expect(prompt.match(new RegExp(`</${fence}>`, "g"))).toHaveLength(1);
		}

		expect(prompt).toContain("<os_type>");
		expect(prompt).toContain(ROUTER_LEAF);
		expect(prompt).toContain(UNSCOPED_TEXT);
		expect(prompt).not.toContain(SCOPED_TEXT);
	});

	it("claims runtime-valid, disjoint section names without a shared registry", async () => {
		const envOnly = harnessFor(envInjector);
		const routerOnly = harnessFor(skillRouterInjector);
		const rulesOnly = harnessFor(rulesInjector);
		await rulesOnly.startSession("startup");

		const namesOf = async (
			harness: ReturnType<typeof harnessFor>,
		): Promise<string[]> => Object.keys((await harness.promptStart()).sections);

		expect(await namesOf(envOnly)).toEqual(["env"]);
		expect(await namesOf(routerOnly)).toEqual(["skill-router"]);
		expect(await namesOf(rulesOnly)).toEqual(["user-rules"]);

		const names = [
			...(await namesOf(envOnly)),
			...(await namesOf(routerOnly)),
			...(await namesOf(rulesOnly)),
		];
		expect(new Set(names).size).toBe(names.length);
		for (const name of names) {
			expect(name).toMatch(/^[a-z][a-z0-9_-]*$/);
			expect(name).not.toBe("preamble");
			expect(name).not.toBe("rules");
		}
	});

	it("activates a scoped rule as a hidden steer message and keeps the section unchanged", async () => {
		const harness = harnessFor(envInjector, skillRouterInjector, rulesInjector);
		await harness.startSession("startup");
		const before = (await harness.promptStart()).sections;

		harness.toolResult("read", { path: "src/app.ts" });

		expect(harness.messages).toHaveLength(1);
		const sent = harness.messages[0];
		expect(sent?.draft.display).toBe(false);
		expect(sent?.options?.deliverAs).toBe("steer");
		expect(messageText(sent?.draft.content)).toContain(SCOPED_TEXT);

		const after = (await harness.promptStart()).sections;
		expect(after["user-rules"]).toBe(before["user-rules"]);
		expect(after["user-rules"]).not.toContain(SCOPED_TEXT);
		expect(renderSections(after)).toBe(renderSections(before));
	});
});
