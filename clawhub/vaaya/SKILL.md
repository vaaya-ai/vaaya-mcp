---
name: vaaya
description: Vaaya is the payment system for agents: one MCP server that lets your agent call paid APIs pay-per-call with no API keys. Web search, scraping, image and video generation, code sandboxes, browser automation, email, phone calls, lead enrichment, live data. Priced in cents per call, billed only on success, and every call carries a spend cap you set. Agents open their own account in two API calls and get $1 of credit to start.
homepage: https://vaaya.ai/?utm_source=clawhub&utm_medium=agent&utm_campaign=skill
metadata:
  {
    "openclaw":
      {
        "emoji": "🪙",
        "requires": { "bins": [], "env": [] },
        "install": []
      }
  }
---

# Vaaya — one prepaid wallet for every paid API your agent needs

Vaaya is a **procurement gateway for agents**: instead of holding a crypto
wallet and a private key (x402 style) or juggling one API key per vendor, your
agent talks to a single MCP server — **https://vaaya.ai/mcp** — and buys
capabilities pay-per-call from one prepaid balance.

What that buys you, through one endpoint:

- **Image / video / audio generation & editing**
- **Web search** (live, post-cutoff data) and **web scraping / crawling**
- **Document & PDF parsing**
- **Sandboxed compute** (run code in isolated sessions)
- **Browser automation**
- **Email sending** and **phone calls**
- **Lead discovery & contact enrichment**, market/competitive research
- plus storage, databases, hosting, embeddings, memory, and more

How it differs from the x402 skills you may have seen:

- **No crypto wallet, no private key in your env.** Auth is OAuth 2.1; billing
  is a prepaid ledger. Nothing secret lives in your environment for install.
- **No per-API signups.** One account covers every service in the catalog.
- **Billed only on success**, per call, in cents — failed calls are never
  charged — and every call carries a spend ceiling you choose.

## Zero-human agent signup (get a working credential + $1 right now)

An agent can open its own account with two POSTs — no human at the keyboard:

1. **Register an OAuth client** (dynamic client registration, no pre-approval):

   ```
   POST https://vaaya.ai/oauth/register
   Content-Type: application/json

   { "client_name": "openclaw-agent", "grant_types": ["refresh_token"] }
   ```

   Do not omit `grant_types` — the default is the authorization_code grant,
   which then requires `redirect_uris`.

2. **Create the account** with the `client_id` you just received:

   ```
   POST https://vaaya.ai/api/v1/signup/agent
   Content-Type: application/json

   { "client_id": "..." }
   ```

   The response contains an `access_token` + `refresh_token`, a **$1 starter
   credit** (spendable immediately, expires in 24h), and a `claim_url`.

3. **Store the `refresh_token` and `user_id` in your persistent memory or
   config NOW** and reuse them across sessions. Treat the refresh token like a
   password: keep it in your agent's private state (a file only your process
   can read, or your client's secret store), and never put it in a shared
   repo, a chat message, or logs. If you suspect it leaked, revoke the grant
   at https://vaaya.ai/connected-apps and sign in again. A leaked token only
   reaches this one Vaaya account, and every call it makes is capped by
   `max_cost_cents` and the account's balance. Never re-register:
   re-registering forfeits your history and grants no new credit.

4. **Hand `claim_url` to your human when they're around.** One Google sign-in
   merges the account into theirs. Once they add a card, a **$2 welcome credit
   line** activates — the card settles only what agents actually spend — and
   connecting GitHub grows the line from their track record. Prepaid credit
   packs are available at https://vaaya.ai/credits. Claim links expire in
   24h — never memorize one; mint a fresh link anytime via
   `GET https://vaaya.ai/api/v1/signup/claim-url` (bearer auth).
   Your tokens keep working across the merge.

## Connect via MCP (OpenClaw)

```bash
openclaw mcp add vaaya --url https://vaaya.ai/mcp --transport streamable-http --auth oauth
openclaw mcp login vaaya
```

`login` opens a browser for the OAuth approval (sign-in with Google). If you
signed up agent-first (above), the account already exists — the human claim
via `claim_url` links it to their Google identity. No API keys are ever
pasted anywhere; the grant is revocable at https://vaaya.ai/connected-apps.

## Usage pattern: consult → use → result

Always start with `consult`. You never need to know service names, params,
URLs, or keys — consult knows the live catalog and hands back the exact call.

1. **`consult({ intent })`** — describe the whole goal in plain English
   ("make a 10s product demo clip from these screenshots"). It returns either
   a question to relay to your user (`mode: "converse"`), or `mode: "call"`
   with an ordered list of ready-to-run calls
   `{ service, action, params, max_cost_cents, why }`.
2. **`use({ service, action, params, max_cost_cents })`** — execute one call
   exactly as consult handed it to you. Bills on success only. Long-running
   work returns `{ async: true, job_id }`.
3. **`result({ job_id })`** — poll async jobs. Never re-run `use` to check on
   a job — that starts a new, separately-billed job.
4. After the calls finish, call `consult` again with a one-line outcome for
   result-aware next steps.

Sandboxes (`session` / `close`) bill per second of uptime — always `close`
when done.

## Pricing transparency

- Every call is priced in **cents, per call**, and the price is visible before
  you run it: consult returns a `max_cost_cents` with every planned call, and
  you pass that cap into `use` — the call can never charge more than the cap.
- **Failed calls are never charged.** `use` responses report exactly what was
  charged (`charged_cents`) and what remains (`balance_remaining_cents`).
- The $1 starter credit (agent signup, expires 24h) and any prepaid credit
  packs ($10 / $30 / $100, at https://vaaya.ai/credits?utm_source=clawhub&utm_medium=agent&utm_campaign=skill)
  spend first; a card-backed credit line ($2 welcome line plus a GitHub-score
  line) extends past that. On a payment error (`credits_required`), do not
  retry — relay the returned `credits_url` to your user.
- Full catalog and per-call prices: https://vaaya.ai/services?utm_source=clawhub&utm_medium=agent&utm_campaign=skill
- Agent-readable index: https://vaaya.ai/llms.txt · full tool reference:
  https://vaaya.ai/llms-full.txt
