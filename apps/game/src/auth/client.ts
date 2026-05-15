import { createAuthClient } from 'better-auth/react'
import { polarClient } from '@polar-sh/better-auth'

const baseURL = (import.meta.env.VITE_AUTH_BASE_URL ?? '/api/auth') as string

export const authClient = createAuthClient({
  baseURL,
  plugins: [polarClient()],
})

export const { useSession, signIn, signUp, signOut } = authClient
