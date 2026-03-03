---
name: quality-gates
description: Enforce code quality standards before any commit or feature completion. This skill ensures all code meets type safety, testing, linting, and formatting requirements.
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
---

## Trigger Conditions

Activate this skill when:

- Preparing to commit code
- Completing a feature or task
- Running pre-merge validation
- User requests quality check

## Required Tools

- `command-runner` agent for executing quality checks
- `code-review` skill via sub-agent dispatch

## Workflow

### Step 1: Run Quality Gates

Execute all checks in sequence. Stop on first failure.

```bash
bun run typecheck:all  # Type safety
bun test               # Test suite
bun run lint           # Code quality
bun run format:check   # Formatting
```

### Step 2: Review Changes

```bash
git diff --cached
```

Verify the staged changes match intended modifications.

### Step 3: Dispatch Code Review

Invoke sub-agent with `code-review` skill to validate:

- Code patterns and best practices
- Security considerations
- Test coverage adequacy

### Step 4: Verify Coverage Thresholds

| Layer | Minimum Coverage |
| ----- | ---------------- |
| API   | 80%              |
| Logic | 90%              |

## Failure Protocol

When any gate fails:

1. **Read** - Parse error message completely
2. **Fix** - Apply minimal targeted fix
3. **Verify** - Re-run only the failed check
4. **Proceed** - Continue only when passing

Never proceed with failing gates.

## Strict Rules (NEVER violate)

- ❌ `git commit --no-verify`
- ❌ Force-merge failing PRs
- ❌ Commit with known failing tests
- ❌ Use `@ts-ignore` to suppress errors

## Allowed Exceptions

| Exception          | Condition                           |
| ------------------ | ----------------------------------- |
| `@ts-expect-error` | Linked issue for library bug        |
| `it.skip`          | TODO comment with explanation       |
| Technical debt     | Documented with resolution timeline |

## Output Format

Report results template reference [output-format.md](./references/output-format.md).

## Integration Points

This skill runs automatically on:

- Pre-commit hooks
- Pull request creation
- Merge to main branch

## Example Invocation

Reference example invocation [invocation.md](./references/invocation.md).
