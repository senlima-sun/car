import type { BetterAuthOptions } from 'better-auth'

export interface Bindings extends Env {
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  FRONTEND_ORIGINS: string
  POLAR_ACCESS_TOKEN: string
  POLAR_WEBHOOK_SECRET: string
  POLAR_PRODUCT_ID_PRO: string
  BILLING_SUCCESS_URL: string
  BILLING_CANCEL_URL: string
  __authOverrides?: Partial<BetterAuthOptions>
}

export type HonoEnv = { Bindings: Bindings }
