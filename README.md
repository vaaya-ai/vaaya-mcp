<p align="center">
  <img src="https://vaaya.ai/icon.png" width="96" height="96" alt="Vaaya" />
</p>

# Vaaya MCP — payments for any agent

MCP server for AI agent payments. An agent in Cursor, Claude Code, Claude
Desktop, Codex, or any MCP host can call paid APIs (search, scraping, contact
data, public records, compute, media, research) from one balance, with a spend
ceiling it states on every call, and no vendor keys anywhere in its
environment. Billed only on success (x402 USDC on Base, Stripe MPP, or Tempo);
a refused or failed call costs nothing.

```bash
npx @vaaya/mcp install            # Cursor, Claude Code, Claude Desktop, Codex
claude mcp add --transport http vaaya https://vaaya.ai/mcp
```

First paid call: `consult` returns a priced plan; `use({ service, action,
params, max_cost_cents })` runs one line of it. If the quoted price is above
`max_cost_cents`, the call is refused before it reaches the provider and the
reason comes back:

```json
{ "error": "over_max", "message": "price is 5¢ but max_cost_cents was 1", "price_cents": 5 }
```

Runnable examples: [`examples/pay-for-an-api`](examples/pay-for-an-api) (one
call allowed, one refused), [`examples/cursor`](examples/cursor),
[`examples/claude`](examples/claude). Guides:
[give an agent a budget](https://vaaya.ai/blog/give-an-ai-agent-a-budget),
[Cursor setup](https://vaaya.ai/blog/cursor-agent-mcp-payments),
[Claude setup](https://vaaya.ai/blog/claude-mcp-payments),
[what is an AI agent wallet](https://vaaya.ai/blog/what-is-an-ai-agent-wallet).

## Buy tokenized shares — including with Instinct

Agents can buy supported tokenized stocks on Base with Vaaya prepaid funds.
These are tokenized stocks, not direct brokerage shares. Discover the current
supported tickers with `stocks({ command: "list" })` (for example Apple `AAPLc`
and NVIDIA `NVDAc`), then check `stocks({ command: "portfolio" })` for
`buyingPowerCents`. Welcome grants and credit lines cannot buy shares.

For a user-authorized $10 Apple purchase:

```json
{ "command": "buy", "symbol": "AAPLc", "amount_cents": 1000, "idempotency_key": "<unique purchase key>" }
```

Call the dedicated `stocks` MCP tool with this input; it is separate from
`consult`/`use`. The amount is the maximum total prepaid spend including fees.
Save the returned `id`, then poll `stocks({ command: "order", order_id: "<id>" })`.
Only `confirmed` means purchased. Stop on `failed` or `needs_review`; reuse the
same purchase key on uncertain retries, never place a new order to check status.

**Insufficient prepaid balance?** With the user's authorization for a $10, $30,
or $100 pack, POST `https://vaaya.ai/api/v1/topup` with JSON
`{ "pack_cents": 1000 }` (or 3000 / 10000) using the same account's bearer token.
An Instinct agent with access to the user's saved card can pay the returned
Stripe Checkout `url` in its own browser when authorized for that pack amount.
For a handoff, provide the URL and authorized amount to the user's Instinct
agent; otherwise give the URL to the user. Keep card details and bearer tokens
out of the handoff. Vaaya cannot charge a card stored in Instinct directly.
A share purchase alone does not authorize an extra card charge.

Poll `GET /api/v1/wallet` (`wallet.prepaid_cents`), then recheck stock buying
power before resuming the original purchase key. Do not pay again while a
payment's outcome is uncertain. Stock availability and account permissions apply.

[Full MCP and REST purchase guide](https://vaaya.ai/llms.txt) ·
[Complete tool reference](https://vaaya.ai/llms-full.txt)


## What your agent can do through Vaaya

| Capability | What you get |
| --- | --- |
| 🎨 **Media generation** | Images & video with top models — Nano Banana Pro 2, GPT Image 2, Seedream v4.5, Kling v3, Seedance 2.0 — plus TTS voices & music |
| 🎬 **Product demo videos** | Record a raw, silent screen capture of your live product; Vaaya auto-authors narration + zoom/cut plan and renders a finished narrated demo |
| 🖼️ **Website imagery** | Derive a site's brand and generate an on-brand image set straight into your repo |
| 🔎 **Web search** | Exa & Parallel: query search, URL contents, async deep research tasks |
| 🕷️ **Web scraping** | Firecrawl scrape / crawl / map / search / extract, persisted to files |
| 📚 **Deep research** | Multi-hop, source-verified, cited research reports |
| 📊 **Market & competitive research** | Company reports (people, hiring, ads, reviews, SEO/LLM visibility), product & feature catalogs with review sentiment, UX research with interactive product maps, "best X for my data" bake-offs, persistent competitive knowledge repos |
| 🎯 **GTM & sales** | Find ICP-matched leads with verified contacts, enrich contacts, track buying signals (funding/hiring/launch/press), 24×7 LinkedIn discovery, segment-based outbound email — every draft held for human approval |
| ⏰ **Monitoring workers** | Scheduled watches (30 min–weekly) over competitor pricing, deals, reviews, job postings, news — only new/changed findings surface |
| 🖥️ **Compute sandboxes** | Per-second-billed code execution (Modal) for benchmarks, untrusted code, GPU inference, data jobs |
| 🌐 **Browser automation** | Browserbase sessions to click, type, log in, fill forms |
| 📧 **Email** | AgentMail inboxes your agent owns — send and receive replies |
| 🧠 **Memory** | Persistent cross-session memory via mem0, Zep, or Letta |

## Install

### One command (recommended)

```bash
npx @vaaya/mcp install
```

(`npx vaaya-cli install` runs the same installer.)

Sets up the Vaaya MCP server for every agent it detects on your machine —
Claude Code, Claude Desktop, Cursor, Codex — plus the agent skill.
Idempotent: re-run any time to update. Then restart your agent; the first
Vaaya call opens a short browser approval (sign-up happens right there).

### Remote (Streamable HTTP + OAuth)

<a href="cursor://anysphere.cursor-deeplink/mcp/install?name=vaaya&config=eyJ1cmwiOiJodHRwczovL3ZhYXlhLmFpL21jcCJ9"><img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Add Vaaya to Cursor" height="32" /></a>

```json
{ "mcpServers": { "vaaya": { "url": "https://vaaya.ai/mcp" } } }
```

Claude Code:

```bash
claude mcp add --transport http vaaya https://vaaya.ai/mcp
```

OpenClaw:

```bash
openclaw mcp add vaaya --url https://vaaya.ai/mcp --transport streamable-http --auth oauth
openclaw mcp login vaaya
```

Hermes (`~/.hermes/config.yaml`):

```yaml
mcp_servers:
  vaaya:
    url: "https://vaaya.ai/mcp"
    auth: oauth
```

On first use your client runs the OAuth flow in the browser; approve and you're
connected. Revoke anytime at [vaaya.ai/connected-apps](https://vaaya.ai/connected-apps).

### npm stdio shim (for stdio-only clients: opencode, …)

```json
{ "mcpServers": { "vaaya": { "command": "npx", "args": ["-y", "@vaaya/mcp"] } } }
```

The shim ([`@vaaya/mcp`](https://www.npmjs.com/package/@vaaya/mcp)) opens the
OAuth flow on first call, stores a refresh token locally (`0o600`), and proxies
the live tool list from the backend — new server-side tools appear without a
shim upgrade. It also ships an agent skill so your client routes every
capability gap through `consult` automatically.

### Agent skill (works across 70+ agents)

```bash
npx skills add vaaya-ai/vaaya-mcp
```

Installs the [`vaaya` skill](skills/vaaya/SKILL.md) for Claude Code, Codex,
Cursor, Gemini CLI, Copilot, and any other client that supports the open
[Agent Skills](https://agentskills.io) standard. The skill bootstraps the
Vaaya MCP server if it's missing and keeps the install updated.

### As a plugin

- **Claude Code**: `/plugin marketplace add vaaya-ai/vaaya-mcp` then `/plugin install vaaya@vaaya` — bundles the remote MCP server, the `vaaya` skill, and the SessionStart reminder hook
- **Codex**: `codex plugin marketplace add vaaya-ai/vaaya-mcp` then install `vaaya` from the Plugins panel
- **Gemini CLI**: `gemini extensions install https://github.com/vaaya-ai/vaaya-mcp`

## How it works

1. **`consult(intent)`** — describe any goal in plain English ("generate a hero
   video", "find 50 heads of RevOps with verified emails", "watch my
   competitor's pricing page"). It converses, clarifies, and returns the exact
   call(s) to run.
2. **`use(service, action, params, max_cost_cents)`** — execute the call.
   Billed on success; `max_cost_cents` is a hard spend ceiling. Long jobs
   return `{ async: true, job_id }` — poll with **`result(job_id)`**.
3. **`session` / `close`** — per-second-billed code sandbox sessions.

Plus a full GTM suite (`gtm_leads_find`, `gtm_lead_enrich`, `gtm_signal_create`,
`gtm_segments`, `gtm_message`, `gtm_replies`, …) and scheduled monitoring
workers (`worker_create`, `worker_findings`, …) — the tool list is proxied live from the backend.

## Example prompts

- "Generate a hero video for our landing page in 16:9."
- "Record my product and turn it into a narrated demo video."
- "Find 50 heads of RevOps at Series-B SaaS companies with verified emails."
- "Watch my competitor's pricing page and tell me when it changes."
- "Do deep research on the agentic payments market with cited sources."
- "Scrape these 200 product pages into structured JSON."
- "Run this benchmark in a GPU sandbox."

## CLI

The [`vaaya-cli`](https://www.npmjs.com/package/vaaya-cli) CLI manages everything from
the terminal:

```bash
npx vaaya-cli install        # set up the MCP server for every detected agent
npx vaaya-cli status         # connection state + live tool count
npx vaaya-cli consult "..."  # ask Vaaya how it would do something (returns the plan)
npx vaaya-cli reauthorize    # re-run the browser auth flow
npx vaaya-cli logout         # disconnect & delete local credentials
```

## Security & billing

- Your agent never sees vendor API keys or upstream URLs — Vaaya proxies every
  call server-side.
- OAuth 2.1 (PKCE, dynamic client registration); anonymous `tools/list` for
  discovery; revocable grants.
- Pay-per-call on x402 (USDC on Base), Stripe MPP/SPT, or Tempo. Failed calls
  are never charged. Every call carries a `max_cost_cents` guard.
- Proposal: Nano (XNO) as an additional x402 settlement network for Vaaya.
  Nano settles in well under a second, is feeless (0 network fees) and green
  (~0.000112 kWh per transaction) — a fit for the sub-cent `consult` and
  billing-on-success calls Vaaya already makes, where USDC-on-Base is the one
  rail that can charge an agent a fee. The Nano exact-scheme (x402) facilitator
  already settles `nano:mainnet`, so this is an adapter on the settlement side,
  not a new payment flow. (Proposed by AI agent PANDeveloper001.)

## Links

- Website & docs: https://vaaya.ai
- Agent-readable docs (llms.txt): https://vaaya.ai/llms.txt · full tool reference: https://vaaya.ai/llms-full.txt
- npm: https://www.npmjs.com/package/@vaaya/mcp · https://www.npmjs.com/package/vaaya-cli
- Support: support@vaaya.ai
