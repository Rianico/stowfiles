/**
 * Skill Router Injector — Pi extension
 *
 * Publishes the `skill-router` system-prompt section: one bullet per subskill that exists
 * on disk next to a loaded router skill.
 *
 * Why: a hand-maintained `argument-hint` ledger drifted from disk — it omitted subskills
 * that were added, and listed names that existed nowhere. Deriving the ledger from the
 * directory layout makes drift impossible; one router costs one description instead of N
 * flat skill descriptions.
 *
 * - Selection: a loaded skill is a router when its adjacent `subskills/` directory holds
 *   at least one child directory with its own `SKILL.md`. `metadata.manage` and
 *   `argument-hint` are neither selection nor content inputs.
 * - Content: label = child directory name, description = that leaf's own `description`
 *   frontmatter folded to one line. A leaf whose description cannot be read is still
 *   listed by name, with a console warning — never dropped.
 * - Ordering: routers by skill name, leaves by directory name — byte-stable across runs,
 *   so the prompt prefix stays cache-stable.
 * - Fail-soft: assembly never throws out of the handler; a failure degrades to an empty
 *   section, leaving other extensions' sections intact.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, Skill } from "@earendil-works/pi-coding-agent";

const ROUTER_SECTION_NAME = "skill-router";
const SUB_SKILL_FILE = "SKILL.md";

interface LeafEntry {
  name: string;
  description?: string;
}

interface RouterEntry {
  name: string;
  filePath: string;
  leaves: LeafEntry[];
}

/** Frontmatter block without its `---` fences; undefined for a malformed file. */
function frontmatterOf(raw: string): string | undefined {
  return raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
}

/** Strip one layer of matching quotes from an inline YAML scalar. */
function unquote(value: string): string {
  const quoted = value.match(/^(["'])([\s\S]*)\1$/);
  return quoted ? quoted[2] : value;
}

/** YAML scalar forms all collapse to one ledger line. */
function fold(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** `description` from frontmatter, folded to one line; undefined when absent or unreadable. */
function parseDescription(frontmatter: string): string | undefined {
  const lines = frontmatter.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) => /^description\s*:/.test(line));
  if (keyIndex === -1) return undefined;

  const keyLine = lines[keyIndex];
  const inline = keyLine.slice(keyLine.indexOf(":") + 1).trim();

  // Block scalar: `|`, `|-`, `>`, `>-` — collect indented lines, fold, stop at the next key.
  if (/^[|>][+-]?$/.test(inline)) {
    const body: string[] = [];
    for (const line of lines.slice(keyIndex + 1)) {
      if (line.trim() !== "" && !/^\s/.test(line)) break;
      body.push(line);
    }
    const folded = fold(body.join(" "));
    return folded || undefined;
  }

  const value = fold(unquote(inline));
  return value || undefined;
}

/** The leaf's own description; a read failure or malformed file yields undefined, not a throw. */
function readLeafDescription(skillFilePath: string): string | undefined {
  let raw: string;
  try {
    raw = fs.readFileSync(skillFilePath, "utf8");
  } catch {
    return undefined;
  }
  const frontmatter = frontmatterOf(raw);
  return frontmatter === undefined ? undefined : parseDescription(frontmatter);
}

function hasSkillFile(dir: string): boolean {
  try {
    return fs.statSync(path.join(dir, SUB_SKILL_FILE)).isFile();
  } catch {
    return false;
  }
}

/**
 * Immediate child directories holding their own `SKILL.md`, sorted by name. Symlinks are
 * resolved: a linked leaf directory counts, and so does a linked `SKILL.md` file. A child
 * whose path cannot be resolved is skipped with a warning rather than vanishing silently.
 */
function listLeafNames(subskillsDir: string, warn: (message: string) => void): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(subskillsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const names: string[] = [];
  for (const entry of entries) {
    const childPath = path.join(subskillsDir, entry.name);
    let isDirectory: boolean;
    try {
      // `statSync` follows symlinks: a Dirent's `isDirectory()` is false for a link to a dir.
      isDirectory = fs.statSync(childPath).isDirectory();
    } catch (error) {
      warn(`skill-router: cannot resolve ${childPath}; skipping it (${error instanceof Error ? error.message : String(error)})`);
      continue;
    }
    if (isDirectory && hasSkillFile(childPath)) names.push(entry.name);
  }
  return names.sort((a, b) => a.localeCompare(b));
}

function collectRouters(skills: readonly Skill[], warn: (message: string) => void): RouterEntry[] {
  const routers: RouterEntry[] = [];
  for (const skill of skills) {
    // A hidden skill is deliberately withheld from the model; its subskills go with it.
    // Subskill files carry no flag of their own, so the parent governs the whole subtree.
    if (skill.disableModelInvocation) continue;
    const subskillsDir = path.join(path.dirname(skill.filePath), "subskills");
    const leafNames = listLeafNames(subskillsDir, warn);
    if (leafNames.length === 0) continue;

    const leaves = leafNames.map((name): LeafEntry => {
      const leafPath = path.join(subskillsDir, name, SUB_SKILL_FILE);
      const description = readLeafDescription(leafPath);
      if (description === undefined) {
        warn(`skill-router: cannot read description for ${leafPath}; listing "${name}" by name`);
      }
      return { name, description };
    });
    routers.push({ name: skill.name, filePath: skill.filePath, leaves });
  }
  routers.sort((a, b) => a.name.localeCompare(b.name));
  return routers;
}

/** The `skill-router` section body — no outer fence; the runtime adds `<skill-router>`. */
function buildRouterSection(skills: readonly Skill[], warn: (message: string) => void): string {
  try {
    const routers = collectRouters(skills, warn);
    if (routers.length === 0) return "";
    const [firstRouter] = routers;
    const [firstLeaf] = firstRouter?.leaves ?? [];
    if (firstRouter === undefined || firstLeaf === undefined) return "";

    // Layout example comes from a real leaf of the first sorted router, never from a hint.
    const example = `${firstRouter.name}/subskills/${firstLeaf.name}/${SUB_SKILL_FILE}`;
    const blocks = routers.map(({ filePath, leaves }) => {
      const bullets = leaves.map(({ name, description }) => (description === undefined
        ? `- \`${name}\``
        : `- \`${name} -- ${description}\``));
      return `--- ${filePath} ---\n\n${bullets.join("\n")}`;
    });
    return `# Skill Router

Subskills live under \`<parent>/subskills/<sub_skill>/SKILL.md\` (e.g. \`${example}\`, resolved as \`dirname(parent SKILL.md)/subskills/<sub_skill>/SKILL.md\`).

${blocks.join("\n\n")}

Use sub_skill verbatim; prefer sub_skill over description verbs. Call them like general skills.`;
  } catch {
    return "";
  }
}

export default function skillRouterInjector(pi: ExtensionAPI) {
  pi.on("before_agent_start", (event) => {
    // One owner, one section: re-assignment keeps repeat runs byte-identical, and no
    // handler can erase another extension's block.
    event.systemPromptOptions.sections[ROUTER_SECTION_NAME] = buildRouterSection(
      event.systemPromptOptions.skills ?? [],
      (message) => console.warn(message),
    );
    return undefined;
  });
}
