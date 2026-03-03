---
name: code-review
description: Code review for athreei codebase. Triggers on "review this code", "code review", "check my code", "PR review".
---

# Code Review Skill

## When to Use

| Timing             | Scope                | Focus                                          |
| ------------------ | -------------------- | ---------------------------------------------- |
| During development | Single file/function | Quick feedback, catch issues early             |
| End of task        | Feature branch       | Full review before PR, edge cases, no TODOs    |
| PR review          | Diff only            | Changed lines + context, no regressions        |
| Pre-merge          | Critical paths       | Security & performance on auth, payments, data |

## Workflow

1. Detect file path → map to domains
2. Load base rules: [\_base/\*](references/_base/) (always apply)
3. Load domain rules: [domains/{detected}](references/domains/) (based on path)
4. Load project patterns: [patterns/\*](references/patterns/) (if applicable)
5. Apply review → format with [output-template](references/output-template.md)

## Domain Detection

| File Path Pattern              | Domains                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| apps/platform/\*\*             | [frontend-nextjs](references/domains/frontend-nextjs.md), [frontend-react](references/domains/frontend-react.md) |
| apps/docs/\*\*                 | [frontend-nextjs](references/domains/frontend-nextjs.md), [frontend-react](references/domains/frontend-react.md) |
| apps/desktop/src/main/\*\*     | [electron-main](references/domains/electron-main.md), [electron-ipc](references/domains/electron-ipc.md)         |
| apps/desktop/src/preload/\*\*  | [electron-ipc](references/domains/electron-ipc.md)                                                               |
| apps/desktop/src/renderer/\*\* | [frontend-react](references/domains/frontend-react.md), [electron-ipc](references/domains/electron-ipc.md)       |
| apps/api/\*\*                  | [backend-hono](references/domains/backend-hono.md), [database-drizzle](references/domains/database-drizzle.md)   |
| apps/cli/\*\*                  | (base rules only)                                                                                                |
| packages/gateway/\*\*          | [mcp-protocol](references/domains/mcp-protocol.md)                                                               |
| packages/gateway-core/\*\*     | [mcp-protocol](references/domains/mcp-protocol.md)                                                               |
| packages/gateway-cloud/\*\*    | [backend-hono](references/domains/backend-hono.md), [mcp-protocol](references/domains/mcp-protocol.md)           |
| packages/db/\*\*               | [database-drizzle](references/domains/database-drizzle.md)                                                       |
| packages/auth/\*\*             | [backend-hono](references/domains/backend-hono.md), [database-drizzle](references/domains/database-drizzle.md)   |
| packages/ui/\*\*               | [frontend-react](references/domains/frontend-react.md)                                                           |
| packages/shared/\*\*           | (base rules only)                                                                                                |

## Pattern Detection

| Condition                                | Pattern                                       |
| ---------------------------------------- | --------------------------------------------- |
| Cross-package imports                    | [monorepo](references/patterns/monorepo.md)   |
| Files in packages/auth/\*\* or auth code | [auth-flow](references/patterns/auth-flow.md) |
| Files in packages/gateway\*/\*\*         | [gateway](references/patterns/gateway.md)     |

## Focus Modes

| Mode        | Emphasis                              |
| ----------- | ------------------------------------- |
| security    | Vulns, injection, auth, data exposure |
| performance | Complexity, memory, queries, caching  |
| correctness | Logic, edge cases, types, tests       |
| all         | Balanced review (default)             |

## References

Base rules (always apply):

- [security](references/_base/security.md)
- [performance](references/_base/performance.md)
- [correctness](references/_base/correctness.md)

Domain rules:

- [electron-main](references/domains/electron-main.md) — Electron main process
- [electron-ipc](references/domains/electron-ipc.md) — IPC communication
- [frontend-nextjs](references/domains/frontend-nextjs.md) — Next.js App Router
- [frontend-react](references/domains/frontend-react.md) — React components
- [backend-hono](references/domains/backend-hono.md) — Hono API routes
- [database-drizzle](references/domains/database-drizzle.md) — Drizzle ORM
- [mcp-protocol](references/domains/mcp-protocol.md) — MCP SDK & protocol

Project patterns:

- [monorepo](references/patterns/monorepo.md) — Cross-package rules
- [auth-flow](references/patterns/auth-flow.md) — Better Auth integration
- [gateway](references/patterns/gateway.md) — Gateway architecture

Output format:

- [output-template](references/output-template.md)

## Usage Examples

```
# Review specific file
"Review apps/api/src/routes/users.ts"
→ Loads: _base/*, domains/backend-hono.md, domains/database-drizzle.md

# Review with focus
"Security review packages/auth/src/server.ts"
→ Loads: _base/security.md, patterns/auth-flow.md

# Review PR diff
"Review this PR for performance issues"
→ Loads: _base/performance.md, domains based on changed files
```
