export interface SunDirection {
  x: number
  y: number
  z: number
}

const DEFAULT_LATITUDE_DEG = 51.5

export function computeSunDirection(
  hourOfDay: number,
  latitudeDeg: number = DEFAULT_LATITUDE_DEG,
): SunDirection {
  const hour = ((hourOfDay % 24) + 24) % 24

  const t = hour / 24

  const azimuth = t * Math.PI * 2 - Math.PI / 2

  const dayPhase = Math.cos(((hour - 12) / 12) * Math.PI)
  const peakElevationDeg = 90 - Math.abs(latitudeDeg)
  const peakElevationRad = (peakElevationDeg * Math.PI) / 180
  const sinElev = dayPhase * Math.sin(peakElevationRad)
  const cosElev = Math.sqrt(Math.max(0, 1 - sinElev * sinElev))

  const x = cosElev * Math.cos(azimuth)
  const y = sinElev
  const z = cosElev * Math.sin(azimuth)

  return { x, y, z }
}

export function isSunAboveHorizon(hourOfDay: number, latitudeDeg?: number): boolean {
  return computeSunDirection(hourOfDay, latitudeDeg).y > 0
}

export function getSunIntensity(hourOfDay: number, latitudeDeg?: number): number {
  const sun = computeSunDirection(hourOfDay, latitudeDeg)
  return Math.max(0, sun.y)
}
