---@diagnostic disable: missing-fields
-- Languages to install parsers for and enable highlighting + indentation
-- (folds are handled by nvim-ufo)
-- (https://github.com/nvim-treesitter/nvim-treesitter#highlighting)
local languages = {
  "bash",
  "c",
  "diff",
  "html",
  "go",
  "gomod",
  "gowork",
  "gosum",
  "java",
  "json",
  "lua",
  "luadoc",
  "luap",
  "make",
  "markdown",
  "markdown_inline",
  "python",
  "rust",
  "ron",
  "sql",
  "scala",
  "regex",
  "toml",
  "vim",
  "yaml",
  "ninja",
}

-- Filetypes that map to the parsers above (see nvim-treesitter's filetype
-- registrations), e.g. `sh` -> bash, `jsonc` -> json, `gitdiff` -> diff.
local filetypes = vim.list_extend(vim.deepcopy(languages), {
  "sh", -- bash
  "gitdiff", -- diff
  "automake", -- make
  "pandoc", -- markdown
  "sbt", -- scala
  "jsonc", -- json
})

-- Install parsers (no-op if already installed)
require("nvim-treesitter").install(languages)

-- Enable treesitter highlighting + indentation for the filetypes above.
vim.api.nvim_create_autocmd("FileType", {
  pattern = filetypes,
  callback = function(args)
    local ft = vim.bo[args.buf].filetype
    local lang = vim.treesitter.language.get_lang(ft)
    if not vim.treesitter.language.add(lang) then
      local available = vim.g.ts_available or require("nvim-treesitter").get_available()
      if not vim.g.ts_available then
        vim.g.ts_available = available
      end
      if vim.tbl_contains(available, lang) then
        require("nvim-treesitter").install(lang)
      end
    end
    if vim.treesitter.language.add(lang) then
      -- Highlighting
      vim.treesitter.start(args.buf, lang)
      -- Indentation (experimental; https://github.com/nvim-treesitter/nvim-treesitter#indentation)
      vim.bo[args.buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
    end
  end,
})
-- change rainbow
vim.cmd([[ autocmd FileType * highlight rainbowcol4 guifg=#FF7B72 gui=bold ]])
