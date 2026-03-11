#!/bin/bash

# sketchybar --add item calendar right \
#   --set calendar icon=􀧞 \
#   label.font="SF Pro:Semibold:16.0" \
#   update_freq=30 \
#   script="$PLUGIN_DIR/calendar.sh"
#

#!/bin/bash

date=(
  "${status_item_defaults[@]}"
  icon=􀀁
  icon.drawing=off
  icon.padding_right=1
  icon.color=$(getcolor yellow)
  update_freq=60
  script='sketchybar --set $NAME label="$(date "+%a, %b %d")"'
  click_script="open -a Calendar.app"
)

clock=(
  "${status_item_defaults[@]}"
  "${menu_defaults[@]}"
  icon.drawing=off
  update_freq=10
  popup.align=right
  script='sketchybar --set $NAME label="$(date "+%I:%M %p")"'
  click_script="sketchybar --set clock popup.drawing=toggle; open -a Calendar.app"
)

sketchybar \
  --add item date right \
  --set date "${date[@]}" \
  --subscribe date system_woke \
  \
  --add item clock right \
  --set clock "${clock[@]}" \
  --subscribe clock system_woke \
  mouse.entered \
  mouse.exited \
  mouse.exited.global
