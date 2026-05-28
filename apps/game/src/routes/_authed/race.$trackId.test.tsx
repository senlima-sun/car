import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { RaceStartVerdict } from '@/auth/fetchEntitlements'

vi.mock('@/App', () => ({ default: () => null }))
vi.mock('../-useSyncGameStatus', () => ({ useSyncGameStatus: () => {} }))

const postRaceStart = vi.fn<(trackId: string) => Promise<RaceStartVerdict | null>>()
vi.mock('@/auth/fetchEntitlements', () => ({
  postRaceStart: (trackId: string) => postRaceStart(trackId),
}))

const { Route } = await import('./race.$trackId.tsx')

type LoaderResult = { grantedTrackId: string | null }
interface RedirectThrow {
  options: { to: string; params?: Record<string, string>; search?: Record<string, unknown> }
}

function runLoader(trackId: string): Promise<LoaderResult> {
  const loader = Route.options.loader as (ctx: {
    params: { trackId: string }
  }) => Promise<LoaderResult>
  return loader({ params: { trackId } })
}

async function expectRedirect(trackId: string): Promise<RedirectThrow['options']> {
  try {
    await runLoader(trackId)
  } catch (err) {
    return (err as RedirectThrow).options
  }
  throw new Error('expected loader to throw a redirect')
}

beforeEach(() => {
  postRaceStart.mockReset()
})

describe('race loader verdicts', () => {
  test('ok verdict returns the granted track id', async () => {
    postRaceStart.mockResolvedValue({ ok: true, grantedTrackId: 'f1_monaco' })
    const result = await runLoader('f1_monaco')
    expect(result).toEqual({ grantedTrackId: 'f1_monaco' })
  })

  test('ok verdict without grantedTrackId returns null', async () => {
    postRaceStart.mockResolvedValue({ ok: true })
    const result = await runLoader('f1_spa')
    expect(result).toEqual({ grantedTrackId: null })
  })

  test('redirect verdict redirects to the granted track with forcedDaily flag', async () => {
    postRaceStart.mockResolvedValue({ redirect: 'f1_monaco' })
    const options = await expectRedirect('f1_spa')
    expect(options.to).toBe('/race/$trackId')
    expect(options.params).toEqual({ trackId: 'f1_monaco' })
    expect(options.search).toEqual({ forcedDaily: '1' })
  })

  test('pro_required verdict redirects to the account upgrade page', async () => {
    postRaceStart.mockResolvedValue({ error: 'pro_required' })
    const options = await expectRedirect('f1_spa')
    expect(options.to).toBe('/account')
    expect(options.search).toEqual({ upgrade: 'race' })
  })

  test('null verdict (401) redirects to sign-in', async () => {
    postRaceStart.mockResolvedValue(null)
    const options = await expectRedirect('f1_spa')
    expect(options.to).toBe('/')
    expect(options.search).toEqual({ auth: 'signin' })
  })

  test('no infinite loop: rerun on the granted trackId returns ok without redirecting', async () => {
    postRaceStart.mockImplementation(async (trackId: string) =>
      trackId === 'f1_silverstone_circuit'
        ? { ok: true, grantedTrackId: 'f1_silverstone_circuit' }
        : { redirect: 'f1_silverstone_circuit' },
    )

    const firstPass = await expectRedirect('f1_spa')
    expect(firstPass.params).toEqual({ trackId: 'f1_silverstone_circuit' })

    const rerun = await runLoader('f1_silverstone_circuit')
    expect(rerun).toEqual({ grantedTrackId: 'f1_silverstone_circuit' })
  })
})
