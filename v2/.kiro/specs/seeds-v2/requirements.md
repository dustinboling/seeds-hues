# seeds.hues.flowers v2 — Requirements

Distilled from `~/workspace/seeds-hues/V2-BUILD-SPEC-FINAL.md` (authoritative) and the
sections of `V2-BUILD-SPEC.md` it incorporates (§§1–5, 7, 9–11). Where the two differ, the
FINAL spec wins. Design system: `V2-DESIGN-PWA-API.md`.

## 1. Product definition

A server-rendered, mobile-first (390 pt) Next.js 16.4 PWA directory of flower-seed
varieties and the **small, independent farm seed sellers** that carry them. Read-only.
Outbound links only. Deployed (by others) to Cloudflare Workers via OpenNext, data in D1.

## 2. Hard rules (apply to every task)

| ID | Rule |
|---|---|
| HR0 | **Small farms only.** No large seed companies anywhere in data, examples, tests or copy (Ball, GeoSeed, Johnny's, Park Seed, Baker Creek, Everwilde, Reimer, Onings, Silver Falls, Todd's). Those names may appear only in code comments and exclusion lists. |
| HR1 | No invented data. `price_cents` NULL renders **"See seller for price"**; `product_url` NULL links to the seller homepage. Never invent prices, URLs, stock, ratings, reviews, heights, swatches or traits. |
| HR2 | No checkout, cart, payments or ordering. |
| HR3 | No hotlinked images and no photos: typography, CSS/SVG swatches and generated OG cards only. |
| HR4 | WCAG 2.2 AA, mobile and desktop. |
| HR5 | No patio/dwarf/pot dahlia content. Seed-grown dahlia mixes are in scope. |
| HR6 | Test rows created during verification are removed. |

## 3. Functional requirements (EARS)

### Data
- **R-D1** The importer shall load exactly `seed-data/catalog.json` as import batch `initial-catalog` and shall fail fast unless counts are 68 varieties / 32 sellers / 67 listings / 19 plants.
- **R-D2** The importer shall reject any seller whose slug or name matches `ball | geoseed | johnny | park-seed | baker | everwilde | reimer | onings`.
- **R-D3** Every variety and every listing shall reference ≥1 source; every priced packet shall carry `price_source` and `price_check_date`; every `price_cents` shall be an integer or NULL.
- **R-D4** The importer shall compute `content_level` (`thin | factual`, factual = ≥3 sourced facts among description, sowing notes, height, ≥2 tags, plant-level guidance) and `indexable` (≥1 active listing OR factual).
- **R-D5** Re-running the importer against a published `initial-catalog` batch shall be a no-op success; against a staged batch it shall replace the stage.
- **R-D6** `publish-catalog.ts` shall build an allowlisted SQLite snapshot, upload it to the snapshots R2 bucket as `snapshots/catalog-v{N}.sqlite`, and insert `catalog_publish` version N (monotonic).

### Web
- **R-W1** Home: search (autocomplete + no-JS form), category browse, plant/variety/seller entry points.
- **R-W2** `/varieties/[slug]`: plant common + Latin name, description (sourced or deterministic template), sowing notes, height (omitted when unknown), swatch (neutral placeholder when NULL), category/subcategory, tags, aliases, plant link and every listing with packet sizes, price + "Verified {date} · {source}", "Not yet rated", outbound link.
- **R-W3** `/sellers`, `/sellers/[slug]`, `/plants/[slug]`, `/categories/[slug]`, `/varieties` paginate with crawlable `?page=` at 24 per page.
- **R-W4** `/search?q=` is SSR, works without JavaScript, and carries `noindex, follow`.
- **R-W5** `/about`, `/about/bot`, `/terms`, `/privacy`, `/offline`, `/api-docs`, branded 404 and error boundaries ship with real content.
- **R-W6** `/varieties?v={slug}` and `/sellers?s={slug}` (with or without trailing slash) shall 308 to the clean URL.
- **R-W7** Non-indexable variety pages render `robots: noindex` and are excluded from the sitemap.
- **R-W8** Ratings render "Not yet rated"; protection badges render only when protection ∉ {unknown, none_stated} and a source note exists; the site never claims a variety is "not protected".
- **R-W9** Outbound seller links are direct hrefs (`rel="noopener noreferrer"`, never `nofollow`, descriptive anchors) and fire a `sendBeacon` to `POST /api/track` that never blocks navigation.

### API
- **R-A1** `/api/v1` exposes varieties, sellers, categories, plants (list + detail), search, catalog version, catalog snapshot and `openapi.json` (OpenAPI 3.1 generated from Zod).
- **R-A2** Every response uses `{ data, meta, error }`; errors use codes `not_found | validation_error | rate_limited | method_not_allowed | internal`.
- **R-A3** List endpoints use opaque cursor pagination (`limit` default 24, clamped 1–100, non-numeric → 400).
- **R-A4** GET responses carry ETag (304 on `If-None-Match`), `Cache-Control`, `X-API-Version: 1`; `/catalog/version` is `no-store`.
- **R-A5** CORS allowlist only (never `*`); non-GET → 405; 120 req/min/IP → 429 + `Retry-After`.
- **R-A6** Every `/api/*` response carries `X-Robots-Tag: noindex`.
- **R-A7** `POST /api/revalidate` is bearer-token protected (401 without token, 400 malformed); `POST /api/track` returns 204 and writes `outbound_clicks`.

### SEO / GEO
- **R-S1** Title template `%s | seeds.hues.flowers`; canonical absolute URLs; OG/Twitter `summary_large_image` with generated 1200×630 cards.
- **R-S2** JSON-LD: Home `WebSite` + `SearchAction`; variety with listings `Product` + `AggregateOffer` + one `Offer` per listing (price omitted when unverified) + `BreadcrumbList`; zero-vendor variety `BreadcrumbList` only; seller `Organization`; lists `ItemList`. **Prohibited:** `FAQPage`, `AggregateRating`, `Review`, `priceValidUntil`.
- **R-S3** Sitemap lists indexable varieties only, no `<priority>`/`<changefreq>`; robots.txt allows all crawlers incl. AI crawlers and does not disallow `/api/`; `llms.txt` is generated from DB/config and states the small-farm-only policy.

### PWA
- **R-P1** `app/manifest.ts` (192/512/maskable icons, standalone, start_url `/`), apple-touch-icon and iOS meta.
- **R-P2** Hand-rolled `public/sw.js`: precache shell + `/offline`, SWR pages, network-first `/api/*`, cache-first static assets, no cross-origin interception, self-applying versioned updates.
- **R-P3** Bottom tab bar (Home / Varieties / Search / Sellers), ≥44 pt targets, safe-area insets.

## 4. Non-functional
- **NFR1** LCP < 2.5 s, INP < 200 ms, CLS < 0.1 (mobile).
- **NFR3** Portability: repository layer only touches Drizzle; `db.batch()` only inside `atomic()`; raw SQL only in the FTS module; integer cents; slugs are the only public identifiers.
- **NFR4** TypeScript strict; Zod validation of repository outputs.
- **NFR5** Secrets in Worker secrets / `.dev.vars`, never in the repo.

## 5. Out of scope
Checkout, accounts, review submission, native apps, marketplace, admin UI, web push,
dedicated search service, AWS, photos, vegetable/herb data, deployment to Cloudflare
(handled separately).
