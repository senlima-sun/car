import { TIRE_WEAR_CRITICAL, TIRE_WEAR_WARNING } from '@/constants/tires'
import { STATUS, ERS_MODE, AERO_MODE, ENGINE_BRAKING, GEAR, PERFORMANCE } from '@/constants/colors'

export function formatLapTime(ms: number): string {
  if (ms === 0) return '-:--.---'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = Math.floor(ms % 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

export function getBatteryColor(charge: number): string {
  if (charge > 50) return STATUS.success
  if (charge > 20) return STATUS.warning
  return STATUS.danger
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
      return ERS_MODE.attack
    case 'Balanced':
      return ERS_MODE.balanced
    case 'Harvest':
      return ERS_MODE.harvest
    case 'Overtake':
      return ERS_MODE.overtake
    default:
      return ERS_MODE.balanced
  }
}

export function getPresetAbbreviation(preset: string): string {
  switch (preset) {
    case 'Aggressive':
      return 'AGR'
    case 'Conservative':
      return 'CON'
    case 'Balanced':
    default:
      return 'BAL'
  }
}

export function getPresetColor(preset: string): string {
  switch (preset) {
    case 'Aggressive':
      return ERS_MODE.attack // Red for aggressive
    case 'Conservative':
      return ERS_MODE.harvest // Blue for conservative
    case 'Balanced':
    default:
      return ERS_MODE.balanced // Yellow for balanced
  }
}

export function getAeroColor(mode: string): string {
  return mode === 'Corner' ? AERO_MODE.corner : AERO_MODE.straight
}

export function getGearDisplay(gear: number): string {
  if (gear === -1) return 'R'
  if (gear === 0) return 'N'
  return gear.toString()
}

export function getGearColor(gear: number, rpm: number, maxRpm: number): string {
  if (rpm > maxRpm * 0.95) return GEAR.redline
  if (gear === -1) return GEAR.reverse
  if (gear === 0) return GEAR.neutral
  return GEAR.normal
}

export function getFPSColor(fps: number): string {
  if (fps >= 50) return PERFORMANCE.fpsGood
  if (fps >= 30) return PERFORMANCE.fpsWarning
  return PERFORMANCE.fpsBad
}

export function getEngineTempColor(tempNormalized: number): string {
  if (tempNormalized >= 0.9) return PERFORMANCE.tempCritical
  if (tempNormalized >= 0.7) return PERFORMANCE.tempHigh
  return PERFORMANCE.tempNormal
}

export function getTireWearColor(wear: number): string {
  if (wear >= TIRE_WEAR_CRITICAL) return PERFORMANCE.wearCritical
  if (wear >= TIRE_WEAR_WARNING) return PERFORMANCE.wearWarning
  return PERFORMANCE.wearGood
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
      return ENGINE_BRAKING.low
    case 'Medium':
      return ENGINE_BRAKING.medium
    case 'High':
      return ENGINE_BRAKING.high
    default:
      return ENGINE_BRAKING.medium
  }
}
