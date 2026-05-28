import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { authClient, useSession } from './client'
import { getEntitlements, type FeatureMatrix } from './entitlements'
import type { MePayload } from './fetchEntitlements'

type Session = ReturnType<typeof useSession>

interface AuthContextValue {
  client: typeof authClient
  session: Session['data']
  isPending: Session['isPending']
  error: Session['error']
  entitlements: FeatureMatrix | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
  me?: MePayload | null
}

export function AuthProvider({ children, me }: AuthProviderProps) {
  const session = useSession()
  const entitlements = useMemo<FeatureMatrix | null>(() => {
    if (!me) return null
    const role = me.role === 'admin' ? 'admin' : 'user'
    const tier = me.subscription.tier === 'pro' ? 'pro' : null
    return getEntitlements({ role, tier })
  }, [me])
  const value = useMemo<AuthContextValue>(
    () => ({
      client: authClient,
      session: session.data,
      isPending: session.isPending,
      error: session.error,
      entitlements,
    }),
    [session.data, session.isPending, session.error, entitlements],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext)
}
