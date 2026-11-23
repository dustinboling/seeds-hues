# Quinn Gate Record — PR #57, Tranche 3.4 (home composition, sort control, search repair)

- **Gate:** Quinn Assurance (single evaluator; no second rater commissioned for this gate — evaluator effect applies, see Coverage ledger).
- **Subject:** PR #57, branch `muse/45199030129`, HEAD `ad5fa18`, against `origin/main` (base worktree HEAD `db4b2f6`).
- **Governing documents:** SPEC `backlog-2026-11-21/tranche-3/SPEC.md` §5, §7 (B-5/B-6/B-8), §8 (3.4-A…3.4-F, T-A/T-B/T-C); build brief `muse-tasks/tranche-3-4-home-sort-search.md`; completion brief `muse-tasks/tranche-3-4-completion.md`. PB-1 ruled (b): resting default is Name A–Z; `sort=availability` addressable, never the default.
- **Axes kept separate (W2):** Severity = defect impact. Evidence = what I actually ran/read. Coverage = ledger at the end. Verdict = below.

## Verdict: FAIL

The 3.4 build itself passes every executable §8 check at the fidelities available to this gate (see check table). The FAIL is driven by one gate-rule ground and one hygiene ground, both curable without touching the build's behavior:

1. **T-B (SPEC §8, verbatim rule): a rendered difference beyond B-5/B-6/B-8 and the bounded fold-in exists** — the SearchBrowse group-key repair (Finding F-1). §8 T-B: a further difference "is a FAIL until reverted or carried back as a register amendment." The fix is correct and must **not** be reverted (reverting re-breaks `/search`); the return condition is a **register amendment + PR-body disclosure**, which only the lead can carry.
2. **PR-body hygiene required by both briefs is unmet and the printed diff census misstates the PR** (Finding F-2) — must be cured before merge.

A real-browser drive is also still owed (Coverage boundary B-1); on its own it would have capped this gate at PASS WITH NOTES. It does not drive the FAIL, and it remains owed for the re-gate.

---

## Step 1 — Verify reproduction (directly observed)

`npm run verify` (lint + typecheck + vitest) in the gate worktree, clean re-run with no parallel load, **exit 0**:

```
Test Files  84 passed (84)
Tests       1303 passed (1303)
```

Exactly the workflow gate's reported numbers (84 files / 1,303 tests).

**Run history, disclosed plainly:** my first verify attempt in this gate ended **exit 1 on infrastructure, not on tests** — the vitest worker pool died during startup ("Worker forks emitted error", 34 errors) after 50 of 84 files, with all 1,035 tests that did run passing. That run overlapped my own parallel base-worktree install and T-A executions on this 1.5-CPU cell; worker starvation under that contention is the consistent explanation, and the gate worktree's `node_modules` was subsequently found empty (quota pressure was observed repeatedly in this session — npm error −122 EDQUOT on a parallel install). After a fresh `npm ci`, the uncontended re-run above passed in full. The operative Step 1 result is the clean re-run; the first attempt is recorded here so this record does not present a cleaner history than happened. (A draft of this record circulated to the coordinator before the first run's terminal result arrived; the numbers in it are the clean re-run's, confirmed after the fact — the coordinator has been sent a correction note alongside this record.)

## §8 checks 3.4-A…3.4-F — results

Fidelity labels: **INT** = integration tests I ran on HEAD against the real seed catalog on a test D1 (the same catalog `db:import:local` loads); **SSR** = server-render tests I ran; **DOM** = jsdom component tests I ran (real component, simulated browser); **CALC** = my own recomputation; **BROWSER** = real-browser drive — **not run** (see boundary B-1); every BROWSER portion below is UNCHECKED, never rounded up.

| Check | Result | Evidence |
|---|---|---|
| **3.4-A** home composition | **PASS** at INT/SSR fidelity; BROWSER portion unchecked | INT (`tranche-3-4-home.test.ts`, real catalog): section order hero → Recently restocked → Browse by crop → How this directory works; resting grid = exactly 12 cards whose slugs equal, in order, the top 12 computed from coverage data (varieties-with-sellers desc, name asc); see-all line "Showing 12 of {N} crops — see all crops" with N = the `/crop` total. SSR (`tranche-3-4-renders.test.ts`): with `?season=cool` every matching crop shows — cap lifts, count line agrees. DOM order is viewport-independent, but the rendered drive at 390px and 1280px was not run (B-1). |
| **3.4-B** sort drive | **PASS** for service/render/unit portions; in-place drive portion **UNCHECKED** (B-1) | INT (`tranche-3-4-search-sort.test.ts`, real catalog, both surfaces `/variety` and crop detail sweet-pea): availability page 1 holds every higher-tier variety, whole set tier-ordered (in-stock → listed → none; within tier listing-count non-increasing, name asc breaks ties); `?sort=name` A–Z; `?sort=recent` by last check, nulls last. Unit (`browse-sort.test.ts`, `crop-detail-filters.test.ts`): exactly the three options; phrases "most sellers first." / "alphabetical." / "most recently checked first." follow the sort in all three states on both count-line builders; resting state is `name` everywhere (PB-1 fallback honored — no availability default anywhere in the diff). SSR: `?sort=name` renders A–Z with the links floor, JS off. **Unchecked:** switching sort from page 2 returning to page 1 *in place*, history/focus/announcement during a live sort tap — no DOM test drives `SortChips`; the behavior rides the 3.1-proven `InPlaceBrowse` machinery via `select`, but that is inference from code, not a drive. Sibling rail: SSR test proves `listVarieties` is called with `sort: "availability"` and six-minus-self render (mock fidelity); the rail's six were **not** tier-tested against catalog data — unchecked at data fidelity. |
| **3.4-C** no-auto-open | **PASS** at DOM fidelity; BROWSER portion unchecked | DOM (`searchbox.test.tsx`): mount with `defaultValue` fires no fetch and opens no panel; focus alone never opens; typing one character change fires the fetch and may open; typing back to the mount value returns to pristine. The network-log observation on `/search?q=zinnia` in a real browser was not run (B-1). |
| **3.4-D** ranking probes | **PASS** (INT, real catalog, service level — the autocomplete endpoint's `results` list) | `ali` → Alison above Calendula, California Poppy, Chinese Lantern, False Indigo; `Alison` → Alison first, then Alison Valentini; `sweet pea` → Sweet Pea crop first; `mother of pearl` → exactly the one variety. Grouped results-page layout unchanged in structure (guard test + diff read). |
| **3.4-E** empty + did-you-mean | **PASS** at DOM/INT/SSR fidelity; BROWSER portion unchecked | DOM: typed no-match query shows the visible "No suggestions — press Enter to search." row (aria-hidden, never an option; sr status announces the identical text once); failed fetch shows the failure row with its existing text. INT: `alsion` → Alison via `suggestCorrection`; `zzqqx` → no suggestion. SSR: zero-results state renders "Did you mean **Alison**?" as a link to that search; `zzqqx` renders the plain zero state. Quoted query: rendered copy reads `Nothing matches “zzqqx”.` — no stray space (see note N-2). |
| **3.4-F** AD-2 | **PASS** (CALC + DOM); BROWSER visual portion unchecked | My recomputation from the built CSS tokens (`app/globals.css`: `--color-leaf: #1e4634`, `--color-surface: #fffdf6`, WCAG relative luminance, unrounded): **10.42:1 ≥ 3:1** — exactly the SPEC's expected value; the old wash (`leaf-50` on surface) recomputes to 1.2118:1, matching Ada's AD-2 finding. The mark is a 3px `border-l-leaf` on the single shared `active` state; DOM tests pass for keyboard-arrow activation and hover writing the same state. Seeing the mark move in a real browser was not run (B-1). |

## T-A — Non-vacuity (both directions, directly observed)

All 9 new test files pass on HEAD (full verify, Step 1). Copied into the base worktree (pre-build `origin/main`), run, then removed and the base restored clean (`git status` empty). Per file, base direction:

| New test file | On pre-build code | Note |
|---|---|---|
| `tests/unit/browse-sort.test.ts` | **9 failed / 9** | Discriminating throughout |
| `tests/unit/did-you-mean.test.ts` | **7 failed / 7** | Discriminating throughout |
| `tests/integration/tranche-3-4-home.test.ts` | **3 failed / 3** | Discriminating throughout |
| `tests/unit/tranche-3-4-renders.test.ts` | 7 failed / 8 | The 1 pass ("cap lifts under a filter") is vacuous on base — no cap exists to lift; non-vacuous only paired with its at-rest sibling |
| `tests/dom/searchbox.test.tsx` | 7 failed / 10 | 3 passes are guards base also satisfies (debounce silence, ArrowDown-with-no-results, focus-reopen shape) |
| `tests/unit/crop-detail-filters.test.ts` | 5 failed / 8 | 3 passes are the pre-existing counts-schema contract guards |
| `tests/integration/tranche-3-4-search-sort.test.ts` | 5 failed / 9 | The discriminating `ali` ranking probe and both tier tests fail; 4 passes are non-discriminating probes (`Alison`, `sweet pea`, `mother of pearl` — base's type-order already satisfies them) + the grouped-layout guard |
| `tests/contract/browse-crop.test.ts` | 1 failed / 6 | The `?sort=` test discriminates; 5 are contract guards that pass both ways by design |
| `tests/contract/browse-sellers.test.ts` | **0 failed / 6 — passes in full on base** | See Finding F-3 |

Every file except `browse-sellers` contains at least one test that fails on pre-build code for the right reason (assertion against missing behavior, not collection errors). The guard tests that pass in both directions are legitimate regression pins, but T-A's letter ("every new test fails against pre-build code") is not met for them — recorded as F-3, not rounded up.

## T-B — Change-register audit (diff read line by line, 35 files, +1902/−157)

In-register and verified: B-5 remaining clauses (home section reorder; 12-crop cap + see-all line; the always-rendered home count line and `/crop` live-region attributes were already shipped in 3.1b-1 and are untouched), B-6 (SortChips on `/variety` + `/crop/[slug]` only; `sort` param vocabulary exactly `availability|name|recent`, absent = name; count-line phrases; sibling-rail availability ordering), B-8 (SearchBox no-auto-open, visible empty/failure rows, AD-2 leaf rule, ranking, did-you-mean). Fold-in as bounded: browse-route contract tests (both routes), validators pin cure (F-6 note). Machinery: `BrowseFilterState`/`CropDetailFilterState` gained a `sort` field — the brief's sanctioned payload/state change for this build; no other payload field changes; no token values changed (the AD-2 `border-l-[3px]` literal is registered in the token test's exemption list with its reason). `scripts/acceptance.ts` updates track the new count-line punctuation and section order — test-harness consequences of B-5/B-6, in-register in effect.

**One further rendered difference exists** — Finding F-1. Per SPEC §8 T-B it is a FAIL until reverted or carried back as a register amendment.

## T-C — Price

**PASS.** No price field or value appears in any new payload or surface (full-diff grep: the only `price` hits are the contract tests asserting *absence* of any price key in the served browse bytes, and a `parseSortParam("price-asc") → "name"` forgiveness test — both pass). The one new payload/state field is `sort` (values `availability|name|recent`), enumerated here because the PR body did not enumerate it (F-2).

## Fold-in verification

- **Crop-detail browse-route contract tests** (`tests/contract/browse-crop.test.ts`): real handler-level tests — they invoke the route handler against real services on a test D1, schema-parse the payload, and assert page/service agreement incl. `?sort=`, JSON 404s (unknown slug, past-end, garbage page), 405s, noindex/no-store headers, and no price key. Pass on HEAD. **Real and passing.**
- **Seller browse-route contract tests** (`tests/contract/browse-sellers.test.ts`): same pattern, incl. `?state=` narrowing. The brief allowed including them only if they fit the identical pattern with no new machinery — they did, and they pass on HEAD. **Real and passing** (their non-vacuity exception is F-3).
- **Validators pin comment:** at base, `v2/lib/validators/index.ts:549` cites `tests/unit/crop-detail-filters.test.ts`, which did not exist. The build created that file, and it genuinely pins the crop-detail counts vocabulary the comment claims. The citation is now true. **Cured** — by creating the pin rather than editing the comment; the brief's intent (no citation of a nonexistent pin) is satisfied. The second citation (line 274, `browse-filters.test.ts`) names a file that exists in both trees.

---

## Findings

### F-1 — Major (T-B): unregistered rendered difference — `/search` group-key repair rides along undisclosed
- **Object:** `v2/components/search/SearchBrowse.tsx`, `GROUP_DEFS` keys changed `"crops"→"crop"`, `"varieties"→"variety"`, `"sellers"→"seller"` (completion commit `ad5fa18`).
- **Evidence (directly observed):** `SEARCH_TYPES` are singular (`v2/lib/validators/index.ts:475`), the service builds results with singular `type` values, and base `SearchBrowse` filtered `x.type === key` with plural keys — so on pre-build code the `/search` results page renders **only the Series group** while its heading announces the full total; crops, varieties and sellers are silently dropped. I verified this from base source in the base worktree, and the build's own added test is named "search groups repair (3.4 completion): the with-results state renders every group."
- **Assessment:** the change is *correct* — it fixes a **Critical pre-existing production defect** (an escape from the Tranche 3.1b gate, whose checks read counts and headings but not rendered group contents — a chronic process gap worth the lead's attention beyond this PR). But it is a rendered difference on `/search` that is in neither B-5/B-6/B-8 nor the brief's bounded fold-in, and it is disclosed nowhere in the PR body (only in a code comment and a test name). SPEC §8 T-B governs: FAIL until reverted or carried back as a register amendment. **Do not revert** — reverting re-breaks search. Return condition: lead carries a register amendment (a B-8 clause or a new row) and the PR body discloses the repair and the defect it fixes.
- **Severity:** Major as a gate/scope defect (the underlying pre-existing defect it fixes is Critical, and is *fixed* by this PR).

### F-2 — Major: PR #57 body fails both briefs' hygiene requirements; its diff census misstates the PR
- **Evidence (directly observed via `gh pr view 57`):** the body is workflow boilerplate plus a "Build accounting" census of **2 files (+38/−4)** — that is only the completion run's delta; the PR's actual census is **35 files, +1902/−157**. Missing entirely: provenance (governing brief + completion brief + SPEC §5 + PB-1 ruling + the timeout-cancelled first run 45188077840, which the completion brief required "stated plainly"); the payload field enumeration (T-C — the new `sort` state field); machinery-change flags (the `sort` field added to both browse state types); the fold-in's disposition (both contract-test files included; validators pin cured by creation); and any mention of the F-1 repair.
- **Standard violated:** build brief §"PR body hygiene" and completion brief §"PR body hygiene". A reviewer trusting the body would believe this PR is a 2-file change. Return condition: body rewritten to the briefs' spec before merge.

### F-3 — Minor: T-A's letter is not met for the seller contract tests and the guard subset
- `tests/contract/browse-sellers.test.ts` passes 6/6 on pre-build code (the seller route is untouched by this build, so its contract tests cannot discriminate), and 16 further new tests across five files are guards that pass in both directions (itemized in the T-A table). The discriminating core of every §8 check is non-vacuous. This is a coverage/evidence note, not a defect in the build: the fold-in tests exist to pin pre-existing behavior. Recorded so the gate record does not claim a fuller non-vacuity than was observed.

### F-4 — Minor: Clear All also resets the sort — a behavior the SPEC does not sanction
- **Evidence (code read):** `clearAllFilters()` (`v2/lib/browse.ts`) and `clearCropDetailFilters()` (`v2/lib/crop-detail.ts`) return `sort: "name"`, and the builders' comments state this is intentional ("Clear all returns the list to Name A–Z too"). SPEC §2.6.1/§2.6.2: sort "is an ordering, not a filter," is never in the applied row, and Clear All "resets every group to All." A shopper who chose "Most sellers first," then clears filters, silently loses their chosen order with no announcement beyond the count line's phrase change. The SPEC neither sanctions nor forbids it; the brief is silent. For the lead to rule: keep (document as decided) or scope Clear All to filter groups only.

### F-5 — Minor: SearchBox reports `aria-expanded="false"` while the notice listbox is visible
- **Evidence (code read, `SearchBox.tsx`):** `aria-expanded={open && results.length > 0}`; when a typed query returns zero suggestions the panel opens with the visible message row (`hidden` is false) while `aria-expanded` stays false — the combobox reports collapsed while its listbox is on screen. DOM tests do not assert this attribute in the notice state. Cosmetic-to-minor a11y inconsistency (WCAG 4.1.2 name/role/value territory); the sr status line still announces the message, so no user is stranded.

### Notes (not findings)
- **N-1:** The crop-detail count line's resting form changed from empty to "N varieties, alphabetical." — judged *within* B-6 ("count lines state the true order"; 3.4-B requires the phrase in all three states on both surfaces). The acceptance script's regex was updated in step. No action.
- **N-2 (U1.4):** No diff hunk changes the quoted-query copy; the base source already renders `Nothing matches “{q}”.` with no stray space, and the built copy conforms. If U1.4's stray space lived in a rendering path outside this source, I could not reproduce it; the end state satisfies 3.4-E's wording either way.
- **N-3:** Did-you-mean first-letter matching uses `lower(substr(name,1,1))` against the query's lowercased (not accent-folded) first letter in the repository, while `pickDidYouMean` folds accents — a query beginning with an accented letter could miss candidates the picker would accept. Boundary case, no catalog name in the seed data exercises it; noted, not graded.

## Usability pass (required block)

- **Flows taken:** none in a real browser — see boundary B-1. What ran instead, and its fidelity: (a) the maker's jsdom DOM drives of the SearchBox flows (mount with a submitted query; type a no-match query; failed fetch; keyboard + hover activation), re-run by me on HEAD and on base; (ii) SSR renders of home, `/variety`, `/crop/[slug]`, `/search` zero- and with-results states; (iii) service-level drives of the sort and ranking behavior against the real seed catalog. These establish mechanics and content; they do **not** establish what a person sees at 390px, focus behavior during a live sort tap, or the mark's visibility in a real rendering.
- **User-goal framing for the owed drive:** "Find a zinnia variety I can actually buy" (sort to Most sellers first from page 2 of `/variety`); "See what's worth browsing" (home at rest, 390px); "Search for a variety I half-remember" (`alsion` on `/search`). At each: does the person know what happened, what state they're in, and how to undo it?
- **Findings from the desk pass:** F-4 and F-5 above are the usability-relevant items (silent sort loss on Clear All; combobox state misreport). No other clarity/feedback/friction defects found in the rendered states I inspected: the count line always states the true order, the see-all line names its count and destination, the empty row's text tells the user the next action (press Enter), and did-you-mean appears only in the zero-results state with a single candidate.
- **Boundaries:** B-1 below.

## Coverage ledger

- **Population:** PR #57's full diff (35 files: 16 production source, 13 test, acceptance script, brief carry, misc.); §8 checks 3.4-A…F + T-A/T-B/T-C; the fold-in's three items; the PR body.
- **Strata checked:** full verify suite re-run (84/1,303); every production file in the diff read line by line; new tests judged as code and re-run in both directions (HEAD pass, base fail/guard per file); AD-2 recomputed from CSS tokens by hand; price grep over the whole diff; PR body read against both briefs.
- **Random/adversarial addition:** the validators pin citations were resolved against the filesystem in both trees (which is how the fold-in cure-by-creation was established); `GROUP_DEFS` keys were traced back through the service constructors to base behavior (which is how F-1 was established).
- **Exclusions, with reasons:** **B-1 — the real-browser drive was not run.** This gate ran as a generic subagent with no live-browser access; the drive portions of 3.4-A (rendered viewports), 3.4-B (in-place sort switching incl. page-2→1, history, focus), 3.4-C (network log on mount), 3.4-E (typed drive), 3.4-F (mark visibly moving), and the 320px spot check are **UNCHECKED**, with the exact conditions specified in the check table. Owner of the remainder: the coordinator, who must delegate the drive to a browser-capable agent against a local production build (`db:setup:local` + `cf:preview` in a scratch worktree) before this item is called fully gated. Production was not contacted (per boundaries). No account flows exist in this item; none were needed.
- **Evaluator structure:** single evaluator (Quinn). No Athene cold second rating was commissioned; per the evaluator-effect literature a single pass finds roughly a third to two-fifths of problems — read this record with that bound.
- **Residual risk:** client-side behavior that only a real browser constructs (history stack shape across mixed filter/sort/page entries, focus retention on the sort chips, panel behavior under real timing) is exactly the class this coverage could still miss — the BusyForm escape class. That is why B-1 is a named owed pass and not a footnote.

## What returns / what can proceed

- **Returns to the lead (not the maker):** F-1's register amendment decision; F-4's Clear All ruling.
- **Returns to the maker/workflow owner:** F-2 (PR body rewrite). F-3/F-5 need no build change for this PR unless the lead rules otherwise; F-5 may ride a later SearchBox touch.
- **Open after this gate:** the B-1 browser drive (re-gate item), F-1 amendment, F-2 body cure. The build's behavior needs no changes for any finding above.
