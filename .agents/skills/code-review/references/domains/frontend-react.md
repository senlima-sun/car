# React Review

> Applies to: `apps/*/src/**/*.tsx`, `packages/ui/**`

## Hooks Rules

- [ ] Hooks only at top level (no conditionals, loops)
- [ ] Hooks only in React functions (components, custom hooks)
- [ ] Complete dependency arrays (no missing deps)
- [ ] Stable references for callbacks (`useCallback`) and objects (`useMemo`)

```typescript
// BAD: Missing dependency
const [count, setCount] = useState(0)
useEffect(() => {
  document.title = `Count: ${count}`
}, []) // Missing `count`

// GOOD
useEffect(() => {
  document.title = `Count: ${count}`
}, [count])
```

## Memory Leaks

- [ ] Cleanup in useEffect return
- [ ] AbortController for fetch
- [ ] Remove event listeners
- [ ] Clear timers

```typescript
// GOOD: Proper cleanup
useEffect(() => {
  const controller = new AbortController()

  fetch(url, { signal: controller.signal })
    .then(setData)
    .catch(e => {
      if (e.name !== 'AbortError') throw e
    })

  const handler = () => setSize(window.innerWidth)
  window.addEventListener('resize', handler)

  return () => {
    controller.abort()
    window.removeEventListener('resize', handler)
  }
}, [url])
```

## Performance

- [ ] Keys on list items (stable, unique, not index)
- [ ] Avoid inline objects/functions in props (cause re-renders)
- [ ] `memo()` for expensive pure components
- [ ] `useMemo`/`useCallback` for expensive computations

```typescript
// BAD: New object every render
<Component style={{ color: "red" }} onClick={() => handleClick(id)} />

// GOOD: Stable references
const style = useMemo(() => ({ color: "red" }), [])
const handleItemClick = useCallback(() => handleClick(id), [id])
<Component style={style} onClick={handleItemClick} />
```

## State Management

- [ ] Lift state only as needed
- [ ] Co-locate state with usage
- [ ] Derived state computed, not stored
- [ ] No state duplication

```typescript
// BAD: Derived state stored
const [items, setItems] = useState([])
const [itemCount, setItemCount] = useState(0) // Redundant!

// GOOD: Derive from source
const [items, setItems] = useState([])
const itemCount = items.length
```

## Error Boundaries

- [ ] Error boundaries around independent UI sections
- [ ] Fallback UI for errors
- [ ] Error logging/reporting

## Accessibility

- [ ] Semantic HTML elements
- [ ] ARIA attributes where needed
- [ ] Keyboard navigation support
- [ ] Focus management

## TypeScript

- [ ] Props typed with interface/type
- [ ] Event handlers properly typed
- [ ] Generic components when reusable
- [ ] No `any` in component code

```typescript
interface ButtonProps {
  variant: "primary" | "secondary"
  onClick: () => void
  children: React.ReactNode
}

function Button({ variant, onClick, children }: ButtonProps) {
  return (
    <button className={styles[variant]} onClick={onClick}>
      {children}
    </button>
  )
}
```

## References

- [React Rules](https://react.dev/reference/rules)
- [useEffect Lifecycle](https://react.dev/learn/lifecycle-of-reactive-effects)
- [Performance](https://react.dev/learn/render-and-commit)
