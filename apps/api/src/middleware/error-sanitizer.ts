import type { ErrorHandler } from 'hono'
import type { HonoEnv } from '../types.ts'

export const errorSanitizer: ErrorHandler<HonoEnv> = (err, c) => {
  const requestId = crypto.randomUUID()
  console.error(
    JSON.stringify({
      event: 'unhandled_error',
      requestId,
      name: err.name,
      kind: err.constructor.name,
    }),
  )
  return c.json({ error: 'internal', requestId }, 500)
}
