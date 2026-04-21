# Drizzle ORM Review

> Applies to: `packages/db/**`, any file importing `@athreei/db`

## Schema Definition

- [ ] Proper column types for the database
- [ ] Indexes on frequently queried columns
- [ ] Foreign key constraints defined
- [ ] `$inferSelect` / `$inferInsert` types exported

```typescript
// GOOD: Well-defined schema
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    organizationId: uuid('organization_id').references(() => organizations.id),
  },
  table => ({
    emailIdx: index('users_email_idx').on(table.email),
    orgIdx: index('users_org_idx').on(table.organizationId),
  }),
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
```

## Dual Database Support

athreei supports both PostgreSQL and SQLite. Use the correct imports:

```typescript
// GOOD: Auto-detect database type
import { getDb, getSchema } from '@athreei/db'
const db = getDb()
const { users } = getSchema()

// GOOD: Explicit type when needed
import { getPgDb, getSqliteDb } from '@athreei/db'
const pgDb = getPgDb() // Throws if not PG
const sqliteDb = getSqliteDb() // Throws if not SQLite

// BAD: Direct import without abstraction
import { db } from 'drizzle-orm/postgres-js'
```

## Query Patterns

- [ ] Parameterized queries (use template literals)
- [ ] Select specific columns, not `*`
- [ ] Use relations for joins when appropriate
- [ ] Batch operations where possible

```typescript
// GOOD: Specific columns, parameterized
const user = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .where(eq(users.id, userId))
  .limit(1)

// GOOD: Relations query
const userWithPosts = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    posts: {
      limit: 10,
      orderBy: desc(posts.createdAt),
    },
  },
})

// BAD: String interpolation (SQL injection risk)
const user = await db.execute(`SELECT * FROM users WHERE id = '${userId}'`)
```

## N+1 Prevention

- [ ] Use `with` for related data
- [ ] Batch queries with `inArray()`
- [ ] Use DataLoader pattern for GraphQL

```typescript
// BAD: N+1
const users = await db.select().from(users)
for (const user of users) {
  user.posts = await db.select().from(posts).where(eq(posts.userId, user.id))
}

// GOOD: Single query with relation
const users = await db.query.users.findMany({
  with: { posts: true },
})

// GOOD: Batch query
const userIds = users.map(u => u.id)
const allPosts = await db.select().from(posts).where(inArray(posts.userId, userIds))
```

## Transactions

- [ ] Use transactions for multi-step operations
- [ ] Rollback on error
- [ ] Don't hold transactions open long

```typescript
// GOOD: Transaction for atomic operations
await db.transaction(async tx => {
  const [org] = await tx.insert(organizations).values({ name }).returning()
  await tx.insert(memberships).values({
    organizationId: org.id,
    userId: currentUser.id,
    role: 'owner',
  })
})
```

## Migrations

- [ ] Migration files checked into git
- [ ] No data loss in down migrations
- [ ] Test migrations on copy of production data

```bash
bun run generate  # Generate migration
bun run migrate   # Apply migrations
bun run push      # Push schema (dev only)
```

## References

- [Drizzle Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle Relations](https://orm.drizzle.team/docs/rqb)
- [Drizzle Migrations](https://orm.drizzle.team/docs/migrations)
