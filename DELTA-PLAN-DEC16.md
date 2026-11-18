# DELTA-PLAN-DEC16 — folding the canonical spec into the v2 build

Written 2026-11-16, the day Dustin adopted `SPEC-CANONICAL.md` (the Nov 16, 2026
"Seed Finder: product, API and data spec"). Launch target: **Dec 16, 2026**.
Status key: **BUILT** = in the current v2 and conforming · **PARTIAL** = present but
diverges from the spec · **MISSING** = not in v2 · **DELTA** = changed by the delta
build that accompanies this plan (`.kiro/specs/seeds-v2-delta/`).

Head start vs the spec's assumptions: the spec's open question 2 assumed "a preview
Worker and no seed database yet." In fact v2 is fully built and locally verified
(89 unit/contract tests, 60/60 HTTP acceptance), and both D1 databases already exist
(`seeds-hues` dcc6098e-e48c-4906-ac79-72cc77e04042, `seeds-hues-tag-cache`
01f11aba-a83b-4cdf-86c5-b5c6cab89611). Week 1 therefore starts at the spec's Week 1
exit test, not at zero.

---

## (a) Requirement-by-requirement map: canonical spec vs v2 build state

### §1 Product

| Spec requirement | State | Notes |
|---|---|---|
| Read-only directory, sells nothing, no checkout | BUILT | Guardrail tests assert no checkout code |
| ~30 crops at launch | PARTIAL | 19 crops (plants) in seed data; crop growth is data work (Weeks 2–4), driven by approved sellers' catalogs per spec ordering rule |
| Every fact carries source + date, shown on the page | PARTIAL → DELTA | Listings show source + check date after delta (availability + last_checked_at become first-class); variety facts keep source labels |
| "Unknown" printed for unknown facts | PARTIAL → DELTA | Variety facts block renders Unknown for missing values; unknown enums default `'unknown'` in new columns |
| Small farms only; a human approves every seller | BUILT (policy) / DELTA (data) | Seed data cut to the 6 owner-approved exemplars (decision 25); eligibility machinery added |
| Farm gets the sale; outbound click in one tap | PARTIAL → DELTA | Was direct hrefs + beacon; delta adds `/go/{id}` 302 + UTM + click_events |
| Claim / correct / remove; removal ≤ 48 h, 410, domain blocked | MISSING → DELTA | `/report` page, `POST /reports`, admin remove action, `blocked_domains`, seller page 410 |
| "Not yet rated" everywhere; no review submission Phase 1 | BUILT | Stored-state semantics kept (rating CHECK: average NULL while count = 0) |
| Public read API on `/api/v1`; one backend | BUILT | Service↔API parity contract tests |
| Installable PWA; last pages open offline | BUILT (code) | Browser behaviour still UNMEASURED (no browser on this VM) — carries to Week 4 hardening |
| Search by any name incl. synonyms; 2 chars; "also sold as" | PARTIAL → DELTA | FTS5 trigram + <3-char prefix fallback existed; delta lowers threshold to 2 chars, wires aliases into results with an "also sold as" flag |
| Zero-result search: "Not in the catalog yet" + report link; queries logged | MISSING → DELTA | `search_events` table + logging + zero state |
| Crop page: filters (color family, series, has sellers), coverage counts, last-updated | PARTIAL → DELTA | Plant pages existed without filters/counts; delta adds filters + counts on `/crop/<slug>` |
| Series hub pages | MISSING → DELTA (thin) | `series` table + `/series/<slug>`; only the "Dearest" series is sourced in current data — coverage grows with ingestion |
| Demand signals: clicks, zero-result searches, zero-seller views | PARTIAL → DELTA | `outbound_clicks` existed; delta adds spec-shaped `click_events`, `search_events`, `variety_view_counts`, nightly rollup to `daily_stats`, admin demand endpoint. Dashboard UI polish deferred (spec cut list #7) |
| Launch gates (§1 metrics table) | NOT DUE | Measured at launch; match-accuracy audit is a Week 4 human task |

### §2 Data model

| Spec requirement | State | Notes |
|---|---|---|
| Prefixed ULID text IDs (`var_`, `sel_`, `lst_`) | DIVERGENT (accepted) | v2 uses integer PKs + slugs as the only public identifiers. Slugs already satisfy "IDs never appear in public URLs"; `/go/{listing_id}` uses the integer id. A ULID re-platform is a breaking internal change with no launch-visible benefit — recorded as a deliberate divergence, revisit at the Postgres move |
| ISO-8601 UTC text timestamps; enums as text + CHECK; JSON as validated text | BUILT | House style already |
| Unknown explicit: enums default `'unknown'`, numbers NULL, tri-state yes/no | PARTIAL → DELTA | New columns follow it; legacy `in_stock` is already tri-state (true/false/NULL) |
| `updated_seq` global counter + `deleted_at` tombstones on catalog tables | MISSING → DELTA | Added to plants/varieties/sellers/listings/series; drives `/sync/changes` |
| crops / species / series / breeders tables | PARTIAL | `plants` ≈ crops; `subcategories` are life-cycle groups, NOT series. Delta adds a real `series` table. `species` and `breeders` tables NOT added in the delta — species lives in `plants.latin_name`, breeder attribution lives in variety descriptions; both are Phase 1.5 schema work (nothing in Phase 1 reads them) |
| `variety_names` (synonyms, normalized, unique within crop) | PARTIAL | `variety_aliases` exists (empty — no sourced alias data yet); delta wires it into search + sync `names`. Normalization/uniqueness enforced in the ingest path, not yet by DB constraint |
| listings: availability enum, variant_key, provenance NOT NULL, first/last checked | PARTIAL → DELTA | Adds `availability` (in_stock/sold_out/preorder/shop_closed/unknown), `variant_key`, `external_product_id`, `title_raw`, `first_seen_at`, `last_checked_at`, `channel`; provenance already NOT NULL via source_id |
| Prices stored, integer minor + currency, NOT exposed in v1 | PARTIAL → DELTA | Storage already conforming (cents + provenance CHECK); delta removes prices from every page and public API payload |
| `listing_events` append-only log | MISSING → DELTA | Table + writes on import (first_seen) and ingest-driven state changes |
| `sources` = one row per fetch (hash, snapshot, robots) | DIVERGENT → DELTA | v2 `sources` are curated provenance labels and stay. Delta adds `fetch_sources` for ingest fetches (url, fetched_at, http_status, content_hash, snapshot_key in R2, robots_allowed, kind) — same semantics, separate table to avoid breaking the curated catalog |
| `observations` with evidence quotes; agents never write catalog tables | MISSING → DELTA | Table + ingest endpoint + server-side evidence validation |
| `review_items` queue grouped by normalized name | PARTIAL → DELTA | `match_queue` existed for imports; delta adds spec-shaped `review_items` for ingest/admin flow |
| `crawl_jobs` with leases; `agent_runs` with cost | MISSING → DELTA | Tables + lease/complete/fail endpoints; `agent_runs` records model/prompt/tokens/cost (cap enforcement is ingester-side, Week 2) |
| `blocked_domains` | MISSING → DELTA | Table + publish-function enforcement + removal flow writes |
| `assets` with licence on every row | PARTIAL | `media` table (r2_key, licence, credit) ships empty — equivalent for Phase 1 (no photos at launch) |
| `seller_claims`, `reports` | MISSING → DELTA | Tables + flows (claim verification email itself is Week 3; the form + queue land now) |
| `reviews` / `rating_summaries` ship empty; average impossible below 3 reviews | PARTIAL | v2 keeps ratings on the variety/seller rows with the NULL-while-unrated CHECK; the spec's ≥3-reviews rule is stricter than v2's ≥1 — noted divergence, tighten when review submission ships (Phase 2) |
| `api_keys` hashed + scopes + last_used_at | MISSING → DELTA | Table + minting script + scope checks on ingest/admin routes |
| `slug_redirects` | PARTIAL | Route-level 308 redirects cover the URL migration; a redirects table lands with the first rename/merge workflow (review queue merge action writes catalog state, redirect rows are Phase 1.5) |
| Publish function invariants (approved seller, on-domain URL, domain not blocked) + nightly re-check | PARTIAL → DELTA | Import assertions cover the seed path; delta adds the same checks to the ingest publish path + an admin health endpoint reporting invariant violations |
| Seller approval semantics: approved_at + terms_reviewed_at | DELTA (honest-unknown) | Exemplars carry `approved_at = 2026-11-15` (the date the owner named them — documented fact) and `terms_reviewed_at = NULL` (not yet done; Week 1 task). The spec's CHECK (approved ⇒ terms reviewed) is therefore deliberately NOT enforced in the delta schema |

### §3 API

| Spec requirement | State | Notes |
|---|---|---|
| Envelope `{data, page, meta}` with `catalog_seq` | PARTIAL → DELTA | v2 envelope is `{data, meta, error}` with cursor inside meta; delta adds `page {next_cursor, has_more}` and `meta.catalog_seq` |
| Errors as `application/problem+json` with stable `code` | PARTIAL | v2 returns a JSON error envelope, not problem+json. Delta adopts problem+json for the NEW endpoints (ingest/admin/reports/sync); public read endpoints keep the existing envelope (contract-tested) — full migration is additive-safe later. Recorded divergence |
| Public reads: /crops, /crops/{crop}, /varieties, /varieties/{v}, /varieties/{v}/listings, /series/{s}, /sellers, /sellers/{s}, /sellers/{s}/listings, /search, /coverage, /recent | PARTIAL → DELTA | varieties/sellers/search existed; delta adds crops naming (was /plants), per-variety and per-seller listings, series, coverage, recent |
| Unknown never omitted; every listing carries provenance; variety/seller carry rating | PARTIAL → DELTA | Delta response shapes add `provenance` + `rating` objects and explicit `"unknown"`/null |
| Pagination cursor, max limit 100; filters exact-match; sort name/recently_checked/listing_count | PARTIAL → DELTA | Cursor existed (limit cap aligned to 100); price sort REMOVED (prices unexposed); spec sorts added |
| Search ranking: exact → prefix → full text; listings first on ties | PARTIAL | FTS ranking approximates this; delta adds the has-listings tiebreak |
| Versioning: additive-only in v1, `X-Client` honoured | BUILT/PARTIAL | API never deployed publicly, so delta renames are pre-launch, not breaking |
| Caching: ETag from catalog_seq, 304, public cache headers | BUILT | ETag existed; delta derives it from catalog_seq |
| Auth scopes: public / ingest / admin | MISSING → DELTA | Bearer keys (hashed) for ingest + admin; /reports public + Turnstile-ready |
| Rate limits per spec table | PARTIAL | 120/min public existed; delta adds search 60/min, reports 3/min, ingest 600/min (Workers binding + fallback) |
| Ingest endpoints (lease/complete/fail, sources, observations ≤100, seller-candidates, match-context) + Idempotency-Key | MISSING → DELTA | Built in the delta; ingester CLI itself is Week 1–2 work |
| Admin endpoints (review queue, seller approve/reject/remove, demand stats, health) | MISSING → DELTA | Built in the delta (API only; queue UI is Week 2) |
| `/go/{listing_id}`: log click, 302, UTM, preserve existing query | MISSING → DELTA | Built in the delta |
| `/sync/snapshot` JSON + `/sync/changes?since={seq}` with tombstones; 410 `resync_required` | MISSING → DELTA | Built in the delta, driven by `updated_seq`. The pre-existing `catalog/version` + `.sqlite` snapshot endpoints are KEPT (harmless; the .sqlite file remains the Phase 2 native replica vehicle per the earlier local-first ruling) — the JSON sync is the spec'd contract and the one the PWA uses |

### §4 Ingestion

| Spec requirement | State | Notes |
|---|---|---|
| Agents propose, server decides; only exact/synonym matches on approved sellers auto-publish | DELTA (server side) | Validation order implemented server-side exactly as spec §4: schema → seller/crawl-policy → on-domain + not blocked → source ≤ 7 days → evidence quotes found verbatim in snapshot → upsert by (seller, URL, variant) |
| Bot identity `HuesSeedFinderBot/1.0 (+…/about/bot)` | DELTA (page) | /about/bot updated with the exact UA string; the fetcher itself is the Week 1–2 CLI |
| Fetch rules (robots, 5 s/host, conditional requests, Shopify /products.json first) | WEEK 1–2 | Ingester CLI work; no crawls run in the delta |
| Extraction schema `listing_observation/1` with evidence per value | DELTA | Accepted and validated by the ingest endpoint |
| Matching + dedupe; seller_alias learning | PARTIAL | Exact/synonym auto-publish + review queue built; model-match step belongs to the CLI/agent side (Week 2) |
| Re-crawl/staleness cadence | WEEK 2 | Jobs can be enqueued/leased now; scheduling policy lands with the CLI |
| Monitoring: daily digest, alerts, $150 cap, weekly 50-listing audit | WEEK 4 | `agent_runs` cost recording lands now; digest/alerts are hardening week; the audit is a human process |

### §5 Architecture

| Spec requirement | State | Notes |
|---|---|---|
| One Worker (Next.js), D1 catalog, FTS in second D1, R2 files, CLI ingester, /admin in same Worker | PARTIAL | Matches, except FTS currently lives in the catalog DB (v2 decision, with a documented drop-and-rebuild-around-export procedure). Moving FTS to the tag-cache DB is NOT in the delta — recorded divergence; the export caveat is handled procedurally until the Postgres move |
| Workers Paid from day one ($5/mo) | OWNER ACTION | Dashboard activation at deploy time — see (e) |
| Adapter: run `npx vinext check`; stay on OpenNext if it works | DELTA (check only) | Check run and recorded; NO switch — OpenNext stays through launch per the spec's own fallback rule |
| Postgres migration path (service layer only, Hyperdrive later) | BUILT | Repository pattern already enforces it |
| SEO: SSR everywhere; index rule ≥1 listing OR ≥150 words own notes; canonicals; 301s; 410 on removed sellers; sitemap indexable-only with lastmod | PARTIAL → DELTA | Index rule REPLACED (was ≥1 listing OR ≥3 sourced facts); removed-seller 410 added; sitemap/llms.txt move to singular URLs |
| Structured data per spec table; NO Product markup in Phase 1 | PARTIAL → DELTA | Product/AggregateOffer/Offer JSON-LD REMOVED; variety pages get BreadcrumbList + ItemList of sellers; crop/series ItemList; seller Organization + ItemList; home WebSite + Organization |
| GEO: answer sentence on variety pages, llms.txt, OpenAPI at stable URL, robots allows AI crawlers + disallows /go/, /admin, ingest/admin API | PARTIAL → DELTA | Answer sentence + robots changes in delta; markdown alternates are cut-list #3 (deferred) |
| PWA budgets (LCP 2.5 s, 150 KB JS on variety page) | UNMEASURED | No browser available; Week 4 measurement task |
| Outbound tracking: no cookies, no stored IPs, daily-rotating salted visitor hash, bots flagged, nightly rollup, 13-month prune | DELTA | click_events built to this shape; prune job is a Week 4 cron note |
| Environments: preview Worker becomes staging; migrations in CI before deploy | PARTIAL | Preview Worker exists (v1); staging DB separation + CI are Week 1 ops work |

### §6/§7 Plan + roadmap
Covered in (c) below. Phase gates unchanged: Phase 1.5 after launch, native apps
no earlier than Mar 16, 2027 (spec decision 14 supersedes the earlier "apps
immediately after website" ruling), marketplace after Postgres.

---

## (b) Delta task list (implemented by the accompanying Kiro build)

1. **Data**: seed dataset cut to 6 exemplar sellers / 17 listings (varieties stay 68);
   seller approval fields added honestly (approved_at 2026-11-15, terms_reviewed_at
   NULL); Dearest series tagged. *(Done by Hue in build-catalog.py before the Kiro run.)*
2. **Schema migration 0002**: series table; sellers +eligibility/approved_at/
   terms_reviewed_at/approval_note/domain/crawl_policy/claim_status/country/region/
   ships_to/is_site_owner; listings +availability/variant_key/external_product_id/
   title_raw/channel/first_seen_at/last_checked_at; updated_seq + deleted_at on
   catalog tables + seq counter; listing_events; click_events; search_events;
   variety_view_counts; daily_stats; blocked_domains; reports; seller_claims;
   api_keys; fetch_sources; observations; review_items; crawl_jobs; agent_runs.
   Importer extended for the new catalog.json fields; availability + last_checked_at
   derived from sourced packet data (never invented).
3. **Prices hidden**: no price in any page, JSON-LD, or public API payload; price
   sort removed; storage + price_history untouched.
4. **Singular URLs**: /variety, /seller, /crop, /series (+ index pages); 308s from
   /varieties, /sellers, /plants, /categories (incl. detail slugs); sitemap, llms.txt,
   robots, internal links, tab bar, OG routes updated; ?v=/?s= legacy 308s retargeted.
5. **JSON-LD alignment** to the spec §5 table (Product family removed).
6. **Index rule**: indexable = ≥1 published listing OR ≥150 words of own notes
   (description + sowing notes); sitemap + robots meta follow.
   **[AMAZON-MODEL AMENDMENT 2026-11-16]** Post-launch-scope delta — see "Amazon-model amendment (2026-11-16)" in `AMENDMENT-2026-11-16-FLORET-FIRST.md`: every variety page is public and permanent; a seller "request a listing" flow rides the existing /report + review-queue machinery (owner hand-approval, no auto-publish); zero-seller pages show a "currently unavailable / no sellers yet" state instead of disappearing; **indexability SETTLED by owner 2026-11-16 — zero-seller variety pages ARE Google-indexable (index-all variety pages is part of the delta scope), superseding canonical decision 8's index rule for variety pages.**
7. **/go/{id}**: click_events logging per spec (no IP stored, visitor_day_hash,
   is_bot), 302 with UTM preserving existing query, rel="nofollow noopener" on
   outbound shop links.
8. **Reports/claims/removal**: /report page + POST /api/v1/reports (Turnstile check
   behind config), admin remove → 410 + blocked_domains + listings removed.
9. **Sync**: /api/v1/sync/snapshot (JSON, spec shape) + /api/v1/sync/changes
   (updated_seq, tombstones, 410 resync_required); existing version/.sqlite kept.
10. **Ingest API**: jobs lease/complete/fail, sources (snapshot → R2), observations
    with evidence-quote validation, seller-candidates, match-context; hashed scoped
    keys; idempotency keys.
11. **Admin API**: review queue list/approve/reject/merge, seller approve/reject/
    remove, demand stats, health (invariants).
12. **Search**: 2-char threshold, alias matches flagged "also sold as", zero-result
    state + logging, has-listings tiebreak.
13. **API completeness**: /crops naming, per-variety/per-seller listings, /coverage,
    /recent, envelope gains page{} + meta.catalog_seq, spec rate limits.
14. **Copy/pages**: /about/data and /about/bot rewritten to spec (seller rule incl.
    decision 24 — bought-in seed lists the same; bot UA; opt-out; Hues ownership
    disclosure; 48 h removal); variety page answer sentence; crop filters + counts.
15. **vinext check** run and recorded; adapter unchanged.
16. **Tests + acceptance updated** to every behaviour above; full verify + acceptance
    re-run locally.

## (c) Week-by-week plan, Nov 16 → Dec 16 (spec §6, adjusted for the head start)

> **AMENDED 2026-11-16 (owner ruling, voice call):** enumeration is now
> **VARIETY-FIRST** — see `AMENDMENT-2026-11-16-FLORET-FIRST.md`. The Floret Library
> names extraction becomes the enumeration foundation (Week 1), and per-variety
> seller search replaces seller-catalog-first enumeration (Week 2). The original
> ordering text is preserved in the amendment's supersession list; launch date and
> launch gates are unchanged.

- **Week 1 — Nov 16–22 (foundations).** Delta build (this plan, tasks 1–16) replaces
  most of the spec's Week 1 build list. Remaining Week 1 work: ingester CLI v1
  (fetcher with robots/rate-limit/snapshots + Shopify feed extractor) against the
  new ingest API; **owner reads exemplar terms** (fills terms_reviewed_at); seller
  discovery run → candidates into the review queue for owner approval;
  color_family vocabulary fixed (~12); adapter check done (delta).
  **[AMENDMENT 2026-11-16]** Add: **Floret Library names extraction** — crawl the
  Library (seed collections only) and extract variety NAMES only (no text, no
  images) as the enumeration foundation; robots.txt governs — if it disallows, the
  names are gathered by hand. Floret courtesy email: cancelled by owner 2026-11-16.
  Exit test (spec): one approved seller's catalog flows end to end into staging with
  provenance, and a planted bad record is rejected by the evidence check — the
  rejection half is already proven locally by the delta acceptance tests.
- **Week 2 — Nov 23–29 (ingestion at volume; Thanksgiving Nov 26).** Crawl every
  approved seller; **[AMENDMENT 2026-11-16]** enumeration now runs the other way:
  for each variety enumerated from the Floret Library, **search the web for small
  farms selling that seed** — hits enter the approval queue as seller candidates
  (owner approves by hand; large houses are domain-blocked even when they rank for
  a variety), and newly approved sellers' shops are then crawled through the
  standard evidence-checked flow. Approved-seller shop crawling continues in
  parallel; matching/synonym learning; staleness jobs; owner works
  the review queue daily (30 min/day budget). Exit: every approved seller crawled,
  real counts replace the cost placeholders, seller page showable to a farm.
- **Week 3 — Nov 30–Dec 6 (public site polish).** Crop/series/search//go/report
  pages already exist from the delta — this week is content + QA on staging:
  growing notes for the top five crops (feeds the ≥150-word index rule), outreach
  emails with preview links out by **Dec 2**, queue worked daily. Exit: full click
  path verified at 390 pt on staging; emails out; queue < 300 groups.
- **Week 4 — Dec 7–13 (hardening).** Caching/rate-limit tuning, digest email +
  alerts, weekly R2 export, performance + accessibility pass **in a real browser**
  (the delta's unmeasured gap), legal pages final, demand dashboard screens if time
  (cut-list protected), AI-crawler zone settings checked on hues.flowers. Exit:
  launch gates met on staging; first 50-listing audit ≥ 97%.
- **Launch — Dec 14–16.** Feature freeze Dec 14; full re-crawl Dec 15; **launch
  Dec 16** against the spec's launch-day checklist. Deploy itself is unblocked only
  once the owner actions in (e) are done.
- **Cut list**: the spec's §6 order applies unchanged. Never cut: source + date on
  every listing, the seller allowlist, robots compliance, the removal flow, the
  noindex rule, click logging, the evidence check, "Not yet rated".

## (d) Open owner questions (spec §8) — defaults HOLDING

| # | Question | Default holding | Needed by |
|---|---|---|---|
| 1 | Seller-size rule | Large houses out (domain-blocked); any independent farm/small shop the owner approves may list | Nov 18 |
| 2 | What v2 holds / adapter | ANSWERED by fact: v2 exists, verified, on OpenNext; vinext check run, no switch | — |
| 3 | Floret Library as name reference | AMENDED 2026-11-16: names-only extraction is owner-directed (see AMENDMENT-2026-11-16-FLORET-FIRST.md); Floret courtesy email: cancelled by owner 2026-11-16; robots.txt governs — hand-gather if disallowed | Nov 23 |
| 4 | color_family vocabulary | Fixed list of ~12 set in Week 1 (delta ships the column defaulting to 'unknown') | Week 1 |
| 5 | Prices shown after launch? | Decide at day 30 from seller feedback | Jan 2027 |
| 6 | Hues lists its own seed at launch? | No | Before launch |
| 7 | AI training crawlers on the zone | Allow all three policies | Before launch |
| 8 | Removal cover when owner away | Auto-reply + one-tap remove in /admin | Before launch |
| 9 | Reviewer sign-in model | Email link, no passwords | Feb 2027 |
| 10 | Legal review for seed sales | Brief counsel during Phase 1.5 | Before Phase 3a |
| 11 | Traffic targets | Set from first 30 days of data | Jan 2027 |

## (e) Owner dashboard actions — deploy blockers

1. **R2 is not enabled on the Cloudflare account.** Bucket creation failed with
   API code 10042 ("Please enable R2 through the Cloudflare Dashboard"). The delta
   design needs two buckets (`seeds-hues-cache` for the OpenNext ISR cache,
   `seeds-hues-snapshots` for catalog + fetch snapshots). **Production deploy stays
   blocked until the owner enables R2 once in the dashboard** (dash.cloudflare.com
   → R2 Object Storage → enable; free tier covers this project's usage).
2. **Workers Paid ($5/mo)** — spec decision 20: server-rendered apps need the Paid
   plan's CPU limits. Also an owner dashboard action; flag at deploy time, together
   with spend alerts (launch checklist).
3. Also at deploy time (operator tasks, not blockers): set `REVALIDATE_TOKEN`,
   `TURNSTILE_SECRET_KEY` + site key (until set, /reports runs with the token check
   in permissive config mode — flagged in code and in the delta report), ingest/admin
   API keys minted via `scripts/create-api-key.ts`, `CLICK_HASH_SALT`,
   `NEXT_PUBLIC_CONTACT_EMAIL` (the 48 h removal promise needs a monitored inbox),
   remote migrations + import + publish, workers.dev origin added to
   `CORS_ALLOWED_ORIGINS`.
