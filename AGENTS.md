### Contribution

Conventional commits & changelog: see CONTRIBUTING.md
Git hooks: `git config core.hooksPath .githooks` (husky already delegates from `.husky/pre-push`) so the pre-push CHANGELOG guard is live on fresh clone/worktree.

### Pi extensions — prompt-surface contract

Applies to `dotfiles/.pi/agent/extensions/*.ts`. pi loads every `.ts` in that directory as an extension and caches module scope for the process lifetime (per-process state outlives a session).

**Inject prompt state through `systemPromptOptions`, never a returned `systemPrompt`.**

- `before_agent_start` receives a mutable `systemPromptOptions`; mutate `skills` / `sections` and return nothing.
- Returning `{systemPrompt}` sets `forceSystemPrompt`: the whole prompt is forced (no per-section diff), and the export's System-Prompt block keeps the structured transcript copy instead of your text.
- The hook runs once per user message, so memoize filesystem reads (mtime + size) and keep list pushes idempotent by name.

**Do not emit transcript entries for injected content.**

- A `custom_message` entry duplicates what the native surfaces already render; `display: false` only silences the TUI chat, leaving it behind the export's default-off "Show hidden messages" toggle, and plain `custom` / `pi.appendEntry` render nowhere at all.
- Export visibility for injected content is the System-Prompt block, which renders `systemPromptOptions.skills` and `.sections` verbatim.

**Sections** (`sections: Record<string, string>`)

- Name must match `^[a-z][a-z0-9_-]*$`; `preamble` is reserved, and any illegal name throws so the send aborts. Avoid shadowing `skills`, `cwd`, `tools`, `rules`, `docs`, `project_context`, `addendum`.
- Rendered as `<name>…</name>` immediately after native `<cwd>` in insertion order; empty values are skipped. Escape interpolated values yourself.

**Skills** (push onto `systemPromptOptions.skills`)

- The renderer emits only `name` / `description` / `location`; any extra field is silently dropped. Set `disableModelInvocation: false` or pi filters the entry back out. The section appears only when `read` or `bash` is an active tool.
- pi's skill-name rule is `^[a-z0-9-]+$`, max 64 chars. `parent/leaf` names are render-only and are never resolved by name lookup.
- Parse leaf frontmatter with pi's exported `parseFrontmatter` (BOM/CRLF/YAML-correct) — do not hand-roll one.

**The `input` hook runs before pi expands `/skill:<name>` and `/template`.**

- Never rewrite a leading `/`, or the command reaches the model as literal text. The UTC stamp is `[<ISO-8601 Z>]\n`, restamped on resend rather than accumulated.

**Verification**

- `$PI_DIST`: `find -L "${PNPM_HOME:-$HOME/Library/pnpm}/global" -type d -path '*/node_modules/@earendil-works/pi-coding-agent/dist' | head -1`.
- The `tsc` name may be intercepted (it can report success unconditionally): install a real TypeScript, symlink `@earendil-works/pi-coding-agent`, `@earendil-works/pi-agent-core` and `@types/node` into a scratch project with `strict` + `noUncheckedIndexedAccess` and `module: nodenext`, then run `node node_modules/typescript/bin/tsc -p .`.
- Behaviour: drive the handlers with a `node --experimental-strip-types` harness that loads the extension from a directory where `@earendil-works/pi-coding-agent` resolves, and assert against pi internals (`$PI_DIST/core/system-prompt.js`, `core/skills.js`, `core/export-html/`) so a pi upgrade that breaks an assumption fails the run.

Working examples: `skill-router-injector.ts` (projects subskill leaves onto the native skills list) and `env-injector.ts` (flat `os_type`/`shell` sections + UTC stamp).
