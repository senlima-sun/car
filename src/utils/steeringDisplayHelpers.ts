import { TIRE_WEAR_CRITICAL, TIRE_WEAR_WARNING } from '@/constants/tires'

export function formatLapTime(ms: number): string {
  if (ms === 0) return '-:--.---'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = Math.floor(ms % 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

export function getBatteryColor(charge: number): string {
  if (charge > 50) return '#22c55e'
  if (charge > 20) return '#f59e0b'
  return '#ef4444'
}

export function getModeAbbreviation(mode: string): string {
  switch (mode) {
    case 'Attack':
      return 'ATK'
    case 'Balanced':
      return 'BAL'
    case 'Harvest':
      return 'HRV'
    case 'Overtake':
      return 'OVT'
    default:
      return 'BAL'
  }
}

export function getAeroAbbreviation(mode: string): string {
  return mode === 'Corner' ? 'CRN' : 'STR'
}

export function getModeColor(mode: string): string {
  switch (mode) {
    case 'Attack':
      return '#22c55e'
    case 'Balanced':
      return '#ffffff'
    case 'Harvest':
      return '#3b82f6'
    case 'Overtake':
      return '#f97316'
    default:
      return '#ffffff'
  }
}

export function getAeroColor(mode: string): string {
  return mode === 'Corner' ? '#3b82f6' : '#22c55e'
}

export function getGearDisplay(gear: number): string {
  if (gear === -1) return 'R'
  if (gear === 0) return 'N'
  return gear.toString()
}

export function getGearColor(gear: number, rpm: number, maxRpm: number): string {
  if (rpm > maxRpm * 0.95) return '#ff0000'
  if (gear === -1) return '#ef4444'
  if (gear === 0) return '#f59e0b'
  return '#ffffff'
}

export function getFPSColor(fps: number): string {
  if (fps >= 50) return '#4ade80' // green
  if (fps >= 30) return '#facc15' // yellow
  return '#f87171' // red
}

export function getEngineTempColor(tempNormalized: number): string {
  if (tempNormalized >= 0.9) return '#ef4444' // Red (critical)
  if (tempNormalized >= 0.7) return '#f59e0b' // Orange (high)
  return '#22c55e' // Green (normal)
}

export function getTireWearColor(wear: number): string {
  if (wear >= TIRE_WEAR_CRITICAL) return '#ef4444' // Red
  if (wear >= TIRE_WEAR_WARNING) return '#f59e0b' // Orange/Amber
  return '#22c55e' // Green
}

export function getEngineBrakingAbbrev(level: string): string {
  switch (level) {
    case 'Low':
      return 'L'
    case 'Medium':
      return 'M'
    case 'High':
      return 'H'
    default:
      return 'M'
  }
}

export function getEngineBrakingColor(level: string): string {
  switch (level) {
    case 'Low':
      return '#3b82f6' // Blue
    case 'Medium':
      return '#22c55e' // Green
    case 'High':
      return '#f97316' // Orange
    default:
      return '#22c55e'
  }
}
