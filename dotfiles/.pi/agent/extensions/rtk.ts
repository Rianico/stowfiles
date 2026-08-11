// RTK Pi extension — rewrites bash commands to use rtk for token savings.
// Requires: rtk >= 0.23.0 in PATH.
//
// This is a thin delegating extension: all rewrite logic lives in `rtk rewrite`,
// which is the single source of truth (src/discover/registry.rs).
// To add or change rewrite rules, edit the Rust registry — not this file.
//
// Exit code contract for `rtk rewrite`:
//   0 + stdout  Rewrite found → mutate command
//   1           No RTK equivalent → pass through unchanged
//   3 + stdout  Rewrite (advisory) → mutate command

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { isToolCallEventType } from "@earendil-works/pi-coding-agent"

const REWRITE_TIMEOUT_MS = 2_000
const MIN_SUPPORTED_RTK_MINOR = 23

// Parse "X.Y.Z" semver, return [major, minor, patch] or null.
function parseSemver(raw: string): [number, number, number] | null {
  const m = raw.trim().match(/(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
}

// Bounded memo of `rtk rewrite` results, keyed by the raw command string.
// rtk's rewrite registry is static for a given rtk version, so a command that
// rewrote (or passed through) once will behave the same next time. This turns
// the ~10-30ms subprocess spawn per bash call into a map lookup for repeated
// commands (very common in agent loops: `git status`, `cat x`, `npm test`).
const MAX_CACHE_ENTRIES = 500
const rewriteCache = new Map<string, string | null>()

// In-flight dedupe: parallel bash calls with the same command share one rtk
// spawn instead of spawning once each.
const inFlightRewrites = new Map<string, Promise<string | null>>()

// Calls `rtk rewrite`; returns the rewritten command or null (pass through).
// null results are cached too (fail-open): a timeout/kill once on a command
// does not re-pay the subprocess latency on every later occurrence.
async function rewriteCommand(
  pi: ExtensionAPI,
  cmd: string,
  signal?: AbortSignal
): Promise<string | null> {
  const cached = rewriteCache.get(cmd)
  if (cached !== undefined) return cached

  const pending = inFlightRewrites.get(cmd)
  if (pending) return pending

  const task = (async () => {
    try {
      const result = await pi.exec("rtk", ["rewrite", cmd], {
        timeout: REWRITE_TIMEOUT_MS,
        signal,
      })
      const rewritten = (() => {
        if (result.killed) return null
        if (result.code !== 0 && result.code !== 3) return null
        return result.stdout.trim() || null
      })()
      if (rewriteCache.size >= MAX_CACHE_ENTRIES) {
        // Evict the oldest entry (Map preserves insertion order).
        const oldest = rewriteCache.keys().next().value
        if (oldest !== undefined) rewriteCache.delete(oldest)
      }
      rewriteCache.set(cmd, rewritten)
      return rewritten
    } catch {
      return null
    } finally {
      inFlightRewrites.delete(cmd)
    }
  })()
  inFlightRewrites.set(cmd, task)
  return task
}

export default async function (pi: ExtensionAPI) {
  // Probe rtk version at load time; disables extension if missing or too old.
  const ver = await pi.exec("rtk", ["--version"], { timeout: REWRITE_TIMEOUT_MS })
  if (ver.code !== 0) {
    console.warn("[rtk] rtk binary not found in PATH — extension disabled")
    return
  }

  // Warn and bail if rtk predates 0.23.0 (when `rtk rewrite` was introduced).
  const parsed = parseSemver(ver.stdout.replace(/^rtk\s+/, ""))
  if (parsed) {
    const [major, minor] = parsed
    if (major === 0 && minor < MIN_SUPPORTED_RTK_MINOR) {
      console.warn(`[rtk] rtk ${ver.stdout.trim()} is too old (need >= 0.23.0) — extension disabled`)
      return
    }
  }

  pi.on("tool_call", async (event, ctx) => {
    try {
      if (!isToolCallEventType("bash", event)) return

      const cmd = event.input.command
      if (typeof cmd !== "string" || cmd.trim() === "") return

      if (cmd.startsWith("rtk ")) return
      if (process.env.RTK_DISABLED === "1") return

      // Delegate to RTK.
      const rewritten = await rewriteCommand(pi, cmd, ctx.signal)
      if (rewritten && rewritten !== cmd) {
        event.input.command = rewritten
      }
    } catch (err) {
      // Fail open: never block execution on an unexpected error.
      console.warn("[rtk] unexpected error in tool_call handler; passing through command", err)
      return
    }
  })
}
