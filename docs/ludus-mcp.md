# Ludus MCP

This repo includes a project-level MCP configuration for the Ludus MCP endpoint.

## VS Code

The configuration is stored in `.vscode/mcp.json`:

```json
{
  "servers": {
    "ludus-mcp": {
      "type": "http",
      "url": "https://mcp.ludusengine.com/mcp"
    }
  }
}
```

To enable it in VS Code:

- Open the command palette and run `MCP: List Servers`
- Select `ludus-mcp`
- Choose `Start Server`

If VS Code prompts for authentication, complete the sign-in flow.
