require("config.lazy")
require("basic")

-- Filetypes Neovim doesn't detect itself: MDX docs (served by mdx_analyzer)
-- and Go templates (served by gopls). Must run before any buffer loads.
vim.filetype.add({ extension = { mdx = "mdx", gotmpl = "gotmpl" } })
require("keybindings")

-- for lsp
require("lsp.mason")
require("lsp.metals")
-- require("lsp.null-ls")
require("lsp.nvim-treesitter")
require("lsp.lspsaga")

-- formatting
require("lsp.conform")
require("lsp.nvim-lint")

-- require("lsp.trouble")
require("config.harpoon2")
require("config.mini")
require("config/marks")
