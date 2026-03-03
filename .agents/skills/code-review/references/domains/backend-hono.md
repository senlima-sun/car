# Hono Backend Review

> Applies to: `apps/api/**`, `packages/gateway-cloud/**`

## Route Definition

- [ ] Use typed routes with `Hono<Env>`
- [ ] Group related routes with `app.route()`
- [ ] Consistent path naming (`/api/v1/resource`)

```typescript
// GOOD: Typed app with environment
type Env = {
  Variables: {
    user: User
  }
  Bindings: {
    DATABASE_URL: string
  }
}

const app = new Hono<Env>()

app.get("/users/:id", async (c) => {
  const id = c.req.param("id")
  const user = c.get("user") // Typed!
  // ...
})
```

## Middleware

- [ ] Auth middleware on protected routes
- [ ] CORS configured appropriately
- [ ] Rate limiting on public endpoints
- [ ] Request body size limits

```typescript
// GOOD: Middleware chain
const api = new Hono()
  .use("*", cors())
  .use("*", logger())
  .use("/protected/*", authMiddleware)
  .route("/users", usersRouter)
```

## Input Validation

- [ ] Validate path params
- [ ] Validate query params
- [ ] Validate request body with Zod
- [ ] Use `zValidator` middleware

```typescript
import { zValidator } from "@hono/zod-validator"

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
})

app.post(
  "/users",
  zValidator("json", CreateUserSchema),
  async (c) => {
    const body = c.req.valid("json") // Typed & validated
    // ...
  }
)
```

## Error Handling

- [ ] Global error handler
- [ ] Consistent error response format
- [ ] No internal details in production errors
- [ ] Appropriate HTTP status codes

```typescript
// GOOD: Structured error handling
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }

  console.error(err)
  return c.json(
    {
      error: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { message: err.message }),
    },
    500
  )
})

app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404)
})
```

## Response Patterns

- [ ] Consistent JSON structure
- [ ] Proper status codes (201 for create, 204 for delete)
- [ ] Content-Type headers set

```typescript
// GOOD: Consistent responses
app.post("/users", async (c) => {
  const user = await createUser(data)
  return c.json({ data: user }, 201)
})

app.delete("/users/:id", async (c) => {
  await deleteUser(id)
  return c.body(null, 204)
})
```

## Authentication Integration

- [ ] Auth handler properly mounted
- [ ] Session/token validation middleware
- [ ] User context available in handlers

```typescript
// With Better Auth
import { createAuth } from "@athreei/auth/server"

const auth = createAuth(db)

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))

// Protected routes
app.use("/api/*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  c.set("user", session.user)
  await next()
})
```

## Bun Server Export

- [ ] Default export for Bun serve
- [ ] Port from environment

```typescript
export default {
  port: process.env.PORT || 3001,
  fetch: app.fetch,
}
```

## References

- [Hono Documentation](https://hono.dev/docs/)
- [Hono Middleware](https://hono.dev/docs/middleware/builtin/basic-auth)
- [Zod Validator](https://hono.dev/docs/guides/validation#with-zod)
