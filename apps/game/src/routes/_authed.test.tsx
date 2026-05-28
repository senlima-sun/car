import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { MePayload } from '@/auth/fetchEntitlements'

const fetchMe = vi.fn<() => Promise<MePayload | null>>()
vi.mock('@/auth/fetchEntitlements', () => ({
  fetchMe: () => fetchMe(),
}))

vi.mock('@/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: unknown }) => children,
}))

const { Route } = await import('./_authed.tsx')

interface RedirectThrow {
  options: { to: string; search?: { auth?: string } }
}

function runLoader(): Promise<{ me: MePayload }> {
  const loader = Route.options.loader as () => Promise<{ me: MePayload }>
  return loader()
}

function makeMe(overrides: Partial<MePayload> = {}): MePayload {
  return {
    user: { id: 'u1', email: 'test@example.com', name: 'Test User' },
    subscription: { tier: null, status: null, currentPeriodEnd: null },
    role: 'user',
    ...overrides,
  }
}

beforeEach(() => {
  fetchMe.mockReset()
})

describe('_authed loader', () => {
  test('fetchMe resolves to a payload → loader returns { me }', async () => {
    const me = makeMe()
    fetchMe.mockResolvedValue(me)
    const result = await runLoader()
    expect(result).toEqual({ me })
  })

  test('fetchMe resolves to null → throws redirect to / with auth=signin', async () => {
    fetchMe.mockResolvedValue(null)
    let thrown: unknown
    try {
      await runLoader()
    } catch (err) {
      thrown = err
    }
    const redirect = thrown as RedirectThrow
    expect(redirect.options.to).toBe('/')
    expect(redirect.options.search?.auth).toBe('signin')
  })

  test('fetchMe rejects with /api/me failed (500) → loader re-throws original error', async () => {
    const original = new Error('/api/me failed (500)')
    fetchMe.mockRejectedValue(original)
    let thrown: unknown
    try {
      await runLoader()
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBe(original)
    expect((thrown as Error).message.startsWith('/api/me failed')).toBe(true)
  })

  test('fetchMe rejects with TypeError network failure → loader catches, throws redirect', async () => {
    fetchMe.mockRejectedValue(new TypeError('Network request failed'))
    let thrown: unknown
    try {
      await runLoader()
    } catch (err) {
      thrown = err
    }
    const redirect = thrown as RedirectThrow
    expect(redirect.options.to).toBe('/')
    expect(redirect.options.search?.auth).toBe('signin')
  })

  test('fetchMe rejects with unrelated error → loader catches, throws redirect', async () => {
    fetchMe.mockRejectedValue(new Error('some unrelated error'))
    let thrown: unknown
    try {
      await runLoader()
    } catch (err) {
      thrown = err
    }
    const redirect = thrown as RedirectThrow
    expect(redirect.options.to).toBe('/')
    expect(redirect.options.search?.auth).toBe('signin')
  })
})
