# seeds.hues.flowers v2 — FINAL BUILD SPEC (authoritative)

**Status: APPROVED FOR BUILD + PRODUCTION DEPLOY (owner, Dustin, 2026-11-15).**
This file supersedes `V2-BUILD-SPEC.md` wherever they differ. Where this file is silent,
`V2-BUILD-SPEC.md` (§§1–5, 7, 9–11) still governs. Read this file in full first, then the
sections of the old spec it incorporates by reference.

**Builder:** Kiro (spec-driven: create `.kiro/specs/seeds-v2/{requirements,design,tasks}.md`
distilling this spec, then execute the tasks).
**Project location:** `~/workspace/seeds-hues/v2/` (new Next.js project; do NOT touch v1
`app/` or `preview/`).
**Deploy target:** PRODUCTION — Worker `seeds-hues` on custom domain `seeds.hues.flowers`
(Cloudflare account `51080ac04974bef5a30d7ceb5b79e9e2`, zone `hues.flowers`
`0e2fd06883e26d0de9308ed684443ebc`). The old spec's "preview first, cutover later" flow is
**superseded by the owner's explicit instruction**: build, verify locally + on a temporary
workers.dev deployment if needed, then deploy to production and verify live there.

---

## 1. What changed vs the old spec (the rulings — apply exactly)

### 1.1 SELLER SCOPE RULING (owner, 2026-11-15) — overrides old §6 entirely
- **Sellers are SMALL FARMS / independent farm seed sellers ONLY.** No large seed companies
  anywhere in data, seed data, examples, tests, or copy: **no Ball Seed, no GeoSeed, no
  Johnny's Selected Seeds**, no Park Seed, no Baker Creek, no Everwilde, no Reimer, no
  Onings, no Silver Falls, no Todd's. (These names may appear ONLY in code comments or this
  spec's exclusion lists — never in the database, never rendered.)
- **Old §6.1 migration of v1 sellers/listings is VOID.** v1's listings were all
  large-company (GeoSeed 11, Everwilde 2, Reimer 1) — **zero v1 listings carry into v2.**
  Old §6.2 (Ball + Onings listings A1–A10) is **VOID in full**. Old §9 checks naming
  GeoSeed/Ball prices are void; §7 of this spec replaces them.
- **Old §6.3 E7 / conflict C6 (Johnny's) is SETTLED: Johnny's is OUT**, like every large
  company.
- v1's 14 **variety** records DO carry over (varieties are enumeration, not listings —
  large catalogs may be used as *reference* for which varieties exist; they are never
  listed, linked, or shown as sellers). Variety descriptions are carried from v1 with any
  seller-name mentions scrubbed out.

### 1.2 Data source of truth for v2 seed data
ALL seed data comes from **`v2/seed-data/catalog.json`** (curated by Hue from the verified
project sources: v1 `app/data/varieties.json`, `~/workspace/seed-sourcing/sweet-pea-variety-checks.md`,
`SELLER-SEED-LIST.md`, and the 2026-11-16 small-farms research report). The importer loads
exactly that file — nothing more, nothing invented. Expected totals (the importer must
assert them): **68 varieties / 32 sellers / 67 listings / 19 plants.**
Seller provenance tiers in the data: `owner-named` (6 confirmed), `research-candidate` (20),
`sourcing-check` (6 specialty shops found in Hues' own sweet-pea checks). All 32 are real,
sourced sellers; candidate tiers are flagged in the data (`provenance` column) and in the
admin-facing import manifest — the public UI does not display provenance tiers.

### 1.3 Opus full-brief rulings (2026-11-15, claude-opus-5.5) — all adopted
From `V2-KIRO-FULLBRIEF-OPUS.md`:
- **X1 Transactions:** D1 has no interactive transactions. The old §3.4 rule 6 ban on
  `db.batch()` is **replaced**: `db.batch()` is permitted ONLY inside a single repository
  helper `atomic(ops)`; everywhere else Drizzle operators only. (Its Postgres version
  becomes a real transaction.)
- **X2 API definition:** one service layer; `/api/v1` is the canonical contract;
  interactive client features call the API; Server Components call the service layer
  in-process (never HTTP self-call); contract tests enforce parity between service output
  and API payloads.
- **X3 Search:** FTS5 trigram stays, PLUS a prefix-match fallback for queries < 3 chars.
  **Drop any typo-tolerance claim** in copy/docs (trigram gives partial matching only);
  variety aliases/synonyms live in a `variety_aliases` table included in FTS.
- **X4 Static generation:** `generateStaticParams` returns `[]` or the top ~100 varieties
  by listing count; everything else renders via ISR on first hit. After each production
  deploy, a warm-crawl script requests every sitemap URL once.
- **X5 Pagination everywhere:** crawlable `?page=` URLs on list pages; never render
  thousands of cards on one page.
- **X6 ISR cache:** OpenNext **R2 incremental cache + tag cache** (not KV). Wrangler binds
  an R2 bucket `seeds-hues-cache` for OpenNext; resolve exact config against the pinned
  `@opennextjs/cloudflare` docs and log it (VERIFY flag).
- **X7 Backups:** D1 Time Travel is the backup story; the export pipeline must drop and
  rebuild FTS tables around exports. (Record in README; no code needed in Phase 1 beyond
  the snapshot publisher in §3.3.)
- **X9 JSON-LD surgery (replaces old S4 in part):**
  - **No `FAQPage` anywhere** (Google restricted FAQ rich results in 2023).
  - **No `Product` schema on zero-vendor variety pages** — `BreadcrumbList` only.
  - Variety pages WITH listings: `Product` + **`AggregateOffer`** (`lowPrice` = lowest
    verified packet price, `offerCount`) + **one `Offer` per listing** at that listing's
    lowest verified packet price. Offers omit price fields when the listing has no
    verified price. **Omit `priceValidUntil` entirely.** No `AggregateRating`/`Review`
    anywhere (unchanged prohibition).
  - Sitemap: no `<priority>`/`<changefreq>` values.
- **X10 Robots:** allow all crawlers including AI crawlers; do NOT disallow `/api/` in
  robots.txt — instead serve `X-Robots-Tag: noindex` on all `/api/*` responses.
  `/search?q=` pages: `noindex, follow` via metadata.
- **X11 Admin:** the public Worker is **GET-only for the public** and ships **no admin UI
  and no auth code**. (A separate `seeds-admin` Worker behind Cloudflare Access is a
  future phase — do not build it; data changes in Phase 1 are seed scripts + D1
  operations.) The only non-GET public-Worker route is the token-protected
  `POST /api/revalidate` (old §4.3, unchanged) and the click beacon (§3.4).
- **X12 Catalog version bumps on PUBLISH, not on write.** See §3.3.
- **X17 Raw scrapes → R2:** schema anticipates it (§2), but Phase 1 builds no live
  scrapers. The snapshot R2 bucket (§3.3) is the only R2 content bucket created.
- **Indexability rule (replaces old "publish everything"):** a variety page is indexable
  (in sitemap, no `noindex`) only if it has **≥1 active listing** OR **`content_level =
  factual`** (≥3 sourced facts among: description, sowing notes, height, ≥2 tags,
  plant-level guidance). Otherwise the page is live and internally linked but served
  with `noindex` and excluded from the sitemap. The importer computes `content_level`
  (`thin` | `factual`) and `indexable` per variety; the rule is data, not hard-coded slugs.
- **Descriptions:** where a variety has no sourced description, render **deterministic
  template text** built only from sourced structured facts (variety name, plant common +
  Latin name, breeder where sourced, listing count). No LLM free text, no invented traits.
- **Protection field:** varieties carry `protection` ∈ `pvp_us | utility_patent_us | pbr |
  none_stated | unknown` (+ optional `protection_note` with source). Default `unknown`.
  A badge renders ONLY when protection ≠ `unknown`/`none_stated` AND a source is recorded.
  Never claim a variety is "not protected."

### 1.4 Local-first ruling (Opus, supersedes V2-AMENDMENT-LOCALFIRST-API.md §2)
- **NO SQLite WASM, NO local replica, NO in-memory client search on the website.** (At
  full-catalog scale the catalog is ~3 MB gz — past the fallback's limits; and Phase 1
  traffic lands from Google on one page and clicks out.)
- **WASM-ready plumbing IS built in Phase 1** (§3.3): monotonic catalog version published
  via `catalog_publish`, `GET /api/v1/catalog/version` (never cached), snapshot endpoint
  serving a prebuilt `.sqlite` of allowlisted public tables, soft deletes (status enums —
  already in schema), allowlist export. The replica itself ships in Phase 2 native apps
  as native SQLite.
- The amendment's §1 (API runs the website) stands as amended by X2 above.

### 1.5 Seed-dahlia rule (owner standing rule)
Seed-grown dahlia mixes/strains from named parent lines are IN (they are seed). **No
patio/dwarf/pot dahlia content anywhere** (Hues standing exclusion) — no such data exists
in the seed file; do not add any.

---

## 2. Schema — old §3.1 core PLUS these additions/changes

Core tables per old §3.1 (`categories`, `subcategories`, `plants`, `varieties`,
`variety_tags`, `sellers`, `listings`, `listing_packet_sizes`, stubs `users`,
`seller_accounts`, `reviews`) with these changes:

- `sellers`: add `provenance` TEXT ∈ `owner-named | research-candidate | sourcing-check`;
  add `listing_policy` TEXT ∈ `full | no_prices | removed` DEFAULT `full`;
  add `platform` TEXT NULL (shop platform where sourced: shopify | woocommerce |
  squarespace | other).
- `varieties`: add `content_level` TEXT ∈ `thin | factual` (computed at import);
  add `indexable` INTEGER boolean-mode (computed at import per §1.3 rule);
  add `protection` TEXT DEFAULT `unknown`; add `protection_note` TEXT NULL;
  `description` and `sowing_notes` are NULL-able (template rendering covers NULL).
- `variety_aliases`: `variety_id` FK, `alias` — PK (variety_id, alias); included in FTS.
- `sources`: `id`, `kind` ∈ `catalog | shop-check | research | owner`, `label`,
  `url` NULL, `checked_date` NULL, `access` ∈ `public | login_gated` DEFAULT `public`.
  **Hard rule: every variety and every listing references ≥1 source** (`source_id` FK on
  `varieties` and `listings`; listings also keep the per-packet `price_source` /
  `price_check_date` fields from old §3.1).
- `import_batches`: `id`, `label`, `source_id` FK, `manifest` TEXT JSON (expected counts),
  `status` ∈ `staged | published | rolled_back`, `created_at`, `published_at` NULL.
  All seed data loads as batch #1 (`initial-catalog`), staged then published.
- `match_queue`: `id`, `batch_id` FK, `candidate_payload` TEXT JSON, `confidence` REAL,
  `status` ∈ `pending | approved | rejected`, `created_at`. (Schema + importer writes
  nothing to it in Phase 1; it exists for the post-launch crawl pipeline.)
- `price_history`: `id`, `packet_size_id` FK, `price_cents` NULL, `checked_date`,
  `source_id` FK. Importer writes one row per priced packet at import.
- `catalog_publish`: `version` INTEGER PK (monotonic), `batch_id` FK, `snapshot_key`
  TEXT NULL (R2 key), `published_at`. Seeded with version 1 at first publish.
- `media`: `id`, `variety_id` FK NULL, `seller_id` FK NULL, `r2_key`, `licence` TEXT
  NOT NULL, `credit` TEXT NOT NULL, `created_at`. **Ships EMPTY** (no photos at launch).
- `outbound_clicks`: `id`, `listing_id` FK NULL, `seller_id` FK, `target_url`,
  `created_at`. Written by the click beacon (§3.4). (Self-contained D1 table chosen over
  an Analytics Engine binding for Phase 1 simplicity; log the choice in VERIFICATION-LOG.)

Portability rules: old §3.4 as amended by X1 (atomic() helper). Integer cents everywhere.
Slugs are the only public identifiers. Timestamps ISO text / Drizzle date mode. Booleans
via Drizzle boolean mode.

**FTS:** `varieties_fts` trigram over plant common + Latin names, variety name,
description, tags, aliases. All FTS access isolated in `searchVarieties()` (old §3.3),
extended with the X3 prefix fallback for q < 3 chars.

---

## 3. Routes + API — old §4 with these changes

### 3.1 Web routes (old §4.1, amended)
- List pages (`/varieties`, `/sellers`, plant/category pages) paginate with crawlable
  `?page=` (X5), 24 per page.
- Variety/seller/plant/category detail: `generateStaticParams` per X4; `dynamicParams =
  true`; on-demand revalidation + 24 h ISR fallback.
- `/about` page: what the directory is, how verified prices work, the trademark
  disclaimer + conflict-of-interest line (§4), seller contact/removal policy (48 h
  removal on request), ratings policy. `/about/bot`: crawler identity/etiquette page
  (honest UA string, opt-out contact, robots policy). Plus simple `/terms` and
  `/privacy` pages (directory is read-only, no accounts, no cookies beyond analytics —
  write them factually from the actual implementation).
- `/search` SSR with `noindex, follow` metadata (X10).
- 308 redirects from v1 query URLs (old R10) — unchanged. (They apply to the preview
  host's legacy paths too; implement in middleware/config as old S12 describes.)
- Indexability: non-indexable variety pages render `robots: { index: false }` metadata
  and are excluded from `sitemap.ts` output (data-driven from the `indexable` flag).

### 3.2 Public API (old §4.2, amended)
All old §4.2 endpoints, envelope, cursor pagination, ETag/Cache-Control, `X-API-Version`,
CORS (allowlist: `https://seeds.hues.flowers` + the Worker's workers.dev origin; never
`*`), 405 for non-GET, structured errors — plus:
- Every `/api/*` response carries `X-Robots-Tag: noindex` (X10).
- `GET /api/v1/catalog/version` → `{ data: { version, publishedAt, snapshotUrl },
  meta: …, error: null }`; `Cache-Control: no-store` (NEVER cached).
- `GET /api/v1/catalog/snapshot/{version}.sqlite` → streams the published snapshot from
  the R2 snapshots binding; 404 envelope error if that version has no snapshot.
- Rate limiting (old §4.2: 120 req/min/IP, 429 + `Retry-After`): implement with the
  Workers rate-limiting binding if the pinned Wrangler supports the `ratelimits`
  config; otherwise a per-isolate token bucket. Log the choice (VERIFY).
- OpenAPI 3.1 from Zod at `/api/v1/openapi.json` + `/api-docs` page — includes the two
  catalog endpoints.

### 3.3 Catalog publish + snapshot (new, Phase 1)
- `scripts/publish-catalog.ts`: (1) reads the current published version, (2) builds a
  SQLite file containing ONLY the allowlisted public tables (categories, subcategories,
  plants, varieties, variety_tags, variety_aliases, sellers [public columns],
  listings, listing_packet_sizes, catalog_publish) from the local/remote D1 data,
  (3) uploads it as `snapshots/catalog-v{version}.sqlite` (R2 bucket
  `seeds-hues-snapshots`), (4) inserts the `catalog_publish` row bumping the version.
  Node-side script (may use better-sqlite3 as a devDependency — never in Worker code).
- The seed flow for launch: importer stages batch → Hue runs publish → version 1 live.

### 3.4 Measurement (new, Phase 1)
- Outbound seller links keep **direct hrefs** (no `/go/` redirect routes). A small
  client-side `sendBeacon` to `POST /api/track` (internal, not in OpenAPI, 204 response)
  records the click into `outbound_clicks`. No cookies. Failure of the beacon must never
  affect navigation.
- Cloudflare Web Analytics: include the beacon script ONLY when the
  `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` env var is set (it will be unset at launch; the slot
  exists). No other third-party trackers.

---

## 4. Legal / trust copy (ships in Phase 1)
- Footer + `/about` carry: "Variety and cultivar names are trademarks of their
  respective owners. seeds.hues.flowers is an independent directory, not affiliated
  with or endorsed by any listed seller." Plus conflict-of-interest line: "Hues Floral
  Park grows flowers and buys seed from some listed sellers. Sellers do not pay for
  placement."
- Seller objection policy (public, on `/about`): any seller may request removal or
  no-price display; honoured within 48 hours (`listing_policy` enforces it in data).
- Descriptions: deterministic template text only (§1.3). Hand-written editorial is a
  later phase.

---

## 5. PWA + SEO/GEO
- PWA: old §5 in full (manifest via `app/manifest.ts`, hand-rolled `public/sw.js`,
  self-applying updates, `/offline`, bottom tab bar, 390 pt first, budgets LCP < 2.5 s /
  INP < 200 ms / CLS < 0.1).
- SEO/GEO: old §7 as amended by §1.3 X9/X10 (no FAQPage, no Product on zero-vendor
  pages, AggregateOffer pattern, no priceValidUntil, no sitemap priorities,
  X-Robots-Tag on API). S8 price trust labels ("Verified {date} · {source}") apply to
  every rendered price. `llms.txt` generated from DB/config per old S7, updated to state
  the small-farm-only seller policy.

---

## 6. Seed data import (replaces old §6)
- `scripts/import-catalog.ts`: loads `v2/seed-data/catalog.json` as import batch
  `initial-catalog` (staged), Zod-validates every record, inserts in FK order
  (sources → categories → subcategories → plants → varieties → aliases/tags → sellers →
  listings → packet sizes → price_history), computes `content_level`/`indexable`,
  rebuilds FTS, then marks the batch published.
- **Assertions (fail-fast, no silent fixes):** counts = 68 varieties / 32 sellers /
  67 listings / 19 plants; zero orphan FKs; no seller whose slug/name matches the
  exclusion list (ball, geoseed, johnny, park-seed, baker, everwilde, reimer, onings);
  every listing has ≥1 source; every priced packet has price_source + price_check_date;
  all `price_cents` are integers or NULL.
- Idempotent: re-running against a DB that already has batch `initial-catalog`
  published is a no-op success; against a staged batch it replaces the stage.

---

## 7. Acceptance checks (Hue runs these LIVE on production; Kiro self-checks locally)
- Routes: `/`, `/varieties`, `/sellers`, `/plants/sweet-pea`, `/categories/flowers`,
  `/about`, `/about/bot`, `/terms`, `/privacy`, `/offline`, `/api-docs` → 200.
- A variety WITH sellers (e.g. `/varieties/sweet-pea-kings-ransom`) shows Songbird +
  Flower People + Sweet Pea Gardens listings with "Verified {date} · {source}" price
  labels and "Not yet rated" on sellers.
- A zero-vendor variety (e.g. `/varieties/stock-katz-mix`) renders with template text,
  BreadcrumbList JSON-LD only (no Product), and — per its sourced facts — correct
  indexability.
- API: `/api/v1/catalog/version` → version ≥ 1, `Cache-Control: no-store`;
  `/api/v1/varieties?limit=5` cursor-walks all 68 exactly once; unknown slug → 404
  envelope; `POST` → 405; ETag → 304 on repeat; `X-Robots-Tag: noindex` present.
- Data: counts 68/32/67; grep of served sitemap + API payloads finds NO excluded
  company names; no `AggregateRating` anywhere; ratings render "Not yet rated".
- Spot checks: Songbird × King's Ransom = 600 cents, 10 seeds, product URL
  `https://www.songbirdseeds.com/seedshop/p/kingsransom-54d2m`; Flower People × Susan
  Burgess = 800 cents with sold-out note and `in_stock` NULL; Floret × Dawn Creek
  Pastels price NULL → "See seller for price".
- PWA: manifest valid, SW registers + self-applies an update, offline fallback works.
- 308s: `/varieties?v=stock-katz-mix` → 308 → `/varieties/stock-katz-mix` (and the
  seller equivalent).

---

## 8. Tasks (execute in order; distilled into `.kiro/specs/seeds-v2/tasks.md`)
A. **Setup:** 1) Pin versions (Next 16.4.x latest patch, React 19.3, exact
   `@opennextjs/cloudflare`), resolve/log VERIFY flags (old V1–V13 + Opus V14–V20:
   D1 export/FTS, batch semantics, OpenNext R2 cache config, rate-limit binding, Access
   n/a Phase 1, bound-parameter limits) into `v2/VERIFICATION-LOG.md` — adopt fallbacks,
   never stall. 2) Scaffold `v2/` per old §2 structure + Wrangler config (Worker
   `seeds-hues`, D1 binding `DB`, R2 bindings for cache + snapshots, custom domain
   route for `seeds.hues.flowers`). 3) Tooling: ESLint, Vitest, Playwright, `verify`
   script.
B. **Database:** 4) Core schema + additions (§2) + migrations. 5) Stubs + rating
   aggregates. 6) FTS5 + triggers + `searchVarieties()` with prefix fallback.
   7) Repository/service layer + `atomic()` + Zod output validation + portability
   guardrail tests.
C. **Data:** 8) `import-catalog.ts` (§6) + assertions. 9) Run import locally;
   validate counts + spot checks. 10) `publish-catalog.ts` (§3.3).
D. **API:** 11) Foundation (envelope, pagination, ETag, CORS, rate limit, X-Robots-Tag).
   12) Variety/seller endpoints. 13) Category/plant/search endpoints.
   14) Catalog version + snapshot endpoints. 15) OpenAPI + `/api-docs` + shared types.
   16) Contract tests (incl. service↔API parity). 17) Revalidate route + click beacon.
E. **Web:** 18) Root shell + tab bar. 19) UI kit (PriceDisplay, RatingDisplay, swatches,
   template-description renderer). 20) Home + search widget (API autocomplete + no-JS
   form). 21) Variety pages (indexability-aware metadata + JSON-LD per §1.3).
   22) Seller/category/plant pages with `?page=` pagination. 23) 308 redirects.
   24) Search page, `/about`, `/about/bot`, `/terms`, `/privacy`, `/offline`, 404/errors.
F. **PWA:** 25) Manifest + icons. 26) Service worker (self-applying updates).
   27) PWA checks incl. update test (against a local or workers.dev deployment).
G. **SEO/GEO:** 28) Metadata system. 29) OG cards (ImageResponse; fallback per old V13).
   30) JSON-LD builders + prohibition tests. 31) Sitemap (indexable-only) / robots /
   llms.txt. 32) Linking + semantics pass.
H. **Delivery:** 33) Accessibility (axe, WCAG 2.2 AA) + performance budget pass.
   34) README (run/deploy/data-op instructions, snapshot publish flow, D1 Time Travel
   note). 35) Full local acceptance run of §7 (against local D1 + `next start`/wrangler
   dev) with results logged to `v2/BUILD-REPORT.md`.

**Out of scope (unchanged from old §8):** checkout/cart/payments, user accounts,
review submission, native apps, marketplace/seller self-service, admin UI, web push,
dedicated search service, AWS resources, photos (media table ships empty), vegetable/
herb data.

**Hard rules (old §1.3, restated):** HR1 no invented data (price NULL → "See seller for
price"; productUrl NULL → seller homepage link); HR2 no checkout; HR3 no hotlinked
images (typography + swatches + generated OG cards only); HR4 WCAG 2.2 AA; HR5 no
patio/dwarf/pot dahlia content; HR6 clean up test rows.
