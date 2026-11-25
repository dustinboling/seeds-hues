# Slice 8 — Hardening + parity (Seed Directory SPA conversion)

You are building Slice 8 of 9 in the Seed Directory's conversion to a Vike + React SPA. Slices 0–7 are merged: every public template, browse + search, shops + hubs, forms + visitor account, and the admin SPA are built in the `app/` tree. This slice hardens the whole app and proves parity against the live site, template by template and URL by URL — it is the rehearsal for Slice 9's cutover. Read first: `spa-conversion-2026-11-23/BUILD-SEQUENCE.md` (Slice 8 row), Bea's `spa-conversion-2026-11-23/PRERENDER-CONTENT-AUDIT.md` — **§1 (global contract), §1.1 (structured-data inventory), §5.3/§10 (cutover baseline + rollback framing), §8 (sitemap parity + redirect map), §12 (risks)** — the Phase-1 architecture plan's hardening sections, and the gate records `QUINN-GATE-spa-slice-5.md` (residual risk: state page 2), `QUINN-GATE-spa-slice-6.md` + `QUINN-GATE-spa-slice-7.md` (carries C2/C3/C4). Consult the current official Vike/Vite docs where needed.

**Work tests-first and treat your summary accounting as a deliverable** — the standing slice discipline. Your final summary's accounting (starting-red counts, final green counts, parity tallies) is extracted verbatim into the PR body by the coordinator, so write it complete and exact.

## Standing constraints

- Still INERT: nothing deploys; `v2/` stays the live tree and the parity BASELINE — do not modify v2 to make parity pass; every divergence is either an app-side fix or a recorded, Bea-confirmed intentional delta (the ruled deltas only: Source Sans 3 UI layer, the warmed ground, 301-uniform redirects). No `.github/workflows/*` edits except the Lighthouse CI addition this slice explicitly commissions (below) — if a different workflow change seems required, stop and report.
- Behavior and copy remain a PORT of live v2. Hardening changes headers, budgets, monitoring, and test machinery — not what pages say or do. US spelling.
- Prices are NEVER shown anywhere, in any surface, including error pages and API responses introduced here.
- Production standard: strict TS, no stubs. Every deliverable ships complete or your summary reports what is missing and why, plainly.
- **C4 (recorded, not a build task):** Dustin's 2026-11-25 Tailwind Plus admin standard postdates the converted admin build and is non-retroactive to it (Quinn's Slice 7 carry). This slice does NOT restyle the admin; state in your summary that the standard's application to the converted surfaces remains a Hue/Dustin decision to record at Slice 9.

## Step 1 — Discriminating tests FIRST

- **(i)** a parity harness: crawl the built app (served locally against the full fixture catalog) and a recorded live-site snapshot set, comparing per-URL status, canonical, title, meta description, and JSON-LD types — the harness must FAIL on the current tree for every check this slice adds (budgets, headers, inventory) and on any seeded divergence you introduce to prove it discriminates.
- **(ii)** header/CSP assertions per route class (public SSR, prerendered, SPA shell, admin, handlers, API).
- **(iii)** budget fixtures: per-template payload/asset measurements with thresholds set from the architecture plan (state the thresholds you adopt and their source).

State the red result in your summary.

## Step 2 — The work

1. **Performance budgets + Lighthouse CI:** per-template budgets (HTML weight, JS per route class, image discipline as the plan sets them) enforced in the verify chain; Lighthouse CI wired as a workflow on the built app (this slice's one sanctioned workflow addition) with the plan's thresholds; budget failures fail the gate.
2. **Security headers / CSP suite:** the header set v2 ships, ported and asserted per route class (CSP, HSTS, frame/referrer/permissions posture as v2 + the plan specify); no header may break the app (Turnstile, analytics, image CDN origins all allowlisted as v2 requires); admin/API classes carry their stricter posture.
3. **Error monitoring + uptime hooks:** the plan's error-monitoring wiring (client + server error capture to the configured sink, no PII in payloads, no price/account data in error reports); 404/410/500 error surfaces render the app's own pages with correct status codes.
4. **Structured-data inventory (discharges the recurring N3):** produce the standalone `structured-data-inventory.md` at the repo root — every template's JSON-LD types as built, diffed against Bea §1.1's measured inventory; any diff is either fixed app-side or recorded as a named, intentional delta with its ruling cited.
5. **Full parity crawl:** serve the built app against a production-shaped dataset (the full catalog export the prior slices' stubs approximate — state exactly what dataset you used and its provenance) and crawl EVERY URL in the segmented sitemap + the redirect map (§8.4) + pagination tails, comparing against the live site's responses for the same URLs: status (200/301/404/410 exact), canonical, title, JSON-LD type set. The Slice 5 residual risk closes here: a paginated state URL and shop/crop page-2 URLs are explicitly in the crawl set. Every mismatch is triaged in the summary: fixed, or a named intentional delta.
6. **Robots diff:** the built app's robots.txt vs live, byte-compared modulo the plan's sanctioned additions (§8.3) — state the diff.
7. **Accessibility pass:** route-transition focus management + announcements in the SPA (focus lands where Ada's rulings put it on client navigation; live-region announcements for in-place browse swaps already shipped get their final audit); the full template set re-checked against the WCAG 2.2 AA floor as the prior slices' gates sampled it — this slice runs it as a complete pass, and any failure is a finding to fix app-side or record.

## Step 3 — Demonstrations (state each result in your summary)

- **Parity tally:** URLs crawled, exact-match count, mismatches by class with dispositions (the crawl report is a committed artifact of this slice — state its path).
- **Budget table:** per-template measured vs threshold, pass/fail.
- **Header matrix:** per route class, the asserted headers and the suite result.
- **Day-0 rehearsal:** Bea's day-0 cutover checklist (§5.3/§10 items that can run pre-cutover) executed against the locally served built app, item by item, with results — this is the Slice 9 rehearsal; name anything that cannot be rehearsed and why.

## Your summary must state (all of it — the accounting is a deliverable; omissions are findings)

- The Step-1 red result (exact counts) and the final green result, with test counts.
- The parity tally + crawl-report path; the structured-data-inventory path and its diff result.
- The budget table summary and the header matrix result.
- The robots diff result; the accessibility pass result (failures fixed vs recorded).
- The C4 statement (above).
- Anything missing and why — plainly. Name explicitly what remains for Slice 9 (the three internal mounts — /api/internal/variety-status/[slug], /api/internal/unsubscribe/describe, /api/internal/admin/* — are Slice 9 cutover work, NOT this slice; confirm the app expects them and degrades as the gates recorded until they are mounted).
