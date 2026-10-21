/**
 * Env Injector — Pi extension (cache-safe split)
 *
 * Static bits in `systemPrompt` once (cache-stable), dynamic UTC time
 * prepended to each user message (user messages are never prefix-cached).
 *
 * - `before_agent_start`: append `<env>` with os/shell + package-mirror facts
 * - `input`: stamp fresh text as `[YYYY-MM-DDTHH:MM:SS.sssZ]\n<text>` (bare `Z` = UTC);
 *   text that already carries its Message Time Prefix is returned byte-identical
 *
 * Why split: mutating `systemPrompt` per turn invalidates prompt cache.
 * Detection is best-effort, cached per process, never throws.
 *
 * Package mirrors follow each tool's own convention: npm/pip are asked via
 * their config CLI (scope-merging and precedence stay the tool's); uv has no
 * self-query command, so env → best-effort uv.toml parse. Fields appear only
 * when the tool resolves to a non-upstream index; URLs are sanitized of
 * userinfo/query so no credential reaches the prompt.
 */

import * as os from "node:os";
import * as path from "node:path";
import { accessSync, constants, existsSync, readFileSync } from "node:fs";
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

/** Strip userinfo/query and drop upstream defaults; undefined if unusable. */
export function sanitizeIndexUrl(raw: string, defaultHost: string): string | undefined {
  const candidate = raw.trim().replace(/^["']|["']$/g, "");
  if (!candidate) return undefined;
  try {
    const u = new URL(candidate);
    if (u.hostname.toLowerCase() === defaultHost) return undefined;
    u.username = "";
    u.password = "";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return undefined;
  }
}

function hasTool(name: string): boolean {
  for (const dir of (process.env["PATH"] ?? "").split(path.delimiter)) {
    if (!dir) continue;
    try {
      accessSync(path.join(dir, name), constants.X_OK);
      return true;
    } catch {
      // not here; keep scanning
    }
  }
  return false;
}

function probeConfigTool(cmd: string, args: string[]): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 1500 }, (err, stdout) => {
      if (err) {
        resolve(undefined);
        return;
      }
      resolve(String(stdout ?? "").trim() || undefined);
    });
  });
}

let cachedPipIndex: string | "" | undefined;
export async function detectPipIndex(): Promise<string | undefined> {
  if (cachedPipIndex !== undefined) return cachedPipIndex || undefined;
  cachedPipIndex = await resolvePipIndex();
  return cachedPipIndex || undefined;
}

async function resolvePipIndex(): Promise<string | undefined> {
  // Homebrew and friends ship pip as pip3 only; same tool, other entry name.
  const bin = ["pip", "pip3"].find(hasTool);
  if (!bin) return undefined;
  // pip config get does not report env overrides; env-first is part of pip's convention.
  const fromEnv = process.env["PIP_INDEX_URL"];
  if (fromEnv) return sanitizeIndexUrl(fromEnv, "pypi.org");
  const out = await probeConfigTool(bin, ["config", "get", "global.index-url"]);
  return out ? sanitizeIndexUrl(out, "pypi.org") : undefined;
}

let cachedNpmRegistry: string | "" | undefined;
export async function detectNpmRegistry(): Promise<string | undefined> {
  if (cachedNpmRegistry !== undefined) return cachedNpmRegistry || undefined;
  cachedNpmRegistry = (await resolveNpmRegistry()) ?? "";
  return cachedNpmRegistry || undefined;
}

async function resolveNpmRegistry(): Promise<string | undefined> {
  if (!hasTool("npm")) return undefined;
  // No env fast-path: npm config get resolves env vs .npmrc scopes with npm's own precedence.
  const out = await probeConfigTool("npm", ["config", "get", "registry"]);
  return out ? sanitizeIndexUrl(out, "registry.npmjs.org") : undefined;
}

/** Best-effort: uv has no config-query CLI; precedence may drift from uv's real one. */
export function detectUvIndex(): string | undefined {
  if (!hasTool("uv")) return undefined;
  const fromEnv =
    process.env["UV_DEFAULT_INDEX"] ?? process.env["UV_INDEX_URL"] ?? process.env["UV_INDEX"]?.trim().split(/\s+/)[0];
  if (fromEnv) return sanitizeIndexUrl(fromEnv, "pypi.org");
  for (const p of uvConfigCandidates()) {
    if (!existsSync(p)) continue;
    try {
      const url = parseUvIndexToml(readFileSync(p, "utf-8"));
      if (url) return sanitizeIndexUrl(url, "pypi.org");
    } catch {
      // best-effort
    }
  }
  return undefined;
}

function uvConfigCandidates(): string[] {
  const home = os.homedir();
  const xdg = process.env["XDG_CONFIG_HOME"] || path.join(home, ".config");
  const candidates = [process.env["UV_CONFIG_FILE"], path.join(xdg, "uv", "uv.toml")];
  if (os.platform() === "darwin") candidates.push(path.join(home, "Library", "Application Support", "uv", "uv.toml"));
  return candidates.filter((p): p is string => !!p);
}

export function parseUvIndexToml(text: string): string | undefined {
  let first: string | undefined;
  let defaulted: string | undefined;
  let legacy: string | undefined;
  let seenTable = false;
  let inIndex = false;
  let curUrl: string | undefined;
  let curDefault = false;
  const flush = () => {
    if (curUrl) {
      first ??= curUrl;
      defaulted ??= curDefault ? curUrl : undefined;
    }
    curUrl = undefined;
    curDefault = false;
  };
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("[[")) {
      flush();
      inIndex = true;
      seenTable = true;
      continue;
    }
    if (t.startsWith("[")) {
      flush();
      inIndex = false;
      seenTable = true;
      continue;
    }
    if (inIndex) {
      const m = t.match(/^url\s*=\s*["']?([^"'\s]+)["']?/);
      if (m) curUrl = m[1];
      if (/^default\s*=\s*true\b/.test(t)) curDefault = true;
    } else if (!seenTable) {
      const m = t.match(/^index-url\s*=\s*["']?([^"'\s]+)["']?/);
      if (m) legacy ??= m[1];
    }
  }
  flush();
  return defaulted ?? first ?? legacy;
}

/**
 * Message Time Prefix — one spec, both directions.
 *
 * A fresh user message is stamped with the instant it was written (`Z` = UTC, bare
 * so the per-message bytes stay small). A message that *already* carries the prefix
 * is returned byte-identical: the prefix means **origin time**, not delivery time, so
 * rewriting it would falsify when the message was written.
 *
 * `ISO_UTC_INSTANT` recognises, `formatMessageTimePrefix` writes. The fraction of a
 * second is optional on the way in (older prefixes may omit it) while `toISOString()`
 * always emits it; the suite pins the pair so the two halves cannot drift.
 */
const ISO_UTC_INSTANT = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\]/;

export function formatMessageTimePrefix(now: Date): string {
  return `[${now.toISOString()}]`;
}

/** True when text already carries its origin time; leading whitespace is tolerated. */
export function hasMessageTimePrefix(text: string): boolean {
  return ISO_UTC_INSTANT.test(text.trimStart());
}

/** Hook decision: stamp fresh text only — an existing prefix is never restamped. */
export function needsTimestamp(text: string): boolean {
  if (!text.trim()) return false;
  return !hasMessageTimePrefix(text);
}

export function prependTimestamp(text: string, now = new Date()): string {
  return `${formatMessageTimePrefix(now)}\n${text}`;
}

export interface MirrorFacts {
  pip?: string;
  uv?: string;
  npm?: string;
}

export function buildStaticBlock(osType: string, shell: string, mirrors: MirrorFacts = {}): string {
  // Z means UTC — documented here so per-message bytes stay bare.
  const parts = [`<os_type>${osType}</os_type>`, `<shell>${shell}</shell>`];
  if (mirrors.pip) parts.push(`<pip_index_url>${mirrors.pip}</pip_index_url>`);
  if (mirrors.uv) parts.push(`<uv_index_url>${mirrors.uv}</uv_index_url>`);
  if (mirrors.npm) parts.push(`<npm_registry>${mirrors.npm}</npm_registry>`);
  return `<env>${parts.join("")}</env>`;
}

export default function envInjector(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    if (event.systemPrompt.includes("<os_type>")) return;
    const [osType, shell, pip, uv, npm] = await Promise.all([
      detectOsType(),
      detectShell(),
      detectPipIndex(),
      detectUvIndex(),
      detectNpmRegistry(),
    ]);
    return {
      systemPrompt: `${event.systemPrompt}\n\n## Environment\n\n${buildStaticBlock(osType, shell, { pip, uv, npm })}\n`,
    };
  });

  pi.on("input", async (event) => {
    // Extension-authored text carries no origin time of its own.
    if (event.source === "extension") return { action: "continue" as const };
    // Already stamped, or blank: return the message untouched. Its prefix records when it
    // was written, so restamping with the delivery time would be a rewrite, not a fix.
    if (!needsTimestamp(event.text)) return { action: "continue" as const };
    return {
      action: "transform" as const,
      text: prependTimestamp(event.text),
      ...(event.images !== undefined ? { images: event.images } : {}),
    };
  });
}
