<p align="center">
  <img src="https://vaaya.ai/icon.png" width="96" height="96" alt="Vaaya" />
</p>

# Vaaya MCP — paid superpowers for any agent

[Vaaya](https://vaaya.ai) is the **agent payment system**: one MCP server that
lets any agent call paid APIs **pay-per-call, with no API keys**. Instead of
wiring up a dozen vendor keys, your agent asks Vaaya's conversational `consult`
tool for anything it can't do, gets back the exact call to run, and executes it
with `use` — billed on success only (x402 USDC on Base, Stripe MPP, or Tempo;
the payment *is* the auth). Failed calls are never charged.

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

## Links

- Website & docs: https://vaaya.ai
- Agent-readable docs (llms.txt): https://vaaya.ai/llms.txt · full tool reference: https://vaaya.ai/llms-full.txt
- npm: https://www.npmjs.com/package/@vaaya/mcp · https://www.npmjs.com/package/vaaya-cli
- Support: support@vaaya.ai
