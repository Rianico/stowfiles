# agents.md — Neovim config operating notes

## Stack (native LSP, no wrappers)

- **Install:** `mason-org/mason.nvim` + `mason-lspconfig.nvim` (v2.x) + `WhoIsSethDaniel/mason-tool-installer`
  (ensure list). `nvim-lspconfig` is a **config data source only** — no `.setup()` calls anywhere.
- **Configure:** `lsp/*.lua`, one file per server, `return { … }` (native convention).
- **Activate:** explicit `vim.lsp.enable({ … })` allowlist in `lua/lsp/mason.lua`;
  `automatic_enable = false`. Do NOT re-enable auto — it attaches junk
  (`pylsp`, …) that is installed but unwanted.
- **Format:** conform.nvim (`lua/lsp/conform.lua`). **Lint:** nvim-lint (`lua/lsp/nvim-lint.lua`).
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
  (superseded by ruff+basedpyright); `prettier` scoped to `html` only (biome owns
  JS/TS in both conform and nvim-lint `biomejs`); `biome/jq/kdlfmt/shfmt` in
  ensure even though they're formatters (conform needs them installed).
- Deleted: `markdown_oxide` (→ marksman), `slint` (server + parser + package).
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

## Layout

- `lsp/` — server configs (8 files) + `ts_ls.lua` inlay hints (dormant until `grh` toggle)
- `lua/lsp/` — `mason.lua` (install/enable/hook/LspAttach), `conform.lua`,
  `nvim-lint.lua`, `capabilities.lua`, `nvim-treesitter.lua`, `metals.lua`
- `ftplugin/` — per-filetype editor behavior (`wrap`+`spell` via `config.text`);
  orthogonal to `lsp/` (server processes). Never start LSP from ftplugin.
