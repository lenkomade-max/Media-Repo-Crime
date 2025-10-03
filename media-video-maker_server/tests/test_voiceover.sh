#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/tests/output"
LOG_FILE="$ROOT_DIR/logs/voiceover.log"
INPUT_IMAGE="$ROOT_DIR/test_image.jpg"
API="http://127.0.0.1:4123"

mkdir -p "$OUT_DIR" "$(dirname "$LOG_FILE")"

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "OPENAI_API_KEY not set, skipping voiceover test" | tee -a "$LOG_FILE"
  exit 0
fi

PLAN=$(jq -n --arg img "$INPUT_IMAGE" '{
  files: [ { id: "img1", src: $img, type: "image" } ],
  width: 640, height: 360, fps: 24, durationPerPhoto: 2.0,
  tts: { provider: "openai", voice: "alloy" },
  ttsText: "Тест озвучки",
  burnSubtitles: false
}')

JOB=$(curl -fsS -X POST "$API/api/create-video" -H 'Content-Type: application/json' -d "$PLAN" | jq -r '.id // .jobId // empty')
if [ -z "$JOB" ]; then echo "Failed to create job" | tee -a "$LOG_FILE"; exit 1; fi

for i in {1..20}; do
  sleep 2
  STATUS=$(curl -fsS "$API/api/status/$JOB")
  STATE=$(echo "$STATUS" | jq -r '.state')
  echo "[$i] state=$STATE" | tee -a "$LOG_FILE"
  if [ "$STATE" = "done" ]; then
    OUTPUT=$(echo "$STATUS" | jq -r '.output')
    [ -f "$OUTPUT" ] || { echo "Output file not found: $OUTPUT" | tee -a "$LOG_FILE"; exit 1; }
    cp "$OUTPUT" "$OUT_DIR/voiceover_test.mp4"
    # Verify audio stream presence
    ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of csv=p=0 "$OUT_DIR/voiceover_test.mp4" | grep -q '^audio$'
    echo "OK: voiceover test produced audio track at $OUT_DIR/voiceover_test.mp4" | tee -a "$LOG_FILE"
    exit 0
  fi
  if [ "$STATE" = "error" ]; then
    echo "$STATUS" | tee -a "$LOG_FILE"
    exit 1
  fi
done

echo "Timeout waiting for job" | tee -a "$LOG_FILE"
exit 1
