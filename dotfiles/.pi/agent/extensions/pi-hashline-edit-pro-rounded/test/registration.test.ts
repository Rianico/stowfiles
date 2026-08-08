import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CONFIG_ENV_VAR } from "../src/config.js";
import { FACTORIES } from "../src/frame.js";
import extension from "../index.js";

interface MockTool {
  name: string;
  source: string;
}

function makeMockPi(tools: MockTool[]) {
  const registered: any[] = [];
  const active = tools.map((t) => t.name);
  let sessionStartHandler: (() => Promise<void>) | null = null;
  const pi = {
    on(event: string, handler: any) {
      if (event === "session_start") sessionStartHandler = handler;
    },
    registerTool(def: any) {
      registered.push(def);
    },
    getAllTools() {
      return tools.map((t) => ({ name: t.name, sourceInfo: { source: t.source } }));
    },
    getActiveTools() {
      return [...active];
    },
    setActiveTools(names: string[]) {
      active.splice(0, active.length, ...names);
    },
  } as unknown as ExtensionAPI;
  return { pi, registered, active, run: () => sessionStartHandler!() };
}

const ALL_BUILTINS: MockTool[] = [
  { name: "read", source: "package" }, // e.g. pi-hashline-edit-pro owns read
  { name: "write", source: "builtin" },
  { name: "edit", source: "builtin" },
  { name: "bash", source: "builtin" },
  { name: "grep", source: "builtin" },
  { name: "find", source: "builtin" },
  { name: "ls", source: "builtin" },
];

beforeEach(() => {
  process.env[CONFIG_ENV_VAR] = JSON.stringify({ log: false, hashline: false });
});

afterEach(() => {
  delete process.env[CONFIG_ENV_VAR];
});

describe("extension registration", () => {
  it("wraps built-in-owned names and skips extension-owned names by default", async () => {
    const mock = makeMockPi(ALL_BUILTINS);
    extension(mock.pi);
    await mock.run();

    const names = mock.registered.map((d) => d.name);
    expect(names).not.toContain("read"); // hashline's read untouched
    expect(names.sort()).toEqual(["bash", "edit", "find", "grep", "ls", "write"]);

    for (const def of mock.registered) {
      expect(def.renderShell).toBe("self");
      expect(typeof def.renderCall).toBe("function");
      expect(typeof def.renderResult).toBe("function");
      expect(typeof def.execute).toBe("function"); // original execute preserved
      expect(FACTORIES[def.name]).toBeDefined();
    }
  });

  it("force replaces an extension-owned name", async () => {
    process.env[CONFIG_ENV_VAR] = JSON.stringify({ log: false, hashline: false, force: ["read"] });
    const mock = makeMockPi(ALL_BUILTINS);
    extension(mock.pi);
    await mock.run();
    expect(mock.registered.map((d) => d.name).sort()).toEqual(["bash", "edit", "find", "grep", "ls", "read", "write"]);
  });

  it("aliases register the wrapped tool under a custom name without touching the owner", async () => {
    process.env[CONFIG_ENV_VAR] = JSON.stringify({ log: false, hashline: false, aliases: { read: "read2" } });
    const mock = makeMockPi(ALL_BUILTINS);
    extension(mock.pi);
    await mock.run();

    const names = mock.registered.map((d) => d.name);
    expect(names).toContain("read2");
    expect(names).not.toContain("read"); // hashline's read stays
    // the new name is activated additively
    expect(mock.active).toContain("read2");
    expect(mock.active).toContain("read");
    expect(mock.active).toContain("bash");
  });

  it("respects a tools subset from the env config", async () => {
    process.env[CONFIG_ENV_VAR] = JSON.stringify({ log: false, hashline: false, tools: ["bash", "grep"] });
    const mock = makeMockPi(ALL_BUILTINS);
    extension(mock.pi);
    await mock.run();
    expect(mock.registered.map((d) => d.name).sort()).toEqual(["bash", "grep"]);
  });

  it("skips unknown tool names with a warning", async () => {
    process.env[CONFIG_ENV_VAR] = JSON.stringify({ log: true, hashline: false, tools: ["not_a_real_tool"] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mock = makeMockPi(ALL_BUILTINS);
    extension(mock.pi);
    await mock.run();
    expect(mock.registered).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("fails open when getAllTools is unavailable and wraps every configured name", async () => {
    const mock = makeMockPi(ALL_BUILTINS);
    (mock.pi as any).getAllTools = () => {
      throw new Error("not initialized");
    };
    extension(mock.pi);
    await mock.run();
    expect(mock.registered.map((d) => d.name).sort()).toEqual(["bash", "edit", "find", "grep", "ls", "read", "write"]);
  });

  it("does not re-activate existing names", async () => {
    const mock = makeMockPi(ALL_BUILTINS);
    extension(mock.pi);
    await mock.run();
    // no aliases → no setActiveTools call should change anything
    expect(mock.active.sort()).toEqual(ALL_BUILTINS.map((t) => t.name).sort());
  });
});
