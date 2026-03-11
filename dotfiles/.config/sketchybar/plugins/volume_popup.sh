#!/bin/bash

# Load global styles, colors and icons
source "$CONFIG_DIR/globalstyles.sh"

args=(--remove '/volume.device\..*/' --set $NAME popup.drawing=toggle "${menu_defaults[@]}")

COUNTER=0
CURRENT="$(SwitchAudioSource -t output -c)"

while IFS= read -r device; do
  COLOR=$STATUS_LABEL_COLOR
  ICON=􀆅
  ICON_COLOR=$TRANSPARENT

  if [ "${device}" == "$CURRENT" ]; then
    COLOR=$HIGHLIGHT
    ICON_COLOR=$HIGHLIGHT
  fi

  args+=(--add item volume.device.$COUNTER popup.$NAME
    --set volume.device.$COUNTER label="${device}"
    "${menu_item_defaults[@]}"
    label.color="$COLOR"
    icon=$ICON
    icon.color=$ICON_COLOR
    click_script="SwitchAudioSource -s \"${device}\" && sketchybar --set /volume.device\..*/ label.color=$COLOR --set \$NAME label.color=$COLOR --set $NAME popup.drawing=off")

  COUNTER=$((COUNTER + 1))
done <<<"$(SwitchAudioSource -a -t output)"

sketchybar -m "${args[@]}" >/dev/null

case "$SENDER" in
"mouse.exited.global")
  sketchybar --set $NAME popup.drawing=off
  ;;
esac
