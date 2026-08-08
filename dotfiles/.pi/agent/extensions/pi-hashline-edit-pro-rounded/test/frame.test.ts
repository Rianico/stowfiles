import { describe, expect, it, vi } from "vitest";
import type { Component } from "@earendil-works/pi-tui";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { DEFAULTS } from "../src/config.js";
import { borderColorFor, cornerSet, RoundedFrame, wrapTool } from "../src/frame.js";

const cfg = { ...DEFAULTS, log: false };
const noColor = (t: string) => t;
const inner = (lines: string[]): Component => ({ render: () => lines, invalidate() {} });

function frame(mode: "closed" | "open-bottom" | "open-top", lines: string[] = ["hi"]) {
  return new RoundedFrame(inner(lines), noColor, mode, cfg, cornerSet(cfg));
}

describe("RoundedFrame", () => {
  it("draws a closed rounded box with padding at the given width", () => {
    // width 6, padding 1 → inner width 2
    expect(frame("closed").render(6)).toEqual(["╭────╮", "│ hi │", "╰────╯"]);
  });

  it("pads long inner lines with trailing spaces", () => {
    expect(frame("closed", ["abcdef"]).render(12)).toEqual(["╭──────────╮", "│ abcdef   │", "╰──────────╯"]);
  });

  it("open-bottom drops the bottom border (call half of a stacked frame)", () => {
    expect(frame("open-bottom").render(6)).toEqual(["╭────╮", "│ hi │"]);
  });

  it("open-top drops the top border (result half of a stacked frame)", () => {
    expect(frame("open-top").render(6)).toEqual(["│ hi │", "╰────╯"]);
  });

  it("supports straight corners", () => {
    const straight = { ...cfg, corners: "straight" as const };
    const f = new RoundedFrame(inner(["hi"]), noColor, "closed", straight, cornerSet(straight));
    expect(f.render(6)).toEqual(["┌────┐", "│ hi │", "└────┘"]);
  });

  it("renders inner content unframed below minWidth", () => {
    expect(frame("closed").render(3)).toEqual(["hi"]);
  });

  it("keeps an empty closed box visible with a placeholder row", () => {
    expect(frame("closed", []).render(6)).toEqual(["╭────╮", "│    │", "╰────╯"]);
  });

  it("does not emit a placeholder row for open modes with no content", () => {
    expect(frame("open-bottom", []).render(6)).toEqual(["╭────╮"]);
    expect(frame("open-top", []).render(6)).toEqual(["╰────╯"]);
  });

  it("supports zero padding", () => {
    const zero = { ...cfg, padding: 0 };
    const f = new RoundedFrame(inner(["hi"]), noColor, "closed", zero, cornerSet(zero));
    expect(f.render(4)).toEqual(["╭──╮", "│hi│", "╰──╯"]);
  });

  it("forwards setText/clear/addChild/invalidate to the inner component", () => {
    const innerComp: any = { render: () => [], setText: vi.fn(), clear: vi.fn(), addChild: vi.fn(), invalidate: vi.fn() };
    const f = new RoundedFrame(innerComp, noColor, "closed", cfg, cornerSet(cfg));
    f.setText("x");
    f.clear();
    f.addChild({});
    f.invalidate();
    expect(innerComp.setText).toHaveBeenCalledWith("x");
    expect(innerComp.clear).toHaveBeenCalled();
    expect(innerComp.addChild).toHaveBeenCalled();
    expect(innerComp.invalidate).toHaveBeenCalled();
  });
});

describe("borderColorFor", () => {
  it("maps tool state to configured color keys", () => {
    expect(borderColorFor({ isPartial: true }, cfg)).toBe("warning");
    expect(borderColorFor({ isError: true }, cfg)).toBe("error");
    expect(borderColorFor({}, cfg)).toBe("border");
    expect(borderColorFor(undefined, cfg)).toBe("border");
  });
});

describe("wrapTool", () => {
  const execute = vi.fn(async () => ({ content: [] as any[], details: undefined }));
  const makeDef = (overrides: Partial<ToolDefinition> = {}) =>
    ({
      name: "stub",
      label: "Stub",
      description: "stub tool",
      parameters: {},
      execute,
      renderCall: vi.fn(() => ({ render: () => ["inner-call"], invalidate() {} })),
      renderResult: vi.fn(() => ({ render: () => ["inner-result"], invalidate() {} })),
      ...overrides,
    }) as ToolDefinition;

  const themeStub: any = { fg: (c: string, t: string) => t };
  const ctx = (partial: boolean) => ({
    isPartial: partial,
    isError: false,
    lastComponent: "PREVIOUS" as any,
    args: {}, toolCallId: "t1", cwd: "/tmp", state: {}, invalidate: () => {},
  });

  it("sets renderShell to self and preserves metadata + execute", () => {
    const def = makeDef();
    const wrapped = wrapTool(def, cfg) as any;
    expect(wrapped.renderShell).toBe("self");
    expect(wrapped.name).toBe("stub");
    expect(wrapped.description).toBe("stub tool");
    expect(wrapped.execute).toBe(execute);
  });

  it("clears lastComponent before delegating to the inner renderers", () => {
    const def = makeDef();
    const wrapped = wrapTool(def, cfg) as any;
    wrapped.renderCall({}, themeStub, ctx(false));
    wrapped.renderResult({ content: [], details: undefined }, { expanded: true, isPartial: false }, themeStub, ctx(false));
    expect((def.renderCall as any).mock.calls[0][2].lastComponent).toBeUndefined();
    expect((def.renderResult as any).mock.calls[0][3].lastComponent).toBeUndefined();
  });

  it("returns the inner component unframed while partial (skipPartial)", () => {
    const def = makeDef();
    const wrapped = wrapTool(def, cfg) as any;
    const comp = wrapped.renderCall({}, themeStub, ctx(true));
    expect(comp.render(20)).toEqual(["inner-call"]);
  });

  it("frames the call with open-bottom and the result with open-top when stacking", () => {
    const def = makeDef();
    const wrapped = wrapTool(def, cfg) as any;
    const callComp = wrapped.renderCall({}, themeStub, ctx(false));
    const resultComp = wrapped.renderResult({ content: [], details: undefined }, { expanded: true, isPartial: false }, themeStub, ctx(false));
    const callLines = callComp.render(10);
    const resultLines = resultComp.render(10);
    // call half: top border, no bottom border
    expect(callLines[0]).toBe("╭────────╮");
    expect(callLines[callLines.length - 1]).not.toMatch(/^╰/);
    // result half: no top border, bottom border
    expect(resultLines[0]).not.toMatch(/^╭/);
    expect(resultLines[resultLines.length - 1]).toBe("╰────────╯");
  });

  it("renders two closed boxes when stackCallResult is false", () => {
    const separate = { ...cfg, stackCallResult: false };
    const def = makeDef();
    const wrapped = wrapTool(def, separate) as any;
    const callLines = wrapped.renderCall({}, themeStub, ctx(false)).render(10);
    const resultLines = wrapped.renderResult({ content: [], details: undefined }, { expanded: true, isPartial: false }, themeStub, ctx(false)).render(10);
    expect(callLines[0]).toBe("╭────────╮");
    expect(callLines[callLines.length - 1]).toBe("╰────────╯");
    expect(resultLines[0]).toBe("╭────────╮");
    expect(resultLines[resultLines.length - 1]).toBe("╰────────╯");
  });
});
