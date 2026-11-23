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

---

# CONFIRMATION RUN — appended 2026-11-22, Quinn (second session, per the return conditions above)

**Authorization:** Dustin's standing ruling (2026-11-22) — fresh Quinn gate agent per attempt until a session gets through; Quinn's standing approval covers checking out the build branch in a fresh scratch worktree and running the project's own install/verify commands. Executed in `seeds-hues-quinn-pr46-wt` at `30f6eca` (the prior session's worktree, verified at head, working tree clean).

## Verdict: FAIL — narrow, and not on PR #46's delta

**All three owed confirmation items now stand confirmed by Quinn's own execution, and F1/F2 are closed.** The owed real-browser drive ran in full — and it surfaces **one new defect, N-D1 (pagination), in PR #41's 3.1a core**, which PR #46's diff does not touch. The drive was an explicit PASS condition for this stack ("one pagination click to confirm it still navigates" — in effect, it does not), so the stack cannot merge on this record. **Do not merge.** Return conditions are narrow and listed at the end; F1/F2 need no further work.

Axes kept separate, per the standing rule: **Severity** — N-D1 Major (defect scale) / Nielsen 3. **Evidence** — directly observed and measured in a real browser, three independent reproductions (below). **Coverage** — complete for the owed items except 3.1-I, UNCHECKED for a named fixture reason (below), never rounded up. **Verdict** — FAIL on the stack's drive condition; PASS on every confirmation item this run owed.

---

## Confirmation item 1 — Quinn-executed `npm run verify`: PASS, exact match

- `npm ci` (699 packages), then `npm run verify` in `v2/` on `30f6eca`: **exit 0** — ESLint, `tsc --noEmit`, and Vitest all green end to end.
- Quinn-executed counts: **67 test files passed (67), 1145 tests passed (1145)** — **identical to the workflow's accounting in the PR body. No delta.**

## Confirmation item 2 — Non-vacuity by execution: PASS, both directions

- **FAIL direction:** the branch's two updated test files (`tests/dom/variety-browse.test.tsx`, `tests/unit/browse-filters.test.ts`) copied onto PR #41 head `fbf625e` source: **17 failed / 32 passed (49), both files failed, exit 1.** The pins bite on the old code, as required. (The PR #41 worktree was restored to a clean tree afterwards.)
- **PASS direction:** the same two files on `30f6eca`: **49 passed (49), exit 0** — and green again inside the full verify run above.

## Confirmation item 3 — Rendered-output spot proof (SSR, from the built branch): PASS

Served the branch's own production build locally (`npm run cf:build` + `wrangler dev` preview on :8787, local D1 seeded via the project's `db:setup:local`). Actual server-rendered HTML, not test files:

- **F1 chip (unfiltered `/variety` SSR):** `Pink <span class="text-muted tabular-nums"><span aria-hidden="true">(98)</span><span class="sr-only">98 varieties</span></span>` — visible "(98)" aria-hidden, sr-only "98 varieties", in the rendered output.
- **F2 applied row (SSR of `/variety?color_family=pink,peach&season=cool`):** `<a aria-label="Remove the Season filter, Cool Season Hardy Annuals" … href="/variety?color_family=pink%2Cpeach">Season: Cool Season Hardy Annuals</a>`, `<a aria-label="Remove the Hue filter, Pink" …>Hue: Pink</a>`, `<a aria-label="Remove the Hue filter, Peach" …>Hue: Peach</a>`, and `>Clear all filters<` — each remover's href removes exactly its own filter. The §2.6.1/§2.6.2 forms are the shipped forms in both render paths.

---

## The real-browser drive — executed (local production build; 390px first, then desktop)

**Method and environment, disclosed:** Playwright driving Chromium (headless shell) against the locally built Worker — the real built product, per the owed conditions (production is unreachable from this VM). Two environment artifacts, neither an app defect: (1) console `ERR_TUNNEL_CONNECTION_FAILED` errors throughout — the external image CDN is unreachable through this VM's proxy; same-origin behavior was unaffected. (2) The shell build's `isMobile: true` emulation corrupts layout metrics after hydration (innerHeight read 3376 on a 844px viewport); the final full drive ran under the corrected context (390×844 CSS px, devicePixelRatio 2, touch + iPhone UA, isMobile off — metrics verified sane: innerHeight 844, fixed nav 390 wide at y 779). Behavioral results (URLs, history, announcements, focus, network) were consistent across both contexts; **all geometry measurements below come from the corrected run.**

### Goal 1 — "Find pink or peach varieties" (3.1-A measurements): PASS
- Tap Pink: commit (URL gains `color_family=pink`) in **250ms** on the final run; tap Peach: **254ms** (`color_family=pink,peach`). Across four runs the tap→commit range was 184–443ms including Playwright's own tap overhead (~50–180ms of it) on a shared 1.5-CPU VM — the ≤400ms bound is met on the clean runs; the variance is disclosed, not hidden.
- Per tap: **no document load** (window marker survived), **scroll position identical**, **history +1**, **focus remained on the tapped chip** after the swap, **exactly one request** (`/api/browse/varieties`, 200) and **zero `/api/track`**. Announcements: "98 varieties · Pink, alphabetical. Page 1 of 5." → "160 varieties · Pink · Peach, alphabetical. Page 1 of 7." (98+62=160 ✓).
- Back ×2 restored pink-only, then unfiltered, **in place** (marker alive, pressed states correct at each step); Forward ×1 restored pink. (The failed-Back/Forward disagreement of PR #41's F4 was **not** reproduced on the success path; F4's failure-path case was not re-exercised and stays as carried.)

### Goal 2 — "Narrow by season, then undo one thing" (F2 in the real a11y tree): PASS
- With Season=Cool + Hue=Pink applied, the accessibility tree names are exactly: **"Remove the Season filter, Cool Season Hardy Annuals"**, **"Remove the Hue filter, Pink"**, **"Clear all filters"**; visible labels "Season: Cool Season Hardy Annuals" / "Hue: Pink". F2's forms hold in the live tree, not only in pins.
- Tapping "Remove the Hue filter, Pink": **one history entry**, URL drops only `color_family`, announcement updates ("335 varieties · Cool Season Hardy Annuals…"), and **focus hands off to "Clear all filters"** while the row persists with the Season remover — §2.6.3 behavior as specified.

### Goal 3 — "Hit zero results and recover": PASS
- Path: Season=Cool + Life cycle=Biennial (6 varieties) → the Hue strip's Blue chip genuinely reads **"Blue (0)0 varieties"** → tapped it. Results region: **0 card links** and a dedicated empty state inside the region — **"No varieties match. Clear filters."** — announcement "0 varieties · Cool Season Hardy Annuals · Biennial · Blue, alphabetical.", applied row still visible.
- "Clear all filters" recovers **in place** to 778 varieties; **focus lands on the first "All" chip**, per §2.6.3.

### Goal 4 — "Go Back after changing filters" + pagination (3.1-B network proof): FAIL — see N-D1
- The in-place half of 3.1-B is **proven**: across Goals 1–3, in-place changes fired only `/api/browse/varieties` — no page-view beacon, no document request. A variety detail page load fired **exactly one** `POST /api/track` (the view beacon). The beacon discipline is correct.
- The pagination half **fails**: N-D1 below.

### 3.1-F — rendered focus ring + chevrons: PASS
- Coordinate space for all measurements: **DOM border-box, CSS pixels**; viewport 390×844, scrollY 0, zoom 1, devicePixelRatio 2.
- Keyboard Tab landed on the first chip ("All"): computed outline **`solid 3px rgb(122, 62, 16)`**; screenshot inspected — the full ring renders **unclipped on all four sides**. Last Hue chip ("Mixed", focused): rect **x 263.9 → 374.3 of 390**, y 523.8, 110.4×44 — fully inside the strip's visible width, **not parked under a chevron** (the strip's `scroll-padding-inline: 3rem` does its job); its ring screenshot likewise complete.
- Chevrons at 390px measure **0×0 — by design, not defect**: `FilterStrip`'s `.filter-strip-btn` is shown only on hover-capable fine pointers (the component's own doc comment; edge fades are the touch affordance). Measured where the control exists — **desktop 1280px: both Hue chevrons 44×44 CSS px**, display flex, left disabled at strip start, and clicking "Scroll Hue right" scrolled the strip 0 → 526px. The 44×44 expectation (the spec's target, Apple HIG class) is met on the surface that ships the control.

### 3.1-K — forced failure (route-blocked `/api/browse/varieties`): PASS
- With the route aborted, tapping Yellow: **exactly one** `role="alert"` — **"Couldn't update the list — the last results are still shown."** — the Yellow press **reverted** (aria-pressed false), first card, announcement, and URL all **unchanged**. Unblocked, the retry committed (49 varieties · Yellow), the alert **cleared**, press stood. Every clause of the condition met.

### 3.1-I — SellerFilterSection spot regression: UNCHECKED (fixture limit, named)
- The local catalog fixture cannot construct the precondition: across all 778 varieties, sellerCount is **0 for 761 and 1 for 17 — no multi-seller variety exists locally**, and the section's Small farms toggle renders only when a variety has sellers to filter (four detail pages inspected: no toggle, one seller link each). Exercising it would require fabricating catalog data, which this gate does not do.
- Remainder owner: the re-drive after N-D1's fix, against production data post-merge (acceptable for this spot regression — the section is PR #38 code, untouched by PRs #41 and #46) or against a seeded multi-seller fixture if the maker provides one.

### Desktop spot pass (1280px): PASS
- Goal 1 repeated: in-place commit, focus on the tapped chip, remover "Hue: Pink" / "Remove the Hue filter, Pink", "Clear all filters" present, announcement correct. No desktop-only divergence in the touched flows.

### PR #41 desk hypotheses, now judged
- (a) Parenthesized counts as decoration → subsumed into observation O1 below.
- (b) The optimistic press lands before the rows swap → **confirmed as the specified design** (press within ~50–180ms, commit at ~200–400ms); not a finding.
- (c) With no filters active, the failure line renders alone in the applied-row slot → observed in 3.1-K; the single line is plain and correctly worded; **severity 0 — not a problem.**

---

## NEW DEFECT N-D1 — Major (defect scale) / Nielsen 3 — Pagination changes the URL but not the results

- **Object:** `/variety` pagination ("Next →" and numbered "Page N" links), hydrated app, on the locally built `30f6eca`. **Origin: PR #41's 3.1a browse controller — PR #46's 5-file delta does not touch pagination, routing, or state reconciliation.** This is a stack defect surfaced by the owed drive, recorded here because this gate is where the drive was owed.
- **Steps to reproduce:** (1) Load `/variety` and let it hydrate. (2) Tap **Next →** (or the **Page 2** link). (3) Wait — 6 seconds in the recorded run.
- **Expected:** the results, announcement, and cards render page 2 ("Page 2 of 33", first card `/variety/apple-of-peru` — which a hard load of the same URL does render, verified).
- **Actual:** the URL becomes `/variety?page=2` and the RSC fetch for it returns **200**, but the rendered page never changes: announcement still "778 varieties, alphabetical. **Page 1 of 33**.", first card still page 1's, scroll and content untouched. Reproduced **three times** (the drive's Goal 4 and two independent probes, Next and numbered link). After the stuck state, tapping a filter chip recovers cleanly in place — the shopper is not stranded, but paging itself silently does nothing.
- **Why it rates Major / Nielsen 3:** *Frequency* — every shopper who pages (33 pages of 24; filters are the promoted path, which tempers but does not remove it). *Impact* — the failure is **silent**: the announcement agrees with the stale content, so the shopper has no signal that paging failed; only the first 24 of 778 varieties are reachable through the paging controls. *Persistence* — every attempt, until a reload. Workarounds exist (reload, filters, search), so it is not a Blocker — but a core control that does nothing while appearing to work is a Nielsen 3, and Nielsen 3 blocks a clean PASS under the house gating rule.
- **Root-cause grouping:** same family as carried **F4** (URL ↔ committed-state disagreement in the browse controller's relationship with router state) — F4 was the Back/Forward sibling; N-D1 is the forward-navigation case. Two symptoms, one suspect area: density predicts density, and the fix pass should examine the controller's URL↔state reconciliation as a whole, not only the pagination symptom.
- **Evidence fidelity:** [BROWSER] — real Chromium, real built Worker, real local D1 data; `framenavigated` + full request/response log recorded. The maker's DOM suite passes a test named for pagination non-interception, but it does not exercise a real router navigation — the same fidelity gap as the BusyForm escape: handler-level green, browser-level broken. **No second rating exists for N-D1** (Athene's cold rating covered PR #41's F1/F2 severities only); this rating is single-evaluator (Quinn), with the mechanical repro above as its evidence.

## F6 — now judged on the throttled run (was PR #41 FYI): Nielsen 2, note

- Deterministic slow run (the browse fetch route-delayed 2.5s): mid-flight, there is **no `aria-busy`, no progressbar, no spinner** anywhere — the only in-flight signal is the tapped chip's optimistic press, while the announcement still states the old total. The commit lands correctly when the response arrives.
- Nielsen 2 (minor): on a slow connection the shopper gets a multi-second gap in which the pressed chip and the stated results disagree, with nothing saying an update is coming. Frequency: slow connections only; impact: low-moderate confusion, self-corrects; persistence: per slow commit. **A note, not a return condition** — PR #41 scope (§2.5.3's permissive reading), unchanged by PR #46. Recommended to ride with N-D1's fix pass, since both live in the same controller.

## Observation O1 — Per-option counts are toggle-preview counts (spec question, not a defect of this PR)

- Beside a **selected** hue, the count is the size of the set if that hue were toggled: with Pink selected and 98 results listed, the Pink chip reads "(778)" / "778 varieties" (toggling Pink off returns all 778); with Pink+Peach selected, Peach reads "(98)" (removing Peach leaves Pink's 98). The semantics are consistent, and the announcement always states the true current total — but a first-time shopper, sighted or on assistive tech, can reasonably read "Pink — 778 varieties" as the number of pink varieties while 98 are listed.
- This is the pre-existing §2.4.2 counts-matrix design from PR #41 (cf. carried F5), **not** PR #46's delta — F1 only gave the existing counts their sr-only unit, exactly as specified. Recorded as an observation for Hue/Dustin to rule on as a spec-interpretation question; **not a return condition for this PR.** Nielsen 2, single-evaluator.

---

## Usability pass summary (this run)

- **Flows taken:** the four shopper goals at 390px (multi-select hue with Back/Forward; season + applied-row removal; zero-results + recovery; pagination + detail-page beacon), 3.1-F keyboard/measurement pass, 3.1-K forced failure, desktop spot pass at 1280px, throttled/delayed-fetch run for F6. Stop point: 3.1-I only, for the fixture reason named above.
- **Findings by Nielsen severity:** 3 — one (N-D1). 2 — two (F6 judged; O1 observation). 1/0 — none further; hypotheses (b) and (c) closed as non-findings.
- **Evaluator structure:** single evaluator (Quinn) for the drive and for N-D1/F6/O1 ratings. The F1/F2 severity second-rating (Athene Coldread) stands as previously commissioned; the coordinator reconciles.
- **Boundaries:** local build only (production unmerged and unreachable from this VM); Chromium engine only — no WebKit/Safari pass exists in this evidence base; no run on Dustin's own devices (access limit; his post-merge eyeball remains the final rendered proof per house practice).

## Coverage ledger (this run)

- **Population:** the prior record's three confirmation items, the seven owed drive conditions, PR #41's carried F4/F5/F6, and the three desk hypotheses.
- **Structured sample actually checked:** all of it, executed — verify (full suite), non-vacuity (both directions, the two changed test files), SSR rendered output (two states), drive goals 1–4, 3.1-F, 3.1-K, desktop spot, delayed-fetch F6 run — **except 3.1-I** (excluded below).
- **Adversarial additions:** numbered-link variant of the pagination defect; chip-tap recovery after the stuck pagination state; deterministic 2.5s route delay (after a network-throttle attempt proved too weak to hold the fetch in flight); chevron measurement on the desktop surface where the control exists; full network logging on every goal.
- **Exclusions, with reasons:** 3.1-I — the local catalog contains no multi-seller variety (sellerCount max 1 across 778), so the toggle's precondition cannot exist without fabricated data. Live production — unmerged; also unreachable from this VM. WebKit — no engine available in this environment.
- **Residual risk:** the class this coverage can still miss is real-device Safari behavior and every multi-seller surface; both are named, owned above, and neither is rounded into coverage.

## Return conditions (narrow) / what can proceed

- **Returns to the maker (3.1a stack, not the PR #46 fix):** N-D1 — pagination under soft navigation must render the target page, or pagination must become true document navigation; the maker's choice. Quinn then re-drives **Goal 4 only** (Next + one numbered link + Back) plus a chip-after-paging regression check.
- **Also owed at that re-drive:** 3.1-I, against production data post-merge or a maker-provided multi-seller fixture.
- **Closed by this record:** confirmation items 1–3; drive goals 1, 2, 3; 3.1-B's in-place/beacon half; 3.1-F; 3.1-K; F6 (judged, Nielsen 2 note); desk hypotheses (a)–(c). **F1 and F2 are confirmed fixed by execution and need no further work.** N1/N2 from the prior record stand as before.
- **Merge:** not on this record. The coordinator merges only after the N-D1 re-drive passes.
