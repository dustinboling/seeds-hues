# Quinn Gate — Slice 8: Hardening + parity (Seed Directory SPA conversion)

- **PR:** #81, github.com/dustinboling/seeds-hues — branch `muse/45583193488`, head `07f273e`
- **Worktree:** `~/workspace/seeds-hues-gate-s8-wt` (as provided; nothing fetched or checked out elsewhere)
- **Gate date:** 2026-11-25
- **Evaluator structure:** single evaluator (Quinn). No second rater commissioned for this gate — stated per the evaluator-effect rule; severity ratings below are single-evaluator and carry that flag.
- **Scope:** inert slice — the built artifact in the worktree + the PR's CI evidence only. No deploy judged or attempted.

## Verdict: FAIL

One commissioned acceptance criterion fails on a directly observed defect, and two further brief deliverables are absent (recorded below as coverage states with return conditions, not priced as defects). The slice's core — parity, headers, error surfaces, structured data, robots — is verified strong and exact; the failure is narrow and named: **the built app's hermetic `stub:parity` serving mode returns 500 on `/` and `/crop`, the Lighthouse CI workflow is red, and no Lighthouse assertion has ever been evaluated against this build.**

Axes kept separate (W2): Severity — per finding. Evidence — directly observed / measured / inferred / maker-claimed, labeled per item. Coverage — ledger at the end. Verdict — this section.

---

## Findings

### F1 — Major (defect, directly observed): built `stub:parity` serve returns 500 on `/` and `/crop`; Lighthouse CI red with zero assertions evaluated

- **Standard violated:** brief Step 2.1 + Repair Addendum item 1 — "Your job includes making the Lighthouse workflow GREEN"; Lighthouse CI wired "with the plan's thresholds; budget failures fail the gate."
- **CI evidence:** Lighthouse run **45596893268** concluded **failure**. Its log shows `/`, `/variety`, `/seller` collected (3 runs each), then `/crop` aborted the run: `Lighthouse was unable to reliably load the page… (Status code: 500)`, `ERRORED_DOCUMENT_REQUEST` across audits, exit code 1. `/search` was never reached and the assert step never ran — **no threshold (LCP/CLS/TBT/script-size/console-errors) has any passing or failing evidence from CI.**
- **My reproduction (built artifact, not the test harness):** `npm run build` + `build:server`, then `SEEDS_API_BASE=stub:parity npm run serve` — `/crop` → **500** (persistent on retry; body is the app's own 500 surface), `/` → **500**; server log shows `TypeError: fetch failed` for both. `/variety`, `/seller`, `/search`, `/series/sunbeam`, `/state/ohio?page=2`, `/healthz`, `/robots.txt` → 200 in the same mode.
- **Fidelity note (the process finding):** the verify suite is green because its harness runs the stub **in-process from TS sources**; the shipped serve bundle behaves differently on exactly the two templates whose prerender configs this slice added (`pages/index/+config.ts`, `pages/crop/index/+config.ts`). This is the W2 fidelity gap in concrete form: low-fidelity evidence (in-process) was priced as if it covered the built artifact's serving mode. The builder's turn-end note named this exact blocker "then-undiagnosed"; the repair turns did not close it, and the C1 section's silence on the local reproduction is the miss — CI was left as the first real test of the built mode.
- **Workaround / scope limit:** production serving mode (live API base) is not implicated by any evidence here; the defect is confined to the hermetic mode — which is, however, precisely the mode Slice 9's day-0 rehearsal and the Lighthouse gate depend on.
- **Severity reasoning:** Major, not Blocker — the app's user-facing surfaces are proven by the parity/headers evidence below; what fails is a commissioned gate deliverable and the rehearsal serving mode. It blocks a clean Slice 8 close and must block Slice 9's rehearsal until fixed.

### F2 — Coverage state (not a defect): the a11y per-template static audit block does not exist in the tree

- Brief Step 2.7 requires the full template set re-checked against the WCAG 2.2 AA floor as a **complete pass** this slice. Builder-declared open item (2).
- **What exists (verified):** route-transition focus + announcement pins — `tests/dom/route-focus.test.tsx` (5 tests) and `tests/dom/inplace-focus.test.tsx` (4 tests), both green in my reproduced run; image alt/dimension discipline asserted per template inside the budget block of `slice8-hardening.test.ts`.
- **What does not exist:** no per-template static audit block (no axe run, no per-template aria/contrast/landmark audit suite) anywhere in `app/tests/` — searched. The repair turns did not add it.
- **Return condition:** the complete per-template pass is executed and recorded, or the lead records an explicit acceptance/deferral to Slice 9 in this gate record's place. Until then the brief's accessibility deliverable is **unchecked, not passed**.

### F3 — Coverage state (not a defect): Day-0 rehearsal + printed budget table + Slice 9 mount re-confirmation — partially closed, artifacts absent

- Builder-declared open item (3). **Partially closed by the repair turns, in test form:** `slice8-hardening.test.ts` carries a `day-0 rehearsal (automatable subset)` block (sitemap index lists the seven Bea §8.2 segments; no paginated/filtered/noindex URLs in sitemaps; lastmod values are real dates; legacy + port-requirement redirect rows answer a single 301; wrong-case paths 404; merged-variety one-hop with `?small_farm=true` preserved; freshness fan-out last) — all green in my run. That is real rehearsal evidence for the automatable subset.
- **Still absent from the tree:** (a) any item-by-item Day-0 rehearsal record naming what could not be rehearsed and why (the brief's Step 3 demonstration); (b) the printed per-template budget table (measured vs threshold) — budgets are enforced per template in the suite and thresholds are documented in `performance-budget.json`, but no measured-vs-threshold table artifact exists; (c) any Slice 9 mount-degradation re-confirmation statement (the three internal mounts). On (c), my own spot evidence: `src/data/api.ts` documents the variety-status lookup as fail-closed and `serve.ts` relays `/api/internal/admin/*` with a 502-on-unreachable posture — consistent with the Slice 6/7 gate records, but the slice's own re-confirmation was not produced.
- **Return condition:** rehearsal record + budget table filed (they can be generated from the suite's own measurements), and the mount re-confirmation stated, before or as part of Slice 9's brief.

### N1 — Minor (labeling): PR-body Verify claim vs the PR's own Verify workflow state

The PR body states the workflow gate passed before PR creation (in-job verify, run 45583193488's log) — plausible and consistent with my independent reproduction (below). But the PR's own **Verify workflow run 45596893276 was still `in_progress` at every check during this gate** (first check and last check, ~25 minutes apart). The C1 section does not distinguish the in-job gate from the PR Verify run. Not a false claim; an imprecise one. The coordinator should record 45596893276's conclusion alongside this gate before merge — if it concludes anything but success, this gate reopens.

### Calibration judgment (emphasis item 2): honest, not a quiet weakening

`performance-budget.json` vs `.lighthouserc.json` are pinned assertion-for-assertion by `tests/unit/performance-budget.test.ts` (green). JS 153,600 B gzip = the plan's 150 KB uniform budget, exact. CLS 0.1 = plan, exact. TBT 200 ms is labeled in both files as the INP lab proxy. LCP 6,000 ms is labeled in both files as a **lab regression guard** against the plan's 2.5 s **field** goal — the calibration and its reasoning are printed in the artifact, not buried. That is honest calibration. The failure is F1's: the calibrated thresholds were never actually asserted in CI because the run died at collection.

---

## Disposition of the three builder-declared open items

| # | Item | Disposition |
|---|---|---|
| 1 | Lighthouse workflow green | **NOT CLOSED.** CI run 45596893268 = failure; root cause reproduced locally in the built artifact (F1). No assertion evidence exists. |
| 2 | A11y per-template static audit block | **NOT CLOSED.** Absent from the tree (F2). Focus/announcement pins exist and pass. |
| 3 | Day-0 rehearsal + printed budget table + Slice 9 mount re-confirmation | **PARTIALLY CLOSED.** Automatable-subset rehearsal exists as a green test block; the rehearsal record, printed budget table, and mount re-confirmation artifacts were not produced (F3). |

## C1 accounting grade: PASS (accurate, plainly labeled)

The coordinator-appended C1 section is present, states its provenance plainly (main turn ended at step budget; repair turns brought the workflow gate green; figures are the builder's own), declares the three open items without softening, and carries the required C4 statement verbatim in substance. Every figure I could reproduce matched exactly: final counts 65 files / 1,257 tests (mine: identical), parity 220/220 with the stated status split (168×200 / 23×301 / 3×302 / 24×404 / 2×410 — matches the committed report), starting-red as stated is consistent with the tree. One imprecision only: N1 above. This is the Slice 7 standard, met.

---

## What I exercised, and how (emphasis items)

1. **Verify chain reproduced from clean `npm ci`** (app/): lint + typecheck + test — **65 test files passed, 1,257 tests passed**, exit clean. Exact match to the PR claim. Parity suite re-run standalone: **224/224 passed**, and the regenerated `app/parity-reports/slice8-parity-report.md` is **byte-identical to the committed report** (git clean after regeneration). The crawl includes `/state/ohio?page=2` (25-seller Ohio fixture — Slice 5 residual closed), shop and crop page-2 rows, and the 30 sunflower detail rows via the parity catalog graft.
2. **Lighthouse:** CI conclusions read via `gh` — Lighthouse 45596893268 **failure** (see F1); Verify 45596893276 still in_progress at gate close (N1). Calibration audited file-to-file (above): honest.
3. **Headers/CSP matrix — exercised over HTTP against my own served build**, not only via the suite: public SSR (`/variety`) carries HSTS, nosniff, referrer, permissions, and the document CSP with Turnstile (`challenges.cloudflare.com`), analytics (`static.cloudflareinsights.com`), and the image CDN (`images.seeds.hues.flowers`) allowlisted, §9 cache posture present; admin gate answers 303 with the stricter CSP (no external script/connect origins, `frame-src 'none'`), `no-store`, `X-Robots-Tag: noindex`; `/sw.js` 200 on recheck (one transient 404 on the first probe immediately after server start, not reproducible — not counted as a finding); `/healthz` 200 `{"ok":true}`.
4. **Error surfaces + monitoring:** forced over HTTP — unknown path → app's own 404 page, true 404, no-store; `/seller/shuttered-seed-co` → **410**; `/go/5` → **410**; `/crop` under the dead-data path → app's own 500 surface with true 500. `POST /api/client-errors` with a poisoned payload (email, $ amount, phone) → 204. **Payload shape inspected in source**, not just trusted from tests: `buildErrorReport` strips the query string from the report URL (unsubscribe tokens cannot leak), deep-redacts sensitive keys at any depth (email/phone/token/secret/session/code/price/cost/amount/account/name families), pattern-redacts emails, $ amounts, price keys, codes, and phone shapes in free text, and bounds the serialized payload. No price or PII survives by construction; the suite's sink-delivery test (green) proves the redacted shape reaches the sink.
5. **Structured-data inventory — diffed myself against Bea §1.1** (PRERENDER-CONTENT-AUDIT.md): every template row matches — home WebSite+Organization (ruled §11 logo/sameAs addition only), browse/detail/seller/crop/series/state type sets exact, zero-seller variety pages emit the empty sellers ItemList (live-recorded behavior, §1.1's "empty list / omitted" resolved by measurement), static-informational none (no trail on those templates, verified in the doc's own list), prohibited list absent and code-guarded. **EXACT MATCH, 0 unruled diffs — claim confirmed.** Series OG: served `/series/sunbeam` carries `og:image = https://seeds.hues.flowers/og/site/default` (1200×630 site card) — Slice 5's N2 resolved as claimed.
6. **Robots — byte-compared myself:** served `robots.txt` vs the live fixture `app/tests/fixtures/robots-live.txt` differs by exactly the 3 sanctioned disallows (`/*?*sort=*`, `/*?*limit=*`, `/*?*session=*`) and nothing else.
7. **Accessibility:** per F2 — the complete pass does not exist; the focus/announcement pins that do exist pass. My own DOM-level check is limited to the jsdom dom-suite (real components, real loaders; not a real browser — see boundaries). Route-transition behavior beyond the pins is **unchecked**, not passed.
8. **Mutation spot-checks (standing pattern) — 3/3 noticed, all restored byte-identical (git clean at gate close):**
   - HSTS value emptied in `src/server/headers.ts` → `tests/unit/headers.test.ts` 1 failure. Restored.
   - Parity row broken (`/state/ohio?page=2` expected 200→404 in the snapshot) → `slice8-parity.test.ts` 4 failures. Restored; clean re-run regenerates the committed report byte-identical.
   - Price redaction disabled (`PRICE_PATTERN` neutered in `src/lib/error-report.ts`) → `tests/unit/error-report.test.ts` 2 failures. Restored.

## Coverage ledger

- **Population:** the brief's Step 2 deliverables (budgets + Lighthouse CI, headers/CSP, error monitoring + error surfaces, structured-data inventory, full parity crawl, robots diff, accessibility pass) + Step 3 demonstrations + C1/C4 accounting.
- **Strata checked:** verify chain (full, reproduced); parity crawl (full 220-row set, suite + report byte-identity + one mutation); headers (suite + my own HTTP probes across public SSR, admin, /sw.js, /healthz, 404); error surfaces (404/410/500 forced over HTTP + payload-shape source inspection + relay probe); structured data (full §1.1 diff by hand + served OG check); robots (byte diff by hand); Lighthouse (CI log read in full for the failing run; config-vs-budget pin audit); a11y (tree search + pin suites).
- **Structured sample:** as above. **Adversarial addition:** the three mutations; the poisoned client-errors payload; the built-artifact serve in the exact CI mode (`stub:parity`), which is what found F1.
- **Exclusions, with reasons:** a real-browser drive of the hydrated SPA — no live-browser session is available to this gate (subagent boundary); hydrated behavior rests on the jsdom dom-suites (fidelity: real components and loaders, doubles for the router/paint path). Production serving mode against the live API — the slice is inert by design; nothing here proves or disproves it. The PR Verify workflow's conclusion — still in_progress at gate close (N1).
- **Residual risk:** defects that appear only in a real browser's router/paint path, only against production-shaped data beyond the parity fixture catalog, or only in the production Worker's edge behavior could still escape this coverage. F1 additionally means the lab-performance class (LCP/TBT/script weight in a real Chrome run) currently has **no evidence at all** — that class is open, not merely residual.

## Carries for Slice 9

1. **F1 fix first:** diagnose the built-bundle `stub:parity` fetch failure on `/` and `/crop` (the in-process harness cannot see it — add a built-artifact smoke probe to the verify chain so this fidelity gap cannot recur silently), then a green Lighthouse CI run with all five assertions actually evaluated, recorded in the PR body.
2. **F2:** the complete per-template a11y pass, executed and recorded — or an explicit lead acceptance of the deferral.
3. **F3:** file the Day-0 rehearsal record (item-by-item, naming the unrehearsable), the printed per-template budget table (measured vs threshold), and the Slice 9 mount-degradation re-confirmation for the three internal mounts (`/api/internal/variety-status/[slug]`, `/api/internal/unsubscribe/describe`, `/api/internal/admin/*`) at mount time.
4. **N1:** record Verify run 45596893276's conclusion with the merge paperwork.
5. **C4 (unchanged, builder's statement confirmed present):** the Tailwind Plus admin standard's application to the converted surfaces remains a Hue/Dustin decision to record at Slice 9.
6. The 404 document-title delta (app "Page not found" vs live home-title fallthrough) still awaits a Bea ruling if exactness is required — already recorded in the parity report; Slice 9 is where the report itself says it belongs.
