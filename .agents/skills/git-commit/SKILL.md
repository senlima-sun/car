---
name: git-commit
description: Git commit conventions and discipline. Use when committing code, reviewing commit history, or when a logical unit of work is complete. Encourages atomic commits at natural checkpoints.
---

# Git Commit Guidelines

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type (required)

- `feat` — New feature
- `fix` — Bug fix
- `refactor` — Code change (no feature/fix)
- `docs` — Documentation only
- `test` — Adding/updating tests
- `chore` — Build, CI, tooling, dependencies
- `perf` — Performance improvement
- `style` — Formatting (no logic change)

### Scope (optional)

Module or component affected: `auth`, `api`, `ui`, `db`, etc.

### Subject (required)

- Imperative mood: "add" not "added" or "adds"
- Lowercase, no period
- Under 50 characters

### Examples

```
feat(auth): add password reset flow
fix(api): handle null response from user service
refactor(cart): extract discount calculation logic
test(user): add edge cases for email validation
chore: upgrade dependencies to latest versions
```

## When to Commit

Commit at these natural checkpoints to maintain clear work logs:

### Commit After

1. **Feature complete** — A working feature, even if minimal
2. **Bug fixed** — Problem resolved and verified
3. **Refactor done** — Code improved, tests still pass
4. **Test added** — New test coverage for existing code
5. **Config changed** — Environment, build, or tooling updates
6. **Before switching context** — Save progress before moving to different task
7. **Logical unit complete** — Self-contained change that makes sense alone

### Avoid

- Committing broken code to shared branches
- Mixing unrelated changes in one commit
- Giant commits that do many things
- Vague messages like "fix bug" or "update code"

## Commit Discipline

### Ask Before Committing

1. Does this commit do ONE thing?
2. Can I describe it in under 50 characters?
3. Would someone understand this from the message alone?
4. Are tests passing?

### Atomic Commits

Each commit should be:

- **Self-contained** — Makes sense on its own
- **Reversible** — Can be reverted without breaking other things
- **Buildable** — Code compiles/runs after this commit

## References

- [Detailed conventions](refs/conventions.md) — Full format spec, body/footer usage
- [Workflow patterns](refs/workflow.md) — When to commit during development phases
