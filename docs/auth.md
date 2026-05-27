# User system (auth + billing)

Better Auth + Polar billing, served by `@car/api` (Hono on Cloudflare Workers, D1 for persistence, KV for session secondary storage).

## Local setup

Prereqs: a Cloudflare account, a logged-in `wrangler` (`pnpm --filter @car/api exec wrangler whoami`).

The D1 database `car-auth` and KV namespace `SESSIONS` already exist in the project owner's account; their ids are baked into `apps/api/wrangler.toml`. Forks/contributors creating their own resources should follow these steps and replace the ids:

```sh
pnpm --filter @car/api exec wrangler d1 create car-auth
pnpm --filter @car/api exec wrangler kv namespace create SESSIONS
# paste the returned ids into apps/api/wrangler.toml
pnpm --filter @car/api exec wrangler types  # regenerates apps/api/worker-configuration.d.ts (gitignored)
```

Apply migrations to the local D1 (lives under `apps/api/.wrangler/state/v3/d1`):

```sh
pnpm --filter @car/api db:migrate:local
```

Copy the secrets template:

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars
# fill in BETTER_AUTH_SECRET (openssl rand -base64 32) and Polar tokens
```

`BETTER_AUTH_URL` MUST be `https://...` in production. The cookie `Secure` flag is derived from the URL protocol; over plain `http://localhost` the cookie is set without `Secure`, so dev works without HTTPS.

## Secrets

| Var                    | Source                    | Notes                                                                                                                                                                          |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BETTER_AUTH_SECRET`   | `openssl rand -base64 32` | Rotating invalidates ALL sessions; rotate via `wrangler secret put BETTER_AUTH_SECRET`.                                                                                        |
| `BETTER_AUTH_URL`      | Hand-picked               | Local: `http://localhost:8787`. Prod: the worker's public URL with `https://`. Non-`https` in prod = non-Secure cookies = browser silently drops the session on every request. |
| `FRONTEND_ORIGINS`     | Hand-picked               | Comma-separated CORS allowlist (e.g. `https://example.com,https://staging.example.com`).                                                                                       |
| `POLAR_ACCESS_TOKEN`   | Polar org settings        | Organization Access Token.                                                                                                                                                     |
| `POLAR_WEBHOOK_SECRET` | Polar webhook settings    | HMAC secret. Plugin verifies signatures with constant-time compare.                                                                                                            |
| `POLAR_PRODUCT_ID_PRO_MONTHLY` | Polar product page | Product id for the monthly Pro SKU (`pro-monthly`).                                                                                                                            |
| `POLAR_PRODUCT_ID_PRO_ANNUAL`  | Polar product page | Product id for the annual Pro SKU (`pro-annual`).                                                                                                                              |
| `BILLING_SUCCESS_URL`  | Hand-picked               | Polar redirects here after checkout success.                                                                                                                                   |

Production: `pnpm --filter @car/api exec wrangler secret put <NAME>`.

## Migration policy

Forward-only. Generate migrations exclusively via `pnpm --filter @car/api db:generate` — never invoke `wrangler d1 migrations create` directly (it desyncs Drizzle's `migrations/meta/_journal.json`). For data recovery, use D1 time-travel; rollback migrations are unsupported on D1.

A `predeploy` script (`apps/api/scripts/check-d1-migrations.ts`) refuses to deploy the worker if any migration is pending on remote D1; run `pnpm --filter @car/api db:migrate:prod` first.

## Tier system

The `user` table carries a `role` column (`'user' | 'admin'`, default `'user'`), and a `daily_track_grant` table (composite PK `(userId, dateUTC)`, FK to `user.id` ON DELETE CASCADE, indexed on `userId` and `dateUTC`) records the per-UTC-day random track granted to free-tier users. Worker code reads both via the shared Drizzle client factory in `apps/api/src/db/client.ts`.

## Cookie cache vs secondary storage

Better Auth issue [#4203](https://github.com/better-auth/better-auth/issues/4203) reports stale-session reads when `cookieCache` and `secondaryStorage` are both enabled. We use `secondaryStorage` (KV) only; `cookieCache` is explicitly disabled.

## D1 encryption

Cloudflare D1 encrypts data at rest at the storage layer. No additional column-level encryption is applied.

## Deferred — explicit follow-ups

These were intentionally left out of the initial user-system rollout. Each has a one-line "how to start" so the next contributor doesn't have to re-discover.

- **OAuth social providers** — extend `socialProviders` in `apps/api/src/auth/index.ts`; Better Auth docs list the per-provider keys.
- **`organization` plugin** (teams, invites, RBAC) — `import { organization } from 'better-auth/plugins'` and add to `plugins` in the factory; will require new D1 tables.
- **Magic-link sign-in** — Better Auth `magicLink` plugin; needs an email provider first.
- **Two-factor authentication** — Better Auth `twoFactor` plugin; UI work in `apps/game/`.
- **Polar Usage-based billing** — add `usage` sub-plugin alongside the existing `checkout`/`portal`/`webhooks`.
- **Email verification + password-reset email** — currently disabled. When flipping `requireEmailVerification: true`, also flip `autoSignIn: false`. Pick an email provider (Resend / SES / Postmark) and wire `sendVerificationEmail`.
- **WAF tuning** — Better Auth's built-in `rateLimit` is on. Next layer is Cloudflare WAF rules on the worker route.
- **User-deletion endpoint (GDPR right-to-erasure)** — FK cascades are in place; build `DELETE /api/me` that calls `auth.api.deleteUser` + `polar.customers.deleteExternal`.
- **Account-enumeration mitigation** — accepted B2C trade-off for now (Better Auth's signup tells "email already exists"). Revisit for enterprise.
- **PostHog `identify(userId)`** — call from `AuthProvider` when session resolves; user lookup matches PostHog's identify-call expectations.
- **Hono RPC type sharing** — would publish `hc<Api>` typed client from `apps/api/`. Defer until SPA needs strongly-typed cross-package endpoints beyond `/api/me`.
- **Cloudflare Pages deployment for `apps/game/`** — separate plan; the dev story (Vite proxy → Wrangler) works end-to-end as-is.
- **CI/CD via tag-on-main** — user's intent: SemVer tag on main → `db:migrate:prod` + `wrangler deploy`. See `~/.claude/.../memory/project_ci_deploy_strategy.md`.
- **CSP + security headers** — add to worker (`Content-Security-Policy` with `script-src 'wasm-unsafe-eval'`, `Strict-Transport-Security`). Belongs in deployment config; ship alongside Pages.
- **Cross-subdomain cookies** — only needed if SPA and worker end up on different registrable domains. Set `crossSubDomainCookies` in the factory.
- **TOS + Privacy Policy URLs in Polar checkout config** — legal requirement before public launch.
- **`compatibility_date` refresh cadence** — review `apps/api/wrangler.toml` quarterly.
- **Migrate `wrangler.toml` → `wrangler.jsonc`** — toml stays supported; switch when toml support is dropped.
- **Per-request subscription cache** — `/api/me` makes a Polar API round-trip per call. Cache via KV with short TTL or surface tier via Better Auth `user.additionalFields` updated by webhooks.
- **Move `AuthProvider` out of `__root.tsx`** — currently wraps the Canvas subtree; not measurable today but the structural concern is real if the session refresh cadence increases.
- **Split rate-limit KV from session KV** — under brute-force load, rate-limit writes share quota with session writes. Add a separate `RATE_LIMIT` binding and wire it via a custom `rateLimit.storage`.

## Running locally

```sh
pnpm run dev
```

Turbo runs both the worker (`@car/api` on `:8787`) and the SPA (`@car/game` on `:7234`) in parallel. Logs are prefixed with `@car/api:dev:` and `@car/game:dev:`. Open `http://localhost:7234/`; sign-up is in the main menu's bottom panel. The Vite dev proxy forwards `/api/*` to `http://localhost:8787` so the browser sees same-origin cookies.

To start just one side: `pnpm --filter @car/api dev` or `pnpm --filter @car/game dev`.
