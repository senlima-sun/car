import { eq } from 'drizzle-orm'
import { describe, expect, test } from 'vitest'
import { dailyTrackGrant, user } from '../src/db/schema/index.ts'
import { memoryHarness } from './helpers/memory-env.ts'

describe('memory harness SQLite Drizzle', () => {
  test('inserts and selects from user', async () => {
    const { db } = memoryHarness()
    const now = new Date()
    await db
      .insert(user)
      .values({
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
        role: 'admin',
        createdAt: now,
        updatedAt: now,
      })
      .run()

    const row = await db.select({ role: user.role }).from(user).where(eq(user.id, 'u1')).get()
    expect(row).toEqual({ role: 'admin' })
  })

  test('inserts and selects from daily_track_grant', async () => {
    const { db } = memoryHarness()
    const now = new Date()
    await db
      .insert(user)
      .values({ id: 'u2', name: 'Bob', email: 'bob@example.com', createdAt: now, updatedAt: now })
      .run()
    await db
      .insert(dailyTrackGrant)
      .values({ userId: 'u2', dateUTC: '2026-05-28', trackId: 'f1_monaco', createdAt: now })
      .run()

    const grant = await db
      .select()
      .from(dailyTrackGrant)
      .where(eq(dailyTrackGrant.userId, 'u2'))
      .get()
    expect(grant?.trackId).toBe('f1_monaco')
    expect(grant?.dateUTC).toBe('2026-05-28')
  })

  test('user row defaults role to "user"', async () => {
    const { db } = memoryHarness()
    const now = new Date()
    await db
      .insert(user)
      .values({ id: 'u3', name: 'Cara', email: 'cara@example.com', createdAt: now, updatedAt: now })
      .run()

    const row = await db.select({ role: user.role }).from(user).where(eq(user.id, 'u3')).get()
    expect(row?.role).toBe('user')
  })
})
