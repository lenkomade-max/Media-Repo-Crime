#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/tests/output"
LOG_FILE="$ROOT_DIR/logs/subtitles.log"
INPUT_IMAGE="$ROOT_DIR/test_image.jpg"
API="http://127.0.0.1:4123"

mkdir -p "$OUT_DIR" "$(dirname "$LOG_FILE")"

# Minimal plan with burnSubtitles=true and a dummy voice track disabled
PLAN=$(jq -n --arg img "$INPUT_IMAGE" '{
  files: [ { id: "img1", src: $img, type: "image" } ],
  width: 640, height: 360, fps: 24, durationPerPhoto: 2.0,
  transcribeAudio: false, burnSubtitles: true,
  overlays: [ { type: "text", text: "Тест субтитров", position: "bottom-center", start: 0, end: 1.5 } ]
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
    cp "$OUTPUT" "$OUT_DIR/subtitles_test.mp4"
    # Basic verification: file exists and has video stream; deeper subtitle check requires ffprobe filters
    ffprobe -v error -select_streams v:0 -show_entries stream=codec_type -of csv=p=0 "$OUT_DIR/subtitles_test.mp4" | grep -q '^video$'
    echo "OK: subtitles test produced video at $OUT_DIR/subtitles_test.mp4" | tee -a "$LOG_FILE"
    exit 0
  fi
  if [ "$STATE" = "error" ]; then
    echo "$STATUS" | tee -a "$LOG_FILE"
    exit 1
  fi
done

echo "Timeout waiting for job" | tee -a "$LOG_FILE"
exit 1
