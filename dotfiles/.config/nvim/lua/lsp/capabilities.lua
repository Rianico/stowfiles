-- Shared client capabilities for every server (blink.cmp > nvim-cmp > stock).
-- Used by the `*` wildcard below; `lsp/*.lua` files only carry server quirks.
local function default_capabilities()
  local ok, blink = pcall(require, "blink.cmp")
  local caps
  if ok and blink.get_lsp_capabilities then
    caps = blink.get_lsp_capabilities()
  else
    local ok_cmp, cmp = pcall(require, "cmp_nvim_lsp")
    caps = (ok_cmp and cmp.default_capabilities) and cmp.default_capabilities()
      or vim.lsp.protocol.make_client_capabilities()
  end
  caps.textDocument.completion.completionItem.snippetSupport = true
  return caps
end

return default_capabilities()
