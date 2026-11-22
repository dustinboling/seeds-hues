# Fix: Mixed-variety OG cards 500 in Satori (Tranche 1.8 successor to PR #29)

## Base — read carefully
PR #29 (branch `muse/44971756256`) contains the full Tranche 1.8 build and passed its Quinn gate on everything EXCEPT this defect. **Your branch must start from PR #29's branch, not from main**: fetch and branch from `origin/muse/44971756256` so your PR carries the complete 1.8 change set plus this fix, targeting main. PR #29 will be closed as superseded by yours. Do not re-implement 1.8; do not drop any of its changes or tests.

## The defect (Quinn gate F1, Major — evidence in QUINN-GATE-tranche-1-8-pr29.md)
`lib/og-card.ts` resolves a Mixed variety's disc to the shared `MIX_GRADIENT` conic-gradient string. Browsers render that fine (variety page, Swatch, Hue filter — all gate-verified), but the OG renderer cannot: Satori (the bundled `next/og` ImageResponse) throws `Failed to parse declaration "background: conic-gradient(...)"`, so `GET /og/variety/<any Mixed variety>` returns **HTTP 500**. Every Mixed variety loses its share image entirely. The maker's og-card tests asserted the model string only and never rendered through Satori, so the suite was green over a broken surface.

## The fix
- On the OG card only, draw the Mixed disc as **inline SVG wedges** (the card already draws its divider as SVG — follow that pattern): wedges whose colors are the same family stops the shared MIX_GRADIENT conic uses, in the same order, so the OG disc reads as the same Mixed treatment.
- The OG route must never pass a `conic-gradient(...)` value to Satori in any style property. Non-OG surfaces (variety page, Swatch component, BrowseFilters) keep using the CSS conic gradient — they are correct and gate-verified; do not touch them.
- Keep the shared model honest: if `lib/og-card.ts` needs a distinct OG-side representation (e.g. the wedge stop list) alongside the CSS string, derive both from one source so they cannot drift.

## Required tests (Quinn re-gate conditions)
1. **A real-render test**: render a Mixed variety's OG card through `ImageResponse` itself and assert success (a PNG response, no throw). Model-string assertions alone do NOT satisfy this — that is the exact escape that shipped the defect.
2. A control render: a non-Mixed variety's OG card through `ImageResponse`, asserting success and that its output is unchanged in kind.
3. All PR #29 tests remain, unweakened, and green.

## Done criteria
- `npm run verify` green on your final branch (full 1.8 change set + this fix).
- Local proof in your PR body: `GET /og/variety/stock-katz-mix` → 200 PNG against your branch's dev server, plus one non-Mixed control → 200.
- Scope discipline: the OG rendering of the Mixed treatment + the new render tests only. No other 1.8 behavior changes; no data/seed changes; no prices; US spelling.
