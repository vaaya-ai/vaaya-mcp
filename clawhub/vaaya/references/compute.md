# Compute, browser, files, memory, LLM, phone calls

Reference for the run-things side of Vaaya: sandboxes, browser automation, file
storage, persistent memory, cross-model inference, and outbound phone calls. All
paid calls go through `use({ service, action, params, max_cost_cents })` unless
noted; sandboxes have their own MCP tools (`session`, `close`), and `llm` is its
own tool.

---

## 1. Sandboxes (run code on an isolated external machine)

Five providers, one identical lifecycle. Use a sandbox only when you genuinely
need to *execute code* — run/benchmark an algorithm, execute untrusted or
AI-generated code safely, process a dataset, run tests. If you just need data,
use search/scrape/enrich instead.

**Lifecycle (all five providers):**

1. **Open** — `use({ service: "<provider>", action: "create_session" })` →
   returns `{ session_id }`. Reserves a small hold (~50¢) against balance.
   Optional params: `template`, `envs`.
2. **Run** — the `session` MCP tool (NOT `use`):
   `session({ session_id, command })` for shell, or
   `session({ session_id, code, language })` for code. Returns
   stdout/stderr/exit_code. The SAME box is reused, so installed packages and
   filesystem state persist between calls.
3. **Close** — `close({ session_id })` (its own MCP tool). Stops the meter and
   settles. **ALWAYS close when done, even on error** — an open session bills
   per second of uptime until closed.

**Which provider?**

| Need | Provider | Why |
|---|---|---|
| Untrusted / hostile code (the safe default) | `e2b` | Firecracker microVM isolation |
| Fastest cold start, trusted code | `daytona` | ~30–90ms starts (Docker isolation, not microVM) |
| I/O-bound work, strong isolation | `vercel` | microVM; US-East only, sessions ≤5h |
| Persistent coding-agent devbox (snapshot/resume) | `runloop` | Devbox survives across work |
| Long-running, state must survive, $0 while idle | `fly` | Billed only while actively running; NO auto-expire — you MUST close it |

Default to **e2b** unless a row above clearly fits better.

**Billing:** metered per second of uptime, roughly 5¢ per vCPU-hour
(`fly` bills CPU-hr + GB-hr while running and is $0 idle). Cheap, but only if
you close.

**Limits and gotchas:**
- `e2b` has a `code` interpreter where variables persist across calls. On
  `runloop`, `vercel`, and `fly`, `code` runs one-shot — in-memory variables do
  NOT persist between `code` calls (filesystem and installs do); carry state
  via files or shell.
- `vercel`: prefer shell `command` for non-JS work (`python3` availability
  depends on the runtime).
- `fly`: `envs` is not applied at create — `export` vars inside a `session`
  command instead. And with no auto-expire, a forgotten fly box has no timer
  saving you.
- Validate commands before creating — a create bills even if the first command
  fails instantly.
- Pick the cheapest box that fits; one box per job, not one per command.

**Data in / data out:** stage inputs in Files (section 3) and download them
inside the box from the `get_url`. For small results, print JSON to stdout and
read it from the `session` return. For artifacts (datasets, charts, model
output), upload from inside the box to a `files/upload` `put_url` so downstream
steps can reuse them.

---

## 2. Browser automation (Browserbase)

Remote Chrome you drive yourself with Playwright or Stagehand over CDP. Use it
when you need to **act** on a page: click, type, log in, fill multi-step forms,
paginate, work datepickers/dropdowns, test a flow end-to-end, or scrape a
JS-heavy SPA that needs real interaction.

**Drive a browser vs scrape:** if you only need to *read* content, don't open a
browser — a search/contents call (~1¢) or a JS-rendered scrape (~1¢) is
cheaper and faster. Browserbase is for pages where read-only tools can't do the
job.

| Action | Params | Cost |
|---|---|---|
| `browserbase/create_session` | `estimatedMinutes` (≥1, default 1), `keepAlive?`, `proxies?` (e.g. `{ country: "US" }`) | 0.2¢/min prepaid (10 min = 2¢, 60 min = 12¢) |
| `browserbase/extend_session` | `session_id`, `estimatedMinutes` | 0.2¢/min |
| `browserbase/session_status` | `session_id` | free |
| `browserbase/release_session` | `session_id` | free |

`create_session` returns `{ sessionId, connectUrl, paidMinutes }` — connect
Playwright/Stagehand to `connectUrl` yourself (Vaaya does not proxy the CDP
traffic).

**Gotchas:**
- Prepaid minutes are NOT refunded on release — estimate conservatively and
  `extend_session` before `paidMinutes` runs out rather than over-buying.
- Always `release_session` when done (free) so the slot returns to the pool.
- Check `session_status` (free) before deciding to extend or release.

---

## 3. Files (the user's persistent file library)

Durable per-user file storage so later tasks can reuse artifacts. Its main role
is **staging**: sample data for trials, inputs for sandboxes, source assets for
demos and media generation, and any artifact a workflow produces that a later
step (or a later session) will need.

| Action | What it does | Cost |
|---|---|---|
| `files/upload` | You have the bytes locally. Requires `size_bytes` up front; returns a `put_url` — PUT the raw bytes to it (`curl -X PUT --upload-file x "<put_url>"`) | 1¢ |
| `files/upload_from_url` | Server fetches a public URL directly — prefer this for anything already on the web | 1¢ |
| `files/get` | Re-mint a fresh download `get_url` for a stored file | free |
| `files/list` | List files; filter by `tags` / `query` | free |
| `files/delete` | Remove a file (free up quota) | free |

**Conventions:**
- ALWAYS `files/list` before uploading or re-fetching — the file may already be
  there from a previous task.
- Tag uploads with the task domain (e.g. `["video-segmentation", "sample"]`)
  and add a short `note` so future runs can find them.
- `get_url` is valid ~1h and any external service (media generation, sandboxes)
  can download from it; re-mint anytime with `files/get`.
- Quota: 100MB per file, 2GB per user. Over quota → tell the user and suggest
  deleting old files.

---

## 4. Persistent memory (remember across sessions)

Store durable **facts** — preferences, identity, decisions, evolving status —
that survive between calls. All memory ops are **1¢**. Memory is for facts and
semantic recall; Files is for blobs. Store the source artifact in Files, the
extracted facts in memory.

**Pick the provider:**

| Use when… | Provider | Shape |
|---|---|---|
| "Remember what this user likes/said" — the default | **mem0** | `add` / `search`, scoped by `user_id` |
| What's true *changes over time*; you need "what's true now" | **zep** | user → thread → `add`; `get-context` / `search` |
| A self-managing agent that edits its own memory over a long relationship | **letta** | `agent-create` once → `message` |

**mem0:** `mem0/add` (`messages`, `user_id`; optional `metadata`, `infer` —
set `infer: false` to store verbatim, e.g. dedup IDs) auto-extracts durable
facts. `mem0/search` (`query`, `user_id`, `top_k?`) returns ranked memories.
Note: `add` is queued — a `search` immediately after may not surface it yet.

**zep:** strict order, no implicit creation: `zep/user-add` (`user_id`) →
`zep/thread-create` (`thread_id`, `user_id`) → `zep/add` (messages; pass
`return_context: true` to get the context block inline). `zep/get-context`
(`thread_id`) returns a ready-to-inject "what's true now" block with superseded
facts resolved; `zep/search` (`query`, `user_id`) fetches a specific fact.

**letta:** `letta/agent-create` (optional `name`, `model`, `memory_blocks`)
returns an agent `id` — create ONE per persona/user, never per turn. Then
`letta/message` (`agent_id`, `input`); the agent runs an LLM step and rewrites
its own memory. Reply is the `assistant_message` item.

**Core pattern — read before write:** search/get-context BEFORE answering and
prepend the facts to your reasoning; `add` new durable facts AFTER. Always use
the same stable `user_id` — mismatched ids leak or hide memories. Store facts,
not transcripts.

---

## 5. The `llm` MCP tool (ask another model)

One-shot access to 300+ models (Kimi, GPT, Gemini, Claude, DeepSeek, Llama,
Qwen, …) billed per token from the user's balance. No API keys.

**Model selection:** pass a tier — `auto` (let it pick), `cheap`, `mid`,
`best` — or an exact OpenRouter slug when the user names a model
(`moonshotai/kimi-k3`, `anthropic/claude-opus-5`, `google/gemini-2.5-pro`).
Unsure of a slug? Ask `llm` itself with `cheap` to suggest one.

**Typical price per call:** cheap under 0.1¢, mid 0.1–1¢, best 1–3¢. A $10/day
per-user inference cap applies.

**Good uses:**
- The user names a model ("ask Kimi what it thinks", "what would GPT say").
- Second opinion / cross-check from a rival model (`best` for hard reasoning).
- Cheap bulk summarization or extraction over large text (`cheap`).
- Draft with a cheap model, review with a good one (two calls).

**Not for:** the conversation you're already having (you ARE a model),
multi-turn chats (each call is one-shot — carry context in the prompt), or
image/audio/video generation (that's media services via `use`).

If the user wants their OWN software to run inference through Vaaya, they can
point anything OpenAI-compatible at Vaaya's hosted endpoint with their Vaaya
API key and any slug or tier alias (streaming works) — consult for setup. For
real-time voice pipelines, pick fast non-reasoning "flash/mini/lite" class
models; reasoning models can return empty strings under small `max_tokens`.

---

## 6. Phone calls (`voice/call`)

Vaaya places real outbound AI phone calls: you state a goal, Vaaya dials from
its own number, an AI caller works the goal, and the job resolves to outcome +
transcript + summary.

```js
use('voice', 'call', {
  to: '+14155550123',           // E.164. US/Canada + Indian mobiles only
  goal: 'Ask if they have a table for two at 8pm tonight and book it under Apoorv.',
  context: 'Flexible between 7:30 and 9. Party may add a third person.',  // optional
  on_behalf_of: 'Apoorv',       // optional — named in the AI-disclosure opener
  first_message: 'I would love to book a table for tonight.',             // optional
  max_minutes: 5,               // optional, 1–10, default 5
  language: 'hi',               // optional — Hindi calls MUST set this (switches
                                // the transcriber + localizes the disclosure);
                                // omit for English
})
```

**Async:** returns a `job_id`; dials within ~1 minute. Poll `result({ job_id })`
until it returns `{ outcome, transcript, summary, duration_seconds,
ended_reason }` — `outcome` is `reached | voicemail | no_answer |
not_connected`. **Never re-run `voice/call` to check a job — that places a
second phone call.**

**Pricing:** 20¢ per connected minute. The job reserves `max_minutes × 20¢`
and captures only `ceil(actual minutes) × 20¢`. A call that never connects is
charged 0. Voicemail counts as connected (one concise message is left).

**Guardrails (enforced server-side — never promise around them):**
- **AI disclosure is mandatory and automatic**: the first sentence announces
  it's an AI assistant (naming `on_behalf_of` when given); a custom
  `first_message` comes AFTER the disclosure, never instead of it.
- Destinations: US/Canada and Indian mobiles only; premium-rate prefixes
  blocked. Not for inbound/IVR, SMS, conference calls, or other regions — say
  so plainly and offer email/LinkedIn instead.
- The caller refuses to collect card numbers, OTPs, government IDs, or
  passwords, and ends politely if asked not to call again.
- Budgets: max 10 min/call, 2 calls in flight, 30 reserved minutes per rolling
  24h. A budget hit returns a clear error — relay it, don't retry.
- Compliance judgment stays with you: no bulk unsolicited marketing calls,
  respect called-party time zones, prefer business numbers for cold asks.
