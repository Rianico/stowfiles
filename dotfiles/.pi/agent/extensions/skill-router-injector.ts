/**
 * Skill Router Injector — Pi extension
 *
 * Injects `argument-hint` for router skills (those with `metadata.manage`) into
 * system prompt, mirroring `claude-rules.ts` pattern.
 *
 * Why: Pi's Skill type strips `arguments`/`argument-hint` (unknown frontmatter),
 * so router's domain ledger (ai-engineering-expert's `skill-authoring | writing | ...`)
 * is invisible despite 300c/8000c budget needing it. Flat N×300c vs router 1×280c.
 *
 * Design (7Q grilled, see ADR 0012):
 * - Filter: `metadata.manage` exists (router marker), not explicit `router:true` flag (duplicate)
 * - Inject: parent `argument-hint` only (leaves stay dark, 0 Metadata Cost)
 * - When: always on `before_agent_start` per loaded router (not conditional on prompt)
 * - Scope: per `systemPromptOptions.skills` for this cwd (not all on disk), fail-soft
 * - Parse: yaml-tolerant manual frontmatter (handles |-, >, >-) without external dep
 */

import * as fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function parseRouterHint(filePath: string): { managed: string[]; hintLines: string[]; rawHint: string } | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;
    const fm = fmMatch[1];

    // Extract metadata.manage — supports `manage: [a, b]` and block list
    let managed: string[] = [];
    const manageInline = fm.match(/^\s*manage:\s*\[(.*?)\]/m);
    if (manageInline) {
      managed = manageInline[1].split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      const manageBlockIdx = fm.search(/^\s*manage:\s*$/m);
      if (manageBlockIdx !== -1) {
        const tail = fm.slice(manageBlockIdx).split("\n").slice(1);
        for (const line of tail) {
          const m = line.match(/^\s*-\s*(.+)/);
          if (m) managed.push(m[1].trim().replace(/^["']|["']$/g, ""));
          else if (line.trim() && !line.startsWith(" ") && !line.startsWith("\t")) break;
        }
      }
    }
    if (managed.length === 0) return null;

    // Extract argument-hint following block scalar |- / | / >- / >
    const hintKeyIdx = fm.search(/^\s*argument-hint:\s*(?:\|-|\||>-|>)?\s*$/m);
    if (hintKeyIdx === -1) return null;
    const hintKeyLine = fm.slice(hintKeyIdx).split("\n")[0];
    // Check if inline after colon (unlikely for hint, but handle)
    const inlineAfter = hintKeyLine.split("argument-hint:")[1]?.trim();
    if (inlineAfter && !["|-", "|", ">-", ">"].includes(inlineAfter)) {
      return { managed, hintLines: [inlineAfter], rawHint: inlineAfter };
    }
    // Collect indented continuation lines
    const lines = fm.split("\n");
    let inHint = false;
    const hintLines: string[] = [];
    for (const line of lines) {
      if (!inHint) {
        if (/^\s*argument-hint:\s*(?:\|-|\||>-|>)?\s*$/.test(line)) {
          inHint = true;
        }
        continue;
      }
      // In hint: indented content or empty, stop on non-indented non-empty
      if (line.trim() === "") {
        // empty line inside block — keep but don't break
        continue;
      }
      if (/^\s{2,}\S/.test(line) || /^\t/.test(line)) {
        hintLines.push(line.trim());
      } else if (/^\s*\w/.test(line) && line.includes(":")) {
        // next frontmatter key
        break;
      } else {
        break;
      }
    }
    if (hintLines.length === 0) return null;
    return { managed, hintLines, rawHint: hintLines.join("\n") };
  } catch {
    return null;
  }
}

export default function skillRouterInjector(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    const loaded = event.systemPromptOptions?.skills ?? [];
    if (loaded.length === 0) return;

    const blocks: string[] = [];
    for (const skill of loaded) {
      const parsed = parseRouterHint(skill.filePath);
      if (!parsed) continue;
      // Always inject per loaded router — global extension, per-cwd filtered by loaded list
      const hintBody = parsed.hintLines.map(l => `  - \`${l}\``).join("\n");
      blocks.push(`**Router: ${skill.name}** (\`metadata.manage: [${parsed.managed.join(", ")}]\`)\n${hintBody}\n  → Load via \`Read $SKILL_DIR/subskills/<domain>/SKILL.md\` or \`/skill:${skill.name} <domain>\``);
    }

    if (blocks.length === 0) return;

    // Cap total injection — keep context lean (prompt-customizer pattern)
    const capped = blocks.slice(0, 5);
    const truncatedNote = blocks.length > 5 ? `\n… ${blocks.length - 5} more routers hidden — Read parent SKILL.md for full.\n` : "";

    return {
      systemPrompt:
        event.systemPrompt +
        `

## Skill Router Arguments (injected — Codex \`argument-hint\` compat)
Router skills enumerate hidden subskills via \`argument-hint\` outside 300c Description Budget. Leaves with \`managed-by\` pay 0 Metadata Cost and load via \`Read\`, not \`Skill\`.

${capped.join("\n\n")}${truncatedNote}
Use domain verbatim; prefer domain over description verbs.
`,
    };
  });
}
