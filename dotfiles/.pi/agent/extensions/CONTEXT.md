# Context — pi extensions

Glossary for the pi agent extensions in this directory. Definitions only; implementation lives in code.

## Environment Injector

**Environment Block** —
The `<env>` facts injected into the system prompt exactly once per session. Everything in it is cache-stable: it does not change between turns.

**Static/Dynamic Split** —
The rule that per-turn-changing facts (e.g. current UTC time) never enter the Environment Block; they are attached to user messages instead, because user messages are not prefix-cached.

**Message Time Prefix** —
The `[<ISO-UTC instant>]` line the injector writes above a fresh user message, recording when it was written. A message that already carries one is returned byte-identical: the prefix is origin time, so it is never restamped with the delivery time.

**Machine Fact** —
A property of this workstation that an agent cannot infer from its training data or the conversation (OS, shell, package indexing endpoints). Machine Facts belong in the Environment Block.

**Package Index** —
The endpoint a package manager resolves packages from. Tool-specific naming: pip/uv call it the *index-url*, npm calls it the *registry*. One Package Index per tool; tools sharing a URL are still reported separately (each tool reads its own configuration).

**Upstream Default** —
A Package Index pointing at the tool's official public server (`pypi.org` for Python, `registry.npmjs.org` for npm), compared by hostname only.

**Mirror Field** —
A Package Index in the Environment Block that resolves to something *other than* the Upstream Default. Presence of a Mirror Field means "installs from this tool go somewhere special"; absence means the tool is on the stock internet (or could not be determined).

**Convention-Delegated Detection** —
Resolving a tool's effective Package Index by asking the tool itself (`npm config get registry`, `pip config get global.index-url`), so scope-merging and precedence rules are the tool's, not ours.

**Best-Effort Detection** —
Resolution used only for tools with no self-query command (uv): env vars first, then documented config-file parsing. May drift from the tool's real precedence; is never claimed as authoritative.

**Sanitized Index** —
A Package Index URL after stripping userinfo (`user:token@`) and query strings, so no credential can reach the prompt even when embedded in an env-var override.

## Rules Injector

**User Rules Section** —
The `user-rules` system-prompt section owned by the rules injector. It carries the unscoped rules only: markdown files whose frontmatter names no paths, read from the global rules directory and the project's rules directory. No other injector may claim this key.

**Scoped Rule** —
A rule whose frontmatter names paths. It is absent from the User Rules Section; it arrives once, as a hidden mid-conversation message, when a touched path matches — so the model sees it in the same run while the terminal shows only the load warning.

**Rules Cache** —
The per-project checksum record that gates re-scans: unchanged rule files cost no re-read, and the record survives compaction with the in-memory state.

The npm package `pi-better-rules` is retired; `rules-injector.ts` in this directory is its home, so a session with no `<user-rules>` block means this extension failed to load — not that the package should be reinstalled.
