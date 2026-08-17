#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../src/server.mjs';

const apiKey = process.env.TRACETIFY_API_KEY;
if (!apiKey) {
  console.error(
    'TRACETIFY_API_KEY is not set.\n'
      + 'Create a key at https://tracetify.com/dashboard and add it to your MCP client config.'
  );
  process.exit(1);
}

const server = createServer({
  apiKey,
  baseUrl: process.env.TRACETIFY_API_URL || 'https://tracetify.com',
});
await server.connect(new StdioServerTransport());
