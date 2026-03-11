#!/bin/bash

source $CONFIG_DIR/globalstyles.sh

STATE="$(echo "$INFO" | jq -r '.state')"

case "$STATE" in
"playing")
  MEDIA="$(echo "$INFO" | jq -r '.title + " - " + .artist')"
  sketchybar --set $NAME icon=$ICON_PAUSED icon.color=$ICON_COLOR label="$MEDIA" label.color=$ICON_COLOR drawing=on
  ;;
"paused")
  MEDIA="$(echo "$INFO" | jq -r '.title + " - " + .artist')"
  sketchybar --set $NAME icon=$ICON_PLAY icon.color=$ICON_COLOR_INACTIVE label="$MEDIA" label.color=$ICON_COLOR_INACTIVE drawing=on
  ;;
*)
  sketchybar --set $NAME drawing=off
  ;;
esac
