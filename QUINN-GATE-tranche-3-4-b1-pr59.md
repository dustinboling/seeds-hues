# Quinn Gate Record — PR #59, Tranche 3.4 B-1 follow-up (in-place sort latency, title sync, seller-count sort key)

- **Gate:** Quinn Assurance (single evaluator; no second rater commissioned — evaluator effect applies, see Coverage ledger).
- **Subject:** PR #59, branch `muse/45224732594`, HEAD `906edd3ae1c07554840a0f7f340118ff69a69c17`, against `origin/main` (`069fb39`). Gate worktree: `~/workspace/seeds-hues-gate-pr59-wt`, checked out at the PR head; HEAD and GitHub head agree.
- **Governing documents:** build brief `muse-tasks/tranche-3-4-b1-followup.md` (five work items); SPEC `backlog-2026-11-21/tranche-3/SPEC.md` §2.5 (esp. §2.5.1, §2.5.3, §2.5.4, §2.5.5), §5.2.2, §8 check 3.4-B; the B-1 drive record in `QUINN-GATE-tranche-3-4-pr57.md` ("B-1 browser drive — executed 2026-11-23": 3.4-A/3.4-B FAIL on this defect; 3.4-C/3.4-E PASS).
- **Axes kept separate (W2):** Severity = defect impact. Evidence = what I actually ran/read. Coverage = ledger at the end. Verdict = below.

## Verdict: FAIL

Two of the brief's five items landed, and what landed is good: item 5's corrected sort key (code + repository comment) and item 2's counts consolidation are real, verified work. But items 1, 3, and 4 are entirely absent — no mechanism diagnosis, no `document.title` sync anywhere, no visible pending cue, no component file touched — item 2's required before/after timings appear nowhere, item 5's required SPEC amendment was not made (the living SPEC still states the old listing-count key, so code and record now disagree in exactly the way item 5 exists to prevent), and the PR body is workflow boilerplate carrying none of the brief's required hygiene. The B-1 defect's user-facing core — a shopper taps sort, sees nothing happen for seconds, and the browser title lies about the state afterwards — ships unchanged in this PR. Merging it would close the B-1 follow-up on paper while the defect the follow-up exists to fix remains live.

This is a chronic pattern, not a sporadic one (Juran): the workflow's PRs arrive with boilerplate bodies (PR #57 F-2, same finding), and here the run also stopped after the two server-side items, leaving the three client-side items unattempted and unreported. The maker's own accounting never says the work is partial — the gap is only visible from the diff. The lead should treat "run ended" as no evidence about completeness for this lane until the workflow reports per-item disposition.

---

## Step 1 — Verify reproduction (directly observed)

`npm run verify` (lint + typecheck + vitest) in the gate worktree, after a clean `npm ci`, **exit 0**:

```
Test Files  86 passed (86)
Tests       1328 passed (1328)
```

Exactly the workflow's claimed numbers (86 files / 1328 tests), confirmed from the run's own summary output. The suite is green. Per the gate rule, a green suite is necessary and not sufficient — the findings below are about work the suite never tests because it was never built.

## Item-by-item conformance (brief → evidence)

Diff census, recomputed by me: **6 files, +477/−15** — `v2/lib/repositories/catalog-read.ts`, `v2/lib/services/catalog.ts`, `v2/scripts/probe-browse-latency.ts`, `v2/tests/integration/availability-sort-key.test.ts`, `v2/tests/integration/tranche-3-4-search-sort.test.ts` (modified), `v2/tests/unit/availability-sort-key.test.ts`. GitHub's census agrees. No component file, no SPEC file, no other file.

| Brief item | Verdict | Evidence |
|---|---|---|
| **1. Mechanism diagnosis + fix any literal-navigation path** | **NOT DONE** | PR body (read via `gh pr view 59`) contains no diagnosis, no evidence, no mention of the item. `InPlaceBrowse.tsx` and `SortChips.tsx` are byte-identical to `origin/main` (absent from the diff), so no commit-path behavior changed and no literal-navigation path was fixed or cleared by inspection of a changed path. The question the B-1 drive raised — literal document load vs slow swap misread — remains unsettled by this build. |
| **2. Payload latency toward §2.5.3 ~400ms** | **PARTIAL — real code work, required reporting absent** | Genuine work landed: `catalog.ts` gains `browseVarietyCounts()`, answering the /variety counts matrix with 10 queries instead of 26 (grouped `countVarietyGroups` + conditional-aggregation method cells in `catalog-read.ts`), reusing `assembleBrowseCounts` so every payload field keeps its meaning; the per-count life-cycle fan-out drops with the old path. The named suspect (per-request counts recomputation) was the right one. My run of the maker's probe on HEAD (test D1, real seed catalog, this 1.5-CPU VM): whole payload **415–858ms** across plain / availability / season=cool / combined / perennial cases, while the old 26-query counts fan-out alone measures **713–1083ms** and summaries 48–242ms — the consolidation removes the dominant term. But: the PR body carries **no before/after server timings** (brief requires them, same requests, same catalog), no statement about the page-2 document cost, and absolute production latency is unmeasured — the ~400ms budget is neither proven met nor proven missed. The probe script itself was shipped (see F-6). |
| **3. `document.title` sync on every in-place commit** | **NOT DONE** | Zero occurrences of `document.title` in the diff, and zero anywhere in `v2/components`, `v2/lib`, or `v2/app` at HEAD (my grep). No payload title field was added (so no T-C enumeration exists either). The brief's required DOM title test does not exist. The B-1 drive's stale-title defect (title read the cleared filter's name; title said "— page 2" while the heading said Page 1) persists by construction: the machinery that never updated the title is untouched. |
| **4. Visible in-flight cue past ~1s (deviation D-B1-2)** | **NOT DONE** | No component change of any kind; no D-B1-2 mention in the PR body; no isolated cue exists in the tree. The results region still has only the pre-existing invisible-to-sighted-shoppers `aria-busy`. The F6-class feedback gap — the B-1 drive's central complaint — is wholly unaddressed. |
| **5. Availability within-tier key + SPEC/comment amendment** | **CODE PASS; RECORD AMENDMENT NOT DONE** | The key is correctly implemented in both places it must agree: SQL `sortOrder()` (`catalog-read.ts`) and the exported `summaryComparator()` now order within tier by sellerCount desc → inStockCount desc → listingCount desc → name asc (slug last), tier order unchanged; the `catalog-read.ts` comment is amended and accurate. The sibling rail consumes the same service order and inherits the key (the integration test exercises `listVarieties` directly). **But the SPEC amendment the brief requires "in this build so the record and the code agree" was not made:** the living SPEC (`~/workspace/seeds-hues/backlog-2026-11-21/tranche-3/SPEC.md`, §5.2.2 at line 265 and §8 check 3.4-B at line 405) still reads "within a tier, more listings first, then name ascending" / "within a tier the listing-count order is non-increasing." Note for the cure: SPEC.md is git-ignored and does not exist in any worktree (the tranche-3 folder there holds only DECISIONS.md), so a workflow build cannot amend it in a PR — this cure belongs to whoever holds the living copy (see Returns). |

## T-A — Non-vacuity (both directions, directly observed)

New/modified test files copied into a scratch worktree at pre-build `origin/main` (`069fb39`), run there, worktree removed afterwards; HEAD direction is the full verify above (all pass).

| Test file | On HEAD | On pre-build code | Assessment |
|---|---|---|---|
| `tests/integration/availability-sort-key.test.ts` (new, 2 tests) | Pass | **2 failed / 2, by assertion** — base returns the crafted set starting `b1-sortkey-v5…` (the listing-count order the file's header predicts: V5,V1,V4,V3,V2) instead of V1,V2,V5,V4,V3 | **Discriminating for the right reason.** The crafted set is the Bouquet/Cinnamon shape generalized: equal listings, different sellers, every tiebreak link adversarial to name order; the >50-ids variant also pins the chunking merge against the SQL order. Item 5's non-vacuity is genuinely carried by this file. |
| `tests/unit/availability-sort-key.test.ts` (new, 5 tests) | Pass | **File fails at collection** — `TypeError: summaryComparator is not a function` (not exported on base); 0 tests run | Fails on base, but by missing-export, not by assertion against wrong behavior — weaker non-vacuity (it proves the seam is new). The behavior it pins (including the literal Bouquet 16-sellers vs Cinnamon 17-sellers pair) is independently proven by the integration file. Recorded as F-7, a note on evidence quality, not a defect in the build's behavior. |
| `tests/integration/tranche-3-4-search-sort.test.ts` (modified: `expectTierOrder` now asserts seller-count non-increasing + tiebreak chain) | Pass | **9 passed / 9 on base** | **Non-discriminating on the real catalog:** base's listing-count order happens to produce no adjacent within-tier seller-count increase on the seed data, so the amended property passes both ways. A legitimate regression pin; it is not T-A evidence. The brief's T-A letter ("every new test must FAIL against pre-build code") is therefore not met for this file — the discriminating burden is carried by the crafted integration test instead. F-7. |

**Missing tests the brief required:** the DOM title test (sort change + Clear All asserting `document.title`) — absent because item 3 is absent. The SortChips-from-page-2 DOM test — absent, **and** the PR body does not carry the brief's required fallback statement that the harness cannot drive it. The omission is silent, which the brief explicitly forbids ("do not silently omit it").

## Browser drive (gate-required) — boundary, with what code identity already settles

**The live-browser drive was not run by this gate.** This gate ran as a generic subagent with no live-browser control; per my playbook that is a stated boundary, never a silently skipped step, and I do not round it up. Owner of the remainder: the coordinator, who must delegate the drive to a browser-capable agent. The phone-width pass also remains owed to Dustin's device, as it was after B-1 — recorded, not blocking this verdict.

What can be stated without the drive, from evidence stronger than inference — the relevant machinery is **byte-identical to the code the B-1 drive already failed**:

- **(a) Sort from page 2, both directions:** `InPlaceBrowse.tsx` / `SortChips.tsx` unchanged from `origin/main`. Nothing in this PR changes whether the swap is in-place, how many history entries it writes, or the page-1 reset. The latency consolidation (item 2) may make the swap *feel* less like a navigation; whether it does, and whether any literal navigation exists in the pre-hydration link form, is exactly what item 1's diagnosis was supposed to settle and did not. **UNCHECKED at browser fidelity; unsettled.**
- **(b) Visible busy/pending indication past 1s:** none exists. No cue was added anywhere (full-diff read). A drive can only re-observe the B-1 finding. **FAIL by construction.**
- **(c) `document.title` after Clear All / sort commits:** the title is never written by any code in the tree. It will read whatever the last document load set — the B-1 staleness persists. **FAIL by construction.**
- **(d) Bouquet vs Cinnamon under "Most sellers first":** proven at service fidelity — the unit test pins the literal pair (Bouquet: 17 listings / 16 sellers / 14 in-stock; Cinnamon: 17 / 17 / 16 → Cinnamon first) against `summaryComparator`, and the integration test proves the same chain through the real SQL query on a test D1. A browser drive would add rendering confirmation only. **PASS at INT/unit fidelity; browser rendering confirmation rides the repair drive.**

Because the verdict is FAIL on construction-proven grounds, the unrun drive does not soften it; and because items 1/3/4 must be built by the repair, the drive remains a required part of the repair's re-gate, with the brief's own conditions: sort from page 2 in both directions (one history entry, page resets to 1, prior results visible until swap), busy indication past 1s, title sync after sort and after Clear All, and the corrected seller-count order rendered on page 1.

## Scope fence

- **Prices: PASS.** No `price` occurrence anywhere in the diff (my grep) — no price field, value, or surface.
- **PB-1 resting default: PASS (unchanged).** `lib/browse.ts` is untouched; absent `?sort=` remains Name A–Z.
- **Rendered differences:** the only behavior change in the diff is the corrected availability order (item 5) plus the counts-consolidation, which is constructed to return identical numbers through the same `assembleBrowseCounts` (and the green suite's browse-counts pins agree). The title behavior and D-B1-2 cue that the fence *permits* are absent; no *unpermitted* rendered difference was found. One out-of-fence artifact: the shipped probe script (F-6) — not rendered, but not in the brief's deliverables either.
- **Payload fields:** no field added, removed, or redefined in the code that landed. (Item 3's contemplated title field never arrived, so there is nothing to enumerate — the absence is F-3's, not a T-C violation in what shipped.)

## Findings

### F-1 — Major: Item 3 (document.title sync) not built; the B-1 stale-title defect persists
- **Object:** `v2/components/ui/InPlaceBrowse.tsx` (untouched), whole diff.
- **Evidence:** zero `document.title` in diff and tree (grep, directly observed); no DOM title test; no payload title field.
- **Standard:** brief item 3; SPEC §2.5.4 (state lives in the URL — the title is part of the committed state's identity, and the B-1 drive recorded it lying in two distinct states).
- **Severity reasoning (usability):** frequency — every in-place commit on every browse surface; persistence — continuous (the title is wrong until the next full load); impact — moderate (the heading and count line are correct, so the user is misled in tabs, history, and bookmarks rather than stranded). Nielsen 3 territory mechanically; rated Major here as a wholly missing brief item.

### F-2 — Major: Item 4 (D-B1-2 visible pending cue) not built; the F6-class feedback gap is unaddressed
- **Object:** results regions on all in-place surfaces; deviation register D-B1-2.
- **Evidence:** no component file in the diff; no D-B1-2 flag in the PR body; the only busy indication remains the invisible `aria-busy`.
- **Standard:** brief item 4 (registered deviation, lead to confirm or strike — it was never even presented for that decision); SPEC §2.5.3's feedback contract as amended by the deviation.
- **Severity reasoning:** this is the B-1 drive's central user harm — at production latency (1.2–3.0s measured) a tap produces *no perceptible response*, which reads as a broken control (heuristic 1, visibility of system status). Frequency: every sort/filter commit over ~1s. Impact: users re-tap or abandon. Nielsen 3; Major. Item 2's speedup, if it holds in production, shrinks how often the cue is needed but does not discharge the item — §2.5.3's >1s case remains specified behavior.

### F-3 — Major: Item 1 (mechanism diagnosis) not performed; the in-place question remains unsettled
- **Object:** PR body; sort/clear commit path.
- **Evidence:** PR body contains no diagnosis or evidence of any kind; the commit-path components are unchanged, so neither a fix nor a clean bill for the pre-hydration link form exists.
- **Standard:** brief item 1 (diagnosis *with evidence*, stated in the PR body; fix any literal-navigation path found).
- **Note:** it remains possible the machinery is correct and the drive observed a slow swap — the coordinator's pre-brief investigation leaned that way, and item 2's consolidation supports it. But "probably fine, now faster" is a hypothesis; the brief required it settled with a throttled local-build reproduction. Until then check 3.4-B's in-place clause cannot be closed.

### F-4 — Major: PR body fails the brief's hygiene requirements in full
- **Evidence (directly observed via `gh pr view 59`):** the body is workflow boilerplate + build accounting (census 6 files +477/−15 — accurate as far as it goes). Missing entirely: provenance beyond the task-file name; the item-1 diagnosis; item-2 before/after timings; the T-C payload enumeration; machinery-change flags; the D-B1-2 deviation flag; each new test's base behavior (T-A); the SortChips-harness fallback statement; any per-item disposition admitting three items were not attempted.
- **Standard:** brief §"PR body hygiene". Same failure class as PR #57 F-2 — chronic, process-level: the workflow's boilerplate presents a partial build as a finished one. A reviewer trusting the body would believe the B-1 follow-up landed whole.

### F-5 — Major: Item 5's SPEC amendment not made — code and record now disagree
- **Object:** living SPEC §5.2.2 (line 265) and §8 check 3.4-B (line 405).
- **Evidence:** both still state the listing-count within-tier key (my read of the living copy, this gate). The `catalog-read.ts` comment *was* amended, so the tree now contains two contradictory statements of the normative key.
- **Standard:** brief item 5 ("Amend the SPEC text and the catalog-read.ts comment in this build so the record and the code agree"); check 3.4-B's stated property is the gate's own future test — left as-is, the next gate would test for the *old* key and fail correct code, or pass wrong code.
- **Routing note:** SPEC.md is git-ignored and absent from worktrees, so this cure cannot ride a PR from the workflow. It belongs to the lead/coordinator on the living copy — but it is a return condition of this gate all the same, and it is cheap: two sentences.

### F-6 — Minor: The temporary latency probe was shipped
- **Object:** `v2/scripts/probe-browse-latency.ts` (+56).
- **Evidence:** its own header reads "TEMP PROBE (delete before finishing)". It imports test helpers (`../tests/helpers/d1`) from a production scripts directory and is dead weight in the tree. Harmless at runtime; a hygiene defect and a tell that the run's finishing checklist (brief Lesson 1/2) was not walked.

### F-7 — Minor: T-A's letter is met only by the crafted integration test
- **Evidence:** T-A table above — unit file fails on base by missing export (collection error), amended search-sort tier test passes 9/9 on base.
- **Assessment:** item 5's behavior is genuinely non-vacuous (integration assertions fail on base for the right reason and pass on HEAD). The note exists so no later reader claims fuller non-vacuity than was observed, and so the repair brief doesn't copy the pattern of counting an export-seam failure as a behavior pin.

### What is good (recorded so the repair keeps it)
- Item 5's implementation is exactly the ruled chain, in both the SQL and comparator mirrors, with the comment amended and a well-crafted adversarial test set (the integration file is the model the brief asked for).
- Item 2's consolidation is the right fix aimed at the measured suspect, preserves every payload field's meaning by construction, and my probe run confirms it removes the dominant cost term on the seed catalog. It should be kept and built on, not reverted.

## Usability pass (required block)

- **Flows taken:** none in a real browser — boundary stated above, with the coordinator as owner of the owed drive. Desk pass instead: full diff read, machinery identity check against the B-1-driven code, service-level drives of the corrected order (integration suite, real D1 machinery), and my probe run of the payload path.
- **User-goal framing for the owed drive (unchanged from B-1):** "Find a variety I can actually buy" — sort to Most sellers first from page 2 of `/variety`, then back; clear a filter; at each step: did anything visibly happen, do I know what state I'm in (heading, count line, *and title*), can I undo it?
- **Findings:** F-1 (title lies about state — state comprehension), F-2 (no perceptible response to a tap — visibility of system status, heuristic 1). Both are the B-1 findings, still live. No new usability defects were introduced by what landed: the corrected order makes the "Most sellers first" label and the cards' seller counts finally agree with the sequence on the page — a consistency *repair* (heuristic 4) that the drive should confirm rendered.
- **Boundaries:** live-browser drive (owner: coordinator's browser delegation, against a local production build of the repair head, desktop width; conditions in the drive section above); phone-width pass (owner: Dustin's device, as already owed from B-1).

## Coverage ledger

- **Population:** PR #59's full diff (6 files); brief items 1–5 + Tests section + scope fence; SPEC §2.5/§5.2.2/§8 3.4-B; the PR body.
- **Strata checked:** full verify re-run (86 files / 1328 tests, exit 0 — matches the workflow's claim exactly); every production file in the diff read line by line; new tests judged as code and re-run in both directions (HEAD pass; base fail/pass per file, scratch worktree removed after); the maker's latency probe executed on HEAD against the test-D1 seed catalog; living SPEC text read at the two normative locations; PR body read against the brief's hygiene list; price grep over the whole diff; `document.title` grep over diff and tree.
- **Random/adversarial addition:** the SPEC-amendment check was run against the *living* SPEC in the main tree rather than the worktree (which is how the git-ignored routing problem in F-5 was established); the sibling-rail inheritance was traced through `listVarieties` rather than assumed.
- **Exclusions, with reasons:** the real-browser drive (no live-browser control in this gate session — boundary above, remainder owned by the coordinator; the FAIL rests on construction-proven absences, not on the unrun drive); production latency (no production contact; the probe numbers are this VM's, directional only); crop/seller/search browse routes' latency (brief scopes item 2 "varieties first" — the consolidation's absence there is in-scope partiality, noted under item 2, not a separate finding); the 390px/320px viewports (owed to Dustin's device since B-1).
- **Evaluator structure:** single evaluator (Quinn). No Athene cold second rating was commissioned; per the evaluator-effect literature a single pass finds roughly a third to two-fifths of problems — read this record with that bound. The absences found here are census facts (files not in a diff, strings not in a tree), which are not subject to the evaluator effect in the usual way; the *severity ratings* are.
- **Residual risk:** the class this coverage could still miss is live client behavior under real timing — precisely items 1/3/4's territory, which is why the repair's re-gate drive is a return condition and not a courtesy.

## What returns — the cure, item by item (precise enough to brief the repair build)

1. **Item 3 — title sync (F-1).** In `useInPlaceBrowse`'s commit path, after every committed change (filter, sort, Clear All, remover, popstate restore, soft-navigation adoption), set `document.title` to the title the server renders for the committed state, changing once, in step with the visible swap — no intermediate flicker. Cleanest machinery: carry the title in the browse payload and enumerate the added field in the PR body per T-C. Add the brief's DOM test: drive a sort change and a Clear All on a browse surface and assert `document.title` equals the committed state's title; state its base behavior (on PR #59's head it must fail — nothing writes the title).
2. **Item 4 — D-B1-2 cue (F-2).** When a commit's fetch is still in flight ~1s after the tap, the results region gains a visible quiet pending cue built only from existing design-system classes/tokens (no new color, no spinner, no skeleton), removed on swap, implemented as a single isolated, easily-removed piece, and flagged in the PR body under the register name **D-B1-2** for the lead to confirm or strike.
3. **Item 1 — diagnosis (F-3).** Reproduce the sort change from page 2 of `/variety` against a local production build seeded with the real catalog (`db:setup:local` + `cf:preview`), including a throttled-network pass and an explicit check of the pre-hydration link form of the sort controls. State the mechanism and its evidence in the PR body. Fix any literal-navigation path found so the commit is in-place per §2.5.1/§2.5.4 (immediate selected dress, prior results visible until swap, exactly one swap, exactly one history entry, page reset to 1). Add the SortChips-from-page-2 DOM test if the harness supports it (in-place swap to page 1, one history entry, `aria-busy` true in flight and removed on swap); if it cannot, the PR body must say so plainly.
4. **Item 2 — reporting (completes the partial).** Keep the consolidation. Add before/after server-side timings to the PR body (same requests, same catalog — the probe's five cases are a fair set), and state whether the same server cost dominates the page-2 document. Delete `v2/scripts/probe-browse-latency.ts` (F-6), or convert it into a kept, documented tool with its header corrected — it may not ship as a self-described temporary.
5. **Item 5 — record amendment (F-5).** Amend the living SPEC: §5.2.2's within-tier key to "distinct-seller count descending, tiebreak in-stock listing count descending, then listing count descending, then name ascending," and §8 check 3.4-B's property to "within a tier the distinct-seller-count order is non-increasing; in-stock listing count, then listing count, break ties before name" — dated and attributed to the 2026-11-23 coordinator ruling, matching the already-amended `catalog-read.ts` comment. Owner: the lead/coordinator (the file is git-ignored; no PR can carry it).
6. **PR body (F-4).** Rewrite to the brief's hygiene list: provenance (brief; B-1 drive record; SPEC §2.5/§5.2.2; the sort-key ruling); per-item disposition for all five items; the item-1 diagnosis; item-2 timings; T-C enumeration of any added payload field; D-B1-2 flagged as a deviation; each new test's base behavior (T-A); and a Gate record section naming the re-gate's browser drive conditions.
7. **Re-gate drive (owed, conditions).** On the repair head, local production build, desktop width: sort from page 2 in both directions (in-place, one history entry, page 1, prior results visible until swap); a >1s update showing the D-B1-2 cue; `document.title` matching the committed state after sort commits and after Clear All; page 1 under "Most sellers first" rendering Cinnamon ahead of Bouquet. Phone-width pass remains owed to Dustin's device.

**Can proceed:** nothing in this PR is mergeable as the B-1 follow-up, because the PR *is* the follow-up. Items 5 (code) and 2 (code) are keepers — the repair build should branch from this head or cherry-pick them, not redo them. If the lead prefers, item 5's code could be split and merged on its own merits with F-5's SPEC amendment made the same day; that is the lead's call, and this gate would confirm that split in a scoped pass. As submitted: **FAIL**.
