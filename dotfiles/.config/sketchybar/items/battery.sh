#!/bin/bash

battery=(
  "${status_item_defaults[@]}"
  icon.width=48
  label.padding_left=0
  icon.padding_right=0
  update_freq=60
  script="$PLUGIN_DIR/battery.sh"
  updates=when_shown
)

sketchybar \
  --add item battery right \
  --set battery "${battery[@]}" \
  --subscribe battery power_source_change \
  mouse.clicked
