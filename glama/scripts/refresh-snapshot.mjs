#!/usr/bin/env node
// Regenerate tools.json + instructions.txt from the live hosted server so the
// introspection shim never drifts from the real anonymous surface.
//   node glama/scripts/refresh-snapshot.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const EP = 'https://vaaya.ai/mcp'
const HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
}
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..')

// A JSON-RPC POST whose response may be a plain JSON body or an SSE stream;
// pull the first/last JSON object out either way.
async function rpc(body, sessionId) {
  const res = await fetch(EP, {
    method: 'POST',
    headers: sessionId ? { ...HEADERS, 'mcp-session-id': sessionId } : HEADERS,
    body: JSON.stringify(body),
  })
  const sid = res.headers.get('mcp-session-id')
  const text = await res.text()
  let obj = null
  for (const line of text.split('\n')) {
    const s = line.replace(/^data:\s?/, '').trim()
    if (s.startsWith('{')) obj = JSON.parse(s)
  }
  return { obj, sid }
}

const init = await rpc({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'vaaya-snapshot', version: '1.0.0' },
  },
})
const instructions = init.obj?.result?.instructions ?? ''

const list = await rpc(
  { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  init.sid,
)
const tools = list.obj?.result?.tools ?? []
if (!tools.length) throw new Error('tools/list returned no tools')

writeFileSync(join(outDir, 'tools.json'), `${JSON.stringify({ tools }, null, 2)}\n`)
writeFileSync(join(outDir, 'instructions.txt'), `${instructions.trim()}\n`)
console.log(`wrote ${tools.length} tools + ${instructions.length} chars of instructions`)
