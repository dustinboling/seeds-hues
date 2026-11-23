# Repair brief — N1: restore the /search page-view search_events log (note from the PR #51 gate)

## Provenance

Item 3.1b-1 shipped via PR #51 (merged fda4020, Worker 29241bf5). Quinn's gate returned PASS WITH NOTES (record `QUINN-GATE-tranche-3-1b1-pr51.md`, main 71b935d). Its one note, N1 (Major, analytics-only, accepted as a follow-up): **/search page views no longer write a `search_events` row.** The rebuilt page renders from `catalog.browseSearch`, which never logs; the pre-completion page logged exactly one row per view with client `web/search-page`. Quinn's proof by readback: across all her /search loads on a fresh local D1, exactly one row appeared and it was `web-autocomplete` (the SearchBox's own logging) — zero `web/search-page` rows. Impact: the admin Statistics undercount direct /search arrivals. No shopper-facing effect. This brief is the repair.

Base: current `main` (includes the shipped 3.1b-1). The pre-completion behavior is recoverable from git history: the old `v2/app/search/page.tsx` (before PR #51's branch) and the diff of `v2/app/search/page.tsx` in PR #51 show exactly what was removed.

## The work

1. Restore the page-view log on /search: **exactly one `search_events` row per /search page render** (the server-rendered page load), with the same client tag (`web/search-page`) and the same fields the pre-completion page wrote (query text and whatever else it recorded — recover them from history; do not invent new fields).
2. **In-place refinements stay silent:** the browse endpoint requests (`/api/browse/search`) that fire on filter toggles must NOT write rows — they are not page views. (The SearchBox autocomplete keeps its own separate `web-autocomplete` logging, untouched.)
3. Align the stale comment: `catalog.browseSearch`'s comment assumes the page-view log exists — after this repair it does again; make code and comment agree.
4. Add the pin Quinn asked for: a test proving one /search render writes exactly one `web/search-page` row, and a browse refinement writes none. The test must fail on current main (where no row is written) and pass on your build — Quinn will verify non-vacuity.

## Fences

- No change to /search's rendered behavior, filters, counts, or payload (3.1b-1's shipped surface is regression-checked only).
- No other surface's logging changes. No new analytics events of any other kind. No price anywhere (T-C stands as always).
- Keep the change to the smallest set of files that restores the behavior faithfully.

## Finish discipline

`npx eslint .` after each file; `npm run verify` after the test file and in full before ending your turn — iterate until it exits 0. Type fixtures with the app's exported types. Leave the tree clean and **leave your work uncommitted** (the workflow's steps handle branching and commits). If the gate goes red, a `muse/wip-<run_id>` branch survives for a repair dispatch.

## PR body hygiene

Provenance (this brief + Quinn's N1 note in `QUINN-GATE-tranche-3-1b1-pr51.md`), Build accounting (verify summary + diff census), the recovered pre-completion logging shape stated explicitly (client tag + fields, and where the write now lives), and a Gate record section for Quinn's confirmation verdict.
