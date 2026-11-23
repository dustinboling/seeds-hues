# Tranche 3.4 B-1 follow-up — in-place sort latency, title sync, and the seller-count sort key

## Provenance

READ BEFORE writing code:

- The B-1 browser drive record appended to `QUINN-GATE-tranche-3-4-pr57.md` (2026-11-23, "B-1 browser drive — executed 2026-11-23"): checks 3.4-A/3.4-B FAIL on the defect this brief fixes; 3.4-C/3.4-E closed PASS by the same drive; the ordering question and its coordinator ruling are recorded there.
- SPEC `backlog-2026-11-21/tranche-3/SPEC.md` §2.5 (the in-place contract), especially §2.5.1 (sort is local-scope: in-place, no document navigation), §2.5.3 (feedback budgets), §2.5.4 (a filter or sort change resets pagination to page 1, exactly one history entry, Back/Forward restore in place), §2.5.5 (pagination is the boundary of the in-place contract), and §5.2.2 (the availability ordering), §8 check 3.4-B.
- The machinery: `v2/components/ui/InPlaceBrowse.tsx` (`useInPlaceBrowse`), `v2/components/ui/SortChips.tsx`, the browse payload routes under `v2/app/api/browse/`, and the availability ordering in `v2/lib/repositories/catalog-read.ts` (`listingStatsSq` + the browse sort).

## What the drive found (live production, desktop width, 2026-11-23)

1. On `/variety`, changing SORT from page 2 does not observably swap in place: the click changes only the button's pressed state, no loading or busy indication is visible, and after several seconds the change lands as what the drive read as a full navigation to page 1 with the new sort. Replicated in both directions (availability → A–Z and back).
2. Cross-cutting: sort, pagination, and Clear All clicks all take several seconds with the old content displayed and no busy indication — the F6-class feedback gap on the sort/clear paths specifically.
3. Minor: the browser TITLE stays stale after Clear All (the title still read the cleared filter's name while the heading updated); the drive also observed title "— page 2" while the heading said Page 1 after the reverse sort change.
4. Ordering: "Most sellers first" page 1 showed Bouquet (16 sellers) ahead of Cinnamon (17 sellers).

## Coordinator's code + data investigation (established before this brief)

- Sort IS wired through the in-place machinery: `SortChips` buttons call the surface's `select()` → `fetchCommitted` → one JSON fetch + `window.history.pushState`. No router or document navigation exists in that path, and history commits on the fetch's success. Whether the drive's "full navigation" was a literal document load (e.g. a click landing on the pre-hydration link form of the control) or a slow fetch swap misread as one is NOT established — item 1 below settles it with evidence.
- The hook exposes `pending`; results regions (e.g. `#variety-results`) carry `aria-busy` while pending. There is NO VISIBLE busy indication anywhere, and the machinery NEVER updates `document.title` — which fully explains observation 3.
- Measured production latency (coordinator, 2026-11-23, from the build VM): `GET /api/browse/varieties` answers in **1.2–3.0s** across plain / `sort=availability` / `season=cool` / combined requests, warm and cold; payload ≈ 25 KB. Baselines from the same vantage: a static asset ≈ 0.4s; full page HTML ≈ 2.0–2.6s. SPEC §2.5.3 budgets the updated results to land within ~400ms.
- Ordering (production D1, read 2026-11-23): `dill-bouquet` = 17 published listings / 16 distinct sellers / 14 in-stock; `basil-cinnamon` = 17 / 17 / 16. The shipped within-tier key is listing count (§5.2.2: "within a tier, more listings first, then name ascending"), so the pair ties at 17 and name order decides. The observed order is exactly what the shipped key produces — and it visibly contradicts the "Most sellers first" label and the seller counts the cards display. Note the repository already computes all three counts in `listingStatsSq` (`listingCount`, `sellerCount` = distinct sellers, `inStockCount`), and a 2026-11-21 ruling already made the distinct-seller count the seller-labelled count everywhere else.

## The work

1. **Diagnose the mechanism, with evidence.** Reproduce the sort change from page 2 of `/variety` against a local production build seeded with the real catalog (`db:setup:local` + `cf:preview` or the project's equivalent), including a throttled-network pass. Determine whether a literal document navigation occurs anywhere in the sort/clear commit path (including the pre-hydration link form of the controls) or whether the observation is the slow fetch swap. State the mechanism and its evidence in the PR body. Fix any literal-navigation path you find so the commit is in-place per §2.5.1/§2.5.4: immediate selected dress, prior results visible until the swap, exactly one swap, exactly one history entry, page reset to 1.
2. **Bring the payload latency toward the §2.5.3 budget.** Profile where the browse payload's server time goes (the per-request counts recomputation over the whole catalog is the named suspect; verify, don't assume) and reduce what is reducible without changing any payload field's meaning. Report before/after server-side timings in the PR body (same requests, same catalog). Scope: the browse payload routes the in-place surfaces share (`/api/browse/varieties` first among them). Pagination is true navigation (§2.5.5) and is NOT redesigned here; if the same server cost dominates the page-2 document, say so in the PR body with the measurement.
3. **Sync the document title on every in-place commit.** After any committed change (filter, sort, Clear All, remover, popstate restore, soft-navigation adoption), `document.title` must equal the title the server renders for the committed state (including the page-1 reset and the cleared-filter name disappearing). The payload may carry the title if that is the cleanest machinery — if you add a payload field, enumerate it in the PR body per T-C. No title flicker through intermediate states: the title changes once, in step with the visible swap.
4. **Visible in-flight cue past ~1s — REGISTERED DEVIATION D-B1-2.** §2.5.3 permits exactly one addition when an update exceeds 1s: the `aria-busy` indication on the results region, which already exists and is invisible to a sighted shopper. The drive establishes that at production latency this reads as "nothing happened." Therefore: when a commit's fetch is still in flight ~1s after the tap, the results region gains a VISIBLE quiet pending cue, removed on swap, built only from classes/tokens the design system already owns (no new color, no spinner, no skeleton — §2.5.3's prohibitions stand). This exceeds §2.5.3's letter and is registered here as deviation **D-B1-2** for the gate and the lead to confirm or strike; implement it as a single isolated, easily-removed piece and flag it in the PR body under its register name.
5. **Correct the availability within-tier key (coordinator ruling, 2026-11-23).** Within a tier, order by **distinct-seller count descending** (the count the cards display and the "Most sellers first" label names), tiebreak **in-stock listing count descending**, then **listing count descending**, then **name ascending**. Tier order itself is unchanged (in-stock → listed → none). This amends §5.2.2's within-tier key and check 3.4-B's stated property ("within a tier the listing-count order is non-increasing" becomes "within a tier the distinct-seller-count order is non-increasing; in-stock listing count, then listing count, break ties before name"). The sibling rail consumes the same service order and inherits the corrected key. Amend the SPEC text and the `catalog-read.ts` comment in this build so the record and the code agree.

## Tests

- **T-A (non-vacuity binding):** every new test must FAIL against pre-build `origin/main` and pass on your build. State each new test's base behavior in the PR body.
- A comparator test shaped on the drive's pair: two same-tier varieties with EQUAL listing counts and DIFFERENT distinct-seller counts order by sellers (the Bouquet/Cinnamon shape — on base this orders by name and fails); plus the tiebreak chain (equal sellers → in-stock desc; equal in-stock → listings desc; equal listings → name asc).
- A DOM test driving a sort change and a Clear All on a browse surface asserting `document.title` after the commit equals the committed state's title (base never touches the title — fails).
- A DOM test driving SortChips from page 2 if the harness supports it: in-place swap to page 1, one history entry, `aria-busy` true during flight and removed on swap. If the harness cannot drive it, say so plainly in the PR body — do not silently omit it; the gate's browser re-drive carries that portion.
- The full existing suite stays green; `npm run verify` exits 0.

## Scope fence

- Rendered differences are exactly: the corrected availability order (item 5), the title behavior (item 3, metadata only), and the D-B1-2 pending cue (item 4). Any further rendered difference is a defect until reverted or carried back as a register amendment.
- No payload field changes meaning; any added field is enumerated (T-C). No change to the tier definitions, the sort options, the count-line phrases, or PB-1's resting default (Name A–Z).
- Prices never appear anywhere, as everywhere in this project.

## Lessons fenced

1. A green workflow gate does NOT mean the deliverable exists — prove the work from rendered surfaces and measured timings before ending your run, and report what you actually observed.
2. Lint as you go; run `npm run verify` in full before ending and iterate to exit 0.
3. Leave your work UNCOMMITTED in the working tree — the workflow's WIP/PR steps handle branching. A fully-committed tree trips the no-changes guard and kills the run.

## PR body hygiene

Carry: provenance (this brief; the B-1 drive record in `QUINN-GATE-tranche-3-4-pr57.md`; SPEC §2.5/§5.2.2; the coordinator ruling on the sort key); the item-1 mechanism diagnosis with its evidence; before/after latency measurements (item 2); the payload enumeration (T-C); machinery-change flags (title sync; D-B1-2 named as a deviation); each new test's base behavior (T-A); and a Gate record section for Quinn's re-gate (which includes a real-browser drive of the sort fix: sort from page 2 in both directions, busy indication past 1s, title sync, and the corrected seller-count order).
