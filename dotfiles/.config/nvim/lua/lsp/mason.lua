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
  "mdformat",
  -- conform.nvim formatters / nvim-lint linters (frontend: oxlint + oxfmt)
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

-- mdformat auto-enables pip plugins in its own venv, which Mason can't
-- declare -- so top them up after every mason-tool-installer run (this also
-- covers a fresh mdformat install). Async, silent when already satisfied.
local mdformat_plugins = { "mdformat-obsidian" }
local mdformat_ensuring = false

local function notify_async(msg, level)
  vim.schedule(function() vim.notify(msg, level) end)
end

local function venv_python(pkg)
  local root = vim.fn.stdpath("data") .. "/mason/packages/" .. pkg
  for _, rel in ipairs({ "/venv/bin/python", "/venv/Scripts/python.exe" }) do
    local py = root .. rel
    if vim.fn.executable(py) == 1 then
      return py
    end
  end
end

local function ensure_venv_plugins(pkg, plugins)
  if mdformat_ensuring then
    return
  end
  local py = venv_python(pkg)
  if not py then
    return -- host package missing; retried on the next run
  end
  mdformat_ensuring = true
  local function step(i)
    local plugin = plugins[i]
    if not plugin then
      mdformat_ensuring = false
      return
    end
    vim.system({ py, "-m", "pip", "show", plugin }, { text = true }, function(check)
      if check.code == 0 then
        step(i + 1) -- already in the venv
      else
        notify_async("Installing " .. plugin .. " into Mason " .. pkg .. "...", vim.log.levels.INFO)
        vim.system({ py, "-m", "pip", "install", "--disable-pip-version-check", plugin }, { text = true }, function(res)
          if res.code == 0 then
            notify_async(plugin .. " installed into Mason " .. pkg, vim.log.levels.INFO)
          else
            notify_async(plugin .. " install failed: " .. (res.stderr or ""), vim.log.levels.ERROR)
          end
          step(i + 1)
        end)
      end
    end)
  end
  step(1)
end

vim.api.nvim_create_autocmd("User", {
  pattern = "MasonToolsUpdateCompleted",
  callback = function() ensure_venv_plugins("mdformat", mdformat_plugins) end,
})

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
