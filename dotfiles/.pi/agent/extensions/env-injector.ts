/**
 * Env Injector — Pi extension (cache-safe split)
 *
 * Static bits in `systemPrompt` once (cache-stable), dynamic UTC time
 * prepended to each user message (user messages are never prefix-cached).
 *
 * - `before_agent_start`: append `<env><os_type>…</os_type><shell>…</shell></env>`
 * - `input`: transform text to `[YYYY-MM-DDTHH:MM:SSZ]\n<text>` (bare `Z` = UTC)
 *
 * Why split: mutating `systemPrompt` per turn invalidates prompt cache.
 * Detection is best-effort, cached per process, never throws.
 */

import * as os from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

let cachedOsType: string | undefined;
let cachedShell: string | undefined;

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
  return cachedShell;
}

/** Idempotency: skip when text already carries a `[<ISO-UTC>]` prefix. */
export function needsTimestamp(text: string): boolean {
  if (!text.trim()) return false;
  return !/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\]/.test(text.trimStart());
}

export function prependTimestamp(text: string, now = new Date()): string {
  return `[${now.toISOString()}]${"\n"}${text}`;
}

export function buildStaticBlock(osType: string, shell: string): string {
  // Z means UTC — documented here so per-message bytes stay bare.
  return `<env><os_type>${osType}</os_type><shell>${shell}</shell></env>`;
}

export default function envInjector(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    const osType = detectOsType();
    const shell = await detectShell();
    if (event.systemPrompt.includes("<os_type>")) return;
    return {
      systemPrompt: `${event.systemPrompt}\n\n## Environment\n\n${buildStaticBlock(osType, shell)}\n`,
    };
  });

  pi.on("input", async (event) => {
    if (event.source === "extension") return { action: "continue" as const };
    if (!needsTimestamp(event.text)) return { action: "continue" as const };
    return {
      action: "transform" as const,
      text: prependTimestamp(event.text),
      ...(event.images !== undefined ? { images: event.images } : {}),
    };
  });
}
