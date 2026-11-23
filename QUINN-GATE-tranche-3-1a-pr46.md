# Quinn Gate — Tranche 3.1a re-gate, PR #46 (successor fix for PR #41 findings F1 + F2)

**PR:** https://github.com/dustinboling/seeds-hues/pull/46 · branch `muse/45100978944` · head `30f6eca`
**Stack:** PR #46 = PR #41 head `fbf625e` + exactly one commit (`30f6eca`). Merge-base vs current `origin/main`: `f5220a5` (same as PR #41).
**Brief:** `muse-tasks/tranche-3-1a-fix.md` on main, incl. the coordinator addendum at `10555fa` (surgical: F1/F2 only; full verify green incl. the browse DOM suite). **Spec:** Tranche 3 SPEC §2.4.2, §2.6.1, §2.6.2. **Governing prior record:** `QUINN-GATE-tranche-3-1a-pr41.md` — its return conditions govern this re-gate.
**Gate run:** 2026-11-22, Quinn. Diff read line by line; F1/F2 source and test pins read in full in a fresh scratch worktree (`seeds-hues-quinn-pr46-wt` at PR head).

## Verdict: PARTIAL GATE — NOT A PASS (maps to FAIL in the pass/notes/fail vocabulary)

**F1 and F2 are fixed** — confirmed at code + test-pin fidelity, with the rendered forms proven textually in both directions (below). Scope is surgical, exactly as the addendum required. On the merits of the fix itself, nothing remains open except one Minor process finding (N1, the PR-body accounting, a recurrence of PR #41's F3).

The gate still cannot pass, for one reason, stated plainly: **the two execution conditions of a PASS did not run in this session.**

1. **Quinn's own `npm run verify` reproduction — UNCHECKED (blocked, not failed).** The scratch-worktree checkout of the PR branch was flagged by an execution-risk security check the moment it completed: the checked-out content can run code during ordinary processing, and Quinn was directed not to run, build, test, import, or operate git/package-manager commands inside it without the user's explicit go-ahead. Quinn does not override that direction on her own authority, and no go-ahead was in hand this session. The only verify numbers available are therefore the workflow's own (PR body: 67 files / 1145 tests — maker-side evidence, labeled as such wherever used below).
2. **The owed real-browser drive — UNCHECKED (blocked, same cause + standing boundary).** The drive requires building and serving the branch locally, which is running the flagged content; it is blocked by the same direction. It was already owed from PR #41 (it did not run at either prior gate); it remains owed, in full, with the exact conditions re-listed below. Per the standing rule: suite green (even if it had been Quinn's own run) + browser unrun = unchecked, never rounded up — and here the suite run is not even Quinn's.

**Return conditions (narrow):** (a) the user/coordinator gives the go-ahead to run the branch's code in the scratch worktree, OR a browser-capable agent with that clearance executes them; (b) Quinn (or that agent, with Quinn reviewing the record) runs `npm run verify` in `v2/` on `30f6eca`, the non-vacuity pair by execution, and the owed drive below; (c) re-gate is then a narrow confirmation — F1/F2 need no further work unless the drive surfaces a regression in the renamed controls. **Do not merge on this record.**

---

## F1/F2 confirmation (severity / evidence / coverage / verdict kept on separate axes)

### F1 — FIXED — Per-option counts now carry the sr-only unit (§2.4.2)

- **Object:** `v2/components/ui/BrowseFilters.tsx`, `ChipCount` — the single shared component behind both the SSR link chips (`BrowseFilters`) and the hydrated buttons (`VarietyBrowse`), so the two paths cannot drift.
- **Rendered form (source, read in full):** visible span is now `aria-hidden` — `({n})` — and a sibling `<span className="sr-only">{n} varieties</span>` carries the accessible form. A screen reader therefore hears exactly "7 varieties" (the §2.4.2 prescribed form, e.g. "12 varieties"), generalizing the shipped StateFilter pattern (bare numeral + sr-only " sellers", read alongside for comparison). The visible rendering is unchanged from PR #41 — which is precisely the addendum's surgical definition ("(7)" visually, "7 varieties" for assistive tech). PR #41's secondary remark (parentheses depart from StateFilter's bare numeral) is **not** carried as a residual defect: the addendum ratified the parenthesized visual, and the governing instruction for this fix wins over the earlier observation.
- **No unit leakage:** `ChipCount`'s unit is hardcoded "varieties", and counts are passed **only on /variety** (`BrowseFilters` doc comment and call sites: `counts` is null on home, /crop, /search), so no surface can announce crops or sellers as "varieties". Checked in source.
- **Tests pin the SPEC form, not the old one:** `tests/dom/variety-browse.test.tsx` SSR-floor assertions pin the exact rendered string `<span aria-hidden="true">(7)</span><span class="sr-only">7 varieties</span>` (and the `(0)` / "0 varieties" pair); hydrated-chip accessible names are now `Pink {n} varieties`, `All {n} varieties`, etc. throughout. `tests/unit/browse-filters.test.ts` pins the same rendered strings for (0) and (2).
- **Evidence:** directly observed in source + the branch's own rendered-string/accessible-name test pins (maker-authored pins, **not executed by Quinn** — see the block above). Fidelity: [CODE] + [SSR/DOM by pin]. The executed rendered-output proof is part of the owed confirmation run.

### F2 — FIXED — Applied-row naming matches §2.6.1 / §2.6.2 exactly

- **Object:** `v2/lib/browse.ts`, `removersFor` (the naming's one home) + `v2/components/variety/VarietyBrowse.tsx`, `AppliedRow`.
- **Forms (source, read in full):** one generic constructor builds every group's remover from the group's legend (`BROWSE_OPTIONS[group].legend`): visible label `"{Group}: {Value}"`, accessible name `"Remove the {Group} filter, {Value}"`. All five groups go through it — Season, Sowing method, Life cycle, Hue (one remover per selected family), and Sellers (smallFarm; value label "Small farms"). `AppliedRow` renders `r.label` as the visible text and `aria-label={r.removeLabel}` in **both** the hydrated `<button>` and the SSR `<Link>`; Clear All reads **"Clear all filters"** in both paths.
- **Tests pin the SPEC forms:** unit pins — labels `["Season: …", "Hue: Pink", "Hue: Peach", "Sellers: Small farms"]` and removeLabels `["Remove the Season filter, …", "Remove the Hue filter, Pink", "Remove the Hue filter, Peach", "Remove the Sellers filter, Small farms"]`; SSR-floor pins — `aria-label="Remove the Hue filter, Pink"`, `>Hue: Pink<`, `>Clear all filters</a>`; hydrated pins — `getByRole("button", { name: "Remove the Hue filter, Pink" })`, `{ name: "Clear all filters" }`, incl. focus hand-off assertions retargeted to the new names. No pin of the old deviating names ("Remove Pink", "Clear all") survives in the two updated test files (full diff read).
- **Evidence:** directly observed in source + test pins, same fidelity caveat as F1.

### Non-vacuity — proven textually both directions; execution UNCHECKED

- **FAIL direction (inferred from source, not executed):** PR #41's head cannot produce the pinned strings — its `ChipCount` rendered `({count})` with no sr-only span, its remover `aria-label` was `` `Remove ${r.label}` `` over value-only labels, and its Clear control read "Clear all" (all three read directly in the PR #41 → PR #46 diff). The updated pins therefore fail on `fbf625e` by construction.
- **PASS direction (maker-claimed, not executed):** the workflow's verify summary in the PR body (67 files / 1145 tests, all passed) — identical counts to PR #41's branch, which is the expected shape for a fix that updates assertions without adding tests.
- Executing both directions (copy the two updated test files onto PR #41 code; run the full suite on `30f6eca`) is part of the owed confirmation run. Quinn does not present the textual proof as a substitute for it — it is recorded so the coordinator can see the fix is not vacuous on its face.

### Diff scope audit — surgical, per the addendum (executed before the block; evidence stands)

`git diff fbf625e..30f6eca`: **5 files, +85/−54 — identical to the PR body.** `BrowseFilters.tsx` (ChipCount only), `VarietyBrowse.tsx` (aria-label source + Clear label only), `lib/browse.ts` (the remover constructor + `removeLabel` field only), and the two test files (pin updates only). No behavior, structure, or other strings change; everything PR #41's gate passed is untouched in behavior. The `lib/browse.ts` change is inside the addendum's change set — it is where the applied-row naming lives, which the brief expressly allowed ("plus any file the applied-row naming lives in").

---

## Findings

### N1 — Minor (process) — PR body accounting still incomplete against the fix brief (recurrence of PR #41 F3)
- The body carries the workflow's Build accounting (verify summary; files changed 5, +85/−54 — both match Quinn's own diff counts exactly) and the Gate record template section.
- Missing, though the fix brief's Proof section requires them in the body: verify counts **branch vs PR #41 head** stated as a comparison, the proof results, the non-vacuity statement (both runs), and a quotation of the F1/F2 text being answered. Quinn derived the substance at this gate (above), so nothing is unverified — but this is the second consecutive PR whose body needed the gate to supply its accounting. The pipeline template still does not generate what the briefs require; fixing the template remains the remedy (PR #41 F3 recommendation, still open).
- Not merge-blocking on its own; recorded so the pattern is visible, per the chronic-vs-sporadic rule — this is now chronic.

### N2 — Trivial (observation) — Comment miscite in the fix
- `v2/lib/browse.ts`'s `BrowseRemover` comment attributes the accessible-name form to "§2.6.2"; the form is prescribed in §2.6.1 (§2.6.2 is Clear All). The neighboring `ChipCount` comment and the code itself are correct. Cosmetic only; fix opportunistically, never gate on it.

### Carried from PR #41, unchanged by this diff
- **F4** (failed Back/Forward leaves URL and committed state in disagreement) — untouched by this fix; accept-and-document or revisit in 3.1b, as before.
- **F5** (counts matrix cost shape, FYI) and **F6** (§2.5.3 busy indication permissive-reading FYI) — unchanged; F6 remains for the owed drive's throttled run to judge.

---

## Owed execution — exact conditions for whoever runs it (unchanged from PR #41, plus this gate's additions)

**Confirmation run (new this gate):**
1. In a fresh scratch worktree at `30f6eca`: `npm ci`, then `npm run verify` in `v2/` — must be green end to end, with `tests/dom/variety-browse.test.tsx` and `tests/unit/browse-filters.test.ts` specifically green. Report Quinn-executed counts.
2. Non-vacuity by execution: the two updated test files copied onto PR #41 head `fbf625e` code must FAIL; on `30f6eca` they must PASS.
3. Rendered-output spot proof: SSR-render `/variety` (and one filtered state, e.g. `?color_family=pink,peach&season=cool`) and record the actual chip HTML and applied-row HTML — counts with sr-only unit, remover labels/names, "Clear all filters" — from the rendered output, not the test file.

**Real-browser drive (owed since PR #41):** real built product (this branch, local server — production is unreachable from this VM's headless Chromium), 390px first, then a desktop width (~1280px):
1. **"Find pink or peach zinnias"** — multi-select Hue: tap Pink, then Peach; confirm no document load, scroll identical, focus on the tapped chip after each swap, results ≤400ms, history +1 per tap; then Back ×2 and Forward ×1 restore each state in place. *(3.1-A measurements)*
2. **"Narrow by season, then undo one thing"** — apply Season + Hue, remove one via the applied row; confirm one entry, one announcement, focus hand-off — and that the removers now read "Hue: Pink" / announce "Remove the Hue filter, Pink" in the real a11y tree.
3. **"Hit zero results and recover"** — tap a 0-count option; confirm the empty state inside the results region, row visible, Clear All ("Clear all filters") recovers in place, focus per §2.6.3.
4. **"Go Back after changing filters"** — as (1), plus one pagination click to confirm it still navigates (and fires the page-view beacon in the network log, while no in-place change fires any — **3.1-B's network proof**).
5. **3.1-F rendered proof** — keyboard-tab to the first and last chip of a strip at 390px: screenshot the full 3px focus ring unclipped; measure chevron buttons' computed size (expect 44×44 CSS px; record viewport, scroll position, zoom and devicePixelRatio with the measurement — DOM border-box CSS px is the comparison system); confirm focus-scrolling never parks a chip under a chevron.
6. **3.1-K forced failure** — block `/api/browse/varieties` (route-blocked), tap a chip: prior results/counts/URL stand, control reverts, exactly one `role="alert"` line; unblock, retry succeeds, line clears.
7. **3.1-I spot regression** — on a variety detail page, the `SellerFilterSection` Small farms toggle still behaves (in-place, popstate, focus hand-off on the filtered-empty "Show all sellers").
8. Judge clarity, feedback, focus behavior, and friction on each goal; rate usability findings on Nielsen 0–4 with frequency/impact/persistence reasoning. PR #41's desk hypotheses stand unjudged for the drive: (a) parenthesized counts may read as decoration until learned; (b) the optimistic press lands before the rows swap; (c) with no filters active, the failure line renders alone in the applied-row slot.

## Usability pass — NOT RUN (boundary stated, not skipped silently)

- **Flows taken:** none in a browser this session. The non-waivable human-interaction pass remains owed in full (conditions above). No Nielsen ratings are issued this gate; issuing them without the drive would be fabrication.
- **Evaluator structure:** single evaluator (Quinn) for the desk work in this record. Athene Coldread's independent cold rating of F1/F2 severity was commissioned in parallel by the coordinator; Quinn has **not** read it before issuing this verdict, per instructions — the coordinator reconciles any ≥2-point disagreement.
- **Boundaries:** (1) execution-risk block on running the checked-out branch code — owner: the user/coordinator's go-ahead; (2) generic-subagent browser boundary — owner: a browser-capable agent for the drive, with this record's conditions as its brief.

## Coverage ledger

- **Population:** the PR #46 delta (5 files vs PR #41 head; 23 files vs merge-base), PR #41's return conditions (F1, F2, owed drive), the fix brief + addendum's proof requirements, and the PR body.
- **Structured sample actually checked:** the full PR #41→PR #46 diff, line by line; `ChipCount`, `removersFor`, `AppliedRow`, and `BROWSE_OPTIONS` legends read in full in source; StateFilter read in full as the F1 pattern reference; both updated test files' diffs read in full (every pin); PR body checked against Quinn's own diff census; counts-only-on-/variety confirmed from `BrowseFilters` call structure.
- **Adversarial additions:** unit-leakage check (hardcoded "varieties" vs the crops/sellers surfaces); generic-constructor check (all five groups, not only the Hue example the brief quoted); both render paths checked for F2 (SSR Link and hydrated button), not only the one the tests exercise most.
- **Exclusions, with reasons:** Quinn-executed verify, executed non-vacuity, executed rendered output, and the entire real-browser drive (execution-risk block on running the branch's code + browser boundary — all named UNCHECKED above, none rounded up); live production (PR unmerged; unreachable from this VM regardless); §8 checks beyond F1/F2's neighborhood (PR #41's executed statuses stand — this diff touches none of their behavior).
- **Residual risk:** the class this coverage can still miss is exactly the class the owed execution exists to catch — a suite failure Quinn did not reproduce, a hydration-only naming divergence the pins somehow miss, and all real-browser behavior (scroll, timing, focus ring, beacon, history edge cases). The BusyForm escape is the standing example of why that class is never waved through.

## What returns / what can proceed

- **Returns to the maker:** nothing for F1/F2 — both are fixed as specified. N1 is a pipeline-template fix for Hue to schedule (second occurrence; treat as chronic). N2 is opportunistic.
- **Owed before merge:** the confirmation run + the browser drive above, then a narrow Quinn confirmation of their records. The coordinator merges only after that — **not on this record**.
- **Can proceed:** nothing in this PR is blocked by N1/N2 once the owed execution lands clean.
