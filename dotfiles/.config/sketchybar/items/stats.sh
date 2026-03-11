#!/bin/bash

source "$CONFIG_DIR/globalstyles.sh"

# sketchybar --add item cpu right \
#            --set cpu  update_freq=2 \
#                       icon=􀧓  \
#                       script="$PLUGIN_DIR/cpu.sh"
sketchybar --add alias "LemonMonitor,Item-0" right \
  --set "LemonMonitor,Item-0" alias.update_freq=1 \
  background.padding_right=0 \
  background.padding_left=0 \
  label.padding_right=0 \
  label.padding_left=0 \
  icon.padding_left=0 \
  icon.padding_right=0 \
  padding_left=0 \
  padding_right=0 \
  alias.scale=1.2 \
  \
  --add alias "Control Center,WiFi" right \
  --set "Control Center,WiFi" alias.update_freq=5 \
  background.padding_right=0 \
  background.padding_left=0 \
  label.padding_right=0 \
  label.padding_left=0 \
  icon.padding_left=$PADDINGS \
  icon.padding_right=0 \
  padding_left=0 \
  padding_right=0 \
  alias.scale=1.2
