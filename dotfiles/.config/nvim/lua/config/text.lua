-- Shared prose settings for text-like filetypes.
-- Sourced from ftplugin/{text,plaintex,typst,gitcommit,markdown}.lua.
local M = {}

function M.setup()
  vim.opt_local.wrap = true
  vim.opt_local.spell = true
end

return M
