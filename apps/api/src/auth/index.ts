import { betterAuth } from 'better-auth'
import type { Bindings } from '../types.ts'
import { parseOrigins } from './origins.ts'

function auditLog(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event, timestamp: new Date().toISOString(), ...fields }))
}

export function createAuth(env: Bindings) {
  const secure = new URL(env.BETTER_AUTH_URL).protocol === 'https:'

  return betterAuth({
    database: env.DB,
    secondaryStorage: {
      get: (key) => env.SESSIONS.get(key),
      set: (key, value, ttl) => {
        const safeTtl = ttl && ttl >= 60 ? ttl : ttl ? 60 : undefined
        return env.SESSIONS.put(key, value, safeTtl ? { expirationTtl: safeTtl } : undefined)
      },
      delete: (key) => env.SESSIONS.delete(key),
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: parseOrigins(env),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    session: {
      cookieCache: { enabled: false },
      storeSessionInDatabase: true,
    },
    advanced: {
      useSecureCookies: secure,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure,
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 10,
      storage: 'secondary-storage',
    },
    socialProviders: {},
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            auditLog('user.create', { userId: user.id })
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            auditLog('session.create', { userId: session.userId, sessionId: session.id })
          },
        },
      },
    },
  })
}
