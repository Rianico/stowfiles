#!/bin/bash

render_item() {
  sketchybar --set $NAME label="$(date "+%I:%M %p")" \
    --set date icon.drawing=off \
    --set clock label.padding_left=$PADDING
}

update() {
  render_item
}

# popup() {
#   sketchybar --set clock.next_event label="$theEvent" \
#     --set "$NAME" popup.drawing="$1"
# }

echo $SENDER
case "$SENDER" in
"routine" | "forced" | "focus_on" | "focus_off")
  update
  ;;
# "mouse.entered")
#   popup on
#   ;;
# "mouse.exited" | "mouse.exited.global")
#   popup off
#   ;;
esac
