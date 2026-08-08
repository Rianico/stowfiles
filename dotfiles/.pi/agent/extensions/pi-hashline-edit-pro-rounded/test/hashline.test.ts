import { describe, expect, it } from "vitest";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { resolveConfig } from "../src/config.js";
import { wrapHashlineTools } from "../src/hashline.js";

/** A stand-in for pi-hashline-edit-pro's main factory. */
function fakeHashlineMain(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "read",
    label: "Read",
    execute: async () => ({ content: [{ type: "text", text: "abc│line" }] }),
  } as unknown as ToolDefinition);
  pi.registerTool({
    name: "replace",
    label: "Replace",
    renderShell: "default",
    renderCall: () => ({ render: () => ["call"] }),
    renderResult: () => ({ render: () => ["result"] }),
    execute: async () => ({}),
  } as unknown as ToolDefinition);
  pi.registerTool({
    name: "undo_last_replace",
    label: "Undo Last Replace",
    execute: async () => ({ content: [{ type: "text", text: "undone" }] }),
  } as unknown as ToolDefinition);
}

function makeMockPi() {
  const registered: any[] = [];
  const pi = {
    registerTool(def: any) {
      registered.push(def);
    },
  } as unknown as ExtensionAPI;
  return { pi, registered };
}

const THEME = { fg: (_c: string, t: string) => t, bold: (t: string) => t };

describe("hashline embedding", () => {
  it("wraps every tool hashline registers and re-registers under the same name", () => {
    const { pi, registered } = makeMockPi();
    const cfg = resolveConfig(JSON.stringify({ log: false }));
    const wrapped = wrapHashlineTools(pi, cfg, fakeHashlineMain);

    // original plain registrations + wrapped re-registrations
    expect(wrapped.sort()).toEqual(["read", "replace", "undo_last_replace"]);
    expect(registered).toHaveLength(6);

    const finalByName = new Map(registered.map((d) => [d.name, d]));
    for (const name of ["read", "replace", "undo_last_replace"]) {
      const def = finalByName.get(name);
      expect(def, name).toBeDefined();
      expect(def.renderShell, name).toBe("self"); // frames take over the shell
      expect(typeof def.renderCall, name).toBe("function");
      expect(typeof def.renderResult, name).toBe("function");
      expect(typeof def.execute, name).toBe("function"); // hashline logic preserved
    }
  });

  it("keeps hashline's own renderers for tools that define them (replace)", () => {
    const { pi, registered } = makeMockPi();
    const cfg = resolveConfig(JSON.stringify({ log: false }));
    wrapHashlineTools(pi, cfg, fakeHashlineMain);

    const replaceDef = registered[1]; // plain registration
    expect(typeof replaceDef.renderCall).toBe("function");
    expect(typeof replaceDef.renderResult).toBe("function");
  });

  it("supplies frame inner renderers for tools that define none (read, undo)", () => {
    const { pi, registered } = makeMockPi();
    const cfg = resolveConfig(JSON.stringify({ log: false }));
    wrapHashlineTools(pi, cfg, fakeHashlineMain);

    const finalByName = new Map(registered.map((d) => [d.name, d]));
    const readDef = finalByName.get("read");
    const undoDef = finalByName.get("undo_last_replace");

    // call block renders the bold tool name
    const callLines = readDef.renderCall({}, THEME, {}).render(40);
    expect(callLines.join("\n")).toContain("read");

    // result block renders the output text
    const resultLines = readDef
      .renderResult({ content: [{ type: "text", text: "hello world" }] }, {}, THEME, {})
      .render(40);
    expect(resultLines.join("\n")).toContain("hello world");

    const undoLines = undoDef
      .renderResult({ content: [{ type: "text", text: "undone" }] }, {}, THEME, {})
      .render(40);
    expect(undoLines.join("\n")).toContain("undone");
  });

  it("renders an empty result as an empty inner instead of crashing", () => {
    const { pi, registered } = makeMockPi();
    const cfg = resolveConfig(JSON.stringify({ log: false }));
    wrapHashlineTools(pi, cfg, fakeHashlineMain);

    const readDef = registered[3]; // wrapped read (read registered twice → index 3)
    const comp = readDef.renderResult({ content: [] }, {}, THEME, {});
    expect(() => comp.render(40)).not.toThrow();
  });

  it("does nothing when hashline registers no tools", () => {
    const { pi, registered } = makeMockPi();
    const cfg = resolveConfig(JSON.stringify({ log: false }));
    const wrapped = wrapHashlineTools(pi, cfg, () => undefined);
    expect(wrapped).toEqual([]);
    expect(registered).toHaveLength(0);
  });
});
