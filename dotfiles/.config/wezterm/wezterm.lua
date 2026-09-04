local wezterm = require("wezterm")

local config = {}

if wezterm.config_builder then
  config = wezterm.config_builder()
end

config.enable_kitty_keyboard = false
-- Encode shifted arrows as CSI-u (ESC[1;2A) so TUIs can tell Shift+↑/↓ from
-- plain ↑/↓ without a kitty handshake (pi does not request one).
config.enable_csi_u_key_encoding = true

-- pi (TrackingEditor) needs Option+Enter / Option+Up to keep their Alt modifier.
-- By default the RIGHT Option key (and IME forwarding on macOS) treats Option as a
-- compose key and DROPS the modifier, so pi sees a plain Enter / plain Up arrow and
-- app.message.followUp (alt+enter) / app.message.dequeue (alt+up) never fire.
-- Force both Option keys to act as Meta/Alt so the modifier is preserved.
config.send_composed_key_when_left_alt_is_pressed = false
config.send_composed_key_when_right_alt_is_pressed = false

-- Windows
local os_name = string.lower(os.getenv("OS") or "")
if string.find(os_name, "windows") ~= nil then
  config.default_domain = "WSL:Ubuntu-22.04"
  config.font_size = 12.3
else
  config.font_size = 22.0
end

-- when start up, we maximize the window
wezterm.on("gui-startup", function(_)
  -- local _, pane, window = wezterm.mux.spawn_window({})
  -- window:gui_window():perform_action(wezterm.action.ToggleFullScreen, pane)
end)

-- config.color_scheme = "catppuccin-macchiato"
config.color_scheme = "Catppuccin Macchiato (Gogh)"

-- RESIZE, TITLE, NONE
config.window_decorations = "RESIZE"

config.hide_tab_bar_if_only_one_tab = true

config.font = wezterm.font_with_fallback({
  "JetbrainsMono Nerd Font",
  "SF Pro",
})

-- cursor
config.default_cursor_style = "SteadyUnderline"

-- fps
config.animation_fps = 120

-- apparance
config.window_background_opacity = 0.95
config.macos_window_background_blur = 20

config.window_padding = {
  left = 0,
  right = 0,
  bottom = 0,
  top = 2,
}

config.colors = {
  tab_bar = {
    -- The color of the inactive tab bar edge/divider
    inactive_tab_edge = "#575757",
  },
}

config.inactive_pane_hsb = {
  saturation = 0.618,
  brightness = 0.382,
}

-- keybinding
config.disable_default_key_bindings = true
-- config.leader = { key = ";", mods = "CTRL", timeout_milliseconds = 2000 }

local act = wezterm.action

config.keys = {
  -- pi: Option+Enter = send message (app.message.followUp), Option+Up = recall queued
  -- messages (app.message.dequeue). Send the exact CSI-u bytes pi expects so this
  -- works regardless of wezterm's key-encoding / IME / compose behavior.
  { key = "Enter", mods = "ALT", action = wezterm.action.SendString("\x1b[13;3u") },
  -- pane
  -- { key = "v", mods = "LEADER", action = act.SplitHorizontal({ domain = "CurrentPaneDomain" }) },
  -- { key = "s", mods = "LEADER", action = act.SplitVertical({ domain = "CurrentPaneDomain" }) },
  -- { key = "h", mods = "LEADER", action = act.ActivatePaneDirection("Left") },
  -- { key = "l", mods = "LEADER", action = act.ActivatePaneDirection("Right") },
  -- { key = "j", mods = "LEADER", action = act.ActivatePaneDirection("Down") },
  -- { key = "k", mods = "LEADER", action = act.ActivatePaneDirection("Up") },
  -- { key = "q", mods = "LEADER", action = act.CloseCurrentPane({ confirm = false }) },
  -- { key = "z", mods = "LEADER", action = act.TogglePaneZoomState },

  -- tab
  -- { key = "t", mods = "LEADER", action = act.SpawnTab("CurrentPaneDomain") },
  -- window
  { key = "n", mods = "CTRL|SHIFT", action = act.SpawnWindow },

  -- copy and paste
  -- mac
  { key = "c", mods = "CMD", action = act.CopyTo("Clipboard") },
  { key = "v", mods = "CMD", action = act.PasteFrom("Clipboard") },
  -- windows
  { key = "c", mods = "CTRL|SHIFT", action = act.CopyTo("Clipboard") },
  { key = "v", mods = "CTRL|SHIFT", action = act.PasteFrom("Clipboard") },

  -- search
  -- { key = "f", mods = "LEADER", action = act.Search({ Regex = "" }) },
  -- copy mode
  -- { key = "v", mods = "META", action = act.ActivateCopyMode },
  -- quick select mode
  { key = "s", mods = "META", action = act.QuickSelect },
}

-- for i = 1, 8 do
--   table.insert(config.keys, {
--     key = tostring(i),
--     mods = "CTRL",
--     action = act.ActivateTab(i - 1),
--   })
--   table.insert(config.keys, {
--     key = tostring(i),
--     mods = "CMD",
--     action = act.ActivateTab(i - 1),
--   })
-- end

config.quick_select_patterns = {
  -- UUIDs (session IDs, container IDs, etc.)
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
  -- Short UUIDs / Docker container IDs (12 hex chars)
  "[0-9a-fA-F]{12}",
  -- Git commit hashes (short: 7-8 chars, long: 40 chars)
  "[0-9a-fA-F]{7,40}",
  -- IP addresses
  "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}",
  -- URLs
  "https?://[^\\s]+",
  -- File paths
  "[/~]?[a-zA-Z0-9_/.-]+/[a-zA-Z0-9_.-]+",
  -- Session names, container names (alphanumeric, dash, underscore)
  "[a-zA-Z][a-zA-Z0-9_-]{2,}",
  -- Process IDs
  "\\d{4,}",
  -- Port numbers after colon
  ":\\d{2,5}",
  -- Hex colors
  "#[0-9a-fA-F]{6}",
  -- Base64 strings
  "[A-Za-z0-9+/]{20,}={0,2}",
  -- Email addresses
  "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
  -- SSH host patterns (user@host)
  "[a-zA-Z0-9_-]+@[a-zA-Z0-9.-]+",
  -- Key fingerprints (SHA256:...)
  "SHA256:[a-zA-Z0-9+/]+",
  -- Quoted strings
  '"[^"]+"',
  "'[^']+'",
}

return config
