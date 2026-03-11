#!/bin/bash

source $CONFIG_DIR/utils/aerospace.sh
# Load global styles, colors and icons
source "$CONFIG_DIR/globalstyles.sh"

if [[ "$SENDER" = "change-window-workspace" ]]; then
  # Batch workspace updates for better performance but use existing function for correctness
  updates=()
  # Build updates for focused workspace (already exists)
  if [[ "$FOCUSED_WORKSPACE" ]]; then
    updates+=(
      --animate tanh $ANIMATION_DURATION
      --set workspace.$FOCUSED_WORKSPACE
      label=\"$(workspace_app_icons $FOCUSED_WORKSPACE)\"
    )
  fi

  # Build updates for target workspace (create if it doesn't exist)
  if [[ "$TARGET_WORKSPACE" ]]; then
    if ! sketchybar_item_exists "workspace.$TARGET_WORKSPACE"; then
      create_and_position_workspace "$TARGET_WORKSPACE"
    fi
    updates+=(
      --animate tanh $ANIMATION_DURATION
      --set workspace.$TARGET_WORKSPACE
      label=\"$(workspace_app_icons $TARGET_WORKSPACE)\"
    )
  fi
  # Execute batched command
  if [[ -n "$updates" ]]; then
    eval "sketchybar ${updates[@]}"
  fi
elif [ "$SENDER" = "aerospace_workspace_change" ]; then
  handle_workspace_change
elif [[ "$SENDER" = "change-workspace-monitor" ]]; then
  sketchybar --set workspace.$TARGET_WORKSPACE space=$TARGET_MONITOR
fi
