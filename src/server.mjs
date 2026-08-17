/**
 * 薄客户端：只做 MCP ↔ Tracetify REST 的协议转换，不含任何业务逻辑。
 * 编排、防坑规则、分析层全在服务端（MCP spec 架构决定 4）。
 * createServer 把 fetch 做成注入点——测试不用起网络。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const DEFAULT_BASE = 'https://tracetify.com';

export function createServer({ apiKey, baseUrl = DEFAULT_BASE, fetchImpl = fetch } = {}) {
  const server = new McpServer({ name: 'tracetify', version: '0.1.0' });

  async function call(path, init = {}) {
    // 没配 key 时 server 照常启动、工具照常列出——目录站的健康检查和
    // 用户的 tools/list 都不该因为缺环境变量而看到一个死进程；引导
    // 放在真正调用的那一刻，出现在宿主的对话里，比 stderr 里一行
    // 没人看的报错有用得多
    if (!apiKey) {
      throw new Error(
        'TRACETIFY_API_KEY is not set. Create a free key at https://tracetify.com/dashboard '
          + '(AI & MCP page) and add it to your MCP client config — reading the public report '
          + 'library costs nothing once connected.'
      );
    }
    const res = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Tracetify API error (HTTP ${res.status})`);
    return body;
  }

  const text = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });

  server.registerTool(
    'search_reports',
    {
      description:
        'Search existing Tracetify growth reports by domain. Reading existing reports is free.',
      inputSchema: { query: z.string().describe('Domain or fragment, e.g. "weshop" or "weshop.ai"') },
    },
    async ({ query }) => text(await call(`/api/mcp/v1/reports/search?q=${encodeURIComponent(query)}`))
  );

  server.registerTool(
    'read_report',
    {
      description:
        'Read one Tracetify growth report by slug (from search_reports or a completed trace). Free.',
      inputSchema: { slug: z.string() },
    },
    async ({ slug }) => text(await call(`/api/mcp/v1/reports/${encodeURIComponent(slug)}`))
  );

  server.registerTool(
    'start_trace',
    {
      description:
        'Trace how a product actually grew: 12 sources, takes 60-90s, costs credits from your Tracetify balance. Returns a cached report slug for free when a fresh one already exists. Poll progress with get_trace.',
      inputSchema: {
        url: z.string().describe('Domain to trace, e.g. weshop.ai'),
        refresh: z.boolean().optional().describe('Force a fresh run even if a cached report exists'),
      },
    },
    async ({ url, refresh }) =>
      text(await call('/api/mcp/v1/trace', {
        method: 'POST',
        body: JSON.stringify({ url, refresh: refresh === true }),
      }))
  );

  server.registerTool(
    'get_trace',
    {
      description: 'Check a running trace. When status is "done", read the report with read_report.',
      inputSchema: { job_id: z.string() },
    },
    async ({ job_id }) => text(await call(`/api/mcp/v1/trace/${encodeURIComponent(job_id)}`))
  );

  return server;
}
