# tracetify-mcp

MCP server for [Tracetify](https://tracetify.com) — trace how any product
actually grew, without leaving Claude Code or Cursor.

Most competitive tools tell you where a product stands **today**. Tracetify
reconstructs **how it got there**: the first mention, the quiet weeks, the
directory wave, the launch spike. Twelve sources per trace, every claim
linked to the page it came from.

## Setup

1. Sign in at [tracetify.com](https://tracetify.com) and create an API key
   in the dashboard.
2. Add the server to your MCP client config:

```json
{
  "mcpServers": {
    "tracetify": {
      "command": "npx",
      "args": ["-y", "tracetify-mcp"],
      "env": { "TRACETIFY_API_KEY": "ttfy_..." }
    }
  }
}
```

Claude Code: `claude mcp add tracetify -e TRACETIFY_API_KEY=ttfy_... -- npx -y tracetify-mcp`

## Tools

| Tool | Cost | What it does |
| --- | --- | --- |
| `search_reports` | free | Find existing growth reports by domain |
| `read_report` | free | Read a full report (timeline & verdict follow your account's unlocks) |
| `start_trace` | credits | Trace a new competitor from 12 sources (~60–90s); returns a cached report for free when a fresh one exists |
| `get_trace` | free | Poll a running trace |

Fresh traces draw from your Tracetify credit balance — the same balance the
website uses. No seats, no per-tool add-ons. Top up at
[tracetify.com/pricing](https://tracetify.com/pricing).

## License

MIT
