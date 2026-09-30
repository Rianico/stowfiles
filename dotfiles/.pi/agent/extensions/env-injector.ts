/**
 * Env Injector — Pi extension (cache-safe split)
 *
 * Static environment facts ride pi's structured prompt sections once per session
 * (cache-stable, per-section diffed); the live UTC time rides each user message,
 * because user messages are never prefix-cached.
 *
 * Surfaces:
 * - Model-facing: `systemPromptOptions.sections.os_type` / `.shell` — pi renders each as
 *   `<name>…</name>` right after the native `<cwd>` section. Mutating options (never
 *   returning `systemPrompt`) keeps the structured-section diff intact.
 * - Model-facing: the UTC stamp prefixed to each user message, restamped on resend.
 *
 * Visibility: there is deliberately NO transcript entry here. The sections are rendered by
 * pi into the system prompt, which the export's System-Prompt block shows verbatim — a
 * snapshot message would only duplicate that text behind a default-collapsed toggle.
 *
 * Invariants:
 * - `/`-prefixed input is never stamped: pi expands `/skill:<name>` and prompt templates
 *   *after* input handlers run (`core/agent-session.js`), and both expanders require the
 *   text to still start with `/`. Rewriting first would send the command as literal text.
 *   Those turns simply carry no stamp.
 * - Section names `os_type`/`shell` are safe against pi's reserved set (`preamble` throws;
 *   `skills`/`cwd`/`tools`/`rules`/`docs`/`project_context`/`addendum` would shadow natives).
 * - Section values are XML-escaped: they are interpolated straight into `<name>…</name>`.
 * - Detection is best-effort and cached per process; it never throws.
 */

import * as os from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

let cachedOsType: string | undefined;
let cachedShell: string | undefined;

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function friendlyOs(): string {
  const platform = os.platform();
  if (platform === "darwin") return "macOS";
  if (platform === "linux") return "Linux";
  if (platform === "win32") return "Windows";
  return platform;
}

export function detectOsType(): string {
  if (cachedOsType !== undefined) return cachedOsType;
  try {
    // e.g. macOS (Darwin 24.1.0, arm64) — kernel name via `os.type()`,
    // release + arch via stdlib (no spawn, no shell-out).
    cachedOsType = `${friendlyOs()} (${os.type()} ${os.release()}, ${os.arch()})`;
  } catch {
    cachedOsType = "unknown";
  }
  return cachedOsType;
}

function shellVersionFromStdout(name: string, stdout: string): string | undefined {
  const m = stdout.match(/(\d+\.\d+(?:\.\d+)?)/);
  if (m) return `${name} ${m[1]}`;
  return undefined;
}

function probeShellVersion(shellPath: string, name: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), 750);
    execFile(shellPath, ["--version"], { timeout: 700 }, (err, stdout) => {
      clearTimeout(timer);
      if (err) {
        resolve(undefined);
        return;
      }
      resolve(shellVersionFromStdout(name, String(stdout ?? "")));
    });
  });
}

export async function detectShell(): Promise<string> {
  if (cachedShell !== undefined) return cachedShell;
  const shellPath = process.env["SHELL"]?.trim();
  if (!shellPath) {
    cachedShell = "unknown";
    return cachedShell;
  }
  const name = path.basename(shellPath);
  // Fast path: zsh exposes $ZSH_VERSION without spawning.
  if (name === "zsh" && process.env["ZSH_VERSION"]) {
    const v = process.env["ZSH_VERSION"].match(/(\d+\.\d+(?:\.\d+)?)/)?.[1];
    cachedShell = v ? `zsh ${v}` : "zsh";
    return cachedShell;
  }
  try {
    cachedShell = (await probeShellVersion(shellPath, name)) ?? name;
  } catch {
    cachedShell = name;
  }
  // Assignments inside try/catch do not narrow, so re-state the fallback here.
  return cachedShell ?? name;
}

/** Leading stamp written by this extension: `[<ISO-UTC>]` plus the newline it introduced. */
const LEADING_STAMP = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\]\n?/;

/**
 * Stamp user text with the current UTC time. A resend carries the previous stamp, so it is
 * replaced rather than kept — and only the stamp plus its own newline is consumed, so the
 * body's leading whitespace survives the round trip. Whitespace-only input is returned
 * untouched (no empty stamped turn), and a repeat within the same millisecond yields the
 * identical string, which the caller treats as a no-op.
 */
export function stampText(text: string, now: Date = new Date()): string {
  const body = text.replace(LEADING_STAMP, "");
  if (!body.trim()) return text;
  return `[${now.toISOString()}]\n${body}`;
}

export default function envInjector(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    const osType = detectOsType();
    const shell = await detectShell();

    // Flat sections — no `<env>` wrapper: pi tags each section by its own name, and the
    // insertion order after the native `<cwd>` section is what puts them at the tail.
    const sections = event.systemPromptOptions.sections;
    sections["os_type"] = escapeXml(osType);
    sections["shell"] = escapeXml(shell);
  });

  pi.on("input", (event) => {
    if (event.source === "extension") return { action: "continue" as const };
    // pi expands `/skill:` and `/template` after this hook — stamping first would break them.
    if (event.text.startsWith("/")) return { action: "continue" as const };
    const stamped = stampText(event.text);
    if (stamped === event.text) return { action: "continue" as const };
    return { action: "transform" as const, text: stamped };
  });
}
