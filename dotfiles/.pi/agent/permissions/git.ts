import {
  block,
  gitValueFlags,
  matchCommand,
  matchTool,
  type PermissionsAPI,
  type SimpleCommand,
} from "@rianico/pi-permission-lsz";

// ---------------------------------------------------------------------------
// Gates: operations that destroy remote branches or local work
// ---------------------------------------------------------------------------
//
// Only irreversible destruction is blocked; ordinary work stays open:
//
// - `git push` that deletes (`--delete`, `-d`, a `:branch` refspec), prunes
//   (`--prune`), mirrors (`--mirror`), or rewrites (`-f`, `--force`,
//   `--force-with-lease`, `--force-if-includes`, a `+refspec`) remote history
//   is blocked: the Approver deletes or rewrites the branch by hand.
// - `git reset --hard` is blocked: it discards uncommitted changes and moves
//   HEAD. `--soft`, `--mixed`, and `--keep` stay open.
// - Every other push (plain, `-u`/`--set-upstream`, `--dry-run`) is open.
//
// Deletion is spelled three ways (`--delete`, `-d`, `:refspec`) and rewriting
// four (`-f`, `--force`, `--force-with-lease[=…]`, `--force-if-includes`, and
// a `+refspec`); `hasFlag` alone cannot see the `=` value forms or the
// refspec, so those are checked on the argument text.

const DELETE_FLAGS = ["--delete", "-d"] as const;
const MIRROR_FLAGS = ["--mirror"] as const;
const PRUNE_FLAGS = ["--prune"] as const;
const FORCE_FLAGS = [
  "-f",
  "--force",
  "--force-with-lease",
  "--force-if-includes",
] as const;
const FORCE_VALUE_FLAGS = [
  "--force-with-lease=",
  "--force-if-includes=",
] as const;

/** Refspecs after the remote: `push` is positional 0, the remote is 1. */
function pushRefspecs(command: SimpleCommand): readonly string[] {
  return command
    .positionals({ valueFlags: gitValueFlags })
    .slice(2)
    .map((token) => token.text);
}

function isForcePush(
  command: SimpleCommand,
  refspecs: readonly string[],
): boolean {
  return (
    command.hasFlag(...FORCE_FLAGS) ||
    command.args.some((arg) =>
      FORCE_VALUE_FLAGS.some((flag) => arg.text.startsWith(flag)),
    ) ||
    refspecs.some((refspec) => refspec.startsWith("+"))
  );
}

function isDeletePush(
  command: SimpleCommand,
  refspecs: readonly string[],
): boolean {
  return (
    command.hasFlag(...DELETE_FLAGS) ||
    refspecs.some((refspec) => refspec.startsWith(":"))
  );
}

const REASON_DELETE =
  "Branch-deletion push blocked: deleting a remote branch cannot be undone. " +
  "Delete the branch with the Approver if this is intended.";
const REASON_MIRROR =
  "Mirror push blocked: --mirror overwrites and deletes every remote ref. " +
  "Push the branch you mean instead, or let the Approver run this.";
const REASON_PRUNE =
  "Pruning push blocked: --prune deletes remote branches that no longer exist locally. " +
  "Delete the named branch explicitly, or let the Approver run this.";
const REASON_FORCE =
  "Force push blocked: it rewrites published history. " +
  "Rebase locally and push a fast-forward, or let the Approver run this.";
const REASON_RESET =
  "Hard reset blocked: it discards uncommitted changes and moves HEAD. " +
  "Commit or stash the work first, or let the Approver run this.";

const gitPush = matchCommand({
  program: "git",
  subcommands: ["push"],
  valueFlags: gitValueFlags,
  // `-n` / `--dry-run` performs no push, so it decides nothing either way.
  where: (command) => !command.hasFlag("--dry-run", "-n"),
  onMatch: ({ commands }) => {
    for (const command of commands) {
      const refspecs = pushRefspecs(command);
      if (command.hasFlag(...MIRROR_FLAGS)) return block(REASON_MIRROR);
      if (
        command.hasFlag(...PRUNE_FLAGS) ||
        command.args.some((arg) => arg.text.startsWith("--prune="))
      )
        return block(REASON_PRUNE);
      if (isDeletePush(command, refspecs)) return block(REASON_DELETE);
      if (isForcePush(command, refspecs)) return block(REASON_FORCE);
    }
    return undefined;
  },
});

const gitResetHard = matchCommand({
  program: "git",
  subcommands: ["reset"],
  valueFlags: gitValueFlags,
  where: (command) => command.hasFlag("--hard"),
  onMatch: () => block(REASON_RESET),
});

// ---------------------------------------------------------------------------
// Registration — add further git gates below (clean -fdx, filter-repo, …)
// ---------------------------------------------------------------------------

export default function permissions(api: PermissionsAPI): void {
  api.onToolUse({
    name: "git push",
    description:
      "Block pushes that delete, prune, mirror, or force-rewrite remote history.",
    handler(input) {
      return matchTool(input.tool, { bash: gitPush });
    },
  });

  api.onToolUse({
    name: "git reset --hard",
    description: "Block a hard reset that discards uncommitted changes.",
    handler(input) {
      return matchTool(input.tool, { bash: gitResetHard });
    },
  });
}
