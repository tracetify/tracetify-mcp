/**
 * 薄客户端：只做 MCP ↔ Tracetify REST 的协议转换，不含任何业务逻辑。
 * 工具定义来自 web manifest 的生成物，避免 npm 与 HTTP 两条通道漂移。
 */

import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const DEFAULT_BASE = 'https://tracetify.com';
const manifest = JSON.parse(
  readFileSync(new URL('./tools.generated.json', import.meta.url), 'utf8')
);
const PLACEHOLDER = /\{(\w+)\}/g;

function hasValue(value) {
  return value !== undefined && value !== null;
}

function replacePlaceholders(template, args) {
  return template.replace(PLACEHOLDER, (_, key) => encodeURIComponent(String(args[key])));
}

// 这段算法与 web/lib/mcp/rest-call.ts 保持相同，包内不跨目录 import web 代码。
function buildRestRequest(def, args) {
  for (const param of def.params) {
    if (param.required && !hasValue(args[param.key])) {
      throw new Error(`Missing required parameter: ${param.key}`);
    }
  }

  const [pathnameTemplate, queryTemplate] = def.rest.path.split('?', 2);
  for (const match of pathnameTemplate.matchAll(PLACEHOLDER)) {
    if (!hasValue(args[match[1]])) {
      throw new Error(`Missing path parameter: ${match[1]}`);
    }
  }

  const pathname = replacePlaceholders(pathnameTemplate, args);
  const query = queryTemplate
    ?.split('&')
    .filter((part) => {
      const keys = Array.from(part.matchAll(PLACEHOLDER), (match) => match[1]);
      return keys.every((key) => hasValue(args[key]));
    })
    .map((part) => replacePlaceholders(part, args))
    .filter(Boolean)
    .join('&');
  const path = query ? `${pathname}?${query}` : pathname;

  if (def.rest.method === 'GET') {
    return { method: 'GET', path, body: null };
  }

  const templatedKeys = new Set(
    Array.from(def.rest.path.matchAll(PLACEHOLDER), (match) => match[1])
  );
  const bodyEntries = def.params
    .filter((param) => !templatedKeys.has(param.key) && hasValue(args[param.key]))
    .map((param) => [param.key, args[param.key]]);

  return {
    method: 'POST',
    path,
    body: bodyEntries.length > 0 ? JSON.stringify(Object.fromEntries(bodyEntries)) : null,
  };
}

function zodParam(param) {
  let schema;
  if (param.type === 'string') schema = z.string();
  else if (param.type === 'number') schema = z.number();
  else if (param.type === 'boolean') schema = z.boolean();
  else throw new Error(`Unsupported MCP parameter type: ${param.type}`);

  if (!param.required) schema = schema.optional();
  return schema.describe(param.description);
}

export function createServer({ apiKey, baseUrl = DEFAULT_BASE, fetchImpl = fetch } = {}) {
  const server = new McpServer({ name: 'tracetify', version: '0.3.0' });
  const text = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });

  function mcpError(payload) {
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    };
  }

  function restError(status, responseBody) {
    // 由 handler 直接返回 MCP 错误，避免 SDK 把抛出的 Error 压缩成一行 message，
    // 从而丢掉 code、connectUrl、balance 等宿主需要采取下一步行动的字段。
    const structured = responseBody
      && typeof responseBody === 'object'
      && !Array.isArray(responseBody)
      ? responseBody
      : responseBody === null
        ? {}
        : { details: responseBody };
    const fallback = `Tracetify API error (HTTP ${status})`;
    const error = typeof structured.error === 'string' && structured.error
      ? structured.error
      : fallback;
    return mcpError({ ...structured, error, httpStatus: status });
  }

  async function call({ method, path, body }) {
    // 未配 key 时仍允许启动和列工具；把配置指引放在真正调用时，宿主才能展示给用户。
    if (!apiKey) {
      throw new Error(
        'TRACETIFY_API_KEY is not set. Create a free key at https://tracetify.com/dashboard '
          + '(AI & MCP page) and add it to your MCP client config — reading the public report '
          + 'library costs nothing once connected.'
      );
    }

    const init = {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };
    if (body !== null) init.body = body;

    const res = await fetchImpl(`${baseUrl}${path}`, init);
    let responseBody = null;
    let parsedJson = true;
    try {
      responseBody = await res.json();
    } catch {
      // 响应正文可能包含上游内部信息；这里只记录解析状态，不保留正文或异常栈。
      parsedJson = false;
    }
    if (!res.ok) {
      return restError(res.status, responseBody);
    }
    if (!parsedJson) {
      return mcpError({
        error: 'Tracetify API returned invalid JSON',
        code: 'INVALID_RESPONSE',
        httpStatus: res.status,
      });
    }
    return text(responseBody);
  }

  for (const def of manifest.tools) {
    const inputSchema = Object.fromEntries(
      def.params.map((param) => [param.key, zodParam(param)])
    );
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema,
        // manifest 的 {readOnly, destructive} → 协议的 ToolAnnotations。
        // 只读工具宿主可"一律允许",计费工具保持逐次确认;注解是提示,
        // 服务端的计费确认不因此少一行
        annotations: {
          readOnlyHint: def.annotations.readOnly,
          destructiveHint: def.annotations.destructive,
        },
      },
      async (args) => call(buildRestRequest(def, args))
    );
  }

  return server;
}
