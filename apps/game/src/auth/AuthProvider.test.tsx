import { renderToString } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { MePayload } from './fetchEntitlements'

vi.mock('./client', () => ({
  authClient: {},
  useSession: () => ({ data: null, isPending: false, error: null }),
}))

const { AuthProvider, useAuthOptional } = await import('./AuthProvider')

function Consumer() {
  const ctx = useAuthOptional()
  const ent = ctx?.entitlements
  if (!ent) return <span data-entitlements='null' />
  return (
    <span
      data-entitlements='present'
      data-race-mode={ent.raceMode}
      data-editor={String(ent.editor)}
      data-telemetry-export={String(ent.telemetryExport)}
    />
  )
}

interface ConsumerSnapshot {
  hasEntitlements: boolean
  raceMode: string | null
  editor: boolean | null
  telemetryExport: boolean | null
}

function parse(html: string): ConsumerSnapshot {
  if (/data-entitlements="null"/.test(html)) {
    return { hasEntitlements: false, raceMode: null, editor: null, telemetryExport: null }
  }
  const raceMode = /data-race-mode="([^"]*)"/.exec(html)?.[1] ?? null
  const editor = /data-editor="([^"]*)"/.exec(html)?.[1]
  const telemetryExport = /data-telemetry-export="([^"]*)"/.exec(html)?.[1]
  return {
    hasEntitlements: true,
    raceMode,
    editor: editor === 'true' ? true : editor === 'false' ? false : null,
    telemetryExport:
      telemetryExport === 'true' ? true : telemetryExport === 'false' ? false : null,
  }
}

function makeMe(overrides: Partial<MePayload> = {}): MePayload {
  return {
    user: { id: 'u1', email: 'test@example.com', name: 'Test User' },
    subscription: { tier: null, status: null, currentPeriodEnd: null },
    role: 'user',
    ...overrides,
  }
}

describe('AuthProvider entitlements derivation', () => {
  test('no me prop → entitlements is null', () => {
    const html = renderToString(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    expect(parse(html).hasEntitlements).toBe(false)
  })

  test('user with no subscription tier → daily-only race mode, editor false', () => {
    const me = makeMe({ subscription: { tier: null, status: null, currentPeriodEnd: null } })
    const html = renderToString(
      <AuthProvider me={me}>
        <Consumer />
      </AuthProvider>,
    )
    const snap = parse(html)
    expect(snap.hasEntitlements).toBe(true)
    expect(snap.raceMode).toBe('daily-only')
    expect(snap.editor).toBe(false)
  })

  test('user with pro tier → unlimited race mode, editor true', () => {
    const me = makeMe({ subscription: { tier: 'pro', status: 'active', currentPeriodEnd: null } })
    const html = renderToString(
      <AuthProvider me={me}>
        <Consumer />
      </AuthProvider>,
    )
    const snap = parse(html)
    expect(snap.raceMode).toBe('unlimited')
    expect(snap.editor).toBe(true)
  })

  test('admin role without subscription → telemetryExport true (admin bypass)', () => {
    const me = makeMe({
      role: 'admin',
      subscription: { tier: null, status: null, currentPeriodEnd: null },
    })
    const html = renderToString(
      <AuthProvider me={me}>
        <Consumer />
      </AuthProvider>,
    )
    expect(parse(html).telemetryExport).toBe(true)
  })

  test('unknown role string falls back to user → editor false', () => {
    const me = makeMe({ role: 'something-weird' })
    const html = renderToString(
      <AuthProvider me={me}>
        <Consumer />
      </AuthProvider>,
    )
    expect(parse(html).editor).toBe(false)
  })

  test('unknown future tier normalizes to null → daily-only race mode', () => {
    const me = makeMe({
      subscription: { tier: 'legend', status: 'active', currentPeriodEnd: null },
    })
    const html = renderToString(
      <AuthProvider me={me}>
        <Consumer />
      </AuthProvider>,
    )
    expect(parse(html).raceMode).toBe('daily-only')
  })

  test('nested providers: inner pro overrides outer null', () => {
    const proMe = makeMe({
      subscription: { tier: 'pro', status: 'active', currentPeriodEnd: null },
    })
    const html = renderToString(
      <AuthProvider>
        <AuthProvider me={proMe}>
          <Consumer />
        </AuthProvider>
      </AuthProvider>,
    )
    const snap = parse(html)
    expect(snap.hasEntitlements).toBe(true)
    expect(snap.editor).toBe(true)
    expect(snap.raceMode).toBe('unlimited')
  })
})
