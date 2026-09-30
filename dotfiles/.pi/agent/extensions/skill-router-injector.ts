/**
 * Skill Router Injector — Pi extension (native skills projection)
 *
 * Exposes subskills as entries of pi's native `<available_skills>` section, derived
 * from the filesystem (`dirname(SKILL.md)/subskills/<leaf>/SKILL.md`) and each leaf's
 * own `description` frontmatter — not the parent `argument-hint`.
 *
 * Why: parent `argument-hint` is a lossy summary; leaf descriptions are the routing
 * signal, and the directory is the authoritative set. Pushing native-shaped entries
 * keeps pi's own escaping and per-section prompt diffing, so an unchanged forest
 * costs nothing on the wire.
 *
 * Visibility: there is deliberately NO transcript entry here. The projected entries are
 * rendered by pi into the system prompt, which the export's System-Prompt block shows
 * verbatim — a snapshot message would only duplicate that text somewhere the TUI and the
 * default-collapsed export do not show (see the `display`/`showHiddenMessages` trade).
 * Leaves keep their bodies on demand: only the leaf `location` is published.
 *
 * Invariants:
 * - Frontmatter comes from pi's own `parseFrontmatter` (BOM/CRLF normalized, real YAML),
 *   so this extension cannot disagree with pi about what a leaf says.
 * - A leaf is projected only when it has a usable description and a pi-legal name; the rest
 *   are reported on stderr (there is no transcript channel to report them in).
 * - `Skill` is built field-by-field rather than spread from the parent, so a field pi adds
 *   later fails the typecheck instead of being inherited silently.
 * - Leaf names are `parent/leaf` — deliberately outside pi's `^[a-z0-9-]+$` skill-name spec,
 *   because these entries are render-only and are never resolved by name lookup.
 * - Parenthood is discovered from the live `<available_skills>` entries, so this rebuilds
 *   itself every turn; the name guard covers pi reusing the same options inside a run.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseFrontmatter, type ExtensionAPI, type Skill } from "@earendil-works/pi-coding-agent";

/** pi's own name rule for skills (`core/skills.js` `validateName`). */
const LEAF_NAME_RE = /^[a-z0-9-]+$/;
const LEAF_NAME_MAX = 64;

type SkipReason = "no-description" | "invalid-name";

interface Leaf {
  /** `parent/leaf` — the invocable name. */
  name: string;
  /** Leaf frontmatter description; empty when `skipped` is set. */
  summary: string;
  filePath: string;
  /** Present when the leaf is deliberately kept out of `<available_skills>`. */
  skipped?: SkipReason;
}

interface Router {
  parent: Skill;
  leaves: Leaf[];
}

interface LeafCacheEntry {
  mtimeMs: number;
  size: number;
  summary: string | null;
}

/**
 * Per-turn rescan must stay cheap: `before_agent_start` runs on every message, so leaf
 * descriptions are memoized until the file's size or mtime changes.
 */
const leafCache = new Map<string, LeafCacheEntry>();

function readLeafSummary(filePath: string): string | null {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return null; // missing or unreadable SKILL.md
  }

  const cached = leafCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.summary;
  }

  let summary: string | null = null;
  try {
    const { frontmatter } = parseFrontmatter(fs.readFileSync(filePath, "utf8"));
    const description = frontmatter["description"];
    if (typeof description === "string" && description.trim() !== "") {
      summary = description.trim();
    }
  } catch {
    summary = null;
  }

  leafCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, summary });
  return summary;
}

/** Router = a loaded skill that owns a `subskills/` directory. */
function collectRouters(loaded: Skill[]): Router[] {
  const routers: Router[] = [];

  for (const skill of loaded) {
    const subskillsDir = path.join(path.dirname(skill.filePath), "subskills");
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(subskillsDir, { withFileTypes: true });
    } catch {
      continue; // not a router
    }

    const leaves: Leaf[] = [];
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;

      const leafPath = path.join(subskillsDir, ent.name, "SKILL.md");
      const name = `${skill.name}/${ent.name}`;
      const validName = LEAF_NAME_RE.test(ent.name) && ent.name.length <= LEAF_NAME_MAX;
      const summary = readLeafSummary(leafPath);

      let skipped: SkipReason | undefined;
      if (!validName) skipped = "invalid-name";
      else if (summary === null) skipped = "no-description";

      if (skipped !== undefined) console.error(`[skill-router] skipping ${leafPath} (${skipped})`);

      const leaf: Leaf = { name, summary: summary ?? "", filePath: leafPath };
      if (skipped !== undefined) leaf.skipped = skipped;
      leaves.push(leaf);
    }

    if (leaves.length === 0) continue;
    leaves.sort((a, b) => a.name.localeCompare(b.name));
    routers.push({ parent: skill, leaves });
  }

  routers.sort((a, b) => a.parent.name.localeCompare(b.parent.name));
  return routers;
}

/**
 * Native-shaped leaf entry. `disableModelInvocation` is forced false: routers carry it
 * (subskills are discovery-hidden), and inheriting it would make pi filter the leaf back out.
 */
function leafSkill(parent: Skill, leaf: Leaf): Skill {
  const baseDir = path.dirname(leaf.filePath);
  return {
    name: leaf.name,
    description: leaf.summary,
    filePath: leaf.filePath,
    baseDir,
    sourceInfo: { ...parent.sourceInfo, path: leaf.filePath, baseDir },
    disableModelInvocation: false,
  };
}

export default function skillRouterInjector(pi: ExtensionAPI) {
  pi.on("before_agent_start", (event) => {
    const skills = event.systemPromptOptions.skills;

    // Project usable leaves onto the native skills list. pi may reuse the same options
    // inside a run, so the push stays idempotent by name.
    const known = new Set(skills.map((s) => s.name));
    for (const { parent, leaves } of collectRouters(skills)) {
      for (const leaf of leaves) {
        if (leaf.skipped !== undefined || known.has(leaf.name)) continue;
        skills.push(leafSkill(parent, leaf));
        known.add(leaf.name);
      }
    }
  });
}
