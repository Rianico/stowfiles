import { realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import {
  block,
  matchTool,
  parseShellCommand,
  type PermissionsAPI,
  type SimpleCommand,
} from "@rianico/pi-permission-lsz";

// ---------------------------------------------------------------------------
// Gate: rm
// ---------------------------------------------------------------------------
//
// Boundary: a removal is allowed when every target resolves inside the current
// workspace, or was created during this session. Everything else is blocked —
// recursive or not, forced or not — and the Approver can still delete those
// files by hand.
//
// "Created this session" is judged on the filesystem clock: the module loads
// once per session, so anything older than `SESSION_START` predates it. A
// target created at or after that instant is agent scratch (a temp file, a
// downloaded fixture), and deleting it loses nothing. A target that does not
// exist is also allowed through: `rm -rf missing` removes nothing.
//
// Paths are resolved physically (symlinks followed), matching the workspace
// boundary in paths.ts, so `rm -rf ./link` where `link` escapes the workspace
// still blocks. `cd` is tracked across the command chain, so
// `cd /tmp && rm -rf build` judges `build` against /tmp, not the workspace.

const SESSION_START = Date.now();

// Clock skew guard: a file written by the process that started this session may
// land a few milliseconds before module load.
const SESSION_SKEW_MS = 1_000;

const RM_VALUE_FLAGS: readonly string[] = [];

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path; // ~user/... — cannot resolve; treated as an unknown target
}

/**
 * Resolve `path` to its physical location, following symlinks. When the path
 * itself does not exist (e.g. a file about to be created), the nearest existing
 * ancestor is resolved and the missing tail is reattached.
 */
function realTarget(path: string): string | undefined {
  let current = path;
  const tail: string[] = [];
  for (;;) {
    try {
      return join(realpathSync(current), ...tail);
    } catch {
      const parent = dirname(current);
      if (parent === current) return undefined; // hit the root without resolving
      tail.unshift(basename(current));
      current = parent;
    }
  }
}


/** True when absolute `path` lies outside absolute `base`. */
function isOutside(base: string, path: string): boolean {
  const rel = relative(base, path);
  return rel !== "" && (rel.startsWith("..") || isAbsolute(rel));
}

function absoluteTarget(text: string, cwd: string): string | undefined {
  const expanded = expandHome(text);
  if (expanded.startsWith("~")) return undefined; // ~user/... is unresolvable
  return isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
}

function createdThisSession(path: string): boolean {
  let created: number;
  try {
    const stats = statSync(path);
    // Platforms without a creation time report birthtimeMs as 0; fall back to
    // the modification time, which for an untouched file equals its creation.
    created = stats.birthtimeMs > 0 ? stats.birthtimeMs : stats.mtimeMs;
  } catch {
    return true; // nothing to delete
  }
  return created >= SESSION_START - SESSION_SKEW_MS;
}

/** Directories changed by a `cd` in the chain, in source order. */
function orderedCommands(commands: readonly SimpleCommand[]): SimpleCommand[] {
  return [...commands].sort((a, b) => a.span.start - b.span.start);
}

function cwdAfter(command: SimpleCommand, cwd: string): string {
  if (command.programName !== "cd") return cwd;
  const [target] = command.positionals();
  if (!target) return cwd;
  const expanded = expandHome(target.text);
  if (expanded.startsWith("~")) return cwd;
  return isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
}

/** Every `rm` target that the boundary does not allow. */
function removalVerdict(
  commands: readonly SimpleCommand[],
  cwd: string,
): string[] {
  const realCwd = realTarget(resolve(cwd)) ?? resolve(cwd);
  const offenders: string[] = [];
  let currentCwd = resolve(cwd);

  for (const command of orderedCommands(commands)) {
    if (command.programName === "rm") {
      for (const target of command.positionals({
        valueFlags: RM_VALUE_FLAGS,
      })) {
        const absolute = absoluteTarget(target.text, currentCwd);
        if (absolute === undefined) {
          offenders.push(target.text); // unresolvable `~user/...`: assume outside
          continue;
        }
        const real = realTarget(absolute) ?? absolute;
        if (!isOutside(realCwd, real)) continue;
        if (createdThisSession(real)) continue;
        offenders.push(target.text);
      }
    }
    currentCwd = cwdAfter(command, currentCwd);
  }

  return offenders;
}

function removalBlock(offenders: readonly string[], cwd: string) {
  const plural = offenders.length === 1 ? "target is" : "targets are";
  return block(
    `Removal blocked: ${offenders.join(", ")} — the ${plural} outside the workspace (${cwd}) and not created in this session. ` +
      "Delete only workspace files or files this session created; ask the Approver to remove anything else.",
  );
}

// ---------------------------------------------------------------------------
// Registration — add further basic-command gates below (mv/cp overwrite,
// chmod -R, dd, …)
// ---------------------------------------------------------------------------

export default function permissions(api: PermissionsAPI) {
  api.onToolUse({
    name: "rm",
    description:
      "Block removals outside the workspace unless the target was created in this session.",
    async handler(input) {
      return matchTool(input.tool, {
        async bash(tool) {
          const parsed = await parseShellCommand(tool.command);
          const removals = parsed.commands.some(
            (command) => command.programName === "rm",
          );
          if (!removals) return undefined;

          const offenders = removalVerdict(parsed.commands, input.cwd);
          if (offenders.length === 0) return undefined;
          return removalBlock(offenders, input.cwd);
        },
      });
    },
  });
}
