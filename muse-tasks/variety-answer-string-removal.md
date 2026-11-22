# Remove the seller-list answer string from variety pages

Commissioned by Dustin (voice call, 2026-11-22), verbatim: "Also at the top of variety pages I see that it's listed all of the places that all the sellers that are selling it I guess. In like a long string we need to just remove that."

## What the string is

On a variety page with sellers, the header directly under the H1 renders the answer sentence built by `answerSentence()` in `v2/lib/services/catalog.ts` — for example, on `/variety/basil-cinnamon` today: "As of Nov 20, 2026, 17 sellers list Cinnamon: Alliance of Native Seedkeepers, Baker Creek Heirloom Seed Co., Eden Brothers, GeoSeed, … and Bucktown Seed Co." It renders in `v2/app/variety/[slug]/variety-view.tsx` as:

```tsx
<p className="mt-2 text-lg font-medium" data-testid="answer">
  {v.answer}
</p>
```

## Scope — the visible string only

- When the variety has one or more sellers, that paragraph no longer renders. Remove the element entirely for that case; leave no empty paragraph, placeholder, or spacing artifact in the header.
- When the variety has ZERO sellers, nothing changes: the same paragraph keeps rendering the zero-seller sentence "No seller found selling {name} yet." (`v2/lib/zero-seller.ts`, shipped in Tranche 1.4). That sentence names no sellers and is not the string Dustin ordered removed.
- The seller listing cards below ("Where to buy") and everything else on the page stay exactly as they are.

## Out of scope — do not touch

- `answerSentence()` and the `answer` field in the data layer stay exactly as they are: the same string still feeds the page's meta description via `v2/lib/seo/metadata.ts`. Metadata is explicitly NOT part of this removal — Dustin ruled on the visible string only.
- The OG card, template descriptions, JSON-LD, and the API payload are unchanged.
- No other page or surface changes.

## Proof (the gate re-runs it, real render)

- A rendered multi-seller variety page, rendered through the app's own renderer (not source-string assertions): the header contains no seller-name list and no `data-testid="answer"` element, and the rest of the page renders identically to merge-base.
- A rendered zero-seller variety page still shows "No seller found selling {name} yet." in the header.
- Non-vacuity: the new/changed render test FAILS on current main and PASSES on your branch; state both runs in the PR body.

## Discipline (standing)

- Update any existing test that pins the visible answer paragraph on seller pages. Data-layer tests asserting the `answer` field itself stay untouched — the field is not removed.
- Finish discipline: run the full `npm run verify` once, as the last act. If it fails, fix only failures in files this task touched, re-run verify once more, and finish. Do not iterate beyond two verify runs.
- The PR body carries the standard accounting: files changed, verify counts (files/tests, branch vs merge-base), the proof results, and the non-vacuity statement. The rendered-change claim may state only what is literally true.
- US spelling. No prices anywhere. Nothing outside this item's scope. No scratch or fixture files anywhere in the tree.
