# Gateway Architecture Review

> Applies to: `packages/gateway/**`, `packages/gateway-core/**`, `packages/gateway-cloud/**`

## Gateway Overview

athreei Gateway aggregates multiple MCP servers into a single connection point:

```
AI Apps (Claude, ChatGPT, Cursor)
          │
          ▼ (single MCP connection)
    athreei Gateway
          │
          ├── Tool aggregation & namespacing
          ├── Trace collection
          │
          ▼ (fan-out)
    MCP Servers (Figma, Sentry, Linear, ...)
```

## Tool Namespacing

- [ ] All tools namespaced: `{server}__{tool}`
- [ ] Namespace parsed correctly on dispatch
- [ ] No collision between server names

```typescript
// GOOD: Namespace handling
const NAMESPACE_SEPARATOR = "__"

function namespaceTool(server: string, tool: string): string {
  return `${server}${NAMESPACE_SEPARATOR}${tool}`
}

function parseNamespace(namespacedTool: string): {
  server: string
  tool: string
} {
  const idx = namespacedTool.indexOf(NAMESPACE_SEPARATOR)
  if (idx === -1) throw new Error("Invalid namespaced tool")
  return {
    server: namespacedTool.slice(0, idx),
    tool: namespacedTool.slice(idx + NAMESPACE_SEPARATOR.length),
  }
}

// Handle tools with __ in original name
// github__create_issue -> server: github, tool: create_issue
// my__server__my__tool -> server: my, tool: server__my__tool (first split only)
```

## Transport Layer

- [ ] stdio: Local binary, spawned by client
- [ ] SSE: Server-sent events for streaming
- [ ] HTTP: Request-response API

```typescript
// Transport selection
type GatewayTransport = "stdio" | "sse" | "http"

// CLI: athreei gateway --transport sse
// Env: ATHREEI_TRANSPORT=sse
// Default: stdio (local), http (cloud)
```

## Server Lifecycle

- [ ] Servers started lazily or on-demand
- [ ] Health checks for server availability
- [ ] Graceful shutdown with cleanup

```typescript
// GOOD: Lifecycle management
class ServerPool {
  private servers: Map<string, McpServer> = new Map()

  async getServer(name: string): Promise<McpServer> {
    if (!this.servers.has(name)) {
      const server = await this.startServer(name)
      this.servers.set(name, server)
    }
    return this.servers.get(name)!
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      [...this.servers.values()].map((s) => s.close())
    )
    this.servers.clear()
  }
}
```

## Request Routing

- [ ] Parse namespaced tool name
- [ ] Route to correct server
- [ ] Handle server unavailability

```typescript
// GOOD: Route with error handling
async function handleToolCall(
  namespacedTool: string,
  params: unknown
): Promise<ToolResult> {
  const { server, tool } = parseNamespace(namespacedTool)

  const mcpServer = await serverPool.getServer(server)
  if (!mcpServer) {
    throw new McpError(
      ErrorCodes.MethodNotFound,
      `Server not found: ${server}`
    )
  }

  return mcpServer.callTool(tool, params)
}
```

## Trace Collection

- [ ] Request/response logged
- [ ] Timing captured
- [ ] Errors recorded with context
- [ ] Sensitive data redacted

```typescript
// GOOD: Trace structure
interface Trace {
  id: string
  timestamp: Date
  server: string
  tool: string
  params: unknown // Redacted
  result?: unknown // Redacted
  error?: string
  durationMs: number
}
```

## Configuration

- [ ] Server configs from file or API
- [ ] Mode detection: `--local` flag > `ATHREEI_MODE` env > config shape
- [ ] Validation of server configurations

```typescript
// Config structure
interface GatewayConfig {
  mode: "local" | "cloud"
  servers: ServerConfig[]
}

interface ServerConfig {
  name: string
  command: string // For local: spawn command
  args?: string[]
  env?: Record<string, string>
  // Or for cloud
  url?: string
}
```

## Error Propagation

- [ ] MCP errors preserved
- [ ] Server errors wrapped appropriately
- [ ] Client receives actionable errors

## References

- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25/)
- [MCP Transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
