# AGENTS.md — pi-hashline-edit-pro-rounded

Project instructions for AI agents working on this repository. Pi loads this
file automatically at startup (`/reload` after changing it).

## What this project is

A Pi extension that renders rounded-corner frames (`╭ ╮ ╰ ╯ ─ │`) around tool
call/result blocks, and **embeds [pi-hashline-edit-pro](https://github.com/YuGiMob/pi-hashline-edit-pro)
as a dependency** so its tools (`read`, `replace`, `undo_last_replace`) get
frames too — without forking hashline.

### Architecture (read this before touching code)

- `index.ts` — entry. At **load time** it dynamically imports hashline and runs
  `wrapHashlineTools` (see below); at `session_start` it wraps the seven
  built-ins and skips names owned by other extensions.
- `src/hashline.ts` — **the embedding mechanism**: a `Proxy` around the real
  `ExtensionAPI` intercepts `pi.registerTool` while hashline's factory runs.
  Every tool hashline registers is **captured automatically**, wrapped with
  `wrapTool`, and re-registered under the same name (within one extension the
  last registration per name wins → the wrapped version is what Pi resolves).
  Tools hashline defines *without* renderers get fallback inners
  (`ensureInnerRenderers`); tools with renderers (`replace`) keep their own.
- `src/frame.ts` — `RoundedFrame`, `wrapTool`, border colors, built-in tool
  factories.
- `src/config.ts` — `RoundedToolsConfig`, defaults, `PI_ROUNDED_TOOLS` env
  parsing.
- `src/debug.ts` — opt-in logger; enable with `PI_ROUNDED_TOOLS_DEBUG=1`.

Because capture is driven by hashline's own `registerTool` calls, **any tool
hashline adds in a future release is wrapped automatically** — but it must be
*verified* (checklist below).

## ⚠️ Cardinal rule: read hashline's changes BEFORE upgrading

**Never bump `pi-hashline-edit-pro` without first reading what changed.**
Hashline has **no CHANGELOG file, no GitHub releases, and no tags**, so you
must reconstruct the change log from these sources, in order:

1. **Release history (npm):**
   ```bash
   npm view pi-hashline-edit-pro versions time --json --registry=https://registry.npmjs.org
   npm view pi-hashline-edit-pro@<new> --registry=https://registry.npmjs.org
   ```
2. **Commit history (GitHub):**
   ```bash
   curl -s "https://api.github.com/repos/YuGiMob/pi-hashline-edit-pro/commits?per_page=30" \
     | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{for(const c of JSON.parse(d))console.log(c.sha.slice(0,8), c.commit.author.date, c.commit.message.split('\n')[0])})"
   ```
3. **Upstream README** — `https://github.com/YuGiMob/pi-hashline-edit-pro` —
   and the prompts under `node_modules/pi-hashline-edit-pro/prompts/` (they
   change behavior).
4. **Diff the installed package** against the previous version (the version
   bump in `package.json`/`package-lock.json` tells you the old one).

## Upgrade procedure (pi-hashline-edit-pro)

1. **Read the change sources above.** Summarize what changed: new tools? changed
   tool names? changed execute/result shapes? new renderers? new prompts?
2. Bump the dependency:
   ```bash
   cd ~/.pi/agent/extensions/pi-hashline-edit-pro-rounded
   npm install pi-hashline-edit-pro@^<new> --registry=https://registry.npmjs.org
   ```
3. **Update the tests that enumerate hashline tools** — `test/hashline.test.ts`
   (fake main), `test/real-hashline.test.ts` (real package), and
   `test/index-embed.test.ts` (`HASHLINE_NAMES`). Add any new tool names.
4. Run the suite:
   ```bash
   npm test && npm run typecheck && npm run test:coverage
   ```
5. **Verify every hashline tool is wrapped and registered in Pi** (the core
   requirement — see next section). Do this before merging/committing.

## Verification checklist: every hashline tool wrapped + registered

After any hashline upgrade, confirm ALL of these:

- [ ] **Captured & wrapped** — enable the debug log
      (`PI_ROUNDED_TOOLS_DEBUG=1 pi`, then `/reload`) and check the line:
      `embedded pi-hashline-edit-pro; wrapped tools: [...]` — it must list
      **every** tool hashline registers (read, replace, undo_last_replace, and
      any new ones). The proxy captures automatically, so a missing name means
      hashline registers it outside `pi.registerTool` — investigate.
- [ ] **Ownership** — the `getAllTools` snapshot in the debug log at
      `session_start` must show each hashline tool owned by rounded-tools
      (`"auto"`), not `npm:pi-hashline-edit-pro` and not `builtin`.
- [ ] **Active in Pi** — after `/reload`, the tool is callable. Check
      `pi.getActiveTools()` (debug log prints it at session_start). If a *new*
      hashline tool is registered but not active, add it to the active set —
      see the `newlyActive` logic in `index.ts` and consider registering it
      explicitly in `session_start`.
- [ ] **Renderers** — wrapped defs have `renderShell: "self"` and functional
      `renderCall`/`renderResult`. Tools without their own renderers rely on
      `ensureInnerRenderers` fallbacks (bold name call + plain text result) —
      `test/hashline.test.ts` covers this; extend it if a new tool needs a
      different fallback.
- [ ] **Standalone-conflict warning** — `index.ts` hardcodes
      `["read", "replace", "undo_last_replace"]` for the "remove the standalone
      extension" warning. If hashline adds tools, update that list.
- [ ] **Real render smoke test** — run pi with the debug log and perform a
      `read` + `replace` + `undo_last_replace`; the log must show
      `render call/result name=<tool>` for each, and the TUI must show frames.
- [ ] **Regression suite green** — `npm test`, `npm run typecheck`,
      `npm run test:coverage` (thresholds: ≥80% statements, ≥70% branches).

## Releasing (new version of THIS package)

1. Update `README.md` if behavior changed; keep the overview style and the
   Acknowledgments section at the top (it must stay — required).
2. Bump `version` in `package.json` (patch for README/metadata, minor for
   features, major for breaking).
3. Commit and push:
   ```bash
   git add -A && git commit -m "<version>: <summary>" && git push origin main
   ```
4. Publish to the official npm registry **with the registry override** (local
   npm config points at npmmirror; do not publish there):
   ```bash
   npm publish --registry=https://registry.npmjs.org
   # 2FA code will be prompted — the account is "rianico"
   ```
5. pi.dev/packages indexes automatically (no submission needed); verify at
   `https://pi.dev/packages/pi-hashline-edit-pro-rounded` after a few minutes.
   The npm *search* index lags (hours) — that's expected, installs work
   immediately.

## Pitfalls

- Do **not** `npm publish` without `--registry=https://registry.npmjs.org` —
  `~/.npmrc` points npm at npmmirror.com, a one-way mirror; publishing there
  would not reach npmjs.org.
- Do **not** rename `PI_ROUNDED_TOOLS` (config compat) or drop the `hashline`
  config flag.
- `pi-hashline-edit-pro` is bundled (`bundledDependencies`) — when it gains
  dependencies, keep them out of `devDependencies`; they must be installable
  by consumers.
- The extension factory is async (`await import` of hashline) — tests call it
  without awaiting; keep the `hashline: false` opt-out in test env configs so
  the mock tests stay deterministic.
