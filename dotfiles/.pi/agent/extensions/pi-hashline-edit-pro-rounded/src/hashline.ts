/**
 * Hashline embedding — run pi-hashline-edit-pro *inside* this extension and
 * wrap every tool it registers (read, replace, undo_last_replace) in rounded
 * frames.
 *
 * No changes to hashline are required. Its tool definitions are captured by a
 * Proxy around `pi.registerTool` at load time, wrapped with the same RoundedFrame
 * machinery as the built-ins, and re-registered under the same names. Within one
 * extension the tool map is keyed by name and the last registration wins, so the
 * wrapped versions are the ones pi resolves. All of hashline's other wiring —
 * the session_start hash-store init, the tool_result auto-read hook, and the
 * toggle-auto-read command — is forwarded to the real pi untouched.
 *
 * Renderer note: hashline's `read` and `undo_last_replace` define no custom
 * renderers; today they render through pi's built-in fallbacks (a bold tool-name
 * call block and plain toolOutput text). `wrapTool` only sees the definition's
 * own renderers, so those two get equivalent fallback renderers injected here;
 * `replace` keeps its own (preview timers, diff renderer, etc.).
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { RoundedToolsConfig } from "./config.js";
import { EMPTY_COMPONENT, wrapTool } from "./frame.js";

export type HashlineMain = (pi: ExtensionAPI) => void;

/** Intercept registerTool to capture defs; forward everything else untouched. */
function captureTools(pi: ExtensionAPI): {
  captured: Map<string, ToolDefinition>;
  proxy: ExtensionAPI;
} {
  const captured = new Map<string, ToolDefinition>();
  const proxy = new Proxy(pi, {
    get(target, prop, receiver) {
      if (prop === "registerTool") {
        return (tool: ToolDefinition) => {
          captured.set(tool.name, tool);
          target.registerTool(tool);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { captured, proxy };
}

interface MinimalTheme {
  fg: (color: any, text: string) => string;
  bold?: (text: string) => string;
}

/** pi's default call block when a tool defines no renderCall: the bold name. */
function fallbackRenderCall(name: string) {
  return (_args: unknown, theme: MinimalTheme) =>
    new Text(theme.fg("toolTitle", theme.bold ? theme.bold(name) : name), 0, 0);
}

/** pi's default result block when a tool defines no renderResult: plain text. */
function fallbackRenderResult() {
  return (
    result: { content?: Array<{ type: string; text?: string }> },
    _options: unknown,
    theme: MinimalTheme,
  ) => {
    const text = (result?.content ?? [])
      .filter((c): c is { type: "text"; text: string } => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("\n");
    if (!text) return EMPTY_COMPONENT;
    return new Text(theme.fg("toolOutput", text), 0, 0);
  };
}

/**
 * hashline tools without custom renderers render through pi's built-in
 * fallbacks; the wrapped renderers must supply equivalent inners or the frame
 * would be empty. Tools that already define renderers (replace) pass through.
 */
function ensureInnerRenderers(name: string, def: ToolDefinition): ToolDefinition {
  if (typeof def.renderCall === "function" && typeof def.renderResult === "function") {
    return def;
  }
  return {
    ...def,
    ...(typeof def.renderCall === "function" ? {} : { renderCall: fallbackRenderCall(name) }),
    ...(typeof def.renderResult === "function" ? {} : { renderResult: fallbackRenderResult() }),
  };
}

/**
 * Run hashline against a capturing proxy, then re-register every tool it
 * registered — wrapped in rounded frames — under the same name.
 * Returns the wrapped tool names. hashline's plain registrations are
 * overwritten by the wrapped ones (last registration per name wins).
 */
export function wrapHashlineTools(
  pi: ExtensionAPI,
  cfg: RoundedToolsConfig,
  hashlineMain: HashlineMain,
): string[] {
  const { captured, proxy } = captureTools(pi);
  hashlineMain(proxy);
  const wrapped: string[] = [];
  for (const [name, def] of captured) {
    pi.registerTool(wrapTool(ensureInnerRenderers(name, def), cfg) as ToolDefinition);
    wrapped.push(name);
  }
  return wrapped;
}
