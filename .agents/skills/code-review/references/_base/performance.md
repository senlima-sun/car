# Performance Review Checklist

## Algorithmic Complexity

- [ ] No O(n^2) or worse in hot paths
- [ ] Appropriate data structures (Map/Set for lookups, not Array.find)
- [ ] Early returns to avoid unnecessary computation

## Database & Queries

- [ ] No N+1 queries (batch fetches, joins, or DataLoader)
- [ ] Indexes exist for filtered/sorted columns
- [ ] SELECT only needed columns, not `SELECT *`
- [ ] Pagination for large datasets

## Memory

- [ ] Event listeners cleaned up (useEffect cleanup, removeEventListener)
- [ ] Subscriptions unsubscribed (observables, WebSocket)
- [ ] Large objects not held in closures unnecessarily
- [ ] Streams used for large data instead of buffering

## Async & Concurrency

- [ ] `Promise.all()` for independent parallel operations
- [ ] No unnecessary `await` in loops (batch instead)
- [ ] No sync IPC (`ipcRenderer.sendSync`) in Electron
- [ ] Appropriate timeouts on external calls

## Caching

- [ ] React `cache()` for request-level deduplication
- [ ] `unstable_cache` or external cache for expensive computations
- [ ] Appropriate cache invalidation strategy
- [ ] No redundant API calls in component trees

## Bundle & Loading

- [ ] Dynamic imports for heavy components (`next/dynamic`, `React.lazy`)
- [ ] Code splitting at route boundaries
- [ ] No large dependencies in client bundle
- [ ] Images optimized (next/image, appropriate formats)

## References

- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance)
- [React Profiler](https://react.dev/reference/react/Profiler)
