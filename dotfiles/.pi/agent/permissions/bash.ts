import {
  matchCommand,
  matchTool,
  request,
  type PermissionsAPI,
} from "@rianico/pi-permission-lsz";

// ---------------------------------------------------------------------------
// Gate: rm
// ---------------------------------------------------------------------------
//
// Boundary: only recursive deletion is gated (`-r`/`-R`/`--recursive`, including
// combined shorts such as `-rf`). Plain `rm file` and non-recursive `rm -f file`
// stay ungated — routine single-file cleanup. Widen later by dropping the
// `where` predicate if every `rm` should prompt.

const RM_FORCE_FLAGS = ["-f", "--force"];

const rm = matchCommand({
  program: "rm",
  where: (command) => command.hasFlag("-r", "-R", "--recursive"),
  onMatch: ({ commands }) => {
    const forced = commands.some((command) => command.hasFlag(...RM_FORCE_FLAGS));

    return request({
      guidance: forced
        ? "Recursive forced deletion — verify the paths before approving."
        : "Recursive deletion — verify the paths and that nothing valuable is included.",
      highlight: commands.map((command) => command.span),
      approveLabel: "Delete",
      rejectLabel: "Cancel",
    });
  },
});

// ---------------------------------------------------------------------------
// Registration — add further basic-command gates below (mv/cp overwrite,
// chmod -R, dd, …)
// ---------------------------------------------------------------------------

export default function permissions(api: PermissionsAPI) {
  api.onToolUse({
    name: "rm",
    description: "Ask before recursive deletion.",
    handler(input) {
      return matchTool(input.tool, { bash: rm });
    },
  });
}
