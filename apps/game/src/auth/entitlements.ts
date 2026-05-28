// Mirror of apps/api/src/entitlements/features.ts — kept in sync via apps/api/test/entitlements-parity.test.ts

export interface FeatureMatrix {
  raceMode: 'unlimited' | 'daily-only' | 'denied'
  timeTrial: boolean
  ghost: boolean
  editor: boolean
  trackPreview: boolean
  showroomBasic: boolean
  showroomFull: boolean
  telemetryExport: boolean
  cloudLeaderboardRead: boolean
  cloudLeaderboardWrite: boolean
}

export interface EntitlementInput {
  role: 'user' | 'admin'
  tier: 'pro' | null
}

const ALL_PERMISSIVE: Readonly<FeatureMatrix> = Object.freeze({
  raceMode: 'unlimited',
  timeTrial: true,
  ghost: true,
  editor: true,
  trackPreview: true,
  showroomBasic: true,
  showroomFull: true,
  telemetryExport: true,
  cloudLeaderboardRead: true,
  cloudLeaderboardWrite: true,
})

const FREE: Readonly<FeatureMatrix> = Object.freeze({
  raceMode: 'daily-only',
  timeTrial: false,
  ghost: false,
  editor: false,
  trackPreview: true,
  showroomBasic: true,
  showroomFull: false,
  telemetryExport: false,
  cloudLeaderboardRead: true,
  cloudLeaderboardWrite: false,
})

export function getEntitlements({ role, tier }: EntitlementInput): Readonly<FeatureMatrix> {
  if (role === 'admin') return ALL_PERMISSIVE
  if (tier === 'pro') return ALL_PERMISSIVE
  return FREE
}
