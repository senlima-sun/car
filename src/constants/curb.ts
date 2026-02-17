import type { CurbType } from '../types/trackObjects'

export const CURB_WIDTH = 0.8
export const STRIPE_WIDTH = 0.45
export const TOOTH_SPACING = 0.8

export const TOOTH_RAMP = 0.15
export const TOOTH_FLAT = 0.45
export const TOOTH_DROP = 0.15
export const TOOTH_GAP = 0.25

export function getSawtoothHeight(arcPos: number): number {
  const t = (((arcPos / TOOTH_SPACING) % 1) + 1) % 1
  if (t < TOOTH_RAMP) {
    return t / TOOTH_RAMP
  } else if (t < TOOTH_RAMP + TOOTH_FLAT) {
    return 1.0
  } else if (t < TOOTH_RAMP + TOOTH_FLAT + TOOTH_DROP) {
    return 1.0 - (t - TOOTH_RAMP - TOOTH_FLAT) / TOOTH_DROP
  }
  return 0.0
}

export const CURB_PEAK_HEIGHTS: Record<CurbType, number> = {
  apex: 0.05,
  exit: 0.08,
  flat: 0.002,
}

export const CURB_PEAK_HEIGHT = CURB_PEAK_HEIGHTS.apex

export const CURB_PHYSICS_PER_TYPE: Record<
  CurbType,
  { grip: number; drag: number; stability: number }
> = {
  apex: { grip: 0.97, drag: 1.1, stability: 0.95 },
  exit: { grip: 0.93, drag: 1.15, stability: 0.9 },
  flat: { grip: 0.98, drag: 1.02, stability: 0.98 },
}

export const APEX_PROFILE = [
  { x: 0, y: 0 },
  { x: 0.1, y: 0.015 },
  { x: 0.2, y: 0.03 },
  { x: 0.4, y: 0.05 },
  { x: 0.6, y: 0.05 },
  { x: 0.8, y: 0.05 },
]

export const EXIT_PROFILE = [
  { x: 0, y: 0 },
  { x: 0.1, y: 0.02 },
  { x: 0.3, y: 0.06 },
  { x: 0.5, y: 0.08 },
  { x: 0.7, y: 0.08 },
  { x: 0.8, y: 0.08 },
]

export const FLAT_PROFILE = [
  { x: 0, y: 0 },
  { x: 0.2, y: 0.001 },
  { x: 0.4, y: 0.002 },
  { x: 0.6, y: 0.002 },
  { x: 0.8, y: 0.001 },
]

export const CURB_PROFILE = APEX_PROFILE

export function getProfileForType(curbType: CurbType) {
  switch (curbType) {
    case 'apex':
      return APEX_PROFILE
    case 'exit':
      return EXIT_PROFILE
    case 'flat':
      return FLAT_PROFILE
  }
}

export function getCurbHeightAt(normalizedX: number, curbType: CurbType = 'apex'): number {
  const profile = getProfileForType(curbType)
  const x = normalizedX * CURB_WIDTH

  for (let i = 0; i < profile.length - 1; i++) {
    const p1 = profile[i]
    const p2 = profile[i + 1]

    if (x >= p1.x && x <= p2.x) {
      const t = (x - p1.x) / (p2.x - p1.x)
      return p1.y + t * (p2.y - p1.y)
    }
  }

  return 0
}
