# Installing Vaaya MCP (instructions for AI agents)

You are installing **Vaaya** (https://vaaya.ai), an MCP server that gives the
user's agent pay-per-call access to paid capabilities (media generation,
product demo videos, web search/scraping, research, GTM/sales tools, code
sandboxes, browser automation, email, memory) with no API keys.

Complete agent-readable reference: https://vaaya.ai/llms.txt (index, including
agent self-serve signup) and https://vaaya.ai/llms-full.txt (every tool with
parameters).

## Step 1 — pick the transport

**Remote (preferred when the client supports Streamable HTTP + OAuth):**

```json
{ "mcpServers": { "vaaya": { "url": "https://vaaya.ai/mcp" } } }
```

**stdio shim (for stdio-only clients):**

```json
{ "mcpServers": { "vaaya": { "command": "npx", "args": ["-y", "@vaaya/mcp"] } } }
```

Requirements for the stdio shim: Node.js ≥ 20 and `npx` on PATH. No API keys,
no environment variables, and no other configuration are needed.

## Step 2 — write the config

Add the chosen block to the client's MCP configuration file (e.g. `.mcp.json`,
`mcp.json`, or the client's settings UI). The server name should be `vaaya`.

## Step 3 — authenticate (user action required)

On the first tool call, an OAuth 2.1 browser flow starts (the remote transport
lets the client drive it; the stdio shim opens a browser tab itself). **Tell
the user to approve the connection in the browser** — they sign in or sign up
at vaaya.ai and grant access. A refresh token is then stored and reused; no
per-session login.

If the environment is headless, set `VAAYA_NON_INTERACTIVE=1` (stdio shim) and
relay the printed authorize URL to the user.

## Step 4 — verify

Call the `vaaya_test_connection` tool. Expected result: `{ ok: true, userId,
scope, version }`. If it returns `needs_auth`, relay the included
`verification_uri` to the user and retry after they approve.

## Usage pattern (important)

Always call `consult(intent)` FIRST with a plain-English description of the
goal; it returns the exact `use(service, action, params, max_cost_cents)`
call(s) to run. Never invent service/action names. Billing happens only on
successful `use` calls, capped by `max_cost_cents`.

## What an agent wallet is in Vaaya

A Vaaya account is a wallet the agent holds *permission* to, not money. A
person or company owns the account; each agent gets an API key with a policy:
the categories it may spend in (Data, Search, Scraping, Media, Compute, LLM
router, Outbound), a monthly limit, and a `max_cost_cents` ceiling the agent
states on every call. The account settles with providers on x402 (USDC on
Base), Stripe MPP, or Tempo. The agent never sees a card, a vendor key, or a
private key.

An agent can open its own provisional account with no human present:

1. `POST https://vaaya.ai/oauth/register` with `{ "client_name": "...", "grant_types": ["refresh_token"] }`
2. `POST https://vaaya.ai/api/v1/signup/agent` with `{ "client_id": "..." }` → tokens, a $1 starter credit (24h), and a `claim_url`
3. Store the `refresh_token` and `user_id` in persistent memory; hand the `claim_url` to your person when they are around

Full flow and funding options (welcome credit up to $10, GitHub-backed credit
line, prepaid packs): https://vaaya.ai/llms.txt and
https://vaaya.ai/blog/create-and-fund-an-ai-agent-wallet

## Uninstall / revoke

- Remove the config block.
- The user can revoke the grant at https://vaaya.ai/connected-apps.
- stdio shim: `npx -y @vaaya/mcp logout` clears local credentials.
