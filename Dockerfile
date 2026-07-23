# Introspection build for MCP registries (Glama et al.).
#
# The real Vaaya MCP is hosted at https://vaaya.ai/mcp (Streamable HTTP + OAuth
# 2.1) — see .mcp.json. Registry scanners can't build/run a hosted remote, so
# this image runs a local stdio shim (glama/server.mjs) that advertises the
# exact anonymous tool surface + instructions the hosted server returns, letting
# the scanner introspect and score it. Tool execution still happens against the
# hosted server; see the shim's tools/call handler.
FROM node:20-slim

WORKDIR /app

# Install only the shim's deps (the MCP SDK) — reproducible, no repo package.json.
COPY glama/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

COPY glama/tools.json glama/instructions.txt ./
COPY glama/server.mjs ./server.mjs

# stdio MCP server: the registry speaks JSON-RPC over stdin/stdout.
ENTRYPOINT ["node", "server.mjs"]
