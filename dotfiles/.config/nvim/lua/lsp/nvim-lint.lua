-- https://github.com/mfussenegger/nvim-lint
-- markdownlint-cli2 is installed via mason-tool-installer (see lsp.mason).
-- Binary: `markdownlint-cli2`. Optional project config: `.markdownlint-cli2.jsonc`.
local lint = require("lint")

lint.linters_by_ft = {
  markdown = { "markdownlint-cli2" },
  javascript = { "oxlint" },
  typescript = { "oxlint" },
  javascriptreact = { "oxlint" },
  typescriptreact = { "oxlint" },
  sh = { "shellcheck" },
  bash = { "shellcheck" },
  zsh = { "shellcheck" },
}

-- Explicit --config: nvim-lint pipes stdin with nvim's cwd, so tree
-- discovery of .markdownlint-cli2.jsonc is unreliable. Point at the shared
-- stowed config when present; per-project configs layer on top of it.
local shared_config = vim.fn.expand("~/.markdownlint-cli2.base.jsonc")
if vim.fn.filereadable(shared_config) == 1 then
  lint.linters["markdownlint-cli2"] = {
    cmd = "markdownlint-cli2",
    stdin = true,
    args = { "--config", shared_config, "-" },
    ignore_exitcode = true,
    stream = "stderr",
    parser = require("lint.parser").from_errorformat("stdin:%l:%c %m,stdin:%l %m", {
      source = "markdownlint",
      severity = vim.diagnostic.severity.WARN,
    }),
  }
end

local lint_augroup = vim.api.nvim_create_augroup("nvim-lint", { clear = true })

vim.api.nvim_create_autocmd({ "BufEnter", "BufWritePost", "InsertLeave" }, {
  group = lint_augroup,
  callback = function()
    -- Only lint readable, non-special buffers (avoids [nvim-lint] Reading from stdin... errors)
    local buf = vim.api.nvim_get_current_buf()
    if vim.bo[buf].modifiable and vim.bo[buf].buftype == "" and vim.fn.filereadable(vim.api.nvim_buf_get_name(buf)) == 1 then
      lint.try_lint()
    end
  end,
})

vim.keymap.set("n", "<leader>ml", function()
  lint.try_lint()
end, { desc = "Lint: run nvim-lint" })

-- nvim-lint is diagnostics-only; --fix needs the file path, not stdin.
vim.keymap.set("n", "<leader>mF", function()
  local file = vim.api.nvim_buf_get_name(vim.api.nvim_get_current_buf())
  if file == "" then
    vim.notify("No file to fix", vim.log.levels.WARN)
    return
  end
  vim.system({ "markdownlint-cli2", "--fix", file }, { text = true }, function(obj)
    vim.schedule(function()
      vim.cmd("checktime")
      lint.try_lint()
      vim.notify(
        obj.code == 0 and "markdownlint --fix: clean" or "markdownlint --fix applied, re-linted",
        vim.log.levels.INFO
      )
    end)
  end)
end, { desc = "Lint: markdownlint --fix file" })
