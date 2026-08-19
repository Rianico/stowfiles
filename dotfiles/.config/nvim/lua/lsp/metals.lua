local metals_config = require("metals").bare_config()

-- Example of settings
metals_config.settings = {
  showImplicitArguments = true,
  excludedPackages = { "akka.actor.typed.javadsl", "com.github.swagger.akka.javadsl" },
}

-- *READ THIS*
-- I *highly* recommend setting statusBarProvider to true, however if you do,
-- you *have* to have a setting to display this in your statusline or else
-- you'll not see any messages from metals. There is more info in the help
-- docs about this
-- metals_config.init_options.statusBarProvider = "on"

-- Get capabilities for completion plugins
local has_blink, blink_cmp = pcall(require, "blink.cmp")

if has_blink then
  -- Try to use blink.cmp's native LSP capabilities if available
  if blink_cmp.get_lsp_capabilities then
    metals_config.capabilities = blink_cmp.get_lsp_capabilities()
  end
else
  -- Fallback to nvim-cmp if blink.cmp is not available
  local has_cmp, cmp_lsp = pcall(require, "cmp_nvim_lsp")
  if has_cmp then
    metals_config.capabilities = cmp_lsp.default_capabilities()
  end
end

-- Ensure snippet support is enabled
if metals_config.capabilities then
  metals_config.capabilities.textDocument.completion.completionItem.snippetSupport = true
end

-- Debug settings if you're using nvim-dap
-- local dap = require("dap")
--
-- dap.configurations.scala = {
--   {
--     type = "scala",
--     request = "launch",
--     name = "RunOrTest",
--     metals = {
--       runType = "runOrTestFile",
--args = { "firstArg", "secondArg", "thirdArg" }, -- here just as an example
--     },
--   },
--   {
--     type = "scala",
--     request = "launch",
--     name = "Test Target",
--     metals = {
--       runType = "testTarget",
--     },
--   },
-- }

-- metals_config.on_attach = function(client, bufnr)
--     require("metals").setup_dap()
-- end

-- Attach Metals for scala/sbt buffers. Triggered from ftplugin/scala.lua and
-- ftplugin/sbt.lua on the FileType event.
local M = {}
function M.activate()
  require("metals").initialize_or_attach(metals_config)
end
return M
