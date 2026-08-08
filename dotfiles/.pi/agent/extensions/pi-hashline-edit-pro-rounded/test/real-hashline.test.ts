import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { resolveConfig } from "../src/config.js";
import { wrapHashlineTools } from "../src/hashline.js";

// Load the REAL pi-hashline-edit-pro main factory (installed dependency).
const hashlinePkg = "pi-hashline-edit-pro";

describe("real hashline integration", () => {
  it("captures and wraps all real hashline tools", async () => {
    const mod = await import(hashlinePkg);
    const main = (mod.default ?? mod) as (pi: ExtensionAPI) => void;

    const registered: any[] = [];
    const handlers: Record<string, any> = {};
    const pi = {
      on(event: string, handler: any) {
        handlers[event] = handler;
      },
      registerTool(def: any) {
        registered.push(def);
      },
      registerCommand(_name: string, _opts: unknown) {},
      getActiveTools: () => [],
      setActiveTools: () => {},
    } as unknown as ExtensionAPI;

    const cfg = resolveConfig(JSON.stringify({ log: false }));
    const wrapped = wrapHashlineTools(pi, cfg, main);

    expect(wrapped.sort()).toEqual(["read", "replace", "undo_last_replace"]);
    // 3 plain registrations + 3 wrapped re-registrations
    expect(registered).toHaveLength(6);

    const byName = new Map(registered.map((d) => [d.name, d]));
    for (const name of wrapped) {
      const def = byName.get(name);
      expect(def.renderShell, name).toBe("self");
      expect(typeof def.renderCall, name).toBe("function");
      expect(typeof def.renderResult, name).toBe("function");
      expect(typeof def.execute, name).toBe("function");
    }

    // hashline's non-tool wiring (session_start, tool_result, command) forwarded
    expect(typeof handlers.session_start).toBe("function");
    expect(typeof handlers.tool_result).toBe("function");

    // wrapped read still carries hashline's prompt + parameters
    const readDef = byName.get("read");
    expect(readDef.parameters).toBeDefined();
    expect(readDef.promptSnippet.toLowerCase()).toContain("read");
  });
});
