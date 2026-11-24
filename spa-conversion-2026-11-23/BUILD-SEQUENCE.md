# Conversion Build Sequence — ordered slices for the seeds SPA build

**Date:** 2026-11-23 · Sizing rule: each slice dispatches, gates (Quinn, with Athene cold-rating where the plan calls for it), and merges **independently** under the pipeline's one-pending-run discipline. Slices build in the new `app/` tree on branch `spa/seeds` (own worktree); the live Next app in `v2/` stays deployable and untouched until Slice 9. Nothing here dispatches during Phase 1 prep.

## The slices

| # | Slice | Contents | Gate emphasis |
| --- | --- | --- | --- |
| 0 | **Workflow standard** | ENVIRONMENT-STANDARD.md E1–E4 (in-job repair loop, per-task concurrency, 120-min timeout, CI-fix-2) | Quinn + live red-gate drill |
| 1 | **App skeleton + design-system wiring** | Vike + Vite + React + TS scaffold in `app/`; @hues/tokens (theme.seeds) + @hues/fonts wired; seeds token mapping pass; app shell, header/footer, tab-bar placeholder; PWA manifest + Workbox SW skeleton; `verify` extended (lint + typecheck + tests + no-price JSON-LD guard) | Rendered-diff check on token mapping; SW registration proof |
| 2 | **Static set + home** | Prerendered: `/about`, `/about/data`, `/about/bot`, `/api-docs`, `/privacy`, `/terms`, `/crop` index; home (prerendered shell + request-time regions); `/llms.txt`, `/robots.txt`, segmented sitemap machinery | Bea raw-HTML checks on every template in the slice |
| 3 | **Variety routes** | `/variety/[slug]` SSR + edge cache + revalidate invalidation; `/variety/[slug]/small-farms`; zero-seller rendering (full, indexable); waitlist block; OG route | Raw-HTML JS-disabled drive on with-seller + zero-seller pages; price-guard assertions; cache-invalidation proof (change data → page updates) |
| 4 | **Browse + search** | `/variety` + `/seller` paged indexes (self-canonical paging, `?page=1` 301, true-404 bounds); `/search` + facets (in-place swaps, pending cue, parameter policy — no new crawlable URLs) | In-place behavior drive (the B-1 standard); facet canonical audit |
| 5 | **Seller shops + hubs** | `/seller/[slug]` shop (grid, shop search/filters, grouped sort, contact block, locations area); `/crop/[slug]`, `/series/[slug]`, `/state/[slug]` | Shop usability drive; Latin-name card rule; state-icon placement |
| 6 | **Forms + flows** | `/report`, `/add-your-farm` (Turnstile + server verify + rate limits); `/go/[id]`; `/unsubscribe`; visitor `/account` SPA (sign-in incl. "Email me a code instead" seam, waitlists) | Real form submissions end-to-end (BusyForm lesson); no-JS floor on the exempt endpoint |
| 7 | **Admin SPA** | All of `/admin` (ROUTE-INVENTORY admin table): sign-in/code, review incl. duplicate holds + seller-correction flow, sellers + internal notes, varieties/listings incl. remove flows, accounts, statistics, waitlist, more. iPad-first layout | Role/permission drives (admin vs reviewer); internal-notes-never-public test; iPad viewport pass |
| 8 | **Hardening + parity** | Per-template performance budgets + Lighthouse CI; security headers/CSP suite; error monitoring + uptime; structured-data inventory diff; full-sitemap crawl vs the live site (URL-by-URL parity: status, canonical, title, JSON-LD); robots diff; accessibility pass (Ada) incl. route-transition focus/announcements | Full Bea day-0 checklist rehearsed against staging |
| 9 | **CUTOVER** | Atomic switch of the `seeds-hues` Worker to the Vike app; sitemap resubmission; spot checks (variety with sellers, zero-seller variety, one shop, one crop hub); old Worker kept deployable; day-7 alarm check; **day-28 sign-off** vs the pre-cutover baseline | Quinn gate + Hue live verification; rollback trigger per Bea §5.3 |

## After cutover (already-decided work that lands on the new stack, in standing order)

1. **Wishlist** (Julie's idea, commissioned 2026-11-23; Dustin's sequencing ruling: builds only AFTER the SPA cutover — design completes and gates meanwhile; multiple named lists, per-list in-stock view).
2. **CSN (Check stock now)** — service design gated; UI lands here (build frozen mid-flight in the Next tree; its service layer is framework-independent).
3. **Item SI** — state outline icons incl. listing-card placement (design gated).
4. **Tab bar D1** — design gated, build brief held.
5. **Seller-tag system** — design decided 2026-11-20.
6. Tranche 5 remainder + R3 remainder (FieldError[] — HELD pending Dustin's call, see OPEN-QUESTIONS).

## Notes on sizing

- Slices 3–5 are the catalog core and the largest; each is still one dispatch because the route templates share the SSR/edge-cache machinery proven in Slice 3 — if Slice 3's gate shows the machinery fighting back, Hue splits 4 and 5 before dispatch rather than mid-flight.
- Slice order keeps every merged slice inert (nothing user-visible changes until Slice 9), so a stall in any slice never strands the live site.
