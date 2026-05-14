import { create } from 'zustand'
import type { WindState as PhysicsWindState } from '@/wasm'

interface WindStore {
  // Wind parameters
  direction: number // radians
  speed: number // m/s
  enabled: boolean

  // Current state from physics (synced each frame)
  currentSpeed: number // with gusts
  gustIntensity: number

  // Actions
  setWind: (direction: number, speed: number) => void
  setEnabled: (enabled: boolean) => void
  toggle: () => void
  syncFromPhysics: (state: PhysicsWindState) => void
}

export const useWindStore = create<WindStore>(set => ({
  // Default: moderate wind from the west
  direction: Math.PI, // West wind (blowing east)
  speed: 8, // 8 m/s (~29 km/h) - moderate wind
  enabled: true,
  currentSpeed: 8,
  gustIntensity: 0,

  setWind: (direction, speed) =>
    set({
      direction,
      speed: Math.max(0, Math.min(25, speed)), // Clamp to 0-25 m/s
    }),

  setEnabled: enabled => set({ enabled }),

  toggle: () => set(state => ({ enabled: !state.enabled })),

  syncFromPhysics: state =>
    set({
      currentSpeed: state.current_speed,
      gustIntensity: state.gust_intensity,
    }),
}))

// Wind direction helpers
export const WIND_DIRECTIONS = {
  N: Math.PI / 2, // +Z
  NE: Math.PI / 4,
  E: 0, // +X
  SE: -Math.PI / 4,
  S: -Math.PI / 2, // -Z
  SW: (-3 * Math.PI) / 4,
  W: Math.PI, // -X
  NW: (3 * Math.PI) / 4,
} as const

export function getWindDirectionName(radians: number): string {
  // Normalize to [0, 2π)
  const normalized = ((radians % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)

  // Find closest direction
  const directions = [
    { name: 'E', angle: 0 },
    { name: 'NE', angle: Math.PI / 4 },
    { name: 'N', angle: Math.PI / 2 },
    { name: 'NW', angle: (3 * Math.PI) / 4 },
    { name: 'W', angle: Math.PI },
    { name: 'SW', angle: (5 * Math.PI) / 4 },
    { name: 'S', angle: (3 * Math.PI) / 2 },
    { name: 'SE', angle: (7 * Math.PI) / 4 },
  ]

  let closest = directions[0]
  let minDiff = Math.abs(normalized - directions[0].angle)

  for (const dir of directions) {
    const diff = Math.min(
      Math.abs(normalized - dir.angle),
      Math.abs(normalized - dir.angle + 2 * Math.PI),
      Math.abs(normalized - dir.angle - 2 * Math.PI),
    )
    if (diff < minDiff) {
      minDiff = diff
      closest = dir
    }
  }

  return closest.name
}

export function windSpeedToKmh(ms: number): number {
  return ms * 3.6
}

export function windSpeedDescription(ms: number): string {
  if (ms < 0.5) return 'Calm'
  if (ms < 3) return 'Light'
  if (ms < 8) return 'Moderate'
  if (ms < 14) return 'Fresh'
  if (ms < 20) return 'Strong'
  return 'Storm'
}
