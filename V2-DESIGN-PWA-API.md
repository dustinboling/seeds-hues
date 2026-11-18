# seeds.hues.flowers v2 — Design addendum: mobile-first PWA + API-first (Phase 2 native apps)

**Owner direction (Dustin, 2026-11-15):** Phase 1 design is mobile-first and a PWA.
Design from the start for a **full API that native apps will use as Phase 2**.
Phase order is now: 1) PWA directory → 2) native apps on the API → 3) marketplace.

## 1. Mobile-first PWA (Phase 1)

- Design at 390pt first (Dustin's iPhone), desktop is the expanded layout — not the other way round.
- Installable: Next.js native `app/manifest.ts` (name, short_name, icons 192/512 + maskable,
  theme/background colors, `display: standalone`, start_url `/`).
- Service worker: Next 16 path — hand-rolled `public/sw.js` per the official Next.js PWA guide
  as the default; `@serwist/turbopack` only if precaching needs outgrow it. Never `next-pwa`
  (unmaintained since 2022, breaks on Turbopack).
- Caching strategy: precache app shell + static assets; stale-while-revalidate for variety/seller
  pages; network-first for `/api/*` with cached fallback; dedicated `/offline` page.
- App feel: no full reloads (App Router client navigation), bottom tab bar on mobile
  (Home / Varieties / Search / Sellers), safe-area insets, tap targets ≥44pt, skeleton loading.
- Performance budgets (mobile, the SEO/GEO tie-in): LCP < 2.5s, INP < 200ms, CLS < 0.1 on 4G.
- iOS specifics: apple-touch-icon, `apple-mobile-web-app-capable`, splash handling;
  web push is Phase 2+ (iOS requires Home Screen install for push) — not in Phase 1 scope.
- Update discipline (learned on the Family App): service-worker updates must self-apply —
  no user ever stranded on a stale cached shell. Version the SW, skipWaiting + clientsClaim
  carefully, and verify the update path live before launch.

## 2. API-first architecture (for Phase 2 native apps)

Principle: **the website is the API's first client, not a separate implementation.**
Native iOS/Android apps in Phase 2 must get the same data, search, and (later) accounts
without a backend rewrite.

- **Service layer:** all data access lives in `lib/repositories/*` + `lib/services/*`
  (already required for the D1→Postgres portability plan). Route handlers and Server
  Components both call the service layer — neither talks to Drizzle directly.
- **Public REST API, versioned:** `/api/v1/varieties`, `/api/v1/varieties/[slug]`,
  `/api/v1/sellers`, `/api/v1/sellers/[slug]`, `/api/v1/search?q=`, `/api/v1/categories`,
  `/api/v1/plants`. JSON only, consistent envelope, stable field names, slugs as public IDs.
- **Contract:** OpenAPI 3.1 spec generated from Zod schemas (single source of truth shared
  by web + API validation), published at `/api/v1/openapi.json` + human docs page.
  Breaking changes go to `/api/v2` — v1 never breaks silently for shipped native apps.
- **API hygiene from day 1:** pagination (cursor), ETag / Cache-Control headers,
  CORS locked to known clients, rate limiting, API version header, structured error format.
  Read-only in Phase 1; auth (API keys → OAuth) arrives with Phase 2/3 write endpoints.
- **Shared types:** one TypeScript types package generated from the Zod/OpenAPI contract —
  the same shapes the native apps' models are generated from.
- **What this changes in Phase 1 build:** slightly more upfront structure (service layer +
  route handlers + contract tests), zero change to pages/SEO — pages still server-render
  from the service layer for crawlability; the API is additive, not a client-fetch detour.

## 3. How this fits the phased deployment plan

- Unchanged: Cloudflare Workers + D1 in Phase 1 (~$0–6/mo), DB-only migration to Postgres
  via Hyperdrive at the marketplace trigger (see V2-DEPLOYMENT-PHASED.md).
- The API is what makes Phase 2 native apps cheap: they ship against `/api/v1` on the
  existing Workers deployment — no new backend, no AWS move required.
- PWA first also de-risks native: real mobile usage data from the PWA tells us which
  screens the native apps must nail.
