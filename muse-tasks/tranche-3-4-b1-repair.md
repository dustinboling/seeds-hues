# Tranche 3.4 B-1 follow-up — REPAIR of PR #59 (gate FAIL, QUINN-GATE-tranche-3-4-b1-pr59.md)

## Provenance

READ BEFORE writing code:

- The gate record `QUINN-GATE-tranche-3-4-b1-pr59.md` — verdict FAIL, findings F-1…F-7, and "The cure (brief-ready)" §1–§7. This brief IS that cure; where this brief and the gate record differ, this brief governs and the difference is flagged in the PR body.
- The original brief `muse-tasks/tranche-3-4-b1-followup.md` — its scope fence, tests discipline (T-A), and PR-body hygiene list remain in force in full.
- SPEC `backlog-2026-11-21/tranche-3/SPEC.md` §2.5 (esp. §2.5.1, §2.5.3, §2.5.4, §2.5.5), §5.2.2, §8 check 3.4-B. **The SPEC's within-tier key text was amended on the living copy 2026-11-23** (distinct-seller count desc → in-stock desc → listing desc → name asc) — F-5 is already cured record-side; the code from PR #59 already agrees. Do not re-litigate the key.

## Starting point — KEEPERS, do not redo

This run continues from PR #59's head (`muse/45224732594`, 906edd3). Quinn verified and KEPT: item 5's corrected availability key (SQL `sortOrder()` + exported `summaryComparator()` + the catalog-read.ts comment) with its adversarial test set, and item 2's counts consolidation (`browseVarietyCounts()` — 10 queries replacing the 26-query fan-out, no payload field changed meaning). Both stay byte-faithful unless a cure item below touches the same lines; any change to them is flagged in the PR body as a machinery change with its reason.

## The work (the gate's cure)

1. **Title sync (cures F-1).** In `useInPlaceBrowse`'s commit path (`v2/components/ui/InPlaceBrowse.tsx`), set `document.title` on EVERY committed change — filter, sort, Clear All, remover, popstate restore, soft-navigation adoption — to the title the server renders for the committed state (including the page-1 reset and the cleared filter's name disappearing). The title changes ONCE, in step with the visible swap — no flicker through intermediate states. Carry the title in the browse payload if that is the cleanest machinery; any added payload field is enumerated in the PR body per T-C. Add the DOM test: drive a sort change and a Clear All on a browse surface asserting `document.title` after the commit equals the committed state's title. **T-A: this test must FAIL against PR #59's head (906edd3) and pass on your build** — state that base behavior in the PR body.
2. **D-B1-2 visible pending cue (cures F-2).** When a commit's fetch is still in flight ~1s after the tap, the results region gains a VISIBLE quiet pending cue, removed on swap. Built ONLY from classes/tokens the design system already owns — no new color, no spinner, no skeleton (§2.5.3's prohibitions stand). Implement it as a single isolated, easily-removed piece. This exceeds §2.5.3's letter and is registered deviation **D-B1-2** — flag it in the PR body under that name. The pre-existing `aria-busy` on the results region stays and must be true during flight and removed on swap.
3. **Mechanism diagnosis, with evidence (cures F-3).** Reproduce the sort change from page 2 of `/variety` against a local production build seeded with the real catalog (`db:setup:local` + `cf:preview` or the project's equivalent), INCLUDING a throttled-network pass and a check of the pre-hydration link form of the sort controls. Determine whether a literal document navigation occurs anywhere in the sort/clear commit path or whether the B-1 observation was the slow fetch swap. State the mechanism and its evidence in the PR body. Fix any literal-navigation path you find so the commit is in-place per §2.5.1/§2.5.4: immediate selected dress, prior results visible until the swap, exactly one swap, exactly one history entry, page reset to 1. Add the SortChips-from-page-2 DOM test if the harness supports it (in-place swap to page 1, one history entry, `aria-busy` true during flight and removed on swap); if the harness cannot drive it, say so PLAINLY in the PR body — a silent omission is itself a gate finding (F-3's predecessor).
4. **Item 2 reporting + probe disposition (cures F-4's timings gap, F-6).** Report before/after server-side timings in the PR body — same requests, same catalog (the PR #59 probe's measured shape is the "after" baseline for the counts consolidation: whole payload 415–858ms vs the old fan-out's 713–1083ms on the gate VM; re-measure on your build and report both). State what the same server cost does to the page-2 DOCUMENT (pagination is true navigation, §2.5.5 — measure and say, do not redesign). DELETE `v2/scripts/probe-browse-latency.ts` (its own header says "TEMP PROBE (delete before finishing)"; it imports test helpers into a production scripts dir). If you need timings, measure before deleting and put the numbers in the PR body.
5. **PR body rewrite (cures F-4).** The PR body carries the ORIGINAL brief's full hygiene list: provenance (both briefs; the gate record; SPEC §2.5/§5.2.2 as amended); a PER-ITEM disposition for all five original items (what landed in PR #59, what this repair adds, what remains unproven and where it will be proven); the item-3 (of the original brief) mechanism diagnosis with evidence; before/after latency measurements; the payload enumeration (T-C); machinery-change flags (title sync; D-B1-2 named as a deviation; any touch to the keeper code); each new test's base behavior (T-A); and a Gate record section for Quinn's re-gate, which includes a real-browser drive of this repair (sort from page 2 both directions; a >1s update showing the cue; title matching the committed state after sort and after Clear All; Cinnamon rendered ahead of Bouquet under "Most sellers first").

## Tests

- **T-A (non-vacuity binding):** every NEW test must FAIL against PR #59's head (906edd3, this run's base) and pass on your build. State each new test's base behavior in the PR body. (The keeper tests from PR #59 are exempt — they are already proven discriminating against pre-#59 main.)
- The full existing suite stays green; `npm run verify` exits 0. Lint as you go.

## Scope fence

- Rendered differences are exactly: the corrected availability order (keeper), the title behavior (metadata only), and the D-B1-2 pending cue. Any further rendered difference is a defect until reverted or carried back as a register amendment.
- No payload field changes meaning; any added field is enumerated (T-C). Tier definitions, sort options, count-line phrases, and PB-1's resting default (Name A–Z) are unchanged. Prices never appear anywhere, as everywhere in this project.
- The repair's PR supersedes PR #59 (same branch line; the coordinator closes #59 as superseded when the repair PR opens, or retargets as the workflow produces).

## Lessons fenced

1. A green workflow gate does NOT mean the deliverable exists — PR #59 is the proof: two of five items landed and the run reported nothing partial. Prove EVERY brief item from rendered surfaces and measured timings before ending your run, and give each item an explicit disposition in the PR body. An item you cannot finish gets a plain statement in the body, never silence.
2. Lint as you go; run `npm run verify` in full before ending and iterate to exit 0.
3. Leave your work UNCOMMITTED in the working tree — the workflow's WIP/PR steps handle branching. A fully-committed tree trips the no-changes guard and kills the run.
