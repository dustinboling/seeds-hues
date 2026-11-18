# seeds.hues.flowers v2 — Kiro's Architecture Suggestions (distilled)

**Source:** Kiro CLI run 2026-11-15, suggestions only — nothing built.
**Full raw output:** `hidden_files/kiro-v2-suggestions-raw.txt`
**Distilled/reviewed by:** Hue — items marked ⚠️ VERIFY are Kiro claims that need checking against current docs before the v2 build relies on them.

## Bottom line

Kiro agrees with most of Hue's provisional proposal — Next.js 16.4 App Router + RSC, Drizzle, Tailwind 4, Metadata API, dynamic sitemap/robots/llms.txt, JSON-LD — **with one major disagreement: the database.**

> **Kiro's #1 recommendation: Cloudflare D1 (SQLite) instead of Neon Postgres.**

---

## Where Kiro DISAGREES with Hue's proposal

### 1. Database: D1 over Neon Postgres ❌ disagreement
- **Latency:** from Cloudflare Workers, Neon is ~50–120ms per query via its serverless HTTP driver (Workers are stateless, no persistent connection, cold-start overhead). D1 is co-located with the Worker — 1–5ms, native binding (`env.DB`), no pooler/driver.
- **Scale:** D1's 10 GB/database ceiling is, in Kiro's estimate, low-tens-of-MB for thousands of varieties × sellers × listings — no headroom problem for this catalog.
- **Cost/ops:** D1 is essentially zero marginal cost on the Workers plan, one dashboard, Wrangler migrations. Neon adds a vendor, a connection-string secret, and separate monitoring.
- **Switch to Neon only if:** marketplace later needs `FOR UPDATE SKIP LOCKED` job queues, PostGIS, `pg_vector` semantic search, or the app moves off Cloudflare to Node.
- **Turso/libSQL:** middle latency, same SQLite ceiling as D1, adds a vendor — no benefit for a single-database app.
- Hue's note: this argument is deployment-specific and strong *because* v2 stays on Cloudflare/OpenNext. The trade is giving up Postgres features (JSONB, partial/rich indexing, mature FTS) for edge latency and simplicity. Drizzle works with both, so the schema is portable if a later migration is needed.

### 2. Packet sizes: normalized table, NOT JSONB ❌ disagreement
- New table `listing_packet_sizes` (one row per packet size) instead of a JSON/JSONB blob.
- Enables SQL queries v1/v2 will actually want: `MIN(price)` per listing, "from $3.25" on cards, price-range filtering/sorting.
- **Prices as integer cents** (`price_cents`, $3.25 → 325), not floats — avoids SQLite/float rounding ($3.20 → 3.1999…).

### 3. Add a `plants` (species) layer now ❌ addition
- v1 treats every variety as standalone. Kiro adds `plants` (common + Latin name, e.g. Stock / *Matthiola incana*) above `varieties`, with `varieties.plant_id`.
- Pays off when there are 10 Snapdragon varieties and a "Snapdragon" grouping/search result is wanted. Retrofitting later = migration + URL changes.

### 4. ISR: on-demand, not short-interval ⚠️ qualification
- Don't blanket-revalidate variety pages every 60s — prices change when the DB is edited, not hourly.
- Use `revalidateTag` / `revalidatePath` from a token-protected `/api/revalidate` route handler when a listing/price changes, with a **24h fallback** revalidate as a safety net.

### 5. AggregateRating: explicitly omit ⚠️ addition
- No `AggregateRating` in JSON-LD (and no star display beyond "Not yet rated") until real ratings exist. Same hard rule as v1: never invent ratings.

---

## Where Kiro AGREES with Hue's proposal ✅

- **Framework:** Next.js 16.4 App Router + React Server Components — query the DB in Server Components, ship rendered HTML, no client data-fetch waterfall for crawlers.
- **No full reload:** `<Link>` client navigation + prefetch (RSC payload, not full HTML). Crawlers still get server-rendered HTML.
- **ORM:** Drizzle — TypeScript-first, best-supported for D1/SQLite (and Postgres if switched), thin/SQL-transparent.
- **CSS:** Tailwind 4, zero runtime cost.
- **SEO plumbing:** dynamic `sitemap.ts` / `robots.ts`, `llms.txt`, Metadata API via `generateMetadata()` per route, JSON-LD approach.
- **Qualifications:** TypeScript `strict: true` from day one. Turbopack for dev; production `next build` is the escape hatch if Turbopack/Tailwind 4 anomalies appear.

---

## Kiro's concrete schema (D1/SQLite dialect)

Core tables: `categories`, `subcategories`, `plants`, `varieties`, `variety_tags`,
`sellers`, `listings`, `listing_packet_sizes`.

Key design points:
- Integer internal IDs; **slugs are the public identity** (unique, preserved from v1).
- `status` enums instead of hard deletes: varieties `active|draft|discontinued`, listings `active|inactive|unverified`, sellers `active|inactive|pending`.
- `UNIQUE (variety_id, seller_id)` on listings — one listing per pair.
- `listing_packet_sizes`: `label`, `price_cents NULL` (= "See seller for price"), `price_source`, `price_check_date`, `in_stock NULL` (= unknown), `sort_order`.
- Sellers carry rating aggregates for later: `rating_count`, `rating_sum`, `rating_average NULL` until count > 0.
- Indexes on all FKs, tags, listing status, and packet price.
- **Future stubs defined now, left empty:** `users`, `seller_accounts` (seller ↔ user), `reviews` (1–5, `pending|approved|rejected`, unique per user×seller). Marketplace migrations then become `ALTER TABLE ADD COLUMN`, not schema surgery. Orders were discussed as future-proofing but Kiro did not stub an orders table — v2 schema does not block one.
- **Search:** SQLite **FTS5 virtual table** `varieties_fts` (common/latin/variety name, description, tags) with the **trigram tokenizer** (partial + mid-word matches, some typo tolerance), kept in sync by triggers. Postgres equivalent (weighted `tsvector` + GIN) documented in the raw file if the DB choice flips.

## Routing & rendering (Kiro)

| Route | Strategy |
|---|---|
| `/` | SSG, 24h ISR; search widget is a client component |
| `/varieties`, `/sellers`, `/categories/[slug]` (+ subcategory) | SSG, 24h ISR |
| `/varieties/[slug]`, `/sellers/[slug]` | SSG via `generateStaticParams` + on-demand revalidation; `dynamicParams = true` so post-deploy additions ISR on first hit instead of 404 |
| `/search?q=` | SSR Server Component (shareable, crawlable results) — preferred over client-only |
| `/api/search` | Route Handler, JSON autocomplete (top 10 from FTS) |
| `/api/revalidate` | Route Handler, bearer-token protected |

## SEO / GEO checklist (Kiro)

- Canonical per page via Metadata API; title template `%s | seeds.hues.flowers`; per-route titles/descriptions (variety description should state "Available from N suppliers").
- OG/Twitter `summary_large_image` with a **generated OG card** (variety name + color swatch) via an ImageResponse route — no hotlinked photos needed.
- JSON-LD: variety = `Product` + one `Offer` per listing×packet size (price, USD, seller Organization, `priceValidUntil`, availability only if known) + `BreadcrumbList`; seller = `Organization` (+ PostalAddress); lists/categories = `ItemList`; home = `WebSite` + `SearchAction`; variety FAQ from sowing notes = `FAQPage` (strong GEO signal).
- `llms.txt` at `/llms.txt`: factual markdown — purpose, data model, how verified prices/dates work, key links — for AI crawlers.
- Semantic HTML (`article`, `dl/dt/dd`, landmarks), full internal linking (variety ↔ seller ↔ category, no orphans), outbound seller links `rel="noopener noreferrer"` but **not** `nofollow` (genuine editorial references), descriptive anchors ("View Katz Mix Stock at GeoSeed").
- CWV: server HTML (no fetch-then-render CLS), `next/font` swap, inline swatch SVGs, explicit image dimensions.
- Sitemap: single dynamic `sitemap.ts` now; `generateSitemaps()` chunking (50k URLs) designed in for scale.
- **Stale-price honesty as GEO:** always show "Verified 2026-11-04 · GeoSeed Catalog 2026–27" with any price — trust signal for AI answer engines.

## Search at scale (Kiro)

- **v2:** FTS5 trigram only — zero extra infrastructure. Autocomplete = client component, 300ms debounce → `/api/search`; form still GETs `/search?q=` for no-JS/keyboard users.
- **~500 varieties or faceted filtering needed:** add **Typesense Cloud**, D1 stays source of truth, sync via indexer. **Do not add it in v2.**
- **>20,000 / marketplace scale:** Algolia or self-hosted Meilisearch.

## Caching / OpenNext pitfalls (Kiro)

- ⚠️ VERIFY: ISR on Cloudflare Workers has no filesystem — Kiro says OpenNext Cloudflare uses **KV as the ISR cache** (`NEXT_CACHE_WORKERS_KV`) and on-demand revalidation must be called from a Worker holding that binding. Check the pinned `@opennextjs/cloudflare` version's current docs before building.
- Workers ≠ Node: no `fs`/`path`/`net`/`child_process`; audit deps for `node:*` imports; use `drizzle-orm/d1`, not a Node Postgres driver.
- ⚠️ VERIFY: Kiro's sample uses `getRequestContext()` from `@cloudflare/next-on-pages` — the OpenNext Cloudflare context API differs (`getCloudflareContext` in current OpenNext). Confirm the correct import for the pinned adapter version. Either way: never call it at module scope — initialise the DB client inside the request handler.
- Pin `@opennextjs/cloudflare` to an exact patch version; adapter lags some Next features — check its changelog before upgrading Next.
- KV-ISR cold regeneration ≈100–200ms occasionally at low traffic; long revalidate intervals + CDN rules mitigate.

## Project structure (Kiro, summary)

New project in `seeds-v2/` alongside legacy `app/` until migration is verified:
App Router tree (above routes + `api/`), `components/` split ui / variety / seller / search (client) / layout, `lib/db` (Drizzle client + schema + migrations), `lib/repositories` (varieties/sellers/listings query functions), `lib/validators` (Zod — validate repository *outputs* so bad DB rows fail loudly), `lib/seo` (JSON-LD + metadata helpers), `scripts/` (migration + seed), self-hosted fonts in `public/`.

## Migration from v1 JSON (Kiro)

1. Pre-check script: counts must be **14 varieties / 9 sellers / 14 listings**, zero orphan `varietyId`/`sellerId` references — stop if not.
2. `scripts/migrate-from-v1.ts`: Zod-validate JSON against the DB schema (DB is authoritative), insert categories/subcategories, dedupe `plants` on (common name, Latin name), insert varieties/sellers/listings, expand `packetSizes` → `listing_packet_sizes` with `Math.round(price * 100)`.
3. **Slugs preserved verbatim** from v1 IDs (`stock-katz-mix`, `geoseed`).
4. **308 redirects** in `next.config.ts` using query matching: `/varieties?v=:slug` → `/varieties/:slug`, `/sellers?s=:slug` → `/sellers/:slug`.
5. Post-checks: row counts, orphan join = 0, spot-check GeoSeed × Katz Mix = 2 packet sizes at 325 / 1360 cents, FTS query for "sweet pea", curl the old `?v=` URL expecting a 308.

## Risks Kiro flagged

- OpenNext Cloudflare adapter maturity/version drift (pin it, read changelog per Next upgrade).
- D1 loses JSONB and Postgres-grade FTS; mitigated by normalized packet sizes + FTS5 trigram, accepted until a Postgres-only feature is actually needed.
- Turbopack dev vs production build differences — run `next build` + `wrangler dev` locally before deploy.
- ⚠️ VERIFY (Hue): Kiro's View Transitions snippet (`<ViewTransitions />` from `next/navigation`) and its partial-index claim for D1 should both be confirmed against Next 16.4 / SQLite docs at build time — treat as directional, not gospel.

---

## Decision needed from Dustin

1. **DB: accept Kiro's D1 recommendation, or stick with Hue's Neon Postgres?** (Kiro's latency/simplicity case vs Postgres feature depth.)
2. Everything else above is uncontroversial and can go straight into the v2 spec: normalized packet sizes + cents, `plants` layer, on-demand ISR, FTS5 search, full SEO/GEO checklist, slug-preserving migration with 308s.
