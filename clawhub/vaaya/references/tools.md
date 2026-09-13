# Tools — the exact params of every Vaaya MCP tool

Every tool is exposed as `mcp__vaaya__<name>` (short names below). Connector surfaces (claude.ai, ChatGPT) see the slim set — consult, use, result, docs and the account tools; shell agents and keys see everything. Calls to a tool that is not listed for you still work through consult.

### Group 1 — Capability flow

**`consult`** — the router, for when you're unsure. `{ intent: string }`. Returns
`{ mode, message, calls?, suggestions }`:
- `mode:"converse"` → relay `message` to the user **verbatim** (a question, options, or
  ideas), get their answer, call `consult` again. Loop until you get a `call`.
- `mode:"call"` → `calls[]` is an ordered list of `{ service, action, params,
  max_cost_cents, why }`, ready to run via `use`. Substitute any `<from step N: …>`
  placeholder with the earlier step's real output.
- `mode:"unsupported"` → not available yet; tell the user.
Always surface `message`, each call's `why`, and `suggestions`. After running calls, call
`consult` once more with a one-line outcome for result-aware next steps.

```
consult({ intent: "make a hero image for my landing page, room for a headline" })
→ { mode:"call", calls:[{ service:"…", action:"generate", params:{…}, max_cost_cents:20, why:"cheapest photoreal option" }], suggestions:[…] }
```

**`use`** — execute one call, direct from the catalog above or handed to you by
consult; bills on success.
`{ service, action, params, max_cost_cents }` → `{ ok, data, charged_cents,
balance_remaining_cents, transaction_id }`. Failed calls are never charged. Long-running
work returns `{ async: true, job_id }`.

Payment errors (HTTP 402, `ok:false`): `credits_required` — the account is out of
credit (balance and card-backed credit line fully drawn). The response includes a
`credits_url`. Do NOT retry — relay `credits_url` to the user so they can buy a
prepaid pack ($10 / $30 / $100) or add a card to activate their credit line, then
continue once they've topped up.

```
use({ service:"…", action:"generate", params:{…}, max_cost_cents:20 })
→ { ok:true, data:{ url:"…" }, charged_cents:4, balance_remaining_cents:… }
```

**`result`** — poll an async job. `{ job_id }` → `{ status:
running|succeeded|failed|cancelled, result?, progress?, hint?, charged_cents }`.
**Never re-run `use` to check on a job — that starts a new, separately-billed job.**

```
result({ job_id:"job_abc" })
→ { status:"running", progress:{ percent:42 }, hint:"rendering 42% (~120s left)" }
```

**`session`** + **`close`** — interactive sandboxes. Run `use` with
`action:"create_session"` to get a `session_id`, then `session` runs a `command` or
`code` in that box (state persists across calls); `close` shuts it down. **A session
bills per second of uptime until you `close` it — always close when done.**

```
session({ session_id:"sb_1", code:"print(2+2)", language:"python" })   // language: python|javascript|bash
→ { stdout:"4\n", exit_code:0 }
close({ session_id:"sb_1" })
```

**`llm`** — one-shot ask to a DIFFERENT model, billed per token from the same wallet
(usually a fraction of a cent). `{ prompt, model?, system? }`; `model` is `auto`
(default) | `cheap` | `mid` | `best` or any exact OpenRouter slug from 300+ models
(Kimi, GPT, Gemini, Claude, DeepSeek). Use it for a second opinion, a cross-check,
or cheap summarization of a huge blob — never for the conversation you are already in.

**`vaaya_account`** — `{}` → which account is connected, balance, premium allowance left.

**`docs`** — `{ topic: media|gtm|research|data|compute }` → the full reference for that
area (same content as the `references/` files below), free. Use it when you don't have
the skill files on disk — e.g. you're on a connector surface.

**`brain_push`** — `{ fact }` — save a fact to the COMPANY brain, the shared org
knowledge graph every teammate's agent reads. Only when the user explicitly wants
something remembered for their whole team.

**`vaaya_onboard`** / **`vaaya_logout`** — `{}` — where the human connects (call when a
tool returns unauthorized, relay the instructions) / revoke this client's connection.

### Group 2 — GTM suite (direct tools, on the user's own accounts)

These run outbound on the user's behalf — **manual-first**: Vaaya finds, enriches, and
drafts; **the user reviews and sends.** Nothing auto-sends unless the user has explicitly created an autopilot rule via `gtm_automation` (opt-in, capped per day). If an account isn't connected,
the tool returns `not_connected` with a `connect_url` — relay that to the user. The hub is
the **brain** (`/brain/*`): leads, segments, messages, assets, jobs.

**Brain — leads, segments, messages, assets**
- `gtm_leads` / `gtm_leads_find` — manage and discover ICP-matched leads.
- `gtm_lead_enrich` — reveal/verify a lead's contact data.
- `gtm_segments` — group leads for targeting.
- `gtm_message` — draft outbound (held for the user to send); `gtm_asset` /
  `gtm_asset_produce` — produce supporting assets.
- `gtm_automation` — OPT-IN autopilot rules (auto-send matching replies / approved
  segment messages, capped per day). Only create one when the user explicitly asks.
- `gtm_brain` — read/update the campaign-free source of truth: identity, value prop,
  default ICP, pain/proof/voice/guardrails.
- `gtm_recall` — ask the brain what it knows (semantic recall over facts, sent
  messages, enriched leads, fused with matching leads/segments) to ground your next move.
- `gtm_job` — program the GTM scheduler: durable multi-step jobs that keep running
  server-side even when no agent is connected (multi-day workflows, refreshes).

**Reply triage** (every reply is drafted and HELD for approval — unless a `gtm_automation` reply rule the user created matches; newest first; surfaced on `/signals`)
- `gtm_replies({})` → pending reply drafts.
- `gtm_reply_approve({ message_id })` / `gtm_reply_edit({ message_id, text })` /
  `gtm_reply_reject({ message_id })`.

```
gtm_replies({})
→ { pending:[{ message_id:"m1", … }] }
gtm_reply_edit({ message_id:"m1", text:"Thanks — does Tuesday 2pm work?" })
```

**Signals & accounts**
- `gtm_signal_create({ query, signal_types? })` — standing buying-signal watch (polled
  ~6h; **discovery-only**, never auto-creates outreach); `signal_types` ⊆
  funding|hiring|launch|leadership|press.
- `gtm_signal_act({ finding_id, action? })` — act on a signal finding: `find_people`
  (default, ≤5¢) finds decision-makers at the finding's company and upserts them into
  leads — the exit from discovery into the lead repository.
- `gtm_mailboxes({})` — inventory of sending surfaces + per-inbox daily caps; check before
  planning email volume.
- `gtm_composio({ action:"book"|"crm_log"|"sheet_push", params:{ arguments, tool_slug? } })`
  — act on the user's own calendar / HubSpot / Google Sheets.

### Onboarding
- `vaaya_test_connection({})` — one-time connectivity check the user runs after install.

## Full tool reference (31 tools)

New users see the 9 core tools; a suite's tools appear once it is first used (at
vaaya.ai or via consult). Calls to hidden tools still work — visibility is
discovery-only.

| Tool | Params | Purpose |
|---|---|---|
| `consult` | `{ intent }` | route any capability gap → exact `use` call(s) |
| `use` | `{ service, action, params, max_cost_cents }` | execute one call, bill on success |
| `result` | `{ job_id }` | poll an async job |
| `session` | `{ session_id, command? \| code?, language? }` | run in a sandbox |
| `close` | `{ session_id }` | close a sandbox (stop billing) |
| `llm` | `{ prompt, model?, system? }` | one-shot ask to another model, billed per token |
| `docs` | `{ topic }` | free deep reference: media\|gtm\|research\|data\|compute |
| `vaaya_account` | `{}` | connected account, balance, premium allowance |
| `vaaya_onboard` | `{}` | where the human connects / signs up |
| `vaaya_logout` | `{}` | revoke this client's connection |
| `vaaya_test_connection` | `{}` | onboarding connectivity check |
| `brain_push` | `{ fact }` | save a fact to the shared company brain |
| `gtm_leads_find` | `{ … }` | discover ICP-matched leads |
| `gtm_leads` | `{ … }` | manage leads in the brain |
| `gtm_lead_enrich` | `{ … }` | reveal/verify a lead's contact data |
| `gtm_segments` | `{ … }` | group leads for targeting |
| `gtm_message` | `{ … }` | draft outbound (held for the user to send) |
| `gtm_asset` / `gtm_asset_produce` | `{ … }` | produce supporting assets |
| `gtm_automation` | `{ … }` | opt-in autopilot rules (explicit user ask only) |
| `gtm_brain` | `{ action, … }` | read/update ICP, value prop, voice, guardrails |
| `gtm_recall` | `{ query }` | semantic recall over everything the brain knows |
| `gtm_job` | `{ action, … }` | durable server-side multi-step GTM jobs |
| `gtm_composio` | `{ action, params }` | user's calendar / CRM / sheets |
| `gtm_signal_create` | `{ query, signal_types? }` | standing buying-signal watch (discovery-only) |
| `gtm_signal_act` | `{ finding_id, action? }` | signal finding → decision-makers → leads |
| `gtm_mailboxes` | `{}` | sending-surface inventory |
| `gtm_replies` | `{}` | list pending reply drafts |
| `gtm_reply_approve` | `{ message_id }` | approve + send a reply |
| `gtm_reply_edit` | `{ message_id, text }` | edit + send a reply |
| `gtm_reply_reject` | `{ message_id }` | reject a reply |
