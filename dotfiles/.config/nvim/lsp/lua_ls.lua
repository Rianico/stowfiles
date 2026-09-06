return {
  settings = {
    Lua = {
      runtime = { version = "LuaJIT" },
      diagnostics = { globals = { "vim", "require" } },
      workspace = { checkThirdParty = false, library = vim.api.nvim_get_runtime_file("", true) },
      telemetry = { enable = false },
    },
  },
}
