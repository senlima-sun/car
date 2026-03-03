# Next.js App Router Review

> Applies to: `apps/platform/**`, `apps/docs/**`

## Server vs Client Components

- [ ] Default to Server Components (no directive needed)
- [ ] `"use client"` only when needed (hooks, browser APIs, events)
- [ ] No sensitive data in Client Component props

```typescript
// GOOD: Server Component fetches, Client displays
// page.tsx (Server)
export default async function Page() {
  const data = await getData() // Server-only
  return <ClientDisplay name={data.name} /> // Minimal props
}

// BAD: Fetching in Client Component
"use client"
export default function Page() {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch("/api/data").then(...) // Extra round-trip
  }, [])
}
```

## Server Actions

- [ ] `"use server"` at top of function or file
- [ ] Validate ALL arguments (runtime, not just TypeScript)
- [ ] Re-authorize user in every action
- [ ] Use Zod for schema validation

```typescript
"use server"

import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"

const UpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
})

export async function updatePost(input: unknown) {
  // 1. Validate input
  const { id, title } = UpdateSchema.parse(input)

  // 2. Authorize
  const user = await getCurrentUser()
  const post = await getPost(id)
  if (post.authorId !== user.id) {
    throw new Error("Unauthorized")
  }

  // 3. Perform action
  await db.update(posts).set({ title }).where(eq(posts.id, id))
  revalidatePath(`/posts/${id}`)
}
```

## Data Access Layer

- [ ] `import "server-only"` in data access files
- [ ] Authorization check in data layer, not components
- [ ] Return DTOs, not raw database objects

```typescript
// lib/data/posts.ts
import "server-only"

export async function getPostForUser(id: string) {
  const user = await getCurrentUser()
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
  })

  if (!post) return null

  // Return only what user can see
  return {
    id: post.id,
    title: post.title,
    canEdit: post.authorId === user?.id,
    // Don't expose: authorEmail, internalNotes, etc.
  }
}
```

## Route Handlers

- [ ] Validate request body/params
- [ ] Check authentication
- [ ] Return appropriate status codes

```typescript
// app/api/posts/[id]/route.ts
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 })
  }

  // ... update logic
}
```

## Middleware

- [ ] Don't rely solely on middleware for auth (CVE-2025-29927)
- [ ] Defense in depth: check auth in data layer too
- [ ] Validate `x-middleware-subrequest` header handling

## Caching & Revalidation

- [ ] `revalidatePath()` or `revalidateTag()` after mutations
- [ ] Appropriate cache settings for data fetches
- [ ] `cache()` for request-level deduplication

## Common Pitfalls

- [ ] No `searchParams` trust without validation
- [ ] No dynamic route `[params]` trust without validation
- [ ] Production mode for production (`NODE_ENV=production`)

## References

- [Next.js Security](https://nextjs.org/blog/security-nextjs-server-components-actions)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
