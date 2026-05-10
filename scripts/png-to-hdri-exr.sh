#!/usr/bin/env bash
set -euo pipefail

# Convert ChatGPT PNG output → HDR EXR for Three.js HDRI pipeline.
#
# Usage:
#   ./scripts/png-to-hdri-exr.sh <input.png> [output.exr] [--preset clear|cloudy|overcast|rain|storm|sunset]
#
# What it does:
#   1) Resizes to 2048×1024 (lanczos) — forces 2:1 equirectangular ratio
#   2) Converts sRGB → linear via ffmpeg's native gamma decode (gamma 2.2)
#   3) Boosts highlights in linear space (fakes HDR sun/bright clouds)
#   4) Encodes to OpenEXR (zip16 compression, float32)
#
# Requires: ffmpeg (already installed)

if [ $# -lt 1 ]; then
  echo "Usage: $0 <input.png> [output.exr] [--preset clear|cloudy|overcast|rain|storm|sunset]"
  exit 1
fi

INPUT="$1"
shift || true

if [ ! -f "$INPUT" ]; then
  echo "Error: input file not found: $INPUT"
  exit 1
fi

DEFAULT_OUT="$(dirname "$INPUT")/$(basename "${INPUT%.*}").exr"
OUTPUT="${1:-$DEFAULT_OUT}"
if [[ "${OUTPUT}" == --* ]]; then
  OUTPUT="$DEFAULT_OUT"
else
  shift || true
fi

PRESET="clear"
while [ $# -gt 0 ]; do
  case "$1" in
    --preset) PRESET="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

case "$PRESET" in
  clear)    HI_BOOST=4.0 ;;
  sunset)   HI_BOOST=3.0 ;;
  cloudy)   HI_BOOST=2.0 ;;
  overcast) HI_BOOST=1.3 ;;
  rain)     HI_BOOST=1.1 ;;
  storm)    HI_BOOST=1.5 ;;
  *) echo "Unknown preset: $PRESET"; exit 1 ;;
esac

HI_THRESHOLD=0.85

echo "→ Input:   $INPUT"
echo "→ Output:  $OUTPUT"
echo "→ Preset:  $PRESET (highlight boost ×$HI_BOOST)"

DIMS=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$INPUT")
echo "→ Source:  $DIMS"

# Filter chain (run order):
#   1. scale to 2048×1024 (lanczos, force 2:1) — input is 8-bit at this point
#   2. lutrgb (8-bit space) — sRGB→linear gamma decode (val 0..255 normalized)
#   3. format gbrpf32le — promote to 32-bit float
#   4. geq — threshold-gated HDR boost. Linear values BELOW HI_THRESHOLD are
#      passed through unchanged (LDR mid/shadow tones stay correctly exposed).
#      Values ABOVE the threshold get scaled by (HI_BOOST-1)*excess pushed
#      into HDR range. This means:
#        - Sky / mid-tone clouds (linear 0.2-0.8): unchanged, ACES maps to
#          natural display brightness
#        - Bright highlights (linear > 0.85, near-white pixels): pushed to
#          1.0 .. HI_BOOST, gives HDR sun / cloud-top brightness
#
# Without the threshold, applying a uniform multiplier to the whole image
# pushes 30-40% of sky pixels above 1.0 and ACES tonemaps the entire image
# to white. The threshold restricts boost to the brightest ~15% of pixels.

ffmpeg -y -hide_banner -loglevel warning \
  -i "$INPUT" \
  -vf "scale=2048:1024:flags=lanczos,lutrgb=r='clip(pow(val/255,2.2)*255,0,255)':g='clip(pow(val/255,2.2)*255,0,255)':b='clip(pow(val/255,2.2)*255,0,255)',format=gbrpf32le,geq=r='if(gt(r(X,Y),${HI_THRESHOLD}),r(X,Y)+(r(X,Y)-${HI_THRESHOLD})*(${HI_BOOST}-1)/(1-${HI_THRESHOLD}),r(X,Y))':g='if(gt(g(X,Y),${HI_THRESHOLD}),g(X,Y)+(g(X,Y)-${HI_THRESHOLD})*(${HI_BOOST}-1)/(1-${HI_THRESHOLD}),g(X,Y))':b='if(gt(b(X,Y),${HI_THRESHOLD}),b(X,Y)+(b(X,Y)-${HI_THRESHOLD})*(${HI_BOOST}-1)/(1-${HI_THRESHOLD}),b(X,Y))'" \
  -c:v exr \
  -compression zip16 \
  -format float \
  "$OUTPUT"

SIZE=$(ls -lh "$OUTPUT" | awk '{print $5}')
echo "✓ Wrote $OUTPUT ($SIZE)"
