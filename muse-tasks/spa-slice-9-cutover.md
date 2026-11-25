# Slice 9 — CUTOVER (Seed Directory SPA conversion)

You are executing Slice 9 of 9: the atomic switch of seeds.hues.flowers from the Next.js app in `v2/` to the Vike + React app in `app/`, built and gated across Slices 0–8. This slice is unlike the others: **it touches production.** Read first: `spa-conversion-2026-11-23/BUILD-SEQUENCE.md` (Slice 9 row), `spa-conversion-2026-11-23/ARCHITECTURE-BRIEF.md` (cutover section), Bea's `spa-conversion-2026-11-23/PRERENDER-CONTENT-AUDIT.md` **§5.2/§5.3 (baseline + rollback triggers), §10 (Search Console baseline)**, and the gate records `QUINN-GATE-spa-slice-8.md` + `QUINN-GATE-spa-slice-8-repair.md` (the final carry list — every item below traces to it).

**PRECONDITIONS — verify each before any production step; if one fails, STOP and report:**
1. **Bea's Search Console read access is arranged** (the hues.flowers Domain property, Settings → Users and permissions — Dustin's in-console grant) and the pre-cutover baseline is captured per §10. If access is still unarranged, the cutover does NOT proceed — this is the carried dependency flagged since Slice 8.
2. Dustin's cutover go is on record (the Q4 soft-stagger ruling governs timing vs hues.flowers' cutover: if both properties gate-pass in the same week, seeds cuts over a few days after hues.flowers; if seeds is ready well first, it does not wait).
3. The C4 decision (Tailwind Plus admin standard's application to the converted admin) and the 404-title delta's Bea ruling are recorded — or Dustin explicitly waives them for cutover.

## Standing constraints

- The old Worker stays deployable for the full sign-off window; rollback is a Worker redeploy of the v2 build, never a code change under pressure. Bea §5.3's rollback triggers are binding: if a trigger fires, roll back first, diagnose second.
- Migrations, if any, apply to production D1 explicitly and are verified BEFORE the switch (the lane's standing rule). No schema change is expected in this slice.
- Prices never shown anywhere. US spelling. Nothing about the backend (D1, /api/v1, ingest, admin auth) changes.

## Step 1 — The three internal mounts (HARD pre-cutover blockers, from Slices 3/6/7)

Mount from D1 in the production Worker, exactly as the app expects them, preserving the R6/R12 positive behavior baseline Quinn pinned at the Slice 8 re-gate:
1. `/api/internal/variety-status/[slug]` — without it, merged AND unknown variety slugs 500 (not 404) against the real API.
2. `/api/internal/unsubscribe/describe`.
3. `/api/internal/admin/*` — the admin relay endpoints.
Each mount gets a live-data proof against production D1 before the switch (real slug, real token shape, real admin session class) — the stub-pinned degradation behavior is the fallback contract, not the goal.

## Step 2 — Pre-switch rehearsal on live data

- Serve the built app against production-shaped data (the Slice 8 rehearsal, this time with the mounts live): the parity crawl re-run against the rehearsal surface; the lastmod real-emission check (Slice 8's stub-vacuous test becomes real here); the lab-JS watch items (/variety at 1.8% and /seller at 2.9% under the 150 KB ceiling) re-measured on the live-data build.
- The legacy service worker supersession path (ARCHITECTURE-BRIEF) verified: a client holding the v2 SW lands on the new app cleanly.
- **C3 discharged here:** the real-browser drive of the enhanced form/account/admin flows (real form construction, client route change with a live session, rendered iPad admin check) — the drive every prior gate owed for lack of a browser session. Coordinate with Hue for the browser session; Turnstile legs need the human/mailbox route as established.

## Step 3 — The switch + day-0

- Atomic switch of the `seeds-hues` Worker to the Vike app, per the ARCHITECTURE-BRIEF cutover sequence.
- Day-0 checklist (Bea §5.3): full-sitemap crawl of the LIVE new site vs the baseline (status/canonical/title/JSON-LD per URL), robots diff, the spot checks (variety with sellers, zero-seller variety, one shop, one crop hub, one state page 2, admin sign-in), sitemap resubmission in Search Console, redirect uniformity asserted (301, one hop).
- Day-7 alarm check scheduled and named; **day-28 sign-off** against the pre-cutover baseline closes the conversion — record both dates in the project records at switch time.

## Your summary must state

- Each precondition's verification result.
- Each mount's live-data proof.
- The day-0 crawl tally (URLs, exact matches, mismatches with dispositions) and the rollback-trigger status.
- The C3 drive result; the sign-off dates recorded.
- Anything that deviated and why — plainly. A rollback, if one happens, is reported as a rollback with its trigger named.
