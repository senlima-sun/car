# Commit Workflow Patterns

## Development Phases

### Phase 1: Setup/Scaffolding

Commit when foundation is ready:

```
chore(project): initialize with Vite + React + TypeScript
chore(lint): configure ESLint and Prettier
chore(test): add Vitest configuration
```

### Phase 2: Feature Implementation

Commit at logical milestones:

```
feat(user): add User model and types
feat(user): implement user repository
feat(user): add user service with validation
feat(user): create user API endpoints
test(user): add unit tests for user service
```

### Phase 3: Integration

Commit after connecting parts:

```
feat(auth): integrate user service with login flow
feat(ui): connect user form to API
test(auth): add integration tests for login
```

### Phase 4: Polish

Commit improvements separately:

```
refactor(user): extract validation to shared utility
perf(user): add database index for email lookup
style(user): apply consistent naming convention
docs(user): add JSDoc comments to public methods
```

## Commit Checkpoints

### Feature Development

```
Start feature
    │
    ├── Types/interfaces defined ──────► commit: feat(x): add types
    │
    ├── Core logic implemented ────────► commit: feat(x): implement core logic
    │
    ├── Tests written and passing ─────► commit: test(x): add unit tests
    │
    ├── Integration complete ──────────► commit: feat(x): integrate with Y
    │
    └── Edge cases handled ────────────► commit: fix(x): handle edge case Z
```

### Bug Fixing

```
Bug reported
    │
    ├── Bug reproduced ────────────────► (no commit yet)
    │
    ├── Test written that fails ───────► commit: test(x): add failing test for #123
    │
    ├── Bug fixed, test passes ────────► commit: fix(x): resolve issue with Y
    │
    └── Related issues addressed ──────► commit: fix(x): handle similar case in Z
```

### Refactoring

```
Refactor needed
    │
    ├── Tests verify current behavior ─► commit: test(x): add coverage before refactor
    │
    ├── Extract/rename/restructure ────► commit: refactor(x): extract Y into Z
    │
    └── Tests still pass ──────────────► (included in refactor commit)
```

## Practical Triggers

### Commit Immediately When

- Tests pass after implementing a function
- A file is complete and won't change soon
- Before taking a break (lunch, end of day)
- Before switching to a different task
- After fixing a bug and verifying the fix
- When you can write a clear commit message

### Wait to Commit When

- Code doesn't compile/run
- Tests are failing
- You're in the middle of a thought
- Changes span multiple unrelated areas (split first)

## Commit Sizing Guide

### Too Small

```
fix(user): add missing semicolon
style(user): fix indentation line 42
```

Group formatting fixes into one commit.

### Just Right

```
feat(cart): add quantity validation

- Prevent negative quantities
- Cap maximum at 99
- Show inline error message
```

### Too Large

```
feat(checkout): implement entire checkout flow with cart,
payment, shipping, confirmation, and email notifications
```

Split into multiple focused commits.

## Work Session Pattern

### Starting Work

```bash
git pull origin main
git checkout -b feature/user-profile
```

### During Work

```
[Write types]           → git commit -m "feat(profile): add profile types"
[Implement logic]       → git commit -m "feat(profile): implement profile service"
[Write tests]           → git commit -m "test(profile): add service unit tests"
[Fix failing test]      → git commit -m "fix(profile): handle null avatar URL"
[Refactor]              → git commit -m "refactor(profile): extract validation"
```

### End of Session

```bash
# If work is incomplete but stable
git commit -m "feat(profile): add basic form (WIP)"

# Or stash if not ready to commit
git stash push -m "profile form in progress"
```

### Before PR

```bash
# Review commits
git log --oneline -10

# Squash WIP commits if needed
git rebase -i HEAD~3

# Clean history then push
git push origin feature/user-profile
```

## Team Coordination

### Shared Branches

- Only commit working code
- Run tests before pushing
- Keep commits atomic for easier review

### Feature Branches

- Commit freely during development
- Clean up history before merge
- Squash "WIP" and "fix typo" commits

### Commit for Your Future Self

Ask: "If I look at this in 6 months, will I understand what changed and why?"

## Recovery Patterns

### Undo Last Commit (Keep Changes)

```bash
git reset --soft HEAD~1
```

### Fix Last Commit Message

```bash
git commit --amend -m "correct message"
```

### Add to Last Commit

```bash
git add forgotten-file.ts
git commit --amend --no-edit
```

### Split Accidental Big Commit

```bash
git reset --soft HEAD~1
git add -p  # Stage selectively
git commit -m "first part"
git add -p
git commit -m "second part"
```
