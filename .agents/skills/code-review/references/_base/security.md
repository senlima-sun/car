# Security Review Checklist

## Input Validation

- [ ] All external input validated (user input, URL params, API responses)
- [ ] Schema validation on boundaries (Zod, ArkType, etc.)
- [ ] Type coercion handled explicitly (string IDs, numeric params)

## Injection Prevention

- [ ] SQL: Parameterized queries only (template literals, not concatenation)
- [ ] Command: No `shell.openExternal()` with user data, no dynamic code execution
- [ ] XSS: `textContent` over `innerHTML`, sanitize HTML if required
- [ ] Prototype pollution: No `Object.assign(target, userInput)`

## Authentication & Authorization

- [ ] Auth check at data access layer, not just middleware
- [ ] Re-authorize in every Server Action / IPC handler
- [ ] Session validation on sensitive operations
- [ ] No auth logic in Client Components

## Secrets & Credentials

- [ ] No hardcoded secrets (API keys, tokens, passwords)
- [ ] Environment variables for sensitive config
- [ ] `server-only` import for server-side secrets
- [ ] Secrets not logged or exposed in error messages

## Cryptography

- [ ] `crypto.randomUUID()` or `crypto.getRandomValues()` for security-sensitive random
- [ ] No `Math.random()` for tokens, IDs, or security contexts
- [ ] Proper key derivation for encryption

## Data Exposure

- [ ] DTOs for client-facing data (no raw database objects)
- [ ] Minimal props to Client Components
- [ ] No sensitive fields in API responses without authorization
- [ ] Error messages don't leak internal details

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/blog/security-nextjs-server-components-actions)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
