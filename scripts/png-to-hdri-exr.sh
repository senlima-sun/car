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
  clear)    HI_BOOST=8.0 ;;
  sunset)   HI_BOOST=6.0 ;;
  cloudy)   HI_BOOST=3.0 ;;
  overcast) HI_BOOST=2.0 ;;
  rain)     HI_BOOST=1.5 ;;
  storm)    HI_BOOST=2.5 ;;
  *) echo "Unknown preset: $PRESET"; exit 1 ;;
esac

echo "→ Input:   $INPUT"
echo "→ Output:  $OUTPUT"
echo "→ Preset:  $PRESET (highlight boost ×$HI_BOOST)"

DIMS=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$INPUT")
echo "→ Source:  $DIMS"

# Filter chain (run order):
#   1. scale to 2048×1024 (lanczos, force 2:1) — input is 8-bit at this point
#   2. lutrgb — sRGB→linear gamma decode + soft highlight boost.
#      Operating on 8-bit input where val is 0..255. Normalize to 0..1, apply
#      pow(2.2), apply soft highlight boost, then re-scale back to 0..255 so
#      lutrgb can clamp/store into the next stage.
#      Wait — lutrgb on 8-bit clamps output to 0..255, killing HDR. We need
#      to boost AFTER promoting to float.
#   3. format gbrpf32le — promote to 32-bit float
#   4. zscale or geq for HDR boost in float pix_fmt where val IS already 0..1
#
# Final approach: do gamma decode in 8-bit lutrgb (0..1 normalized via /255 and
# *255), then promote to float, then use geq to multiply by HI_BOOST in float
# space where values are already 0..1.

ffmpeg -y -hide_banner -loglevel warning \
  -i "$INPUT" \
  -vf "scale=2048:1024:flags=lanczos,lutrgb=r='clip(pow(val/255,2.2)*255,0,255)':g='clip(pow(val/255,2.2)*255,0,255)':b='clip(pow(val/255,2.2)*255,0,255)',format=gbrpf32le,geq=r='r(X,Y)*(1+(${HI_BOOST}-1)*pow(min(r(X,Y),1),1.5))':g='g(X,Y)*(1+(${HI_BOOST}-1)*pow(min(g(X,Y),1),1.5))':b='b(X,Y)*(1+(${HI_BOOST}-1)*pow(min(b(X,Y),1),1.5))'" \
  -c:v exr \
  -compression zip16 \
  -format float \
  "$OUTPUT"

SIZE=$(ls -lh "$OUTPUT" | awk '{print $5}')
echo "✓ Wrote $OUTPUT ($SIZE)"
