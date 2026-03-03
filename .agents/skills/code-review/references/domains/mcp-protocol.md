# MCP Protocol Review

> Applies to: `packages/gateway/**`, `packages/gateway-core/**`, `packages/gateway-cloud/**`

## MCP Specification (2025-11-25)

The Model Context Protocol defines how AI clients communicate with tool servers.

## Tool Definition

- [ ] Clear, descriptive tool names
- [ ] JSON Schema for input validation
- [ ] Detailed descriptions for LLM understanding
- [ ] Required vs optional parameters marked

```typescript
// GOOD: Well-defined tool
server.tool({
  name: "create_issue",
  description: "Create a new issue in the project tracker",
  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Issue title (required)",
      },
      body: {
        type: "string",
        description: "Issue description in markdown",
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "Labels to apply",
      },
    },
    required: ["title"],
  },
  handler: async (params) => {
    // Implementation
  },
})
```

## Tool Namespacing (athreei Gateway)

athreei prefixes tools with server name to avoid collisions:

```typescript
// Original tool: create_issue
// Namespaced: github__create_issue

// Pattern: {server}__{tool}
// Double underscore separator

// GOOD: Check for namespace in gateway code
function namespaceTool(serverName: string, toolName: string): string {
  return `${serverName}__${toolName}`
}

function parseNamespacedTool(name: string): { server: string; tool: string } {
  const [server, ...rest] = name.split("__")
  return { server, tool: rest.join("__") }
}
```

## Transport Handling

- [ ] Support stdio (default), SSE, HTTP
- [ ] Proper message framing
- [ ] Handle connection lifecycle

```typescript
// Gateway transport selection
type Transport = "stdio" | "sse" | "http"

// CLI flag: --transport sse
// Default: stdio for local, http for cloud
```

## Error Handling

- [ ] Use MCP error codes
- [ ] Informative error messages
- [ ] Don't leak sensitive info in errors

```typescript
// MCP Error Codes
const ErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
}

// GOOD: Structured error
throw new McpError(ErrorCodes.InvalidParams, "Missing required field: title")
```

## Resource Handling

- [ ] URI scheme defined (`file://`, custom schemes)
- [ ] MIME types specified
- [ ] Pagination for large resources

```typescript
server.resource({
  uri: "config://app/settings",
  name: "Application Settings",
  mimeType: "application/json",
  handler: async () => {
    return JSON.stringify(settings)
  },
})
```

## Prompt Templates

- [ ] Clear prompt names
- [ ] Arguments validated
- [ ] Useful for common patterns

```typescript
server.prompt({
  name: "summarize_file",
  description: "Generate a summary of a file's contents",
  arguments: [
    {
      name: "path",
      description: "Path to the file to summarize",
      required: true,
    },
  ],
  handler: async ({ path }) => {
    const content = await readFile(path)
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please summarize this file:\n\n${content}`,
          },
        },
      ],
    }
  },
})
```

## Security Considerations

- [ ] Validate all tool inputs server-side
- [ ] No arbitrary code execution
- [ ] Rate limiting on tool calls
- [ ] Audit logging for sensitive operations

## References

- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [MCP Security](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices)
