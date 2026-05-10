#!/usr/bin/env bash
set -euo pipefail

# Repair over-boosted EXR HDRIs in place.
#
# The original png-to-hdri-exr.sh applied a uniform soft curve that pushed
# 30-40% of sky pixels above linear 1.0, which ACES tonemaps to pure white.
# This script rescales the EXR so that mid-tones (linear < 0.85) divide by
# the original boost factor (back to LDR range), while highlights (>= 0.85)
# stay close to their HDR values.
#
# Usage:
#   ./scripts/fix-hdri-exposure.sh <input.exr> <output.exr> <original_boost>
#
# The original_boost is the HI_BOOST that was applied during creation:
#   ClearMidday   → 8.0
#   GoldenHour    → 6.0
#   ScatteredCl   → 3.0
#   Overcast      → 2.0
#   LightDrizzle  → 1.5
#   HeavyRain     → 1.5
#   StormFront    → 2.5
#   OvercastDusk  → 6.0  (tagged as sunset)

if [ $# -lt 3 ]; then
  echo "Usage: $0 <input.exr> <output.exr> <original_boost>"
  exit 1
fi

INPUT="$1"
OUTPUT="$2"
ORIG_BOOST="$3"

# Soft inverse: target mean linear ~0.5 (ACES sweet spot for mid-tones).
# Use boost^0.4 as the inverse strength — for boost=8 → ÷2.3, for boost=2 → ÷1.32.
# Stronger than sqrt(boost) on small boosts, gentler on large ones.
INV_SCALE=$(python3 -c "print(1.0 / (${ORIG_BOOST} ** 0.4))")

echo "→ Input:    $INPUT"
echo "→ Output:   $OUTPUT"
echo "→ Inverse:  ×${INV_SCALE}"

ffmpeg -y -hide_banner -loglevel warning \
  -i "$INPUT" \
  -vf "format=gbrpf32le,geq=r='r(X,Y)*${INV_SCALE}':g='g(X,Y)*${INV_SCALE}':b='b(X,Y)*${INV_SCALE}'" \
  -c:v exr \
  -compression zip16 \
  -format float \
  "$OUTPUT"

ls -lh "$OUTPUT"
