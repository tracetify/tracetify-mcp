#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../src/server.mjs';

const apiKey = process.env.TRACETIFY_API_KEY;
if (!apiKey) {
  // 不退出：server 起来、工具列得出，调用时才在对话里给配置引导
  console.error(
    'tracetify-mcp: TRACETIFY_API_KEY is not set — tools will return setup guidance.\n'
      + 'Create a key at https://tracetify.com/dashboard (AI & MCP page).'
  );
}

const server = createServer({
  apiKey,
  baseUrl: process.env.TRACETIFY_API_URL || 'https://tracetify.com',
});
await server.connect(new StdioServerTransport());
