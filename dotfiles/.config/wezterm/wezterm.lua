local wezterm = require("wezterm")

local config = {}

if wezterm.config_builder then
  config = wezterm.config_builder()
end

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
config.window_background_opacity = 0.983
config.macos_window_background_blur = 10

config.window_padding = {
  left = 16,
  right = 0,
  bottom = 0,
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
config.leader = { key = "w", mods = "META", timeout_milliseconds = 2000 }

local act = wezterm.action

config.keys = {
  -- pane
  { key = "v", mods = "LEADER", action = act.SplitHorizontal({ domain = "CurrentPaneDomain" }) },
  { key = "s", mods = "LEADER", action = act.SplitVertical({ domain = "CurrentPaneDomain" }) },
  { key = "h", mods = "LEADER", action = act.ActivatePaneDirection("Left") },
  { key = "l", mods = "LEADER", action = act.ActivatePaneDirection("Right") },
  { key = "j", mods = "LEADER", action = act.ActivatePaneDirection("Down") },
  { key = "k", mods = "LEADER", action = act.ActivatePaneDirection("Up") },
  { key = "q", mods = "LEADER", action = act.CloseCurrentPane({ confirm = false }) },
  { key = "z", mods = "LEADER", action = act.TogglePaneZoomState },

  -- tab
  { key = "t", mods = "LEADER", action = act.SpawnTab("CurrentPaneDomain") },
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
  { key = "f", mods = "LEADER", action = act.Search({ Regex = "" }) },
  -- copy mode
  { key = "v", mods = "META", action = act.ActivateCopyMode },
  -- quick select mode
  { key = "s", mods = "META", action = act.QuickSelect },
}

for i = 1, 8 do
  table.insert(config.keys, {
    key = tostring(i),
    mods = "CTRL",
    action = act.ActivateTab(i - 1),
  })
  table.insert(config.keys, {
    key = tostring(i),
    mods = "CMD",
    action = act.ActivateTab(i - 1),
  })
end

config.quick_select_patterns = {
  '(?:S+(?:s+S+)*)|(?:"[^"]+")',
}

return config
