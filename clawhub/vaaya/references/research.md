# Research with Vaaya — OneSearch + the research playbooks

How to answer questions with cited evidence, run deep multi-hop research, and execute the
research recipes (company, evaluative, product/feature, UX, knowledge repos). All calls go
through `use({ service, action, params, max_cost_cents })`. When unsure what to call,
`consult` with a plain-English intent and it hands back the exact calls.

## OneSearch — one call that plans and executes a retrieval (5¢ flat)

`vaaya/onesearch` is the default research call. You hand it an intent; it plans a
multi-source retrieval, races independent indexes, chains full-content extraction when
fidelity matters, and returns normalized evidence. The internal source calls are included
in the flat 5¢ price. Not charged when every source fails.

```
use({ service: "vaaya", action: "onesearch",
      params: { query: "what changed in the EU AI Act enforcement timeline this year" },
      max_cost_cents: 5 })
```

With just a `query`, an intent classifier picks the routing. Add any frame field to route
it yourself (this skips the classifier):

- `facets` — one or more source lanes (default `["web"]`):
  - `web` — general search.
  - `docs` — technical documentation, returned as complete markdown, never summarized.
  - `news` — current events (independent news indexes; GDELT for global/non-English).
  - `academic` — scholarly works (OpenAlex, 250M+ papers, open-access links).
  - `code` — source and repositories (GitHub index).
  - `public-filings` — official SEC EDGAR filings (fundraises, insider trades,
    financials), chained to the primary-source document.
  - `funding` — fundraise history from the SEC exempt-offering record (Form D,
    Reg CF/A) plus the resolved filer's full filing history. The legal record of
    private raises, not an aggregator's copy.
  - `financials` — structured XBRL numbers (revenue / net income / assets, picked from
    the query) plus periodic reports (10-K/10-Q) for the resolved filer.
  - `legal` — US case law + litigation (CourtListener, 10M+ opinions), with RECAP
    federal dockets as the "who is suing X" fallback.
  - `nonprofits` — IRS 990s: resolves the org, then year-by-year
    revenue/expenses/assets by EIN.
  - `regulatory` — Federal Register (proposed + final rules since 1994, comment
    periods) enriched to the full document record; patent/assignee lookups as the IP
    fallback.
  - `compliance` — KYB on a named company: canonicalized identity plus registry
    cross-ids (LEI, tickers). Sanctions / adverse-media / beneficial-ownership
    screening lives in the deep tier (below).
  - `social` — caller-only (never auto-picked): add `platform` (`tiktok`, `instagram`,
    `youtube`, `twitter`, `weibo`, `reddit`; default `twitter`) to get raw posts.
- `timeCritical: true` — race two independent indexes for breaking / "latest" queries.
- `fidelityRequired: true` — fetch full page content (search → extraction), not snippets.
- `recencyDays`, `domains` / `excludeDomains`, `maxResults`.
- `urls: [...]` — skip search and extract these pages directly.
- `asOf: "YYYYMMDD"` — fetch the archived copy via the Wayback Machine.

**Result shape**: `evidence`, each item with `url`, `title`, `snippet`, optional full
`content`, `source` (which vendor/action produced it), and the `tx_id` it came from —
every item is auditable.

**When OneSearch beats a raw search vendor**: when the value is in the bundling — one
call that searches, corroborates across indexes, optionally pulls full page content, and
returns cited evidence. It is also the only path to the filings-shaped lanes (SEC,
funding, financials, case law, 990s, regulatory, KYB). Pick a raw vendor instead when a
single 1¢ call is enough, or when you need a vendor-specific feature (e.g. `exa/search`
with `category: "people"` for people-discovery — or better, `vaaya/onefind` for people).
Rule of thumb: Search answers questions, Find returns people, Scrape returns pages.

## OneSearch Deep — async, higher budget (`vaaya/onesearch-deep`)

For hard questions the flat 5¢ call under-covers. Same inputs as `onesearch`, plus:

- `depth`: `"standard"` (default budget 10¢) | `"deep"` (default, 50¢) | `"exhaustive"`
  (150¢).
- `budgetCents`: 5–500. This is the most you pay — the job holds it and captures only
  the actual source spend on completion (0 if every source failed).

It runs the flat plan first, judges coverage, escalates thin facets to the expensive
rungs (multi-hop web research, async research tasks, global compliance screening), then
returns evidence ranked and corroborated across sources, with primary-source records for
money and law questions.

```
const { data } = use({ service: "vaaya", action: "onesearch-deep",
  params: { query: "timeline of agent-payment protocol adoption across vendors",
            depth: "deep", budgetCents: 50 },
  max_cost_cents: 50 })
// → { async: true, job_id }

use({ service: "vaaya", action: "result", params: { job_id }, max_cost_cents: 1 })
// FREE. status: "running" (poll again in 5–30s) | "succeeded" (read result) | "failed"
```

**Never re-run `onesearch-deep` to check on a job** — that starts a second job and a
second hold. Poll `vaaya/result` only.

## Raw search rungs (when one cheap call is enough)

- `exa/search` (1¢) — default semantic search; `numResults` up to 100,
  `contents: { text: true }`, `start_published_date` for anything time-sensitive.
- `brave/search` (1¢) — independent index; corroboration partner. `linkup/search` (1¢)
  — cited answer in one call; `linkup/deep-search` (5¢) for multi-hop.
- `parallel/task` (10¢ `pro` / 30¢ `ultra`) — async managed research runner; poll
  `parallel/task-status` (free).
- `valyu/academic` (1¢) — searches arXiv/PubMed directly and returns paper text + DOI.
- `serper/search` (1¢) — real Google ranks, for "what does Google show" questions.
- Extraction: `exa/contents` (0.1¢/url), `firecrawl/scrape` (1¢, renders JS).

Two rules that prevent most bad searches: start cheap and escalate only when the answer
demands it; recency-filter anything time-sensitive.

## Playbook — deep research (multi-hop question → cited report)

For questions one search can't answer. Rough total: 10–50¢.

1. Confirm it actually needs depth — many "research" asks are one good search away.
2. **Managed path**: `parallel/task` (`pro` 10¢ / `ultra` 30¢) or
   `vaaya/onesearch-deep` — fastest to a broad answer.
3. **Orchestrated path** (when you need auditable citations): decompose into 3–6
   sub-questions → `vaaya/onesearch` or `exa/search` each (recency-filtered) → read key
   sources in full (`exa/contents` / `firecrawl/scrape`) → corroborate every
   load-bearing claim across ≥2 independent sources, preferring primary sources →
   synthesize.
4. **Hybrid (high-stakes)**: managed run for breadth, then verify its key claims with
   your own searches before trusting them.

Output must contain: the synthesis, a citation (URL + publish date) per load-bearing
claim, and explicit confidence/gaps — never pad with weak sources.

## Playbook — company research (full company report)

Rough total: 30¢–$1.50 depending on sections; confirm scope with the user first.

1. **History** — `vaaya/onesearch` on the company; `facets: ["funding"]` /
   `["public-filings"]` for raise history grounded in the official record.
2. **People** — search + scrape about pages / LinkedIn / Crunchbase; headcount from the
   company's LinkedIn page is an estimate, label it. Employee sweeps via people-finding
   tools if GTM is enabled.
3. **Hiring** — scrape careers page + job boards; `firecrawl/extract` roles into
   `{ title, team, location, seniority }`; report where/what/rate.
4. **Discoverability** — infer target keywords from on-page SEO (`firecrawl/scrape`
   titles/meta, `firecrawl/map` for structure); check LLM visibility by prompting models
   with buyer questions and noting placements. Label rank/volume/traffic as estimates —
   there is no traffic-data provider; never invent numbers.
5. **Ads** — scrape the public ad libraries (Meta Ad Library, Google Ads Transparency
   Center, TikTok, LinkedIn): platforms, creative themes, run dates, disclosed spend.
6. **Reputation** — search + scrape G2, Capterra, Reddit, HN; synthesize sentiment with
   quotes and links.
7. Assemble one report: executive summary, citations per section, estimates clearly
   labeled, confidence per section. Store evidence via `files/upload_from_url`.

## Playbook — evaluative research ("what's the best X for my case")

Measure, don't summarize marketing pages. Rough total: 30¢ discovery + 5–33¢ per hosted
trial; a GPU trial only when the measured answer matters more than ~$1.

1. **Discover** — `exa/search` for recent comparisons/leaderboards, scrape the top 2–3.
   Output: 2–4 named candidates.
2. **Ground (free)** — read the user's codebase: input formats, latency budget, runtime.
   Pick real sample data; check `files/list` first, then `files/upload`.
3. **Trial** — run each candidate on the sample. Hosted-first (`fal/generate` with the
   file's `get_url`); a compute sandbox only when no hosted endpoint exists. A candidate
   that won't run is marked "reported from sources only", never a reason to abort.
4. **Synthesize** — comparison table (quality on the user's data / measured latency /
   cost per call / integration fit), one recommendation with the reason, actual spend.

## Playbook — product / feature research

Rough total: 20–60¢.

1. **Catalog (exact)** — `firecrawl/map` the site; `firecrawl/scrape` + `extract`
   product/pricing/changelog pages into `{ product, feature, description, category,
   pricing_tier, target_user }`. Store it.
2. **Demand (estimated)** — category + "best/alternative/how to" queries; harvest
   autocomplete, related searches, people-also-ask. Map to the catalog; flag gaps.
   Label all volume as directional — there is no keyword-volume provider.
3. **Reviews (exact)** — scrape G2/Capterra/Reddit/HN; tag mentions by feature, rank by
   discussion volume, score sentiment per feature (loved / complained / requested),
   keep quotes with links.
4. Deliver catalog + demand read + feature-sentiment ranking, estimates labeled.

## Playbook — UX research (interactive product map)

1. Pick the browser: login/private app → local Playwright with the user's session;
   public product → hosted browser session. When unsure, local Playwright.
2. Recon: `firecrawl/map` the site + docs; inventory entry points and navigation; list
   the key flows (onboarding, core job, settings, upgrade).
3. Walk each flow; screenshot every meaningful state; record
   `{ flow, step_index, screen_name, url, action_taken, purpose, friction_notes }`;
   build a flow graph (screens = nodes, actions = edges).
4. Store screenshots via `files/upload`; then hand-author one self-contained interactive
   HTML map: clickable flow diagram, per-screen panels, UX read.

Never invent screens from marketing copy — drive the real product; mark unreachable
flows "not captured". Cost is mostly free browser driving + storage.

## Playbook — product knowledge repository (living intelligence)

1. Define entities and a consistent field schema; pick a stable namespace
   (e.g. `kb:competitors`).
2. Gather by composing the recipes above; keep source URL + date per fact.
3. Store: facts → memory (`mem0` default; `zep` when "what's true now" matters — it
   supersedes stale facts); artifacts → `files`, tagged by entity; plus one JSON/markdown
   index file.
4. Query the repo first (`mem0/search` / `zep/get-context`) before re-researching;
   assemble battlecards / comparison matrices on demand.
5. Refresh on a cadence or on signals (funding/launch news); diff against stored facts,
   dedupe on update. No unattended cron — refreshes run when the agent is invoked.

## Cost discipline

`exa/search` (1¢) and `vaaya/onesearch` (5¢) are the workhorses — search freely. Reserve
`parallel/task` (10–30¢) and `onesearch-deep` for genuinely deep questions. Set
`max_cost_cents` at or slightly above the listed price as a guard, not a target, and stop
as soon as you have enough corroborated, current sources.
