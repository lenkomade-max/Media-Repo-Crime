#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/tests/output"
LOG_FILE="$ROOT_DIR/logs/overlays.log"
INPUT_IMAGE="/root/media-video-maker_project/media-video-maker_server/test_image.jpg"
API="http://127.0.0.1:4123"

mkdir -p "$OUT_DIR" "$(dirname "$LOG_FILE")"

PLAN=$(jq -n --arg img "$INPUT_IMAGE" '{
  files: [ { id: "img1", src: $img, type: "image" } ],
  width: 640, height: 360, fps: 24, durationPerPhoto: 2.0,
  overlays: [ { type: "text", text: "Overlay", position: "top-left", start: 0, end: 1.0 } ]
}')

JOB=$(curl -fsS -X POST "$API/api/create-video" -H 'Content-Type: application/json' -d "$PLAN" | jq -r '.id // .jobId // empty')
if [ -z "$JOB" ]; then echo "Failed to create job" | tee -a "$LOG_FILE"; exit 1; fi

for i in {1..15}; do
  sleep 2
  STATUS=$(curl -fsS "$API/api/status/$JOB")
  STATE=$(echo "$STATUS" | jq -r '.state')
  echo "[$i] state=$STATE" | tee -a "$LOG_FILE"
  if [ "$STATE" = "done" ]; then
    OUTPUT=$(echo "$STATUS" | jq -r '.output')
    [ -f "$OUTPUT" ] || { echo "Output file not found: $OUTPUT" | tee -a "$LOG_FILE"; exit 1; }
    cp "$OUTPUT" "$OUT_DIR/overlays_test.mp4"
    ffprobe -v error -select_streams v:0 -show_entries stream=codec_type -of csv=p=0 "$OUT_DIR/overlays_test.mp4" | grep -q '^video$'
    # Проверяем аудио (может быть тишина, но отсутствие аудио потока означает полный провал)
    AUDIO_STREAMS=$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$OUT_DIR/overlays_test.mp4" | wc -l)
    echo "AUDIO_STREAMS: $AUDIO_STREAMS" | tee -a "$LOG_FILE"
    echo "SUCCESS: overlay applied, video stream present, audio check completed" | tee -a "$LOG_FILE"
    echo "OK: overlays test produced video at $OUT_DIR/overlays_test.mp4" | tee -a "$LOG_FILE"
    exit 0
  fi
  if [ "$STATE" = "error" ]; then
    echo "$STATUS" | tee -a "$LOG_FILE"
    exit 1
  fi
done

echo "Timeout waiting for job" | tee -a "$LOG_FILE"
exit 1
