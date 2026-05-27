export interface MePayload {
  user: { id: string; email: string; name: string }
  subscription: { tier: string | null; status: string | null; currentPeriodEnd: string | null }
  role: string
}

export type RaceStartVerdict =
  | { ok: true; grantedTrackId?: string }
  | { redirect: string }
  | { error: 'pro_required' }

export async function fetchMe(): Promise<MePayload | null> {
  const res = await fetch('/api/me', { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`/api/me failed (${res.status})`)
  return (await res.json()) as MePayload
}

export async function postRaceStart(trackId: string): Promise<RaceStartVerdict | null> {
  const res = await fetch('/api/race/start', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trackId }),
  })
  if (res.status === 401) return null
  return (await res.json()) as RaceStartVerdict
}
