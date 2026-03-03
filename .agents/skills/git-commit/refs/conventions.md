# Commit Conventions

## Full Message Format

```
<type>(<scope>): <subject>
<blank line>
<body>
<blank line>
<footer>
```

## Subject Line

### Rules

- Imperative mood ("add" not "added")
- Lowercase (except proper nouns)
- No period at end
- Max 50 characters
- Complete the sentence: "This commit will..."

### Good Examples

```
feat(auth): add OAuth2 login with Google
fix(cart): prevent negative quantity values
refactor(api): extract validation middleware
docs(readme): add installation instructions
test(user): cover email edge cases
chore(deps): bump lodash to 4.17.21
perf(query): add index for user lookup
style(lint): fix eslint warnings
```

### Bad Examples

```
Fixed the bug                    # Past tense, vague
Add new feature.                 # Period, vague
FEAT: user authentication        # Uppercase type
updated dependencies and also fixed some tests and refactored the user module
                                 # Too long, multiple changes
```

## Body (Optional)

Use when the subject alone isn't enough to explain:

- **What** changed and **why**
- Context that isn't obvious from code
- Trade-offs or decisions made

### Format

- Blank line after subject
- Wrap at 72 characters
- Explain what and why, not how (code shows how)

### Example

```
fix(payments): prevent duplicate charge on retry

When payment API times out, the retry logic was not checking
if the original request succeeded. Added idempotency key to
prevent duplicate charges.

The timeout is kept at 30s as reducing it caused issues with
some payment providers.
```

## Footer (Optional)

### Breaking Changes

```
feat(api)!: change response format to camelCase

BREAKING CHANGE: All API responses now use camelCase instead
of snake_case. Update client code accordingly.
```

### Issue References

```
fix(login): resolve session timeout during upload

Closes #234
Related to #180
```

### Co-authors

```
feat(dashboard): add analytics widget

Co-authored-by: Alice <alice@example.com>
Co-authored-by: Bob <bob@example.com>
```

## Type Reference

| Type       | When to Use                 | Triggers Release |
| ---------- | --------------------------- | ---------------- |
| `feat`     | New feature for users       | Minor            |
| `fix`      | Bug fix for users           | Patch            |
| `docs`     | Documentation only          | No               |
| `style`    | Formatting, whitespace      | No               |
| `refactor` | Code change, no feature/fix | No               |
| `perf`     | Performance improvement     | Patch            |
| `test`     | Adding/updating tests       | No               |
| `chore`    | Maintenance, tooling        | No               |
| `ci`       | CI/CD changes               | No               |
| `build`    | Build system changes        | No               |
| `revert`   | Reverting previous commit   | Varies           |

## Scope Examples

Choose scope based on your project structure:

### By Feature/Module

```
feat(auth): ...
fix(cart): ...
refactor(checkout): ...
```

### By Layer

```
feat(api): ...
fix(ui): ...
test(db): ...
```

### By Component

```
feat(Button): ...
fix(UserProfile): ...
style(Header): ...
```

### No Scope (Global Changes)

```
chore: upgrade all dependencies
docs: update contributing guide
style: apply prettier formatting
```

## Special Cases

### Reverting

```
revert: feat(auth): add OAuth2 login

This reverts commit abc1234.

OAuth2 integration causing login failures for existing users.
Rolling back while investigating.
```

### Work in Progress (Local Only)

```
wip: cart discount logic

DO NOT MERGE - still implementing edge cases
```

Note: Squash or amend WIP commits before pushing.

### Merge Commits

Let Git generate these, or use:

```
merge: branch 'feature/auth' into develop
```

## Validation

### Git Hooks (commitlint)

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-max-length': [2, 'always', 50],
    'body-max-line-length': [2, 'always', 72],
  },
}
```

### Pre-commit Check

```bash
#!/bin/sh
# .git/hooks/commit-msg

commit_regex='^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?: .{1,50}$'

if ! grep -qE "$commit_regex" "$1"; then
    echo "Invalid commit message format"
    echo "Expected: type(scope): subject"
    exit 1
fi
```
