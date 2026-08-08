/**
 * Rounded Tools — conflict-safe rounded frames for Pi tool call/result blocks.
 *
 * A refined fork of orionpax1997/pi-rounded-tools. The original re-registered
 * the seven built-in tools under hardcoded names, which clobbered any other
 * extension that overrides those names (e.g. pi-hashline-edit-pro owns
 * `read`). This version:
 *
 *   1. Is configurable — pick exactly which tool names to wrap, force-replace
 *      extension-owned names, or register wrapped tools under custom names.
 *   2. Is conflict-aware — at session_start it snapshots pi.getAllTools() and
 *      skips names already owned by another extension (unless forced), so
 *      hashline's `read` keeps working while everything else gets frames.
 *   3. Only wraps names it can rebuild — the built-in factories are re-created
 *      and wrapped; other extensions' implementations are never touched.
 *   4. Can embed pi-hashline-edit-pro (optional dependency): runs its factory
 *      through a capturing proxy and re-registers all of its tools wrapped in
 *      rounded frames, preserving hashline behavior. See src/hashline.ts.
 *
 * Install: drop this directory at ~/.pi/agent/extensions/rounded-tools/ and
 * run /reload inside pi (or restart). See README.md for full configuration.
 *
 * Development: npm install && npm test  (vitest suite in test/)
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { resolveConfig } from "./src/config.js";
import { FACTORIES, wrapTool, setRenderDebug } from "./src/frame.js";
import { wrapHashlineTools, type HashlineMain } from "./src/hashline.js";
import { debugLog } from "./src/debug.js";

export default async function (pi: ExtensionAPI): Promise<void> {
  debugLog("extension factory invoked");
  setRenderDebug((msg) => debugLog(msg));
  const cfg = resolveConfig();
  const log = (msg: string) => {
    if (cfg.log) console.warn(`[rounded-tools] ${msg}`);
  };

  // Embed pi-hashline-edit-pro (when installed as a dependency): run its
  // factory through a capturing proxy and re-register every tool it registers
  // (read, replace, undo_last_replace) wrapped in rounded frames.
  if (cfg.hashline) {
    try {
      // Non-literal specifier: TypeScript can't resolve it, so the optional
      // dependency's own source is never pulled into the type-checked program.
      const hashlinePkg = "pi-hashline-edit-pro";
      const mod = await import(hashlinePkg);
      const main = (mod.default ?? mod) as HashlineMain;
      const wrapped = wrapHashlineTools(pi, cfg, main);
      if (wrapped.length > 0) {
        debugLog(`embedded pi-hashline-edit-pro; wrapped tools: ${JSON.stringify(wrapped)}`);
      }
    } catch (err) {
      log(`pi-hashline-edit-pro not available (${err instanceof Error ? err.message : String(err)}); hashline tools are not wrapped`);
    }
  }

  pi.on("session_start", async (event) => {
    debugLog(`session_start reason=${event?.reason ?? "?"}`);

    // Snapshot which configured names are already owned by someone else.
    // All extensions finish loading before session_start, so this is the
    // final word on ownership. sourceInfo.source === "builtin" means pi's
    // own definition is in place; anything else (package / top-level / sdk)
    // means another extension registered that name.
    const owners = new Map<string, string>();
    try {
      for (const t of pi.getAllTools()) {
        owners.set(t.name, t.sourceInfo?.source ?? "unknown");
      }
      debugLog(`getAllTools snapshot: ${JSON.stringify([...owners.entries()])}`);
    } catch (e) {
      debugLog(`getAllTools threw: ${String(e)}`);
      log(`could not inspect registered tools (${String(e)}); wrapping every configured name`);
    }

    // If a standalone pi-hashline-edit-pro extension is still loaded alongside
    // the embedded one, both register read/replace/undo_last_replace and the
    // winner depends on extension load order — warn so it can be removed.
    if (cfg.hashline) {
      for (const name of ["read", "replace", "undo_last_replace"]) {
        const owner = owners.get(name);
        if (owner && owner.includes("hashline")) {
          log(`"${name}" is also registered by ${owner} — remove the standalone pi-hashline-edit-pro extension so the embedded wrapped version wins deterministically`);
        }
      }
    }

    const cwd = process.cwd();
    const newlyActive: string[] = [];

    for (const name of cfg.tools) {
      const factory = FACTORIES[name];
      if (!factory) {
        log(`unknown tool "${name}" — not a pi built-in; cannot wrap it`);
        continue;
      }
      const regName = cfg.aliases[name] ?? name;
      const owner = owners.get(name);
      const ownedByExtension = owner !== undefined && owner !== "builtin";

      // Aliasing registers under a DIFFERENT name, so the other extension's
      // registration of `name` stays untouched — no conflict, no skip.
      if (ownedByExtension && !cfg.force.includes(name) && regName === name) {
        log(
          `skipping "${name}" — already registered by another extension (source: ${owner}). ` +
            `Add it to "force" to replace it, or use "aliases" to register the rounded version under a different name.`,
        );
        continue;
      }
      if (ownedByExtension && cfg.force.includes(name)) {
        log(`FORCE-replacing "${name}" (source: ${owner}) with a fresh built-in wrapped in rounded frames.`);
      }

      const def = factory(cwd);
      debugLog(`registering ${regName} (wrapping builtin ${name})`);
      pi.registerTool(wrapTool({ ...def, name: regName }, cfg) as ToolDefinition);
      if (!owners.has(regName)) newlyActive.push(regName);
    }

    try {
      debugLog(`active tools after registration: ${JSON.stringify(pi.getActiveTools())}`);
    } catch (e) {
      debugLog(`getActiveTools threw: ${String(e)}`);
    }

    // Aliased names are brand new — make them callable (additive only).
    if (newlyActive.length > 0) {
      try {
        pi.setActiveTools([...pi.getActiveTools(), ...newlyActive]);
        debugLog(`activated new aliases: ${JSON.stringify(newlyActive)}`);
      } catch (e) {
        debugLog(`setActiveTools threw: ${String(e)}`);
      }
    }
    debugLog("session_start handler complete");
  });
}
