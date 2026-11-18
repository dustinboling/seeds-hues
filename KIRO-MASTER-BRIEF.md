# Kiro Master Brief — seeds.hues.flowers (consolidated 2026-11-15)

This is the single index of EVERYTHING Kiro must work from. Read every document listed before building or advising. Where documents conflict, the NEWEST decision wins (order below is chronological).

## The product (owner: Dustin Boling, Hues Floral Park)
A public Seed Finder directory at seeds.hues.flowers: every variety page lists ALL farms/suppliers selling that variety, with packet sizes, prices, outbound buy links, and seller ratings. End ambition: an Amazon-style marketplace with third-party sellers.

## Hard rules (never violate)
- NO invented prices, listings, SKUs, or ratings — every listing traces to a real seller source (URL + date checked). Ratings ship as "Not yet rated" until real reviews exist; no AggregateRating markup before then.
- NEVER hotlink photos — download and self-host every image.
- WCAG 2.2 AA. Production-ready, strictly typed, no placeholder stubs.
- Preview deployments only until Dustin approves production cutover.

## Documents (read all, in this order)
1. `PROJECT-BRIEF.md` — owner intent + hard rules (its v1 stack wording is superseded below).
2. `V2-KIRO-SUGGESTIONS.md` — Kiro's own v2 architecture input (Next.js, D1, Drizzle, packet-size table in cents, plants species layer, on-demand ISR, FTS5 trigram, slug migration + 308s).
3. `V2-DEPLOYMENT-PHASED.md` — phased cost path: Cloudflare Workers + D1 now (~$0–6/mo); DB migrates D1 → Neon Postgres via Hyperdrive at marketplace phase; "the app never moves, only the database moves"; feature-driven migration triggers.
4. `V2-DESIGN-PWA-API.md` — mobile-first PWA design (390pt first, installable, self-applying service worker updates, bottom tab bar, performance budgets).
5. `V2-BUILD-SPEC.md` — the 34-task build spec; v2 starter data = 22 varieties / 9 sellers / 24 listings (all verified from source files).
6. `V2-AMENDMENT-LOCALFIRST-API.md` — Phase 2 app-store distribution ships IMMEDIATELY after website deployment; the API RUNS the website: client 100% API-driven via versioned /api/v1/* (OpenAPI 3.1 from Zod, cursor pagination, ETag, rate limiting); Server Components call the same service layer in-process (NOT HTTP self-call), parity enforced by contract tests.
7. `V2-KIRO-LOCALFIRST.md` — Kiro's local-first verdict: adopt with changes — no SQLite WASM at starter scale (SW-cached API JSON + in-memory search), WASM-ready sync protocol (monotonic catalog version, /api/v1/catalog/version), WASM threshold ~1,000 varieties / 2MB; OPFS may be missing in Capacitor's WKWebView (verify on device). **Dustin's accept/reject on these changes is still pending — do not treat as settled.**
8. `V2-SCOPE-FULL-CATALOG.md` — **the scope that overrides starter-set thinking**: the catalog's end state is EVERY cut flower variety growable from seed. Method: (1) enumerate the variety universe into the DB first (varieties exist with zero vendors), (2) scrape/search the web for farm shops/sellers carrying each variety, (3) attach vendors as listings with provenance. Matching carries confidence levels + a review queue; scraping respects robots/rate limits and prefers feeds/APIs. Head start data: Nov 2026 Seed List Aggregator (full flower catalogs for GeoSeed, Johnny's, Silver Falls, Everwilde, Ball, Onings) in ~/workspace/seed-sourcing/.

## Settled decisions
- Framework: Next.js (latest stable 16.x) App Router, React 19 — server-rendered per real URL, client <Link> navigation (no full reloads), Metadata API + JSON-LD + dynamic sitemap/robots/llms.txt (SEO + GEO).
- Hosting/DB: Cloudflare Workers (OpenNext) + D1 + Drizzle; portable-schema discipline so the Postgres move stays a 1.5–3 day job.
- Phases: 1) PWA directory → 2) app-store apps on /api/v1 (immediately after website) → 3) marketplace (checkout, seller writes).
- Johnny's listings in v2 starter data: OPEN — awaiting Dustin's ruling (Johnny's full cut flower catalog was sourced 2026-11-05).
- Kiro model: run on the highest available advanced model (currently claude-sonnet-4.5 on the Builder ID login; Opus-class unlocks when the CLI is switched to Dustin's Google Pro+ account — that switch is in progress, first attempt re-approved the Builder ID session).

## Data sources (ground truth, never invent beyond these)
- ~/workspace/seed-sourcing/sourcing-list.md and the Seed List Aggregator files — verified seller catalogs/prices.
- v1 app + data in ~/workspace/seeds-hues/app/ (14 varieties / 9 sellers / 14 listings, cross-checked).
