#!/bin/bash

source "$CONFIG_DIR/globalstyles.sh"
source "$CONFIG_DIR/colors.sh"

update() {
  NOTIFICATIONS="$(gh api notifications)"
  COUNT="$(echo "$NOTIFICATIONS" | jq 'length')"
  args=()
  if [ "$NOTIFICATIONS" = "[]" ]; then
    args+=(--set $NAME icon=$ICON_BELL label="0")
  else
    args+=(--set $NAME icon=$ICON_BELL_DOT label="$COUNT")
  fi

  PREV_COUNT=$(sketchybar --query github.bell | jq -r .label.value)
  # For sound to play around with:
  # afplay /System/Library/Sounds/Morse.aiff

  args+=(--remove '/github.notification\.*/')

  COUNTER=0
  COLOR=$(getcolor blue)
  args+=(--set github.bell icon.color=$COLOR)

  while read -r repo url type title; do
    COUNTER=$((COUNTER + 1))
    IMPORTANT="$(echo "$title" | egrep -i "(deprecat|break|broke)")"
    COLOR=$(getcolor blue)
    PADDING=0

    if [ "${repo}" = "" ] && [ "${title}" = "" ]; then
      repo="Note"
      title="No new notifications"
    fi
    case "${type}" in
    "'Issue'")
      COLOR=$(getcolor green)
      ICON=$GIT_ISSUE
      URL="$(gh api "$(echo "${url}" | sed -e "s/^'//" -e "s/'$//")" | jq .html_url)"
      ;;
    "'Discussion'")
      COLOR=$(getcolor white)
      ICON=$GIT_DISCUSSION
      URL="https://www.github.com/notifications"
      ;;
    "'PullRequest'")
      COLOR=$(getcolor maroon)
      ICON=$GIT_PULL_REQUEST
      URL="$(gh api "$(echo "${url}" | sed -e "s/^'//" -e "s/'$//")" | jq .html_url)"
      ;;
    "'Commit'")
      COLOR=$(getcolor white)
      ICON=$GIT_COMMIT
      URL="$(gh api "$(echo "${url}" | sed -e "s/^'//" -e "s/'$//")" | jq .html_url)"
      ;;
    esac

    if [ "$IMPORTANT" != "" ]; then
      COLOR=$(getcolor red)
      ICON=􀁞
      args+=(--set github.bell icon.color=$COLOR)
    fi

    notification=(
      icon="$ICON $(echo "$repo" | sed -e "s/^'//" -e "s/'$//"):"
      icon.color=$COLOR
      label="$(echo "$title" | sed -e "s/^'//" -e "s/'$//")"
      position=popup.github.bell
      drawing=on
      click_script="open $URL; sketchybar --set github.bell popup.drawing=off"
    )

    args+=(--clone github.notification.$COUNTER github.template
      --set github.notification.$COUNTER "${notification[@]}")
  done <<<"$(echo "$NOTIFICATIONS" | jq -r '.[] | [.repository.name, .subject.latest_comment_url, .subject.type, .subject.title] | @sh')"

  sketchybar -m "${args[@]}" >/dev/null

  if [ $COUNT -gt $PREV_COUNT ] 2>/dev/null || [ "$SENDER" = "forced" ]; then
    sketchybar --animate tanh 15 --set github.bell label.y_offset=5 label.y_offset=-2
  fi
}

popup() {
  sketchybar --set $NAME popup.drawing=$1
}

case "$SENDER" in
"routine" | "forced")
  update
  ;;
"mouse.entered")
  popup on
  ;;
"mouse.exited" | "mouse.exited.global")
  popup off
  ;;
"mouse.clicked")
  popup toggle
  ;;
esac
