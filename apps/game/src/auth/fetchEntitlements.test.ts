import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockFetch = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', mockFetch)

const { fetchMe, postRaceStart } = await import('./fetchEntitlements')

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function emptyResponse(status: number): Response {
  return new Response(null, { status })
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('fetchMe', () => {
  test('200 → returns parsed JSON body', async () => {
    const payload = {
      user: { id: 'u1', email: 'a@b.com', name: 'A' },
      subscription: { tier: 'pro', status: 'active', currentPeriodEnd: null },
      role: 'user',
    }
    mockFetch.mockResolvedValue(jsonResponse(200, payload))
    const result = await fetchMe()
    expect(result).toEqual(payload)
  })

  test('200 → credentials: include is passed to fetch', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, {}))
    await fetchMe()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/me')
    expect((init as RequestInit).credentials).toBe('include')
  })

  test('401 → returns null', async () => {
    mockFetch.mockResolvedValue(emptyResponse(401))
    const result = await fetchMe()
    expect(result).toBeNull()
  })

  test('500 → throws Error with /api/me failed (500)', async () => {
    mockFetch.mockResolvedValue(emptyResponse(500))
    await expect(fetchMe()).rejects.toThrow(/\/api\/me failed.*500/)
  })
})

describe('postRaceStart', () => {
  test('posts JSON body with method, headers, and credentials', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { ok: true }))
    await postRaceStart('foo')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    const request = init as RequestInit
    expect(url).toBe('/api/race/start')
    expect(request.method).toBe('POST')
    expect(request.credentials).toBe('include')
    const headers = request.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/json')
    expect(request.body).toBe('{"trackId":"foo"}')
  })

  test('401 → returns null', async () => {
    mockFetch.mockResolvedValue(emptyResponse(401))
    const result = await postRaceStart('foo')
    expect(result).toBeNull()
  })

  test('403 → returns { error: pro_required } without parsing the body', async () => {
    const res = emptyResponse(403)
    const jsonSpy = vi.spyOn(res, 'json')
    mockFetch.mockResolvedValue(res)
    const result = await postRaceStart('foo')
    expect(result).toEqual({ error: 'pro_required' })
    expect(jsonSpy).not.toHaveBeenCalled()
  })

  test('200 with ok verdict → returns parsed object', async () => {
    const body = { ok: true, grantedTrackId: 'bar' }
    mockFetch.mockResolvedValue(jsonResponse(200, body))
    const result = await postRaceStart('foo')
    expect(result).toEqual(body)
  })

  test('500 → throws Error with /api/race/start failed', async () => {
    mockFetch.mockResolvedValue(emptyResponse(500))
    await expect(postRaceStart('foo')).rejects.toThrow(/\/api\/race\/start failed/)
  })
})
