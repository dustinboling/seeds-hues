# Route Inventory — Seed Directory SPA Conversion

**Date:** 2026-11-23 · **Source of truth:** `v2/app` route tree on origin/main + production D1 counts measured 2026-11-23 (read-only queries via the cf-run path).
**Target stack:** Vike (on Vite) + React + TypeScript, per-route rendering config per the Phase-1 architecture plan (wwwhues `docs/spa-redevelopment/architecture-plan.md` §2.2).

## Production counts (measured, 2026-11-23)

| Entity | Count | Note |
| --- | --- | --- |
| Active varieties | 818 | 556 with ≥1 published listing; **262 zero-seller — all indexable** (Dustin's decision 27) |
| Live sellers / shops | 83 | 84 seller rows incl. the retained ineligible record (AngleTok, never public) |
| Crops (plants) | 124 | |
| Series | 33 | 32 at Bea's 2026-11-22 audit; +1 Chantilly series row created 2026-11-23 |
| Published listings | 1,492 | |
| State pages in sitemap | 31 | States with ≥1 visible seller; 32 distinct seller regions exist in D1 (one region currently has no visible seller — no page, correct) |
| Sitemap URLs (computed) | ~1,136 | 8 static + 35 paged /variety + 4 paged /seller + 124 crop + 33 series + 818 variety + 83 seller + 31 state |

## Page routes

Rendering classes: **PRERENDER** = build-time static, hydrates · **SSR** = request-time server render + edge cache, hydrates (the plan's class for all seeds slug routes — complete HTML on first crawl, invalidated on data change) · **SPA** = client app surface, no prerender · **HANDLER** = non-HTML route.

| Route template | Class today (Next.js) | Class in Vike app | Indexable | Count / notes |
| --- | --- | --- | --- | --- |
| `/` | SSR (dynamic) | PRERENDER shell + request-time regions* | Yes | Home: search, crop grid, coverage. *Live regions per Bea condition 3 — see audit |
| `/variety` (browse, `?page=N`) | SSR | SSR | Yes — paged URLs self-canonical, real anchors; `?page=1` 301 → clean route; out-of-range page = true 404 (shipped Tranche 3.5) | 35 pages at 818 varieties |
| `/variety/[slug]` | SSR | SSR | Yes — incl. all 262 zero-seller pages | 818 |
| `/variety/[slug]/small-farms` (public form: `?small_farm=true`) | SSR | SSR | **No — `noindex`, canonical to the clean variety URL** (Bea's audit: a self-canonical here would create 818 duplicates; the internal path 301s to the public URL, never serves 200) | Filtered view of the parent variety; meaningful only where badged sellers list it |
| `/seller` (index, `?page=N`) | SSR | SSR | Yes — same paging rules as /variety | 4 pages at 83 sellers |
| `/seller/[slug]` (SHOP) | SSR | SSR | Yes | 83 shops (SHOP build, live 2026-11-23: product grid, shop search/filters, contact block, locations area) |
| `/crop` | SSR | PRERENDER | Yes | Index of 124 crops |
| `/crop/[slug]` | SSR | SSR | Yes | 124 |
| `/series/[slug]` | SSR | SSR | Yes | 33 |
| `/state/[slug]` | SSR | SSR | Yes | 31 live |
| `/search` | SSR + client | SSR shell + client facets | Results page indexable as today; **facet/parameter states noindex, never new crawlable URLs** (Bea §3.6 + plan Data #1.5 parameter policy) | — |
| `/about`, `/about/data`, `/about/bot` | Static | PRERENDER | Yes | Static set per plan §2.2 |
| `/api-docs` | Static | PRERENDER | Yes | OpenAPI description lives at `/api/v1/openapi.json` |
| `/privacy`, `/terms` | Static | PRERENDER | Yes | |
| `/report` | SSR form | SSR + client form | Crawlable, not in sitemap (as today) | Turnstile-protected POST /reports |
| `/add-your-farm` | SSR form | SSR + client form | Crawlable, not in sitemap (as today) | Turnstile; plain-language errors (Tranche 1.5) |
| `/account` | SSR + client | **SPA** | No — robots-disallowed | Visitor account (name/email/phone, code sign-in, waitlists) |

### Admin surfaces — IN SCOPE (Dustin, 2026-11-23 22:00 PT: "The admin needs to be included in that conversion")

All admin converts to the same Vike + React stack as **SPA app surfaces** (client-rendered, auth-gated). Prerender/complete-content rules apply to public routes, **not** admin. Admin APIs, sessions, and permissions stay exactly as they are. Admin is **iPad-first** (Dustin's standing device rule: admin dashboards are the iPad-first exception; everything else is phone-first).

| Route | Class in Vike app | Notes |
| --- | --- | --- |
| `/admin/sign-in`, `/admin/sign-in/code` | SPA | Email + 6-digit code; request/verify/sign-out route handlers carry over |
| `/admin/no-access` | SPA | Signed-in but not authorized |
| `/admin` (protected home) | SPA | Section hub |
| `/admin/review` | SPA | Review queue: listing matches, seller corrections (structured reports — a reviewer's approval applies the fix immediately), duplicate holds (decideDuplicate is the ONLY path for holds), false-queue handling |
| `/admin/sellers` | SPA | Seller records, eligibility, Small-farm badge, **internal notes (never public — server-enforced + tested)**, customer-service contacts, locations |
| `/admin/varieties` | SPA | Variety records, crop list, variety-remove (full-admin only, confirm dialog, blocked while live listings exist, soft removal) |
| `/admin/listings` | SPA | Listing records, listing-remove (idempotent) |
| `/admin/accounts` | SPA | Visitor accounts; Dustin = full admin, designees = reviewer role |
| `/admin/statistics` | SPA | Popularity by all four signals (views, outbound clicks, waitlist joins, searches) + Visitors card (Cloudflare Web Analytics) |
| `/admin/waitlist` | SPA | Waitlist admin + action handler |
| `/admin/more` | SPA | Overflow section |
| `/admin/*/actions`, `/admin/review/decide`, `/admin/sign-in/*` handlers | HANDLER | Form/action endpoints — carry over unchanged in behavior |
| `/offline` | Static | SPA fallback (service worker) | No | PWA offline page |
| `/unsubscribe` | SSR | HANDLER/SPA utility | No — robots-disallowed | Signed unsubscribe links |

## Non-page routes (all carry over unchanged)

| Route | Class | Notes |
| --- | --- | --- |
| `/go/[id]` | HANDLER | 302 to seller product page w/ UTM; logs click; nofollow/noopener; robots-disallowed |
| `/og/[kind]` | HANDLER | OG image generation (SVG-wedge disc pattern from Tranche 1.8 — no conic gradients) |
| `/llms.txt` | HANDLER | Retained as hygiene (Bea: not visibility work, not reported as any) |
| `/sitemap.xml` | HANDLER (SSR, DB-generated) | Becomes **segmented by type** in the port (plan §2.2, Bea §3.3); lastmod = real `updated_at` only |
| `/robots.txt` | HANDLER | Posture preserved verbatim (open to search + AI crawlers, 5.1 ruling) + plan's parameter disallows |
| `/api/v1/*` (~30 handlers incl. catch-alls) | API | Public reads, ingest, admin, account, sync/snapshot+changes, webhooks/twilio/sms, openapi.json — **shapes unchanged**; consumed server-side in `+data` hooks and client-side via TanStack Query |
| `/api/track`, `/api/revalidate`, `/api/internal/*` | API | Internal; revalidate is the edge-cache invalidation hook the SSR class depends on |

## What does NOT exist (by design)

- No `/m` tree — seeds is already one responsive tree; nothing to retire.
- No slug regeneration: slugs are database keys and carry over 1:1 (Bea §3 rule 1 — the single highest-consequence rule of this port).
