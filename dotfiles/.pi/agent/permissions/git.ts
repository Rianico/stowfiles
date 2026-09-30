import {
  block,
  gitValueFlags,
  matchCommand,
  matchTool,
  request,
} from "@rianico/pi-permission-lsz";
import type {
  PermissionInput,
  PermissionsAPI,
  ShellToken,
  SimpleCommand,
} from "@rianico/pi-permission-lsz";

// ---------------------------------------------------------------------------
// Gate: git push
// ---------------------------------------------------------------------------
//
// Branch-deletion pushes are closed (blocked): `--delete`/`-d` or a
// `:branch` refspec is destructive and never agent-approved.
// New-branch publishes are open (allowed): `-u`/`--set-upstream` creates
// a remote branch without rewriting existing history.
// Force-push detection covers the exact spellings plus the `=`-value forms
// (`--force-with-lease=<ref>:<expect>`) that the SDK's `hasFlag` cannot match.
// `-n`/`--dry-run` performs no push, so the `where` clause excludes it.

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
const DELETE_FLAGS = ["--delete", "-d"] as const;

const CREATE_FLAGS = ["-u", "--set-upstream"] as const;

const CREATE_VALUE_FLAGS = ["--set-upstream="] as const;

const gitPush = matchCommand({
  program: "git",
  subcommands: ["push"],
  valueFlags: gitValueFlags,
  where: (command: SimpleCommand): boolean =>
    !command.hasFlag("--dry-run", "-n"),
  onMatch: ({ commands }: { commands: readonly SimpleCommand[] }) => {
    const highlight = commands.map(
      (command: SimpleCommand) => command.span,
    );

    // Close: branch deletion is destructive and never agent-approved.
    const deletesBranch: boolean = commands.some(
      (command: SimpleCommand): boolean =>
        command.hasFlag(...DELETE_FLAGS) ||
        command.args.some((arg: ShellToken): boolean =>
          arg.text.startsWith(":"),
        ),
    );
    if (deletesBranch) {
      return block(
        "Branch-deletion push detected — deleting a remote branch is destructive. Delete the branch manually if this is intended.",
      );
    }

    const forcePush: boolean = commands.some(
      (command: SimpleCommand): boolean =>
        command.hasFlag(...FORCE_FLAGS) ||
        command.args.some((arg: ShellToken): boolean =>
          FORCE_VALUE_FLAGS.some(
            (flag: string): boolean => arg.text.startsWith(flag),
          ),
        ),
    );
    if (forcePush) {
      return request({
        guidance:
          "Force push detected — review the remote, branch, and rewritten history before approving.",
        highlight,
        approveLabel: "Push",
        rejectLabel: "Cancel push",
      });
    }

    // Open: new-branch publish flow — creating a remote branch does not
    // rewrite existing history.
    const createsBranch: boolean = commands.some(
      (command: SimpleCommand): boolean =>
        command.hasFlag(...CREATE_FLAGS) ||
        command.args.some((arg: ShellToken): boolean =>
          CREATE_VALUE_FLAGS.some(
            (flag: string): boolean => arg.text.startsWith(flag),
          ),
        ),
    );
    if (createsBranch) {
      return undefined;
    }

    return request({
      guidance: "Review the remote, branch, and any force flags before approving.",
      highlight,
      approveLabel: "Push",
      rejectLabel: "Cancel push",
    });
  },
});

// ---------------------------------------------------------------------------
// Gate: git reset --hard
// ---------------------------------------------------------------------------
//
// `--hard` discards uncommitted changes and moves HEAD, so it is gated.
// Variants without `--hard` (`--soft`, `--mixed`, `--keep`, or no mode flag)
// remain ungated — they do not discard tracked work in the same way.

const gitResetHard = matchCommand({
  program: "git",
  subcommands: ["reset"],
  valueFlags: gitValueFlags,
  where: (command: SimpleCommand): boolean => command.hasFlag("--hard"),
  onMatch: ({ commands }: { commands: readonly SimpleCommand[] }) =>
    request({
      guidance:
        "Hard reset discards uncommitted changes and moves HEAD — verify the target commit/branch and that no work will be lost before approving.",
      highlight: commands.map(
        (command: SimpleCommand) => command.span,
      ),
      approveLabel: "Reset",
      rejectLabel: "Cancel reset",
    }),
});

// ---------------------------------------------------------------------------
// Registration — add further git gates below (rebase, …)
// ---------------------------------------------------------------------------

export default function permissions(api: PermissionsAPI): void {
  api.onToolUse({
    name: "git push",
    description:
      "Gate pushes: block branch deletion, allow new-branch (-u) publishes, ask otherwise.",
    handler(input: PermissionInput) {
      return matchTool(input.tool, { bash: gitPush });
    },
  });

  api.onToolUse({
    name: "git reset --hard",
    description: "Ask before a hard reset that discards uncommitted changes.",
    handler(input: PermissionInput) {
      return matchTool(input.tool, { bash: gitResetHard });
    },
  });
}
