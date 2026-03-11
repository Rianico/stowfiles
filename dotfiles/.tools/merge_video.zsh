combine_mp4() {
  if [ $# -ne 3 ]; then
    echo "Usage: combine_mp4 <input1> <input2> <output>"
    return 1
  fi
  ffmpeg -i "$1" -i "$2" -filter:a "loudnorm=I=-16:LRA=11:TP=-1.5" -c:v copy -c:a aac -b:a 192k "$3"
}
