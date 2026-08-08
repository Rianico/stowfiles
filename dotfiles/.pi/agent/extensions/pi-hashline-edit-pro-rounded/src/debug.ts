/**
 * Debug logger — no-op unless enabled via the PI_ROUNDED_TOOLS_DEBUG
 * environment variable (path to a log file, or "1" for the default path).
 * Kept out of the hot path so a published package writes nothing by default.
 */
import { appendFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const DEFAULT_LOG_FILE = path.join(homedir(), ".pi", "agent", "pi-hashline-edit-pro-rounded-debug.log");

function resolveLogFile(): string | null {
  const env = process.env.PI_ROUNDED_TOOLS_DEBUG;
  if (!env) return null;
  return env === "1" ? DEFAULT_LOG_FILE : env;
}

export function debugLog(msg: string): void {
  const file = resolveLogFile();
  if (!file) return;
  try {
    appendFileSync(file, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    // never break pi for a debug log
  }
}
