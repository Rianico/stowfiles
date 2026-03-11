#!/bin/bash

# Load global styles, colors and icons
source "$CONFIG_DIR/globalstyles.sh"

toggle_detail() {
  INITIAL_WIDTH=$(sketchybar --query volume | jq -r ".slider.width")
  if [ "$INITIAL_WIDTH" -eq "0" ]; then
    sketchybar --animate tanh $ANIMATION_DURATION --set volume slider.width=100
  else
    sketchybar --animate tanh $ANIMATION_DURATION --set volume slider.width=0
  fi
}

toggle_devices() {
  sketchybar --set $NAME popup.drawing=toggle
}

if [ "$BUTTON" = "right" ] || [ "$MODIFIER" = "shift" ]; then
  toggle_devices
else
  toggle_detail
fi
