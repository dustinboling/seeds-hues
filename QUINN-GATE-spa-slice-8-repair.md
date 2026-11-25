# Quinn Delta Re-Gate — Slice 8 REPAIR (PR #82): hermetic serving 500 (F1) + a11y block (F2) + rehearsal artifacts (F3)

- **PR:** #82, github.com/dustinboling/seeds-hues — branch `muse/45598779976`, head `026e21c` (PR #81's tree `07f273e` plus the repair commit)
- **Worktree:** `~/workspace/seeds-hues-gate-s8r-wt` (as provided; nothing fetched or checked out elsewhere)
- **Gate date:** 2026-11-25
- **Evaluator structure:** single evaluator (Quinn). No second rater commissioned for this delta re-gate — stated per the evaluator-effect rule; severity ratings below are single-evaluator and carry that flag.
- **Scope:** delta re-gate only — verify the FAIL in `QUINN-GATE-spa-slice-8.md` is cured. What Slice 8 verified strong (parity, headers, error surfaces, structured-data inventory, robots) was not re-litigated, except the regression spot-checks named in the brief.
- **Prior record note:** `QUINN-GATE-spa-slice-8.md` and `muse-tasks/spa-slice-8-repair.md` were read from the Slice 8 gate / paperwork worktrees where they live; neither file is in this worktree's tree. The repair brief's requirements are fully reflected in PR #82's C1 accounting, which I graded against the tree.

## Verdict: PASS WITH NOTES

F1 is cured at its root, proven on the built artifact by my own hands and by a discriminating probe I mutation-tested myself. F2 and F3 are closed with artifacts in the tree. The Lighthouse gate has, for the first time, actually asserted — CI green with the assert step executed. The notes are carries and watch items, not defects; none is severity 3+.

Axes kept separate (W2): Severity — per finding. Evidence — directly observed / measured / inferred / maker-claimed, labeled per item. Coverage — ledger at the end. Verdict — this section.

---

## Item 1 — F1 reproduction, my own hands: CURED

**Claimed root cause — confirmed against the code I read.** `app/server/serve.ts` (lines 240–255) translates `SEEDS_API_BASE=stub:parity` into a real embedded-stub URL only for its own `CatalogApi` instance, which it passes to renders via `pageContextInit` (renderPage calls at lines 334 and 683 carry `catalogApi: api, dataCache: cache`). The process singletons in `src/data/load.ts` (`getCatalogApi()` → `apiBaseUrl()` → the literal env value) would fetch `stub:parity/...`, which undici cannot parse. On PR #81 the `/`, `/crop`, and `/api-docs` `+data` hooks ignored `pageContext` and used those singletons. On this tree all three hooks now take `pageContext` and prefer `pageContext.catalogApi ?? getCatalogApi()` and `pageContext.dataCache ?? getDataCache()` — the codebase's own established pattern — and `/unsubscribe`'s describe call now prefers `pageContext.adminApiBase` (same defect class, fail-soft variant). The accounting's secondary claim (why `/` was masked by the prerendered static while `/crop` was not) is consistent with the smoke probe's design, which parks `dist/client/index.html` precisely to unmask `/`. **The C1 root-cause paragraph is accurate in every particular I could check.**

**My reproduction (built artifact, not the test harness):** clean `npm ci` (588 packages), full verify (below), then my own serve of the built server — `PORT=4319 SEEDS_API_BASE=stub:parity node dist-server/serve.mjs`:

| URL | Status | Bytes | Note |
|---|---|---|---|
| `/` | 200 | 79,135 (static) / **19,749 via renderPage** | static parked to force the F1 path: 200, real `<title>seeds.hues.flowers — Find Where to Buy Any Flower Seed</title>`, one `<main>` |
| `/crop` | 200 | 13,275 | the Slice 8 persistent 500 — gone |
| `/variety` | 200 | 63,933 | |
| `/seller` | 200 | 49,943 | |
| `/search` | 200 | 11,236 | |
| `/api-docs` | 200 | 12,048 | third member of the defect class |

All `text/html`, all substantial bodies with real content. The renderPage `/` (19,749 B), `/crop` (13,275 B), `/variety` (63,933 B), and `/seller` (49,943 B) byte counts match the F3 budget table **exactly** — independent cross-validation of both the fix and the artifact (see Item 5).

## Item 2 — The smoke probe: exists, built-artifact, discriminates

- **Exists in the verify chain:** `app/tests/build/slice8-hermetic-smoke.test.ts` ran inside my reproduced `npm run verify` — 6/6 green. It builds hermetically, spawns the **built** `dist-server/serve.mjs` with the literal `SEEDS_API_BASE=stub:parity` (not the in-process harness — the fidelity gap from my FAIL record is closed by construction), parks the prerendered home static so `/` exercises renderPage, and asserts 200 + HTML content-type + non-empty HTML on the five Lighthouse URLs plus `/api-docs`.
- **Discrimination, my own mutation:** I temporarily restored `app/pages/index/+data.ts` to its PR #81 form (no `pageContext`, singleton `loadHomeData()`). The probe failed with exactly the F1 signature — `× / answers 200… AssertionError: /: expected 500 to be 200`, the other five green. Restored byte-identical (sha256 `625b4680…` before and after; `git status` clean). One hook mutated of the three suffices to prove the mechanism; the builder's claimed red-on-#81 of 3 failed (all three hooks) is consistent with this result and with my Slice 8 reproduction.

## Item 3 — Lighthouse evidence: GREEN, assert executed, thresholds honest

- **Lighthouse CI run 45608475941** (PR #82, head `026e21c`): **conclusion success**. I read the full log: collect completed all five URLs × 3 runs (15 runs — `/crop` collected 3/3, the first time ever), then `Checking assertions against 5 URL(s), 15 total run(s)` → `All results processed!`, median LHRs uploaded for all five URLs, autorun completed. No assertion-failure lines, no `ERRORED_DOCUMENT_REQUEST` anywhere in the log. LHCI autorun exits non-zero on any error-level assertion failure, so the success conclusion with the assert phase demonstrably executed means all 25 assertions (5 audits × 5 URLs) were evaluated and passed. This discharges F1's CI half.
- **Threshold comparison against my Slice 8 calibration judgment:** `.lighthouserc.json` vs `performance-budget.json` — LCP 6000 (lab guard), TBT 200, JS 153600, CLS 0.1: **unchanged, exact**. One form change: `errors-in-console` moved from `maxNumericValue: 0` to `minScore: 1`. **My judgment: not a weakening.** The builder's evidence is that Lighthouse 12 exposes no numeric value for this audit, so `maxNumericValue` evaluated NaN and could never pass regardless of page cleanliness (their local run 1: exactly this failure on all five URLs with pages scoring 1 and zero console items). `minScore: 1` asserts the identical standard — score 1 is reached only with zero console errors — in the only form the tool can evaluate. The change is labeled in both artifacts (budget `source` note + pin-test comment), and `tests/unit/performance-budget.test.ts` now pins the exact form plus `consoleErrors: 0` in the budget. Honest calibration, same pattern I approved at Slice 8. The C1 per-URL median table (LCP/TBT/CLS/JS/console) is consistent with the CI evidence; the thin lab-JS margins on `/variety` (1.8%) and `/seller` (2.9%) are declared by the builder as a watch item, not buried — carried below.
- **Verify run 45608475922** (PR #82): still `in_progress` at this record's close. Not a finding: PR #82's body makes no claim about this run (the N1 imprecision is not repeated), and my own clean reproduction of the identical chain is exact (Item 6). Its conclusion should be recorded with the merge paperwork as a matter of routine.

## Item 4 — F2, the a11y per-template static audit block: CLOSED, discriminates

- **Exists:** `per-template static accessibility audit` block in `app/tests/build/slice8-hardening.test.ts`, green inside my reproduced verify (hardening file: 215 tests total).
- **Coverage matches the brief's inventory:** `A11Y_TEMPLATES` = the 15 budget templates + 8 further static-informational URLs (`/about/data`, `/about/bot`, `/api-docs`, `/privacy`, `/terms`, `/add-your-farm`, `/unsubscribe`, `/offline`) + the 404/410/500 error surfaces = **26 templates**, × 5 properties (landmarks incl. skip link and skip target; heading order — exactly one h1, first, no skipped levels; form labels incl. wrapping labels and image-button alt; link/button names + no aria-hidden focusables + resolving aria refs; no positive tabindex) + 1 shipped-CSS `:focus-visible` test = **131 tests**. The claimed count arithmetic closes exactly (26 × 5 + 1 = 131), and the count delta reconciles the whole PR (Item 6).
- **Discrimination, my own mutation:** I changed the report template's `<h1 id="report-title">` to `<h2>` (both tags). Result: exactly 1 red — `report headings start at h1 exactly once with no skipped levels` (`report: one h1 (2): expected [] to have a length of 1 but got +0`). Restored byte-identical (sha256 `d2312754…`; git clean). (My first attempt changed only the opening tag and failed the JSX build instead — a build break, not audit evidence; I corrected the mutation and re-ran. Recorded here so the method stays honest.)
- **Scope honesty:** this is a static audit of served HTML, which is what F2 commissioned. It does not replace the real-browser / assistive-technology pass; hydrated route-transition behavior remains covered only by the pre-existing focus/announcement pins, as recorded at Slice 8.

## Item 5 — F3 artifacts + mount re-confirmation: CLOSED

- **`app/parity-reports/slice8-day0-rehearsal.md`** — exists at the stated path. Item-by-item R1–R12 over HTTP against the built hermetic serve, with an explicit unrehearsed list and reasons (post-switch Console work, GSC baseline blocked on access, days 1–7/28 watches, the switch itself, live Turnstile/mail, in-process-only fan-out). R3 is recorded as a **verified omission** (0 lastmod emit on stub builds by the seq-verified rule), with the positive rule cited to unit level and the built-artifact lastmod test's vacuity on stub builds disclosed **both** in the record and in a comment added to that test itself. That is the honest handling my FAIL record asked for.
- **`app/parity-reports/slice8-budget-table.md`** — exists at the stated path; 15/15 PASS, measured vs threshold per template. Internal consistency cross-checked by me: the 15 templates are exactly `BUDGET_TEMPLATES`; percentages recompute (variety-detail JS 136,296/153,600 = 88.7% ✓); image counts sum to the stated 143; and four templates' HTML byte counts match my own independent serve byte-for-byte (Item 1). The table correctly defers lab transfer figures to the LHCI medians.
- **Mount degradation re-confirmation — stated per mount** in the rehearsal record's closing section and pinned by tests I read:
  1. `/api/internal/variety-status/[slug]` — faults throw fail-closed (merged slugs 500, never wrong-404/301); new unit test in `tests/unit/variety-route.test.ts` pins lookup-throw + route-propagate against a dead mount.
  2. `/api/internal/unsubscribe/describe` — faults read as no scope (invalid-link state, 200); HTTP test in the hardening suite's new `Slice 9 mount degradation` block against a dead backend.
  3. `/api/internal/admin/*` — unreachable backend answers 502 JSON; HTTP test in the same block.
  Positives for all three resolve hermetically (rehearsal R6/R12). This matches the Slice 6/7 gate records' posture.

## Item 6 — Regression spot-check: exact

- **Full verify reproduced from clean `npm ci`:** lint + typecheck + test, exit 0 — **67 test files passed, 1,401 tests passed**. Exact match to the PR claim. Delta vs PR #81 (65 / 1,257) is +2 files / +144 tests, and the arithmetic closes exactly against the claimed additions: smoke 6 + a11y 131 + image-manifest 4 + mount tests 3 (2 hardening HTTP + 1 variety-route unit) = 144.
- **Parity:** `slice8-parity.test.ts` 224/224 in my run; the regenerated `app/parity-reports/slice8-parity-report.md` is **byte-identical** to the committed report (working tree clean after the full verify) — 220/220 exact matches (168×200 / 23×301 / 3×302 / 24×404 / 2×410) as recorded at Slice 8.
- **HSTS mutation (from my Slice 8 set):** `HSTS_VALUE` emptied in `src/server/headers.ts` → `tests/unit/headers.test.ts` 1 failure (85 passed). Restored byte-identical (sha256 `e75b0c56…`; git clean). Still noticed.
- **Change hygiene:** the repair diff touches no `.github/workflows/*` file and nothing under `v2/` (verified by diff stat). The image-manifest re-encoding that bought the JS headroom is behavior-pinned: `tests/unit/image-manifest.test.ts` resolves **all 1,076** current v2 entries through the app's `originalKey` (870 png-twins + 11 overrides + 195 identities — sums exact; file 86,191 → 39,442 B, measured). The 18 accidentally committed local LHR artifacts were removed and `.lighthouseci/` git-ignored — reasonable hygiene, no evidence lost (CI uploads its own).

## N1 from the FAIL record: DISCHARGED AND CLOSED

PR #81's Verify run **45596893276** concluded **success** (read via `gh` this gate: status completed, head `07f273e`). The labeling imprecision is closed by fact, as my FAIL record conditioned. No carry.

## C1 accounting grade: PASS (present, accurate, plainly labeled)

The coordinator-appended C1 section is present in PR #82's body with its provenance stated (extracted verbatim from workflow run 45598779976's run log). Every figure I could reproduce matched: final counts 67/1,401 (mine: identical); the +144 delta decomposes exactly into the claimed additions; the manifest figures (870 + 11 + 195 = 1,076; 39,442 B) match the tree; the budget table's bytes match my own serve; the LHCI claims match run 45608475941's log. The F1 root-cause paragraph is exact (Item 1). Labeling is the Slice 7 standard met again: the errors-in-console form change is explained in both artifacts rather than slipped through; the vacuous-on-stub lastmod test is disclosed in the record **and** in the test; the thin JS margins are declared as watch items; C4 is recorded as a decision owed, not silently dropped. One historical sub-figure I did not independently recount — the "1,062 old resolutions / 14 new mappings" split of the 1,076 — is not load-bearing: the equivalence claim that matters (every current v2 entry resolves to v2's key) is test-pinned and green in my run.

## Coverage ledger

- **Population:** the FAIL record's return conditions — F1 (root-cause fix + built-artifact probe + green asserted Lighthouse), F2 (per-template a11y block), F3 (rehearsal record + budget table + mount re-confirmation) — plus the brief's named regression spot-checks and the N1 closure.
- **Strata checked:** built-artifact serving in the exact CI mode (my own serve, six URLs, `/` forced through renderPage); the probe as code and as a mutation target; CI evidence (both PR #82 runs' states read via `gh`, Lighthouse log read in full); config honesty (`.lighthouserc.json` + `performance-budget.json` vs my Slice 8 calibration, file-to-file); the a11y block as code (inventory counted by hand) and as a mutation target; both F3 artifacts (existence, internal arithmetic, byte-level cross-check against my serve); mount tests (2 HTTP + 1 unit, read); full verify + parity byte-identity; one Slice 8 regression mutation (HSTS).
- **Structured sample:** as above. **Adversarial addition:** three mutations of my own (F1 hook revert → probe red; h1→h2 → a11y red; HSTS empty → headers red), all restored byte-identical, tree clean at record close.
- **Exclusions, with reasons:** a real-browser drive of the hydrated SPA — no live-browser session is available to this gate (subagent boundary), unchanged from Slice 8; the delta touches no interactive flow (serve-layer data hooks, tests, artifacts), so no new interactive surface went unproven by this exclusion. PR #82's Verify CI run conclusion — still in progress at record close; my reproduction of the identical chain stands in its place, and its conclusion is a merge-paperwork routine, noted above. The builder's local LHCI runs — maker evidence only; the graded Lighthouse evidence is CI run 45608475941, read directly.
- **Residual risk:** defects visible only in a real browser's router/paint path or against production-shaped data beyond the parity fixture catalog could still escape this coverage, as at Slice 8. The lab-performance class now has real CI evidence; its `/variety` and `/seller` JS margins are thin (below), so the class's residual risk is growth, not absence of evidence.

## Final carry list for Slice 9

1. **Lab-JS watch (from the builder, endorsed):** `/variety` and `/seller` sit at 1.8% / 2.9% under the 150 KB lab transfer ceiling on this code. Deterministic today; any Slice 9 JS growth must mind the ceiling — headers (~20 KB) sit above the static sums.
2. **Known limitation, disclosed:** the built-artifact sitemap-lastmod test is vacuous on stub builds by construction (seq-verified omission); the positive rule is unit-proven. Do not mistake a green there for emission evidence at cutover rehearsal — the live-data rehearsal in Slice 9 is where lastmod emission gets its real check.
3. **PR #82 Verify run 45608475922:** record its conclusion with the merge paperwork (expected success; my reproduction was exact). PR #81 stays open until #82 merges and supersedes it, per the lane's plan.
4. **C4 (unchanged):** the Tailwind Plus admin standard's application to the converted surfaces remains a Hue/Dustin decision to record at Slice 9.
5. **The 404 document-title delta** (app "Page not found" vs live home-title fallthrough) still awaits a Bea ruling if exactness is required — carried from Slice 8, recorded in the parity report.
6. **Slice 9's own mounts** replace the three degradations re-confirmed here (`variety-status`, `unsubscribe/describe`, `admin/*`); the rehearsal record's R6/R12 positives are the behavior baseline they must preserve.
