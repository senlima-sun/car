import { memoryAdapter } from 'better-auth/adapters/memory'
import type { BetterAuthOptions } from 'better-auth'
import type { Bindings } from '../../src/types.ts'
import { stubEnv } from './env.ts'

export interface MemoryHarness {
  env: Bindings
  authOverrides: Partial<BetterAuthOptions>
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
    ...extraOverrides,
  }

  return { env: stubEnv({ SESSIONS: kv }), authOverrides }
}
