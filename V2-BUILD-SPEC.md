# seeds.hues.flowers v2 — Build Spec (Kiro spec format)

**Status:** Spec only. Nothing in this document authorizes a build until Dustin gives the go.
**Builder:** Kiro (spec-driven flow: this file = requirements → design → tasks).
**Reviewer / deployer:** Hue. Kiro builds; Hue verifies against §8 and handles any deployment.
**Project location:** new project in `~/workspace/seeds-hues/seeds-v2/` alongside legacy `app/` (v1) until migration is verified. Spec docs live with the project; this file is the canonical v2 spec.

**Sources combined in this spec (all read in full, 2026-11-15):**

| Source | Role in this spec |
|---|---|
| `PROJECT-BRIEF.md` | Owner intent + hard rules (§2). Where v1 language conflicts with later v2 docs, the v2 docs win — see §10 Conflicts, item C1. |
| `V2-KIRO-SUGGESTIONS.md` | Architecture, schema, routing, SEO/GEO, migration (§§3–7). Its open "Decision needed: D1 vs Neon" is **superseded** by the phased plan — see §10, item C2. |
| `V2-DEPLOYMENT-PHASED.md` | Deployment + DB phasing: Cloudflare Workers + D1 now, DB-only migration to Postgres via Hyperdrive at marketplace triggers (§3.4). |
| `V2-DESIGN-PWA-API.md` | Mobile-first PWA Phase 1 (§5), API-first `/api/v1` + OpenAPI for Phase 2 native apps (§4). Phase numbering in this spec follows this doc: **1 = PWA directory, 2 = native apps, 3 = marketplace.** |
| `app/data/*.json` | v1 ground truth: **14 varieties / 9 sellers / 14 listings** (verified by direct read). Migration source (§6.1). |
| `~/workspace/seed-sourcing/sourcing-list.md` + `~/workspace/goals/flower-seed-and-plug-sourcing/files/hues-geoseed-order-list-2027-growing-season.md` | Source files for the additional verified listings inventory (§6.2–6.3). |

---

## 1. Requirements

### 1.1 Confirmed build definition (concrete terms — settled, not open for reinterpretation)

- **Framework:** Next.js **16.4.x, latest patch at build start**, App Router, React **19.3**, TypeScript with `strict: true`, Tailwind CSS **4**. Turbopack for dev; production `next build` is the escape hatch if Turbopack/Tailwind anomalies appear. `@opennextjs/cloudflare` pinned to an **exact patch version** (no ranges) — see Task 1.
- **What "app" means here:** a server-rendered React application, **not** a client-only React SPA. Every public page is rendered to real HTML on the server/build (SSG/ISR/SSR per §4.1), so crawlers and AI answer engines receive full content in the first response.
- **Navigation:** App Router client navigation via `<Link>` with prefetch — page changes swap the RSC payload, **no full reload**, app-shell (header/tab bar) persists. View Transitions may be added only if Task 1 verifies the Next 16.4 API (⚠️ flag V3).
- **Indexing behaviour:** every variety, seller, category, and plant has its **own canonical, crawlable URL** (no `?v=` / `?s=` query-param detail pages — those were v1's SEO weakness). Detail routes are statically generated; list routes are static with ISR; `/search` is SSR and crawlable/shareable. `sitemap.xml`, `robots.txt`, and `llms.txt` are generated from the database, never hand-maintained.
- **Deployment (Phase 1):** Cloudflare Workers via OpenNext, standalone preview Worker first (same pattern as v1: `seeds-hues-preview`), production `seeds.hues.flowers` untouched until Hue's §9 verification passes and Dustin approves cutover.
- **Database (Phase 1):** Cloudflare **D1** (SQLite) via **Drizzle ORM**, schema designed portable to Postgres (§3). No AWS resources. No Neon/Postgres in Phase 1.

### 1.2 Functional requirements

- **R1 — Home.** The system shall present a mobile-first home page with a prominent seed search (variety name, common name, or Latin name), category browse, and featured/grouped entry points to plants, varieties, and sellers.
- **R2 — Variety page.** Each variety shall have one page at `/varieties/[slug]` showing: common + Latin name, variety name, description, sowing notes, height (or omitted if unknown — never guessed), color swatch, category/subcategory, tags, plant grouping link, and **every** seller listing for that variety — each with packet sizes, price in USD where verified, seller rating display, price source + check date, and an outbound "View at seller" link.
- **R3 — Seller pages.** The system shall provide a sellers directory (`/sellers`) and one page per seller (`/sellers/[slug]`) showing seller type, location, description, ordering notes, rating display, and every variety that seller carries with its listing details.
- **R4 — Plant grouping.** Varieties shall be grouped under a `plants` (species) layer (e.g. Stock / *Matthiola incana* → Katz Mix). Plant pages (`/plants/[slug]`) shall list all varieties of that plant. Search and browse shall be able to surface plant-level results.
- **R5 — Categories.** Varieties shall be browsable by category and subcategory (`/categories/[slug]`). Phase 1 data is flowers only; the schema and routes shall support vegetables/herbs later with no structural change.
- **R6 — Search.** The system shall provide (a) autocomplete (client widget, 300 ms debounce, top 10) backed by the API, (b) a full results page at `/search?q=` that works with JavaScript disabled via a plain GET form, and (c) partial/mid-word and typo-tolerant matching via FTS5 trigram (§3.3).
- **R7 — Ratings display, never invention.** Seller rating display shall show **"Not yet rated"** wherever no real ratings exist. The system shall not render star scores, `AggregateRating` JSON-LD, or any numeric rating for any seller in Phase 1. The data model shall store rating aggregates (`rating_count`, `rating_sum`, `rating_average NULL until count > 0`) so real ratings can be added in a later phase.
- **R8 — Public API.** The system shall expose a read-only, versioned REST API under `/api/v1` (§4.2) with an OpenAPI 3.1 contract generated from the same Zod schemas that validate the service layer. The website is the API's first client in architecture (shared service layer), but web pages shall server-render from the service layer directly — **not** by fetching the public API — so crawlability never depends on client fetches.
- **R9 — PWA.** The Phase 1 site shall be an installable PWA per §5: manifest, self-hosted icons, service worker with the specified caching strategies, an `/offline` page, and **self-applying service-worker updates** (no user ever stranded on a stale shell — the Family App lesson).
- **R10 — Redirects.** Legacy v1 URLs shall 308-redirect: `/varieties?v=[slug]` → `/varieties/[slug]`, `/varieties/?v=[slug]` → `/varieties/[slug]`, `/sellers?s=[slug]` → `/sellers/[slug]`, `/sellers/?s=[slug]` → `/sellers/[slug]`.
- **R11 — Data growth without code changes.** Adding a variety, seller, listing, or packet size shall be a data operation (DB insert + on-demand revalidation), never a code change or redeploy. New detail pages shall render on first hit if not pre-generated (`dynamicParams = true`).
- **R12 — Revalidation.** Content edits shall trigger on-demand revalidation (`revalidateTag`/`revalidatePath`) via a token-protected internal route, with a 24 h ISR fallback. Short blanket ISR intervals (e.g. 60 s) are prohibited.

### 1.3 Hard rules (from PROJECT-BRIEF.md — non-negotiable, apply to every task)

- **HR1 — No invented data.** Never invent a price, product URL, SKU, availability, rating, or review for a real business. Prices appear **only** where a source file gives them, always labelled with source + check date. Where no verified price exists: price is `NULL` and the UI shows **"See seller for price"**. Where no verified product URL exists: `productUrl` is `NULL` and the outbound link goes to the seller's homepage.
- **HR2 — No checkout.** No cart, no checkout, no payments, no ordering through this site. Outbound links only.
- **HR3 — No hotlinked images.** No external image URLs anywhere. Phase 1 uses typography + color swatches + generated OG cards. Any future photo must be self-hosted in the project first.
- **HR4 — Accessibility.** WCAG **2.2 AA** throughout, mobile and desktop.
- **HR5 — No patio-series / pot / dwarf dahlia content** and no other Hues standing exclusions are relevant to this catalog (no dahlias in Phase 1 data), but no data may be added that violates Hues' standing rules.
- **HR6 — Test data cleanup.** Any test users/rows created during verification are deleted with all their data when testing is done. (Phase 1 has no user accounts; this applies to any seeded test rows in preview DBs.)

### 1.4 Non-functional requirements

- **NFR1 — Performance budgets (mobile, 4G, 390 pt):** LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on home, variety, and seller templates (Lighthouse mobile, preview deployment).
- **NFR2 — Cost ceiling (Phase 1):** ~$0 marginal / ≤ $6/mo total attributable cost on the existing Workers Paid plan (per V2-DEPLOYMENT-PHASED.md; figures are estimates — ⚠️ flag V11).
- **NFR3 — Portability:** the codebase shall be portable per §3.4 so the Phase 3 DB migration (D1 → Postgres via Hyperdrive) is a 1.5–3 day project, not a rewrite, and the app itself never has to move off Cloudflare Workers.
- **NFR4 — Type safety:** TypeScript `strict: true`; Zod validation of repository **outputs** (bad DB rows fail loudly, not silently); no `any` without a written justification comment.
- **NFR5 — Secrets:** the revalidation token and any future DB credentials live in Worker secrets / Wrangler config, never in code, repo, or this spec.

---

## 2. Design — Project structure

```
seeds-v2/
├── app/                        # App Router
│   ├── layout.tsx              # shell: header, mobile bottom tab bar, fonts, metadata defaults
│   ├── page.tsx                # / (SSG)
│   ├── manifest.ts             # PWA manifest (Next native)
│   ├── sitemap.ts              # dynamic, DB-driven
│   ├── robots.ts
│   ├── llms.txt/route.ts       # GEO: factual markdown for AI crawlers
│   ├── offline/page.tsx
│   ├── varieties/page.tsx      # /varieties
│   ├── varieties/[slug]/page.tsx
│   ├── sellers/page.tsx
│   ├── sellers/[slug]/page.tsx
│   ├── categories/[slug]/page.tsx
│   ├── plants/[slug]/page.tsx
│   ├── search/page.tsx         # SSR
│   ├── api-docs/page.tsx       # human API docs (renders the OpenAPI contract)
│   └── api/
│       ├── v1/…                # public API (§4.2)
│       └── revalidate/route.ts # internal, token-protected (§4.3)
├── components/
│   ├── ui/                     # buttons, cards, badges, price + rating display
│   ├── layout/                 # header, tab bar, footer
│   ├── search/                 # client autocomplete widget
│   ├── variety/  seller/       # page sections
│   └── seo/                    # JSON-LD render components
├── lib/
│   ├── db/                     # Drizzle client init (request-scoped), schema, migrations
│   ├── repositories/           # ONLY layer that touches Drizzle (§3.4)
│   ├── services/               # business logic; called by pages AND route handlers
│   ├── validators/             # Zod schemas — single source of truth for DB rows + API contract
│   ├── seo/                    # metadata + JSON-LD builders
│   └── api/                    # envelope, errors, pagination, cache-header helpers
├── public/
│   ├── sw.js                   # hand-rolled service worker (§5)
│   └── icons/                  # self-hosted PWA + apple-touch icons
├── scripts/
│   ├── precheck-v1.ts          # §6.1 step 1
│   ├── migrate-from-v1.ts      # §6.1 step 2
│   ├── seed-additional.ts      # §6.2 listings
│   └── validate-db.ts          # §6.1 step 5 / §6.2 post-checks
└── tests/                      # unit, API contract, Playwright (§8)
```

Fonts self-hosted via `next/font` (no Google Fonts requests). No dependency may import Node built-ins (`fs`, `path`, `net`, `child_process`) in Worker-executed code — audit at Task 2 (Workers ≠ Node).

---

## 3. Design — Database (D1 + Drizzle, portable to Postgres)

### 3.1 Schema (SQLite dialect in Phase 1; Postgres mapping noted per §3.4)

Core tables: `categories`, `subcategories`, `plants`, `varieties`, `variety_tags`,
`sellers`, `listings`, `listing_packet_sizes`. Future stubs: `users`, `seller_accounts`, `reviews`.

| Table | Key columns / rules |
|---|---|
| `categories` | `id` INTEGER PK, `slug` UNIQUE, `name`, `sort_order`. Seed: `flowers` (vegetables/herbs added as data later). |
| `subcategories` | `id`, `category_id` FK, `slug` UNIQUE per category, `name`. Seed values from v1: `annual`, `annual-climber`, `perennial`. |
| `plants` | `id`, `slug` UNIQUE, `common_name`, `latin_name`, `description NULL`, `sowing_notes NULL` (plant-level guidance only, inherited by varieties — §6.2 note N3), `category_id` FK. Deduped on `(common_name, latin_name)` at migration. Derived from v1: Stock/*Matthiola incana*, Snapdragon/*Antirrhinum majus*, Larkspur/*Consolida ajacis*, Cornflower/*Centaurea cyanus*, Nigella/*Nigella damascena*, Calendula/*Calendula officinalis*, Sweet Pea/*Lathyrus odoratus*, Iceland Poppy/*Papaver nudicaule*, Shirley Poppy/*Papaver rhoeas*, Virginia Stock/*Malcolmia maritima*, Breadseed Poppy/*Papaver somniferum* — plus Sweet Pea and Iceland Poppy plants absorb the §6.2 new varieties. Plant slug = kebab of common name (e.g. `sweet-pea`, `iceland-poppy`). |
| `varieties` | `id`, `plant_id` FK NOT NULL, `slug` UNIQUE (**public identity, preserved verbatim from v1**), `variety_name`, `category_id` FK, `subcategory_id` FK NULL, `description`, `sowing_notes`, `height_cm NULL` (NULL = unknown; never guessed), `color_swatch NULL` (hex), `status` ∈ `active|draft|discontinued` (no hard deletes). Common/Latin names live on `plants`, not duplicated here. |
| `variety_tags` | `variety_id` FK, `tag` — PK `(variety_id, tag)`. From v1 `tags[]`. Indexed on `tag`. |
| `sellers` | `id`, `slug` UNIQUE (preserved from v1), `name`, `type` ∈ `wholesale|retail|specialty`, `homepage`, `description`, `ordering_notes`, `location`, `status` ∈ `active|inactive|pending`, `rating_count` INTEGER DEFAULT 0, `rating_sum` INTEGER DEFAULT 0, `rating_average` REAL NULL (NULL until `rating_count > 0`). |
| `listings` | `id`, `variety_id` FK, `seller_id` FK, `sku NULL`, `product_url NULL` (NULL → link to seller homepage, HR1), `notes`, `status` ∈ `active|inactive|unverified`. **UNIQUE `(variety_id, seller_id)`** — one listing per pair. |
| `listing_packet_sizes` | `id`, `listing_id` FK, `label` (e.g. "Trade Pkt (200 seeds)"), `seed_count NULL` (parsed count where the label states one; NULL if unstated), **`price_cents` INTEGER NULL** (NULL = "See seller for price", HR1), `currency` DEFAULT `'USD'`, `price_source NULL`, `price_check_date NULL` (ISO date), `in_stock` INTEGER boolean-mode NULL (NULL = unknown; stale check-date stock claims are **not** carried as current stock — see §6.2 note N2), `sort_order`. Index on `(listing_id, price_cents)`. Enables `MIN(price_cents)` → "from $X" on cards and price sorting/filtering. **Prices are integer cents everywhere; floats are prohibited** (`Math.round(price * 100)` at migration). |
| `users` (stub, empty) | `id`, `email` UNIQUE, `display_name`, `created_at`. No Phase 1 code path reads/writes it. |
| `seller_accounts` (stub, empty) | `user_id` FK, `seller_id` FK, `role`, PK `(user_id, seller_id)`. |
| `reviews` (stub, empty) | `id`, `user_id` FK, `seller_id` FK, `rating` INTEGER 1–5, `body NULL`, `status` ∈ `pending|approved|rejected`, `created_at`. UNIQUE `(user_id, seller_id)`. Defined now so Phase 2/3 migrations are `ALTER TABLE ADD COLUMN`, not schema surgery. **No orders table is stubbed** — Kiro noted v2 schema does not block adding one in Phase 3. |

General rules: integer internal PKs; **slugs are the only public identifiers** (API + URLs); status enums instead of deletes; indexes on all FKs, `varieties.slug`, `sellers.slug`, listing status, and packet price.

**Timestamps:** any `created_at`/`updated_at` stored as ISO text via Drizzle `text(..., { mode: 'date' })` semantics (portable to `TIMESTAMPTZ`, §3.4). Booleans via Drizzle boolean mode (stored 0/1 in SQLite, native `BOOLEAN` in Postgres) — raw `=== 1` comparisons are prohibited.

### 3.2 Data access — repository / service layer (mandatory)

- All Drizzle access lives in `lib/repositories/*.ts`. Pages, route handlers, and scripts call **`lib/services/*`**, which call repositories. Nothing else imports Drizzle.
- DB client is initialised **inside** the request handler / render scope, never at module scope (⚠️ flag V2 governs the exact context API).
- Repository outputs are Zod-validated (`lib/validators`) so malformed rows fail loudly.

### 3.3 Search — FTS5, isolated

- SQLite **FTS5 virtual table** `varieties_fts` over: plant common name, plant Latin name, variety name, description, tags. **Trigram tokenizer** (partial + mid-word matches, some typo tolerance), kept in sync by triggers on `plants`, `varieties`, `variety_tags`.
- All FTS access is isolated in a single service function **`searchVarieties(q, opts)`** — the one function rewritten in the Phase 3 Postgres migration (→ generated `tsvector` + GIN + `pg_trgm`). No `MATCH` / `bm25()` SQL may appear anywhere else.
- Scale path (recorded, **not built in Phase 1**): evaluate a dedicated search service (Typesense) when faceted filtering is required or the catalog grows large — the two source docs conflict on the trigger (500 varieties in V2-KIRO-SUGGESTIONS vs >5,000 in V2-DEPLOYMENT-PHASED); §10 item C5 records the resolution: **500 varieties triggers an evaluation spike; adoption is a separate decision.**

### 3.4 Portability rules (Phase 3 = DB-only migration — these rules are what keep it at 1.5–3 days)

Phase plan (V2-DEPLOYMENT-PHASED.md, settled): **the app never moves; only the database moves.** Phase 1–2: Workers + D1 (~$0–6/mo). Phase 3 triggers — migrate DB to Postgres via Cloudflare **Hyperdrive** when **any two** hold: D1 > 5 GB; checkout/orders being built; reviews > 50,000 rows; seller self-service > 500 writes/day sustained; a Postgres-only feature is actually needed (`pg_vector`, PostGIS, `LISTEN/NOTIFY`).

Rules for all Phase 1 code:

1. Repository abstraction (§3.2) — migration replaces repository internals only.
2. Drizzle operators, not raw SQL, everywhere except the isolated FTS function.
3. Portable column semantics: boolean mode, ISO/`mode:'date'` timestamps, JSON only via `text(..., { mode: 'json' })`.
4. Integer cents; slugs as public identity (no URL or API changes on migration).
5. Single portable schema with a dialect flag + portable type wrappers — **not** dual schemas.
6. **Prohibited:** `env.DB` outside DB-client init; FTS5 SQL scattered in code; `PRAGMA` in app startup; hand-written `AUTOINCREMENT`; D1 `db.batch()` (no Postgres equivalent — use Drizzle transactions).
7. Known dialect deltas to respect when writing queries (from V2-DEPLOYMENT-PHASED): SQLite `LIKE` is case-insensitive, Postgres is not (use explicit case handling now); `json_extract()` has no Postgres equivalent (goes through rule 3); PK autoincrement and the Drizzle dialect import (`sqlite-core` → `pg-core`) change at migration, app code does not.

---

## 4. Design — Routes + API

### 4.1 Web routes

| Route | Rendering | Notes |
|---|---|---|
| `/` | SSG, ISR 24 h fallback + on-demand | Search widget is a client component; category browse; plant/variety/seller entry points. |
| `/varieties` | SSG, ISR 24 h + on-demand | All active varieties, alphabetical; cards show swatch, plant name, seller count, "from $X" (MIN packet price) where any priced packet exists. |
| `/varieties/[slug]` | SSG via `generateStaticParams`, `dynamicParams = true`, on-demand revalidation + 24 h fallback | Full listing detail per R2. Unknown slug → real 404. |
| `/sellers` | SSG, ISR 24 h + on-demand | Directory; rating display per R7. |
| `/sellers/[slug]` | SSG via `generateStaticParams`, `dynamicParams = true`, on-demand + 24 h fallback | Per R3. Unknown slug → 404. |
| `/categories/[slug]` | SSG, ISR 24 h + on-demand | Includes subcategory groupings. Unknown slug → 404. |
| `/plants/[slug]` | SSG via `generateStaticParams`, `dynamicParams = true`, on-demand + 24 h fallback | Plant grouping per R4. |
| `/search?q=` | **SSR** Server Component | Shareable/crawlable results; the no-JS form target. Empty `q` → browse prompt state, not an error. |
| `/offline` | Static | PWA offline fallback (§5). |
| `/api-docs` | SSG | Human-readable API docs rendered from the OpenAPI contract. |
| 404 / error | Static / boundary | Branded not-found with links to `/varieties` and `/sellers` (no orphans). |

Rendering conflict resolved (§10, C3): Kiro's routing table listed unversioned `/api/search` and `/api/revalidate`. Under the API-first addendum, **autocomplete moves to `/api/v1/search`**; `/api/revalidate` stays unversioned because it is an internal operations route, not part of the public contract.

### 4.2 Public API — `/api/v1` (Phase 1: read-only)

**Contract source of truth:** Zod schemas in `lib/validators` generate the **OpenAPI 3.1** document served at `GET /api/v1/openapi.json` and rendered at `/api-docs`. The same Zod shapes validate service-layer outputs and generate the shared TypeScript types package that Phase 2 native apps will generate their models from. **Breaking changes go to `/api/v2` — v1 never breaks silently for shipped native apps.**

| Endpoint | Returns |
|---|---|
| `GET /api/v1/varieties` | Paginated list. Filters: `category`, `subcategory`, `plant` (slug), `seller` (slug), `tag`. Sort: `name` (default), `price-asc`, `price-desc` (by MIN packet price; unpriced last). |
| `GET /api/v1/varieties/{slug}` | One variety: plant summary, description, sowing notes, height, swatch, tags, and `listings[]` — each with seller summary, `packetSizes[]` (`label`, `seedCount`, `priceCents`, `currency`, `priceSource`, `priceCheckDate`, `inStock`), `sku`, outbound URL (product URL or seller homepage, per HR1). |
| `GET /api/v1/sellers` | Paginated list: slug, name, type, location, rating aggregate fields (`ratingCount`, `ratingAverage` — `null` until real ratings exist), `varietyCount`. |
| `GET /api/v1/sellers/{slug}` | One seller + `listings[]` with variety summaries and packet sizes. |
| `GET /api/v1/categories` | Categories with subcategories and variety counts. |
| `GET /api/v1/categories/{slug}` | One category + its varieties (paginated). |
| `GET /api/v1/plants` | Paginated list: slug, common/Latin names, `varietyCount`. |
| `GET /api/v1/plants/{slug}` | One plant + its varieties (paginated). |
| `GET /api/v1/search?q=` | Autocomplete + search: `q` required (min 1 char after trim); response `results[]` of `{type: 'variety'|'plant'|'seller', slug, title, subtitle, href}` — top **10** by default for autocomplete use; `limit` param (max 50) for fuller result sets. Backed by `searchVarieties()` (§3.3). |
| `GET /api/v1/openapi.json` | The OpenAPI 3.1 contract. |

**Envelope (every response):**
```json
{ "data": …, "meta": { "nextCursor": "…" | null, "count": 0 }, "error": null }
```
Errors: `{ "data": null, "meta": null, "error": { "code": "not_found" | "validation_error" | "rate_limited" | "internal", "message": "…" } }` with the matching HTTP status (404 / 400 / 429 / 500). Unknown slugs → 404 `not_found`, never a 200 with empty data.

**Pagination:** cursor-based on all list endpoints. Params: `cursor` (opaque, from `meta.nextCursor`), `limit` (default **24**, min 1, max **100**; out-of-range → clamped, not an error, except non-numeric → 400). Ordering is stable: varieties/sellers/plants by name then slug; listings by seller name. `meta.nextCursor = null` means last page.

**Caching:** all `GET /api/v1/*` responses carry `ETag` (content hash) and honour `If-None-Match` → `304`. `Cache-Control: public, max-age=300, stale-while-revalidate=86400` for list/detail/search; `openapi.json`: `max-age=3600, stale-while-revalidate=86400`. Responses include an **`X-API-Version: 1`** header. JSON only; slugs are the only public IDs (internal integer PKs never appear in API payloads — packet-size and listing objects are identified by position/relationship, and if an `id` field is exposed it shall be a slug-derived stable string, not the rowid).

**CORS:** `Access-Control-Allow-Origin` restricted to known clients: `https://seeds.hues.flowers` and the preview Worker origin; native-app origins are added by configuration in Phase 2 (native apps do not send browser CORS headers, but no wildcard `*` is permitted on any endpoint, in any phase). `GET`/`HEAD`/`OPTIONS` only in Phase 1 — other methods → 405.

**Rate limiting:** per-IP token bucket at the Worker layer: **120 requests/minute/IP** across `/api/v1/*` (generous for a read-only catalog; native apps cache). Exceeded → 429 `rate_limited` with `Retry-After`. ⚠️ The enforcement mechanism (Workers rate-limit binding vs KV counter vs Cloudflare WAF rule) is chosen at build time and recorded in the Task 1 verification log — it must not require a new paid product without Dustin's approval.

**Auth:** none in Phase 1 (read-only public catalog data). API keys → OAuth arrive with Phase 2/3 write endpoints and are out of scope here (§8).

### 4.3 Internal routes (not public API, not in OpenAPI)

| Route | Rules |
|---|---|
| `POST /api/revalidate` | Bearer token (Worker secret, NFR5). Body: `{ "tags": ["variety:stock-katz-mix", …] }` and/or `{ "paths": ["/varieties/stock-katz-mix"] }`. Calls `revalidateTag`/`revalidatePath`. 401 without token, 400 on malformed body. Exact ISR-cache mechanics governed by ⚠️ flag V1. |
| `GET /api/search` (v1 legacy) | **Not built.** Autocomplete is `/api/v1/search` (§4.1 resolution). |

---

## 5. Design — PWA requirements (Phase 1, mobile-first)

- **P1 — Design target.** Design at **390 pt first** (Dustin's iPhone); desktop is the expanded layout of the same components, never a separate design. One URL, two real layouts (mobile app-like; desktop proper website).
- **P2 — Manifest.** Next.js native `app/manifest.ts`: `name` "seeds.hues.flowers — Seed Finder", `short_name` "Seed Finder", `start_url: "/"`, `display: "standalone"`, theme/background colours from the site palette, icons **192 + 512 + maskable** (self-hosted, generated from the site mark — no external icon services). ⚠️ Verify `manifest.ts` conventions against Next 16.4 docs at build time (flag V12).
- **P3 — Icons / iOS.** `apple-touch-icon` (self-hosted), `apple-mobile-web-app-capable` + status-bar meta, splash handling per current iOS PWA behaviour. No web push in Phase 1 (iOS requires Home Screen install for push; push is Phase 2+).
- **P4 — Service worker.** Hand-rolled `public/sw.js` following the current official Next.js PWA guide (⚠️ flag V10). **`next-pwa` is prohibited** (unmaintained since 2022, breaks on Turbopack). `@serwist/turbopack` may replace the hand-rolled worker **only** if precache needs outgrow it, and only if Task 1 verifies Next 16.4/Turbopack compatibility — the default is hand-rolled.
- **P5 — Caching strategies.**
  - **Precache:** app shell (layout chrome, CSS/JS chunks, icons, `/offline`) at install, cache name versioned with the build (e.g. `seeds-shell-v{build}`).
  - **Pages (variety/seller/category/plant/list):** stale-while-revalidate.
  - **`/api/*`:** network-first with cached fallback (last-good JSON served offline with its original ETag semantics preserved as far as the SW allows).
  - **Static assets (`/_next/static`, fonts, icons):** cache-first, immutable.
  - Seller outbound links and any cross-origin request: **never intercepted**.
- **P6 — Self-applying updates (hard requirement).** The SW is versioned per build; on activation it `skipWaiting()` + `clients.claim()` under the safe pattern verified in Task 26, old caches are deleted on activate, and a waiting worker never strands a user on a stale shell. The update path (deploy N+1 → open installed PWA → new shell without reinstall or manual cache clear) is a §9 acceptance test, learned from the Family App's stale-sheet bug.
- **P7 — Offline.** Offline navigation to an uncached page serves `/offline`; previously visited variety/seller pages and last-good API data remain readable offline. Offline UI states this honestly ("You're offline — showing the last version we saved").
- **P8 — App feel.** Bottom tab bar on mobile: **Home / Varieties / Search / Sellers** (Search focuses the search UI / routes to `/search`), safe-area insets respected, tap targets **≥ 44 pt**, skeleton loading states for search and list transitions, no layout shift from late-loading chrome (CLS budget, NFR1). Tab bar is hidden or adapted in the desktop layout.
- **P9 — Performance budgets** per NFR1 are PWA requirements, not aspirations: they are checked on the preview deployment in §9.
- **P10 — Install UX.** No custom install prompt spam in Phase 1; the browser's native install affordance plus one dismissible hint on the home page (shown once, `localStorage`-remembered) is the maximum.

---

## 6. Design — Data migration (v1 JSON → D1) + additional verified listings

### 6.1 Migration from v1 JSON (scripts in `scripts/`, run in order, all idempotent or fail-fast)

1. **Pre-check (`precheck-v1.ts`):** load `app/data/varieties.json`, `sellers.json`, `listings.json`. Assert counts are exactly **14 / 9 / 14** and zero orphan `varietyId`/`sellerId` references in listings. **Stop on any mismatch** — do not "fix" source data silently; report to Hue.
2. **Migrate (`migrate-from-v1.ts`):** Zod-validate every record against `lib/validators` (the DB schema is authoritative). Insert order: categories → subcategories → **plants (deduped on common + Latin name from variety records)** → varieties (common/Latin names move to the plant row; variety keeps `plant_id`) → `variety_tags` → sellers (rating fields default per §3.1; v1 `rating`/`ratingAverage` are `null` and `ratingCount` is 0 for all 9 sellers — assert this, do not carry any non-null rating) → listings → `listing_packet_sizes` (expand each `packetSizes[]` entry; `price` → `price_cents` via `Math.round(price * 100)`; `price == null` → `price_cents = NULL` with `price_source`/`price_check_date` carried as-is — v1's Reimer listing has null prices with a check date of 2026-11-06, which is valid and must survive).
3. **Slugs preserved verbatim** from v1 `id`s for varieties and sellers (`stock-katz-mix`, `geoseed`, …). Listing slugs are internal only (not exposed per §4.2).
4. **FTS build:** after load, rebuild `varieties_fts` and smoke-test `searchVarieties("sweet pea")` returning both sweet pea varieties.
5. **Post-checks (`validate-db.ts`):** row counts per table; orphan join across listings → packet sizes = 0; spot check **GeoSeed × Katz Mix = 2 packet sizes at 325 and 1360 cents**; spot check Everwilde × Virginia Stock product URL carried over (the only non-null `productUrl` in v1); FTS query above passes.

### 6.2 Additional verified listings — v2 SHALL include these 10

Sourced from `sourcing-list.md` (Ball Seed WebTrack checks 2026-11-08 and 2026-11-13; Onings America found 2026-11-08), all **check-only — nothing was ordered**. These are the Ball Seed + Onings listings that existed in Hues' source files but were never used in v1. Including them takes v2 to **22 varieties / 9 sellers / 24 listings** and gives two v1 varieties their second seller — the directory's compare-all-sellers promise stops being 1-deep for them.

**Conventions for this table:** Ball prices are WebTrack **per-1,000-seed** prices (the source states prices did not vary by pack size within a series); each listing therefore gets exactly **one** packet-size row, label `1,000 seeds`, at the stated per-1,000 price. Derived prices for other pack sizes (e.g. halving for a 500 pack) are **prohibited** (HR1). `productUrl` is `NULL` for all 10 (no product URL is given in the sources → seller homepage link). `sku` is `NULL` for all 10 (no SKU is given). `priceSource` / `priceCheckDate` are as stated per row.

| # | Seller | Variety (slug; **bold** = new variety to create) | Packet row | price_cents | Source / check date | Notes carried into the listing |
|---|---|---|---|---|---|---|
| A1 | Ball Seed (`ball-seed`) | Iceland Poppy — Champagne Bubbles Formula Mix (F1) (`iceland-poppy-champagne-bubbles-mix`, existing) | 1,000 seeds | **2110** | Ball Seed WebTrack, checked 2026-11-08 | Source also lists 5K/25K packs (no per-pack prices given — not created). Source notes GeoSeed's rate is cheaper per 1,000; both listings display independently, no editorialising on the page beyond the data. |
| A2 | Ball Seed | **Iceland Poppy — Spring Fever** (`iceland-poppy-spring-fever`) | 1,000 seeds | **1900** | Ball Seed WebTrack, checked 2026-11-08 | Series name only in source; no description/height given — see note N3. |
| A3 | Ball Seed | **Iceland Poppy — Garden Gnome** (`iceland-poppy-garden-gnome`) | 1,000 seeds | **2670** | Ball Seed WebTrack, checked 2026-11-08 | Series name only in source — see note N3. |
| A4 | Ball Seed | **Sweet Pea — Knee Hi Mix** (`sweet-pea-knee-hi-mix`) | 1,000 seeds | **1740** | Ball Seed WebTrack (seed section), checked 2026-11-13 | Source pack sizes 500 / 1,000 / 10,000 (only per-1,000 price given). Stock at check: **no stock for week 47 (Nov 2026), more available 10 Mar 2027** — carried in listing `notes` with its check date; `in_stock` stays NULL per note N2. Cheapest sweet pea at Ball per source. |
| A5 | Ball Seed | Sweet Pea — Mammoth Mix (`sweet-pea-mammoth-mix`, existing) | 1,000 seeds | **2010** | Ball Seed WebTrack (seed section), checked 2026-11-13 | Series also in 9 single colours (Crimson, Lavender, Scarlet, White, Blue Mid, Blue Navy, Rose Deep, Rose Pink, Salmon Cream) at the same per-1,000 price per source — colours are named in listing `notes`, **not** created as separate varieties (v1 pattern: singles live in notes; see exclusion E5). |
| A6 | Ball Seed | **Sweet Pea — Incense Mix** (`sweet-pea-incense-mix`) | 1,000 seeds | **3320** | Ball Seed WebTrack (seed section), checked 2026-11-13 | No further attributes in source — see note N3. |
| A7 | Ball Seed | **Sweet Pea — Spring Sunshine** (`sweet-pea-spring-sunshine`) | 1,000 seeds | **7300** | Ball Seed WebTrack (seed section), checked 2026-11-13 | Source describes Spring Sunshine + Winter Sunshine as "florist Spencer types, many colours" (~23 colour lines between the two series) — that phrase is the variety description basis; colours not enumerated → notes only, no colour varieties. Variety name has **no "Mix" suffix** in the source; do not add one. |
| A8 | Ball Seed | **Sweet Pea — Winter Sunshine** (`sweet-pea-winter-sunshine`) | 1,000 seeds | **7300** | Ball Seed WebTrack (seed section), checked 2026-11-13 | As A7. **Not** the same series as GeoSeed's Winter Elegance — never merge or cross-link as equivalents. |
| A9 | Ball Seed | **Sweet Pea — Villa Roma Mix** (`sweet-pea-villa-roma-mix`) | 1,000 seeds | **7530** | Ball Seed WebTrack (seed section), checked 2026-11-13 | No further attributes in source — see note N3. |
| A10 | Onings America (`onings-america`) | **Iceland Poppy — Colibri Dolce Vita Pastel Mix** (`iceland-poppy-colibri-dolce-vita-pastel-mix`) | 1,000 seeds (Biancheri foil pack) | **8500** | Onings America ASCFG crop-2026 special, found 2026-11-08 | **Benchmark/special price, not a list price** — the source calls it a "price benchmark … $85 add-on (~$85/1,000)"; `price_source` shall read `Onings America ASCFG crop-2026 special` and the listing `notes` shall carry: "Special-offer benchmark price at check date; tariff surcharge may apply (7.5% noted on the 2026 form). Colibri is PBR-protected — commercial cut-flower production only. Onings America is Biancheri Creazioni's exclusive US agent." Also sold via ShopOningsAmerica per source (no URL given → homepage link, HR1). |

**Notes applying to §6.2:**

- **N1 — New varieties created by this section (8):** `iceland-poppy-spring-fever`, `iceland-poppy-garden-gnome`, `sweet-pea-knee-hi-mix`, `sweet-pea-incense-mix`, `sweet-pea-spring-sunshine`, `sweet-pea-winter-sunshine`, `sweet-pea-villa-roma-mix`, `iceland-poppy-colibri-dolce-vita-pastel-mix`. Existing varieties gaining a listing (2): `iceland-poppy-champagne-bubbles-mix` (Ball), `sweet-pea-mammoth-mix` (Ball). No new sellers — Ball Seed and Onings America already exist in v1.
- **N2 — Stock:** `in_stock` is NULL for all 10. A4's week-47 stock note is a dated check observation, not current availability; it lives in `notes` with its date and shall not be rendered as a live stock badge.
- **N3 — Descriptions for new varieties:** builders shall write descriptions **only** from facts in the source rows above plus the plant layer. `height_cm` is **NULL** for all 8 new varieties (no heights are given in the sources). `color_swatch` is **NULL** (no colours are given, except: A10's "Pastel Mix" and series names do not specify a hex — do not invent one; UI shall render a neutral placeholder swatch for NULL). Sowing notes: variety-level `sowing_notes` stays NULL; the **plant-level** sowing guidance already present in v1 for *Lathyrus odoratus* / *Papaver nudicaule* is stored on the `plants` rows and inherited in display, labelled as plant-level guidance — no new variety-specific growing claims may be written.
- **N4 — Seed script:** these 10 listings are loaded by `seed-additional.ts` after `migrate-from-v1.ts`, with the same Zod validation. `validate-db.ts` post-checks are extended: totals **22 varieties / 9 sellers / 24 listings**; spot checks A5 = 2010 cents, A10 = 8500 cents, A1 = 2110 cents; orphan joins = 0; FTS query "mammoth" returns the Mammoth variety with **2 listings** (Everwilde + Ball).

### 6.3 Excluded — verified in the sources but NOT included in v2 (do not add)

| # | Item | Reason for exclusion |
|---|---|---|
| E1 | Ball Seed × Colibri Iceland Poppy | **Verified absence:** WebTrack checked 2026-11-08 — Ball does not carry Colibri in any form (every "Colibri" hit is Calibrachoa Colibri). A listing would be fabrication (HR1). |
| E2 | Ball Seed × Champagne Bubbles **plugs** (Gro 'n Sell 128s, $465/1,000 plugs) | Plugs, not seed. This is a seed directory; plug pricing/units must not be mixed into seed listings. |
| E3 | Onings America × Colibri **plugs** (128-cell trays $88.75/tray, 3 trays/box, packing $9.25/box, freight extra) | Plugs, not seed — as E2. (Plug data belongs to Hues' plug sourcing, not this catalog.) |
| E4 | Onings America × Colibri **individual-colour seed foil packs** + other Colibri mixes | Existence verified ("foil packs of 1,000 seeds, individual colours + Dolce Vita / La Dolce Vita mixes") but the source does **not** enumerate which colours are sold as seed (the colour list in the source is from the **plug** order form) and gives no prices for them. Only the priced Dolce Vita Pastel Mix (A10) is fully verified. Revisit when a seed-specific Onings list is on file. |
| E5 | Ball Seed sweet pea **single colours** as separate varieties (Mammoth's 9 colours; ~23 Sunshine colour lines) | Series-level per-1,000 pricing is verified, but v1's established pattern — followed by every GeoSeed listing — is mix-level varieties with singles named in listing `notes`. Creating 30+ colour varieties from a summary line would outrun the source detail (no per-colour SKUs/stock in the files). Named in notes (A5, A7, A8) instead. |
| E6 | Dianthus 'Kiwi Mellow Cool' via Ball (Tagawa liner tray $341.34, Gro 'n Sell $1.65/plug, Selecta cuttings $0.47/cutting) and via Farmer Bailey ($110 / 50-plug half tray) | **Plugs/liners/cuttings only — no seed exists** for this variety (source is explicit). Not a seed listing in any form. |
| E7 | Johnny's Selected Seeds listings (GeoSeed order list §F, checked 2026-11-05 — 23 compared crops with production-pack prices) | **Scope decision, not a data gap.** Johnny's *was* sourced, and the brief's starter dataset names Johnny's as a seller entry with no listings "until sourced" — but the v1-gap flagged for v2 named **Ball Seed + Onings** specifically. Adding ~23 Johnny's listings is a data-expansion decision for Dustin, recorded as conflict C6 (§10). Johnny's remains a seller row with no listings in v2 until he rules. |
| E8 | Dustin's nine specialty sweet peas (King's Ransom, Clementine Kiss, Emma, Wild Swan, Bix, Susan Burgess, Blue Shift, Gerry Cullinan, Raspberry Flake) at Ball / GeoSeed / Everwilde | **Verified absence** at all three (checked 2026-11-13). No varieties or listings may be created for them from these sources. |
| E9 | Everwilde Royal Family Mix / Early Multiflora Mix sweet peas; Silver Falls and Todd's sweet peas; Silver Falls Russell lupines | Mentioned in `sourcing-list.md` in summary form (e.g. Royal Family 1 lb $66 / 5 lb $297) but **outside the flagged Ball + Onings inventory** this section was scoped to, and several lack the per-variety packet detail v1 listings carry. Not included; candidates for a future sourced-data pass with the same verification standard. Silver Falls / Todd's are also **not v1 sellers** — adding sellers is out of this section's scope. |

---

## 7. Design — SEO / GEO complete checklist

Every item is mandatory unless marked optional; §9 verifies them from **raw HTML** (no-JS fetch), not from the hydrated DOM.

- **S1 — Metadata system.** Next Metadata API: root defaults in `app/layout.tsx`; per-route `generateMetadata()` for variety/seller/category/plant. Title template: `%s | seeds.hues.flowers`. Variety title pattern: `{VarietyName} {CommonName} Seeds — Compare Sellers & Prices`. Seller pattern: `{SellerName} — Seed Seller`. Descriptions are factual and data-derived: a variety description shall state **"Available from N supplier(s)"** with the real count. No keyword stuffing, no invented claims (HR1 applies to metadata).
- **S2 — Canonicals.** Every indexable page carries a self-referencing absolute canonical (`https://seeds.hues.flowers/…`) via `metadataBase` + per-route canonical. `/search?q=` is canonical to `/search` (query variants are not separate indexable pages; the SSR page itself remains crawlable/shareable). API routes are not canonicalised (they are not pages).
- **S3 — Open Graph / Twitter.** `summary_large_image` cards on all page types. **Generated OG images** via an ImageResponse route (variety/seller name + color swatch + site mark) — no photos, no hotlinks (HR3). OG image dimensions explicit (1200×630). ⚠️ ImageResponse on the OpenNext/Cloudflare runtime is verified in Task 1 (flag V13).
- **S4 — JSON-LD per route type** (built by `lib/seo` helpers, rendered server-side):
  - **Home:** `WebSite` + `SearchAction` (target `/search?q={query}`).
  - **Variety:** `Product` (name = "{VarietyName} {CommonName} seed", category, description) with one **`Offer` per listing × packet size** — `price` (from `price_cents`, decimal string), `priceCurrency: "USD"`, `seller` as `Organization`, `url` = outbound product URL or seller homepage, `priceValidUntil` = price check date + 12 months **only where a check date exists**; `availability` **only where stock is actually known** (in Phase 1 data it is unknown → omit the field entirely). Plus `BreadcrumbList` (Home → Category → Plant → Variety). Plus `FAQPage` generated from sowing notes / growing facts (question/answer pairs derived only from existing variety + plant fields — no invented Q&A).
  - **Seller:** `Organization` (+ `PostalAddress` from the `location` field, parsed conservatively — city/state only as given; no invented street addresses).
  - **List pages (`/varieties`, `/sellers`, category, plant):** `ItemList` with real positions and URLs.
  - **PROHIBITED in Phase 1:** `AggregateRating` and `Review` JSON-LD anywhere (R7 — no real ratings exist). This prohibition is a §9 grep-level check.
- **S5 — Sitemap.** Dynamic `sitemap.ts` generated from the DB: home, all list pages, every active variety/seller/category/plant URL, each with `lastModified` where a real date exists. Single sitemap in Phase 1; code structured for `generateSitemaps()` chunking (50 k URLs) at scale. Draft/discontinued varieties and inactive sellers are excluded.
- **S6 — Robots.** `robots.ts`: allow all crawlers including AI crawlers (GEO goal is to be cited); disallow `/api/` for search-engine indexing purposes is **not** applied to AI crawlers via robots (API is JSON, not pages — leave `/api/` crawlable-but-noindexed by content type; do not block `llms.txt`). Sitemap URL declared.
- **S7 — llms.txt (GEO).** `/llms.txt` route returns factual markdown: what the directory is, the data model in plain language, **how verified prices work (source + check date shown with every price)**, the "Not yet rated" policy, and links to key pages + the OpenAPI document. Generated from the DB/site config, not a static hand-written file that can drift.
- **S8 — Price trust signal (SEO + GEO).** Every displayed price, everywhere (pages, cards, API-driven UI), is accompanied by its source + check date in the form **"Verified 2026-11-04 · GeoSeed Catalog 2026–27"**. Unpriced packet sizes show "See seller for price" with no date. This is a trust signal for human readers and AI answer engines alike — it is a design requirement, not a nicety.
- **S9 — Internal linking.** Full mesh: variety ↔ its sellers ↔ its plant ↔ its category; seller ↔ its varieties; no orphan pages (every active variety/seller reachable from its list page and at least one other context). Outbound seller links: `rel="noopener noreferrer"`, **not** `nofollow` (genuine editorial references), with descriptive anchors ("View Katz Mix Stock at GeoSeed", never "click here").
- **S10 — Semantic HTML.** Landmarks (`header/nav/main/footer`), `article` for variety/seller detail, `dl/dt/dd` for spec facts (height, Latin name, packet data), real heading hierarchy, skip link. Supports WCAG (HR4) and machine extraction (GEO) simultaneously.
- **S11 — Core Web Vitals mechanics.** Server-rendered HTML (no fetch-then-render), `next/font` with `display: swap`, inline SVG/CSS swatches (no image requests for swatches), explicit dimensions on any raster image (icons/OG excepted by format), prefetch via `<Link>` (also serves §1.1 navigation).
- **S12 — Redirects.** R10's 308s implemented in `next.config.ts` (query-string matching) or middleware-equivalent verified at Task 23 — ⚠️ the exact mechanism for query-based 308s on Next 16.4/OpenNext is verified then; behaviour (status 308, correct target, slug preserved) is what §8 tests, not the mechanism.
- **S13 — No regression vs v1.** v1's existing meta description/canonical intent for the home page ("Find where to buy any flower seed") is carried forward in substance.

---

## 8. Explicitly out of scope (Phase 1 — do not build, do not stub UI for)

1. **Checkout, cart, payments, ordering** of any kind (HR2). Stripe/marketplace payments are Phase 3.
2. **User accounts** — no sign-up, login, profiles, or auth of any kind. (`users`/`seller_accounts` tables exist as empty schema stubs only.)
3. **Review / rating submission** — no forms, no endpoints, no moderation UI. Display-only "Not yet rated" (R7). (`reviews` table is an empty stub only.)
4. **Native apps themselves** — iOS/Android are Phase 2. Phase 1 delivers only the API + contract they will consume (§4.2).
5. **Marketplace features** — seller self-service, seller dashboards, order management, commissions (Phase 3).
6. **Seller/product admin UI** — data changes in Phase 1 are made by migration/seed scripts and direct DB operations by Hue, not a built admin panel.
7. **Web push notifications** (Phase 2+).
8. **A dedicated search service** (Typesense/Algolia/Meilisearch) — FTS5 only (§3.3).
9. **AWS resources of any kind**, and any move of the app off Cloudflare Workers.
10. **Photos of varieties/sellers** — no image pipeline in Phase 1 (HR3); swatches + generated OG cards only.
11. **Vegetable/herb catalog content** — routes/schema support it; no such data is seeded in Phase 1.
12. **Johnny's Selected Seeds listings as new v2 data** — see §6.3 exclusion E7 (scope decision, recorded as conflict C6).

---

## 9. Acceptance criteria / verification checklist (Hue's run — all on the preview Worker)

The build is **not done** until every box passes on the deployed preview, verified live — never by file match alone. Any failure is reported with the failing check, not worked around silently.

### 9.1 ⚠️ VERIFY flags — resolution gate (Task 1, before build tasks rely on them)

Each flag is resolved against the **pinned** `@opennextjs/cloudflare` and Next 16.4 docs (and vendor pricing pages where relevant) and recorded in `seeds-v2/VERIFICATION-LOG.md` with: claim, source checked (URL + date), verdict (confirmed / corrected / rejected), and the design fallback adopted if corrected. Flags marked *record-only* affect rejected alternatives or Phase 3 budgeting — they still get a logged verdict, but no Phase 1 code depends on them.

| # | Flag (source doc) | What to verify |
|---|---|---|
| V1 | ISR cache on Workers (Kiro suggestions + phased plan) | Does the pinned OpenNext Cloudflare adapter use **KV as the ISR cache** (`NEXT_CACHE_WORKERS_KV`)? Must on-demand revalidation be called from a Worker holding that binding? Configure exactly per the pinned docs. |
| V2 | Cloudflare context API (Kiro suggestions) | Correct import for the pinned adapter — `getCloudflareContext` (current OpenNext) vs Kiro's `getRequestContext()` from `@cloudflare/next-on-pages`. Use the pinned adapter's API; DB client init inside request scope either way. |
| V3 | View Transitions (Kiro suggestions, flagged by Hue) | Kiro's `<ViewTransitions />` snippet from `next/navigation` — confirm the real Next 16.4 View Transitions API before using any of it. If unverifiable, ship without View Transitions (§1.1 does not require them). |
| V4 | D1 partial indexes (Kiro suggestions, flagged by Hue) | Does D1/SQLite support the partial indexes Kiro's schema sketch assumed? Design indexes that exist either way; log the verdict. |
| V5 | Amplify Next.js support (phased plan) — *record-only* | Confirm Amplify's current Next version + on-demand ISR/streaming support. Expected verdict: still disqualifying; Amplify stays rejected. |
| V6 | Aurora Serverless v2 0-ACU pause (phased plan) — *record-only* | Availability for this AWS project in us-east-2 + resume latency. Phase 3 alternative only. |
| V7 | Hyperdrive pricing (phased plan) — *record-only for Phase 1* | Current Hyperdrive pricing (Kiro used ~$7/mo). Needed for Phase 3 budgeting, not Phase 1. |
| V8 | D1 10 GB limit (phased plan) | Any increase path on non-Enterprise plans; confirm the §3.4 trigger math (migrate at 5 GB) still holds. |
| V9 | Lambda@Edge PNW placement (phased plan) — *record-only* | AWS-path comparison only. |
| V10 | PWA service-worker path (design addendum) | The current official Next.js PWA guide's hand-rolled `public/sw.js` pattern on Next 16.4 + Turbopack, and `@serwist/turbopack` compatibility if considered (P4). `next-pwa` stays prohibited regardless. |
| V11 | All dollar figures (phased plan) | Kiro's per-phase costs are estimates (its web search was blocked). Sanity-check Workers/D1/KV, Lambda/CloudFront, RDS, Neon pricing pages; log actuals. NFR2 is judged against the logged figures. |
| V12 | Manifest conventions (design addendum) | `app/manifest.ts` fields/icons behaviour on Next 16.4, incl. maskable icon handling. |
| V13 | OG image generation (this spec, S3) | `ImageResponse` (next/og) works on the pinned OpenNext/Cloudflare runtime at acceptable latency; fallback if not: pre-generated static OG cards at build time from the same templates. |

### 9.2 Live route checks (preview URL, real HTTP)

- [ ] `GET /` → 200; `/varieties`, `/sellers` → 200.
- [ ] All **22** variety pages and all **9** seller pages → 200 (enumerated from the API/sitemap, not sampled).
- [ ] Category page(s) and all **11** plant pages → 200.
- [ ] `/varieties/does-not-exist`, `/sellers/does-not-exist`, `/plants/does-not-exist`, `/categories/does-not-exist` → real **404**.
- [ ] `/search?q=sweet+pea` → 200 SSR results incl. both v1 sweet pea varieties; `/search` (no q) → 200 prompt state.
- [ ] **308s:** `/varieties?v=stock-katz-mix` → 308 → `/varieties/stock-katz-mix`; `/varieties/?v=sweet-pea-mammoth-mix` → 308 → `/varieties/sweet-pea-mammoth-mix`; `/sellers?s=geoseed` → 308 → `/sellers/geoseed`; `/sellers/?s=ball-seed` → 308 → `/sellers/ball-seed`.
- [ ] `/offline` → 200. `/sitemap.xml`, `/robots.txt`, `/llms.txt` → 200 with DB-derived content (sitemap URL count = home + lists + 22 varieties + 9 sellers + categories + 11 plants).
- [ ] **No full reload:** Playwright session — navigate Home → Varieties → a variety → Sellers → a seller via tab bar/links; assert no full document reload occurred (shell persists; document navigation count stays 1) and the back button restores prior views.

### 9.3 Raw-HTML metadata checks (no-JS fetch, e.g. `curl`)

- [ ] Home: `<title>`, meta description, canonical, OG tags, `WebSite`+`SearchAction` JSON-LD present in raw HTML.
- [ ] One variety page per data shape: (a) priced GeoSeed variety — title pattern, canonical, `Product`+`Offer`(s) with correct decimal prices, `BreadcrumbList`, `FAQPage`; (b) Reimer Breadseed Poppy — `Offer`(s) **without** price fields (null prices) and "See seller for price" in HTML; (c) Ball Colibri page (A10) — price 85.00 with the ASCFG source label.
- [ ] One seller page: `Organization` JSON-LD; list pages: `ItemList`.
- [ ] **Prohibition grep:** raw HTML of every template + full preview crawl contains **no** `AggregateRating`, no `Review` JSON-LD, no star-score markup; every seller shows "Not yet rated".
- [ ] Every rendered price in raw HTML is accompanied by its "Verified {date} · {source}" string (S8) — check on variety page, list card ("from $X" uses the MIN packet's source/date), and seller page.
- [ ] OG image URL on a variety page returns 200 `image/png` (or the V13 fallback format).

### 9.4 API contract tests (automated, run against preview)

- [ ] `GET /api/v1/openapi.json` → 200, parses as OpenAPI 3.1, and documents every endpoint in §4.2 — no undocumented endpoints, no phantom ones.
- [ ] Envelope shape on list + detail + error responses; unknown slug → 404 `not_found` body; malformed `limit` → 400.
- [ ] Pagination: `limit=5` walk through `/api/v1/varieties` via `nextCursor` returns all 22 exactly once, stable order, final `nextCursor = null`; `limit` clamps at 100.
- [ ] Filters: `?seller=ball-seed` on varieties returns exactly the 9 Ball-listed varieties; `?plant=sweet-pea` returns all sweet pea varieties (2 v1 + 5 new = 7).
- [ ] ETag: repeat GET with `If-None-Match` → 304. `Cache-Control` and `X-API-Version: 1` headers present per §4.2.
- [ ] CORS: `Origin: https://seeds.hues.flowers` allowed; a random origin is **not** reflected; no `*` anywhere. `POST` to a v1 endpoint → 405.
- [ ] Rate limit: scripted burst > 120 req/min from one IP → 429 with `Retry-After` (test rows/config cleaned up after, HR6).
- [ ] Search: `/api/v1/search?q=mammoth` → the Mammoth variety; partial query `?q=champagne` and a mid-word query (e.g. `?q=butterfly`) return sensible results (FTS trigram); `limit` respected.
- [ ] Contract stability: response field names match the Zod/OpenAPI schema exactly (contract test compares live payloads to the generated schema).

### 9.5 PWA tests (real device or faithful emulation at 390 pt)

- [ ] Manifest fetched and valid; install prompt/install completes on Android emulation **and** iOS Add-to-Home-Screen flow opens standalone with correct name/icons (no hotlinked icon URLs).
- [ ] Service worker registers, precaches the shell; airplane-mode reload of a visited variety page serves the SWR copy; airplane-mode navigation to an unvisited page serves `/offline`; API network-first fallback returns last-good JSON offline.
- [ ] **Update test (P6):** with the PWA installed/open on build N, deploy build N+1 to preview; reopen — the new shell/content appears **without** reinstall, manual cache clear, or a stranded stale version. This test is pass/fail for the whole PWA section.
- [ ] Bottom tab bar: all four tabs work, ≥ 44 pt targets, safe-area inset respected (no content under the home indicator), tab bar does not cause CLS.
- [ ] 390 pt layout pass on home / variety / seller / search: no horizontal scroll, no clipped cards, price + source/date lines wrap cleanly.

### 9.6 Data accuracy spot checks (against source files — the HR1 audit)

- [ ] DB totals: **22 varieties / 9 sellers / 24 listings**; orphan joins = 0; FTS rebuilt.
- [ ] GeoSeed × Katz Mix: 325 / 1360 cents, source "GeoSeed Catalog 2026–27", date 2026-11-04 (unchanged from v1).
- [ ] Ball × Mammoth Mix: 2010 cents, source Ball Seed WebTrack, date 2026-11-13; the same variety page also shows the Everwilde listing with its 4 packet sizes/prices from v1 — **two sellers, one page**.
- [ ] Ball × Champagne Bubbles: 2110 cents (2026-11-08) alongside GeoSeed's 335/1440 — both shown, neither overwritten.
- [ ] Onings × Colibri Dolce Vita Pastel Mix: 8500 cents, source label names the ASCFG crop-2026 special, notes carry the benchmark + tariff + PBR text from A10.
- [ ] Ball × Knee Hi Mix: notes carry the dated week-47 stock observation; **no** live stock badge rendered; `in_stock` is NULL in the API payload.
- [ ] Reimer × Breadseed Poppy: all packet prices null → "See seller for price" everywhere, no price in JSON-LD.
- [ ] Everwilde × Virginia Stock: the v1 product URL is the outbound link (only pre-existing verified product URL); all other listings link to seller homepages.
- [ ] New varieties (§6.2 N1): `heightCm` null and absent from rendered spec lists; no invented hex swatches; no variety-specific sowing claims beyond plant-level inherited guidance.
- [ ] Exclusions audit (§6.3): no Colibri listing under Ball; no plug prices anywhere in the DB; no Johnny's listings; none of the nine specialty sweet peas exist as varieties.

### 9.7 Accessibility + performance

- [ ] axe (or equivalent) run on home / variety / seller / search / offline at 390 pt and desktop: **zero critical/serious** violations; manual keyboard pass (tab order, focus visible, search operable) and a screen-reader smoke pass on one variety page. WCAG 2.2 AA judgement recorded.
- [ ] Lighthouse mobile (preview, 4G throttling) on home / variety / seller: **LCP < 2.5 s, CLS < 0.1**, INP < 200 ms measured via field-style interaction test or lab proxy — figures recorded in the delivery report, not just "passed".

### 9.8 Delivery

- [ ] README in `seeds-v2/`: how to run locally, how preview deploys work, how to add a variety/seller/listing (data operation + revalidation call), the schema summary, and a pointer to this spec + `VERIFICATION-LOG.md`.
- [ ] Delivery report to Dustin: preview URL, §9 results summary, logged V-flag verdicts that changed the design, and the §10 items still awaiting his ruling (notably C6). **Production cutover to `seeds.hues.flowers` is a separate, later approval — not part of build completion.**

---

## 10. Conflicts found in the sources (and how this spec resolves them)

- **C1 — v1 brief vs v2 docs (scope + stack + phases).** PROJECT-BRIEF.md specifies a static/JSON site, "No AWS resources in v1", build in `app/` with specs in `.kiro/specs/`, and uses "Phase 1" for the directory itself. The v2 docs supersede all of that (Next.js on Cloudflare, `seeds-v2/`, phases = 1 PWA → 2 native → 3 marketplace). **Resolution:** v2 docs win everywhere; the brief still governs owner intent and hard rules (§1.3). This spec lives at `~/workspace/seeds-hues/V2-BUILD-SPEC.md` alongside the other v2 docs, not in `.kiro/specs/`.
- **C2 — Database decision: open vs settled.** V2-KIRO-SUGGESTIONS.md ends with "Decision needed: D1 or Neon?" and says switch to Neon only if Postgres-only features are needed *or the app moves off Cloudflare*. V2-DEPLOYMENT-PHASED.md settles it differently: D1 now, Postgres via **Hyperdrive** at marketplace triggers, **app never moves**. **Resolution:** the phased plan wins (§3.4); the suggestions doc's schema/SEO content is adopted, its open decision and its app-move framing are not.
- **C3 — API route versioning.** Kiro's routing table: unversioned `/api/search`, `/api/revalidate`. Design addendum: everything public under `/api/v1` with an OpenAPI contract. **Resolution:** §4.1/§4.3 — autocomplete is `/api/v1/search`; `/api/revalidate` stays unversioned as an internal route.
- **C4 — Migration validation counts.** Kiro's migration post-checks validate 14/9/14 only. This spec adds 10 listings + 8 varieties (§6.2). **Resolution:** two-stage validation — §6.1 checks 14/9/14 after the v1 migration; §6.2 N4 checks 22/9/24 after the additional seed. Both stages must pass in sequence.
- **C5 — Search-service trigger.** Suggestions: add Typesense at ~500 varieties or when facets are needed. Phased plan: Postgres FTS in Phase 3, Typesense only if >5,000 varieties. **Resolution:** §3.3 — 500 varieties (or a faceting requirement) triggers an *evaluation spike*; no adoption is pre-committed.
- **C6 — Johnny's: sourced but excluded (needs Dustin's ruling).** The brief lists Johnny's among sellers "with no listings until sourced"; the GeoSeed order list §F then *did* source Johnny's (2026-11-05, 23 crops, production prices). Yet the v1 gap flagged for v2 named only Ball + Onings. **Resolution:** excluded from v2 (§6.3 E7) pending Dustin's explicit ruling; flagged in the §9.8 delivery report. This is the one conflict this spec deliberately does **not** finally settle.
- **C7 — Colibri price precision.** The source gives "~$85" as a *benchmark* from a special add-on offer; the directory model stores exact cents. **Resolution:** A10 stores 8500 with a source label that names the special and notes that carry the benchmark/tariff caveats — the price is never presented as a list price.
- **C8 — Ball pack sizes vs per-1,000 pricing.** Sources list Ball packs (500/1,000/10,000; 1K/5K/25K) but only per-1,000 prices. **Resolution:** §6.2 conventions — one packet row per listing at the verified per-1,000 price; derived per-pack prices are prohibited fabrication.
- **C9 — Two different "phase" axes.** Phased plan: Phase 1 launch / 2 traction / 3 marketplace (infrastructure). Design addendum: Phase 1 PWA / 2 native / 3 marketplace (product). **Resolution:** this spec uses the product phases for scope; infrastructure Phase 1–2 both live inside product Phases 1–2, and the DB-migration trigger (§3.4) coincides with product Phase 3. Where a source says "Phase 3" about the DB, it means the same marketplace moment.
- **C10 — v1 data quirks.** (a) Reimer's listing carries a `priceCheckDate` with all prices null — valid, preserved (§6.1 step 2). (b) v1 sellers carry `rating` + `ratingAverage` + `ratingCount` fields; the v2 schema uses `rating_count`/`rating_sum`/`rating_average` — migration maps them and asserts all-null/zero (§6.1 step 2). (c) v1 varieties embed common/Latin names per variety; v2 moves them to `plants` — varieties sharing a plant (3 snapdragons, 2 sweet peas in v1; more after §6.2) must dedupe to one plant row each.
- **C11 — Cost figures are estimates.** The phased plan's per-phase dollars (and its "~$0.50 KV ISR cache" line) are Kiro estimates from a session with web search blocked. **Resolution:** V11 (§9.1) — vendor-checked at build time; NFR2 judged on logged figures, and no cost in this spec is a quote.

---

## 11. Tasks (Kiro task list — execute in order; a task is done when its stated check passes)

### A. Verification gates + setup
1. **Pin versions + resolve ⚠️ VERIFY flags.** Pin Next.js 16.4.x (latest patch), React 19.3, `@opennextjs/cloudflare` (exact patch). Resolve V1–V13 (§9.1) against the pinned docs; write `seeds-v2/VERIFICATION-LOG.md`. *Gate: no later task may rely on an unresolved flag — adopt the logged fallback instead.*
2. **Scaffold `seeds-v2/`.** Next 16.4 App Router + TS `strict` + Tailwind 4 per §2 structure; Wrangler config for the preview Worker + D1 binding (+ KV if V1 requires it); audit all dependencies for Node built-in imports in Worker code. *Check: `next build` of the empty shell succeeds; dependency audit logged.*
3. **Tooling.** ESLint, Vitest, Playwright, `typecheck` + a single local `verify` script running lint + types + unit tests. *Check: verify script green on the scaffold.*

### B. Database
4. **Core schema.** Drizzle D1 schema for §3.1 core tables + indexes + status enums; first migration; local D1 (Wrangler) running. *Check: migration applies cleanly to a fresh local D1.*
5. **Stub tables + rating aggregates.** `users`, `seller_accounts`, `reviews` per §3.1 (empty, unused by app code); seller rating columns with NULL-average rule. *Check: schema test asserts `rating_average IS NULL` when `rating_count = 0`.*
6. **FTS5 search.** `varieties_fts` (trigram) + sync triggers + the single isolated `searchVarieties()` service function (§3.3). *Check: unit tests — partial, mid-word, and plant-name queries return expected rows.*
7. **Repository + service layer.** `lib/repositories` + `lib/services` + Zod output validation (§3.2); portability guardrails (§3.4) enforced by grep-level tests: no `env.DB` outside DB init, no `db.batch(`, no raw SQL outside the FTS module, no float prices. *Check: guardrail tests pass; a deliberately bad DB row fails validation loudly in a test.*

### C. Data migration
8. **`precheck-v1.ts`** per §6.1 step 1 (counts 14/9/14, zero orphans, fail-fast). *Check: script passes on the real v1 JSON; tampered copy fails.*
9. **`migrate-from-v1.ts`** per §6.1 steps 2–4 (plants dedupe, cents conversion, slugs verbatim, FTS rebuild). *Check: §6.1 step 5 spot checks pass (Katz 325/1360; Virginia Stock product URL; "sweet pea" FTS).* 
10. **`seed-additional.ts`** — the 10 listings + 8 new varieties of §6.2 (A1–A10, notes N1–N4 applied literally, including A10's note text and A4's dated stock note). *Check: §6.2 N4 spot checks (A5 = 2010, A10 = 8500, A1 = 2110).*
11. **`validate-db.ts`** — full post-checks: totals **22/9/24**, orphan joins = 0, exclusions audit queries (no Ball×Colibri, no plug prices, no Johnny's listings) return empty. *Check: validator green end-to-end from a fresh DB built by Tasks 8–10 in sequence.*

### D. API
12. **API foundation.** Envelope/error helpers, cursor pagination, ETag/Cache-Control, `X-API-Version`, CORS allowlist, rate limiting (mechanism chosen + logged per §4.2). *Check: unit tests for envelope, clamping, 304 handling.*
13. **Variety + seller endpoints.** `GET /api/v1/varieties` (+ filters/sorts), `/varieties/{slug}`, `/sellers`, `/sellers/{slug}` per §4.2 shapes. *Check: payloads validate against the Zod schemas; unknown slug → 404 body.*
14. **Category, plant, search endpoints.** `/api/v1/categories`, `/categories/{slug}`, `/plants`, `/plants/{slug}`, `/search` per §4.2. *Check: `?seller=ball-seed` → 9 varieties; `?q=mammoth` → Mammoth with 2 listings.*
15. **OpenAPI + docs + shared types.** Generate OpenAPI 3.1 from Zod; serve `/api/v1/openapi.json`; render `/api-docs`; emit the shared TypeScript types package. *Check: contract parses as 3.1 and covers every §4.2 endpoint exactly.*
16. **API contract tests.** Automated suite per §9.4 (envelope, pagination walk, ETag 304, CORS, 405, 429, search) runnable against any base URL. *Check: suite green against local dev server.*
17. **Revalidation.** `POST /api/revalidate` (token-protected) + tag taxonomy (`variety:{slug}`, `seller:{slug}`, `list:varieties`, `list:sellers`, `plant:{slug}`, `category:{slug}`) wired to §4.1 routes. *Check: edit a price in a scratch DB → revalidate → preview page shows the new price without redeploy; 401 without token.*

### E. Web routes + UI (mobile-first, 390 pt)
18. **Root shell.** `layout.tsx`: header, mobile bottom tab bar (Home / Varieties / Search / Sellers, ≥ 44 pt, safe-area), desktop expanded layout, self-hosted fonts, skip link, metadata defaults. *Check: shell persists across client navigations (Playwright, §9.2 method).*
19. **UI kit.** Cards, `PriceDisplay` (S8 source/date format + "See seller for price"), `RatingDisplay` ("Not yet rated" only), swatch incl. NULL-swatch placeholder, skeletons, badges. *Check: component tests render every price shape (priced / null / multi-packet "from $X").*
20. **Home + search widget.** SSG home per R1; client autocomplete (300 ms debounce → `/api/v1/search`, keyboard navigable) + plain GET form to `/search` for no-JS. *Check: search works with JavaScript disabled (form path) and enabled (widget path).*
21. **Variety pages.** `/varieties` index + `/varieties/[slug]` (`generateStaticParams`, `dynamicParams = true`) per R2 — all listings, packet table, plant/category links. *Check: Mammoth page shows both sellers; Colibri page shows A10 notes; Reimer page shows no prices.*
22. **Seller, category, plant pages.** `/sellers`, `/sellers/[slug]`, `/categories/[slug]`, `/plants/[slug]` per R3–R5. *Check: Ball seller page lists its 9 varieties; Sweet Pea plant page lists 7 varieties.*
23. **Legacy 308 redirects.** `/varieties?v=` / `/varieties/?v=` / `/sellers?s=` / `/sellers/?s=` → clean URLs, status **308**, slug preserved (mechanism verified against Next 16.4/OpenNext per S12). *Check: the four §9.2 redirect cases return 308 + correct `Location`.*
24. **Search page, offline, errors.** `/search` SSR (shareable, empty-q state), `/offline`, branded 404 + error boundaries. *Check: §9.2 route cases pass.*

### F. PWA
25. **Manifest + icons.** `app/manifest.ts` per P2; self-hosted 192/512/maskable + apple-touch icons; iOS meta per P3. *Check: manifest validates; icons served from our origin only.*
26. **Service worker.** Hand-rolled `public/sw.js` per P4/P5 (precache shell, SWR pages, network-first API, cache-first statics, no cross-origin interception) with the **self-applying update pattern** of P6 (versioned caches, activate-time cleanup, skipWaiting + clients.claim as verified in Task 1). *Check: SW registers; strategies verified in DevTools/Playwright offline runs.*
27. **PWA test pass.** Installability, offline behaviour, and the N → N+1 **update test** on the preview deployment per §9.5. *Check: all §9.5 boxes pass; the update test result is recorded explicitly.*

### G. SEO / GEO
28. **Metadata system.** Root defaults + per-route `generateMetadata`, title patterns, canonicals per S1/S2. *Check: §9.3 raw-HTML cases for home + one variety.*
29. **OG cards.** ImageResponse route per S3 (or the V13 logged fallback). *Check: OG URL returns a valid image on the preview Worker.*
30. **JSON-LD.** `lib/seo` builders + per-route rendering per S4, including the `AggregateRating`/`Review` prohibition test. *Check: §9.3 JSON-LD cases pass; prohibition grep is clean across templates.*
31. **Sitemap, robots, llms.txt.** DB-generated `sitemap.ts`, `robots.ts`, `/llms.txt` per S5–S7. *Check: sitemap count matches §9.2 expectation; llms.txt content reviewed against the live data model.*
32. **Linking + semantics pass.** Internal-link mesh audit (no orphans), semantic HTML/dd-dl spec facts, outbound-link `rel` + anchor text per S9/S10. *Check: crawl of the preview finds every active variety/seller reachable ≥ 2 ways; no "click here" anchors.*

### H. Final verification + delivery
33. **Accessibility + performance.** axe + manual keyboard/screen-reader pass (390 pt + desktop, WCAG 2.2 AA) and Lighthouse-mobile budget run (NFR1) on the preview per §9.7. *Check: zero critical/serious axe violations; budget figures recorded.*
34. **Acceptance run + README + delivery report.** Execute the **entire §9 checklist** live on the preview Worker; write the README (§9.8); deliver the report (preview URL, results, V-flag design changes, C6 awaiting ruling). Clean up any test rows/config (HR6). *Check: §9 sign-off complete. Production cutover is explicitly NOT part of this task.*

**Task count: 34.**
