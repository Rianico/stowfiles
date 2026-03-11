#!/bin/sh

# The $SELECTED variable is available for space components and indicates if
# the space invoking this script (with name: $NAME) is currently selected:
# https://felixkratz.github.io/SketchyBar/config/components#space----associate-mission-control-spaces-with-an-item

source "$CONFIG_DIR/globalstyles.sh" # Loads all defined colors
background_y_offset=$((-$PADDINGS - 2))
if [ "$1" = "$(aerospace list-workspaces --focused)" ]; then
  sketchybar --animate tanh $ANIMATION_DURATION \
    --set $NAME \
    label.y_offset=-1 \
    icon.highlight=on \
    label.highlight=on \
    background.color=$HIGHLIGHT_75 \
    background.height=2 \
    background.y_offset=$background_y_offset
else
  sketchybar --set $NAME \
    label.y_offset=-1 \
    background.color=$HIGHLIGHT_75 \
    background.height=2 \
    background.y_offset=$background_y_offset \
    background.drawing=off
fi
