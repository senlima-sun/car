# Review Output Template

## Report Format

```markdown
## Code Review: {filename or scope}

**Domains**: {detected domains}
**Focus**: {focus mode}

### Summary

- Total: X critical, Y errors, Z warnings
- Key concerns: {1-2 sentence overview}

---

### Critical Issues (must fix)

- **[{file}:{line}]** {issue title}
  - **Why**: {explanation of the risk}
  - **Fix**: {concrete suggestion}

### Errors (should fix)

- **[{file}:{line}]** {issue title}
  - **Why**: {explanation}
  - **Fix**: {suggestion}

### Warnings (consider)

- **[{file}:{line}]** {issue title}

---

### Checklist

- [ ] {actionable item from review}
- [ ] {another item}
```

## Severity Definitions

| Level        | Description                                       | Action               |
| ------------ | ------------------------------------------------- | -------------------- |
| **Critical** | Security vulnerabilities, data leaks, crashes     | Must fix immediately |
| **Error**    | Bugs, race conditions, resource leaks, type holes | Fix before merge     |
| **Warning**  | Code smells, complexity, naming, style            | Consider fixing      |

## Example Output

```markdown
## Code Review: apps/api/src/routes/users.ts

**Domains**: backend-hono, database-drizzle
**Focus**: all

### Summary

- Total: 1 critical, 2 errors, 1 warning
- Key concerns: SQL injection risk and missing auth check

---

### Critical Issues (must fix)

- **[users.ts:45]** SQL injection via string interpolation
  - **Why**: User input directly interpolated into query allows arbitrary SQL execution
  - **Fix**: Use parameterized query: `sql\`SELECT * FROM users WHERE id = ${id}\``

### Errors (should fix)

- **[users.ts:23]** Missing authentication check
  - **Why**: Endpoint accessible without valid session
  - **Fix**: Add auth middleware or check `getCurrentUser()` at start

- **[users.ts:67]** N+1 query in loop
  - **Why**: Fetches posts individually for each user, causing O(n) queries
  - **Fix**: Use `with: { posts: true }` in Drizzle query or batch fetch

### Warnings (consider)

- **[users.ts:12]** Function exceeds 100 lines

---

### Checklist

- [ ] Fix SQL injection (critical)
- [ ] Add auth middleware to route
- [ ] Refactor to batch query
- [ ] Add tests for new validation
```

## Tags

Use inline tags for quick scanning:

- `[SECURITY]` - Security-related issue
- `[PERF]` - Performance concern
- `[TYPE]` - Type safety issue
- `[AUTO-FIXABLE]` - Can be fixed with linter/formatter
