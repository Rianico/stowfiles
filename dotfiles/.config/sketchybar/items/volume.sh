#!/bin/bash

which SwitchAudioSource >/dev/null || exit 0

volume_slider=(
  updates=on
  icon.drawing=off
  label.drawing=off
  padding_left=0
  padding_right=0
  slider.background.color=$(getcolor white 25)
  slider.background.corner_radius=12
  slider.background.height=8
  slider.highlight_color=$HIGHLIGHT
  script="$PLUGIN_DIR/volume.sh"
)

volume_icon=(
  click_script="$PLUGIN_DIR/volume_click.sh"
  script="$PLUGIN_DIR/volume_popup.sh"
  icon=$ICON_VOLUME_100
  icon.width=28
  icon.padding_right=4
  icon.color=$(getcolor green)
  label.drawing=off
  popup.align=right
)

sketchybar --add slider volume right \
  --set volume "${volume_slider[@]}" \
  --subscribe volume volume_change \
  mouse.clicked \
  mouse.entered \
  mouse.exited \
  mouse.exited.global \
  \
  --add item volume_icon right \
  --set volume_icon "${volume_icon[@]}" \
  --subscribe volume_icon mouse.exited.global
