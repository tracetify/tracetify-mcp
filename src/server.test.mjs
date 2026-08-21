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
  it('exposes all 15 manifest tools', async () => {
    const client = await connected(vi.fn());
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'backlink_directories',
        'get_trace',
        'gsc_overview',
        'gsc_pages',
        'gsc_queries',
        'read_report',
        'research_backlinks',
        'research_brand_lookup',
        'research_competitors',
        'research_domain_overview',
        'search_reports',
        'site_audit_get',
        'site_audit_start',
        'start_trace',
        'unlock_report',
      ]
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

  it('gsc_overview omits the optional query when range_days is absent', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ totals: { clicks: 12 } }),
    });
    const client = await connected(fetchImpl);
    await client.callTool({ name: 'gsc_overview', arguments: {} });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.test/api/mcp/v1/gsc/overview',
      expect.any(Object)
    );
  });

  it('start_trace posts only the supplied body fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'started', jobId: 'j1' }),
    });
    const client = await connected(fetchImpl);
    await client.callTool({ name: 'start_trace', arguments: { url: 'weshop.ai' } });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.test/api/mcp/v1/trace',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: 'weshop.ai' }) })
    );
  });

  it('site_audit_start forwards explicit confirmation', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ auditId: 'a1', status: 'queued' }),
    });
    const client = await connected(fetchImpl);
    await client.callTool({
      name: 'site_audit_start',
      arguments: {
        url: 'https://example.com',
        confirm: true,
        request_key: '11111111-1111-4111-8111-111111111111',
      },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.test/api/mcp/v1/site-audit',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com',
          confirm: true,
          request_key: '11111111-1111-4111-8111-111111111111',
        }),
      })
    );
  });

  it('preserves a GSC 409 structured error including connectUrl', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'Connect Google Search Console first',
        code: 'NOT_CONNECTED',
        connectUrl: 'https://tracetify.com/dashboard/gsc',
      }),
    });
    const client = await connected(fetchImpl);
    const res = await client.callTool({ name: 'gsc_overview', arguments: {} });
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0].text)).toEqual({
      error: 'Connect Google Search Console first',
      code: 'NOT_CONNECTED',
      connectUrl: 'https://tracetify.com/dashboard/gsc',
      httpStatus: 409,
    });
  });

  it('preserves a 402 structured error including balance', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        error: 'A trace costs 10 credits',
        code: 'INSUFFICIENT_CREDITS',
        balance: 3,
      }),
    });
    const client = await connected(fetchImpl);
    const res = await client.callTool({ name: 'start_trace', arguments: { url: 'weshop.ai' } });
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0].text)).toEqual({
      error: 'A trace costs 10 credits',
      code: 'INSUFFICIENT_CREDITS',
      balance: 3,
      httpStatus: 402,
    });
  });

  it('uses an HTTP status fallback when the REST error is not JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => { throw new SyntaxError('not json'); },
    });
    const client = await connected(fetchImpl);
    const res = await client.callTool({ name: 'gsc_overview', arguments: {} });
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0].text)).toEqual({
      error: 'Tracetify API error (HTTP 503)',
      httpStatus: 503,
    });
  });

  it('returns a redacted MCP error when a successful REST response is not JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('secret upstream body and stack'); },
    });
    const client = await connected(fetchImpl);
    const res = await client.callTool({ name: 'gsc_overview', arguments: {} });
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0].text)).toEqual({
      error: 'Tracetify API returned invalid JSON',
      code: 'INVALID_RESPONSE',
      httpStatus: 200,
    });
    expect(res.content[0].text).not.toContain('secret upstream body');
    expect(res.content[0].text).not.toContain('SyntaxError');
  });

  it('starts without an API key: tools list, calls return setup guidance', async () => {
    const fetchImpl = vi.fn();
    const server = createServer({ baseUrl: 'https://api.test', fetchImpl });
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(15);
    const res = await client.callTool({ name: 'search_reports', arguments: { query: 'x' } });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('TRACETIFY_API_KEY');
    expect(res.content[0].text).toContain('tracetify.com/dashboard');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('unlock_report posts to the unlock endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ charged: true, balance: 219, report: { host: 'weshop.ai' } }),
    });
    const client = await connected(fetchImpl);
    const res = await client.callTool({ name: 'unlock_report', arguments: { slug: 'weshop-ai' } });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.test/api/mcp/v1/reports/weshop-ai/unlock',
      expect.objectContaining({ method: 'POST' })
    );
    expect(res.content[0].text).toContain('"charged": true');
  });
});
