# BUILD-REPORT — seeds.hues.flowers v2

Built 2026-11-16 in `~/workspace/seeds-hues/v2` against `V2-BUILD-SPEC-FINAL.md`. Everything
was built and verified locally (local D1 via Miniflare/workerd). **Nothing was deployed** and
`wrangler deploy` was never run.

## Summary

- **Tasks:** 33 of 35 done and checked locally. Tasks 27 (PWA browser checks) and 33
  (axe/Lighthouse) are only partly done, because no browser could be installed (see Gaps).
- **`npm run verify`:** passes. ESLint 0 problems, `tsc --noEmit` 0 errors, Vitest **89/89** tests
  in 7 files (unit, D1 integration, API contract).
- **OpenNext Worker bundle:** `npm run cf:build` succeeds (`.open-next/worker.js`).
- **FINAL §7 acceptance:** **60/60 passed** over real HTTP against `opennextjs-cloudflare preview`
  (wrangler dev / workerd, local D1 + R2 + rate limiter). Browser-only PWA checks were not run.
- **Seed data:** 68 varieties / 32 sellers / 67 listings / 19 plants, published as catalog
  version 1. Zero large-company names in data, pages, sitemap, llms.txt or API payloads.

## What was built

### Web routes (all server-rendered; no placeholder stubs)

| Route | Notes |
|---|---|
| `/` | Search (autocomplete + no-JS GET form), browse by plant, most-listed varieties, categories, how-it-works. `WebSite` + `SearchAction` JSON-LD |
| `/varieties` | `?page=` pagination (24/page); `?v=` → 308 |
| `/varieties/[slug]` | Every listing with packet table, "Verified {date} · {source}", "See seller for price", "Not yet rated", outbound links + beacon, facts `<dl>`, template description. Indexability-aware robots. JSON-LD: `BreadcrumbList`, plus `Product` + `AggregateOffer` + one `Offer` per listing only when listings exist. ISR 24 h + on-demand, `dynamicParams = true`, `generateStaticParams` → `[]` |
| `/sellers`, `/sellers/[slug]` | `?page=`; `?s=` → 308; `Organization` JSON-LD (PostalAddress only for "City, ST") |
| `/plants`, `/plants/[slug]` | `?page=`; ItemList JSON-LD |
| `/categories`, `/categories/[slug]` | `?type={subcategory}` filter + `?page=` |
| `/search?q=` | SSR, `noindex, follow`, canonical `/search`, empty-q prompt state |
| `/about`, `/about/bot`, `/terms`, `/privacy` | Trademark disclaimer, conflict-of-interest line, 48 h removal / no-price policy, ratings policy, crawler UA + opt-out, factual privacy (no cookies; beacon described) |
| `/offline`, `/api-docs`, 404, `error`, `global-error` | |
| `/manifest.webmanifest`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/og/{variety\|seller\|plant\|site}/{slug}` | Sitemap lists indexable varieties only, no priority/changefreq. Robots allows all and does not block `/api/`. llms.txt is DB-generated with the small-farm policy. OG cards are 1200×630 PNG (ImageResponse) |

### API

- **Public `/api/v1`:** `varieties`, `varieties/{slug}`, `sellers`, `sellers/{slug}`, `categories`,
  `categories/{slug}`, `plants`, `plants/{slug}`, `search`, `catalog/version` (no-store),
  `catalog/snapshot/{version}.sqlite` (R2), `openapi.json` (OpenAPI 3.1 from Zod), and a catch-all
  404.
- **Behaviour:** `{data, meta, error}` envelope, opaque query-bound cursors, ETag/304,
  `Cache-Control`, `X-API-Version: 1`, `X-Robots-Tag: noindex`, CORS allowlist, 405 for
  non-GET, and 120 req/min/IP (Workers `ratelimits` binding with a per-isolate token-bucket
  fallback).
- **Internal routes:** `POST /api/revalidate` (bearer token, tag taxonomy → paths) and
  `POST /api/track` (sendBeacon → `outbound_clicks`, always 204, URL must match one on file).

### Schema (D1 + Drizzle; `migrations/0000_init.sql` + `0001_varieties_fts.sql`)

- **Core tables:** `categories`, `subcategories`, `plants`, `varieties`, `variety_tags`, `sellers`,
  `listings`, `listing_packet_sizes`.
- **FINAL §2 additions:** `sources`, `variety_aliases`, `import_batches`, `match_queue`,
  `price_history` (22 rows), `catalog_publish`, `media` (ships empty), `outbound_clicks`.
- **New columns:** `sellers.provenance/listing_policy/platform`, and
  `varieties.content_level/indexable/protection/protection_note/source_id`.
- **Stubs (empty):** `users`, `seller_accounts`, `reviews`.
- **CHECK constraints:** enums; a price requires source + date; `rating_average` is NULL while
  `rating_count = 0`.
- **FTS:** `varieties_fts` (FTS5 trigram) over variety, common and Latin names, description, tags
  and aliases, synced by triggers. `searchVarieties()` in `lib/repositories/fts.ts` is the only
  FTS reader; queries under 3 characters use a prefix fallback.
- **Architecture:** repositories are the only Drizzle importers, and `atomic()` is the only
  `db.batch()`. Services are shared by pages and the API (X2), with Zod output validation that
  fails loudly.

### Data scripts

- **`scripts/import-catalog.ts`:** all §6 assertions (counts, orphans, exclusion scan of seller
  slug/name plus whole-file company-name scan, sources, price provenance, integer cents). It loads
  in one atomic batch, rebuilds FTS, re-asserts in the DB, then publishes the batch. It is
  idempotent and replaces a staged batch.
- **`scripts/publish-catalog.ts`:** builds an allowlisted SQLite snapshot (`node:sqlite`,
  Node-only), uploads it to R2 `snapshots/catalog-v{N}.sqlite`, and inserts `catalog_publish`.
  It supports `--dry-run`/`--out`.
- **`scripts/acceptance.ts`:** FINAL §7 over HTTP against any base URL.
- **`scripts/gen-icons.ts`:** pure-Node PNG icons.
- **`scripts/build-sw.mjs` + `sw.template.js`:** versioned, hand-rolled service worker.

### PWA

- `app/manifest.ts` with 192, 512, maskable-512 and SVG icons, plus apple-touch-icon and iOS meta.
- `public/sw.js`, stamped per build:
  - precaches the shell and `/offline` (plus its assets);
  - pages are stale-while-revalidate, `/api/*` is network-first with a cached fallback, and
    statics are cache-first;
  - cross-origin requests are never intercepted;
  - updates apply themselves: skipWaiting + clients.claim + old-cache cleanup, then one reload
    on `controllerchange`.
- Bottom tab bar (Home / Varieties / Search / Sellers, ≥ 44 px targets, safe-area insets) and a
  390 pt-first layout with system fonts only.

### Docs

- `.kiro/specs/seeds-v2/{requirements,design,tasks}.md`
- `VERIFICATION-LOG.md`
- `README.md`
- this report

## Local check results

### `npm run verify`

| File | Tests | Covers |
|---|---|---|
| unit/guardrails | 16 | `env.DB` only in client, `.batch(` only in atomic, FTS SQL isolated, Drizzle only in db/repositories, no Node built-ins in Worker code, no float price ops, no excluded company names, no AggregateRating/FAQPage/priceValidUntil, no `<img>`/remote images, no `*` CORS, exact version pins, no checkout code |
| unit/catalog-assertions | 11 | Real file passes; count mismatch, every exclusion token/name, missing source, priced packet without source/date, float price, orphans, duplicates and unknown keys all fail; content_level/indexable rule |
| unit/api-foundation | 10 | Limit clamping/400, cursor binding, ETag/304, CORS allowlist, token bucket, revalidate body + tags |
| unit/seo | 6 | Zero-vendor → no Product; AggregateOffer + per-listing Offers with price omitted when unverified; prohibition guard; location parsing; cents formatting; template text |
| integration/data | 20 | Real D1: import counts, idempotency, staged replace, DB CHECKs, §7 spot checks, listing_policy, FTS (plant, partial, mid-word, Latin, <3-char prefix, syntax-safe, trigger sync), Zod fail-loud |
| contract/api | 21 | Envelope, 404/405/400, ETag 304, CORS, 429, 68-item cursor walk, filters, price sort, **service↔API parity** for every endpoint, catalog version/snapshot, OpenAPI paths exact + refs resolve, no excluded names in payloads |
| contract/internal | 5 | Revalidate 401/400/200 tag mapping; track records only real URLs, always 204 |

### Acceptance (FINAL §7) against the local OpenNext preview — 60/60 PASS

| Group | Result |
|---|---|
| Routes | 15 × 200 (all §7 routes + `/plants`, `/categories`, `/search`), 5 × 404 (unknown slugs, `?page=99`) |
| API | catalog/version = 1 with `no-store`; snapshot v1 downloads (114,688-byte SQLite) and an unknown version → 404; `limit=5` walks 68 exactly once (14 pages); 404 envelope; POST → 405; ETag → 304; `X-Robots-Tag` on all `/api/*` incl. errors and 405; `X-API-Version`; CORS; OpenAPI 3.1 (12 paths) |
| All pages | 68 variety, 32 seller (all show "Not yet rated") and 19 plant pages → 200 |
| Variety pages | King's Ransom shows Songbird + Flower People + Sweet Pea Gardens with verified labels; Product + AggregateOffer (5 offers, lowPrice 5.95). stock-katz-mix: template text, BreadcrumbList only, indexable (factual) = `index, follow`. Robots match `indexable` on all 68. No Product on any of the 14 zero-vendor pages. 135 rendered prices all labelled |
| Data | 68/32/67/19. No excluded names in 207 documents. No AggregateRating/Review/FAQPage/priceValidUntil in 133 pages |
| Spot checks | Songbird × King's Ransom 600¢ / 10 seeds / product URL; Flower People × Susan Burgess 800¢, sold-out note, `inStock` null; Floret × Dawn Creek Pastels null → "See seller for price" |
| SEO/GEO | Sitemap 133 URLs (indexable only, no priority/changefreq); robots; llms.txt; search noindex+canonical; home meta/OG/SearchAction; OG PNG 1200×630; Organization + ItemList; direct hrefs, `noopener noreferrer`, no nofollow, no `/go/` |
| PWA (HTTP) | Manifest valid, icons same-origin; `sw.js` no-cache with stamped version; apple-touch-icon |
| Redirects | `?v=` / `?s=` → 308 to the clean URL; trailing-slash variants → 308 chain (2 hops, all 308) |
| Rate limit | Burst → 429 + `Retry-After` (Workers rate-limit binding under Miniflare) |

### On-demand revalidation (task 17)

Checked by hand on the preview:

1. With the King's Ransom page cached (`x-nextjs-cache: HIT`), the Songbird price was changed to
   650¢ in local D1. The page still showed $6.00, as expected for ISR.
2. `POST /api/revalidate` without a token returned 401. With the token it returned 200, and the
   next request showed $6.50.
3. The price was restored to 600¢ and revalidated again (HR6).

Final local DB: 68/32/67, `outbound_clicks` = 0, catalog version 1.

## VERIFY-flag decisions (full table in VERIFICATION-LOG.md)

- **V1/V16 ISR cache:** R2 incremental cache (`seeds-hues-cache`) + D1 tag cache + memory queue
  with a self-reference binding. No KV.
- **V2 context API:** `getCloudflareContext({ async: true })`.
- **V3 View Transitions:** not used.
- **V4 partial indexes:** none needed.
- **V10 service worker:** hand-rolled, versioned per build; no Serwist, no next-pwa.
- **V12 manifest:** `app/manifest.ts` with a maskable icon.
- **V13 OG cards:** ImageResponse confirmed working under workerd; no static fallback needed.
- **V14 FTS and D1 export:** drop and rebuild FTS around exports (README).
- **V15 batches:** D1 batch is all-or-nothing, used only via `atomic()`.
- **V17 rate limit:** Workers `ratelimits` binding plus per-isolate token-bucket fallback.
- **V18 Access:** not applicable in Phase 1.
- **V19 middleware:** avoided (Node middleware is unsupported on workerd); 308s come from
  `permanentRedirect()` in the list pages.
- **V20 bound parameters:** inserts chunked to ≤ 100 parameters.
- **Outbound clicks:** a D1 table, not Analytics Engine.
- **Not re-checked online (record-only or cost):** V5–V9 and V11. The vendor pages were not
  reachable or not needed. No new paid product is required.

## Remaining gaps

1. **No browser testing.** Playwright's Chromium download hung, so Playwright was removed and no
   browser was available. The following were **not verified**:
   - service-worker registration, precache, offline fallback and the N → N+1 self-update test
     (task 27);
   - shell persistence across client navigations (no full reload);
   - tab bar behaviour and the 390 pt layout pass;
   - the autocomplete combobox in a real browser (the no-JS form path is covered by the SSR
     `/search` check);
   - axe/WCAG 2.2 AA scan and keyboard/screen-reader passes (task 33);
   - Lighthouse LCP/INP/CLS budgets (task 33).

   The code follows the spec (semantic landmarks, skip link, labelled controls, ≥ 44 px targets,
   colour pairs chosen ≥ 4.5:1, focus-not-obscured scroll padding, reduced motion), but none of
   it has been measured. All of the above must be run on a workers.dev or production deploy.
2. **Warm-crawl script (X4) not built.** `npm run acceptance -- --base <url>` fetches every
   variety, seller and plant page and can stand in for it. A dedicated sitemap crawler is still
   missing.
3. **No prerendering of the top ~100 varieties.** `generateStaticParams` returns `[]`, because the
   build has no D1 access. Every page renders on first hit and is then ISR-cached.
4. **Only variety detail pages use ISR.** Seller, plant and category detail pages and all list
   pages are `force-dynamic`, because `?page=` reads `searchParams`. They query D1 on every
   request, which is fast at this data size but uses no ISR cache. `revalidatePath` on them is
   harmless.
5. **Deploy-time configuration still open:**
   - `database_id`s for `DB` and `NEXT_TAG_CACHE_D1` in `wrangler.jsonc`;
   - the workers.dev origin in `CORS_ALLOWED_ORIGINS`;
   - creating both R2 buckets;
   - the `REVALIDATE_TOKEN` secret;
   - running remote migrations, import and publish (README "Deploy").
6. **No contact email in the sources.** Policy pages point to hues.flowers until
   `NEXT_PUBLIC_CONTACT_EMAIL` is set. The 48 h removal promise needs a monitored channel before
   launch.
7. **No separate shared-types package.** Types come from `lib/validators` (Zod-inferred) and the
   OpenAPI document. A publishable package for native apps is not split out.
8. **Data limits worth knowing:**
   - all plants have NULL description/sowing notes, and `variety_aliases` is empty, so
     alias search is wired and tested but has no production data;
   - all varieties have `protection = unknown`, so no protection badges render;
   - 14 of 68 varieties are `factual`; all 68 are indexable, since every thin variety has a
     listing.
9. **Rate limiting is approximate.** The Workers binding is per-colo and eventually consistent,
   and the token-bucket fallback is per isolate.
10. **Record-only VERIFY flags (V5–V9, V11) were not re-checked** against live vendor pages.
11. **TypeScript 5.9.3 instead of 7.x.** `typescript-eslint` 8.72 supports TS < 6.1.
12. **The trailing-slash legacy URLs take a 2-hop 308 chain.** `/varieties/?v=…` → `/varieties?v=…`
    → `/varieties/{slug}`. Every hop is 308.

## Workspace state

- **Left in place:** source, `node_modules`, `.next`/`.open-next` build output, and the local D1/R2
  state in `.wrangler/` (catalog imported and version 1 published).
- **Removed:** temp files, the throwaway local `.dev.vars` token and the snapshot copy.
- **Not mine:** `kiro-build*.log` files were left untouched.
- **No git repository** was created.
