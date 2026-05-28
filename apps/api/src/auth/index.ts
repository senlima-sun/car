import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { checkout, polar, portal, webhooks } from '@polar-sh/better-auth'
import { Polar } from '@polar-sh/sdk'
import { BILLING_PRODUCTS, getProducts } from '../billing/products.ts'
import { auditLog } from '../lib/auditLog.ts'
import type { Bindings } from '../types.ts'
import { parseOrigins } from './origins.ts'

function buildPolarPlugin(env: Bindings) {
  const products = getProducts(env)
  const productList = BILLING_PRODUCTS.map(product => ({
    productId: products[product.slug].polarProductId,
    slug: product.slug,
  }))
  const polarClient = new Polar({ accessToken: env.POLAR_ACCESS_TOKEN })
  return polar({
    client: polarClient,
    // Lazy: Polar checkout creates the customer on demand via externalCustomerId.
    // Eager creation here would couple sign-up to Polar API health.
    createCustomerOnSignUp: false,
    use: [
      checkout({
        products: productList,
        successUrl: env.BILLING_SUCCESS_URL,
        authenticatedUsersOnly: true,
      }),
      portal({ returnUrl: env.BILLING_SUCCESS_URL }),
      // POLAR_WEBHOOK_SECRET=placeholder is acceptable for local dev: webhooks need a
      // public URL, so registration is deferred until the worker deploys to Cloudflare.
      webhooks({ secret: env.POLAR_WEBHOOK_SECRET }),
    ],
  })
}

function buildOptions(env: Bindings): BetterAuthOptions {
  const secure = new URL(env.BETTER_AUTH_URL).protocol === 'https:'
  return {
    database: env.DB,
    secondaryStorage: {
      get: key => env.SESSIONS.get(key),
      set: (key, value, ttl) => {
        const safeTtl = ttl == null ? undefined : Math.max(ttl, 60)
        return env.SESSIONS.put(key, value, safeTtl ? { expirationTtl: safeTtl } : undefined)
      },
      delete: key => env.SESSIONS.delete(key),
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
    plugins: [buildPolarPlugin(env)],
    databaseHooks: {
      user: {
        create: {
          after: async user => {
            auditLog('user.create', { userId: user.id })
          },
        },
      },
      session: {
        create: {
          after: async session => {
            auditLog('session.create', { userId: session.userId, sessionId: session.id })
          },
        },
      },
    },
  }
}

type Auth = ReturnType<typeof betterAuth>
const cache = new WeakMap<Bindings, Auth>()

export function createAuth(env: Bindings): Auth {
  const cached = cache.get(env)
  if (cached) return cached
  const instance = betterAuth(buildOptions(env))
  cache.set(env, instance)
  return instance
}

export function createAuthWithOverrides(
  env: Bindings,
  overrides: Partial<BetterAuthOptions>,
): Auth {
  return betterAuth({ ...buildOptions(env), ...overrides })
}
