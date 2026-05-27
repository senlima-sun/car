import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { dailyTrackGrant } from '../db/schema/index.ts'

// Mirror of apps/game/src/constants/tracks/sources/*.json — kept in sync by apps/api/test/preset-track-ids-in-sync.test.ts
export const PRESET_TRACK_IDS: readonly string[] = [
  'f1_baku',
  'f1_catalunya',
  'f1_cota',
  'f1_hungaroring',
  'f1_imola',
  'f1_interlagos',
  'f1_las-vegas',
  'f1_losail',
  'f1_madrid',
  'f1_melbourne',
  'f1_mexico-city',
  'f1_miami',
  'f1_monaco',
  'f1_montreal',
  'f1_autodromo_nazionale_monza',
  'f1_red-bull-ring',
  'f1_shanghai',
  'f1_silverstone_circuit',
  'f1_singapore',
  'f1_spa',
  'f1_suzuka',
  'f1_yas-marina',
  'f1_zandvoort',
]

export function pickRandomTrack(rng: () => number): string {
  const index = Math.floor(rng() * PRESET_TRACK_IDS.length)
  return PRESET_TRACK_IDS[index]
}

export function todayUtc(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export interface DailyGrant {
  trackId: string
  dateUTC: string
}

export async function getOrCreateDailyGrant(
  db: Db,
  userId: string,
  now: Date,
): Promise<DailyGrant> {
  const dateUTC = todayUtc(now)

  const existing = await readGrant(db, userId, dateUTC)
  if (existing) return existing

  await db
    .insert(dailyTrackGrant)
    .values({
      userId,
      dateUTC,
      trackId: pickRandomTrack(Math.random),
      createdAt: now,
    })
    .onConflictDoNothing({ target: [dailyTrackGrant.userId, dailyTrackGrant.dateUTC] })
    .run()

  const winner = await readGrant(db, userId, dateUTC)
  if (!winner) throw new Error('DailyGrantWriteFailed')
  return winner
}

async function readGrant(db: Db, userId: string, dateUTC: string): Promise<DailyGrant | null> {
  const row = await db
    .select({ trackId: dailyTrackGrant.trackId, dateUTC: dailyTrackGrant.dateUTC })
    .from(dailyTrackGrant)
    .where(and(eq(dailyTrackGrant.userId, userId), eq(dailyTrackGrant.dateUTC, dateUTC)))
    .get()
  return row ?? null
}
