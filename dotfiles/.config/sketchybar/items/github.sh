#!/bin/bash

source "$CONFIG_DIR/globalstyles.sh"

POPUP_CLICK_SCRIPT="sketchybar --set \$NAME popup.drawing=toggle"

github_bell=(
  "${gihub_bell_defaults[@]}"
  update_freq=180
  script="$PLUGIN_DIR/github.sh"
  click_script="$POPUP_CLICK_SCRIPT"
)

sketchybar --add item github.bell right \
  --set github.bell "${github_bell[@]}" \
  --subscribe github.bell mouse.entered \
  mouse.exited \
  mouse.exited.global \
  \
  --add item github.template popup.github.bell \
  --set github.template "${github_template_defaults[@]}"
