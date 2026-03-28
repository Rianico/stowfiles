-- https://www.lazyvim.org/extras/lang/scala

-- vim.pack.add({
--   { src = "https://github.com/neovim/nvim-lspconfig" },
--   { src = "https://github.com/mason-org/mason.nvim" },
--   { src = "https://github.com/mason-org/mason-lspconfig.nvim" },
--   { src = "https://github.com/WhoIsSethDaniel/mason-tool-installer.nvim" },
--   { src = "https://github.com/L3MoN4D3/LuaSnip" },
-- })

-- local default_opts = {}
-- default_opts.capabilities.textDocument.foldingRange = {
--   dynamicRegistration = false,
--   lineFoldingOnly = true,
-- }

-- The servers that should be automatically installed
local lsp_servers = {
  -- lua
  "lua_ls",
  "stylua",
  "clangd",
  "bashls",
  "cmake",
  "dockerls",
  -- go
  "gopls",
  "gofumpt",
  "goimports",
  "gomodifytags",
  "harper_ls",
  "jdtls",
  "slint_lsp",
  -- toml
  "taplo",
  -- json
  "jsonls",
  -- xml
  "lemminx",
  -- python
  "pylsp",
  "ruff",
  "pyflakes",
  "isort",
  "yapf",
}

require("mason").setup()
require("mason-lspconfig").setup({
  ui = {
    icons = {
      package_installed = "✓",
      package_pending = "➜",
      package_uninstalled = "✗",
    },
  },
  pip = {
    -- Whether to upgrade pip to the latest version in the virtual environment before installing packages.
    upgrade_pip = true,
  },
  automatic_installation = true,
  automatic_enable = true,
})
require("mason-tool-installer").setup({
  ensure_installed = lsp_servers,
})

-- Get capabilities for completion plugins
local has_blink, blink_cmp = pcall(require, "blink.cmp")
local capabilities

if has_blink then
  -- Try to use blink.cmp's native LSP capabilities if available
  if blink_cmp.get_lsp_capabilities then
    capabilities = blink_cmp.get_lsp_capabilities()
  else
    -- If blink.cmp doesn't provide a function, use default
    capabilities = vim.lsp.protocol.make_client_capabilities()
  end
else
  -- Fallback to nvim-cmp if blink.cmp is not available
  local has_cmp, cmp_lsp = pcall(require, "cmp_nvim_lsp")
  if has_cmp then
    capabilities = cmp_lsp.default_capabilities()
  else
    -- Fallback to default capabilities
    capabilities = vim.lsp.protocol.make_client_capabilities()
  end
end

-- Ensure snippet support is enabled
capabilities.textDocument.completion.completionItem.snippetSupport = true

vim.lsp.config.gopls = {
  capabilities = capabilities, -- Add capabilities to gopls
  on_attach = function(client, _)
    if client.name == "gopls" and not client.server_capabilities.semanticTokensProvider then
      local semantic = client.config.capabilities.textDocument.semanticTokens
      client.server_capabilities.semanticTokensProvider = {
        full = true,
        legend = { tokenModifiers = semantic.tokenModifiers, tokenTypes = semantic.tokenTypes },
        range = true,
      }
    end
  end,
  filetypes = { "go", "gomod", "gowork", "gotmpl", "gosum" },
  root_markers = { "go.mod", "go.work", ".git" },
  settings = {
    gopls = {
      gofumpt = true,
      codelenses = {
        gc_details = false,
        generate = true,
        regenerate_cgo = true,
        run_govulncheck = true,
        test = true,
        tidy = true,
        upgrade_dependency = true,
        vendor = true,
      },
      hints = {
        assignVariableTypes = true,
        compositeLiteralFields = true,
        compositeLiteralTypes = true,
        constantValues = true,
        functionTypeParameters = true,
        parameterNames = true,
        rangeVariableTypes = true,
      },
      analyses = {
        nilness = true,
        unusedparams = true,
        unusedwrite = true,
        useany = true,
      },
      usePlaceholders = true,
      completeUnimported = true,
      staticcheck = true,
      directoryFilters = { "-.git", "-.vscode", "-.idea", "-.vscode-test", "-node_modules" },
      semanticTokens = true,
    },
  },
}

vim.lsp.config.lua_ls = {
  capabilities = capabilities, -- Add capabilities to lua_ls
  settings = {
    Lua = {
      runtime = {
        version = "LuaJIT",
      },
      diagnostics = {
        globals = { "vim", "require" },
      },
      workspace = {
        library = vim.api.nvim_get_runtime_file("", true),
      },
      telemetry = { enable = false },
    },
  },
}

vim.lsp.config.ruff = {
  capabilities = capabilities, -- Add capabilities to ruff
  cmd_env = { RUFF_TRACE = "messages" },
  init_options = {
    settings = {
      logLevel = "error",
    },
  },
  on_attach = function(client, _)
    -- Disable hover in favor of Pyright
    client.server_capabilities.hoverProvider = false
  end,
}

-- enable slint files recognization
vim.cmd([[ autocmd BufEnter *.slint :setlocal filetype=slint ]])
vim.lsp.config.slint_lsp = {
  capabilities = capabilities, -- Add capabilities to slint_lsp
  command = { "slint-lsp" },
  highlightingModeRegex = "slint",
}

vim.lsp.config.bashls = {
  capabilities = capabilities, -- Add capabilities to bashls
  filetypes = { "sh", "bash", "zsh" },
}

vim.lsp.config("harper-ls", {
  capabilities = capabilities, -- Add capabilities to harper-ls
  settings = {
    ["harper-ls"] = {
      linters = {
        SentenceCapitalization = false,
        SpellCheck = false,
      },
    },
  },
})

-- Use individual server setup instead of vim.lsp.enable to have control over capabilities
vim.lsp.enable({
  "pylsp",
  "taplo",
  "asm_lsp",
  "bashls",
  "harper-ls",
  "slint_lsp",
  "lua_ls",
  "gopls",
  "yamlls",
})
