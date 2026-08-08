/**
 * Rounded-frame rendering primitives.
 *
 * A tool definition is wrapped with renderShell "self" and custom
 * renderCall/renderResult that delegate to the built-in renderers and frame
 * their output. This is the only rendering change — name, description,
 * parameters, prompt data and execute are preserved untouched.
 */

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import {
  createBashToolDefinition,
  createEditToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { visibleWidth } from "@earendil-works/pi-tui";
import type { RoundedToolsConfig } from "./config.js";

type FrameMode = "closed" | "open-bottom" | "open-top";

interface CornerSet {
  tl: string;
  tr: string;
  bl: string;
  br: string;
  h: string;
  v: string;
}

export function cornerSet(cfg: RoundedToolsConfig): CornerSet {
  if (cfg.corners === "straight") {
    return { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" };
  }
  return { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" };
}

/**
 * Wraps inner content in a frame drawn with corner glyphs.
 *
 * Modes let call + result stack into one continuous frame:
 *   - "closed"      → ╭ ── ╮ / │ x │ / ╰ ── ╯  (standalone box)
 *   - "open-bottom" → ╭ ── ╮ / │ x │           (top of a stacked frame)
 *   - "open-top"    →        │ x │ / ╰ ── ╯   (bottom of a stacked frame)
 */
export class RoundedFrame implements Component {
  constructor(
    private readonly inner: Component,
    private readonly border: (text: string) => string,
    private readonly mode: FrameMode,
    private readonly cfg: RoundedToolsConfig,
    private readonly corners: CornerSet,
  ) {}

  invalidate(): void {
    this.inner.invalidate?.();
  }

  // pi's built-in tool renderers cache the previously-returned component via
  // context.lastComponent and call mutating methods on it (Text.setText,
  // Container.clear/addChild, invalidate) to re-render in place while
  // streaming. Forward these to the inner so the original renderers keep
  // working through our wrapper; no-ops via optional chaining when missing.
  setText(text: string): void {
    (this.inner as any).setText?.(text);
  }
  clear(): void {
    (this.inner as any).clear?.();
  }
  addChild(child: unknown): void {
    (this.inner as any).addChild?.(child);
  }

  render(width: number): string[] {
    if (width < this.cfg.minWidth) {
      return this.inner.render(width);
    }
    const { tl, tr, bl, br, h, v } = this.corners;
    const pad = Math.max(0, this.cfg.padding);
    const innerWidth = Math.max(1, width - 2 * (pad + 1));
    const horizontal = h.repeat(Math.max(0, width - 2));
    const innerLines = this.inner.render(innerWidth);
    const side = this.border(v);
    const out: string[] = [];

    if (this.mode !== "open-top") {
      out.push(this.border(tl + horizontal + tr));
    }
    if (innerLines.length > 0) {
      for (const line of innerLines) {
        const vis = visibleWidth(line);
        const fill = " ".repeat(Math.max(0, innerWidth - vis));
        out.push(side + " ".repeat(pad) + line + fill + " ".repeat(pad) + side);
      }
    } else if (this.mode === "closed") {
      // Standalone closed frame with no content: keep the box visible.
      out.push(side + " ".repeat(Math.max(0, width - 2)) + side);
    }
    if (this.mode !== "open-bottom") {
      out.push(this.border(bl + horizontal + br));
    }
    return out;
  }
}

export function borderColorFor(
  context: { isPartial?: boolean; isError?: boolean } | undefined,
  cfg: RoundedToolsConfig,
): string {
  if (context?.isPartial) return cfg.colors.pending;
  if (context?.isError) return cfg.colors.error;
  return cfg.colors.success;
}

/**
 * Wrap a built-in tool definition in rounded frames.
 *
 * The original definition is spread first so every metadata field
 * (promptSnippet / promptGuidelines / prepareArguments / constrainedSampling /
 * executionMode / …) is preserved — only the renderers and renderShell are
 * overwritten. The inner renderers are invoked with lastComponent cleared so
 * they never mistake a RoundedFrame for their own cached component (which
 * would throw on Text.setText or nest frames).
 */
export const EMPTY_COMPONENT: Component = { render: () => [], invalidate() {} };
// Optional renderer-invocation debug hook (set by the entry point when debugging).
let renderDebug: ((msg: string) => void) | undefined;
const renderCount = new Map<string, number>();
export function setRenderDebug(fn?: (msg: string) => void): void {
  renderDebug = fn;
}
function noteRender(tag: string, name: string, extra = ""): void {
  if (!renderDebug) return;
  const key = tag + ":" + name;
  const n = renderCount.get(key) ?? 0;
  renderCount.set(key, n + 1);
  if (n < 3) renderDebug(`render ${tag} name=${name} ${extra}`);
}

export function wrapTool(def: ToolDefinition, cfg: RoundedToolsConfig) {
  const corners = cornerSet(cfg);
  const frame = (
    inner: Component,
    theme: { fg: (color: string, text: string) => string },
    mode: FrameMode,
    colorKey: string,
  ): Component => new RoundedFrame(inner, (t) => theme.fg(colorKey, t), mode, cfg, corners);

  return {
    ...def,
    renderShell: "self" as const,
    renderCall: (args: any, theme: any, context: any) => {
      noteRender("call", def.name, `isPartial=${context?.isPartial} isError=${context?.isError}`);
      const inner: Component = def.renderCall
        ? def.renderCall(args, theme, { ...context, lastComponent: undefined })
        : EMPTY_COMPONENT;
      if (cfg.skipPartial && context?.isPartial) return inner;
      return frame(inner, theme, cfg.stackCallResult ? "open-bottom" : "closed", borderColorFor(context, cfg));
    },
    renderResult: (result: any, options: any, theme: any, context: any) => {
      noteRender("result", def.name, `isPartial=${context?.isPartial} isError=${context?.isError}`);
      const inner: Component = def.renderResult
        ? def.renderResult(result, options, theme, { ...context, lastComponent: undefined })
        : EMPTY_COMPONENT;
      if (cfg.skipPartial && context?.isPartial) return inner;
      return frame(inner, theme, cfg.stackCallResult ? "open-top" : "closed", borderColorFor(context, cfg));
    },
  };
}

/** The built-in tools this extension can rebuild (the only names it may wrap). */
export const FACTORIES: Record<string, (cwd: string) => ToolDefinition<any, any, any>> = {
  read: createReadToolDefinition,
  write: createWriteToolDefinition,
  edit: createEditToolDefinition,
  bash: createBashToolDefinition,
  grep: createGrepToolDefinition,
  find: createFindToolDefinition,
  ls: createLsToolDefinition,
};
