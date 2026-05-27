import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { memoryAdapter } from 'better-auth/adapters/memory'
import type { BetterAuthOptions } from 'better-auth'
import type { Db } from '../../src/db/client.ts'
import type { Bindings } from '../../src/types.ts'
import * as schema from '../../src/db/schema/index.ts'
import { stubEnv } from './env.ts'

export interface MemoryHarness {
  env: Bindings
  authOverrides: Partial<BetterAuthOptions>
  db: Db
}

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../migrations')

function applyMigrations(sqlite: Database.Database): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(name => name.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim()
      if (trimmed) sqlite.exec(trimmed)
    }
  }
}

function createMemoryDb(): Db {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  applyMigrations(sqlite)
  return drizzle(sqlite, { schema }) as unknown as Db
}

export function memoryHarness(extraOverrides: Partial<BetterAuthOptions> = {}): MemoryHarness {
  const sessions = new Map<string, string>()
  const kv = {
    get: async (key: string) => sessions.get(key) ?? null,
    put: async (key: string, value: string) => {
      sessions.set(key, value)
    },
    delete: async (key: string) => {
      sessions.delete(key)
    },
  } as unknown as KVNamespace

  const memoryDb = { user: [], session: [], account: [], verification: [] }
  const authOverrides: Partial<BetterAuthOptions> = {
    database: memoryAdapter(memoryDb),
    secondaryStorage: {
      get: key => sessions.get(key) ?? null,
      set: (key, value) => {
        sessions.set(key, value)
      },
      delete: key => {
        sessions.delete(key)
      },
    },
    rateLimit: { enabled: false },
    plugins: [],
    ...extraOverrides,
  }

  return { env: stubEnv({ SESSIONS: kv }), authOverrides, db: createMemoryDb() }
}
