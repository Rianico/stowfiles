/**
 * Configuration for pi-rounded-tools.
 *
 * Defaults can be edited here or overridden at runtime with the
 * PI_ROUNDED_TOOLS environment variable (JSON, deep-merged over defaults):
 *
 *   PI_ROUNDED_TOOLS='{"tools":["bash","grep"],"corners":"straight"}' pi
 */

export const CONFIG_ENV_VAR = "PI_ROUNDED_TOOLS";

export interface RoundedToolsConfig {
  /** Built-in tool names to wrap in rounded frames. */
  tools: string[];
  /** Names in `tools` that another extension already registered. They are
   *  skipped by default (the other extension wins). Add a name here to
   *  FORCE-replace it with a fresh built-in definition — you lose the other
   *  extension's implementation for that name. */
  force: string[];
  /** Optional rename when registering the wrapped tool, keyed by built-in
   *  name, e.g. { read: "read2" } registers the rounded built-in read as
   *  "read2" (leaving hashline's "read" untouched). The new name is added
   *  to the active tools automatically. */
  aliases: Record<string, string>;
  /** Frame corners: "rounded" (╭╮╰╯) or "straight" (┌┐└┘). */
  corners: "rounded" | "straight";
  /** Inner horizontal padding columns (border + pad + content + pad + border). */
  padding: number;
  /** Merge the call and result into one continuous frame (no double border
   *  between them). When false, call and result each get their own closed box. */
  stackCallResult: boolean;
  /** No frame while the tool is still streaming — avoids redraw flicker;
   *  the frame only appears once the tool settles. */
  skipPartial: boolean;
  /** Below this width the frame degrades to plain inner rendering. */
  minWidth: number;
  /** Border color keys per tool state, resolved through theme.fg(). */
  colors: { pending: string; error: string; success: string };
  /** Embed pi-hashline-edit-pro when it is installed as a dependency: run it
   *  through a capturing proxy at load time and wrap every tool it registers
   *  (read, replace, undo_last_replace) in rounded frames, preserving all of
   *  its behavior. Set to false to keep hashline tools unwrapped. */
  hashline: boolean;
  /** Log skip / force-replace decisions to the console. */
  log: boolean;
}

export const DEFAULTS: RoundedToolsConfig = {
  tools: ["read", "write", "edit", "bash", "grep", "find", "ls"],
  force: [],
  aliases: {},
  corners: "rounded",
  padding: 1,
  stackCallResult: true,
  skipPartial: true,
  minWidth: 4,
  colors: { pending: "warning", error: "error", success: "border" },
  hashline: true,
  log: true,
};

export function resolveConfig(raw?: string): RoundedToolsConfig {
  const env = raw ?? process.env[CONFIG_ENV_VAR];
  if (!env) return DEFAULTS;
  try {
    const parsed = JSON.parse(env) as Partial<RoundedToolsConfig>;
    return {
      ...DEFAULTS,
      ...parsed,
      colors: { ...DEFAULTS.colors, ...(parsed.colors ?? {}) },
    };
  } catch (e) {
    console.warn(`[rounded-tools] ${CONFIG_ENV_VAR} is not valid JSON — ignoring:`, e);
    return DEFAULTS;
  }
}
