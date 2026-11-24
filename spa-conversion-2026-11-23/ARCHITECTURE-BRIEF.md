# Architecture Brief — Seed Directory on Vike + React + TypeScript

**Date:** 2026-11-23 · Maps seeds onto the Phase-1 architecture plan (wwwhues `docs/spa-redevelopment/architecture-plan.md`, PR #4 + PR #6 addendum, 72-gap audit adopted in full by Dustin 2026-11-23). Seeds-specific plan section: §2.2. Program requirements: `spa-redevelopment-requirements-2026-11-22.md`.

## 1. Shape of the new app

- **Repo layout (per plan §2.2):** `seeds-hues` repo; current Next.js build stays in `v2/`, untouched and deployable until cutover; the new Vike app is built in a new `app/` tree on branch `spa/seeds` in its own worktree (`~/workspace/seeds-hues-spa-wt`). One Worker (`seeds-hues`) at cutover: `@cloudflare/vite-plugin` + Workers Static Assets, `vike(app)` handler for SSR routes.
- **Per-route rendering config:**
  - **Prerendered (build-time):** the static set — `/crop` index, `/about`, `/about/data`, `/about/bot`, `/api-docs`, `/privacy`, `/terms`, home shell regions that carry no live data. **Bea's condition (her audit, binding):** `/` and `/crop` carry live counts, so "prerendered" for those two means regenerated on data-change invalidation — or they move to the SSR class. A build-time snapshot of live counts is a stale fact and fails her gate.
  - **Request-time SSR + edge cache (`prerender: false`):** every slug route — `/variety/[slug]` (818), `/seller/[slug]` (83), `/crop/[slug]` (124), `/series/[slug]` (33), `/state/[slug]` (31), the paged browse indexes (`/variety`, `/seller`), `/search` shell, `/report`, `/add-your-farm`. Rendered once per canonical URL, cached at the edge (`s-maxage=3600, stale-while-revalidate=86400` per plan), **invalidated on data change** through the existing `/api/revalidate` write path. This is Bea's condition 3 applied: stock state, last-checked dates, and stock-check results are request-time facts, never build-time snapshots.
  - **SPA (client-rendered, auth-gated, noindex):** `/account` and **all of `/admin`** (see §4).
- **Data layer:** the named client data layer is TanStack Query (plan Data #2.1). SSR pages consume the service layer server-side in `+data` hooks (the "one backend" rule: same JSON the HTTP API returns — contract tests already assert this); client surfaces (facets, account, admin) call `/api/v1` directly. Seeds' `lib/api/http.ts` helpers (envelope, ETag/304, cache headers, CORS allowlist) are the plan's named pattern and port into the shared package.
- **Client routing:** real `<a href>` anchors everywhere (link discovery + equity — Bea §1.5.3); the router intercepts for in-place swaps. Facets/filters update in place (the shipped Tranche 3 behavior is the UX contract: in-place swap, pending cue, title sync, history entries) and **never create new crawlable facet URLs** — the plan's parameter policy table (Data #1.5) governs: filter combinations canonicalize to the clean route; sort/page-size/session parameters disallowed in robots; paginated list URLs stay real URLs with self-referencing canonicals and anchor links; `?page=1` 301s to the clean route; out-of-range pages are true 404s.

## 2. What carries over unchanged (no rebuild, no re-spec)

- **All of `/api/v1`**: public reads, ingest (jobs/sources/observations/candidates), admin endpoints, account endpoints, sync snapshot/changes, Twilio SMS webhook, reports, farm submissions, openapi.json. Shapes, auth scopes, rate limits, idempotency — untouched.
- **D1 schema and data**: production `seeds-hues` D1 + tag-cache D1; all migrations stand. The conversion is a rendering-layer replacement; no catalog migration. (Additive schema remains pre-authorized under Dustin's standing rule if a slice genuinely needs a column.)
- **Ingest pipeline**: the CLI ingester talks only to the API; it neither knows nor cares which framework renders the site.
- **Admin auth**: email + 6-digit code sign-in, ~1-week sessions, role model (Dustin full admin; designees reviewer). Session storage and permission checks are backend plumbing — unchanged.
- **Stock-check service (CSN)**: halted mid-build under Dustin's stop order — the run was cancelled before its WIP push, so no branch/PR exists and migration 0019 was never applied to production D1 (verified: no CSN tables); the brief + addendum stand intact on main (`c67b043`) and resume is a fresh dispatch. Its service design (lease-claim, `listing_stock_checks`, `recordResult()` write path) is framework-independent; CSN lands on the new stack after cutover, not in the Next tree (same sequencing rule as the wishlist).
- **Image pipeline**: R2 bucket `seeds-hues-images` via `images.seeds.hues.flowers` + Image Transformations; `lib/images.ts` URL logic ports as-is. Plates are content, not code — all 811+ plates carry over untouched. (The program media layer — `media.hues.flowers`/`hues-media` — is the hues.flowers property's move; seeds' images already sit on their own R2+CDN domain and do not move in this conversion.)
- **Structured data**: today's inventory (WebSite + SearchAction, BreadcrumbList, ItemList, Organization) carries over; seeds ships its `structured-data-inventory.md` diffed at Quinn's gate (plan Data #1.1), and the **no-price JSON-LD guard** (`assertNoProhibitedJsonLd` or equivalent) ports into the `verify` gate with Bea's prohibited list (Product, Offer, AggregateOffer, AggregateRating, Review, any `price` key) — extended only with her sign-off.
- **Copy, artwork, theme**: no restyle. See DESIGN-SYSTEM-DEPENDENCY.md.

## 3. PWA story

- Seeds is already a PWA (manifest, hand-written `sw.js`, offline page, snapshot-backed offline search). The new app follows the plan: hand-written Workbox service worker (injectManifest), per-route-class SW policy from the adopted gap audit — precache the app shell + static set; network-first with cache fallback for SSR catalogue pages (last-viewed pages open without signal — spec story 10); **never cache `/admin`, `/account`, `/api` responses containing per-user data**.
- Legacy service worker: the old Next-era `sw.js` registration must be superseded cleanly at cutover (new SW scope/version, old caches purged on activate) so no visitor is stranded on the retired shell.
- Installability, icons (Three Seeds & a Sprout set, shipped 2026-11-22), and the tab bar design (D1, gated, build brief held) — the tab bar is a *design already decided*; its build lands on the new stack as an early post-cutover slice rather than in the frozen Next tree.

## 4. Admin (in scope — Dustin, 2026-11-23)

- Every admin surface in ROUTE-INVENTORY.md converts as an SPA surface under `/admin`: sign-in + code step, no-access, home, review (incl. duplicate holds and the seller-correction flow), sellers + internal notes, varieties (incl. remove), listings (incl. remove), accounts, statistics, waitlist, more.
- **Design rule: admin is iPad-first** (the standing exception); the public app is phone-first. Both live in the one app; breakpoints swap components, never content.
- **Session rule to state once at build (plan addendum, A11y #14 — needs a pick, see OPEN-QUESTIONS):** no idle timeout (deliberate) vs timeout with warning + extend. Recorded as an open question for Dustin/Hue.
- Server-side guarantees stay server-side: internal seller notes never render to public surfaces (enforced in the API + a required test today; the port keeps both), role checks on every admin API call, remove-endpoint semantics (soft, idempotent, blocked-while-listings-live) unchanged.
- The BusyForm lesson is a build requirement, not a memory: form components must never disable a fieldset in a way that drops field values on submit; Quinn's gate drives real form submissions on admin surfaces (QA-is-usability rule).

## 5. Cutover shape

- **Atomic per property**: seeds cuts over as a whole, once, when Quinn's gate passes (never page-by-page — Bea risk 6, canonical competition).
- **Day-0 machinery** (plan §5 pattern): pre-switch crawl of the full sitemap against the staged build (every canonical 200; every legacy/redirect URL one hop; unknown paths true 404; raw-HTML JS-disabled contract per template — Bea's audit in this package); robots.txt diffed against the pre-change file (any unlisted difference is a stop); sitemap resubmitted; URL-Inspection spot checks (one variety with sellers, one zero-seller variety, one seller/shop, one crop hub).
- **Rollback**: the current Next/OpenNext Worker stays deployable until the day-28 sign-off; rollback = redeploy the pre-SPA Worker. Indexed-drop >10% unexplained, or any canonical falling out of the index, triggers same-day investigation (Bea §5.3).
- **Day-28**: full comparison against the pre-cutover baseline (see PRERENDER-CONTENT-AUDIT.md — baseline capture depends on Bea's Search Console read access, a carried dependency).
- **Sequencing vs hues.flowers**: Dustin ruled 2026-11-23 ~21:56 PT that seeds converts NOW in parallel, superseding the plan's "only after hues' day-28 sign-off" line. The two properties share the stack and the gate discipline, not a cutover window.

## 6. Performance budgets

Per-template `performance-budget.json` + Lighthouse CI (plan Perf #1/#2, binding addendum): LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 on a mid-range phone at the 75th percentile; per-route code splitting; the variety page's 150 KB JS budget from the current spec stands as the starting figure for its template budget.
