# Monorepo Patterns Review

> Applies to: all packages and apps

## Import Rules

- [ ] Use workspace imports (`@athreei/shared`, not relative paths)
- [ ] No circular dependencies between packages
- [ ] Shared types in `@athreei/shared`

```typescript
// GOOD: Workspace import
import { ApiError } from '@athreei/shared/errors'
import { UserSchema } from '@athreei/shared/schemas'

// BAD: Relative cross-package import
import { ApiError } from '../../../packages/shared/src/errors'

// BAD: Importing from app in package
import { config } from '@athreei/platform/config' // packages can't depend on apps
```

## Package Boundaries

```
packages/     (shared libraries, no app dependencies)
├── shared    → Types, utils, schemas (no external deps preferred)
├── db        → Database (can import shared)
├── auth      → Auth (can import shared, db)
├── ui        → UI components (can import shared)
└── gateway-* → Gateway logic (can import shared)

apps/         (applications, can import any package)
├── api       → Backend API
├── platform  → Frontend
├── desktop   → Electron app
├── cli       → CLI tool
└── docs      → Documentation
```

## Type Sharing

- [ ] Export types from package index
- [ ] Use `@athreei/shared` for cross-package types
- [ ] Avoid type-only packages (use shared)

```typescript
// packages/shared/src/types/user.ts
export interface User {
  id: string
  email: string
  name: string
}

// packages/shared/src/index.ts
export type { User } from './types/user'

// apps/api/src/routes/users.ts
import type { User } from '@athreei/shared'
```

## Build Order

Packages must build before apps that depend on them:

```json
// turbo.json or bun workspace
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

## Version Consistency

- [ ] Same version of shared dependencies across workspace
- [ ] No duplicate dependencies (check with `bun pm ls`)
- [ ] Peer dependencies for React, etc.

```json
// packages/ui/package.json
{
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

## Testing

- [ ] Unit tests in each package
- [ ] Integration tests in apps
- [ ] Shared test utilities in separate package or test folder

```bash
bun run test              # All tests
bun run test --filter=db  # Single package
```

## References

- [Bun Workspaces](https://bun.sh/docs/install/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
