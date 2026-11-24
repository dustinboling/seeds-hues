# Slice 2 REPAIR 3 — One head block on the nested about routes (Seed Directory SPA conversion)

You are the third repair of Slice 2 — a narrow delta. Quinn's re-gate of repair 2 (record `QUINN-GATE-spa-slice-2-repair-2.md` on main) CLOSED F1–F5 by execution and returned exactly one new Major plus one Minor. Read that record. Your run starts from PR #74's branch (muse/45431402089) — everything else in PR #74 is gate-passed and stays untouched. This PR supersedes PRs #72, #73, #74.

## Standing constraints (unchanged)

INERT; `v2/` untouched except the verify chain if unavoidable; no `.github/workflows/*` edits; no deploy-config changes; copy remains a port; prices nowhere.

## 1. F6 CURE (Major) — exactly one head block per page

On `/about/data` and `/about/bot`, the emitted HTML carries TWO complete conflicting head blocks (2 canonicals — the page's own path AND `/about` — 2 descriptions, 2 og:url) because Vike cascades `app/pages/about/+Head.tsx` into the nested routes, and each nested route adds its own head (`+Head.tsx` / `head.ts`). Live v2 emits exactly one canonical per page; canonical ambiguity on 2 of 8 templates breaks this slice's core contract.

Fix the head composition for the nested about routes so each emits EXACTLY ONE head block: one canonical (its own path), one description, one og:url — the page's own values, matching what v2 emits for those pages. Use Vike's documented head-merging/override behaviour for nested routes (consult the current Vike docs); do not break the other six templates — `/about` itself and all other routes must keep their current, gate-passed heads byte-for-byte in substance.

## 2. Occurrence-count assertions (the F6 test cure)

The surface test (`app/tests/build/slice2-surface.test.ts`) asserts presence/first-match, never exclusivity — that's why it couldn't see F6. Add occurrence-count assertions: for EVERY emitted template, exactly one `<link rel="canonical">`, exactly one meta description, exactly one `og:url`. Quinn will mutation-proof this by reintroducing a duplicate head — the suite must fail. (If asserting on all templates is impractical for a stated reason, assert at minimum on the two nested about templates plus /about, and say why in your summary.)

## 3. F7 CURE (Minor) — the summary accounting

Your run summary (which the coordinator carries into the PR body) must state, for the whole Slice 2 as it now stands:
- Route inventory shipped, mapped to the original brief's deliverables 1–6.
- The invalidation mechanism + the demonstration result (from repair 2, as gated).
- Per-segment sitemap counts (as gated: 557/261/83/124/33/32/11 = 1,101, with the drift note vs Bea's 1,097 expectation).
- The robots byte-diff result (exactly the three parameter disallows).
- This repair's delta: the head fix + the occurrence-count assertions, and the full verify result from a clean state.

## Out of scope

Everything else. If you find the head cascade also affects any other nested route in the tree, fix it the same way and say so; do not redesign the head system.
