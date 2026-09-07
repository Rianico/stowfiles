import {
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
// Force-push detection covers the exact spellings plus the `=`-value forms
// (`--force-with-lease=<ref>:<expect>`) that the SDK's `hasFlag` cannot match.
// `-n`/`--dry-run` performs no push, so it is excluded rather than prompting.

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

const gitPush = matchCommand({
  program: "git",
  subcommands: ["push"],
  valueFlags: gitValueFlags,
  where: (command: SimpleCommand): boolean =>
    !command.hasFlag("--dry-run", "-n"),
  onMatch: ({ commands }: { commands: readonly SimpleCommand[] }) => {
    const forcePush: boolean = commands.some(
      (command: SimpleCommand): boolean =>
        command.hasFlag(...FORCE_FLAGS) ||
        command.args.some((arg: ShellToken): boolean =>
          FORCE_VALUE_FLAGS.some(
            (flag: string): boolean => arg.text.startsWith(flag),
          ),
        ),
    );

    return request({
      guidance: forcePush
        ? "Force push detected — review the remote, branch, and rewritten history before approving."
        : "Review the remote, branch, and any force flags before approving.",
      highlight: commands.map(
        (command: SimpleCommand) => command.span,
      ),
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
    description: "Ask before the agent pushes commits to a remote.",
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
