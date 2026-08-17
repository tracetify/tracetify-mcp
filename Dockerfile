# Glama 等目录站用它做健康检查：起容器、走 stdio 说 MCP。
# server 无 TRACETIFY_API_KEY 也能启动并响应 introspection（工具调用时
# 才返回配置引导），所以检查不需要任何密钥。
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY bin ./bin
COPY src ./src
CMD ["node", "bin/tracetify-mcp.mjs"]
