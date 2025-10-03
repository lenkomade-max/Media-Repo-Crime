#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TESTS_DIR="$ROOT_DIR/tests"
LOGS_DIR="$ROOT_DIR/logs"
OUTPUT_DIR="$TESTS_DIR/output"

mkdir -p "$OUTPUT_DIR" "$LOGS_DIR"

modules=(subtitles voiceover overlays music)

declare -A results

for m in "${modules[@]}"; do
  test_script="$TESTS_DIR/test_${m}.sh"
  log_file="$LOGS_DIR/${m}.log"
  echo "[RUN] $m" | tee "$log_file"
  if [ -x "$test_script" ]; then
    if "$test_script" > >(tee -a "$log_file") 2>&1; then
      results[$m]=OK
    else
      results[$m]=FAIL
    fi
  else
    echo "Test script not found or not executable: $test_script" | tee -a "$log_file"
    results[$m]=MISSING
  fi
  echo
done

echo "=== SUMMARY ==="
status=0
for m in "${modules[@]}"; do
  echo "$m: ${results[$m]:-MISSING}"
  if [ "${results[$m]:-MISSING}" != "OK" ]; then
    status=1
  fi
done

exit $status
