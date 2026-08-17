#!/usr/bin/env bash
#
# Generate test media fixtures for performance tests.
# Requires ffmpeg to be installed or available via node_modules/ffmpeg-static.
#
set -euo pipefail

FIXTURES_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$FIXTURES_DIR/.." && pwd)"

# Resolve ffmpeg binary
FFMPEG=""
if [ -f "$PROJECT_ROOT/node_modules/ffmpeg-static/ffmpeg.exe" ]; then
  FFMPEG="$PROJECT_ROOT/node_modules/ffmpeg-static/ffmpeg.exe"
elif [ -f "$PROJECT_ROOT/node_modules/ffmpeg-static" ]; then
  FFMPEG="$PROJECT_ROOT/node_modules/ffmpeg-static"
elif command -v ffmpeg &>/dev/null; then
  FFMPEG="ffmpeg"
else
  echo "ERROR: ffmpeg not found. Install npm dependencies first." >&2
  exit 1
fi

echo "Using ffmpeg: $FFMPEG"

# Generate test clips of various durations and resolutions
generate_clip() {
  local name="$1"
  local duration="$2"
  local width="$3"
  local height="$4"
  local output="$FIXTURES_DIR/$name.mp4"

  if [ -f "$output" ]; then
    echo "  [SKIP] $name.mp4 (exists)"
    return
  fi

  echo "  [GEN] $name.mp4 (${width}x${height}, ${duration}s)"
  "$FFMPEG" -y -hide_banner -loglevel error \
    -f lavfi -i "testsrc=duration=$duration:size=${width}x${height}:rate=30" \
    -f lavfi -i "sine=frequency=440:duration=$duration" \
    -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
    -c:a aac -b:a 128k \
    "$output"
}

echo "=== Generating test media fixtures ==="
echo ""

# Small clips for fast tests
generate_clip "test-5s-480p"   5   854  480
generate_clip "test-5s-720p"   5   1280 720
generate_clip "test-5s-1080p"  5   1920 1080

# Medium clips for throughput tests
generate_clip "test-10s-1080p" 10  1920 1080
generate_clip "test-30s-1080p" 30  1920 1080

# Longer clip for waveform/extraction tests
generate_clip "test-300s-1080p" 300 1920 1080

# Many small clips for batch testing
for i in $(seq 1 20); do
  generate_clip "batch-$i" 3 640 360
done

echo ""
echo "=== Done ==="
echo "Fixtures in: $FIXTURES_DIR"
ls -lh "$FIXTURES_DIR"/*.mp4 2>/dev/null || dir "$FIXTURES_DIR\*.mp4" 2>nul
