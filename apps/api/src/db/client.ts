import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import type { Bindings } from '../types.ts'
import * as schema from './schema/index.ts'

type Db = DrizzleD1Database<typeof schema>
const cache = new WeakMap<Bindings, Db>()

export function getDb(env: Bindings): Db {
  const cached = cache.get(env)
  if (cached) return cached
  const instance = drizzle(env.DB, { schema })
  cache.set(env, instance)
  return instance
}
