-- Packages mason-tool-installer keeps installed (LSPs, formatters, linters).
local lsp_servers = {
  -- lua / shell / c / cmake / docker
  "lua_ls",
  "stylua",
  "bashls",
  "clangd",
  "cmake",
  "dockerls",
  -- go
  "gopls",
  "gofumpt",
  "goimports",
  "gomodifytags",
  -- misc languages
  "harper_ls",
  "jdtls",
  "taplo",
  -- web / data
  "jsonls",
  "html",
  "yamlls",
  "ts_ls",
  "lemminx",
  "asm_lsp",
  "mdx_analyzer",
  -- python
  "basedpyright",
  "ruff",
  -- markdown
  "marksman",
  "markdownlint-cli2",
  -- conform.nvim formatters / nvim-lint linters (frontend: oxlint + oxfmt)
  -- oxfmt handles markdown too (replaces mdformat); mdformat removed 2026-09-15
  -- (it escaped Obsidian wikilinks and rewrote thematic breaks to underscores).
  "oxlint",
  "oxfmt",
  "jq",
  "kdlfmt",
  "shellcheck",
  "shfmt",
}

require("mason").setup()
-- mason-lspconfig v2 only accepts `ensure_installed` + `automatic_enable`;
-- the old `ui`/`pip`/`automatic_installation` keys were never honored here.
require("mason-lspconfig").setup({
  automatic_enable = false, -- vim.lsp.enable below is the single source of truth
})
require("mason-tool-installer").setup({ ensure_installed = lsp_servers })

-- oxfmt (mason) is now the markdown formatter; mdformat + its pip plugins
-- (mdformat-obsidian, mdformat-frontmatter) were removed 2026-09-15. oxfmt
-- preserves Obsidian wikilinks/embeds/callouts and YAML frontmatter natively,
-- which mdformat mangled (wikilink escaping, 70-underscore thematic breaks,
-- `\` hard breaks, upper-cased callout types).
-- Server configs live in `lsp/*.lua` (one file per server, native convention).
-- Shared capabilities (blink.cmp) apply to all of them via the `*` wildcard.
vim.lsp.config("*", { capabilities = require("lsp.capabilities") })

-- Exception to the file convention: rtp files merge plugin-last, so this
-- leaf would lose to nvim-lspconfig's default (`openFilesOnly`). Explicit
-- calls outrank rtp files, preserving the workspace-wide diagnostics.
vim.lsp.config("basedpyright", {
  settings = { basedpyright = { analysis = { diagnosticMode = "workspace" } } },
})

-- Filetypes need the same treatment: rtp lists merge plugin-last, so the
-- plugin base would drop gopls `gosum` / bashls `zsh` and add marksman
-- `markdown.mdx`. Explicit calls replace lists wholesale.
vim.lsp.config("gopls", { filetypes = { "go", "gomod", "gowork", "gotmpl", "gosum" } })
vim.lsp.config("bashls", { filetypes = { "sh", "bash", "zsh" } })
vim.lsp.config("marksman", { filetypes = { "markdown" } })

-- Client tweaks that depend on the attached server, not on static config.
-- One LspAttach handler instead of per-server on_attach functions.
vim.api.nvim_create_autocmd("LspAttach", {
  callback = function(args)
    local client = vim.lsp.get_client_by_id(args.data.client_id)
    if not client then
      return
    end
    if client.name == "gopls" and not client.server_capabilities.semanticTokensProvider then
      local semantic = client.config.capabilities.textDocument.semanticTokens
      client.server_capabilities.semanticTokensProvider = {
        full = true,
        legend = { tokenModifiers = semantic.tokenModifiers, tokenTypes = semantic.tokenTypes },
        range = true,
      }
    elseif client.name == "ruff" then
      client.server_capabilities.hoverProvider = false -- basedpyright owns hover
    end
  end,
})

-- The single source of truth for active servers (automatic_enable is off).
vim.lsp.enable({
  "asm_lsp",
  "bashls",
  "basedpyright",
  "clangd",
  "cmake",
  "dockerls",
  "gopls",
  "harper_ls",
  "html",
  "jdtls",
  "jsonls",
  "lemminx",
  "lua_ls",
  "marksman",
  "mdx_analyzer",
  "ruff",
  "taplo",
  "ts_ls",
  "yamlls",
})
