export const MAX_RPM = 15000
export const RPM_LIGHT_COUNT = 15

const ZONE_GREEN_END = 7
const ZONE_YELLOW_END = 12

const HIGHEST_LIT_GREEN_END = ZONE_GREEN_END + 1
const HIGHEST_LIT_YELLOW_END = ZONE_YELLOW_END + 1

export type RpmZone = 'idle' | 'green' | 'yellow' | 'red' | 'limiter'

const RPM_ZONE_COLORS: Record<RpmZone, string> = {
  idle: 'rgba(255,255,255,0.85)',
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
  limiter: '#ff2929',
}

const UNLIT_LIGHT_COLOR = 'rgba(255,255,255,0.06)'

export function rpmPercent(rpm: number): number {
  if (!Number.isFinite(rpm)) return rpm === Infinity ? 1 : 0
  if (rpm <= 0) return 0
  if (rpm >= MAX_RPM) return 1
  return rpm / MAX_RPM
}

export function litLights(rpm: number): number {
  return Math.round(rpmPercent(rpm) * RPM_LIGHT_COUNT)
}

export function rpmZone(litCount: number): RpmZone {
  if (litCount <= 0) return 'idle'
  if (litCount >= RPM_LIGHT_COUNT) return 'limiter'
  if (litCount < HIGHEST_LIT_GREEN_END) return 'green'
  if (litCount < HIGHEST_LIT_YELLOW_END) return 'yellow'
  return 'red'
}

export function rpmZoneColor(zone: RpmZone): string {
  return RPM_ZONE_COLORS[zone]
}

export function rpmLightColor(index: number, litCount: number): string {
  if (index >= litCount) return UNLIT_LIGHT_COLOR
  if (index < ZONE_GREEN_END) return RPM_ZONE_COLORS.green
  if (index < ZONE_YELLOW_END) return RPM_ZONE_COLORS.yellow
  return RPM_ZONE_COLORS.red
}

export function rpmDigitAnimation(litCount: number): string | undefined {
  return rpmZone(litCount) === 'limiter' ? 'hud-shift 0.18s linear infinite' : undefined
}
