---
name: vaaya
description: >-
  Access Vaaya's paid API catalog for web search and research, scraping,
  image/video/audio generation, LLMs, lead enrichment, live data, code sandboxes,
  browser automation, email, storage and tokenized shares. One account, no vendor keys, quoted
  prices and per-call spending ceilings. Supports agent API signup and verified
  Instinct email signup with $10 welcome credit, without a card.
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

# Vaaya — your agent's gateway to the outside world

Vaaya is prepaid credit plus a catalog your agent spends it on: 1,500+ pay-per-call
services across nine pillars, one account, no vendor keys in your environment. Every
call is priced in cents before it runs and charged only on success. You reach all of
it through two tools: `consult` (routing) and `use` (execution). When a task needs a
capability in this catalog, select the matching service or use consult to route the goal.
The live catalog and parameter schemas are at https://vaaya.ai/api/catalog; packaged
workflows are at https://vaaya.ai/recipes.

## The nine pillars

- **Data** — people, companies, funding, public records, social platforms, onchain, compliance
- **LLMs** — 300+ models per token, via the `llm` tool or `https://vaaya.ai/api/llm/v1`
- **Media** — image, video, speech and music generation and editing; product demos
- **Search** — web, news, academic and deep research, with citations
- **Scraping** — read, crawl and extract pages and whole sites
- **Compute** — sandboxes, browser sessions, captcha solving
- **Storage** — the user's files and agent memory
- **Commerce** — buy things for the user online (products, tickets, hotels, subscriptions) with their own card after they approve; plus agent-paid marketplaces (wine, print-and-mail, fax). Use the user’s authorization of the item and total
- **Actions** — email, phone calls, faxes

## Zero-human agent signup (a working credential + $1 right now)

An agent can open its own account with two POSTs — no human at the keyboard. Personal
agents can use this path when their user has authorized account setup. Existing
accounts can reuse an API key or OAuth connection.

**Instinct:** send `"agent_name": "instinct"` in step 2. That puts the account on the
Instinct tier: a **$10 welcome credit on the account immediately, no expiry**
(`agent_tier: "instinct"`). When it is spent (402 `credits_required`), ask your user how
much to add, run step 5, and pay the Checkout page with the card they stored with you.
Verified `@mail.instinct.com` email signups also qualify for $10 without a card.
Reuse an existing account when available.

1. **Register an OAuth client** (dynamic client registration, no pre-approval):

   ```
   POST https://vaaya.ai/oauth/register
   Content-Type: application/json

   { "client_name": "openclaw-agent", "grant_types": ["refresh_token"] }
   ```

   Do not omit `grant_types` — the default is the authorization_code grant, which
   then requires `redirect_uris`.

2. **Create the account** with the `client_id` you just received:

   ```
   POST https://vaaya.ai/api/v1/signup/agent
   Content-Type: application/json

   { "client_id": "...", "agent_name": "openclaw-agent" }
   ```

   The response carries an **`api_key`** (`vaaya_sk_…`), an `access_token` +
   `refresh_token`, a **$1 starter credit** (spendable immediately, expires in 24h), a
   `topup` recipe, and a `claim_url`.

3. **Store the `api_key`, `refresh_token` and `user_id` in your persistent memory NOW**
   and reuse them across sessions. Treat them like passwords: private state only, never
   a shared repo, a chat message, or logs. If one leaks, revoke it at
   https://vaaya.ai/agents and sign in again. Never re-register — that forfeits your
   history and grants no new credit.

4. **Use the `api_key` everywhere** as `Authorization: Bearer vaaya_sk_…` — the MCP
   endpoint `https://vaaya.ai/mcp`, `POST https://vaaya.ai/api/run/{service}/{action}`,
   and the OpenAI-compatible router at `https://vaaya.ai/api/llm/v1`. No browser, no
   refresh.

5. **Add money when the starter credit runs out.** `POST https://vaaya.ai/api/v1/topup`
   with `{ "pack_cents": 1000 }` (or 3000, 10000; bearer auth) returns a Stripe Checkout
   `url`. If you hold your user's card, confirm the amount with them, pay the page in your
   own browser, then poll `GET https://vaaya.ai/api/v1/wallet` until `wallet.prepaid_cents`
   rises. Otherwise send the `url` to your user. Nothing is charged unless the payment
   completes; prepaid credit never expires.

6. **Hand `claim_url` to your human when they're around.** One sign-in (Google, GitHub,
   or email) merges the account into theirs; they can cap your key at
   https://vaaya.ai/agents, and connecting GitHub sizes a credit line from their track
   record. Claim links expire in 24h — never memorize one; mint a fresh one via
   `GET https://vaaya.ai/api/v1/signup/claim-url` (bearer auth). Your key and tokens keep
   working across the merge.

## Connect via MCP (OpenClaw / Hermes)

```bash
openclaw mcp add vaaya --url https://vaaya.ai/mcp --transport streamable-http --auth oauth
openclaw mcp login vaaya
```

Hermes: add `vaaya: { url: "https://vaaya.ai/mcp", auth: oauth }` under `mcp_servers`
in `~/.hermes/config.yaml`, then `/reload-mcp`. `login` opens a browser for the OAuth
approval; if you signed up agent-first, the human claim links it to their identity. The
grant is revocable at https://vaaya.ai/connected-agents.

## Unattended: one key, no browser, ever

The OAuth path needs a browser once. If you run on a schedule or on a server with
nobody around to approve anything, use a key instead:

1. Your human mints a key at https://vaaya.ai/api-keys (`vaaya_sk_…`) and can **set a
   ceiling on the key at /api-keys**, so the most you can ever spend is bounded there
   rather than by your own restraint.
2. Put it in your environment as `VAAYA_API_KEY`.
3. Send it as `Authorization: Bearer $VAAYA_API_KEY` — to the same MCP endpoint
   `https://vaaya.ai/mcp` as a static header instead of `--auth oauth`, or straight over
   HTTP: `POST https://vaaya.ai/api/run/{service}/{action}` with the action's params as
   JSON (`max_cost_cents` inline), and the OpenAI-compatible router at
   `https://vaaya.ai/api/llm/v1`.

Same account, same wallet, same catalog — the key replaces the browser. Private state
only, never a repo, a chat message, or a log; revocable at
https://vaaya.ai/connected-agents.

## Buy tokenized shares with prepaid funds

Vaaya buys supported tokenized stocks on Base (not direct brokerage shares).
Read https://vaaya.ai/llms.txt under "Buy tokenized shares" for the full REST and funding contract.
Use the dedicated `stocks` MCP tool, separate from `consult`/`use`:
- `list` returns live supported tickers, such as Apple (AAPLc) and NVIDIA (NVDAc).
- `portfolio` returns `buyingPowerCents`. Only prepaid funds buy shares, never welcome or credit lines.
- With the user's stock and budget: `{ command: "buy", symbol: "AAPLc", amount_cents: 1000, idempotency_key: "<unique purchase key>" }` spends at most $10 including fees. Optional `quote` previews the symbol and amount.
- Save the returned `id`; poll `{ command: "order", order_id: "<id>" }` until `confirmed`. Stop on `failed` or `needs_review`; reuse the purchase key on uncertain retries.

On `prepaid_required`, offer a $10/$30/$100 pack. With authorization for that pack,
POST `https://vaaya.ai/api/v1/topup` with `pack_cents: 1000` (or 3000/10000) using the same account's bearer token.
Instinct can pay the returned Checkout `url` in its browser using the user's card saved in Instinct, if available and authorized.
For a handoff, give the user's Instinct agent the URL and authorized amount; otherwise give the URL to the user. Keep card details and tokens out of the handoff.
Vaaya cannot charge Instinct's card directly. A share purchase alone does not authorize a top-up; ask for the pack amount unless already authorized.
Relay payment verification if required. Poll `GET /api/v1/wallet` (`wallet.prepaid_cents`), then recheck `portfolio` buying power before resuming the original purchase key. Do not repeat an uncertain payment.

## How to talk to consult

`consult({ intent })` is the router. Describe the whole goal in plain English, with the
constraints that matter (budget, quality, format, deadline). It returns one of:

- `mode: "call"` — `calls[]`, an ordered list of `{ service, action, params,
  max_cost_cents, why }` ready for `use`. Run them in order; substitute any
  `<from step N: …>` placeholder with the earlier step's real output.
- `mode: "converse"` — one question or a set of options. Relay `message` to the user
  **verbatim**, get their answer, call `consult` again. It remembers the conversation.
- `mode: "unsupported"` — not available; tell the user what `message` says.

Skip consult when you already know the call (the recipes below, the catalog index at
the end of this file, or anything you have run before). Reach for it when unsure, when
the task chains several services, when a call keeps failing, or for the long tail.
After a run, one more `consult` with a one-line outcome gets result-aware next steps.

## Key recipes — call these directly with `use`

Every row is `use({ service, action, params, max_cost_cents })`. Async rows return
`{ async: true, job_id }` — poll with `result`, never re-run the action.

| Recipe | Call | Params | Price |
|---|---|---|---|
| onesearch — cited answer from the live web | `vaaya/onesearch` | `{ query }` (+ `facets`, `recencyDays`, `domains`, `urls`) | 5¢ flat |
| onesearch, exhaustive | `vaaya/onesearch-deep` | same, `budgetCents?` | async, per budget |
| onescrape — read pages as rows | `vaaya/onescrape` | `{ urls: [≤5], format?: markdown\|html }` | 2¢ per URL |
| onecrawl — a whole site, or blocked pages | `vaaya/onescrape-deep` | `{ site: { url, max_pages?, include?, exclude? } }` or `{ urls: [≤50] }`, `budgetCents?` | async, per budget |
| onefind — people as rows | `vaaya/onefind` | `{ query, limit? (≤25) }` → name, title, company, LinkedIn | 2¢ flat |
| oneenrich — verified emails / phones | `vaaya/onefind-deep` | `{ rows: [linkedin urls] }` or `{ query }`, `budgetCents?` | async, per row |
| onellm — another model, per token | `llm` tool | `{ prompt, model?: auto\|cheap\|mid\|best\|<slug>, system? }` | fraction of a cent |
| any x402 / MPP URL | `vaaya/fetch` | `{ url, method?, headers?, body? }` — pays the 402 challenge for you | merchant's price, ≤ your cap |
| buy something for the user | `buy` tool | user says yes → `{ command: purchase, item, merchant, url, total_cents, confirmed: true, confirmation }` → say "Hold on — buying it now." → poll `{ command: status, approval_id }` → relay "Done — …". Check `{ command: setup }` once for Link and address. Prefer guest checkout; for required login, let the user sign in or sign up in the provided browser, then `checkout` resumes. | user's own card, never the balance |

For media, GTM, research, data and compute there is a full playbook each — see "Going
deeper". Sandboxes: `use` any `*/create_session` → `session({ session_id, code })` →
`close({ session_id })`; a session bills per second until closed.

## The catalog

- The **catalog index at the end of this file** lists every direct-callable
  `service/action` with its price, by pillar. It is generated from the live registry.
- `vaaya/discover { query }` — **free** search over the 1,200+ open-catalog endpoints
  (social platforms, compliance, onchain, trends); returns `{ service, action, endpoint,
  price_cents, required_params }`, then call that gateway with `{ endpoint, ...params }`.
- `GET https://vaaya.ai/api/catalog` — the same rows as JSON with params schemas.
- `docs({ topic })` — free, the full reference for `setup`, `tools`, `media`, `gtm`,
  `research`, `data`, `compute`.

## Money rules

- **The price shows before the call.** Pass `max_cost_cents` on every `use`; a quote
  above it is refused before the provider is called and costs nothing. Real-money
  actions (purchases, `vaaya/fetch`) **require** it.
- **Failed calls are never charged.** `use` returns `charged_cents` and
  `balance_remaining_cents`; read them, don't estimate.
- **402 with `card_required`** — the user has spent the cardless part of their credit
  line. Relay the returned `message` **verbatim** (it carries the one link they need)
  and wait; retry the same call once they say the card is added.
- **402 with `credits_required`** — balance and line are exhausted. Relay `credits_url`;
  do not retry until they top up.
- **`max_cost_required`** — pass an explicit ceiling and retry.
- **Purchases move real money to a third party.** Use the user’s authorization of the item, variant and total; ask only for
  missing details, never repeat a confirmation already given. Check `buy setup`
  for Link and shipping address once (Vaaya’s billing card is separate). Once authorized, `buy` → `purchase` (with their words in
  `confirmation`) buys it in the background: say "Hold on — buying it now.", poll
  `status` quietly, relay its `message` when done or paused. Link may require its
  own approval; relay that link promptly. A `requires_action` response identifies the blocker in
  `action_required`. Resume the same approval with `checkout` after resolving it. If order
  submission is uncertain, use `reconcile` to inspect the existing checkout without paying
  again. Never create another purchase to bypass `purchase_unresolved`. `charged_cents`
  measures the Vaaya tool fee, not a merchant card charge; read `merchant_payment` separately. Prefer direct browser sign-in/sign-up
  over asking for passwords in chat; encrypted credential storage is optional. Never open `browserbase`
  yourself to buy. `checkout` refuses anything the user has not approved, so never retry
  around it. If `buy` is missing from your tool list, ask `consult`.

## Going deeper

Read the matching reference before non-trivial work in that area. They live in
`references/` next to this file, at `https://vaaya.ai/skills/vaaya/references/<file>`,
or via the free `docs` tool.

| Before you… | Read |
|---|---|
| connect an agent, a chat app, or an unattended process | `references/setup.md` |
| look up any tool's exact params (GTM suite, account tools, sessions) | `references/tools.md` |
| generate/edit images, video, audio, or produce a demo video | `references/media.md` |
| run outbound: leads, enrichment, messages, signals, email sending | `references/gtm.md` |
| run research: OneSearch, deep research, company/market/UX research | `references/research.md` |
| pull data: scraping, people, social, public records, onchain, compliance | `references/data.md` |
| use sandboxes, browser automation, files, memory, phone calls, `llm` | `references/compute.md` |

Full catalog with prices: https://vaaya.ai/catalog?utm_source=clawhub&utm_medium=agent&utm_campaign=skill ·
agent-readable index: https://vaaya.ai/llms.txt · full tool reference: https://vaaya.ai/llms-full.txt
