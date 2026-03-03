# Correctness Review Checklist

## Edge Cases

- [ ] Null/undefined handled (optional chaining, nullish coalescing)
- [ ] Empty arrays/objects handled
- [ ] Boundary values (0, negative, MAX_SAFE_INTEGER)
- [ ] Unicode and special characters in strings

## Error Handling

- [ ] Async errors caught (try/catch, .catch())
- [ ] Error boundaries for React component trees
- [ ] Graceful degradation on failure
- [ ] No swallowed errors (empty catch blocks)

## Async Operations

- [ ] All promises awaited or handled
- [ ] No floating promises (`arr.map(async ...)` without Promise.all)
- [ ] Race conditions prevented (state updates, concurrent requests)
- [ ] Cleanup on unmount/abort

## Resource Management

- [ ] Files/connections closed after use
- [ ] Timers cleared (clearTimeout, clearInterval)
- [ ] AbortController for cancellable requests
- [ ] Transaction rollback on failure

## State Consistency

- [ ] No stale closures in hooks (correct dependency arrays)
- [ ] Optimistic updates handle rollback
- [ ] Database transactions for multi-step operations
- [ ] Idempotent operations where needed

## Type Safety

- [ ] No `any` types (use `unknown` + type guards)
- [ ] Runtime validation matches TypeScript types
- [ ] Discriminated unions over type assertions
- [ ] Exhaustive switch statements (`never` check)

## Testing Indicators

- [ ] New code has corresponding tests
- [ ] Edge cases covered in tests
- [ ] Error paths tested
- [ ] Mocks properly isolated and cleaned up

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [React Rules](https://react.dev/reference/rules)
- [Zod Documentation](https://zod.dev/)
