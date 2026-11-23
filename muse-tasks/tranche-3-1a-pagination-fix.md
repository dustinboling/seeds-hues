# Tranche 3.1a successor fix — N-D1 pagination soft-navigation (Item 3.1a)

## Base — read carefully

Build on the content of PR #46's branch (`muse/45100978944`, head `30f6eca`): it carries PR #41's Tranche 3.1a implementation plus the F1/F2 fixes, both gate-confirmed FIXED (QUINN-GATE-tranche-3-1a-pr46.md on main — read it in full, including the appended confirmation run). Your PR supersedes #46 and #41. Change ONLY what this brief names; F1/F2 and the rest of 3.1a stand exactly as gate-confirmed.

## The defect — N-D1 (Major / Nielsen 3, found by Quinn's confirmation drive)

In the 3.1a browse controller on /variety: under soft (hydrated) navigation, tapping "Next →" or "Page 2" changes the URL to `?page=2` and the RSC fetch returns 200, but the target page NEVER renders — 6s later the announcement still reads "Page 1 of 33" with page 1's cards displayed. Hard-loading the same URL renders page 2 correctly. Reproduced 3×. A chip tap afterwards recovers cleanly. Effect: only the first page (24 of 778 varieties) is reachable by paging in the hydrated app; the failure is silent (the announcement agrees with the stale content).

## The fix

Make pagination work under soft navigation: either (a) the controller renders the target page when the URL's page param changes (the URL↔state reconciliation must treat page like it treats filters), or (b) pagination controls become true document navigation. Choose whichever fits the controller's existing model with the smaller, cleaner change; state your choice and why in the PR body. The announcement ("Page N of M"), the rendered cards, and the URL must agree after every paging action, in both directions, including paging after filter changes and filtering after paging.

## Ride-along — F6 (Nielsen 2, Quinn: ride with this fix)

On a slow fetch (Quinn's deterministic test: 2.5s delay) the in-flight state shows only the optimistic press — no `aria-busy`, spinner, or progressbar. Add the pending indication the SPEC's state discipline calls for on the results region (aria-busy during flight, cleared on settle), without changing any settled-state rendering.

## Tests + accounting (all required)

- A regression test at the DOM level proving soft-navigation paging renders the target page (it must FAIL on PR #46's head and PASS on yours — Quinn will execute both directions).
- A test fixture exercising the SellerFilterSection with a multi-seller variety, so the still-owed 3.1-I check can run at the re-gate (the local catalog has no multi-seller variety; the fixture is yours to add under the test tree only).
- Full `npm run verify` green in v2/.
- PR body carries the full accounting the earlier PRs omitted: branch verify counts AND the comparison base, the non-vacuity statement, the N-D1 reproduction→fix evidence, and the F1/F2 confirmation that this branch preserves them byte-for-byte in behavior.

## Out of scope

O1 (per-option counts are toggle-preview counts — a SPEC §2.4.2 semantics question Quinn referred, NOT part of this fix; do not change count semantics). No other surface. No count, naming, or filter-behavior changes.
