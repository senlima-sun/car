import { createAuthClient } from 'better-auth/react'
import { polarClient } from '@polar-sh/better-auth'

function resolveBaseURL(): string {
  const override = import.meta.env.VITE_AUTH_BASE_URL as string | undefined
  if (override) return override
  if (typeof window !== 'undefined') return `${window.location.origin}/api/auth`
  return 'http://localhost:7234/api/auth'
}

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
  plugins: [polarClient()],
})

export const { useSession, signIn, signUp, signOut } = authClient
