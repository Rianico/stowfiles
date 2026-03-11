#!/bin/bash

sketchybar --add item front_app left \
  --set front_app background.color=$HIGHLIGHT \
  icon.color=$SHADOW_COLOR \
  icon.font="sketchybar-app-font:Regular:16.0" \
  label.color=$SHADOW_COLOR \
  label.font="SF Pro:Semibold:15.0" \
  script="$PLUGIN_DIR/front_app.sh" \
  --subscribe front_app front_app_switched
