# CSN — "Check stock now": engineering design

**Programme item:** CSN (new, 2026-11-22) · **Author:** Priya, catalog/data specialist seat
**Status:** DESIGN ONLY. No build, no migration, no production write is authorized by this memo.
The additive columns/tables in §4 are plumbing of the kind Dustin pre-authorized on
2026-11-22 ("anytime you need to do that, just go ahead") — but the CSN build itself still
waits for his go on this design.
**Codebase read:** worktree at `origin/main` (`v2/`: Next.js 16.4.6 + OpenNext 1.20.17 on
Cloudflare Workers, D1 + Drizzle 0.45.4, Wrangler 4.162.0). All file references below are to
that tree unless a crawl record is named.

## The commission, in Dustin's words

> "Can we add a small little link that says check stock now that will fire off a little worker
> to go check it out but then we'll need to cache that information so that multiple people when
> they click on that link it doesn't require it to run through it every time."
> — voice call, 2026-11-22

## Governing values (settled; this design does not re-litigate them)

1. **Freshness window: 24 hours, enforced server-side.** (A 72-hour amendment was made and
   reverted on the same call; 24h governs.)
2. **A listing can be force-checked by the public at most once per 24 hours.**
3. **Prices are captured in crawl data but NEVER shown.** This feature writes stock state
   only; its parser must discard any price it encounters (§3.4).
4. **There is no standing full-listing stock crawl** (the hunt is paused; the scout adds
   varieties; Quinn's audit samples). CSN is therefore the freshness mechanism, and its write
   path becomes the **system of record for stock freshness**. That raises the bar on its
   write discipline: every rule in §3 exists because there is no crawl behind CSN to quietly
   correct a bad write.

## Evidence basis — what is measured, what is inferred

Measured from the code and records (file/line-level reading, this session):

- Listings schema, `v2/lib/db/schema.ts`: `listings.availability` is a CHECK-constrained enum
  `('in_stock','sold_out','preorder','shop_closed','unknown')`; `listings.last_checked_at`
  already exists (nullable ISO text) and is written today **only** by the ingest path
  (`lib/repositories/ingest.ts`, `upsertObservedListing`, from the observation's
  `checkedAt`) and the catalog importer. Public display already pairs availability with that
  date (`lib/format.ts` `formatCheckedDate`; site copy in `lib/config.ts`: "stock state as
  last seen, the date each listing was checked").
- Sellers carry `crawl_policy` (`'feed' | 'html' | 'manual_only' | 'opted_out'`, schema
  default **`manual_only`**) and a `platform` (`'shopify' | 'woocommerce' | 'squarespace' |
  'other' | NULL`) — `lib/db/schema.ts`, sellers table. Sellers also carry a unique
  `domain` column (used for per-domain keying in §5).
- The `/go/{listing_id}` precedent: `v2/app/go/[id]/route.ts` — public, unauthenticated,
  `force-dynamic`, id validated by `/^\d{1,12}$/`, 404 for unknown/unpublished, 410 when the
  seller is removed, `Cache-Control: no-store` + `X-Robots-Tag: noindex` on every response.
- The sanctioned write-route pattern: `lib/api/write-route.ts` (`writeRouter`) — route
  tables declaring method/pattern/scope/rate-limit bucket, `application/problem+json`
  errors, `no-store` responses, revalidation of affected public paths after a write. The
  public (scope `null`) precedent is `POST /api/v1/reports`
  (`app/api/v1/reports/route.ts`, bucket `reports`, 3/min/IP, Turnstile *behind config*).
  The admin-key precedents are the Tranche 1.1/1.8 routes in
  `lib/api/ingest-admin-routes.ts` (description, small-farm, and the commissioned
  `sellers/:id/location` route per `muse-tasks/seller-location-endpoint.md`): one route,
  one service funnel, changed-field proof, idempotent.
- The single-funnel write discipline for listings already exists:
  `upsertObservedListing` writes availability + `last_checked_at` + `updated_at` in one
  `atomic()` batch (`lib/repositories/atomic.ts` — the only place `db.batch()` may be
  called), bumps the catalog sequence (`nextSeq`), and appends a `listing_events` row
  (`restocked` / `sold_out`) when availability transitions. CSN mirrors this exactly (§3).
- An in-Worker fetcher precedent exists and is the code shape CSN reuses:
  `lib/services/farm-summary.ts` — honest bot UA (`BOT_USER_AGENT` /
  `HuesSeedFinderBot/1.0 (+https://seeds.hues.flowers/about/bot)`, `lib/config.ts`),
  robots.txt checked via the existing TypeScript evaluator `lib/robots.ts`
  (`robotsAllows`, RFC 9309: our token's group wins, longest rule wins), a minimum gap
  between requests (`MIN_REQUEST_GAP_MS = 2000`), page-size cap
  (`MAX_PAGE_CHARS = 400_000`), and failure classification (`unreachable | blocked |
  robots_denied | not_html | bad_url`; HTTP 401/403/429 → `blocked`).
- A leased-job precedent exists: `crawl_jobs` (`status queued|leased|done|failed`,
  `lease_expires_at`, `attempts`, `next_run_at`) with ingest lease/complete/fail endpoints.
- Queue/cron infrastructure that actually exists: **no Cloudflare Queues binding** is
  configured. OpenNext is configured with the **memory queue** (`open-next.config.ts`),
  which exists solely for ISR revalidation via the `WORKER_SELF_REFERENCE` service binding
  — it is not a general job queue and this design does not repurpose it. One cron exists:
  `*/15 * * * *` → `worker.ts` `scheduled` → `lib/jobs/scheduled.ts` `runScheduled`
  (drains the waitlist-notification outbox; prunes sign-in attempts older than a day).
  Worker observability is enabled in `wrangler.jsonc`.
- Rate limiting precedent: Workers rate-limit bindings in `wrangler.jsonc`
  (`API_RATE_LIMITER` 120/60s namespace 1201, `SEARCH` 60/60s 1202, `REPORTS` 3/60s 1203,
  `INGEST` 600/60s 1204) consumed through `lib/api/rate-limit.ts` (`allowKeyed`, with a
  per-isolate token-bucket fallback when a binding is absent). Tranche 3 §11.4 (DECISIONS.md
  §4, ruled 2026-11-22) sets the compensating-controls pattern for a public endpoint
  without a bot check: bounded effect + the site's existing rate limiting.
- Crawl machinery (`~/workspace/seeds-hues/crawl-pass-1/crawl.py`, `generic.py`;
  `CRAWL-PASS-1-REPORT.md`, 2026-11-17): robots.txt checked per host before fetching;
  **≥5 s between requests per host, one at a time per host** (`MIN_INTERVAL = 5.0`);
  per-request timeout 40 s; ~600 requests in ~75 minutes for a full pass at $0 external
  spend. Availability signals per platform are detailed in §2.2. Every listing link is the
  individual product page — no homepages, collections, or search pages (standing rule).
- Catalog scale (measured, Quinn's daily-audit state file, 2026-11-21):
  **1,480 listings, 83 sellers, 804 varieties**, catalog_seq 4482 (4618 by the 2026-11-22
  sweep snapshot). Used for the math in §6.
- Block evidence (`~/workspace/seeds-hues/seller-contacts-2026-11-22/REPORT.md`): four
  sellers' sites refuse **this VM's** direct fetches at their CDNs — **Park Seed, High
  Mowing, Gertens, Peace Seedlings** — and were read via the crawl route instead. High
  Mowing is independently corroborated by Crawl Pass 1: its sitemap read fine, then the
  host returned **HTTP 403 for every request**; recorded as blocked, no circumvention
  attempted. Peace Seedlings has **no web shop and no product pages** (Blogspot list,
  mail/email ordering) — a different case from a CDN block; see §2.4.

Inferred (labelled as such wherever used below):

- Single-product machine forms (Shopify `/products/<handle>.json`, Squarespace product
  URL `?format=json`) are **not** in the crawl records — the crawl used whole-catalog
  feeds (`/products.json`, collection `?format=json`) and product-page HTML. §2.2 treats
  them as a build-spike verification item, never as a relied-upon fact.
- The OpenNext request context (`getCloudflareContext`, already used in
  `lib/api/runtime-env.ts` and `lib/db/client.ts`) is expected to expose
  `ctx.waitUntil`; the build must prove this in a spike, and §1.3 specifies the fallback
  if it does not hold.
- Timing figures in §1.4 are engineering estimates from the crawl records' behaviour
  (request timeouts, pacing), not measurements of the production Worker.

Gaps I could not close from the records (named, per brief):

- **Live `crawl_policy` values per seller are not in the records.** Crawl Pass 1 warned
  that production sellers may still sit at the schema default `manual_only` (the seed
  data sets no policy). CSN therefore reads the policy live at click time (§2.4); how
  many listings are checkable on day one depends on data this design cannot see.
- **The block-list sellers' domains are not stated in the sweep report** — only seller
  names. The build keys blocks by `sellers.domain`; the four names above are the seed
  list, and the domain values come from that column at build time, not from this memo.
- **No live D1 access was used** (design-only commission): counts are as of the dated
  records cited, not re-measured today.

---

## 1. Trigger + execution path

### 1.1 What a click calls

A new public route pair, built on the `writeRouter` pattern (the reports-route
precedent: public, `scope: null`, bucketed, `no-store`, problem+json errors):

```
POST /api/v1/listings/:id/stock-check     — the click. Triggers or joins a check.
GET  /api/v1/listings/:id/stock-check     — status poll. Read-only; never triggers.
```

- `:id` is the numeric listing id, validated exactly as `/go` validates it
  (`/^\d{1,12}$/`); anything else is a 404 problem. The caller supplies **only an id** —
  the fetch URL is read server-side from `listings.product_url`. This is the property
  that makes the endpoint unusable as a general-purpose fetcher (§6.3).
- **Auth posture: public, no key, no session** — deliberately the `/go` / reports
  posture, because the click is a visitor action. It is safe to leave public only
  because its effect is bounded on every axis: one listing, one fetch, at most once per
  24h, domain-paced, globally budgeted, kill-switched (§5, §6). A POST (not GET) is the
  trigger because it changes state; the GET is a pure read of the cache row.
- **Eligibility, evaluated server-side in this order** (first failure decides the
  response; no fetch happens for any of them):
  1. Listing exists and is publicly visible (`status IN ('active','published')`,
     not soft-deleted) — else **404** (mirrors `/go`).
  2. Seller is active — else **410** when the seller was removed (mirrors `/go`).
  3. Kill switch off (§6.4) → return last-known state, `outcome: "disabled"`.
  4. `crawl_policy` is `manual_only` or `opted_out` → `outcome: "not_checkable"`,
     reason `crawl_policy` (§2.4). No fetch, ever.
  5. `product_url` is NULL → `outcome: "not_checkable"`, reason `no_product_page`.
  6. Seller's domain is on the active block list (§5.3) → `outcome: "blocked"`,
     served from cache. No fetch.
  7. A check is **in flight** → join it (§1.3): return `state: "checking"`.
  8. Last attempt is **inside 24h** → return the cached result (§4.2).
  9. Otherwise → claim and start a check (§1.3): return `state: "checking"`.

### 1.2 Response contract (what Nadia builds against)

Both verbs return the same JSON shape, so the card has one parser:

```json
{
  "listing_id": 1234,
  "state": "fresh | checking | stale | not_checkable | blocked",
  "availability": "in_stock | sold_out | preorder | shop_closed | unknown | null",
  "checked_at": "2026-11-22T18:04:11.000Z | null",
  "attempted_at": "2026-11-22T18:04:11.000Z | null",
  "outcome": "ok | couldnt_check | blocked | robots_denied | not_checkable | deferred | disabled | null",
  "age_seconds": 312,
  "retry_after_seconds": 4
}
```

Field semantics Nadia can rely on:

- `availability` + `checked_at` are **always a pair**: the last *confident* reading and
  when it was read. Either both are present or `checked_at` is null (never read
  confidently). A failed check never moves either field (§3.3) — so "last checked"
  copy can never claim a freshness the data does not have.
- `state: "fresh"` means `attempted_at` is inside the 24h window **and** the last
  outcome was `ok`. `state: "stale"` means the last attempt is inside the window but
  was not `ok`, **or** the window has expired and no new check has run — in both cases
  `availability`/`checked_at` still carry the last confident reading, however old.
  (The UI decides how to word staleness; the API never hides it.)
- `retry_after_seconds` is present only in `checking`/`deferred` states and is
  server-computed from server time — the client never does clock math (§4.3).

### 1.3 Execution: claim synchronously, execute in `waitUntil`, poll for the result

**Decision: asynchronous execution behind a synchronous D1 claim — not an in-request
fetch, and not a queued job.**

- The POST handler does only D1 work: eligibility, the 24h test, and the **lease
  claim** (§4.2) — a single conditional update. That is a few milliseconds of D1 time;
  the response returns immediately with `state: "checking"`.
- The fetch + parse + write-back (§2, §3) runs in the same Worker's
  `ctx.waitUntil(...)` (via the OpenNext Cloudflare context the codebase already
  uses), so the work completes after the response without holding the visitor's
  request open. The visitor's client polls the GET (§1.4).
- The existing 15-minute cron (`lib/jobs/scheduled.ts`) gains a **sweeper duty**: reap
  leases whose `lease_expires_at` has passed with no completion (Worker died
  mid-check), recording outcome `error`/`lease_expired` in the log and freeing the
  listing. The sweeper never *starts* checks — it only cleans up — so cron cadence
  never gates a visitor's wait.

Why not the alternatives, from what the codebase actually offers:

- **In-request synchronous fetch** (the farm-summary fetcher's shape, awaited in the
  route): simplest, and the fallback below — but a slow seller site holds the request
  for the full check duration (worst case ~25 s, §1.4), every joining click opens its
  own request doing the same wait, and a client disconnect mid-fetch risks an
  abandoned write. Rejected as the primary path; retained as the fallback.
- **A real job queue**: there is none. Cloudflare Queues is not bound in
  `wrangler.jsonc`; the OpenNext memory queue is ISR-only infrastructure, not an app
  queue; and the `crawl_jobs` lease pattern is drained by an external runner / the
  15-minute cron — a visitor who clicks would wait up to 15 minutes for the drain.
  Adding a Queues binding is new infrastructure for a job whose entire payload is
  "fetch one page", and it still needs the same D1 lease for the 24h rule. Rejected.
- **Fallback (build spike):** if `ctx.waitUntil` is not reachable from the route
  through OpenNext in the deployed shape, the executor runs **inline, awaited,
  before the POST responds**, with the identical claim/parse/write code and the
  identical response contract (the POST simply takes as long as the check, bounded
  by the §1.4 deadline). The contract in §1.2 does not change; only latency does.
  The build must state in its PR which path shipped.

### 1.4 Timing envelope (the honest numbers for Nadia)

Per-check work, from the records: one robots.txt fetch + one product-page fetch,
sequential, plus D1 reads/writes. Fetch timeouts are set **tighter than the crawl's
40 s** because a visitor is waiting: robots 5 s, page 10 s, **one attempt only — no
retries inside a check** (a retry doubles seller load to rescue a result the cache
will simply try for again tomorrow; a failure is a legitimate `couldnt_check`).

| Case | Envelope | Basis |
|---|---|---|
| Cache hit (inside 24h) or join | **< ~300 ms** | One D1 read; inferred from D1 point-read behaviour, not measured |
| Fresh check, typical seller | **2–6 s** | Two fetches at typical small-shop latency + parse + write |
| Fresh check, slow seller / domain pacing wait | **6–15 s** | Page fetch toward its 10 s cap, or waiting out the §5.1 domain interval |
| Fresh check, worst case (hard deadline) | **25 s, then `couldnt_check`** | 5 s robots + 10 s page + ≤5 s pacing wait + D1/parse slack, enforced as one overall deadline in the executor |

**Polling contract:** the client polls GET every **2 seconds**, for at most **30
seconds** (15 polls). Past 30 s the client stops polling and shows the last-known
state with its `checked_at` — the check is *not* cancelled; its result lands in the
cache and the next page view (or next click, which will join/read it) shows it. A
check that exceeds the 25 s executor deadline records `couldnt_check`
(`reason: timeout`) and releases the lease; there is no state in which a listing is
stuck "checking" beyond `lease_expires_at` (10 minutes, §4.2) even if the executor
dies silently — the sweeper guarantees it.

---

## 2. Fetch + parse

### 2.1 The fetch

- **Target: `listings.product_url` only** — the listing's own product page, per the
  standing rule (Crawl Pass 1: "Every listing link is the individual product page —
  no homepages, collections, or search pages"). CSN never fetches a homepage,
  category, collection, search, cart, or feed URL. Where a platform exposes a
  machine form *of that same product page* (§2.2), it is the same target in another
  representation, and it is used only after the build spike verifies it per platform.
- **Identity: the honest bot.** `User-Agent: HuesSeedFinderBot/1.0
  (+https://seeds.hues.flowers/about/bot)` (`BOT_USER_AGENT`, `lib/config.ts`) —
  the same identity the crawl and the farm-summary fetcher use, with its public
  /about/bot page. No UA rotation, no browser impersonation, ever (§5.4).
- **Robots first, every check:** fetch `/robots.txt` for the host, evaluate with
  the existing `robotsAllows()` (`lib/robots.ts`) for our token against the product
  path. Disallowed → outcome `robots_denied`, no page fetch. Robots.txt itself
  unreachable or in error → **treated as disallow** (the Crawl Pass 1 rule: a
  robots server error means no fetch — the conservative reading, kept).
- **Redirects:** follow redirects only within the same registrable domain
  (`sellers.domain`). A redirect that leaves the domain ends the check as
  `couldnt_check` (`reason: cross_domain_redirect`) — the catalog's URL is the
  authority, and following an off-domain hop would break the "we only fetch what
  the catalog names" property in §6.3.
- **Response discipline:** HTML only (`Content-Type` must be html/text, per the
  farm-summary `not_html` classification); body capped at `MAX_PAGE_CHARS`
  (400,000, the farm-summary precedent); non-2xx handled per §5.2/§5.3 (401/403/429
  are block signals; 404/410 are `couldnt_check` with the status logged — §8, Q2).
- One fetch serves every listing that shares the target: listings are keyed
  `(seller_id, product_url, variant_key)`, and curated rows can share one product
  URL across variants. The executor parses once and records a result for **each**
  visible listing on that `(seller_id, product_url)` (§3.2), because a second
  click on a sibling variant an hour later must not re-fetch what this fetch
  already read.

### 2.2 Stock signals — what the crawl machinery already reads

In priority order. The first **decisive** signal wins; §2.3 defines decisive.

1. **Structured product data on the page (JSON-LD `Product.offers.availability`)** —
   the generic crawler's primary signal (`generic.py`): `InStock` → `in_stock`;
   `OutOfStock` / `SoldOut` → `sold_out`; `PreOrder` → `preorder`. Any other
   schema.org value (`LimitedAvailability`, `InStoreOnly`, `OnlineOnly`, …) is
   **not decisive** — it does not map onto the catalog enum, so it is passed over,
   and if nothing else decides, the check is `couldnt_check`.
2. **Platform variant data** (seller's `platform` column routes the parser):
   - **Shopify:** per-variant `available` flags — the crawl's rule
     (`crawl.py crawl_shopify`): `in_stock` iff **any** variant is available, else
     `sold_out`. In the crawl these came from the `/products.json` feed; for CSN
     the same variant structure is read from the product page's own embedded
     product JSON where present. (The single-product `.json` form is a spike item,
     §8 Q7 — the design does not depend on it.)
   - **Squarespace:** the crawl's rule (`crawl.py crawl_squarespace`): item
     `stock.unlimited` → `in_stock`; else `stock.quantity > 0` or any variant
     (`qtyInStock > 0` / `unlimited`) available → `in_stock`; else `sold_out`.
     Source in the crawl was the collection `?format=json`; the product page's
     own JSON form is likewise a spike item.
   - **WooCommerce:** the flags the generic runner already keys on
     (`generic_run.py`): `is_in_stock` true → `in_stock`; else `is_purchasable`
     explicitly false → `sold_out`; if neither flag is present, fall through.
3. **Visible-text sold-out evidence (sold-out direction only):** if no structured
   signal decided, the page's visible text (scripts/styles stripped, the crawl's
   `strip_html` discipline) containing "sold out" or "out of stock" →
   `sold_out`. This is the generic crawler's exact fallback (`generic.py`), and
   its asymmetry is deliberate and kept: **text can prove sold out; text can
   never prove in stock.** The absence of a sold-out phrase is not evidence of
   availability — a page that merely fails to mention stock is `couldnt_check`.
4. **`shop_closed` is never written by CSN v1.** The enum value exists, but the
   records contain no reliable per-product-page signal for "the whole shop is
   closed" as distinct from this product being out of stock, and guessing it
   would hide every listing of a seller on one ambiguous banner. CSN leaves
   `shop_closed` to human/ingest paths (§8, Q10).

Per-variant note: where variant-level signals exist (Shopify), CSN v1 still
writes **listing-level** availability using the crawl's any-variant rule, because
`listings.variant_key` encodes *our* variant split ('' or `variety:<slug>` for
shared URLs, per migration 0002), not the seller's variant ids — there is no
reliable key from a seller variant to our row. The per-size `in_stock` flags on
`listing_packet_sizes` are therefore **not** written by CSN v1 (§8, Q3).

### 2.3 Parse confidence discipline — "couldn't check" is a first-class outcome

Data-quality framing (playbook): for the `availability` field the dimensions that
matter are **accuracy** and **timeliness**. CSN's whole design subordinates
timeliness to accuracy: a stale truth with an honest date beats a fresh guess.

- A signal is **decisive** only if it is (a) machine-readable and unambiguous
  (cases 1–2 above, or the one-directional text rule in case 3), and (b)
  **uncontradicted**: if two decisive-grade signals disagree (e.g. JSON-LD says
  `InStock`, variant data says no variant available), the check is
  `couldnt_check` (`reason: conflicting_signals`). No majority vote, no
  priority override between two decisive signals — priority order in §2.2 only
  decides which signal is *considered first*, and a contradiction voids the check.
- Every confident reading records its **evidence**: the deciding signal's name
  (`jsonld`, `shopify_variant`, `squarespace_stock`, `woo_flags`, `text_soldout`)
  and a verbatim evidence snippet (whitespace-collapsed substring of the fetched
  page, ≤300 chars) in the internal log (§7) — the same evidence discipline the
  ingest API enforces on observations. A reading that cannot produce its snippet
  is not written.
- Everything else is `couldnt_check`: unreadable page, non-HTML, parse failure,
  no decisive signal, conflicting signals, timeout, network error, 404/410.
  `couldnt_check` is recorded (it starts the 24h attempt window, §4.2) and
  **writes no stock state** (§3.3).
- The parser is a pure function `(html, platform, url) → { availability, signal,
  evidence } | { couldnt_check, reason }`, unit-testable against fixture pages
  in the farm-summary/ingest test style — including fixtures for every
  contradiction and ambiguity above. No fixture, no signal: a platform quirk
  enters the parser only with a recorded page shape behind it.

### 2.4 Sellers that are never auto-fetched

- **`crawl_policy = 'manual_only'` or `'opted_out'`:** never fetched — not by
  CSN, not on any click, no exceptions in v1 (there is no admin override,
  §8 Q8). The click returns `not_checkable` / `crawl_policy` immediately, and
  that response is itself cached by the attempt-window machinery only in the
  sense that repeated clicks repeat the same cheap D1 answer — no fetch is
  ever spent. Note the schema default is `manual_only`: a seller whose policy
  was never deliberately set is treated as manual-only, which is the safe
  direction (Crawl Pass 1 found exactly this risk in production data).
  `feed` and `html` policies are both checkable by CSN: the distinction
  governed whole-catalog crawling method; a single product-page read is the
  `html`-shaped act in both cases, and the policy's *consent* meaning (may we
  fetch this seller automatically at all) is what CSN honours.
- **NULL `product_url`:** `not_checkable` / `no_product_page`. This covers the
  curated listings Crawl Pass 1 found with null URLs, and sellers with no
  per-variety product pages at all — **Peace Seedlings** is the named case:
  no web shop exists to check (Blogspot list, mail ordering), so its listings
  are permanently, honestly `not_checkable`, quite apart from its CDN block.
- **Block-listed domains** (§5.3): Park Seed, High Mowing, Gertens listings
  return `blocked` from cache until the domain leaves the list.

---

## 3. Write-back

### 3.1 The sanctioned path

The result reaches the catalog through **one new internal service funnel**,
mirroring the precedent that seller description/location writes funnel through
`services.admin.sellerUpdate` and listing observations funnel through
`upsertObservedListing`:

```
POST route ──► services.stockCheck.requestCheck(listingId, ctx)   (claim + eligibility)
                    │  (executor, waitUntil or inline fallback)
                    ▼
               services.stockCheck.recordResult(listingId, result) ──► repositories/stock-check.ts
                    │                                                     │ atomic() batch
                    ▼                                                     ▼
               revalidate: /variety/<slug>, /seller/<slug>      D1: listings + listing_stock_checks
                                                                    + listing_events + stock_check_log
```

- The route handler **never writes D1 directly** and never calls the fetcher
  itself; it calls the service. The cron sweeper calls the same service. There
  is exactly one code path that can turn a fetched page into a catalog write.
- CSN does **not** write through the ingest observations API: that API is
  key-scoped for external agents, batch-shaped, keyed by (seller, URL, variant),
  and *creates* listings and review items — the wrong tool for a one-listing
  freshness write by our own Worker, and routing a public click through a
  privileged ingest key would widen that key's blast radius for no benefit.
- The write itself uses the codebase's only transaction primitive,
  `atomic(db, ops)` (`lib/repositories/atomic.ts`), with a `nextSeq` bump —
  the same shape as `upsertObservedListing` — so CSN writes participate in the
  catalog sequence / sync machinery exactly like ingest writes, and Quinn's
  seq-windowed audit sees them (§7).

### 3.2 Exactly which fields a check may write

On a **confident reading** (`outcome: ok`), per listing refreshed (§2.1):

| Field | Write |
|---|---|
| `listings.availability` | The parsed value (`in_stock` / `sold_out` / `preorder` only — never `shop_closed`, §2.2) |
| `listings.last_checked_at` | The check's completion timestamp (UTC ISO) — preserving the column's existing semantics: *when stock was last actually observed*, as ingest writes it today |
| `listings.updated_at`, `listings.updated_seq` | Mechanical audit/sequence fields, as every sanctioned write touches them |
| `listing_events` | One appended row **iff** availability transitioned, using the ingest path's own transition logic (`restocked` when returning to `in_stock` from `sold_out`/`preorder`/hidden; `sold_out` when leaving `in_stock`-visible) — reused, not reinvented |
| `listing_stock_checks` (new, §4.1) | `attempted_at`, `outcome='ok'`, `signal`, `http_status`, lease cleared |
| `stock_check_log` (new, §7) | The append-only attempt record |

On **any non-ok outcome** (`couldnt_check`, `blocked`, `robots_denied`,
`deferred`, `error`): only `listing_stock_checks` and `stock_check_log` are
written. Nothing else. (See §3.3.)

**A check may NEVER touch:** any price field anywhere (`listing_packet_sizes.
price_cents`, `price_history` — the parser discards prices it encounters,
§3.4); `listings.product_url`, `title_raw`, `sku`, `status`, `seller_id`,
`variety_id`, `source_id`, `match_method`, `confidence`, `notes`,
`first_seen_at`; `listing_packet_sizes` rows (labels or `in_stock`, §2.2);
any seller or variety field; any other listing's row except siblings sharing
the fetched `(seller_id, product_url)` under §2.1. The build's proof, in the
description-endpoint test style: capture a listing's full record before/after
one ok check and one failed check and diff — the differing fields must be
exactly the tables above.

### 3.3 The couldn't-check rule (the load-bearing rule of this design)

> **A non-result never overwrites a result.** When a check returns
> `couldnt_check` (or `blocked`, `robots_denied`, `error`), the stored
> `listings.availability` and `listings.last_checked_at` remain **byte-identical**
> to what they were before the click. The previously displayed stock stays on
> display, wearing its original checked date, so its staleness is visible
> rather than laundered into freshness.

Rationale, in data-quality terms: `last_checked_at` is the catalog's timeliness
stamp. Writing it on a failed attempt would assert "we looked and this is
current" when in fact we looked and learned nothing — the silent-overwrite
failure mode the playbook names, and the exact lie a freshness feature must
never tell, because (§Governing values) there is no crawl behind CSN to catch
it. The attempt is not hidden — it is fully recorded in
`listing_stock_checks`/`stock_check_log` and surfaced in the API's
`attempted_at`/`outcome` — it simply does not masquerade as an observation.

### 3.4 Price discipline in the parser

Seller pages and feeds are saturated with prices; the crawl captured them into
internal data under the never-display rule. CSN is narrower: **the parser does
not extract, return, log in public payloads, or write any price.** The one
place a price string may appear is inside the ≤300-char internal evidence
snippet in `stock_check_log` when the decisive signal's surrounding text
happens to contain one — internal-only, the same posture as crawl payloads,
and never in the §1.2 response. If the build finds evidence snippets can be
scoped to exclude price-bearing text without weakening the evidence, it should;
the invariant is that no price is ever a *value* CSN handles.

---

## 4. Cache storage + the 24-hour rule

> **RULING NOTE — 2026-11-22 (Dustin, Decision 1; read before §§4.1–4.2, 8, and
> the appendix).** Dustin ruled: "Use Nadia's — after a failed check, the link
> stays available to retry." This adopts Nadia's model over the attempt-keyed
> model this document was reconciled to at Quinn's design gate. The
> freshness/eligibility window therefore keys on the last **successful**
> check: only a successful check starts the 24-hour clock. A failed attempt
> stamps no window and removes no eligibility — after a failure the listing
> is immediately eligible again, subject to the rest of the conjunction.
> Amended SPEC §3.1 states the single governing conjunction (observation
> ≥24h old or absent **and** last successful check ≥24h old or absent **and**
> checkable **and** not block-listed **and** not in flight). Where this
> document's attempt-keyed passages — §§4.1–4.2 (the "`attempted_at` is the
> 24h clock" line, the §4.2 window test, and the "attempt-based, not
> success-based" passage), §8 Q1 (answered by this ruling; its
> confirm-attempt-based recommendation is ruled against), and the appendix
> decision summary's cache row — conflict with this note, **this note and
> SPEC §3.1 govern for the build**; those passages stand unrewritten as the
> record of the superseded reading. The operative translation of this
> document's `state`/`outcome` vocabulary into SPEC's UI states is the build
> brief's UI-state ↔ API-state mapping table (gate amendment A4), not §1.2's
> definitions read alone.

### 4.1 Where the cache lives

One new table, 1:1 with listings (additive migration; design only here):

```sql
-- DESIGN SKETCH — not a migration. Build writes the real one via drizzle-kit.
CREATE TABLE listing_stock_checks (
  listing_id     INTEGER PRIMARY KEY REFERENCES listings(id),
  attempted_at   TEXT,              -- ISO-8601 UTC; last attempt of any outcome; NULL = never
  outcome        TEXT,              -- ok | couldnt_check | blocked | robots_denied
                                    -- | not_checkable | deferred | error
  signal         TEXT,              -- deciding signal name (§2.3) or failure reason class
  http_status    INTEGER,           -- status of the page fetch, when one happened
  state          TEXT NOT NULL DEFAULT 'idle',   -- idle | checking
  lease_expires_at TEXT,            -- ISO-8601 UTC; meaningful only while state='checking'
  updated_at     TEXT NOT NULL
);
```

Design notes:

- **Why not columns on `listings`:** the attempt cache is operational state
  about *our checking*, not a catalog fact about the listing; keeping it in its
  own table keeps `listings` as the catalog record (one fact in one place),
  keeps the §3.2 field-diff proof trivial, and lets the cache be rebuilt or
  dropped without touching catalog rows. The catalog facts a check produces
  (`availability`, `last_checked_at`) live on `listings`, where every existing
  reader already looks. (Additive columns on `listings` would also be within
  Dustin's plumbing authorization; this is a modelling choice, flagged as
  reversible at build time, not a ruling needed from him.)
- `attempted_at` is the 24h clock. `listings.last_checked_at` is **not** used
  for the window: it is the last *observation* (ingest may have set it), and
  conflating the two would let an ingest observation silently extend or reset
  the public's force-check budget. One fact, one field, one meaning.
- The response contract (§1.2) is assembled from `listings` (availability,
  last_checked_at) + `listing_stock_checks` (attempted_at, outcome, state) in
  one service read.

### 4.2 How the endpoint enforces 24 hours

- **Window test (server-side, on every POST):** a check may start iff
  `attempted_at IS NULL OR attempted_at <= now - 24h`. Inside the window, POST
  returns the cached row's outcome/state with `age_seconds` — the click is
  answered, never queued, never fetched. This is Dustin's rule implemented as
  a comparison against a stored timestamp, not as a client hint.
- **Attempt-based, not success-based:** the window keys on the last *attempt*,
  whatever its outcome. A `couldnt_check` therefore also locks the listing for
  24h. This is the literal reading of "force-checked at most once per 24h",
  and it is the seller-protective reading: a domain that is failing or
  flapping cannot be hammered by hopeful re-clicks. The cost — a transient
  blip locks a listing for a day — is accepted and flagged for Dustin's
  confirmation as §8 Q1, because the alternative (success-based) re-opens
  exactly the burst the rule exists to prevent.
- **In-flight lease (one check per listing at a time):** starting a check is a
  single conditional update, executed inside `atomic()`:

  ```sql
  UPDATE listing_stock_checks
     SET state='checking', lease_expires_at = :now + 10 minutes, updated_at = :now
   WHERE listing_id = :id
     AND (state = 'idle' OR lease_expires_at <= :now)          -- free, or lease expired
     AND (attempted_at IS NULL OR attempted_at <= :now - 24h)  -- and window open
  ```

  D1 serializes writes; exactly one competing POST can affect 1 row. A POST
  that affects 0 rows re-reads the row and answers from it: `checking` (join),
  fresh cache, or not-checkable — it never starts a second fetch. (If no cache
  row exists yet, the claim is an `INSERT ... ON CONFLICT DO NOTHING` followed
  by the same conditional update — first-click race handled by the primary
  key.) Lease length 10 minutes is ~24× the 25 s executor deadline: generous
  enough that a live executor is never reaped, short enough that a dead one
  frees the listing the same hour; the §1.3 sweeper clears expired leases and
  logs them as `error`/`lease_expired`, also stamping `attempted_at` (the
  attempt happened; the window applies).
- **Completion:** `recordResult` writes the outcome and `attempted_at = the
  claim time` (not completion time — the budget is spent when the fetch is
  spent), clears the lease (`state='idle'`), in the same `atomic()` batch as
  any §3.2 catalog writes.
- **Joining is free:** any number of visitors may poll a checking listing;
  polls are reads against the status bucket (§6.2) and touch no lease.

### 4.3 Clock source and timezone discipline

- **Single clock: the Worker's `Date.now()` (UTC epoch)** at the moment of the
  claim/comparison. All stored timestamps are ISO-8601 UTC text, the schema's
  existing convention (`nowIso` defaults throughout `lib/db/schema.ts`).
- All window math (24h, lease expiry, pacing intervals, daily budget) is done
  **server-side in epoch milliseconds**. The client receives only derived
  integers (`age_seconds`, `retry_after_seconds`) and display timestamps —
  never a deadline it must compute — so a visitor's device clock, timezone, or
  DST state cannot affect enforcement. (America/Los_Angeles display conversion
  is presentation, via the existing `lib/format.ts` date handling; it is not
  part of this design's enforcement surface.)
- No timestamp in this design is ever stored as a local-time string or a bare
  date; the `price_check_date`-style date-only fields elsewhere in the schema
  are explicitly not the model here.

---

## 5. Pacing + blocks

### 5.1 Per-domain pacing

The crawl's discipline — **≥5 s between requests to the same host, one at a
time per host** — becomes a server-side invariant, because fifty listings of
one seller clicked in the same minute must produce a trickle at that seller's
site, not a burst:

- A second new table (design sketch): `domain_fetch_slots (domain TEXT PRIMARY
  KEY, last_fetch_at TEXT, lease_expires_at TEXT, blocked_until TEXT,
  block_reason TEXT)` — one row per `sellers.domain`.
- Before fetching, the executor must **claim the domain slot**: a conditional
  update succeeding only if `last_fetch_at <= now - 5s` (per *request*: the
  robots fetch and the page fetch each stamp the slot, so the effective gap
  between any two requests to a host is ≥5 s, exactly as the crawl paced) and
  no other executor holds the slot lease (lease 30 s, covering one fetch).
- If the slot cannot be claimed, the executor waits (sleep-and-retry, the
  farm-summary fetcher's shape) for up to ~20 s inside its 25 s deadline. If
  it still cannot claim, it **defers**: releases the listing lease, writes
  log outcome `deferred` (`reason: domain_pacing`), and — critically — does
  **not** stamp `attempted_at`. A deferral spent no fetch, so it must not
  spend the listing's 24h budget; the next click retries. The client sees
  `state: "stale", outcome: "deferred", retry_after_seconds` and can re-click
  shortly after; in practice deferral requires two checks racing for one
  small domain, so this path should be rare and is logged precisely so Quinn
  can see if it is not.
- Per-domain **daily soft cap**: the §7 log gives fetches/domain/day; the
  §6.4 global budget is the hard stop. A domain alert threshold (300
  fetches/day — above any plausible legitimate need given the per-listing
  24h rule and 1,480 listings across 83 sellers) surfaces in Quinn's audit
  rather than silently throttling, because hitting it would mean the pacing
  model itself is wrong and a human should look.

### 5.2 Runtime block detection

The §5.3 seed list is a starting point, not the mechanism — the checking
Worker's egress is Cloudflare's, not this VM's, so blocks must be **detected
at runtime**, per domain, from the fetcher's own experience:

- **Block signals** (any one suffices to mark): HTTP **401, 403, or 429**
  from the product page or robots.txt (the farm-summary fetcher's `blocked`
  class); a **challenge page** — HTTP 200 whose body is a bot-challenge
  interstitial rather than a product page (challenge markers such as a
  Cloudflare "Just a moment" / challenge-platform payload, or a page whose
  parsed title/structure is the challenge instead of the product — the parser
  detects this as its own class, `challenge_page`, distinct from
  `couldnt_check`); **robots refusal at scale** is *not* a block (it is
  `robots_denied`, a policy answer, handled per listing); repeated connection
  resets/TLS failures for a domain (≥3 consecutive checks across listings —
  counted from the log — where other domains succeed).
- **On detection:** write the domain's slot row `blocked_until = now + 7 days`,
  `block_reason` = the signal + HTTP status + timestamp; the triggering check
  completes as outcome `blocked`. Every subsequent check for that domain —
  any listing — short-circuits at eligibility step 6 (§1.1) **without
  fetching**, returning the cached `blocked` outcome. Blocked clicks *do*
  stamp `attempted_at` (the answer is definitive for now; re-clicking must
  not become a probe channel).
- **Backoff is the block itself:** no automatic retry fetches while blocked,
  no exponential-backoff probing from public clicks. After `blocked_until`
  passes, the domain is *eligible* again but the first check for any of its
  listings is a normal check — if it blocks again, it re-blocks for 7 days
  from that detection. There is no path where public traffic generates more
  than one fetch per 7 days to a domain that keeps refusing us.

### 5.3 The starting block list (seed evidence)

Seeded at build time from the sweep evidence, keyed by `sellers.domain`,
`block_reason: seed_evidence_2026_11_22`, `blocked_until` set to a review
date the coordinator chooses at seeding (the evidence is about this VM's
egress, so the seed is a *prior*, not a verdict — see the exit rule):

| Seller | Evidence | Corroboration |
|---|---|---|
| Park Seed | CDN/bot block of this VM's direct fetches (sweep, 2026-11-22); read via crawl route | Sweep only |
| High Mowing Organic Seeds | Same sweep block | **Independent:** Crawl Pass 1 (2026-11-17) — sitemap read, then HTTP 403 on every request, from the crawl host |
| Gertens | Same sweep block | Sweep only |
| Peace Seedlings | Same sweep block | Moot for CSN: no product pages exist → permanently `not_checkable` (§2.4); seed the block anyway so no future product URL is auto-fetched without review |

### 5.4 House rules while blocked (non-negotiable)

**Never circumvent.** No challenge solvers, no captcha services, no proxy or
egress rotation, no UA/header spoofing, no cookie harvesting — the standing
house rules (the same discipline the crawl observed when High Mowing 403'd:
"Recorded as blocked; no circumvention attempted"). A blocked domain is a
seller whose door is closed to our bot; CSN's answer is to stop knocking,
not to find a window.

### 5.5 How a domain leaves the block list

Evidence standard — a domain leaves the list only on **positive, deliberate
evidence**, never on the mere passage of clicks:

1. **A successful probe:** after `blocked_until`, a check (public-triggered
   under §5.2's one-shot rule, or a coordinator-run probe using the same
   fetcher) returns HTTP 200 with a parseable product page **and** a decisive
   signal — one success clears the block and is logged with its evidence.
   (A 200 challenge page is not a success; §5.2's challenge class re-blocks.)
2. **Or seller contact:** the seller confirms in writing (e.g. via the
   /report channel or direct email) that our bot may fetch; a human clears
   the row and the log records who cleared it and on what evidence.
3. Every exit (and re-entry) is a `stock_check_log` / slot-row audit event
   with timestamp and basis — the block list is data with provenance, not a
   config file someone edits silently.

For v1, clearing is an **operations action** (coordinator, via the slot row,
with the probe run through the same service code) — no admin UI is designed
here (§8, Q5).

---

## 6. Cost + abuse guardrails

### 6.1 Worst-case fetches/day math (assumptions labelled)

Measured base: **1,480 listings, 83 sellers** (Quinn audit state, 2026-11-21).

- **Absolute ceiling (ruled by the 24h rule itself):** at most one fetch per
  listing per 24h → ≤ **1,480 product fetches/day**, plus one robots fetch
  per check → ≤ **~2,960 outbound fetches/day** if *every* listing were
  clicked the moment its window opened, every day. Sibling listings sharing a
  product URL (§2.1) and block-listed/manual-only listings only lower this.
  Per-domain pacing (≥5 s between requests) means no single seller can
  receive more than ~17,280 requests/day even in theory — and in practice no
  seller has enough listings to approach it: the largest seller's ceiling is
  its own listing count × 2 requests.
- **Plausible load (inferred):** if 5% of listings receive a stale-window
  click on a busy day → **~75 checks/day ≈ 150 outbound fetches/day**. The
  feature's real traffic will be visible in the §7 log from day one; these
  figures are planning bounds, not forecasts.
- **Money cost: $0 in external services** (no paid APIs, no solver services —
  the crawl precedent spent $0). Marginal platform cost is Worker requests +
  subrequests + D1 writes: each check ≈ 2 outbound subrequests and a handful
  of D1 row writes; at the absolute ceiling that is ~3k subrequests and
  ~15k row-writes/day — far inside the existing Workers/D1 footprint of a
  site already serving the catalog and a 15-minute cron. No new paid
  infrastructure is introduced (no Queues, no KV, no Durable Objects).

### 6.2 Rate limits (reusing the codebase's machinery)

New buckets in the `lib/api/rate-limit.ts` / `wrangler.jsonc` pattern (next
namespace ids after 1204):

| Bucket | Limit | Key | Rationale |
|---|---|---|---|
| `stockcheck` (POST trigger) | **10 / min** | client IP (`cf-connecting-ip`, the `clientKey` precedent) | A human clicks a handful of cards; 10/min is generous for a person and useless for a script — and even a script that maxes it can only *trigger* checks the 24h rule allows |
| `stockcheck-status` (GET poll) | **120 / min** | client IP | Must comfortably serve the §1.4 contract (one poll / 2 s = 30/min per active card, several cards per visitor) without letting polling become a D1 hammer |

Plus the per-listing 24h rule, the per-domain pacing, and the global budget
(§6.4) — four independent layers, of which the IP limits are deliberately the
*least* load-bearing, because IPs are cheap and the other three are not.

**Turnstile: not required in v1, wired behind config** — the reports route's
exact posture ("Turnstile behind config", site key already provisioned in
`wrangler.jsonc` vars). Justification, in the Tranche 3 §11.4 compensating-
controls pattern: the endpoint's effect is bounded (one cached fetch per
listing per day), rate-limited, and kill-switched, so a bot gains nothing a
human doesn't; if the §7 log ever shows trigger abuse, Turnstile can be
required by configuration without a redesign. Flagged for Dustin as §8 Q4 —
it is a security-posture call, and his §11.4 ruling is the precedent either
way.

### 6.3 Why this cannot be turned into a per-click scraper

- **No caller-supplied URL.** The only input is a numeric listing id; the
  fetch target comes from the catalog row. There is no parameter — body,
  query, or header — that influences what is fetched. Aiming CSN at an
  arbitrary site would require first poisoning the catalog itself, which is
  behind the ingest/admin gates, not this endpoint.
- **No content egress.** The response contains only the stock enum, outcome,
  and timestamps (§1.2). Page bodies, evidence snippets, prices, and any
  scraped text never leave the server. A scraper gets one enum per listing
  per day — data the public pages already display.
- **Repetition is free of effect.** Inside 24h, clicks return the cached row
  and generate **zero** fetches (§4.2). Scraping harder literally does less.
- **Pacing caps the blast radius per victim.** Even a coordinated click
  campaign against one seller's listings yields ≥5 s-spaced single fetches,
  indistinguishable in load from the polite crawl the sellers already
  receive — and the domain block machinery (§5.2) stops even that if the
  seller's CDN objects.

### 6.4 Spend cap + kill switches (the build must carry all three)

1. **Global kill switch:** a `STOCK_CHECK_ENABLED` runtime flag (read via
   the `runtimeEnvFrom` pattern, `lib/api/env-config.ts`). Off → POST
   returns last-known state with `outcome: "disabled"`, GET unaffected,
   zero fetches. One config change, no deploy of code, stops the feature
   dead — the first thing to reach for if a seller complains.
2. **Global daily fetch budget:** a counter row (the `catalog_meta` pattern)
   incremented per outbound fetch, capped at **3,000 fetches/day** (just
   above the §6.1 absolute ceiling, so it never binds legitimate use and
   always binds a bug). At cap → same degradation as the kill switch until
   UTC midnight. This is the spend cap: it bounds Worker subrequests and
   D1 writes per day regardless of what any client does.
3. **Per-domain block list** (§5) as the targeted switch: one seller can be
   stopped without stopping the feature.

---

## 7. Observability

### 7.1 The per-check log

One append-only table (design sketch; additive):

```sql
-- DESIGN SKETCH — not a migration.
CREATE TABLE stock_check_log (
  id           INTEGER PRIMARY KEY,
  listing_id   INTEGER NOT NULL,
  seller_id    INTEGER NOT NULL,
  domain       TEXT,
  attempted_at TEXT NOT NULL,        -- ISO-8601 UTC, = claim time
  completed_at TEXT,
  duration_ms  INTEGER,              -- executor wall time; NULL for cache answers
  outcome      TEXT NOT NULL,        -- ok | couldnt_check | blocked | robots_denied
                                     -- | not_checkable | deferred | error | disabled
  signal       TEXT,                 -- deciding signal (§2.3) or failure reason class
  http_status  INTEGER,              -- page fetch status, when a fetch happened
  evidence     TEXT,                 -- ≤300-char verbatim snippet, INTERNAL ONLY (§3.4)
  trigger      TEXT NOT NULL         -- public | sweeper | probe
);
```

Logged for **every** POST that reaches a decision — including cache answers
and eligibility refusals (with `duration_ms` NULL and no fetch fields), so
the log can answer both "what did we fetch" and "what were we asked for".
Cache-answer rows are cheap and are what make abuse visible (§6.2). The
executor additionally emits one structured `console.log` JSON line per
completed check (the `runScheduled` precedent; Worker observability is
already enabled), so live tailing works before anyone queries D1.

**Retention:** at plausible load (~75 checks + poll-free POST answers/day)
the log grows slowly; at the pathological ceiling it could reach ~1,500
rows/day. Prune rows older than **180 days** in the existing cron
(`runScheduled` already prunes sign-in attempts on the same pattern). The
prune is of the *log only* — `listing_stock_checks` (current state) is never
pruned.

### 7.2 What Quinn's daily audit gets

Quinn's audit already works in catalog-seq windows and samples listings
against source pages. CSN adds one standing section to that audit, all
derivable from `stock_check_log` + `listing_stock_checks` + the
`listing_events` CSN writes (which arrive inside the audit's existing seq
windows automatically):

- Checks since last audit, grouped by **outcome** (ok / couldnt_check /
  blocked / robots_denied / not_checkable / deferred / error) — the parse-
  failure rate is `couldnt_check ÷ attempted fetches`, visible per domain
  and per signal.
- **Newly blocked domains** since last audit, with their detection signal —
  and domains whose block expired and re-blocked.
- **Per-domain fetch counts** vs the §5.1 alert threshold.
- Listings whose `attempted_at` is old but `last_checked_at` older still —
  the chronic `couldnt_check` set, which is the fix-list for parser fixtures
  (§2.3) or for a human look at a seller whose pages changed shape.
- A sample cross-check: for a few `ok` checks, Quinn's existing
  sample-against-source method re-reads the product page and confirms the
  written availability — the same verification she already runs on scout
  adds, now covering CSN's writes, because CSN is the freshness system of
  record and its accuracy must be audited, not assumed.

---

## 8. Open questions / risks — with recommendations

**Q1. Does a failed attempt burn the 24h window? — needs Dustin's confirmation
(interpretation of his ruling, not a new ruling).**
Design as written: **yes** — the window keys on attempts (§4.2), the literal
and seller-protective reading of "at most once per 24h". Cost: a transient
failure (seller's site down for an hour) locks that listing for a day.
*Recommendation: confirm attempt-based.* The alternative (retry until success)
re-opens burst pressure on exactly the sellers who are struggling.

**Q2. A product page returns 404/410 — is the listing "gone"?**
Design as written: `couldnt_check` with the status logged; availability
untouched; **never** auto-retired or auto-`gone` on a public-triggered fetch.
A seller restructuring URLs during a sale would otherwise mass-retire live
listings. *Recommendation: keep v1 as designed; add the escalation in data,
not automation* — Quinn's audit (§7.2) surfaces listings with ≥3 consecutive
daily 404 checks (≥3 days, given the 24h rule) as candidates for a human
review item. No decision needed from Dustin unless he wants auto-action,
which I recommend against.

**Q3. Per-variant stock on `listing_packet_sizes.in_stock` — defer?**
*Recommendation: defer past v1* (§2.2 — no reliable key from seller variants
to our rows). Listing-level availability matches how the crawl wrote it and
how cards display it. Revisit only if shop pages start rendering per-size
stock.

**Q4. Turnstile on the trigger — Dustin's call (security posture).**
Design as written: off in v1, behind config, justified by §11.4-style
compensating controls (§6.2). If Dustin prefers the reports-route posture
stricter — Turnstile on from day one — it is a configuration choice in this
design, not a redesign. *Recommendation: ship behind config, off; turn on at
the first sign of trigger abuse in the §7 log.*

**Q5. Blocked-domain clearing: ops-manual in v1, or build an admin probe?**
*Recommendation: ops-manual v1* (§5.5) — blocks should be rare (four seeded,
plus runtime discoveries), and each clearing is an evidence judgment a human
should make anyway. Build the probe into the admin surface only if the
blocked count grows past ~10 domains.

**Q6. Robots.txt is fetched on every check (2 requests per check). Cache it
per domain instead?**
*Recommendation: fetch every time in v1* — it is the conservative reading of
robots compliance (a seller who disallows us today is honoured today), and
at §6.1 volumes the extra request is noise. Revisit with real log data if
seller-load concerns appear; a 24h robots cache aligned to the check window
is the obvious v2 step.

**Q7. Platform single-product machine forms are unverified — build spike
required (gap, not a Dustin question).**
The crawl records prove the *feed* forms and the *HTML* forms, not Shopify
`/products/<handle>.json` or Squarespace product `?format=json`. The build
must verify each against live seller pages before the parser may rely on
it; until verified, the parser's proven paths are JSON-LD + embedded page
data + the text rule (§2.2). If a platform's machine form fails
verification, that platform simply checks via HTML until a fixture-backed
parser lands.

**Q8. No admin force-recheck inside the window in v1 — confirm acceptable.**
Design as written: the 24h rule binds everyone, including admins, so
"at most once per 24h" stays absolute and auditable. A coordinator who
genuinely needs a recheck edits nothing — they wait, or (for a blocked/
broken seller) act on the seller record itself. *Recommendation: keep v1
absolute;* an override is a small later addition if a real case appears,
and adding it later is easier than removing abuse of it.

**Q9. Log retention (180 days) and evidence snippets — confirm.**
*Recommendation: 180-day prune via the existing cron* (§7.1). Evidence
snippets are internal-only by design (§3.4); no public surface ever returns
them. No Dustin decision needed unless he wants a different retention.

**Q10. CSN never writes `shop_closed` — confirm acceptable for v1.**
§2.2: no reliable per-page signal exists in the records. A seller who closes
their whole shop will show per-listing `sold_out`/`couldnt_check` until a
human or ingest path marks `shop_closed`. *Recommendation: accept for v1;*
the §7.2 chronic-failure report is how a closed shop gets noticed.

**Q11. Risk — day-one checkable share may be small.**
Because `crawl_policy` defaults to `manual_only` and Crawl Pass 1 could not
verify production values, CSN may launch with many listings honestly
answering `not_checkable`. That is the policy working as designed, not a
defect — but the *card copy* must not promise a check the policy forbids
(Nadia's surface, fed by the §1.2 `outcome`). If the share is very small,
the fix is a deliberate policy-setting pass over sellers (a data decision
for Dustin/Hue with the terms review behind it), **not** weakening CSN's
policy gate. Flagged so the launch numbers surprise no one.

**Q12. Risk — seller-page shape drift.**
Parsers keyed to page shapes rot silently. The mitigations are designed in:
contradiction → `couldnt_check` (never a guess), the chronic-failure report
(§7.2), fixture-backed parser changes only (§2.3). Residual risk accepted:
some listings will sit at `couldnt_check` until a human looks — which is
the correct failure mode for a system of record.

---

## Appendix — decision summary for the build brief

| Decision | Choice | § |
|---|---|---|
| Execution | Synchronous D1 claim + `waitUntil` executor + GET polling; inline-await fallback if the spike fails | 1.3 |
| Routes | `POST`/`GET /api/v1/listings/:id/stock-check`, public, `writeRouter`, new buckets `stockcheck` 10/min, `stockcheck-status` 120/min | 1.1, 6.2 |
| Timing envelope | Cache <~300 ms · typical check 2–6 s · worst case 25 s deadline · poll 2 s × 30 s | 1.4 |
| Fetch target | `listings.product_url` only; honest bot UA; robots first (error = disallow); same-domain redirects only | 2.1 |
| Signals | JSON-LD offers → platform variant data → text-sold-out (one-directional); contradiction ⇒ `couldnt_check`; never `shop_closed` | 2.2–2.3 |
| Never fetched | `manual_only` / `opted_out` sellers; NULL product URLs; blocked domains | 2.4, 5.3 |
| Write path | `services.stockCheck` funnel → repository → `atomic()` batch + `nextSeq` + `listing_events` on transition + revalidate variety/seller paths | 3.1 |
| May write | `availability`, `last_checked_at` (ok outcomes only), mechanical seq fields, cache + log tables | 3.2 |
| Never writes | Prices anywhere; URL/title/status/links; packet-size rows; a failed check writes **no** stock state | 3.2–3.4 |
| Cache | `listing_stock_checks` (1:1): attempt timestamp is the 24h clock; conditional-update lease, 10-min expiry, cron sweeper | 4 |
| Clock | Worker UTC epoch only; clients get derived seconds, never deadlines | 4.3 |
| Pacing | ≥5 s between any two requests per domain, slot-claimed in D1; deferral does not burn the window | 5.1 |
| Blocks | Runtime detection (401/403/429, challenge page, repeated resets) → 7-day domain block; seed list: Park Seed, High Mowing, Gertens, Peace Seedlings; exit on probe success or seller confirmation, logged; never circumvent | 5.2–5.5 |
| Guardrails | ≤~2,960 fetches/day absolute ceiling; ~150/day plausible; $0 external; kill switch + 3,000/day global budget + per-domain blocks | 6 |
| Observability | `stock_check_log` (append-only, 180-day prune) + structured console line + a standing CSN section in Quinn's daily audit | 7 |

*End of design. No code, migration, or data was changed in producing it.*
