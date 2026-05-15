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
| `POLAR_PRODUCT_ID_PRO` | Polar product page        | Product id for the personal `pro` tier.                                                                                                                                        |
| `BILLING_SUCCESS_URL`  | Hand-picked               | Polar redirects here after checkout success.                                                                                                                                   |

Production: `pnpm --filter @car/api exec wrangler secret put <NAME>`.

## Migration policy

Forward-only. Generate migrations exclusively via `pnpm --filter @car/api db:generate` — never invoke `wrangler d1 migrations create` directly (it desyncs Drizzle's `migrations/meta/_journal.json`). For data recovery, use D1 time-travel; rollback migrations are unsupported on D1.

A `predeploy` script (`apps/api/scripts/check-d1-migrations.ts`) refuses to deploy the worker if any migration is pending on remote D1; run `pnpm --filter @car/api db:migrate:prod` first.

## Cookie cache vs secondary storage

Better Auth issue [#4203](https://github.com/better-auth/better-auth/issues/4203) reports stale-session reads when `cookieCache` and `secondaryStorage` are both enabled. We use `secondaryStorage` (KV) only; `cookieCache` is explicitly disabled.

## D1 encryption

Cloudflare D1 encrypts data at rest at the storage layer. No additional column-level encryption is applied.

## Running locally

Two terminals:

```sh
# Terminal 1: worker
pnpm --filter @car/api dev

# Terminal 2: SPA
pnpm --filter @car/game dev
```

Then open `http://localhost:7234/`. Sign-up is in the main menu's bottom panel. The Vite dev proxy forwards `/api/*` to `http://localhost:8787` so the browser sees same-origin cookies.
