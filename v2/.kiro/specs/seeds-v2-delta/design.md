# seeds-v2-delta — Design

House rules from the existing build still bind: repositories are the only Drizzle
importers; `atomic()` is the only `db.batch()`; services are shared by pages and API
with Zod output validation; TypeScript strict; exact version pins; no Node built-ins
in Worker code (scripts may use them); guardrail tests enforce the architecture.

## D1 — Schema migration `migrations/0002_delta.sql` (+ Drizzle schema.ts)

New tables:
- `series` (id, slug UNIQUE, name, plant_id → plants, created_at, updated_at,
  updated_seq, deleted_at)
- `listing_events` (id, listing_id → listings, event CHECK
  first_seen/restocked/sold_out/gone, at)
- `click_events` (id, at, listing_id, variety_id, seller_id, availability_at_click,
  page_type, referrer_host, client, visitor_day_hash, is_bot)
- `search_events` (id, at, query_normalized, result_count, clicked_variety_id, client)
- `variety_view_counts` (date, variety_id, views; PK (date, variety_id))
- `daily_stats` (date, variety_id, seller_id, clicks, sold_out_clicks;
  PK (date, variety_id, seller_id))
- `blocked_domains` (domain PK, reason, created_at)
- `reports` (id, type CHECK correct/claim/remove, target_type, target_ref, message,
  contact, status CHECK open/resolved/dismissed DEFAULT open, turnstile, created_at,
  resolved_at)
- `seller_claims` (id, seller_id → sellers, email, token_hash, verified_at, created_at)
- `api_keys` (id, key_hash UNIQUE, label, scopes JSON text, created_at, last_used_at,
  revoked_at)
- `fetch_sources` (id, url, fetched_at, http_status, content_hash, snapshot_key,
  robots_allowed, kind CHECK web/human/seller, created_at; UNIQUE (url, content_hash))
- `observations` (id, fetch_source_id → fetch_sources, agent_run_id, seller_id,
  payload JSON, status CHECK published/queued/rejected, reason, created_at)
- `review_items` (id, type CHECK listing_match/new_variety/seller_candidate/
  seller_correction/removal, group_key, proposal JSON, reason, confidence,
  status CHECK pending/approved/rejected/merged, created_at, resolved_at)
- `crawl_jobs` (id, type, target, status CHECK queued/leased/done/failed,
  lease_expires_at, attempts DEFAULT 0, next_run_at, created_at, updated_at)
- `agent_runs` (id, agent, model, prompt_version, tokens_in, tokens_out, cost_usd,
  created_at)
- `ingest_idempotency` (key PK, endpoint, response JSON, created_at)
- `catalog_meta` (key PK, value) — holds `catalog_seq`, the global change counter.

Altered tables:
- `sellers`: + eligibility (CHECK candidate/approved/rejected/removed_by_request,
  DEFAULT 'candidate'), approved_at, terms_reviewed_at, approval_note, domain,
  crawl_policy (CHECK feed/html/manual_only/opted_out, DEFAULT 'manual_only'),
  claim_status (CHECK unclaimed/claimed, DEFAULT 'unclaimed'), country DEFAULT 'US',
  region, ships_to DEFAULT '["unknown"]', is_site_owner DEFAULT 0, contact_email,
  updated_seq DEFAULT 0, deleted_at. UNIQUE index on domain (non-null).
  Do NOT add the canonical CHECK (approved ⇒ terms_reviewed_at NOT NULL): terms
  review is genuinely not done yet (see DELTA-PLAN §(a) §2 last row).
- `varieties`: + series_id → series, color_family DEFAULT 'unknown', pollination
  (CHECK open_pollinated/f1_hybrid/unknown, DEFAULT 'unknown'), days_to_bloom_min,
  days_to_bloom_max, merged_into_id → varieties, updated_seq, deleted_at.
  VARIETY_STATUS gains 'merged' (rebuild the CHECK via table rebuild or drop/recreate
  — SQLite: create new table + copy, per existing migration practice; if the existing
  migrations used plain CHECK in CREATE TABLE, do the standard rebuild carefully and
  preserve FTS triggers — FTS lives in 0001 and keys on varieties rowid: keep rowids
  stable by copying with explicit id).
- `listings`: + availability (CHECK in_stock/sold_out/preorder/shop_closed/unknown,
  DEFAULT 'unknown'), variant_key DEFAULT '', external_product_id, title_raw,
  channel (CHECK external/marketplace/fulfilled_by_hues, DEFAULT 'external'),
  match_method, confidence, source_url, first_seen_at, last_checked_at,
  updated_seq, deleted_at. Replace UNIQUE (variety_id, seller_id) with
  UNIQUE (seller_id, product_url, variant_key) — SQLite treats NULL product_urls as
  distinct, which is what the seed data needs. LISTING_STATUS gains 'removed' and
  'gone' and 'stale' (canonical: pending/published/stale/gone/rejected/removed —
  keep existing 'active'/'inactive'/'unverified' values too; map 'active' =
  published in public shapes).
- `plants`: + updated_seq, deleted_at.
- `variety_aliases`: + name_normalized, kind DEFAULT 'synonym'
  (CHECK primary/synonym/trade_name/misspelling/seller_alias); index on
  name_normalized. Name normalization (shared helper in lib): lowercase, strip
  accents (NFKD + remove combining marks), strip punctuation, drop the crop word
  and pack-size words.

updated_seq: a repository helper `nextSeq(db)` increments catalog_meta inside the
same atomic batch as the write. The importer assigns seqs deterministically
(1..N in import order) and sets catalog_meta accordingly. Ingest/admin writes use
nextSeq per changed row.

## D2 — Importer (scripts/import-catalog.ts + lib/catalog/*)
- Maps the new catalog.json fields (seller approval block, variety series).
- Creates `series` rows from variety.series names (crop = the variety's plant).
- Derives per listing: availability = in_stock if any packet inStock true, else
  sold_out if any packet inStock false, else unknown; last_checked_at = max packet
  priceCheckDate, else the listing source's checkedDate; first_seen_at =
  last_checked_at; match_method 'human'; confidence 1.0; source_url = productUrl.
- Writes a `listing_events` first_seen row per listing.
- Indexable per R5 (≥1 listing OR ≥150 words of notes).
- Import fully replaces the curated catalog tables (plants, series, varieties,
  aliases, sellers, listings, packet sizes, listing_events) inside one atomic
  batch — re-running db:setup:local from any state must converge to exactly the
  catalog.json contents. Assertions updated: 19/68/6/17, all sellers approved,
  exclusion scan unchanged, every listing has provenance.
- price_history seeding: keep as before (stored, never shown).

## D3 — Services / repositories
- New repositories: sync (snapshot/changes), events (clicks/search/views/rollup),
  ingest (jobs/sources/observations), review (items + apply), sellers-admin,
  reports, api-keys, series, coverage/recent reads. All SQL stays in repositories.
- Public serializers live in the service layer and are shared by pages + API +
  sync (parity tests extended). Public listing serializer NEVER includes packet
  prices; it includes provenance {source_url, retrieved_at (= last_checked_at),
  method (= match_method), confidence}.
- Search service: extend lib/repositories/fts.ts — threshold ≥ 2 chars: use FTS
  for terms ≥ 3 chars; ALSO run the prefix path for 2-char terms and for alias
  matching; merge + rank (exact, prefix, fts; has-listings tiebreak); return
  {varietyId, matchedAlias | null}. Ensure aliases are in the FTS index content
  (0001 triggers already include aliases — verify; extend if not).
- Click service: build click_events rows (visitor hash needs an env salt
  `CLICK_HASH_SALT`, default a dev constant; IP read from cf-connecting-ip header,
  used transiently only).

## D4 — Routing
- Move route dirs: app/varieties → app/variety, app/sellers → app/seller,
  app/plants → app/crop; add app/series/[slug], app/report, app/go/[id]/route.ts.
- Redirects in next.config.ts `redirects()` (permanent → 308) for the eight plural
  patterns in R3. Keep the ?v=/?s= handling inside the new index pages.
- Removed seller: the seller page checks eligibility; for removed_by_request it
  must produce HTTP 410. Implementation: try edge middleware
  (app/middleware.ts, matcher /seller/:slug) using the WORKER_SELF_REFERENCE
  binding to query an internal status endpoint; if that cannot be made to work
  under the local OpenNext preview, fall back to notFound() and LOG the divergence
  prominently in DELTA-REPORT.md. The API MUST return a true 410.
- OG routes: kinds become variety/seller/crop (plant → crop), callers updated.

## D5 — Auth for ingest/admin
- `lib/api/auth.ts`: parse Bearer, SHA-256 (WebCrypto — no Node built-ins in Worker
  code), look up api_keys by hash, reject revoked, check scope, stamp last_used_at.
- problem+json errors: {type, title, status, detail, code} with
  `application/problem+json` content type on the new route trees
  (/api/v1/ingest/*, /api/v1/admin/*, /api/v1/reports, /api/v1/sync/* errors).
- Rate limiting: reuse the existing limiter helper; search bucket 60/min,
  reports 3/min, ingest 600/min keyed by API key id.

## D6 — Tests + acceptance
- Update unit/catalog-assertions (counts 19/68/6/17), unit/seo (JSON-LD shapes, no
  Product), unit/guardrails (flip price assertions: public serializers and page
  components must not reference priceCents; /go required on shop buttons),
  contract/api (new endpoints, envelope, sync, crops naming, sorts),
  contract/internal (track view beacon), integration/data (import derivations,
  evidence-validation plant tests: a fabricated evidence quote is REJECTED with
  evidence_not_found; a genuine quote from a stored snapshot is ACCEPTED and
  publishes on an exact match; a model match queues instead of publishing).
- scripts/acceptance.ts: rewrite the price checks into price-ABSENCE checks; counts
  68/6/17; singular URL 200s + plural 308s; zero-seller noindex (51 pages) and
  sitemap exclusion; no Product JSON-LD anywhere; /go 302 + UTM + click recorded
  (verify via admin stats endpoint with a minted admin key or direct local D1
  query); sync snapshot/changes shapes; reports POST creates a queue item;
  removed-seller flow on a throwaway local seller (create via admin, remove, then
  page + API status checks).
- Local runbook: fresh local state → npm run db:setup:local → npm run verify →
  npm run cf:build → preview → npm run acceptance -- --base <preview URL>.
  Record everything in DELTA-REPORT.md (repo root of v2/), including the vinext
  check output (R15) and any fallback/divergence you had to take.
