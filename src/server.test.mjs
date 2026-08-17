import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from './server.mjs';

async function connected(fetchImpl) {
  const server = createServer({ apiKey: 'ttfy_test', baseUrl: 'https://api.test', fetchImpl });
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

describe('tracetify-mcp server', () => {
  it('exposes the four phase-1 tools', async () => {
    const client = await connected(vi.fn());
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ['get_trace', 'read_report', 'search_reports', 'start_trace']
    );
  });

  it('search_reports hits the REST API with the key and returns its JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reports: [{ slug: 'weshop-ai' }] }),
    });
    const client = await connected(fetchImpl);
    const res = await client.callTool({ name: 'search_reports', arguments: { query: 'weshop' } });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.test/api/mcp/v1/reports/search?q=weshop',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer ttfy_test' }),
      })
    );
    expect(res.content[0].text).toContain('weshop-ai');
  });

  it('start_trace posts url + refresh', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'started', jobId: 'j1' }),
    });
    const client = await connected(fetchImpl);
    await client.callTool({ name: 'start_trace', arguments: { url: 'weshop.ai', refresh: true } });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.test/api/mcp/v1/trace',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: 'weshop.ai', refresh: true }) })
    );
  });

  it('surfaces API errors as tool errors instead of fake success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: 'A trace costs 10 credits' }),
    });
    const client = await connected(fetchImpl);
    const res = await client.callTool({ name: 'start_trace', arguments: { url: 'weshop.ai' } });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('A trace costs 10 credits');
  });

  it('starts without an API key: tools list, calls return setup guidance', async () => {
    const fetchImpl = vi.fn();
    const server = createServer({ baseUrl: 'https://api.test', fetchImpl });
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(4);
    const res = await client.callTool({ name: 'search_reports', arguments: { query: 'x' } });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('tracetify.com/dashboard');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
