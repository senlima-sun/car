import React from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { MePayload } from '@/auth/fetchEntitlements'

interface LoaderHolder {
  me: MePayload | null
}

const loaderData: LoaderHolder = { me: null }
const searchData: { upgrade?: string } = {}

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => ({
    options: config,
    useLoaderData: () => loaderData.me,
    useSearch: () => searchData,
  }),
  useNavigate: () => () => {},
}))

vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    client: { signOut: async () => {} },
    session: { user: { id: 'u1', name: 'Test User', email: 'test@example.com' } },
    isPending: false,
    error: null,
    entitlements: null,
  }),
}))

vi.mock('@/auth/fetchEntitlements', () => ({
  fetchMe: async () => null,
}))

const { Route } = await import('./account.tsx')
const AccountRoute = (Route as unknown as { options: { component: () => React.ReactElement } }).options
  .component

function setLoader(me: MePayload | null): void {
  loaderData.me = me
}

function setSearch(search: { upgrade?: string }): void {
  for (const key of Object.keys(searchData)) {
    delete (searchData as Record<string, unknown>)[key]
  }
  Object.assign(searchData, search)
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
  setLoader(null)
  setSearch({})
})

describe('account route — pricing tiles & admin bypass', () => {
  test('subscription.tier=null renders 2 pricing tiles with correct slugs and display prices', () => {
    setLoader(makeMe({ subscription: { tier: null, status: null, currentPeriodEnd: null } }))
    const html = renderToString(<AccountRoute />)
    expect(html).toContain('monthly')
    expect(html).toContain('annual')
    expect(html).toContain('$4.99/mo')
    expect(html).toContain('$39.99/yr ($3.33/mo)')
    expect(html).not.toContain('Manage billing')
  })

  test('subscription.tier=pro renders the Manage billing button and no pricing tiles', () => {
    setLoader(
      makeMe({
        subscription: { tier: 'pro', status: 'active', currentPeriodEnd: '2026-12-31' },
      }),
    )
    const html = renderToString(<AccountRoute />)
    expect(html).toContain('Manage billing')
    expect(html).not.toContain('$4.99/mo')
    expect(html).not.toContain('$39.99/yr')
    expect(html).not.toContain('Get Pro')
  })

  test('role=admin + tier=null still shows pricing tiles (admin bypass is feature-side only)', () => {
    setLoader(
      makeMe({
        role: 'admin',
        subscription: { tier: null, status: null, currentPeriodEnd: null },
      }),
    )
    const html = renderToString(<AccountRoute />)
    expect(html).toContain('monthly')
    expect(html).toContain('annual')
  })

  test('search.upgrade=editor renders a banner mentioning Track Editor', () => {
    setLoader(makeMe())
    setSearch({ upgrade: 'editor' })
    const html = renderToString(<AccountRoute />)
    expect(html).toContain('Track Editor')
  })
})
