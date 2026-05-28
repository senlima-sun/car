import { renderToString } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { FeatureMatrix } from './entitlements'

const freeEntitlements: FeatureMatrix = {
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
}

const proEntitlements: FeatureMatrix = {
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
}

let mockContextValue: ReturnType<typeof makeCtx> | null = null

vi.mock('./AuthProvider', () => ({
  useAuthOptional: () => mockContextValue,
}))

const { useFeatureGate } = await import('./useFeatureGate')

function GateProbe({ feature }: { feature: keyof FeatureMatrix }) {
  const result = useFeatureGate(feature)
  return <span data-allowed={String(result.allowed)} data-reason={result.reason ?? 'null'} />
}

function render(feature: keyof FeatureMatrix) {
  const html = renderToString(<GateProbe feature={feature} />)
  const allowed = /data-allowed="true"/.test(html)
  const reasonMatch = /data-reason="([^"]*)"/.exec(html)
  const reason = reasonMatch?.[1] === 'null' ? null : reasonMatch?.[1]
  return { allowed, reason }
}

function makeCtx(entitlements: FeatureMatrix | null) {
  return { client: {} as never, session: null, isPending: false, error: null, entitlements }
}

describe('useFeatureGate', () => {
  test('no context → auth_required for every feature', () => {
    mockContextValue = null
    expect(render('editor')).toEqual({ allowed: false, reason: 'auth_required' })
  })

  test('context present but entitlements null → allowed:true (unauthed in root subtree)', () => {
    mockContextValue = makeCtx(null)
    expect(render('editor')).toEqual({ allowed: true, reason: null })
  })

  test('free entitlements: editor is pro_required', () => {
    mockContextValue = makeCtx(freeEntitlements)
    expect(render('editor')).toEqual({ allowed: false, reason: 'pro_required' })
  })

  test('free entitlements: timeTrial is pro_required', () => {
    mockContextValue = makeCtx(freeEntitlements)
    expect(render('timeTrial')).toEqual({ allowed: false, reason: 'pro_required' })
  })

  test('free entitlements: telemetryExport is pro_required', () => {
    mockContextValue = makeCtx(freeEntitlements)
    expect(render('telemetryExport')).toEqual({ allowed: false, reason: 'pro_required' })
  })

  test('free entitlements: trackPreview is allowed', () => {
    mockContextValue = makeCtx(freeEntitlements)
    expect(render('trackPreview')).toEqual({ allowed: true, reason: null })
  })

  test('pro entitlements: all boolean features are allowed', () => {
    mockContextValue = makeCtx(proEntitlements)
    const features = [
      'timeTrial', 'ghost', 'editor', 'trackPreview',
      'showroomBasic', 'showroomFull', 'telemetryExport',
      'cloudLeaderboardRead', 'cloudLeaderboardWrite',
    ] as const
    for (const feature of features) {
      expect(render(feature)).toEqual({ allowed: true, reason: null })
    }
  })

  test('raceMode always returns allowed:true (server is sole enforcer)', () => {
    for (const entitlements of [null, freeEntitlements, proEntitlements]) {
      mockContextValue = makeCtx(entitlements)
      expect(render('raceMode')).toEqual({ allowed: true, reason: null })
    }
  })
})
