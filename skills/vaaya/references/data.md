# Data — picking the right paid data call

Every call is `use({ service, action, params, max_cost_cents })`. Prices are in cents;
set `max_cost_cents` at or above the listed price as a guard, not a target. Failed or
invalid calls are not charged on most services. When unsure which endpoint or slug to
use, `vaaya/discover { query }` is FREE and returns exact endpoints with prices and
required params. Async actions return `{ job_id, async: true }` — poll `result({ job_id })`;
never re-run the action to check (that starts a new paid job).

## 1. Scraping — pages as rows

**Default: `vaaya/onescrape`** — flat **2¢ per URL**, sync, 1–5 URLs. Returns rows:
url, title, content (markdown; `format: "html"` for source), provider, `hops`, `hard`.
It runs a measured ladder of cheap scrapers internally and only returns a page that
passed a yield check (a Cloudflare wall escalates instead of being returned).

```
use({ service: "vaaya", action: "onescrape",
      params: { urls: ["https://stripe.com/pricing"] }, max_cost_cents: 4 })
```

- A row no cheap rung could read comes back `content: null, error: "blocked"` — the
  response's `next` names the deep call to make. If every URL is blocked the call fails
  with `all_blocked` and is not charged.
- **Refused without charge**: social-platform URLs (LinkedIn, X, Instagram, TikTok,
  Reddit, YouTube, CN platforms — use section 3) and PDFs/Office files (use a document parser).

**`vaaya/onescrape-deep`** — async. Two modes: `urls` (1–50) through the full ladder
including the unblock rungs, or `site: { url, max_pages, include, exclude }` to map and
read a whole site. Reserve = `budgetCents` (10–500, default 10¢/URL); `max_cost_cents`
must cover it. Charges only for the rung that actually read each page, so the real
charge is usually well under the reserve. Rows the budget could not cover return
`error: "over budget"`. `content: null` on a `hard: true` row means every rung bounced —
the next step is an interactive browser session, not another scraper.

**Raw vendors** — reach past OneScrape only for a knob it does not expose:

| Need | Service/action | Price | Notes |
|---|---|---|---|
| Cheap text, known URLs, no JS | `exa/contents` | 0.1¢/url×field | batch many URLs in one call |
| One JS-rendered page, clean markdown | `firecrawl/scrape` | 1¢ | `onlyMainContent: true`, `waitFor` ms |
| Same + stealth / proxy country / JSON schema | `crw/scrape` | 1¢ | Firecrawl-compatible params; fall-through vendor |
| Batch ≤5 known URLs with JS | `tavily/extract` | 1¢ | cheapest JS batch rung |
| Discover a site's URLs (recon) | `firecrawl/map` or `crw/map` | 1¢ | map first, then scrape targets |
| Multi-page crawl | `firecrawl/crawl` | 1¢ | **always set `limit`** (start 10–20) |
| Crawl with retrievable results | `crw/crawl` → `crw/crawl_status` | 10¢ + 1¢/poll | async, ≤100 pages, set `maxPages` |
| Structured extraction (prompt/schema) | `firecrawl/extract` | 1¢ | typed data, not HTML |
| Async schema extraction, ≤10 URLs | `crw/extract` → `crw/extract_status` | 5¢ + 1¢/poll | `basis: true` adds per-field evidence |
| URL → clean markdown, generous rate limit | `jina/read` | 1¢ | fall-through when firecrawl/crw error |
| Blocked page, cheapest first try | `scrapedo/scrape` | 1¢ | often beats pricier rungs on hard pages |
| Anti-bot / geo-fenced escalation | `brightdata/unblock` | 2¢ | solves DataDome/Cloudflare/PerimeterX |
| Residential + JS render (alt at 2¢) | `scrapedo/scrape_super` | 2¢ | race with brightdata, don't retry one twice |
| Second-opinion residential pool | `scrapingant/scrape_residential` | 4¢ | fallback only, after brightdata |
| Typed fields, not a page | `diffbot/analyze` | 1¢ | title/author/date/categories/sentiment; replaces scrape+LLM |
| Typed fields from a blocked page | `brightdata/unblock` → `diffbot/analyze_html` | 2¢+1¢ | pass the unblocked `html` + `url` |
| Fetch from a specific country | `oxylabs/scrape` | ≤25¢ | `geo_location`, `render: "html"` |
| Captcha in the way | `twocaptcha/solve` → `result` | ~0.3¢ each | polls are paid — space them out |
| Click / fill / login required | `browserbase` | 0.2¢/min | interactive browser session |

Field-selection gotchas:
- `exa/contents` bills **per URL × per content field** (`text`, `highlights`, `summary`),
  ceiling-rounded to whole cents. Asking for all three triples the cost with little
  marginal value if the page feeds an LLM anyway — pick the minimum field set.
- **A blocked scrape can still return HTTP 200.** A few-KB body or challenge markers
  (`DataDome`, `cf-browser-verification`, "Just a moment...") means the scrape failed —
  check the body, not the status code, then escalate to `brightdata/unblock`.
- Diffbot extracts, it does not unblock — its fetcher is weak exactly where Bright Data
  is strong. Chain them for bot-defended pages worth structuring.
- Space Diffbot calls several seconds apart; never batch a URL list through it unpaced.

**Scrape-and-store pattern** (content that must persist for later steps):
1. `files/list` first — don't re-scrape what a prior run already stored.
2. Scrape (OneScrape or a vendor above). For images/assets: scrape as html/markdown,
   collect the asset URLs, then `files/upload_from_url` each into storage.
3. `files/upload` for extracted text/datasets — returns a `file_id` later steps reference.
4. Record source URL + fetch date with each stored item; dedupe by URL across runs.

## 2. People — OneFind

**`vaaya/onefind`** — flat **2¢**, sync. Plain-English description of people → rows:
name, title, company, location, linkedin, plus `sources` and `hops`. `limit` 1–25
(default 15). Contact fields come back null with `enriched: false` — nothing is bought
at this tier. A query naming one person returns that one row (`person: true`). An email
or LinkedIn URL as the sync query is refused without charge — that is the deep tier's job.

```
use({ service: "vaaya", action: "onefind",
      params: { query: "heads of growth at B2B SaaS companies in Berlin", limit: 15 },
      max_cost_cents: 2 })
```

**`vaaya/onefind-deep`** — async, the same rows **with contact data** (email, phone).
Pass `query` (find then enrich) or `rows` (1–50 emails, LinkedIn URLs, or
`"name company"` strings) to enrich exactly those. Reserve = `budgetCents` (10–500,
default 16¢/row); charges only for lookups that returned data, so the real charge is
usually well under the reserve. Poll `result({ job_id })`.

- A null `email` on an `enriched: true` row means no vendor had it — a real answer;
  do not retry other vendors by hand.
- Rows over budget return `error: "over budget"`; raise `budgetCents` or lower `limit`.
- **People only.** "Find me fintech companies" is company discovery — a different surface.

## 3. Social-platform data

**`tikhub/fetch`** (GET reads) and **`tikhub/submit`** (POST ops) — 900+ endpoints
across **21 platforms**: douyin, tiktok, weibo, instagram, linkedin, bilibili, zhihu,
kuaishou, youtube, xiaohongshu, reddit, pipixia, lemon8, twitter/X, wechat_channels,
wechat_mp, wechat_search, threads, xigua, toutiao, telegram. The only catalog source
for the CN platforms. Most calls **1¢** flat, charged on success only; video-download
endpoints run up to 38¢ — `vaaya/discover` shows the real price per endpoint.

Never guess an endpoint: `vaaya/discover { query: "douyin trending" }` (free) → ranked
hits with `endpoint`, `price_cents`, `required_params`. Then call with
`{ endpoint, ...params }`. Conventions: profiles take `username` or `user_id`/
`sec_user_id`; content takes the platform id (`aweme_id`, `note_id`, `tweet_id`, url);
searches take `keyword`; paginated reads return a cursor — pass it back. Missing
required params are rejected before any charge.

```json
tikhub/fetch { "endpoint": "/api/v1/instagram/v2/fetch_user_info", "username": "nike" }
tikhub/fetch { "endpoint": "/api/v1/twitter/web/fetch_search_timeline", "keyword": "vaaya" }
```

**TikHub vs Apify**: TikHub = precise per-object reads (one profile, one video's
comments) at ~1¢. **`apify`** actors = bulk collection — price ≈ `maxItems` ×
per-result rate (1¢ min), sync ~10–15s; keep `maxItems` small (it sets both cost and
latency, and you pay the requested cap even if fewer rows return). Key Apify actions
(identifier param varies — URLs vs usernames vs search terms): `tweets` (`searchTerms`),
`x-followers`, `linkedin-posts` (`targetUrls`), `linkedin-jobs`, `reddit-posts`,
`reddit-comments`, `youtube-videos`, `youtube-comments`, `instagram-posts`/`-profile`/
`-hashtag`, `tiktok-posts`/`-profile`/`-comments`/`-video`, `facebook-posts`/`-pages`/
`-groups`/`-ads`, `gmaps-places`/`-reviews`/`-contacts`, `amazon-reviews`/`-product`,
`indeed-jobs`, `crunchbase`, `booking-reviews`.

**LinkedIn policy**: person-detail scraping (profile, contact info, experience,
follower lists) is not in the catalog. Available: public posts + engagement, company
pages, jobs, ads library, people/school search. For lead work use OneFind (section 2).

## 4. Public records — SEC, courts, nonprofits, salaries

All **1¢ flat**, keyless. The scarce resource is upstream rate limits, not money.
Deliverable style: lead with the fact, link the primary source on every row, state the
sweep scope honestly, close with "public-record research, not legal or investment advice."

| Question | Call | Notes |
|---|---|---|
| Resolve a company name → CIK | `edgar/entities { q }` | **start every company EDGAR task here**; proves "never registered" negatives |
| A company's complete filing history | `edgar/filings { cik }` | authoritative sweep — full-text search is relevance-ranked and pages |
| Phrase search across filing text | `edgar/fulltext { q, forms?, startdt?, enddt?, from? }` | 2001+; hits are per-document, exhibits outrank primary docs |
| Fetch one filing document | `edgar/document { cik, accession, filename }` | prefer .xml/.htm/.txt; strip any `xslF345X06/` prefix from `primaryDocument` |
| One financial number, public company | `edgar/concept { cik, concept }` | try `RevenueFromContractWithCustomerExcludingAssessedTax` → `Revenues`; also `NetIncomeLoss`, `Assets` — never scrape a 10-K for this |
| Every filing on one day | `edgar/index { date }` | THE enumeration tool ("all Form Ds this week" = one call per business day); weekends 404 = no filings |
| Who is suing X | `courtlistener/dockets { party_name }` | `q` matches document TEXT (mentions) — use `party_name` for litigants |
| Case opinions | `courtlistener/cases` | known case: `docket_number`+`court` or `case_name` |
| Nonprofit lookup | `propublica/nonprofit_search { q, state?, ntee? }` | `q` matches org NAMES, not causes; cause sweeps need `ntee` |
| Nonprofit financials | `propublica/nonprofit { ein }` | revenue, expenses, officer comp (aggregate), salaries, 990 PDF links |
| Current US federal regulation text | `govlaws/search { query }` (3¢), `govlaws/resolve { citation }` (5¢) | resolve = citable current CFR text with provenance |
| H-1B salaries | `firecrawl/scrape` on `h1bdata.info/index.php?em=<EMPLOYER>&job=<ROLE>&year=All+Years` | **always add `job=`** for big employers; check title taxonomy ("Member of Technical Staff") and filing-year vintage |

EDGAR rules that prevent wrong answers:
- **`forms` takes ROOT types only** (`D`, `4`, `10-K`, `S-1`, `C,C-AR,1-K,1-SA`). Roots
  match `/A` amendments automatically; listing `D,D/A` returns amendments-only — false zeros.
- **Form D**: `totalOfferingAmount`/`totalAmountSold`/`dateOfFirstSale` are in
  `primary_doc.xml`. `relatedPersonsList` = officers/directors — **not investors**
  (investor names are not in Form D; "who invested" is a web-search answer). No Form D
  ≠ no raise; filings lag closings up to 15 days; foreign issuers usually never file.
- **Never keyword-search Form Ds by sector** — Form D has no descriptive text. Invert:
  web search names the companies, then verify each via `edgar/entities` → `filings`.
- Form 4 transaction codes: P = open-market buy, S = open-market sale, G = gift,
  F = tax withholding, A = grant, M = option exercise. "Is X selling" = code S only.
  Form 4s index legal names ("Huang Jen Hsun") — a 0-hit person sweep is a name
  mismatch until proven otherwise; go company-first.
- Fetch sec.gov documents only through `edgar/*` (never a generic fetcher).
- A 990 never names an org's funders, and officer comp is all officers combined —
  per-person pay is in 990 Part VII (PDF only; web-search fallback, labeled).

Budgets per answer: ~5 EDGAR document fetches, ≤3 CourtListener calls, ~3 ProPublica
search pages + ~4 org pulls. Scope sweeps to the N most recent and say so.

## 5. Open data — archives, facts, patents, news, academia, regulation

All **1¢ flat** unless noted. Prefer these primary sources over web search for
historical, encyclopedic, patent-, regulation-, or registry-shaped questions.

| Source | Actions | Use for |
|---|---|---|
| Wayback Machine | `wayback/snapshots { url, from?, to? }`, `wayback/available { url, timestamp }`, `wayback/fetch { url, timestamp }` | what a page said at a date; deleted pages; diff two snapshots to track messaging |
| Wikipedia | `wikipedia/search { q }`, `wikipedia/page { title }` | full article as clean plain text — cheaper than scraping |
| Wikidata | `wikidata/search { q }` → Q-ids, `wikidata/entity { id }`, `wikidata/sparql { query }` | **start here to disambiguate any entity**; structured claims + cross-registry ids (LEI, tickers); SPARQL for set-shaped answers (keep LIMITed) |
| US patents | `uspto/patents { q, date_gte?, limit }`, `uspto/assignees { organization }` | patent portfolios, prior-art scans, "does X hold patents" (assignees first) |
| Global news | `gdelt/news { query, timespan }`, `gdelt/timeline { mode }` | non-US/non-English press (65 languages); coverage-volume/tone over time |
| Scholarly graph | `openalex/works { search, filter }`, `openalex/work { id }`, `openalex/authors` | most-cited-since-X, citation graphs, expert finding, OA links |
| US Federal Register | `fedreg/search { term, type?, agency?, date_gte? }`, `fedreg/document` | proposed + final rules since 1994; upstream regulatory signal, comment deadlines |

Normalized search→get merchants (search 10¢ returns rows with `id`s; `get { id }` 2.5¢
— when you already hold an id, skip search): **`apex-db`** (vehicle specs/emissions/
recalls), **`rxatlas`** (US drug products), **`trialbase-db`** (clinical trials),
**`recallradar`** (product-safety notices). Also: **`aviationstack/flights`** and
`/timetable` (~0.5¢, live flight status by `flight_iata` / airport), **`kicksdb`**
(`product-search`/`product-detail`/`sales-history`, ~0.05¢, sneaker resale prices
across stockx/goat/etc — every action takes `marketplace`).

## 6. Onchain & prediction markets

Three gateways; endpoints are params — find exact slugs with `vaaya/discover` (free).
Picking a lane: quick price/TVL reads → `kadec0` (1¢) or `blockrun` surf; prediction
markets → `blockrun` pm; wallet/token forensics + crypto-social signal → `heurist`
(2–5¢). Generic web search/news stays on your search tools.

- **`blockrun/fetch`** (1–2¢ typical) — market + prediction-market reads.
  Crypto: `/api/v1/surf/market/price|ranking|fear-greed|onchain-indicator`,
  `exchange/price|perp`, `news/feed`, `social/mindshare`, `onchain/gas-price`.
  Prediction markets: `/api/v1/pm/polymarket/markets|events|trades|positions|leaderboard`,
  `kalshi/markets`, `sports/markets`, `binance/candles/<SYMBOL>`, cross-venue
  `markets/search`. Example: `blockrun/fetch { "endpoint": "/api/v1/pm/kalshi/markets", "q": "fed rates" }`.
  This is research data access; actual trading positions go through the trade tools.
- **`heurist/agent`** (2–5¢, POST, endpoint `/x402/agents/<Agent>/<tool>`, args flat in
  body) — wallet and token forensics: `EtherscanAgent/get_address_history|get_erc20_top_holders`,
  `ZerionWalletAnalysisAgent/fetch_wallet_tokens|fetch_wallet_nfts`,
  `PondWalletAnalysisAgent/analyze_ethereum_wallet|analyze_base_wallet`,
  `GoplusAnalysisAgent/fetch_security_details` (token safety),
  `TrendingTokenAgent/get_trending_tokens`, `FundingRateAgent/*` (spot-futures arb),
  `TwitterIntelligenceAgent` + `ElfaTwitterIntelligenceAgent` (crypto-twitter signal),
  `UnifaiWeb3NewsAgent/get_web3_news`.
- **`kadec0/fetch`** (1¢ typical) — cheap defi reads: `/v1/defi-tvl`, `/v1/yield-pools`,
  `/v1/token-price`, `/v1/gas-oracle`, `/v1/trending-coins`, `/v1/stablecoins`,
  `/v1/market-sentiment`.

## 7. Compliance & KYB — `strale/check`

One action for 190+ regulated-data checks: `strale/check { "endpoint": "/x402/<check>", ...input }`.
Listed prices are **caps** (3¢–$1.19); a failed/invalid call charges nothing, so a
wrong-field retry is free — if a 400 names the expected field, fix and resend. Find
exact slugs with `vaaya/discover { query: "sanctions check" }` (free). Input fields are
the obvious ones per check (`domain`, `email`, `company`+`country`, `iban`, `wallet`…).

| Family | Endpoints (caps) |
|---|---|
| Screening | `sanctions-check` (30¢), `pep-check` (8¢), `aml-risk-score` (3¢), `adverse-media-check` (30¢), `insolvency-check`, `vasp-verify`, `credit-score-band` |
| Company registries | `uk-/us-/german-/french-/swedish-/norwegian-/finnish-/polish-/belgian-/au-/brazilian-company-data`; `canadian-`/`japanese-` ($1.19); `lei-lookup`, `beneficial-ownership-lookup` (38¢), `uk-companies-house-officers`, `company-enrich` (75¢), `company-tech-stack` |
| Email & domain trust | `email-validate` (5¢), `email-deliverability-check`, `domain-reputation` (8¢), `phishing-site-check`, `domain-age-check`, `solutions/email-audit` (38¢), `solutions/domain-trust` (60¢) |
| Identity & payments | `iban-validate`, `swift-validate`, `vat-validate`, `tax-id-validate`, `id-number-validate`, `phone-validate`, `address-validate`, `age-verify` |
| Trade & logistics | `hs-code-lookup`, `customs-duty-lookup` (30¢), `dangerous-goods-classify`, `eori-validate`, `container-track`, `shipping-track`, `flight-status`, `ted-procurement` (75¢) |
| Web3 due diligence | `wallet-risk-score`, `token-security-check`, `solutions/web3-counterparty-kyb` ($1.04), `solutions/token-project-dd` (93¢), `solutions/defi-protocol-risk` |
| Composites | `solutions/lead-email-verify` (30¢), `lead-enrich` (41¢), `prospect-profile` (81¢), `contact-verify` (38¢), `hr-candidate-screen` ($1.19), `ai-act-assess` ($1.19), `invoice-process` (75¢), `website-security-audit` (30¢) |

Use the composites for high-stakes lists (finance, EU) where a bounce costs more than
30–81¢ — but don't run $1+ composites over bulk lists without an explicit user go-ahead.

## 8. Real estate (US only)

Two vendors, different shapes. **`rentcast`** = flat price per request, listing-first.
**`realestateapi`** = metered **per record returned** — survey before you buy, ask for
the fewest records that answer the question.

| Question | Call | Price |
|---|---|---|
| What's for sale / for rent in X | `rentcast/sale-listings` / `rental-listings` | 30¢ |
| Zip-level market stats | `rentcast/market-stats` (`zipCode` REQUIRED, 5-digit) | 30¢ |
| Rent estimate | `rentcast/rent-estimate` | 35¢ |
| Everything about one address | `realestateapi/property-detail` (200+ fields: owner, mortgages, deed/tax history, equity) | 20¢ |
| Normalize a messy address first | `realestateapi/autocomplete` → canonical `id` | 1¢ |
| "All properties WHERE …" (equity, absentee/corporate owner, foreclosure, vacancy, 200+ filters) | `realestateapi/property-search` | 5¢ + 15¢/record |
| What is it worth (one number) | `realestateapi/avm` (`strict: true` refuses fuzzy matches) | 25¢ |
| Show the comparable sales | `realestateapi/property-comps` (3–5 comps usually enough) | 5¢ + 15¢/comp |
| Who owns it, how to reach them | `realestateapi/skiptrace` (genuine owner outreach only) | 25¢ |
| Parcel boundary GeoJSON | `realestateapi/parcel` | 20¢ |

Gotchas: on `property-search`, **survey first** — `count: true` / `summary: true` /
`ids_only: true` return totals/aggregates with no billed records; a 25-record page is
$3.80, quote it before running. RealEstateAPI filters are snake_case `_min`/`_max`
pairs and boolean lead flags (`absentee_owner`, `high_equity`, `pre_foreclosure`,
`cash_buyer`…); RentCast takes range strings (`bedrooms: "2-4"`) and a strict
`"Street, City, State, Zip"` address format. Route "what's listed" to RentCast.
Neither covers commercial, short-term-rental rates, HOA, or non-US — web search those.

## 9. Commerce — real-world purchases

These move real money to third parties. **Always confirm the item and total with the
user before the paid call**, and always run the free browse/quote step first. Purchases
marked "requires cap" hard-fail without an explicit `max_cost_cents` — set it to the
user-approved total, never a guess.

| Intent | Calls | Price |
|---|---|---|
| Send a real fax | `agentfax/send { to, file_url }` — PDF must be publicly fetchable, ≤10 pages | $0.20/page |
| Print + mail a letter | `postalform/validate` (free quote — ALWAYS first, same body) → `postalform/order` | varies, cap $20 |
| Roast-postcard a GitHub profile | `papercut/github-profile` (free) → `papercut/send` (roast ≤280 chars, all lowercase; show the reveal link, never the roast text) | $1 digital / $3 physical |
| Buy Napa wine (US, 21+) | `martin-estate/catalog` (free) → `purchase` — a 403 with `verify_url` means the human must verify age, then retry with the returned `order_id` | wine price; requires cap |
| Buy lab-grown diamond jewelry | `sayer-and-stone/catalog` (free) → `purchase` | piece price; requires cap |
| Hire another agent | `autoexchange/search { q }` (free) → `run { id, input }` | by agent + tokens; requires cap |
| Private git repo | `codestorage/repo-create` / `repo-get { id }` — clone URL embeds credentials, treat as a secret | $1 flat / ~1¢ |
