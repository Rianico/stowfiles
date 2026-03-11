#!/bin/bash

source "$CONFIG_DIR/colors.sh"
# source "$CONFIG_DIR/colors.sh"
source "$CONFIG_DIR/utils/aerospace.sh"

workspace_args=()
# Add aerospace events first
workspace_args+=(--add event aerospace_workspace_change)

# This custom event (triggered in ~/.config/aerospace/aerospace.toml) fires when a window is moved
# from one space to another.
# It will include two variables:
# - TARGET_WORKSPACE: The ID of the workspace the window was moved to
# - FOCUSED_WORKSPACE: The ID of the workspace that is currently focused (where the window is moving from)
workspace_args+=(--add event change-window-workspace)

# This custom event (triggered in ~/.config/aerospace/aerospace.toml) fires when
# a workspace is moved to a different monitor.
# It will include two variables:
# - TARGET_MONITOR: The system ID of the monitor the workspace was moved to (NOT aerospace ID)
# - TARGET_WORKSPACE: The ID of the workspace that is being moved
workspace_args+=(--add event change-workspace-monitor)

# Generate workspace arguments
all_workspace_data=$(aerospace list-workspaces --all)
focused_workspace=$(aerospace list-workspaces --focused)
active_workspaces=$(extract_unique_workspaces "$all_workspace_data")
active_workspaces=$(include_focused_workspace "$active_workspaces" "$focused_workspace")
active_workspaces=$(echo $active_workspaces | tr ' ' '\n' | sort)

for workspace_id in $active_workspaces; do
  if [[ -n "$workspace_id" ]]; then
    while IFS= read -r arg; do
      workspace_args+=("$arg")
    done <<<"$(generate_workspace_args "$workspace_id")"
  fi
done
sketchybar "${workspace_args[@]}"

sketchybar --add item workspace_separator left \
  --set workspace_separator icon="􀆊" \
  icon.color=$HIGHLIGHT \
  icon.padding_left=4 \
  label.drawing=off \
  background.drawing=off \
  script="$PLUGIN_DIR/aerospace_windows.sh" \
  --subscribe workspace_separator aerospace_workspace_change \
  --subscribe workspace_separator change-window-workspace \
  --subscribe workspace_separator change-workspace-monitor
