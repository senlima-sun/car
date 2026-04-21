# Electron IPC Review

> Applies to: `apps/desktop/src/main/**`, `apps/desktop/src/preload/**`, `apps/desktop/src/renderer/**`

## IPC Patterns

### Renderer-to-Main (Request-Response)

```typescript
// preload.ts - GOOD: Explicit, typed API
contextBridge.exposeInMainWorld('api', {
  getConfig: (key: string) => ipcRenderer.invoke('config:get', key),
  setConfig: (key: string, value: unknown) => ipcRenderer.invoke('config:set', key, value),
})

// preload.ts - BAD: Raw API exposure
contextBridge.exposeInMainWorld('api', {
  invoke: ipcRenderer.invoke, // Allows arbitrary IPC!
  send: ipcRenderer.send, // Allows arbitrary IPC!
})
```

### Main-to-Renderer (Push)

```typescript
// main.ts - Send to specific window
mainWindow.webContents.send('update-available', version)

// renderer.ts - Listen via preload bridge
window.api.onUpdateAvailable(version => showUpdateUI(version))
```

## Preload Script Rules

- [ ] One function per IPC channel (no raw `send`/`invoke`)
- [ ] TypeScript types for all exposed APIs
- [ ] No Node.js APIs exposed directly
- [ ] Remove listeners on cleanup

```typescript
// GOOD: Typed, scoped API
export interface ElectronAPI {
  config: {
    get: (key: ConfigKey) => Promise<ConfigValue>
    set: (key: ConfigKey, value: ConfigValue) => Promise<void>
  }
  app: {
    getVersion: () => Promise<string>
    quit: () => void
  }
}

contextBridge.exposeInMainWorld('electron', {
  config: {
    get: key => ipcRenderer.invoke('config:get', key),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    quit: () => ipcRenderer.send('app:quit'),
  },
} satisfies ElectronAPI)
```

## Channel Naming

- [ ] Namespaced channels: `domain:action` (e.g., `config:get`, `window:minimize`)
- [ ] Consistent naming across handlers
- [ ] Document all channels in types

## Argument Validation (Main Process)

```typescript
// GOOD: Validate everything
ipcMain.handle('file:read', async (event, filePath: unknown) => {
  // 1. Validate sender
  if (!isFromTrustedRenderer(event)) {
    throw new Error('Unauthorized sender')
  }

  // 2. Validate type
  if (typeof filePath !== 'string') {
    throw new Error('filePath must be string')
  }

  // 3. Validate value (path traversal prevention)
  const resolved = path.resolve(SAFE_BASE_DIR, filePath)
  if (!resolved.startsWith(SAFE_BASE_DIR)) {
    throw new Error('Path traversal detected')
  }

  return fs.readFile(resolved, 'utf-8')
})
```

## Serialization Limits

Objects sent via IPC use Structured Clone Algorithm:

- DOM objects
- Node.js objects (`process`, `Buffer` in some cases)
- Electron objects (`BrowserWindow`, `WebContents`)
- Functions, Symbols

```typescript
// BAD: Won't serialize
ipcRenderer.send('data', {
  element: document.body, // DOM object
  callback: () => {}, // Function
})

// GOOD: Plain data only
ipcRenderer.send('data', {
  html: document.body.innerHTML,
  timestamp: Date.now(),
})
```

## Performance

- [ ] No `ipcRenderer.sendSync()` (blocks UI thread)
- [ ] Batch multiple related operations
- [ ] Use MessagePorts for high-frequency communication

## References

- [IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [MessagePorts](https://www.electronjs.org/docs/latest/tutorial/message-ports)
