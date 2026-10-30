/**
 * Contract tests for the `skill-router` section: the ledger is derived from the directory
 * layout on disk, never from `argument-hint`/`metadata.manage` text, and it composes with
 * the other extensions' sections into one prompt with no replacement prompt.
 *
 * The fixture tree is built at runtime under the OS temp dir and removed afterwards: the
 * repository ignores `.pi/`, so a checked-in fixture would silently not ship.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { BeforeAgentStartEvent, ExtensionAPI, Skill } from "@earendil-works/pi-coding-agent";
import envInjector from "../env-injector.ts";
import skillRouterInjector from "../skill-router-injector.ts";

type StartHandler = (event: BeforeAgentStartEvent) => unknown;

let fixtureRoot: string;
let skills: Skill[];
let symlinkSkills: Skill[];
let visibilitySkills: Skill[];
let warn: ReturnType<typeof vi.spyOn>;

function skillFile(parts: string[]): string {
	return path.join(fixtureRoot, ...parts, "SKILL.md");
}

function writeSkill(parts: string[], frontmatter: string): string {
	const file = skillFile(parts);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, `---\n${frontmatter}\n---\n\n# ${parts[parts.length - 1]}\n`);
	return file;
}

function writeFile(parts: string[], content: string): string {
	const file = path.join(fixtureRoot, ...parts);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content);
	return file;
}

/**
 * Fixture layout:
 * - alpha-router: four leaves written out of alphabetical order, every block-scalar form,
 *   a hint and manage list that name a leaf existing nowhere (phantom-leaf).
 * - bravo-router: childless — an empty dir, a child dir without SKILL.md, a stray file.
 * - charlie-router: manage marker, no argument-hint; delta-leaf is managed, omega-leaf is
 *   on disk only.
 * - delta-router: a leaf with no description.
 * - echo-router: a malformed leaf beside a healthy one.
 * - foxtrot/golf/hotel-router: extra routers beyond the old cap (all of them must render).
 * - india-skill: a plain skill, not a router.
 */
function buildFixture(): Skill[] {
	writeSkill(["alpha-router"], [
		"name: alpha-router",
		"description: Router with several leaves.",
		"argument-hint: |-",
		"  phantom-leaf -- exists only in the hint",
		"metadata:",
		"  manage: [phantom-leaf, ghost-leaf]",
	].join("\n"));
	writeSkill(["alpha-router", "subskills", "zeta-leaf"], "name: zeta-leaf\ndescription: Inline description: one line.");
	writeSkill(["alpha-router", "subskills", "beta-leaf"], 'name: beta-leaf\ndescription: "Quoted description: with colon."');
	writeSkill(["alpha-router", "subskills", "gamma-leaf"], "name: gamma-leaf\ndescription: |\n  Literal block line one\n  literal block line two");
	writeSkill(["alpha-router", "subskills", "epsilon-leaf"], "name: epsilon-leaf\ndescription: >\n  Folded block line one\n  folded block line two");
	fs.mkdirSync(path.join(fixtureRoot, "alpha-router", "subskills", "empty-dir"), { recursive: true });
	fs.mkdirSync(path.join(fixtureRoot, "alpha-router", "subskills", "no-skill-dir"), { recursive: true });
	writeFile(["alpha-router", "subskills", "loose-notes.md"], "not a skill\n");

	writeSkill(["bravo-router"], "name: bravo-router\ndescription: Childless.\nmetadata:\n  manage: [stray]");
	fs.mkdirSync(path.join(fixtureRoot, "bravo-router", "subskills", "child-without-skill"), { recursive: true });
	fs.mkdirSync(path.join(fixtureRoot, "bravo-router", "subskills", "empty"), { recursive: true });
	writeFile(["bravo-router", "subskills", "stray.md"], "stray\n");

	writeSkill(["charlie-router"], "name: charlie-router\ndescription: Manage marker only.\nmetadata:\n  manage: [delta-leaf]");
	writeSkill(["charlie-router", "subskills", "delta-leaf"], "name: delta-leaf\ndescription: |-\n  Kept literal block\n  two lines");
	writeSkill(["charlie-router", "subskills", "omega-leaf"], "name: omega-leaf\ndescription: >-\n  Kept folded block\n  two lines");

	writeSkill(["delta-router"], "name: delta-router\ndescription: Leaf without a description.");
	writeSkill(["delta-router", "subskills", "sigma-leaf"], "name: sigma-leaf");

	writeSkill(["echo-router"], "name: echo-router\ndescription: Malformed leaf.");
	writeSkill(["echo-router", "subskills", "kappa-leaf"], "name: kappa-leaf\ndescription: Healthy leaf beside a malformed one.");
	writeFile(["echo-router", "subskills", "rho-leaf", "SKILL.md"], "---\nname: rho-leaf\ndescription: [unterminated\n");

	for (const name of ["foxtrot-router", "golf-router", "hotel-router"]) {
		writeSkill([name], `name: ${name}\ndescription: Cap filler router.`);
		writeSkill([name, "subskills", `${name.split("-")[0]}-leaf`], `name: ${name}-leaf\ndescription: Leaf of ${name}.`);
	}

	writeSkill(["india-skill"], "name: india-skill\ndescription: A plain skill, not a router.");

	return [
		"alpha-router",
		"bravo-router",
		"charlie-router",
		"delta-router",
		"echo-router",
		"foxtrot-router",
		"golf-router",
		"hotel-router",
		"india-skill",
	].map((name) => ({
		name,
		filePath: skillFile([name]),
		disableModelInvocation: false,
	}));
}

/**
 * Symlink fixture: a leaf linked to a directory inside the temp tree, a real leaf dir whose
 * `SKILL.md` is a symlink to a file, and a dangling link that must warn instead of vanish.
 */
function buildSymlinkFixture(): Skill[] {
	writeSkill(["sierra-target", "leaf-alpha"], "name: leaf-alpha\ndescription: Symlinked leaf description.");
	writeFile(["sierra-target", "shared-skill.md"], "---\nname: shared\ndescription: Symlinked SKILL.md description.\n---\n");
	writeSkill(["sierra-router"], "name: sierra-router\ndescription: Router with symlinked leaves.");

	const subskills = path.join(fixtureRoot, "sierra-router", "subskills");
	fs.mkdirSync(subskills, { recursive: true });
	fs.symlinkSync(path.join("..", "..", "sierra-target", "leaf-alpha"), path.join(subskills, "linked-leaf"), "dir");

	const fileLinkDir = path.join(subskills, "file-link-leaf");
	fs.mkdirSync(fileLinkDir, { recursive: true });
	fs.symlinkSync(path.join("..", "..", "..", "sierra-target", "shared-skill.md"), path.join(fileLinkDir, "SKILL.md"), "file");

	fs.symlinkSync(path.join("..", "missing-target"), path.join(subskills, "broken-leaf"), "dir");

	return [
		{ name: "sierra-router", filePath: skillFile(["sierra-router"]), disableModelInvocation: false },
	];
}

function startEvent(loadedSkills: Skill[]): BeforeAgentStartEvent {
	return {
		type: "before_agent_start",
		systemPrompt: "preamble",
		systemPromptOptions: { cwd: process.cwd(), sections: {}, skills: loadedSkills },
	};
}

/**
 * Visibility fixture: one visible and one hidden parent with the same shape. The runtime
 * sets `disableModelInvocation` from the parent's `disable-model-invocation:` frontmatter;
 * the hidden parent's leaves still exist on disk, so the subtree is what the filter
 * must suppress without reading any leaf frontmatter.
 */
function buildVisibilityFixture(): Skill[] {
	writeSkill(["visible-router"], "name: visible-router\ndescription: Visible parent.");
	writeSkill(["visible-router", "subskills", "visible-leaf"], "name: visible-leaf\ndescription: Visible leaf.");
	writeSkill(["hidden-router"], "name: hidden-router\ndescription: Hidden parent.\ndisable-model-invocation: true");
	writeSkill(["hidden-router", "subskills", "hidden-leaf"], "name: hidden-leaf\ndescription: Hidden leaf.");

	return [
		{ name: "hidden-router", filePath: skillFile(["hidden-router"]), disableModelInvocation: true },
		{ name: "visible-router", filePath: skillFile(["visible-router"]), disableModelInvocation: false },
	];
}

/** Register one extension against a stub API and hand back its `before_agent_start` hook. */
function loadStartHook(extension: (pi: ExtensionAPI) => void): StartHandler {
	const handlers = new Map<string, StartHandler>();
	extension({
		on: (name: string, handler: StartHandler) => {
			handlers.set(name, handler);
		},
	} as unknown as ExtensionAPI);
	const handler = handlers.get("before_agent_start");
	if (handler === undefined) throw new Error("before_agent_start hook was not registered");
	return handler;
}

/** Run the router handler and return the section body it wrote. */
function routerBodyOf(event: BeforeAgentStartEvent): string {
	return event.systemPromptOptions.sections["skill-router"] ?? "";
}

async function renderRouterSection(loadedSkills: Skill[]): Promise<string> {
	const event = startEvent(loadedSkills);
	await loadStartHook(skillRouterInjector)(event);
	return routerBodyOf(event);
}


beforeEach(() => {
	fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skill-router-fixture-"));
	skills = buildFixture();
	symlinkSkills = buildSymlinkFixture();
	visibilitySkills = buildVisibilityFixture();
	warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("Ledger derived from disk", () => {
	it("lists every on-disk leaf and nothing that only exists in hint text", async () => {
		const body = await renderRouterSection(skills);

		for (const leaf of [
			"zeta-leaf",
			"beta-leaf",
			"gamma-leaf",
			"epsilon-leaf",
			"delta-leaf",
			"omega-leaf",
			"sigma-leaf",
			"kappa-leaf",
			"rho-leaf",
			"foxtrot-leaf",
		]) {
			expect(body).toContain(leaf);
		}
		// Phantom names live only in alpha-router's hint/manage frontmatter.
		for (const phantom of ["phantom-leaf", "ghost-leaf", "stray"]) {
			expect(body).not.toContain(phantom);
		}
	});

	it("excludes non-routers, childless routers, and subskills without their own SKILL.md", async () => {
		const body = await renderRouterSection(skills);

		for (const absent of ["bravo-router", "india-skill", "no-skill-dir", "child-without-skill", "empty-dir", "loose-notes"]) {
			expect(body).not.toContain(absent);
		}
	});

	it("folds every description form to one ledger line", async () => {
		const body = await renderRouterSection(skills);

		expect(body).toContain("- `zeta-leaf -- Inline description: one line.`");
		expect(body).toContain('- `beta-leaf -- Quoted description: with colon.`');
		expect(body).toContain("- `gamma-leaf -- Literal block line one literal block line two`");
		expect(body).toContain("- `epsilon-leaf -- Folded block line one folded block line two`");
		expect(body).toContain("- `delta-leaf -- Kept literal block two lines`");
		expect(body).toContain("- `omega-leaf -- Kept folded block two lines`");
	});

	it("lists leaves whose description cannot be read by name and warns", async () => {
		const body = await renderRouterSection(skills);

		expect(body).toContain("- `sigma-leaf`");
		expect(body).toContain("- `rho-leaf`");
		expect(body).not.toContain("- `sigma-leaf --");
		expect(body).not.toContain("- `rho-leaf --");
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it("sorts routers by skill name and leaves by directory name", async () => {
		const body = await renderRouterSection(skills);

		const routerOrder = ["alpha-router", "charlie-router", "delta-router", "echo-router", "foxtrot-router"]
			.map((name) => body.indexOf(`--- ${skillFile([name])} ---`));
		expect(routerOrder).toEqual([...routerOrder].sort((a, b) => a - b));
		expect(routerOrder[0]).toBeGreaterThanOrEqual(0);

		const leafOrder = ["beta-leaf", "epsilon-leaf", "gamma-leaf", "zeta-leaf"]
			.map((leaf) => body.indexOf(`- \`${leaf}`));
		expect(leafOrder).toEqual([...leafOrder].sort((a, b) => a - b));
	});

	it("renders every router with no truncation note, and is byte-identical across runs", async () => {
		const body = await renderRouterSection(skills);
		const again = await renderRouterSection(skills);

		expect(again).toBe(body);
		expect(body.match(/^--- .+ ---$/gm)).toHaveLength(7);
		expect(body).not.toContain("more routers hidden");

		for (const router of ["foxtrot-router", "golf-router", "hotel-router"]) {
			expect(body).toContain(`--- ${skillFile([router])} ---`);
		}
		expect(body).toContain("- `golf-leaf -- Leaf of golf-router.`");
		expect(body).toContain("- `hotel-leaf -- Leaf of hotel-router.`");
	});

	it("derives the layout example from a real leaf of the first sorted router", async () => {
		const body = await renderRouterSection(skills);

		expect(body).toContain("e.g. `alpha-router/subskills/beta-leaf/SKILL.md`");
		expect(body).not.toContain("phantom-leaf");
		expect(body).not.toContain("<skill-router>");
	});
});

describe("Section isolation beside another injector", () => {
	it("isolates a malformed leaf: healthy leaves stay listed and other sections stay intact", async () => {
		const envStart = loadStartHook(envInjector);
		const routerStart = loadStartHook(skillRouterInjector);
		const event = startEvent(skills);

		await envStart(event);
		expect(await routerStart(event)).toBeUndefined();

		const body = routerBodyOf(event);
		expect(body).toContain("- `kappa-leaf -- Healthy leaf beside a malformed one.`");
		expect(body).toContain("- `rho-leaf`");
		expect(event.systemPromptOptions.sections["env"]).toContain("<os_type>");
		expect(warn).toHaveBeenCalled();
	});
});

describe("Hidden routers", () => {
	it("omits a hidden parent and every one of its leaves", async () => {
		const body = await renderRouterSection(visibilitySkills);

		expect(body).not.toContain("hidden-router");
		expect(body).not.toContain("hidden-leaf");
		expect(warn).not.toHaveBeenCalled();
	});

	it("still renders a visible parent with the same shape", async () => {
		const body = await renderRouterSection(visibilitySkills);

		expect(body).toContain(`--- ${skillFile(["visible-router"])} ---`);
		expect(body).toContain("- `visible-leaf -- Visible leaf.`");
	});
});

describe("Symlinked leaves", () => {
	it("lists a leaf that is a symlink to a directory and a leaf whose SKILL.md is a symlink", async () => {
		const body = await renderRouterSection(symlinkSkills);

		expect(body).toContain(`--- ${skillFile(["sierra-router"])} ---`);
		expect(body).toContain("- `linked-leaf -- Symlinked leaf description.`");
		expect(body).toContain("- `file-link-leaf -- Symlinked SKILL.md description.`");
	});

	it("skips an unresolvable child with a warning instead of dropping it silently", async () => {
		const body = await renderRouterSection(symlinkSkills);

		expect(body).not.toContain("broken-leaf");
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("cannot resolve"));
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("broken-leaf"));
	});
});
