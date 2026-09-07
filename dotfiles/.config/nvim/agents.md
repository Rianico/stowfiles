# agents.md — Neovim config operating notes

## Stack (native LSP, no wrappers)

- **Install:** `mason-org/mason.nvim` + `mason-lspconfig.nvim` (v2.x) + `WhoIsSethDaniel/mason-tool-installer`
  (ensure list). `nvim-lspconfig` is a **config data source only** — no `.setup()` calls anywhere.
- **Configure:** `lsp/*.lua`, one file per server, `return { … }` (native convention).
- **Activate:** explicit `vim.lsp.enable({ … })` allowlist in `lua/lsp/mason.lua`;
  `automatic_enable = false`. Do NOT re-enable auto — it attaches junk
  (`pylsp`, …) that is installed but unwanted.
- **Format:** conform.nvim (`lua/lsp/conform.lua`) — `oxfmt` for JS/TS/JSX/TSX/JSON/JSONC/HTML/CSS/YAML. **Lint:** nvim-lint (`lua/lsp/nvim-lint.lua`) — `oxlint` for JS/TS/JSX/TSX.
  No null-ls. Formatting policy: conform first, `lsp_format = "fallback"`.
- **Capabilities:** shared module `lua/lsp/capabilities.lua` (blink.cmp > nvim-cmp > stock),
  applied via `vim.lsp.config("*", …)` wildcard.
- Per-server runtime tweaks go in ONE `LspAttach` handler in `lua/lsp/mason.lua`
  (never `on_attach` in server tables).

## Precedence rules (verified against nvim 0.12 source + black-box tests)

1. `*` wildcard < `lsp/*.lua` rtp files < explicit `vim.lsp.config(name, cfg)` calls.
2. **Rtp files merge plugin-last**: nvim-lspconfig's base BEATS our `lsp/*.lua` on
   conflicting leaves. `lsp/*.lua` can only *add*.
3. Lists **replace wholesale** (no index merge). Our shorter/longer `filetypes`
   lose to the plugin base.
4. Consequence: anything overriding a plugin default lives in the documented
   "exception" block in `lua/lsp/mason.lua` (currently: basedpyright
   `diagnosticMode`, gopls/bashls/marksman `filetypes`). Keep `lsp/*.lua` + the
   block in sync — they intentionally overlap there.

## Gotchas (all hit before, don't re-learn)

- **Server name must match nvim-lspconfig's filename**: `harper_ls` (underscore).
  A hyphenated `harper-ls` resolves nothing → `cmd: expected …, got nil`, server
  silently never starts. Check `:checkhealth vim.lsp` + `lsp.log` after renames.
- **markdownlint-cli2 v0.23 ignores `--config`** when the file is literally named
  `.markdownlint-cli2.jsonc` (a discovery name). Shared base is therefore
  `~/markdownlint-cli2.base.jsonc` (stowed from `dotfiles/`), wired explicitly
  because nvim-lint pipes stdin with nvim's cwd (tree discovery unreliable).
  Per-project configs layer on top. `<leader>mF` runs `--fix` (needs file path).
- **Mason can't inject pip plugins into its venvs.** `mdformat-obsidian` is ensured
  in code: `MasonToolsUpdateCompleted` hook in `lua/lsp/mason.lua` pip-installs
  missing entries of `mdformat_plugins` into `mason/packages/mdformat/venv`.
  Mason's mdformat is otherwise bare CommonMark (no GFM/frontmatter).
- **mdx_analyzer needs more than config**: `.mdx` filetype doesn't exist upstream —
  mapped in `init.lua` via `vim.filetype.add` (also `gotmpl`); server needs a
  `package.json` root AND a TS **5.x** SDK in the project (TS 7 dropped
  `tsserverlibrary.js` → initialize fails).
- **Exclusions are deliberate**: no `isort/yapf/pyflakes/python-lsp-server/mypy`
  (superseded by ruff+basedpyright); no `biome`/`prettier` (superseded by
  `oxfmt`/`oxlint` for JS/TS/JSON/HTML/CSS/YAML); `oxlint/oxfmt/jq/kdlfmt/shfmt` in
  ensure even though `oxfmt`/`jq`/`kdlfmt`/`shfmt` are formatters (conform needs them installed).
- Deleted: `markdown_oxide` (→ marksman), `slint` (server + parser + package), `biome`/`prettier` (→ `oxfmt`/`oxlint`).
- `lazy-lock.json` pins versions — changing a spec's repo/version does NOTHING
  until `:Lazy! update <name>` (lockfile wins). Back it up before major bumps.

## Verify (headless, from `~/.config/nvim`)

```sh
luac -p lua/lsp/mason.lua lsp/*.lua
# settings parity (getter is vim.lsp.config['name'], NOT vim.lsp.config('name'))
nvim --headless -c "lua assert(vim.lsp.config['gopls'].settings.gopls.gofumpt == true)" -c "qa!"
# allowlist intact
nvim --headless -c "lua assert(not vim.lsp.is_enabled('pylsp'))" -c "qa!"
nvim --headless +"checkhealth vim.lsp" +"w! /tmp/health.txt" +"qa!"
# live attach needs event processing: vim.wait, NOT :sleep
```

## Layout / Code Structure (stable — update only when adding/removing top-level entries)

```
.  (~/.config/nvim — dotfiles/stowfiles/dotfiles/.config/nvim)
├── init.lua                 — entry: config.lazy → basic → filetype.add → keybindings → lsp.* → config.*
├── lsp/                     — native LSP configs (return {…}), one file per server (nvim 0.12 `lsp/*.lua`)
│   ├── basedpyright.lua, ruff.lua, bashls.lua, gopls.lua
│   ├── lua_ls.lua, harper_ls.lua, marksman.lua
│   └── ts_ls.lua            — inlayHints only (dormant until `grh` toggle)
├── lua/
│   ├── basic.lua            — options, diagnostics, globals, folds (ufo), loader
│   ├── keybindings.lua      — which-key, diagnostics/nav, git/file ops
│   ├── config/              — lazy.lua (bootstrap + spec import), mini.lua, harpoon2.lua, marks.lua, text.lua
│   ├── lsp/                 — orchestration (NOT server configs)
│   │   ├── mason.lua        — mason + mason-lspconfig + mason-tool-installer ensure list, vim.lsp.enable allowlist, LspAttach tweaks, mdformat venv hook
│   │   ├── conform.lua      — conform.nvim formatters_by_ft + format_on_save + stylua/rustfmt/taplo opts (oxfmt for frontend)
│   │   ├── nvim-lint.lua    — nvim-lint linters_by_ft + autocmd + markdownlint --config wiring (oxlint for frontend)
│   │   ├── capabilities.lua — shared blink.cmp → cmp_nvim_lsp → stock, via vim.lsp.config("*",…)
│   │   ├── nvim-treesitter.lua — parser install + highlight/indent enable
│   │   ├── metals.lua       — nvim-metals (Scala, standalone)
│   │   └── lspsaga.lua      — lspsaga UI
│   ├── plugins/             — lazy specs (import = "plugins"): avante, blink, dap-core, git-stuff, primary, rustaceanvim, snacks, theme
│   └── util/                — cmp.lua, ui.lua, init.lua (helpers for LazyVim/base46)
├── ftplugin/                — per-filetype editor behavior only (wrap+spell via config.text)
│   │                          orthogonal to lsp/ (server processes); never start LSP from ftplugin
│   ├── markdown.lua, text.lua, gitcommit.lua, typst.lua, plaintex.lua, scala.lua, sbt.lua
├── .luarc.json              — shared Lua settings (Lua.*), mirrors lsp/lua_ls.lua library; project .pi-lens/lsp.json sets warmFiles
├── lua/.luarc.json          — duplicate for lua/ subdir tooling
├── lazy-lock.json           — pinned plugin versions (lockfile wins over spec)
├── .pi-lens/lsp.json        — warmFiles: ["init.lua"]
└── ~                        — stow artifact, ignore
```

- `lsp/*.lua` are **config data only** (no `setup()`); activation is the allowlist in `lua/lsp/mason.lua`.
- `lua/lsp/` is **orchestration**; `lsp/` is **per-server config** — keep exception overrides (basedpyright diagnosticMode, gopls/bashls/marksman filetypes) in the documented block in `mason.lua` (rtp merge plugin-last, see Precedence rules).
- `ftplugin/` never starts LSP; formatting/linting lives in `lua/lsp/conform.lua` + `lua/lsp/nvim-lint.lua`.
- Adding a new language: `lsp/<server>.lua` + ensure entry + filetype + treesitter parser + enable in `mason.lua` allowlist.
## pi-lens alignment

- Global `~/.pi-lens/lsp.json` routes pi-lens through Mason binaries
  (`*-mason` servers, built-ins disabled). Don't duplicate it per-project.
- `.luarc.json` is the shared Lua settings file: `Lua.`-prefixed keys, mirrors
  `lsp/lua_ls.lua` (which additionally sets the nvim runtime `library`).
  A bare `diagnostics.globals` (no `Lua.` prefix) is silently ignored.
- Project `.pi-lens/lsp.json` sets only `warmFiles: ["init.lua"]`.
