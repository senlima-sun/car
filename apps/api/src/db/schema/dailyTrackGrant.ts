import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from './auth.ts'

export const dailyTrackGrant = sqliteTable(
  'daily_track_grant',
  {
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    dateUTC: text('dateUTC').notNull(),
    trackId: text('trackId').notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  },
  t => [
    primaryKey({ columns: [t.userId, t.dateUTC] }),
    index('daily_track_grant_userId_idx').on(t.userId),
    index('daily_track_grant_dateUTC_idx').on(t.dateUTC),
  ],
)
