import type { Bindings } from '../../src/types.ts'

const fakeD1 = {} as D1Database
const fakeKV = {} as KVNamespace

export function stubEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: fakeD1,
    SESSIONS: fakeKV,
    BETTER_AUTH_SECRET: 'test-secret-1234567890123456789012',
    BETTER_AUTH_URL: 'http://localhost:8787',
    FRONTEND_ORIGINS: 'http://localhost:7234',
    POLAR_ACCESS_TOKEN: 'test-polar-token',
    POLAR_WEBHOOK_SECRET: 'test-webhook-secret',
    POLAR_PRODUCT_ID_PRO: 'test-product-pro',
    BILLING_SUCCESS_URL: 'http://localhost:7234/account?billing=success',
    BILLING_CANCEL_URL: 'http://localhost:7234/account?billing=cancel',
    ...overrides,
  } as Bindings
}
