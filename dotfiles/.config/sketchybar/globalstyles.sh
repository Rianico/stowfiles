#!/bin/bash

# Load defined icons
source "$CONFIG_DIR/icons.sh"

# Load defined colors
source "$CONFIG_DIR/colors.sh"

PADDINGS=10

TEXT_FONT="SF Pro"
ICON_FONT="SF Pro"
SKETCHYBAR_ICON_FONT="sketchybar-app-font"

ANIMATION_DURATION=20

ICON_MAIL="􀣪"
ICON_MAIL_MANY="􀍝"

ICON_PAUSED="􀊅"
ICON_PLAY="􀊃"

ICON_BELL="􀋙"
ICON_BELL_DOT="􀝖"

ICON_LOADING="􀖇"

# Git Icons
GIT_ISSUE=􀍷
GIT_DISCUSSION=􀒤
GIT_PULL_REQUEST=􀙡
GIT_COMMIT=􀡚
GIT_INDICATOR=􀂓

# Bar Appearance
bar=(
  color=$TRANSPARENT
  position=top
  topmost=off
  sticky=on
  height=52
  padding_left=10
  padding_right=10
  corner_radius=0
  blur_radius=40
)

# Item Defaults
item_defaults=(
  background.corner_radius=16
  background.height=32
  background.padding_left=$(($PADDINGS / 2))
  background.padding_right=$(($PADDINGS / 2))
  icon.background.corner_radius=4
  icon.color=$ICON_COLOR_INACTIVE
  icon.font="$TEXT_FONT:Regular:18"
  icon.highlight_color=$HIGHLIGHT
  icon.padding_left=$(($PADDINGS / 2))
  icon.padding_right=$(($PADDINGS / 2))
  label.color=$LABEL_COLOR
  label.font="$SKETCHYBAR_ICON_FONT:Regular:18"
  label.highlight_color=$HIGHLIGHT
  label.padding_left=0
  label.padding_right=$(($PADDINGS / 2 + 6))
  scroll_texts=on
  updates=when_shown
)

icon_defaults=(
  label.drawing=off
)

notification_defaults=(
  updates=on
  update_freq=300
  background.padding_left=$PADDINGS
  background.padding_right=$PADDINGS
  icon.padding_left=$(($PADDINGS / 2))
  icon.padding_right=$(($PADDINGS / 2))
  label.padding_left=$(($PADDINGS / 2))
  label.padding_right=$(($PADDINGS / 2 + 6))
  label.y_offset=-2
)

bracket_defaults=(
  background.corner_radius=16
  background.color=$BAR_COLOR
)

menu_defaults=(
  popup.blur_radius=32
  popup.background.color=$POPUP_BACKGROUND_COLOR
  popup.background.corner_radius=16
  popup.background.shadow.drawing=on
  popup.background.shadow.color=$BAR_COLOR
  popup.background.shadow.angle=90
  popup.background.shadow.distance=64
  popup.drawing=off
)

menu_item_defaults=(
  label.font="$TEXT_FONT:Regular:16"
  padding_left=$PADDINGS
  padding_right=$PADDINGS
  icon.padding_left=0
  icon.padding_right=4
  icon.color=$HIGHLIGHT
  background.color=$TRANSPARENT
  scroll_texts=off
  icon.width=16
)

status_item_defaults=(
  label.font="$TEXT_FONT:Bold:18"
  label.color=$STATUS_LABEL_COLOR
  label.padding_left=$PADDINGS
  label.padding_right=$PADDINGS
  padding_left=$PADDINGS
  padding_right=$PADDINGS
  icon.font="$TEXT_FONT:Bold:18"
  icon.padding_left=$PADDINGS
  icon.padding_right=$PADDINGS
  icon.color=$STATUS_ICON_COLOR
  icon.font.size=16
  icon.width=16
  scroll_texts=off
)

github_bell_defaults=(
  icon.font="$ICON_FONT:Bold:15.0"
  icon=$ICON_BELL
  icon.color=$(getcolor blue)
  label=$ICON_LOADING
  label.highlight_color=$GITHUB_COLOR
  popup.align=right
)

github_template_defaults=(
  drawing=off
  padding_left=$PADDINGS
  padding_right=$PADDINGS
  icon.font="$ICON_FONT:Regular:16"
  icon.background.height=2
  icon.padding_left=$PADDINGS
  icon.padding_right=$PADDINGS
  icon.color=$HIGHLIGHT
  label.font="$TEXT_FONT:Regular:16"
  background.color=$POPUP_BACKGROUND_COLOR
  background.corner_radius=16
  background.color=$(getcolor black 75)
  popup.blur_radius=61
  scroll_texts=off
)
separator=(
  background.height=1
  width=180
  background.color="$(getcolor white 25)"
  background.y_offset=-16
)
