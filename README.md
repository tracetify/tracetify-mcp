# tracetify-mcp

MCP server for [Tracetify](https://tracetify.com) — trace how any product
actually grew, read your own Search Console, and audit a site, without leaving
Claude Code or Cursor.

Most competitive tools tell you where a product stands **today**. Tracetify
reconstructs **how it got there**: the first mention, the quiet weeks, the
directory wave, the launch spike. Twelve sources per trace, every claim
linked to the page it came from.

Full setup guide and example questions: **[tracetify.com/mcp](https://tracetify.com/mcp)**

## Setup

Create an API key in the [dashboard](https://tracetify.com/dashboard/ai), then
pick one of the two transports.

**Claude Code — one command:**

```
claude mcp add tracetify -e TRACETIFY_API_KEY=ttfy_... -- npx -y tracetify-mcp
```

**Or skip the install entirely** — nothing to install, not even Node:

```
claude mcp add --transport http tracetify https://tracetify.com/api/mcp --header "Authorization: Bearer ttfy_..."
```

Same tools, same balance; the server runs on our side.

**Claude Desktop / Cursor** take the same JSON (Cursor reads
`~/.cursor/mcp.json`):

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

**Codex** uses TOML in `~/.codex/config.toml` — note the snake_case table name:

```toml
[mcp_servers.tracetify]
command = "npx"
args = ["-y", "tracetify-mcp"]
env = { TRACETIFY_API_KEY = "ttfy_..." }
```

## Try asking

Your agent picks the right tool on its own — these are real questions, not
placeholders:

- *How did photoai.com get its first users? Cite the sources.*
- *My page ranks #12 for "ai headshot generator" — what should I change to reach page one?*
- *We just deployed — audit example.com and fix what you find.*
- *Where can I get my new SaaS listed for real dofollow links?*

If your agent ever reaches for the wrong tool, say `trace <domain>` and it will
come straight here.

## Tools

Tools that cost credits quote the price first and wait for you to say yes.
Reading existing reports never costs anything.

| Tool | Cost | What it does |
| --- | --- | --- |
| `search_reports` | free | Find existing growth reports by domain |
| `read_report` | free | Read a full report — timeline & verdict follow your account's unlocks |
| `start_trace` | 10 credits | Rebuild a competitor's growth from 12 sources (~60–90s); a fresh cached report comes back free |
| `get_trace` | free | Poll a running trace |
| `unlock_report` | 10 credits | Permanently unlock a report's full timeline, evidence & SEO detail (idempotent — never charges twice) |
| `gsc_overview` | free | Your own Search Console: clicks, impressions, period comparison |
| `gsc_queries` | free | Your real ranking keywords with position and CTR — find what sits at #5–20 |
| `gsc_pages` | free | Your pages by search performance, including high-impression low-CTR ones |
| `site_audit_start` | 3 credits | Crawl a site for broken links, missing titles, redirect chains, thin content |
| `site_audit_get` | free | Poll an audit and read the issue list grouped by severity |
| `research_competitors` | 8 credits | Who fights a domain for the same keywords, flagging which ones already have a report |
| `research_domain_overview` | 8 credits | Estimated organic traffic and top keywords for any domain |
| `research_backlinks` | 8 credits | Referring domains, authority and anchor texts |
| `research_brand_lookup` | 30 credits | How AI assistants cite a brand: platforms, mentions, associated entities |
| `backlink_directories` | 8 credits | Hand-verified directories that actually give dofollow links (billed once per day) |

Everything draws from your Tracetify credit balance — the same balance the
website uses. No seats, no per-tool add-ons. Top up at
[tracetify.com/pricing](https://tracetify.com/pricing).

## What this package does

It is a thin protocol adapter: MCP tool calls in, Tracetify HTTP API calls out.
No business logic, no data of its own — your API key never leaves your machine
except as an `Authorization` header to `tracetify.com`.

## License

MIT
