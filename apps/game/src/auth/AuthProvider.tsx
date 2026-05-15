import { createContext, useContext, type ReactNode } from 'react'
import { authClient, useSession } from './client'

type Session = ReturnType<typeof useSession>

interface AuthContextValue {
  client: typeof authClient
  session: Session['data']
  isPending: Session['isPending']
  error: Session['error']
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const session = useSession()
  const value: AuthContextValue = {
    client: authClient,
    session: session.data,
    isPending: session.isPending,
    error: session.error,
  }
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
