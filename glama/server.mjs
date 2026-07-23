#!/usr/bin/env node
// Vaaya — local stdio introspection shim for registries (Glama et al.)
//
// Why this exists: the real Vaaya MCP is a *hosted, OAuth-gated* server at
// https://vaaya.ai/mcp. Its `initialize`, `tools/list` and `ping` are already
// anonymous, but a registry's headless installer can't build/run a hosted
// remote — it builds a Dockerfile and speaks stdio. This shim is exactly that:
// it advertises the SAME anonymous tool surface (the 9 always-on tools) and the
// SAME server instructions the hosted server returns, so the registry can score
// the tool descriptions faithfully.
//
// It is discovery-only. `tools/call` is NOT wired to any capability here —
// executing a Vaaya call bills real money and requires the OAuth 2.1 flow
// against the hosted server, so calling a tool here returns a pointer to it.
//
// tools.json + instructions.txt are verbatim snapshots of what
// https://vaaya.ai/mcp returns to an unauthenticated client; regenerate them
// with scripts/refresh-snapshot.mjs.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const { tools } = JSON.parse(readFileSync(join(here, 'tools.json'), 'utf8'))
const instructions = readFileSync(join(here, 'instructions.txt'), 'utf8').trim()

const server = new Server(
  { name: 'vaaya', version: '1.0.0' },
  { capabilities: { tools: {} }, instructions },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

// Discovery-only shim: real execution runs against the hosted, OAuth-gated
// server and bills on success. Point the caller there instead of pretending.
server.setRequestHandler(CallToolRequestSchema, async (req) => ({
  isError: true,
  content: [
    {
      type: 'text',
      text:
        `This is a discovery-only introspection build of the Vaaya MCP. The "${req.params.name}" ` +
        'tool runs against the hosted server at https://vaaya.ai/mcp, which requires the OAuth 2.1 ' +
        'flow and bills on success. Connect to https://vaaya.ai/mcp to execute Vaaya calls.',
    },
  ],
}))

async function main() {
  await server.connect(new StdioServerTransport())
  // stdio server runs until the transport closes.
}

main().catch((err) => {
  process.stderr.write(`vaaya introspection shim failed: ${err?.stack || err}\n`)
  process.exit(1)
})
