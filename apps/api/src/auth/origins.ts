import type { Bindings } from '../types.ts'

export function parseOrigins(env: Pick<Bindings, 'FRONTEND_ORIGINS'>): string[] {
  const origins = env.FRONTEND_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0)

  if (origins.length === 0) {
    throw new Error('FRONTEND_ORIGINS is empty; refusing to start')
  }

  return origins
}
