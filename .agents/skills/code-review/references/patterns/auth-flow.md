# Authentication Flow Review

> Applies to: `packages/auth/**`, `apps/api/**`, `apps/platform/**`

## Better Auth Integration

athreei uses Better Auth for authentication. Key patterns:

## Server Setup

- [ ] Auth instance created with database adapter
- [ ] Plugins configured (organizations, two-factor, etc.)
- [ ] Handler mounted on `/api/auth/*`

```typescript
// packages/auth/src/server.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

export function createAuth(db: Database) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg', // or "sqlite"
    }),
    emailAndPassword: {
      enabled: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    // ... plugins
  })
}

// apps/api/src/index.ts
const auth = createAuth(db)
app.on(['GET', 'POST'], '/api/auth/*', c => auth.handler(c.req.raw))
```

## Client Setup

- [ ] Auth client configured with base URL
- [ ] Hooks for session state
- [ ] Proper error handling

```typescript
// packages/auth/src/client.ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
})

export const { useSession, signIn, signOut } = authClient
```

## Session Handling

- [ ] Session validated on every protected request
- [ ] Session data not trusted without validation
- [ ] Proper session refresh logic

```typescript
// GOOD: Validate session server-side
export async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: headers(),
  })
  if (!session) return null
  return session.user
}

// BAD: Trust client-provided user data
export async function getUser(req: Request) {
  const userId = req.headers.get('x-user-id') // Client can fake this!
  return db.query.users.findFirst({ where: eq(users.id, userId) })
}
```

## Protected Routes

- [ ] Middleware checks session
- [ ] Data layer verifies authorization
- [ ] Defense in depth (multiple checks)

```typescript
// Middleware (first line of defense)
app.use('/api/protected/*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  c.set('session', session)
  await next()
})

// Data layer (second line of defense)
export async function getUserOrganizations(userId: string) {
  const session = await getCurrentUser()
  if (session?.id !== userId) {
    throw new Error('Unauthorized')
  }
  // ... fetch data
}
```

## OAuth Providers

- [ ] Redirect URIs configured correctly
- [ ] State parameter for CSRF protection
- [ ] Scope limited to necessary permissions

## Security Checklist

- [ ] Passwords hashed (Better Auth handles this)
- [ ] Session cookies HttpOnly, Secure, SameSite
- [ ] CSRF protection on state-changing operations
- [ ] Rate limiting on auth endpoints
- [ ] No user enumeration (same response for invalid email/password)

## Organization/Team Auth

- [ ] Organization membership verified for org-scoped operations
- [ ] Role-based access within organizations
- [ ] Invitation flow secure (token-based, expiring)

```typescript
// GOOD: Check org membership
export async function getOrgData(orgId: string) {
  const user = await getCurrentUser()
  const membership = await db.query.memberships.findFirst({
    where: and(eq(memberships.orgId, orgId), eq(memberships.userId, user.id)),
  })
  if (!membership) {
    throw new Error('Not a member of this organization')
  }
  // ... fetch org data
}
```

## References

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Better Auth Plugins](https://www.better-auth.com/docs/plugins)
- [Session Management](https://www.better-auth.com/docs/concepts/session-management)
