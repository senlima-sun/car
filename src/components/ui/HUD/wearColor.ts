import { TIRE_WEAR_CRITICAL, TIRE_WEAR_WARNING } from '../../../constants/tires'
import { STATUS } from '../../../constants/colors'

export function wearColor(wear: number): string {
  if (!Number.isFinite(wear)) return STATUS.success
  if (wear >= TIRE_WEAR_CRITICAL) return STATUS.danger
  if (wear >= TIRE_WEAR_WARNING) return STATUS.warning
  return STATUS.success
}

export function isWearCritical(wear: number): boolean {
  return Number.isFinite(wear) && wear >= TIRE_WEAR_CRITICAL
}
