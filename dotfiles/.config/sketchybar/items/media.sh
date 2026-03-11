#!/bin/bash

#!/bin/bash

source $CONFIG_DIR/globalstyles.sh

media=(
  ${bracket_defaults[@]}
  icon.padding_left=$PADDINGS
  scroll_texts=on
  label.max_chars=48
  label.padding_left=3
  label.padding_right=$PADDINGS
  label.scroll_duration=500
  padding_right=$PADDINGS
  updates=on
  script="$PLUGIN_DIR/media.sh"
  --subscribe media media_change
)

sketchybar --add item media right \
  --set media "${media[@]}"
