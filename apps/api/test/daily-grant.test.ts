import { describe, expect, test } from 'vitest'
import { dailyTrackGrant, user } from '../src/db/schema/index.ts'
import {
  PRESET_TRACK_IDS,
  getOrCreateDailyGrant,
  pickRandomTrack,
  todayUtc,
} from '../src/entitlements/dailyGrant.ts'
import { memoryHarness } from './helpers/memory-env.ts'
import type { Db } from '../src/db/client.ts'

async function seedUser(db: Db, id: string): Promise<void> {
  const now = new Date()
  await db
    .insert(user)
    .values({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })
    .run()
}

describe('pickRandomTrack', () => {
  test('is deterministic for a fixed RNG seed', () => {
    expect(pickRandomTrack(() => 0)).toBe(PRESET_TRACK_IDS[0])
    expect(pickRandomTrack(() => 0.999999)).toBe(PRESET_TRACK_IDS[PRESET_TRACK_IDS.length - 1])
    const mid = Math.floor(0.5 * PRESET_TRACK_IDS.length)
    expect(pickRandomTrack(() => 0.5)).toBe(PRESET_TRACK_IDS[mid])
  })

  test('only ever returns a preset track id', () => {
    for (let i = 0; i < 100; i++) {
      expect(PRESET_TRACK_IDS).toContain(pickRandomTrack(Math.random))
    }
  })
})

describe('todayUtc', () => {
  test('formats a fixed Date as YYYY-MM-DD in UTC', () => {
    expect(todayUtc(new Date('2026-05-28T23:59:59.000Z'))).toBe('2026-05-28')
    expect(todayUtc(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01')
  })
})

describe('getOrCreateDailyGrant', () => {
  test('inserts a grant on first call', async () => {
    const { db } = memoryHarness()
    await seedUser(db, 'u1')

    const grant = await getOrCreateDailyGrant(db, 'u1', new Date('2026-05-28T10:00:00.000Z'), () => 0)
    expect(grant).toEqual({ trackId: PRESET_TRACK_IDS[0], dateUTC: '2026-05-28' })
  })

  test('is idempotent: re-call same day returns the same trackId', async () => {
    const { db } = memoryHarness()
    await seedUser(db, 'u1')
    const now = new Date('2026-05-28T10:00:00.000Z')

    const first = await getOrCreateDailyGrant(db, 'u1', now, () => 0.1)
    const second = await getOrCreateDailyGrant(db, 'u1', now, () => 0.9)

    expect(second.trackId).toBe(first.trackId)
  })

  test('two users get independent grants', async () => {
    const { db } = memoryHarness()
    await seedUser(db, 'u1')
    await seedUser(db, 'u2')
    const now = new Date('2026-05-28T10:00:00.000Z')

    const a = await getOrCreateDailyGrant(db, 'u1', now, () => 0)
    const b = await getOrCreateDailyGrant(db, 'u2', now, () => 0.999999)

    expect(a.trackId).toBe(PRESET_TRACK_IDS[0])
    expect(b.trackId).toBe(PRESET_TRACK_IDS[PRESET_TRACK_IDS.length - 1])
  })

  test('conflict path returns the row that already won', async () => {
    const { db } = memoryHarness()
    await seedUser(db, 'u1')
    const now = new Date('2026-05-28T10:00:00.000Z')

    await db
      .insert(dailyTrackGrant)
      .values({ userId: 'u1', dateUTC: '2026-05-28', trackId: 'f1_monaco', createdAt: now })
      .run()

    const grant = await getOrCreateDailyGrant(db, 'u1', now, () => 0)
    expect(grant.trackId).toBe('f1_monaco')
  })

  test('different UTC day yields a fresh grant', async () => {
    const { db } = memoryHarness()
    await seedUser(db, 'u1')

    const day1 = await getOrCreateDailyGrant(db, 'u1', new Date('2026-05-28T10:00:00.000Z'), () => 0)
    const day2 = await getOrCreateDailyGrant(db, 'u1', new Date('2026-05-29T10:00:00.000Z'), () => 0.999999)

    expect(day1.dateUTC).toBe('2026-05-28')
    expect(day2.dateUTC).toBe('2026-05-29')
    expect(day2.trackId).toBe(PRESET_TRACK_IDS[PRESET_TRACK_IDS.length - 1])
  })
})
