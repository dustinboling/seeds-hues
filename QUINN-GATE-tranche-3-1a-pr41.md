# Quinn Gate — Tranche 3.1a, PR #41 (in-place filter core on /variety + FilterStrip A3 finish)

**PR:** https://github.com/dustinboling/seeds-hues/pull/41 · branch `muse/45077555769` · head `fbf625e`
**Merge-base:** `f5220a5` · **Brief:** `muse-tasks/tranche-3-1a-inplace-core.md` (on main) · **Spec:** Tranche 3 SPEC §2, §7, §8
**Gate run:** 2026-11-22, from fresh scratch worktrees (`seeds-hues-quinn-pr41-wt` at PR head, `seeds-hues-quinn-pr41-base-wt` at merge-base), `npm ci` + `npm run verify` executed by Quinn in both. Diff read line by line.

## Verdict: PARTIAL GATE — NOT A PASS (maps to FAIL in the pass/notes/fail vocabulary)

The executed ground is strong: the suite is green on both sides, counts reconcile against the real catalog, non-vacuity holds both directions, and scope is proven. The gate still cannot pass, for two independent reasons:

1. **Two Major spec-conformance findings (F1, F2)** in the build's own normative contract (§2.4.2 count rendering, §2.6.1/§2.6.2 applied-row naming). Both are small, single-component fixes.
2. **The real-browser drive did not run.** This gate session has no browser. Per the standing rule, suite green + browser unrun = unchecked, never rounded up: 3.1-A's scroll/timing measurements, 3.1-F's rendered focus-ring proof, 3.1-B's network log, and the usability pass are **owed**, with exact conditions listed under "Owed browser pass" below.

**Return conditions:** maker fixes F1 + F2 (or Hue records written acceptance of each); a browser-capable pass executes the owed drive; re-gate is then a narrow confirmation (verify re-run, F1/F2 render check, drive record review). F3 should be fixed in the pipeline template so the next PR body carries the full accounting natively.

---

## Findings (severity / evidence / coverage / verdict kept on separate axes)

### F1 — Major — Per-option counts render without the screen-reader unit §2.4.2 prescribes
- **Object:** `v2/components/ui/BrowseFilters.tsx`, `ChipCount` (used by both the SSR links and the hydrated buttons in `VarietyBrowse.tsx`).
- **Standard:** SPEC §2.4.2 — "The count follows the option label inside the chip: muted numeral, then a screen-reader-only unit ('12 varieties' …) — the StateFilter's shipped pattern, generalized." Ada's prescribed patterns are binding minimums in this spec.
- **Actual:** `ChipCount` renders `({count})` — a parenthesized numeral and **no sr-only unit**. The shipped pattern it must generalize (`v2/components/seller/StateFilter.tsx`) renders a bare muted numeral plus `<span className="sr-only"> sellers</span>`.
- **Impact:** a screen-reader user hears "Pink (12)" with nothing saying 12 *what*; the unit exists in the pattern precisely so the number is not left to inference. Affects every chip on /variety, first paint and hydrated. The parentheses also depart from the pattern's bare numeral (secondary, visual).
- **Evidence:** directly observed in code and pinned by the build's own tests (`expect(h).toContain("(7)")`; chip accessible names like `Pink (7)` in `tests/dom/variety-browse.test.tsx`).

### F2 — Major — Applied-row remover names and Clear All label do not carry the §2.6 prescribed forms
- **Object:** `v2/components/variety/VarietyBrowse.tsx`, `AppliedRow`.
- **Standard:** SPEC §2.6.1 — remover labeled `"{Group}: {Value}"` ("Hue: Pink"), accessible name starting with "Remove" and naming group and value ("Remove the Hue filter, Pink"); gate check 3.1-D's pass condition is removers with **"Remove the …"** names. SPEC §2.6.2 — the Clear All control's label is **"Clear all filters"**.
- **Actual:** visible remover label is the value only ("Pink"); `aria-label` is "Remove Pink" (no group named); the Clear All control reads **"Clear all"**.
- **Impact:** no functional ambiguity today (value vocabularies are disjoint across groups, and the row sits under the strips), which is why this is Major and not Critical — but the gate check as written cannot pass, and the group name is what a screen-reader user needs when a value could belong to two groups. The build's DOM tests pin the implemented names, so the tests encode the deviation rather than catching it.
- **Evidence:** directly observed in code + the build's tests (`getByRole("button", { name: "Remove Pink" })`, `{ name: "Clear all" }`).

### F3 — Minor (process) — PR body accounting is accurate but incomplete against the build brief
- The workflow-generated **Build accounting** section is present and **its numbers match Quinn's executed counts exactly** (verify 67 files / 1145 tests; diff census 23 files, +2538/−361 — both reproduced independently). The **Gate record** template section is present.
- Missing, though the brief requires them in the PR body: merge-base verify counts (Quinn executed: **63 files / 1075 tests**), the §8 proof results, the T-C payload field list, and the non-vacuity statement. Quinn derived all four at the gate (below), so nothing is unverified — but the pipeline-hygiene fix (main `7bc5f87`) was meant to make bodies carry this natively; the template appears to generate only the verify summary + census. Recommend the template gain the four missing blocks before the next pipeline PR.

### F4 — Minor (observation) — Failed Back/Forward leaves URL and state in disagreement
- On a popstate whose fetch fails, results/counts/chips stand on the committed state (correct per §2.5.6) while the URL already shows the popped state — the browser owns that entry, so "the URL stands" is unachievable on this path. A reload then server-renders the URL's state, not the state the shopper last saw standing. The build's DOM test covers the alert + stand behavior but not the divergence. Options are accept-and-document or revisit in 3.1b; pushing state back would corrupt history and is not recommended.

### F5 — FYI — Counts matrix cost shape
- Each browse payload runs 26 count queries (bounded by the fixed option vocabulary: 3+3+4+14+2) via `Promise.all`, plus the results query — a constant, not row-driven; **no N+1**. Noted only because D1 serializes queries per database; at this catalog size it is immaterial.

### F6 — FYI, for the owed drive to judge — §2.5.3's >1s busy indication is not implemented
- No `aria-busy` exists in `VarietyBrowse` (grep: 0). §2.5.3's wording is permissive ("a quiet busy indication … is the only permitted addition — never a skeleton swap"), and local payload fetches are sub-second, so this is not raised as a defect. If Hue reads §2.5.3 as mandatory, it becomes a Minor finding; the throttled run in the owed drive is where it would bite.

---

## Executed counts (Quinn's own runs — the only numbers this verdict rests on)

| Run | Command | Result |
|---|---|---|
| Branch `fbf625e` | `npm ci` + `npm run verify` (lint + typecheck + vitest) | **exit 0 — 67 test files, 1145 tests, all passed** |
| Merge-base `f5220a5` | `npm ci` + `npm run verify` | **exit 0 — 63 test files, 1075 tests, all passed** |
| Delta | — | **+4 files / +70 tests**, exactly the four new test files (`tests/contract/browse.test.ts`, `tests/dom/variety-browse.test.tsx`, `tests/integration/browse-counts.test.ts`, `tests/unit/browse-filters.test.ts`). Explained by the build's scope. |
| Non-vacuity (T-A) | the 4 new files copied onto merge-base code, `vitest run` | **exit 1 — all 4 files FAIL on pre-build code** (missing `lib/browse`, `VarietyBrowse`, browse route — the features do not exist there); all PASS on the branch. Both directions proven. |

PR-body spot-check (owed since `7bc5f87`): Build accounting section present; Gate record template present; **numbers match Quinn's executed counts exactly**; completeness gap = F3.

## Scope proof (gate item 2)

Diff census (Quinn's `git diff --stat` merge-base..head): **23 files, +2538/−361 — identical to the PR body.** Every file sits inside the brief: `/variety` page + new `VarietyBrowse`, shared `BrowseFilters`/`FilterStrip`, new `lib/browse.ts` model, payload route + service + repository count query, validators vocabulary move (verbatim re-export — identity pinned by test), and tests.

Out-of-scope surfaces were probed, not assumed:
- `app/page.tsx`, `app/crop/page.tsx`, `app/search/page.tsx` change only imports and the hue state shape (`null` → `[]`); `/search` keeps single-select via `parseHueParamSingle`, whose rule is pinned character-for-character in the updated `paging.test.ts` ("first raw value must be exactly one family; comma list = All").
- **Rendered probe (T-B):** Quinn rendered `BrowseFilters` as home, /crop, and /search configure it, on both trees, and diffed the markup: **byte-identical hrefs, labels, `aria-current` placement, and swatches; the only difference on all three surfaces is the FilterStrip list class** (`px-1 py-1 -mx-1` → `px-1.5 py-1.5 -mx-1.5 [scroll-padding-inline:3rem]`) — exactly register item **B-4**, the one registered cross-surface change.
- `/crop/[slug]`, `/seller`, `globals.css`: untouched files. **No sort control** anywhere in the diff (resting order stays Name A–Z; the count line still reads "alphabetical"). **`SellerFilterSection.tsx` untouched** (not in the diff).

## §8 checks, scoped to this build — status per check

Fidelity labels per the playbook: **[D1]** real seed catalog via Miniflare D1 · **[DOM]** jsdom component drive (real component, real History API in jsdom, stubbed fetch) · **[SSR]** static-markup render · **[CODE]** code read · **[OWED]** real-browser only.

- **3.1-A (in-place drive): PARTIAL.** [DOM] Proven: optimistic press in the same render, one fetch per change, exactly one `pushState` per committed change (URL = committed state), re-tap of the active option is a no-op (no fetch/entry), chip node identity stable across commits (no remounts), focus stays on the tapped chip, Back/Forward re-sync in place with no new entry, a pop across a page boundary leaves via true navigation, page resets to 1. [OWED] scroll-position identity, ≤400 ms swap timing, real history-stack behavior in a real browser.
- **3.1-B (no beacon): PARTIAL.** [CODE] The layer performs no router navigation and no beacon/track call; pagination remains real anchor navigation (a document load — the only path that fires the page-view beacon). [OWED] network-log confirmation in the drive.
- **3.1-C (counts reconcile): PASS.** [D1] The integration suite reconciles **every cell of the 26-cell matrix** (every option + every "All", all five groups) against fresh independent `countVarietyRows` totals on the real seed catalog; a 0-count option is *derived at test time* (never hardcoded) and reconciles at 0; hue toggle semantics verified in both directions (selected hue counts the set without it, unselected counts the set with it, "All" = other groups alone); a two-group final state reconciles wholesale (the rapid-change case, with [DOM] stale-response discard proven separately). [SSR/DOM] chips display the payload's numbers, 0 included, and 0-count chips stay operable links/buttons.
- **3.1-D (applied row + Clear All): PASS with F2.** [DOM] One remover per selected hue; removing one drops exactly that group in one entry; Clear All = one action, one entry, one count-line mutation (MutationObserver count = 1); focus hands to Clear All while the row persists, else to the first "All" chip. [SSR] removers/Clear All are working links landing on the exact URLs (href assertions incl. comma-encoded hue sets, no double-encoding). Naming deviations = **F2**.
- **3.1-E (zero results): PASS at [DOM] fidelity.** Empty state renders inside `#variety-results`, applied row stays visible, "Clear filters" recovers the full set in place, focus lands on the first "All" chip. SSR floor renders the same state with a working Clear link.
- **3.1-F (A3 rendered proof): NOT EXECUTED as rendered proof.** [CODE] values are exactly Ada's: list padding `px-1.5 py-1.5` (6px ≥ the 5px a 3px outline + 2px offset needs), `scroll-padding-inline: 3rem`, chevrons `h-11 w-11` (44px). The spec demands a rendered screenshot + computed measurement at 390px — [OWED].
- **3.1-G (announcement): PASS at [DOM] fidelity.** `#variety-results-count` is present in SSR before any change (same id/classes/attributes/wording as pre-build — verified against base source), the node is never remounted across commits (`toBe` identity), and its text changes exactly once per committed change. [OWED] screen-reader/a11y-tree confirmation in the drive.
- **3.1-H (no-JS floor): PASS at [SSR] fidelity.** Static markup: links only (zero `<button>`), `aria-current` on the selected chips, counts incl. 0, applied row as links, zero-results state with Clear link; the page and the API share `readBrowseFilters`, so a filtered URL cannot render an unfiltered list. [OWED] JS-disabled browser drive for end-to-end certainty.
- **3.1-I (SellerFilterSection regression): PASS as regression-by-suite.** File byte-untouched; its existing gate tests passed inside both verify runs. [OWED] the exemplar's browser behaviors (popstate, focus hand-off) in the owed drive.
- **3.1-K (failure path): PASS at [DOM] fidelity.** Rejected fetch *and* malformed-200 both take the path: prior results/counts/URL stand, pressed state reverts, exactly one `role="alert"` line with the applied row, a successful retry clears it. Error copy ("Couldn't update the list — the last results are still shown.") differs from §2.5.6's example line, which the spec explicitly leaves to Wren's confirmation — not a finding. [OWED] forced-failure via route-blocking in a real browser.

**T-A:** suite green + non-vacuity both directions — executed, above. **T-B:** rendered differences are exactly B-1/B-2/B-13 on /variety + B-4 everywhere strips render; probe evidence above; no B-5/B-11/B-12 leakage (home/crop count lines and groups unchanged — home and /crop markup identical apart from B-4; /search gained no Life cycle group). **T-C:** payload fields enumerated by Quinn from the executed contract — top level exactly `{items, total, page, pages, counts}`; counts = `season{all, options{cool, warm}}`, `method{all, options{direct, trays}}`, `lifeCycle{all, options{annual, biennial, perennial}}`, `hue{all, options{white, blush, pink, peach, orange, yellow, red, burgundy, purple, blue, green, chocolate, mix}}`, `smallFarm{all, on}` — all non-negative integers; items are `VarietyListItem` (slug, varietyName, plant ref, category/subcategory/series refs, colorSwatch, colorFamily, listingCount, sellerCount, inStockCount, lastCheckedAt, indexable, rating, media). **No price field exists in the schema, the service, or the served bytes** (contract test regex-scans the serialized payload; Quinn's own grep of the production diff found no price).

## Usability pass — NOT RUN (browser boundary), desk preparation done

This session cannot operate a browser, so the non-waivable human-interaction pass is **owed**, not faked. Desk work done instead (heuristic preparation, single-evaluator): the flows are well-formed on the evidence above — applied filters stay visible and removable (user control), counts preview every tap (recognition over recall), the zero state offers its own recovery (error recovery), the failure line is plain-language and preserves the prior state. Hypotheses the drive should judge, not findings: (a) parenthesized counts may read as decoration until learned; (b) the optimistic press lands before the rows swap — a shopper may momentarily read the new press against old rows; (c) with no filters active, the failure line renders alone in the applied-row slot, a placement that may surprise.

### Owed browser pass — exact conditions for the browser-capable agent Hue dispatches
Real built product (this branch), 390px first, then a desktop width (~1280px):
1. **"Find pink or peach zinnias"** — multi-select Hue: tap Pink, then Peach; confirm no document load, scroll identical, focus on the tapped chip after each swap, results ≤400ms, history +1 per tap; then Back ×2 and Forward ×1 restore each state in place.
2. **"Narrow by season, then undo one thing"** — apply Season + Hue, remove one via the applied row; confirm one entry, one announcement, focus hand-off.
3. **"Hit zero results and recover"** — tap a 0-count option; confirm the empty state inside the results region, row visible, Clear All recovers in place, focus per §2.6.3.
4. **"Go Back after changing filters"** — as (1), plus one pagination click to confirm it still navigates (and fires the page-view beacon in the network log, while no in-place change fires any — 3.1-B's log proof).
5. **3.1-F rendered proof** — keyboard-tab to the first and last chip of a strip at 390px: screenshot the full 3px focus ring unclipped; measure chevron buttons' computed size (expect 44×44 CSS px; record viewport, scroll, devicePixelRatio with the measurement); confirm focus-scrolling never parks a chip under a chevron.
6. **3.1-K forced failure** — block `/api/browse/varieties` in the drive, tap a chip: prior results/counts/URL stand, control reverts, exactly one `role="alert"` line; unblock, retry succeeds, line clears.
7. **3.1-I spot regression** — on a variety detail page, the Small farms toggle still behaves (in-place, popstate, focus hand-off on the filtered-empty "Show all sellers").
8. Judge clarity, feedback, focus behavior, and friction on each goal; rate usability findings on Nielsen 0–4 with frequency/impact/persistence reasoning.

## Coverage ledger

- **Population:** the PR diff (23 files), the §8 checks scoped to 3.1a (A–I, K), T-A/T-B/T-C, the four out-of-scope browse surfaces plus /crop/[slug], /seller, variety detail, and the PR body.
- **Structured sample actually checked:** full verify on both trees; all four new test files read as code and executed in both directions; every production file in the diff read in full; rendered-markup diff of /, /crop, /search; payload enumerated from schema + executed contract tests against the real seed catalog (D1); SellerFilterSection and FilterStrip diffs inspected directly.
- **Adversarial additions:** malformed-payload and failed-popstate paths (in the build's tests, re-run by Quinn); 0-count option derived from data rather than chosen; stale-response race in the DOM suite.
- **Exclusions, with reasons:** the real-browser drive and all rendered/visual proof (no browser in this session — owed, conditions above); live production (the PR is unmerged; nothing to probe); 3.1-J (model parity census belongs to 3.1b's spread, out of this build's scope); a production `next build` (the pipeline's gate is `npm run verify`, which Quinn ran as specified).
- **Evaluator structure:** single evaluator (Quinn). **Athene Coldread's cold second rating was not obtained** — this session cannot commission her; per the evaluator-effect rule, severity ratings here are single-evaluator ratings. Hue: commission Athene on F1/F2 if a second rating is wanted before ruling on them.
- **Residual risk:** the class this coverage can still miss is real-browser-only behavior — scroll preservation under real layout, real History-API edge cases, focus-ring clipping, swap timing, beacon network behavior, and hydration mismatches — precisely the class the owed drive exists to catch (the BusyForm escape is the standing example of a defect only a real browser submission exposed).

## What returns to the maker / what can proceed

- **Returns to the maker:** F1 (sr-only unit in `ChipCount`, both render paths), F2 (remover label/name forms + "Clear all filters" label). Both are confined to shared components; the build's tests pin the current wording and must be updated with the fix.
- **Owed before merge:** the browser pass above (3.1-A measurements, 3.1-B log, 3.1-F rendered proof, usability goals), then a narrow Quinn confirmation.
- **Can proceed:** nothing in this PR depends on F3; F3 is a pipeline-template fix for Hue to schedule independently.
- **Not blocking, recorded:** F4 (document or revisit in 3.1b), F5, F6.

---

# RE-GATE — 2026-11-22 (Quinn, second session)

**Object re-gated:** PR #41, branch `muse/45077555769`, head `fbf625e6328e74fcb629b10eadd56290ea26f0d5` (verified live via the GitHub API at re-gate time; PR state OPEN). **Fix brief:** `muse-tasks/tranche-3-1a-fix.md` (F1 + F2 only). **Method:** fresh scratch worktrees (`seeds-hues-quinn-regate-pr41-wt` at PR head, `seeds-hues-quinn-regate-base-wt` at merge-base `f5220a5`), `npm ci` + `npm run verify` executed by Quinn in both; component code read at the PR head; a server-rendered markup probe of the actual `BrowseFilters` component executed against the branch tree; PR body read live via `gh`.

## RE-GATE Verdict: FAIL

**F1 and F2 persist, in identical form, because the branch under re-gate is the identical commit the first gate failed.** The head SHA is unchanged (`fbf625e…`, single commit, parent `f5220a5` = the first gate's merge-base; current `origin/main` has since advanced past it via PRs #42–#44, none of which touches the F1/F2 components). The fix dispatch recorded in the program record (run `45084698950` on the F1/F2 successor brief, main `d6b88f1`) shows conclusion **"cancelled"** in the GitHub API, and no successor branch or PR from it exists (remote branches and the PR list through #44 checked at re-gate). There was therefore nothing new on this branch to confirm — the re-gate re-executed the full confirmation anyway, per the brief, and every check below is this session's own work on the current branch content.

Independently of the code findings, **the owed real-browser usability drive STILL did not run** — this re-gate session is a generic subagent session with no live-browser capability, the same boundary as the first gate. Per the standing rule the drive remains **UNCHECKED, never rounded up**, and it remains a condition of any future PASS. The FAIL below rests on F1/F2 alone; the drive's status is recorded so the verdict is not misread as the only blocker.

### R1 — F1 confirmation: NOT FIXED (Major, reopened — never closed)

- **Code (directly observed at head):** `v2/components/ui/BrowseFilters.tsx:31-33` — `ChipCount` still renders `({countFor(...)})` inside a `text-muted tabular-nums` span: a parenthesized numeral, **no sr-only unit**. The component takes no unit prop at all. It is consumed by both render paths exactly as at the first gate: the SSR links (`BrowseFilters.tsx:84`) and the hydrated buttons (`v2/components/variety/VarietyBrowse.tsx:362`). The component's own doc comment still describes the deviation as the design ("every chip carries its per-option count in parentheses").
- **Rendered output (executed probe, not a fixture):** Quinn server-rendered the branch's actual `BrowseFilters` (Season + Hue groups, `hueMode="multi"`, every count cell = 7) via `renderToStaticMarkup` in the branch worktree. Result: the Pink chip renders `Pink <span class="text-muted tabular-nums">(7)</span>`; `sr-only` appears **nowhere** in the rendered filter markup (`HAS_SR_ONLY: false`); no unit word is present. SPEC §2.4.2 requires the muted numeral plus a screen-reader-only unit ("12 varieties" on this surface), generalizing the shipped `StateFilter` pattern (numeral + sr-only " sellers", verified still present in `StateFilter.tsx:33,52` at this head).
- **Tests:** the build's tests still pin the deviation — `tests/dom/variety-browse.test.tsx` asserts the SSR markup contains `"(7)"` and addresses chips by names like `Pink (7)`. No test asserts the spec form. The spec strings for F1 (an sr-only unit) appear in neither component nor tests (grep over both components + both browse test files: no matches).
- **Axes:** Severity Major (unchanged — screen-reader users hear a bare number with no unit on every chip of the reference surface). Evidence: directly observed in code + executed rendered probe. Coverage: complete for F1 (both render paths share the one component; probe covered the SSR path, the hydrated path consumes the identical `ChipCount`).

### R2 — F2 confirmation: NOT FIXED (Major, reopened — never closed), all three sub-parts

SPEC §2.6.1 (remover label `"{Group}: {Value}"`, accessible name `"Remove the {Group} filter, {Value}"`) and §2.6.2 (Clear All label `"Clear all filters"`), against the branch at head:

- **Remover visible label:** still the value only. `removersFor` (`v2/lib/browse.ts:402-420`) builds each remover's `label` from the value label alone (e.g. `COLOR_FAMILY_LABELS[h]` → "Pink"; the season label alone for Season), with no group prefix; `AppliedRow` renders `{r.label}` as the chip text in both branches.
- **Remover accessible name:** still `` `Remove ${r.label}` `` → "Remove Pink" — in **both** the hydrated `<button>` (`VarietyBrowse.tsx:173`) and the SSR `<Link>` (`VarietyBrowse.tsx:185`). No group is named; the "Remove the … filter, …" construction appears nowhere.
- **Clear All:** still renders the literal text **"Clear all"** in both the hydrated button and the SSR link (`VarietyBrowse.tsx:204,208`) — not "Clear all filters".
- **Tests:** the build's tests still pin the deviating names — SSR assertions `aria-label="Remove Pink"` / `aria-label="Remove Peach"` / `aria-label="Remove Cool Season Hardy Annuals"` and `">Clear all</a>"` (`variety-browse.test.tsx:161-168`), and DOM queries `getByRole("button", { name: "Remove Pink" })`, `{ name: "Remove Peach" }`, `{ name: "Clear all" }` (lines 407-420). A grep for the spec forms (`Clear all filters`, `Remove the`) across both components and both browse test files returns **no matches**. The fix brief required the pins to be updated to the spec forms as part of the proof; they were not, because the fix never landed.

### R3 — Verify suite (Quinn's own runs, fresh scratch worktrees)

| Run | Command | Result |
|---|---|---|
| Branch `fbf625e` | `npm ci` + `npm run verify` (lint + typecheck + vitest) | Lint and typecheck passed (run reached the test step). Vitest totals: **67 test files, 1145 tests** — in the single full parallel run, 65 files passed and 2 D1 integration files failed at Miniflare setup (`createTestD1`, `UND_ERR_SOCKET` "other side closed") under heavy shared-CPU contention (1134 passed, 11 skipped = those 2 files' tests never started; a second session's suite was running concurrently). Quinn re-ran the entire `tests/integration` folder: **13 files / 291 tests, all passed**, including the implicated `variety-seller-counts.test.ts` and this PR's `browse-counts.test.ts` (also green in a targeted 2-file re-run, 19/19). Recorded as an environment flake at D1 setup, closed by the full-folder re-run — not a product failure, and not hidden. |
| Merge-base `f5220a5` | `npm ci` + `npm run verify` | **exit 0 — 63 test files, 1075 tests, all passed** (clean, no flake). |
| Delta | — | **+4 files / +70 tests** — exactly the four new test files, identical to the first gate. PR-body numbers (67/1145; 23 files, +2538/−361) match Quinn's executed totals and Quinn's `git diff --stat` census exactly. |
| Non-vacuity (T-A) | the 4 new files copied onto merge-base code, `vitest run` | **exit 1 — all 4 files FAIL on pre-build code** (features do not exist there); all PASS on the branch. Both directions re-proven this session. |
| Non-vacuity, F1/F2-specific | — | **The suite is vacuous for F1/F2 by construction:** it is green on this branch *because* its pins assert the deviating strings (R1/R2). A spec-form assertion set would fail on this branch — proven by the rendered probe (no sr-only node exists to assert) and the build's own SSR assertions of the deviating `aria-label`s. This is the same defect class the first gate named: the tests encode the deviation rather than catching it. |

### R4 — The owed real-browser usability drive: STILL OWED (not run, not fabricated)

This session has no live-browser capability, so the drive specified in the first gate's "Owed browser pass" (four shopper goals — find varieties by season; by hue; combine groups; clear and start over — at 390px AND desktop against the branch build served locally; 3.1-A scroll/timing measurements; 3.1-B network proof that filtering is in-place with no document navigation/beacon; 3.1-F rendered focus-ring check; route-blocked 3.1-K; SellerFilterSection regression pass; Nielsen-rated findings) **did not run**. Status: **STILL OWED in full**, to a browser-capable agent, under the exact conditions already written in the first gate record — they are not repeated here because they stand unchanged. No drive results are claimed. Because F1/F2 fail the gate on code evidence alone, the drive is not the deciding blocker this time; it remains a standing condition of any future PASS on this PR, and 3.1-A/3.1-B/3.1-F/3.1-K's real-browser halves and the SellerFilterSection browser regression remain UNCHECKED.

### R5 — PR body accounting (F3): STILL PARTIAL (Minor, persists)

The PR body (read live at re-gate) is **unchanged** from the first gate: provenance present (task file `muse-tasks/tranche-3-1a-inplace-core.md`, workflow run `45077555769`); Build accounting present and **its numbers match Quinn's executed counts exactly** (67 files / 1145 tests; 23 files, +2538/−361); Gate record template section present. Still missing, as in F3: merge-base verify counts, the §8 proof results, the T-C payload field list, and the non-vacuity statement. Additionally, the body carries none of the successor-fix accounting the fix brief required (F1/F2 text answered, branch-vs-PR-#41 verify delta, fix non-vacuity runs) — because no fix PR or body update exists. F3 remains a Minor process finding; the template recommendation from the first gate stands.

### R6 — Athene second rating: still owed (note, not a blocker)

No Athene Coldread cold second rating was obtained at the first gate or this re-gate, and this session cannot commission her. No new Nielsen-rated usability findings exist for her to rate (the drive did not run). Per the re-gate brief, this does **not** block the code verdict — the FAIL stands on F1/F2 — and is recorded as a note for the coordinator: when the fix lands and the drive runs, commission Athene's independent rating of the consolidated findings list before the verdict, per the evaluator-effect rule. All severities in this record remain single-evaluator (Quinn).

### Re-gate coverage ledger

- **Population:** PR #41 at head `fbf625e` — the F1/F2 surfaces (`BrowseFilters`/`ChipCount`, `VarietyBrowse`/`AppliedRow`, `lib/browse.ts` removers), the build's browse tests, the full verify suite on branch and merge-base, the PR body.
- **Structured sample actually checked:** full verify on both trees (branch test-step flake chased to a full green integration-folder re-run); all F1/F2 component code read at head; executed SSR rendered probe of `BrowseFilters`; spec-form/deviation greps across components + tests; non-vacuity in both directions; PR body + PR/branch/run state read live from GitHub.
- **Exclusions, with reasons:** the real-browser drive and all rendered/visual/browser proof (no browser in this session — STILL OWED, R4); a re-run of the first gate's full §8 fidelity matrix (the branch is byte-identical to the gated commit — same SHA — so the first gate's §8 results stand as executed on this exact content; re-deriving them would re-prove an unchanged tree); live production (PR unmerged).
- **Evaluator structure:** single evaluator (Quinn); Athene not obtained (R6).
- **Residual risk:** unchanged from the first gate — real-browser-only behavior (scroll, timing, focus-ring clipping, beacon behavior, hydration) remains the class this coverage cannot see, and it is precisely what the still-owed drive exists to catch.

### Return conditions (unchanged in substance)

1. The F1/F2 fix actually lands on the PR branch (or a successor PR): sr-only unit in `ChipCount` for both render paths with the surface's unit word per §2.4.2; remover labels `"{Group}: {Value}"`, accessible names `"Remove the {Group} filter, {Value}"`, and the `"Clear all filters"` control per §2.6.1/§2.6.2 — with the build's test pins updated to the spec forms.
2. The coordinator confirms the previously dispatched fix run's cancellation and re-dispatches if needed — at re-gate, no fix artifact exists anywhere in the repo.
3. The owed browser drive (R4) runs in a browser-capable session.
4. Re-gate is then the narrow confirmation the first gate described: verify re-run, F1/F2 rendered check, drive record review. **Do not merge PR #41 as-is.**
