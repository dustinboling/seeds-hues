# VERIFICATION-LOG — seeds.hues.flowers v2

Task 1 gate (FINAL spec §8 A1). Each flag was checked against the pinned packages installed in
`node_modules` (their shipped code, type definitions and the Next.js docs bundled at
`node_modules/next/dist/docs`) on 2026-11-16. The public docs site (opennext.js.org) timed out from
the build host, so the pinned package source is the authority here. Where a flag could not be
verified locally, the fallback below was adopted and the build did not wait on it.

## Pinned versions (exact, no ranges — `package.json`)

| Package | Version | Note |
|---|---|---|
| next | 16.4.6 | latest 16.4.x patch on npm at build time |
| react / react-dom | 19.3.1 | latest 19.3 |
| @opennextjs/cloudflare | 1.20.17 | latest; peer range `next >=16.4.5` satisfied |
| wrangler | 4.162.0 | satisfies OpenNext peer `^4.148.0` |
| drizzle-orm / drizzle-kit | 0.45.4 / 0.31.11 | |
| zod | 4.6.7 | native `z.toJSONSchema` (draft 2020-12) used for OpenAPI 3.1 |
| tailwindcss / @tailwindcss/postcss | 4.3.5 | |
| typescript | 5.9.3 | latest 5.x; `typescript-eslint` 8.72 supports `<6.1`, so TS 7 was not used |
| eslint | 9.39.5 | `eslint-config-next` 16.4.6 plugins do not yet declare ESLint 10 |
| vitest | 5.1.0 | |

Playwright was planned for browser smoke tests and then removed: its Chromium download hung on this
network, so it is not a dependency (see BUILD-REPORT gaps).

## Flags

| # | Flag | Verdict | Evidence (pinned package) | Decision / fallback adopted |
|---|---|---|---|---|
| V1 / V16 | ISR cache on Workers: KV or R2? Where must revalidation run? | **Corrected.** KV is not required. | `@opennextjs/cloudflare` 1.20.17 ships `overrides/incremental-cache/r2-incremental-cache` (binding `NEXT_INC_CACHE_R2_BUCKET`), `overrides/tag-cache/d1-next-tag-cache` (binding `NEXT_TAG_CACHE_D1`, table `revalidations`, created by the CLI `populateCache` step) and `overrides/queue/memory-queue` (needs `WORKER_SELF_REFERENCE`). The default template is R2. | Per X6: `open-next.config.ts` = R2 incremental cache + D1 tag cache + memory queue. `wrangler.jsonc` binds R2 `seeds-hues-cache`, D1 `seeds-hues-tag-cache`, and self-reference service `seeds-hues`. `POST /api/revalidate` runs inside the same Worker, which holds all three bindings. |
| V2 | Cloudflare context API | **Confirmed:** `getCloudflareContext` from `@opennextjs/cloudflare`; `getRequestContext` (next-on-pages) does not apply. | `dist/api/cloudflare-context.d.ts` | `lib/db/client.ts#getDb()` calls `getCloudflareContext({ async: true })` per request. It is the only reader of `env.DB`, enforced by a guardrail test. `next dev` gets bindings via `initOpenNextCloudflareForDev()`. |
| V3 | View Transitions | **Not needed.** Next 16.4 documents a View Transitions guide, but the spec does not require it. | `next/dist/docs/01-app/02-guides/view-transitions.md` | Shipped without View Transitions. Navigation is App Router `<Link>` (no full reload). |
| V4 | D1 partial indexes | **Not used.** SQLite supports them, but the schema does not need them. | — | Plain indexes only (FKs, slugs, status+name, `(listing_id, price_cents)`), so they work either way and port to Postgres unchanged. |
| V5 | Amplify Next.js support (record-only) | **Not re-checked** (no AWS in scope). | — | Amplify stays rejected. No Phase 1 dependency. |
| V6 | Aurora Serverless v2 0-ACU (record-only) | **Not re-checked.** | — | Phase 3 alternative only. |
| V7 | Hyperdrive pricing (record-only) | **Not re-checked** (vendor pricing pages not fetched). | — | Recheck before Phase 3 budgeting. |
| V8 | D1 size limit / migrate at 5 GB | **Not re-checked online.** | — | Phase 1 catalog is ~0.1 MB (snapshot is 114,688 bytes), far below any D1 limit. The 5 GB trigger in spec §3.4 stands. |
| V9 | Lambda@Edge (record-only) | **Not re-checked.** | — | No dependency. |
| V10 | PWA service-worker path | **Confirmed:** the Next 16.4 PWA guide uses a hand-rolled `public/sw.js` with `no-cache` headers and points to Serwist for heavier needs. `next-pwa` is not used. | `next/dist/docs/01-app/02-guides/progressive-web-apps.md` | Hand-rolled SW generated from `scripts/sw.template.js` with a per-build `VERSION` (`scripts/build-sw.mjs`, run by `prebuild`/`cf:build`). It uses skipWaiting + clients.claim + activate-time cache cleanup, and the page reloads once on `controllerchange`. `sw.js` is served `no-cache` via `next.config.ts` and `public/_headers` (Workers static assets). Serwist is not used. |
| V11 | Dollar figures | **Not re-checked** (pricing pages not fetched). | — | Phase 1 adds one D1 database, one D1 tag-cache database, two R2 buckets and one rate-limit binding on the existing Workers Paid plan. At this data size usage should stay within included quotas; confirm on the Cloudflare dashboard after deploy. No new paid product is required. |
| V12 | `app/manifest.ts` conventions | **Confirmed.** `MetadataRoute.Manifest` supports `icons[].purpose` incl. `maskable`; served at `/manifest.webmanifest`. | Next types + local build (`○ /manifest.webmanifest`) | 192, 512, maskable-512 PNG and SVG icons generated by `scripts/gen-icons.ts` (pure Node PNG encoder). Plus `apple-touch-icon` 180 and `appleWebApp` meta. |
| V13 | `ImageResponse` on OpenNext/workerd | **Confirmed locally.** `/og/variety/sweet-pea-kings-ransom` returns a 1200×630 `image/png` from the OpenNext bundle under `wrangler dev` (workerd). | Local acceptance run | `next/og` ImageResponse with the bundled default font and no external fetches. Fallback (static pre-generated cards) not needed. Re-check latency on production. |
| V14 | D1 export vs FTS5 virtual tables | **Adopted the spec's rule** (X7): D1 export does not support virtual tables. | Spec X7 | `varieties_fts` lives in its own migration (`0001_varieties_fts.sql`). README "Backups / export" documents drop → export → recreate + `rebuildFts()`. The importer always rebuilds FTS. |
| V15 | D1 batch semantics | **Confirmed.** Drizzle's `db.batch()` maps to D1 `batch()`, which runs statements sequentially in one implicit transaction and rolls back as a unit. | `drizzle-orm/d1` + local tests | Only inside `lib/repositories/atomic.ts` (guardrail test). The importer stages the whole catalog in one atomic batch (46 statements). |
| V17 | Rate-limit binding | **Confirmed.** Wrangler 4.162 accepts `ratelimits` (`simple: { limit, period }`) and Miniflare emulates it locally (`env.API_RATE_LIMITER (120 requests/60s)` shown by `wrangler dev`). | `wrangler dev` binding table | Primary: `API_RATE_LIMITER` keyed by `cf-connecting-ip`. Fallback when the binding is missing or errors: per-isolate token bucket (`lib/api/rate-limit.ts`). Note: the binding is per-colo and eventually consistent, so limits are approximate. No new paid product. |
| V18 | Cloudflare Access (admin) | **N/A for Phase 1** (X11). | — | No admin UI, no auth code. Only non-GET routes: `POST /api/revalidate` (bearer token secret `REVALIDATE_TOKEN`) and `POST /api/track`. |
| V19 | Node middleware / `proxy.ts` on workerd | **Avoided.** OpenNext 1.20.17 labels Node.js middleware on workerd "experimental and not supported". | `dist/cli/build/open-next/bundle-node-middleware.d.ts` | No middleware/proxy. The R10 308s use `permanentRedirect()` inside `/varieties` and `/sellers` (Next docs: 308 outside streaming/Server Actions). `/varieties/?v=` first gets Next's trailing-slash 308, then the slug 308: a two-hop chain, every hop 308, verified locally. |
| V20 | D1 bound-parameter limit | **Adopted 100 parameters per statement** (the documented D1 limit). | — | `insertOps()` chunks multi-row inserts to `floor(100 / columns)` rows per statement. |

## Other build-time decisions

- **Outbound clicks** go to a D1 table `outbound_clicks`, not Analytics Engine (FINAL §2). There is one fewer binding, the data can be queried with `wrangler d1 execute`, and no extra product is needed. The beacon validates the payload and records a click only when the href equals the listing's product URL or the seller homepage on file.
- **X4 static generation:** `generateStaticParams` returns `[]` for varieties. The build has no D1 access, so nothing is prerendered; each detail page renders on first hit and is ISR-cached (`revalidate = 86400`). `scripts/warm-crawl` from the spec was **not** written (see BUILD-REPORT gaps). Seller, plant and category pages read `?page=`, so they render dynamically.
- **Contact address:** the project sources record no contact email, so none was invented. `/about`, `/about/bot`, `/terms` and `/privacy` point to Hues Floral Park at https://hues.flowers unless `NEXT_PUBLIC_CONTACT_EMAIL` is set at build time.
- **`content_level` result:** 14 of 68 varieties are `factual`. All 68 are `indexable`, because each of the 54 thin varieties has at least one active listing. `stock-katz-mix` is factual with zero vendors, so it is indexable.
- **Plant-level guidance:** every plant in `catalog.json` has `description`/`sowingNotes` = null. The plant-guidance fact therefore never counts, and the UI section only renders when data exists.
