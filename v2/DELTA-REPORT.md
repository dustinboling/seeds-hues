# DELTA-REPORT — seeds-v2-delta (canonical spec fold-in)

Date: 2026-11-16. Spec: `.kiro/specs/seeds-v2-delta/{requirements,design,tasks}.md`, sourced from
`~/workspace/seeds-hues/SPEC-CANONICAL.md` and `DELTA-PLAN-DEC16.md` §(b).
Everything was verified locally only. Nothing was deployed, no remote Cloudflare resource was
touched, no external seller site was fetched, and no email was sent.

## Result

| Finish-line item | Status |
|---|---|
| `npm run verify` (ESLint + `tsc --noEmit` + Vitest) | **Green**: 8 files, 137 tests |
| Fresh local `npm run db:setup:local` | **Green**: 19 crops / 68 varieties / 6 sellers / 17 listings, 17 indexable, catalog_seq 111, snapshot v1 published |
| `npm run cf:build` | **Green** (Next 16.4.6 + OpenNext Cloudflare 1.20.17) |
| OpenNext preview | **Running** on `http://localhost:8787` (`npm run cf:preview`; log in `tmp/preview.log`) |
| `npm run acceptance -- --base http://localhost:8787` | **Green: 92/92 checks**, including the planted evidence-validation tests and the throwaway-seller removal flow |

All 22 tasks in `tasks.md` are checked.

### Resume note

This run resumed after a host SIGTERM. The killed run had finished tasks 1–3 and rewritten
`lib/validators`, `lib/repositories/catalog-read.ts`, `lib/repositories/fts.ts` and
`lib/repositories/events.ts`. I read all four and found them complete and consistent with the
design, so I kept them. Nothing was half-written; the break point was that the service layer and
everything after it still used the old (priced, plural) shapes, which caused about 70 type errors.
I rewrote `lib/services/catalog.ts` first and continued from task 4. Before the fresh setup, the
previous local state was moved (not deleted) to
`/tmp/seeds-v2-wrangler-state-pre-resume-1794843868`.

## What changed

### Routes (R3)

| Public pages (singular) | Notes |
|---|---|
| `/variety`, `/variety/[slug]` | moved from `/varieties`; merged slugs 308 to the survivor |
| `/seller`, `/seller/[slug]` | moved from `/sellers`; removed sellers answer **410** (middleware) |
| `/crop`, `/crop/[slug]` | moved from `/plants`; filters `color_family`, `series`, `has_sellers`; coverage counts + last updated |
| `/series/[slug]` | new |
| `/report` | new: one form, three intents (correct / claim / remove), prefilled from `?type=&seller=&variety=` |
| `/about/data` | new (R14 copy) |
| `/about/bot` | rewritten (bot UA `HuesSeedFinderBot/1.0 (+https://seeds.hues.flowers/about/bot)`) |
| `/go/[id]` | new click redirect (R7) |
| `/categories`, `/categories/[slug]` | removed; 308 to `/crop` |

308 redirects live in `next.config.ts` `redirects()` for all eight plural patterns. `?v=` / `?s=`
now 308 to `/variety/{slug}` / `/seller/{slug}`. Sitemap, llms.txt, robots.txt, header, tab bar,
footer, OG routes (`/og/{variety|seller|crop|site}/…`), manifest shortcuts, metadata builders and
every internal link use the singular scheme. robots.txt disallows `/go/`, `/admin`,
`/api/v1/ingest/`, `/api/v1/admin/` and `/api/internal/`.

| API (`/api/v1`) | |
|---|---|
| `GET /crops`, `/crops/{slug}` | replace `/plants` (no compatibility shim; `/plants` now 404) |
| `GET /varieties/{slug}/listings`, `/sellers/{slug}/listings` | new sub-resources (filters `availability`, `ships_to` / `crop`) |
| `GET /series/{slug}`, `/coverage`, `/recent` | new |
| `GET /search` | mixed results `{varieties, series, crops, sellers}` + flat `results`; `type` and `limit` params; logs `search_events` |
| `GET /sync/snapshot`, `/sync/changes?since=` | new (R9) |
| `POST /reports` | new (R8) |
| `/ingest/*` | `jobs/lease`, `jobs/{id}/complete`, `jobs/{id}/fail`, `sources`, `observations`, `seller-candidates`, `match-context` |
| `/admin/*` | `review`, `review/{id}/approve\|reject\|merge`, `sellers/{id}/approve\|reject\|remove`, `stats/demand`, `health`, `rollup`, `jobs` |
| `catalog/version`, `catalog/snapshot/{v}.sqlite` | untouched |

The envelope is now `{data, page: {next_cursor, has_more}, meta: {…, catalog_seq, generated_at}, error}`.
Sorts are `name`, `recently_checked` and `listing_count`, with `-` for descending. The price sorts
are gone. The limit cap is 100. Variety filters: `crop` (alias `plant`), `series`, `color_family`,
`pollination`, `has_listings`, `in_stock`, plus the existing `category`, `subcategory`, `seller`
and `tag`, with comma lists.

### Schema (task 1, done before the resume)

Migration `0002_delta.sql` and `lib/db/schema.ts` add `series`, `listing_events`,
`click_events`, `search_events`, `variety_view_counts`, `daily_stats`, `blocked_domains`,
`reports`, `seller_claims`, `api_keys`, `fetch_sources`, `observations`, `review_items`,
`crawl_jobs`, `agent_runs`, `ingest_idempotency` and `catalog_meta` (the `catalog_seq` counter).
They extend `sellers` (eligibility, approval fields, domain, crawl_policy, claim_status,
country/region/ships_to, is_site_owner, contact_email, updated_seq, deleted_at), `varieties`
(series_id, color_family, pollination, days_to_bloom, merged_into_id, status `merged`, seq,
tombstone), `listings` (availability, variant_key, channel, match_method, confidence,
source_url, first_seen_at, last_checked_at, seq, tombstone, new statuses, and the unique key
(seller, product_url, variant_key)), `plants` (seq, tombstone) and `variety_aliases`
(name_normalized, kind). The FTS triggers are rebuilt with stable rowids. This resume adds no
schema changes.

### Data (R2)

`seed-data/catalog.json` and `build-catalog.py` are untouched: 19/68/6/17, Dearest series. The
importer maps the approval fields and replaces the catalog in full (re-runs converge).
Availability and last_checked_at come only from sourced packet data:

- Songbird × King's Ransom: `in_stock`, last checked 2026-11-15.
- Songbird × Emma: `sold_out`.
- Floret × Dawn Creek Pastels: `unknown`.

Under R5, 17 varieties are indexable and 51 are `noindex, follow`.

### Behaviour, by requirement

- **R1, prices.** No price exists in any page, JSON-LD block, public serializer or Zod output
  schema. `PriceDisplay`, `ListingCard` and the price formatters are deleted, and packet display
  shows labels and seed counts only. Storage and `price_history` are unchanged. A guardrail test
  scans every runtime file outside the storage layer for price fields.
- **R4, structured data.**
  - Home: WebSite + Organization (Hues Floral Park).
  - Crop and series: ItemList.
  - Seller: Organization + ItemList.
  - Variety: BreadcrumbList + ItemList of sellers.

  The guard now also rejects Product, AggregateOffer, Offer, offers and price keys.
- **R6, variety page.**
  - An answer sentence built from data ("As of 2026-11-15, 1 small farm lists King's Ransom:
    Songbird Seed Co."), or "No small farm found selling … yet" when there are no sellers.
  - Facts print "Unknown" (colour family, pollination, height, days to bloom).
  - Each listing row shows seller link, region, stock label, "Last checked {date}", a source link
    (or the curated source label when no URL exists) and a Shop button to `/go/{id}` with
    `rel="nofollow noopener"`. In-stock listings sort first.
  - The page also shows "Not yet rated", "Also sold as", a report link and a view beacon.
- **R7, `/go`.** Writes a `click_events` row (page_type from Referer, referrer_host, client from
  `X-Client` or the UA family, salted daily visitor hash, is_bot heuristic). The IP is never
  stored. Then it answers 302 with UTM tags, keeping any existing query string and never
  overwriting an existing `utm_source`. `no-store`. 404 for unknown or unpublished listings, 410
  when the seller was removed.
- **R8, reports and removal.**
  - Every report writes a `reports` row plus a `review_items` row (`removal` or
    `seller_correction`).
  - Turnstile is verified only when `TURNSTILE_SECRET_KEY` is set; otherwise the row is stored
    with `turnstile = "not_configured"`.
  - Admin removal sets the seller to `removed_by_request`, sets every listing to `removed`
    (writing `gone` events), blocks the domain, recomputes R5 and revalidates the affected pages.
    The seller page, seller API and `/go` then answer 410, and the seller is excluded from lists,
    search, sitemap and sync.
- **R9, sync.** The snapshot follows the spec shape, and its ETag is `"seq-{catalog_seq}"`
  (checked before building). Changes are driven by `updated_seq`. Hidden, merged and removed rows
  become tombstones; a merge names its survivor (`merged_into`). A page never splits one sequence
  number. `since` > catalog_seq gives 400 `invalid_since`; `since` < 0 gives 410
  `resync_required`. Errors are problem+json.
- **R10, ingest.** Validation runs in the canonical order: schema → seller/eligibility/crawl
  policy → domain/blocked → source age → evidence verbatim in the R2 snapshot → upsert key. Only
  an exact or synonym match whose extracted name normalizes to a known name, on a seed product
  from an approved seller, publishes; model matches, mismatches and new names go to the queue.
  Every ingest POST honours `Idempotency-Key`, and sources are idempotent on (url, content_hash).
- **R11, admin.**
  - Approve applies the proposal: listing_match publishes and saves a seller_alias;
    new_variety creates the variety and its listing; seller_candidate creates a `candidate`
    seller; seller_correction applies fields; removal runs R8.
  - Merge sets the loser to `merged` + `merged_into_id` and moves its names and listings.
  - Health reports invariant violations (listing from an unapproved seller, off-domain URL,
    blocked domain), queue depth with the oldest item, and job stats.
  - Rollup writes `daily_stats` (non-bot clicks; idempotent per day).
- **R12, search.** Any query of 2 or more characters searches, through an exact tier, a prefix
  tier (which also serves 2-character queries) and an FTS tier, over primary names and aliases.
  Alias hits carry `matchedAlias`, and the UI shows "also sold as". Varieties with listings come
  first on ties. Zero results show "Not in the catalog yet" with a report link. Page and API
  searches write `search_events`.
- **R13, rate limits.** Public 120/min/IP (unchanged), search 60/min/IP, reports 3/min/IP, ingest
  600/min/key. New Workers rate-limit bindings `SEARCH_RATE_LIMITER`, `REPORTS_RATE_LIMITER` and
  `INGEST_RATE_LIMITER` were added to `wrangler.jsonc` (namespace ids 1202–1204), with the
  per-isolate token bucket as fallback.
- **D5, auth.** `lib/services/auth.ts` (WebCrypto SHA-256) handles hashed, scoped, revocable
  keys and stamps `last_used_at`. `scripts/create-api-key.ts` mints keys (the token prints once)
  and revokes them with `--revoke <id>`. `scripts/rollup.ts` runs the rollup.

## vinext check (R15)

Hue ran `npx vinext check` before this run (output in `vinext-check.log`):
**94% compatible: 15 supported, 2 partial, 0 issues.**

- Imports 5/5 supported: next/link, next/cache, next/navigation, next/script, next/og.
- Libraries 2/2 compatible: tailwindcss, zod.
- Config 2/4 fully supported. The two partials:
  - `typedRoutes`: typed Link hrefs are not generated.
  - `reactStrictMode`: the App Router is not wrapped.

**The adapter was not switched. OpenNext stays through launch.**

That check scanned the tree as it was before this delta (16 pages, 17 route handlers). The delta
adds `middleware.ts`, a `redirects()` block in `next.config.ts`, 4 pages and about 15 route
handlers. They were not re-scanned, because the task said to record Hue's result rather than
re-run it.

## Verification, item by item

| Item | How verified | Result |
|---|---|---|
| Migration 0002 applies from empty | `wrangler d1 migrations apply` (fresh state; every test suite does it on a throwaway D1) | pass |
| Import converges 19/68/6/17; spot checks | `db:setup:local` output; `tests/integration/data.test.ts` (incl. re-import after a mutation) | pass |
| R1 price absence | guardrail scan; service-output key scan; acceptance: 109 crawled pages with no price text, 218 API/sync/JSON-LD documents with no price keys; price sorts → 400 | pass |
| R3 singular routes + 308s | acceptance: 17 singular 200s, 10 single-hop 308s, 2 legacy chains | pass |
| R4 JSON-LD | `tests/unit/seo.test.ts`; acceptance: page-type → JSON-LD types, no Product family on any page | pass |
| R5 index rule | unit + integration (17/51); acceptance: robots meta on all 68 pages and sitemap membership | pass |
| R6 variety page | acceptance: King's Ransom row fields, Unknown facts, zero-seller sentence, Emma / Dawn Creek labels | pass |
| R7 /go | integration + contract (`/go` route handler); acceptance: 302 + UTM + no-store, query preserved, click counted in demand stats, 404 / 410 | pass |
| R8 reports + removal | integration (full flow, Turnstile on/off with stubbed siteverify); acceptance: report → queue → approve → page 410, API 410, `/go` 410, excluded from lists/variety/search/sitemap/sync, blocked domain refused, reports 429 | pass |
| R9 sync | integration (paging walk, tombstones incl. `merged_into`); contract + acceptance (shape, ETag = seq, 304, 400, 410) | pass |
| R10 ingest, **planted evidence tests** | integration on its own D1+R2, and acceptance over HTTP on the preview: **a fabricated quote is rejected with `evidence_not_found`**; **a genuine quote from the stored snapshot publishes on an exact match**; **a model match queues**; plus off-domain, manual_only, opted_out, stale source, unapproved seller, schema violations, idempotent replay | pass |
| R11 admin | integration (approve, merge, health, rollup, jobs lease/complete/fail/expiry); acceptance (health, demand, rollup, review list) | pass |
| R12 search | integration (2-char, alias flag, ranking, logging); acceptance (`ka`, mixed types, zero-result page) | pass |
| R13 envelope / rate limits | contract (envelope, ETag, sorts, filters, all four limits); acceptance (envelope, cap, 120/min burst) | pass |
| R14 copy | acceptance: /about/data and /about/bot phrases; seller claim/correct/remove link on all 6 seller pages; crop coverage on all 19 crop pages | pass |
| Auth | contract + acceptance: 401 / 403 / 200, problem+json, no-store; minted keys revoked at the end of the run | pass |
| Build | `npm run cf:build` | pass |
| Server errors during acceptance | `tmp/preview.log` (about 300 requests) | none |

## Divergences and fallbacks

These are deliberate choices or gaps. Each one is stated so it can be changed.

1. **The 410 for removed sellers comes from `middleware.ts`, and it works under the local
   preview.** No `notFound()` fallback was needed. The middleware asks
   `/api/internal/seller-status/{slug}` through the `WORKER_SELF_REFERENCE` binding (falling back
   to a same-origin fetch) and answers 410 for `gone`. Next 16 warns that the `middleware` file
   name is deprecated in favour of `proxy`. I kept `middleware` because design D4 names it and
   because I did not verify that `proxy.ts` (Node runtime) works under OpenNext 1.20. Each
   `/seller/{slug}` request now costs one extra internal subrequest.
2. **Field casing is mixed.** Entity fields that already existed stay camelCase (additive change
   within v1). New objects and endpoints use the spec's snake_case: `rating`, `provenance`,
   `facts`, `page`, `meta.catalog_seq`, coverage, sync and all ingest/admin bodies. The canonical
   spec says snake_case throughout; converting the old fields would be a breaking v1 change.
3. **Public read paths accept slugs only.** The canonical spec says "slug or ID". Admin and ingest
   accept both.
4. **Read caching keeps the old headers.** Reads still send
   `public, max-age=300, stale-while-revalidate=86400` and a content-hash ETag that covers
   `catalog_seq` (`generated_at` is excluded so 304s work). The canonical spec uses
   `max-age=60, s-maxage=300` and an ETag derived purely from `catalog_seq`. Only
   `/sync/snapshot` follows the spec exactly (`"seq-N"`, canonical Cache-Control). R13 did not ask
   for a caching change.
5. **`/sync/changes` answers 410 only for `since` < 0.** No change log is pruned yet, so the
   90-day retention window does not exist. Changes also add an `upserts.names` array for changed
   varieties. The snapshot has no separate `species` array, because v2's crop is the species.
6. **Ingest validation details.**
   - The evidence check is verbatim after collapsing whitespace on both sides.
   - Step 4 also requires the source's HTTP status to be 200 ("URLs are never constructed; a URL
     must be one the fetcher retrieved with a 200").
   - When the source row is missing and the seller is `manual_only`, step 2 rejects with
     `crawl_manual_only` before step 4 can say `source_not_found`, because the source kind cannot
     be proven to be `human`.
   - `POST /ingest/sources` refuses `robots_allowed: false` for `web` fetches and refuses blocked
     domains (parent domains included).
7. **Extras not in the spec.**
   - `POST /api/v1/admin/jobs` enqueues crawl jobs. Without it nothing can create a job to lease.
   - `GET /api/internal/seller-status/{slug}` supports item 1.
   - `create-api-key.ts --revoke`, because keys must be revocable.
   - npm scripts `api-key:create` and `rollup`.
8. **Search events are not rolled up.** `daily_stats` has no search columns in the canonical
   table, so rollup covers clicks only. The demand dashboard reads `search_events` directly.
9. **Claims are not verified by email.** No email may be sent in this delta, and `seller_claims`
   stays empty. A claim becomes a `seller_correction` queue item that a person handles. A
   correction report about a *variety* is resolved by hand on approve; only seller fields are
   applied automatically.
10. **Rejecting a seller sets its listings to `rejected`.** The spec only says to change
    eligibility; this keeps the health invariant "no published listing from an unapproved
    seller" true.
11. **Configuration needed before any deploy, not done here.**
    - Set `CLICK_HASH_SALT` as a secret. Locally a fixed dev salt is used.
    - Optionally set `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Unset locally,
      so reports are marked `not_configured`.
    - The three new rate-limit bindings ship in `wrangler.jsonc`.
12. **Acceptance leaves operational rows in local D1.** Each run adds a removed throwaway seller
    on `throwaway-<run>.example`, its blocked domain, reports, review items, click, search and
    view events, and revoked keys. `db:setup:local` replaces the catalog tables but keeps these
    FK-free event and ops tables by design (D2), so they accumulate. They never touch real seller
    domains.
13. **Search tie-break granularity.** The "has listings first on ties" rule applies within each
    tier (exact / prefix / full text), not across tiers.
14. **README.** The runbook sections that described prices, plural URLs, SQL-based removal and
    `outbound_clicks` were updated to match.
