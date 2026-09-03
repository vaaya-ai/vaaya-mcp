#!/usr/bin/env node
// Two calls to the same paid API through Vaaya. Only the ceiling differs.
// https://vaaya.ai/docs/reference — POST /api/run/{service}/{action}
const KEY = process.env.VAAYA_API_KEY
if (!KEY) {
  console.error('set VAAYA_API_KEY (https://vaaya.ai/api-keys)')
  process.exit(1)
}

async function search(maxCostCents) {
  const res = await fetch('https://vaaya.ai/api/run/exa/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'machine payments protocol x402 comparison',
      numResults: 5,
      max_cost_cents: maxCostCents, // the ceiling; read and removed by Vaaya, never sent upstream
    }),
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

console.log('1. ceiling 5¢ (at or above the listed price) →')
const ok = await search(5)
console.log('   HTTP', ok.status, 'charged_cents:', ok.body.charged_cents ?? '(see body)')

console.log('2. ceiling 1¢ (below the listed price) →')
const refused = await search(1)
console.log('   HTTP', refused.status, JSON.stringify(refused.body.error ?? refused.body))
console.log('   nothing charged; the refusal is recorded against this key with its reason')
