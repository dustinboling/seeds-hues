# seeds-v2-delta — Tasks

Work in order. Check each box as it passes locally. Record results in
`DELTA-REPORT.md`. Do NOT deploy, do NOT crawl any external site, do NOT send email.

## A. Schema + data plumbing
- [x] 1. Migration `0002_delta.sql` + Drizzle schema per design D1 (all new tables
  and columns, seq counter, tombstones, listing status/availability enums).
- [x] 2. Importer updates per D2 (approval fields, series rows, listing derivations,
  listing_events, R5 index rule, full-replace semantics, updated assertions).
- [x] 3. `npm run db:setup:local` from a FRESH local state converges to
  19 plants / 68 varieties / 6 sellers / 17 listings; spot-check derivations
  (Songbird × King's Ransom: in_stock, last_checked 2026-11-15; Songbird × Emma:
  sold_out; Floret × Dawn Creek Pastels: unknown availability).

## B. Prices out, URLs singular, SEO alignment
- [x] 4. Prices removed from every page, serializer and JSON-LD (R1); price sorts
  removed; packet display carries no prices.
- [x] 5. Route moves + next.config redirects + sitemap/llms/robots/tab-bar/OG
  updates (R3); ?v=/?s= retargeted.
- [x] 6. JSON-LD aligned to the canonical table (R4); index rule R5 live in
  metadata + sitemap (expect: 17 indexable varieties, 51 noindex).

## C. Pages
- [x] 7. Variety page per R6 (answer sentence, Unknown facts, listing rows,
  also-sold-as, report link, view beacon).
- [x] 8. Home (recent + coverage line), crop index/detail (filters + counts),
  series page, seller page (claim/correct/remove link; 410 path per D4).
- [x] 9. /report page; /about/data and /about/bot copy per R14.

## D. /go + events
- [x] 10. `/go/[id]` route per R7 (click_events, UTM, 302, no-store).
- [x] 11. POST /api/track view events → variety_view_counts; rollup (repository +
  POST /admin/rollup + scripts/rollup.ts) → daily_stats.

## E. API
- [x] 12. Envelope (page{}, meta.catalog_seq/generated_at), crops naming, listings
  sub-resources, series, coverage, recent, spec sorts + limit cap (R13).
- [x] 13. Search per R12 (2-char, aliases + also-sold-as flag, ranking, mixed API
  results, search_events logging, zero-result state).
- [x] 14. Sync snapshot + changes per R9 (problem+json errors; .sqlite endpoints
  untouched).
- [x] 15. Reports endpoint per R8 (Turnstile behind config, 3/min, queue item).

## F. Ingest + admin
- [x] 16. api_keys + scripts/create-api-key.ts + auth helper (D5).
- [x] 17. Ingest endpoints per R10 incl. evidence validation + idempotency.
- [x] 18. Admin endpoints per R11 (review apply/merge, seller actions incl.
  removal semantics, demand stats, health invariants).

## G. Adapter check
- [x] 19. `npx vinext check` — record output in DELTA-REPORT.md; do NOT switch.

## H. Verification
- [x] 20. Tests updated per D6; `npm run verify` green.
- [x] 21. `npm run cf:build` green; preview up; `npm run acceptance` green against
  the preview, incl. the planted evidence tests and the throwaway-seller removal
  flow.
- [x] 22. DELTA-REPORT.md written: what changed (routes/schema/data), vinext
  result, verification item by item, divergences/fallbacks stated plainly.
