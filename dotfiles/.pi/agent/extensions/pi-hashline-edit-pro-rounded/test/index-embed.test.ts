import { afterEach, describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CONFIG_ENV_VAR } from "../src/config.js";
import extension from "../index.js";

afterEach(() => {
  delete process.env[CONFIG_ENV_VAR];
});

const HASHLINE_NAMES = ["read", "replace", "undo_last_replace"];
const BUILTIN_NAMES = ["bash", "write", "edit", "grep", "find", "ls"];

describe("index factory with real hashline embedding", () => {
  it("embeds hashline at load and wraps builtins at session_start without double-handling read", async () => {
    process.env[CONFIG_ENV_VAR] = JSON.stringify({ log: false });
    const registered: any[] = [];
    const active = [...HASHLINE_NAMES, ...BUILTIN_NAMES];
    let sessionStart: (() => Promise<void>) | null = null;

    const pi = {
      on(event: string, handler: any) {
        if (event === "session_start") sessionStart = handler;
      },
      registerTool(def: any) {
        registered.push(def);
      },
      getAllTools() {
        return active.map((name) => ({
          name,
          sourceInfo: {
            source: HASHLINE_NAMES.includes(name) ? "rounded-tools" : "builtin",
          },
        }));
      },
      getActiveTools: () => [...active],
      setActiveTools(names: string[]) {
        active.splice(0, active.length, ...names);
      },
      registerCommand() {},
    } as unknown as ExtensionAPI;

    // async factory: runs the embedding against the REAL hashline package
    await extension(pi);

    // embedding re-registered each hashline tool: plain + wrapped = 2 each
    for (const name of HASHLINE_NAMES) {
      const regs = registered.filter((d) => d.name === name);
      expect(regs, name).toHaveLength(2);
      // the final registration is the wrapped one
      expect(regs.at(-1)!.renderShell, name).toBe("self");
      expect(typeof regs.at(-1)!.renderCall, name).toBe("function");
      expect(typeof regs.at(-1)!.renderResult, name).toBe("function");
      expect(typeof regs.at(-1)!.execute, name).toBe("function");
    }

    await sessionStart!();

    // session_start wraps the built-ins…
    for (const name of BUILTIN_NAMES) {
      const regs = registered.filter((d) => d.name === name);
      expect(regs, name).toHaveLength(1);
      expect(regs[0].renderShell, name).toBe("self");
    }
    // …and skips read (owned by rounded-tools via embedding) — still only 2 registrations
    expect(registered.filter((d) => d.name === "read")).toHaveLength(2);
    // nothing was deactivated
    expect(active.sort()).toEqual([...HASHLINE_NAMES, ...BUILTIN_NAMES].sort());
  });
});
