# Quinn Gate Record — PR #58, Tranche 3.4 follow-up repair (F-4 + F-5)

- **Gate:** Quinn Assurance (single evaluator; no second rater commissioned for this scoped gate — evaluator effect applies, see Coverage ledger).
- **Subject:** PR #58, branch `muse/45212804229`, HEAD `50b518b` (confirmed identical via `gh pr view 58`: headRefOid `50b518b1b2bda1c08e26674399b84fe8dedf2b38`, state OPEN). The PR is a single commit on merge-base `a9eebc1` (the repair-brief commit, itself on top of PR #57's merge `b571c9b`).
- **Governing documents:** repair brief `muse-tasks/tranche-3-4-followup-repair.md`; Quinn's PR #57 gate record (`QUINN-GATE-tranche-3-4-pr57.md`, Findings F-4 and F-5 are the whole scope); SPEC `backlog-2026-11-21/tranche-3/SPEC.md` §2.6 (sort is an ordering, not a filter; Clear All resets every *group* to All), §5.2 (sort control; count line states the true order), §5.3.3 (visible notice row); coordinator #19's F-4 ruling (sort survives Clear All; absent sort stays absent).
- **Axes kept separate (W2):** Severity = defect impact. Evidence = what I actually ran/read. Coverage = ledger at the end. Verdict = below.

## Verdict: PASS WITH NOTES

Both cures are proven at the fidelities available to this gate: F-4 at unit, DOM (jsdom), and SSR-render fidelity on both clear paths and every consumer; F-5 at DOM fidelity plus a complete source-level state analysis. The new pins are non-vacuous — every F-4/F-5 pin fails against PR #57's shipped code for the right reason (T-A below). The diff contains exactly the two cures and their tests. One Minor hygiene finding (F-1) is a pre-merge body cure for the coordinator, not a build change. The PR #57 record's owed real-browser drive (its boundary B-1) is **not** discharged by this gate and remains owed for Tranche 3.4 as a whole — see Coverage.

---

## Step 1 — Verify reproduction (directly observed)

`npm ci` then `npm run verify` (lint + typecheck + vitest) in the gate worktree, single uncontended run, **exit 0**:

```
Test Files  84 passed (84)
Tests       1321 passed (1321)
```

This matches the workflow's reported numbers in the PR body exactly (84 / 1,321), and the delta against PR #57's gate (1,303) is +18, which reconciles with the new pins (4 + 4 unit, 1 DOM in-place, 5 SSR floor, 4 SearchBox). Run history: one run, no infrastructure failures, no re-runs needed; duration ~14 minutes on this cell, most of it the test phase.

## F-4 proof — Clear All preserves the active sort (both paths, all consumers)

**The cure (diff read line by line):**
- `v2/lib/browse.ts`: `clearAllFilters()` → `clearAllFilters(state)` returning `{ season: null, method: null, lifeCycle: null, hue: [], smallFarm: false, sort: state.sort }`. The stale comment claiming the reset to Name A–Z was intentional is replaced with the §2.6 rationale.
- `v2/lib/crop-detail.ts`: `clearCropDetailFilters()` → `clearCropDetailFilters(state)` returning `{ hue: [], series: null, hasSellers: null, sort: state.sort }`, same comment cure.
- `v2/components/ui/InPlaceBrowse.tsx`: the shared config contract changes in step — `clearAll: (state: S) => S` — and the applied row's two Clear All controls (hydrated button, no-JS link) both pass the current state through. Every surface on this machinery inherits the fix from this one point.

**Sort preservation, both non-resting sorts, both paths (unit pins, run by me on HEAD and on base):** `clearAllFilters` and `clearCropDetailFilters` each leave `availability` and `recent` untouched while every group resets to All (`tests/unit/browse-sort.test.ts`, `tests/unit/crop-detail-filters.test.ts`, "Clear All keeps the shopper's sort" blocks). A cleared sorted state serializes to exactly `{ sort: … }` and its href is the bare path plus `?sort=` only.

**Resting-default byte-equivalence:** at the resting sort the cleared state deep-equals the resting state on both paths (pins pass on HEAD *and* on base — guards by design, recorded in T-A). On the unsorted surfaces (home, `/crop`, `/search`) the state sort is held at `"name"` by the scoped parse, so the cleared state — and the no-JS href, since a resting sort serializes to the absent param (`filterParams`: `if (state.sort !== "name")`) — is identical to pre-repair behavior. The SSR floor pins confirm the rendered resting hrefs are unchanged (`href="/"` on home; `href="/variety"` in the resting zero-results state).

**No `sort=name` materialized:** state always carries the sort as a value (PR #57's model, unchanged); the URL and payload params omit it at rest. The unit pin asserts `filterParams(resting cleared)` is `{}` and the href is the bare `/variety`. Nothing in the diff adds a param anywhere.

**Count line states the true order after Clear All (§5.2):** pins assert `browseCountLine(cleared availability, …)` = "48 varieties, most sellers first." and `cropDetailCountLine(cleared recent, …)` = "24 varieties, most recently checked first."; the DOM drive (below) asserts the live line after an in-place Clear All.

**Every consumer inherits; no third clear path does otherwise (grep over `lib/`, `components/`, `app/` on HEAD):**
- `browseInPlaceConfig` (variety, crop index, home, search) → `clearAllFilters` ✓
- Crop detail config → `clearCropDetailFilters` ✓
- Applied-row Clear All (shared `InPlaceBrowse`) → `config.clearAll(state)` ✓
- Zero-results "Clear filters" recoveries — `VarietyBrowse`, `CropBrowse`, `HomeBrowse`, `CropDetailBrowse` (two sites) — all now pass the current state and build their no-JS href from the cleared state instead of the hard-coded bare path ✓
- Per-group removers are untouched (they never reset sort — `clearGroup`/`clearCropGroup` spread the state). The seller cloud's `clearSellerBrowseFilters` returns `{ state: null }` — `SellerBrowseState` has no sort field at all, so there is nothing to preserve and it is correctly untouched, exactly as the brief stated. No other clear/reset function exists in the tree.

**VarietyBrowse.tsx touch — exactly what the fix requires, nothing more:** two hunks, both forced by the signature change: the hydrated zero-results button now passes the incoming state (`(s) => clearAllFilters(s)`), and the no-JS link's href is now computed from the cleared committed state (`browseHref(BASE_PATH, clearAllFilters(committed.state))`) instead of the bare path — without that second hunk the floor link would still drop the sort, which is precisely the defect on the floor the SSR pins catch on base. No copy, class, or structure change in the file. The same two-hunk pattern, and nothing else, appears in `CropBrowse.tsx`, `HomeBrowse.tsx`, and `CropDetailBrowse.tsx`.

**In-place behavior (DOM fidelity, `tests/dom/variety-browse.test.tsx`):** the new pin drives a real Clear All tap under `sort=availability`: exactly one fetch to `/api/browse/varieties?sort=availability`, exactly one history entry (`/variety?sort=availability`), the applied row unmounts, focus lands on the Season "All" chip, and the count line reads "49 varieties, most sellers first. Page 1 of 3." — the true order, announced once.

**No-JS floor (SSR fidelity, `tests/unit/tranche-3-4-renders.test.ts`):** four new pins render the real pages: `/variety` applied-row Clear All links to `/variety?sort=availability`; a crop page's to `/crop/stock?sort=recent`; both zero-results "Clear filters" links likewise carry the sort; each page's count line states the matching order phrase.

## F-5 proof — SearchBox `aria-expanded` tells the truth in every state

**The cure (one expression):** `aria-expanded={open && results.length > 0}` → `aria-expanded={open}`, with a comment stating the invariant. Nothing else in `SearchBox.tsx` changes — no other ARIA attribute, handler, or rendering line is touched (full-file read).

**Why `open` is exactly the panel's visibility (source-level state analysis):** the listbox renders `hidden={!open || (results.length === 0 && notice === null)}`, and `notice` is non-null exactly when `open && results.length === 0 && status !== ""`. The only paths that set `open` true are the fetch success and failure handlers, and both set `status` non-empty in the same update (success: the suggestions count or "No suggestions — press Enter to search."; failure: "Suggestions unavailable. Press Enter to search."). Focus-reopen and ArrowDown-reopen require `results.length > 0`. So in every reachable state: suggestions open → panel shown, expanded true; zero-suggestion notice → shown, true; failure row → shown, true; closed (mount, pristine, Escape, blur, cleared input) → hidden, false. There is no reachable state with the panel visible and `open` false, nor with `open` true and the panel suppressed.

**DOM pins (`tests/dom/searchbox.test.tsx`, new "combobox expanded state" block):** closed at mount and after pristine focus → `"false"` with no listbox in the tree; suggestions → `"true"`; zero-suggestion notice → `"true"` with the listbox present and zero options; failure → `"true"` likewise. All four pass on HEAD; the notice and failure pins fail on base (T-A).

**No second writer:** grep finds three other `aria-expanded` occurrences in the tree — the header menu button (its own state, unrelated surface) and two admin decision controls (admin surface, untouched). None writes this combobox's state; the brief's flag condition does not trigger.

## T-A — Non-vacuity (both directions, directly observed)

All 8 changed test files pass on HEAD (full verify, Step 1). Copied into the base worktree — whose `lib/browse.ts`, `lib/crop-detail.ts`, `components/search/SearchBox.tsx`, and `components/variety/VarietyBrowse.tsx` I verified byte-identical between PR #57's merge (`b571c9b`) and the base HEAD, so the base direction tests PR #57's shipped behavior for everything in scope — run there, then removed and the base restored clean (`git status` empty, confirmed). Per file, base direction:

| Changed test file | On PR #57 code | Note |
|---|---|---|
| `tests/unit/browse-sort.test.ts` | **3 failed / 13** | Exactly the discriminating F-4 pins: availability preserved, recent preserved, cleared-state params/href/phrase. The resting byte-equivalence pin passes both ways (guard). |
| `tests/unit/crop-detail-filters.test.ts` | **3 failed** | The same three F-4 pins on the crop-detail path. The adapted pre-existing transition assertion passes both ways (guard). |
| `tests/dom/searchbox.test.tsx` | **2 failed** | The F-5 notice and failure pins. The closed and suggestions pins pass both ways — base's old expression happens to be correct in those two states (guards). |
| `tests/dom/variety-browse.test.tsx` | **1 failed** | The new in-place F-4 pin (fetch URL, history entry, count-line phrase under an active sort). The many `clearAllFilters()` → `resting()` fixture swaps pass both ways (guards). |
| `tests/unit/tranche-3-4-renders.test.ts` | **4 failed** | The four sorted-floor F-4 pins (applied row ×2, zero-results ×2). The fifth new pin — home's unsorted floor unchanged — passes both ways (guard, by design: it pins *no* change). |
| `tests/unit/browse-filters.test.ts` | 0 failed — passes in full | No F-4/F-5 pin in this file; its edits only adapt call sites to the new signature (`clearAllFilters(s)` with `s` at the resting sort). Guard-only, recorded as such. |
| `tests/integration/browse-counts.test.ts` | 0 failed — passes in full | Its only edit replaces `clearAllFilters()` as a fixture builder with an explicit literal state. Guard-only. |
| `tests/integration/tranche-3-4-search-sort.test.ts` | 0 failed — passes in full | Same: fixture-builder swap to literal states carrying the sort under test. Guard-only. |

Every failure on base is a named assertion failure against the shipped behavior (sort reset to `name`; `aria-expanded` false under a visible notice) — no collection or compile errors. Every file that contains an F-4 or F-5 pin fails on base; the three files without pins are signature/fixture adaptations and are recorded as guard-only, not rounded up. The brief's T-A requirement — the F-4 and F-5 tests must fail against the shipped PR #57 code — is met in full.

## Scope audit (T-B discipline) — exactly the two cures and their tests

The PR's true diff is the single commit `50b518b` against its merge-base `a9eebc1`: **16 files, +301/−73** — 8 production files (the two libs, `InPlaceBrowse`, `SearchBox`, and the four browse surfaces' call sites) and 8 test files. I read every production hunk line by line (above) and every test hunk. There is no third behavior: no copy change (the only text changes are the two lib comments, which now state the decided behavior), no token/CSS change, no payload field added or removed (the state shape is PR #57's; only a pure function's signature changed), no config change.

**Census caution, stated plainly so nobody misreads it:** a naive `git diff origin/main` in this worktree shows 18 files, including `lib/images-data.ts` and `tests/unit/images.test.ts` moving the image manifest *backwards* (1060 → 1054 entries). That is **not PR content**: the local `origin/main` ref (`ee1b8da`) has advanced past this branch's base with Tranche 4 batches 26/27, which the branch predates. Against the branch's actual base the images files are untouched. Whoever merges should expect GitHub's census (16 files) to govern; if the branch is later rebased onto current main, the images files must not move — flagging here because a backwards manifest would be a real defect if it ever appeared in the PR's own diff.

## T-C — Price

**PASS.** A grep for `price` over the entire PR diff returns no hits at all — no price field, value, or copy anywhere in the cures or their tests.

## PR body hygiene (judged against the brief's hygiene section)

- **Build accounting: accurate.** The body's census (16 files, +301/−73, with the stat table) matches my independent recomputation exactly, and its verify summary (84 files / 1,321 tests) matches my Step 1 reproduction exactly. This is the element PR #57's body failed; here it is correct.
- **Gate record section: present** as the designed placeholder for this record.
- **Provenance: partial (Finding F-1).** The body names the task file and workflow run 45212804229, but does not itself name Quinn's PR #57 gate record or coordinator #19's F-4 ruling — both are named in the task file it points to, one hop away, where the brief asks for them in the body.
- **Payload statement: absent (Finding F-1).** The brief requires the body to state the payload position (T-C). The true statement is simple — no payload changes; the only contract change is the `clearAll`/`clearAllFilters`/`clearCropDetailFilters` function signature — but the body does not make it.

---

## Findings

### F-1 — Minor (hygiene): PR #58 body omits two of the brief's required elements
- **Object:** PR #58 body (via `gh pr view 58`).
- **Evidence (directly observed):** body read in full. Present and verified accurate: task-file provenance, workflow run id, verify summary, true diff census, Gate record section. Absent: explicit provenance naming the PR #57 gate record and the coordinator #19 F-4 ruling; the payload statement required by the brief's hygiene section ("the payload statement (no payload changes; T-C)").
- **Standard violated:** repair brief §"PR body hygiene" (provenance = brief + gate record + ruling; payload statement required).
- **Severity reasoning:** Minor, and deliberately not PR #57's Major — there the census actively misstated the PR (2 files claimed vs 35 actual), which misleads a reviewer about what they are approving. Here the accounting is exact and the omissions are two statements, both curable by appending text. **Return condition (pre-merge, coordinator/workflow owner, no build change):** append the provenance lines and the payload statement to the body alongside this gate record.

### Notes (not findings)
- **N-1:** Three of the eight changed test files carry no discriminating pin (T-A table). This is inherent to a signature change — call sites must be adapted — and the files' role as regression guards is legitimate. Recorded so the record does not claim fuller non-vacuity than observed; the brief's T-A letter binds the F-4/F-5 *tests*, and those all discriminate.
- **N-2:** The DOM in-place pin's fake payload carries the resting state while the asserted count line reads "most sellers first" — the phrase follows the client's committed (cleared, sort-preserving) state, which is the behavior the ruling wants; the fetch-URL and history assertions independently pin that the sort-preserving state is what was requested and committed. No action.

## Usability pass (required block)

- **Flows taken:** none in a real browser — this gate ran as a generic subagent with no live-browser access (same boundary as PR #57's B-1). What ran instead, and its fidelity: jsdom DOM drives of the two repaired interactions (Clear All under an active sort on `/variety`, re-run by me on HEAD and base; SearchBox typed no-match and failed-fetch states), SSR renders of both sorted surfaces' floors, and unit-level state checks. These establish the state, URL, announcement-text, and ARIA-attribute links of the evidence chain; they do not establish rendered appearance or focus behavior in a real browser engine.
- **User-goal framing for the owed drive (unchanged from PR #57's record, which owns it):** "Find a zinnia variety I can actually buy" — sort `/variety` to Most sellers first, apply a filter, tap Clear all filters, and confirm the order visibly survives; on `/search`, type a no-match query and confirm the notice row and the combobox state agree (screen reader announcement). 
- **Desk-pass findings:** none beyond F-1. The two repaired behaviors are precisely the clarity defects F-4/F-5 named in PR #57's record (silent order loss; combobox misreporting its state); the count line's truthful phrase after Clear All is the feedback that closes F-4's Nielsen-1 gap, and it is pinned in three fidelities.

## Coverage ledger

- **Population:** PR #58's full diff (16 files: 8 production, 8 test); the two findings' complete behavior surface (both clear functions, every consumer, the seller-cloud exception, SearchBox's full state space); the PR body.
- **Strata checked:** full verify suite re-run on HEAD (84 files / 1,321 tests, exit 0); every production hunk read line by line in file context; all consumers of both clear functions enumerated by grep and each call site read; SearchBox read in full with its visibility invariant derived state by state; all 8 changed test files run in both directions (HEAD pass via the full suite; base fail/guard per file via targeted runs); price grep over the whole diff; PR body read against the brief's hygiene section; GitHub head and census cross-checked against the worktree.
- **Random/adversarial addition:** the `origin/main` census discrepancy was traced to its cause (main advanced past the branch point) rather than accepted at face value; the base worktree's in-scope files were verified byte-identical to PR #57's shipped tree before the T-A base direction was trusted; other `aria-expanded` writers were grepped to test the brief's second-writer flag condition.
- **Exclusions, with reasons:** the real-browser drive was not run (no live-browser access in this session) — the in-place Clear All tap and the SearchBox panel in a real engine at 390px remain **UNCHECKED** at browser fidelity; they are covered by PR #57's still-owed B-1 drive, whose owner is the coordinator's browser delegation, and this gate does not discharge it. Production was not contacted (per boundaries). No account or form flows are touched by this PR; none were owed.
- **Evaluator structure:** single evaluator (Quinn). No Athene cold second rating was commissioned for this scoped repair gate; per the evaluator-effect literature a single pass finds roughly a third to two-fifths of problems — read this record with that bound.
- **Residual risk:** behavior that only a real browser constructs (history-stack shape when Clear All follows mixed filter/sort/page entries, focus behavior in a real engine) is the class this coverage could still miss — the same class named in PR #57's record, and the reason B-1 remains an owed pass rather than a footnote.

## What returns / what can proceed

- **Returns to the coordinator/workflow owner (pre-merge, text only):** F-1 — append the provenance lines (PR #57 gate record; coordinator #19 F-4 ruling) and the payload statement to PR #58's body, alongside this record in its Gate record section.
- **Returns to the maker:** nothing. No build change is required by any finding in this gate; F-4 and F-5 are confirmed cured.
- **Can proceed:** merge, once F-1's body cure is appended. This gate is not a merge approval.
- **Open after this gate (unchanged, not discharged here):** PR #57's B-1 real-browser drive for Tranche 3.4 (owner: coordinator's browser delegation).
