import { useAuthOptional } from './AuthProvider'
import type { FeatureMatrix } from './entitlements'

export interface FeatureGateResult {
  allowed: boolean
  reason: 'pro_required' | 'auth_required' | null
}

export function useFeatureGate(feature: keyof FeatureMatrix): FeatureGateResult {
  const ctx = useAuthOptional()
  if (!ctx || !ctx.entitlements) return { allowed: false, reason: 'auth_required' }
  if (feature === 'raceMode') return { allowed: true, reason: null }
  const value = ctx.entitlements[feature]
  const allowed = value === true
  return { allowed, reason: allowed ? null : 'pro_required' }
}
