# Electron Main Process Review

> Applies to: `apps/desktop/src/main/**`

## Security Model

- [ ] `nodeIntegration: false` (default since v5)
- [ ] `contextIsolation: true` (default since v12)
- [ ] `sandbox: true` (default since v20)
- [ ] `webSecurity: true` (never disable)

## Window Configuration

```typescript
// GOOD: Secure defaults
new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
  },
})

// BAD: Security disabled
new BrowserWindow({
  webPreferences: {
    nodeIntegration: true, // CRITICAL: Never enable
    contextIsolation: false, // CRITICAL: Never disable
    webSecurity: false, // CRITICAL: Never disable
  },
})
```

## IPC Handler Security

- [ ] Validate `event.senderFrame.url` origin
- [ ] Validate all arguments (don't trust renderer)
- [ ] Use `handle()` over `on()` for request-response
- [ ] No arbitrary file system access from IPC

```typescript
// GOOD: Validate sender and arguments
ipcMain.handle("read-config", async (event, key: unknown) => {
  const url = new URL(event.senderFrame.url)
  if (url.protocol !== "file:" && url.origin !== TRUSTED_ORIGIN) {
    throw new Error("Unauthorized")
  }
  if (typeof key !== "string" || !ALLOWED_KEYS.includes(key)) {
    throw new Error("Invalid key")
  }
  return config.get(key)
})

// BAD: No validation
ipcMain.handle("read-file", async (_, path) => {
  return fs.readFile(path) // Arbitrary file read!
})
```

## External Resources

- [ ] No `shell.openExternal()` with untrusted URLs
- [ ] Validate URLs before opening
- [ ] No `file://` protocol for remote content

```typescript
// GOOD: Validate URL
function openExternal(url: string) {
  const parsed = new URL(url)
  if (!["https:", "mailto:"].includes(parsed.protocol)) {
    throw new Error("Invalid protocol")
  }
  if (!ALLOWED_HOSTS.includes(parsed.host)) {
    throw new Error("Untrusted host")
  }
  shell.openExternal(url)
}
```

## Window Management

- [ ] `setWindowOpenHandler` to control new windows
- [ ] Validate navigation with `will-navigate`
- [ ] No `allowpopups` in WebViews

## Fuses (Build-time)

- [ ] Disable `runAsNode` if not needed
- [ ] Disable `nodeCliInspect` in production
- [ ] Enable `onlyLoadAppFromAsar`

## References

- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)
