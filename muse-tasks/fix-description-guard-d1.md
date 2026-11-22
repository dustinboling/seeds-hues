# Fix: seller-description publication guard misses the audit's own C2 format (Quinn gate FAIL D1 on PR #21)

## Starting point — reproduce PR #21 first

PR #21 (branch `muse/44945401929`) built the seller-description update endpoint and the
publication guard, and passed Quinn's gate on everything EXCEPT the guard defect below.
This run opens a fresh PR against `main`, so first reproduce PR #21's change exactly:

```sh
git fetch origin muse/44945401929
git checkout origin/muse/44945401929 -- \
  v2/lib/api/ingest-admin-routes.ts \
  v2/lib/services/admin.ts \
  v2/tests/integration/admin-seller-description.test.ts \
  v2/tests/unit/seller-description-guard.test.ts
```

Then make ONLY the changes described below, on top of that reproduced state. The endpoint,
route registration, body schema, auth shape, and the `sellerUpdate` funnel hook stay exactly
as PR #21 built them — do not redesign or refactor them.

## The defect (Quinn gate D1, 2026-11-21)

`descriptionViolations()` in `v2/lib/services/admin.ts` anchors the internal-marker labels
to string start or a newline:

```
/(?:^|[\r\n])\s*(?:anchor|badge|feed|note):/i
```

The real working-note format this guard exists to catch — the format in the 2026-11-21
audit's C2 finding (27 sellers publishing internal deliberation as About copy) — is a
**single line with pipe separators**. The labels sit mid-string after ` | `, and one
record carries its `Anchor:` mid-sentence. Run against the audit corpus of 84 real
production descriptions, the shipped guard flags only 32 of 56 non-clean descriptions;
24 of the 27 C2 records pass through verbatim. (The price half of the guard is sound:
29/29 price-carrying descriptions flag. Do not weaken or churn the price patterns.)

## Required behavior — the corpus is the spec

Your fixed guard MUST flag every one of these verbatim production descriptions
(they are the audit evidence; reproduce them in tests):

1. `Store address on product page: '5500 Blaine Ave | Inver Grove Heights, MN 55076' and 'Minnesota's Destination Garden Center' | Feed: None identified (Magento store; no public product feed found) | Badge: NO - Large Minnesota garden center, not a small family-run farm`
2. `Grower based in Iowa — on-page text: 'after moving to Iowa in 1984' and 'They never get as big here in Iowa'. Site is a one-grower heirloom seed preservation farm (Calamus, Iowa). | Feed: none — Wix site, no product feed found | Badge: YES - Clearly small and family-run: one-grower preservation farm, hand-pollinated small-batch seed, ~120 winter squash varieties, grower writes in first person about his own plantings and seed saving.`
3. `HQ 1734 Railroad Place, Hall, NY 14463; large full-line seed company, subsidiary of GROWMARK, Inc. (~280 employees). | Feed: no JSON feed — custom storefront; /products.json returns HTML; category pages only. | Badge: NO — national seed company, not a small farm.`
4. `Small family farm in Williams, Oregon (Richo Cech); certified-organic seed grown on-farm; homepage states 'Certified organic · Williams, Oregon' and 'Handmade in Williams, Oregon'. | Feed: WooCommerce Store API https://strictlymedicinalseeds.com/wp-json/wc/store/v1/products (verified fetchable). | Badge: YES — small family farm.`
5. `Baker Creek Heirloom Seed Co. (rareseeds.com), Mansfield, Missouri — large US heirloom seed company. Anchor: Zinnia 'Benary's Giant Salmon Rose' listed on rareseeds.com, verified on the product page 2026-11-19. Whole catalog screened via Shopify products.json (1,616 products).`
6. `Homepage states 'Based in California, Lush-Farm creates plantable seed calendars and cards'; customer reviews mention an LA garden, Ramona CA, and Paso Robles. | Feed: none — https://angletok.com/products.json?limit=250 returned 404; no Shopify feed found | Badge: NO - Small-business appearance but family-run status not evidenced; leave OFF pending Hue review.`

And it MUST stay clean (no `internal_marker`, no `price`) on every one of these —
ordinary prose that merely resembles the labels:

- `Take note: we ship on Mondays.`
- `Please note our shipping schedule changes in winter.`
- `The feed store next door sells our seed.`
- `We verified the address last week.`
- `Reviewed by Hue last spring.`
- `We accept dollars at the farm stand.`
- `Hudson Valley grows open-pollinated seed on its farm in Accord, New York.`
- `We grow heirloom zinnias on our family farm in Vermont.`

The design tension is deliberate and is yours to solve carefully: in the corpus, the
labels are capitalized segment labels — they begin a segment (string start, after a
newline, after a `|` separator, or after sentence-ending punctuation) — while the
clean lookalikes are lowercase words inside ordinary sentences. Solve it with the
narrowest pattern change that satisfies BOTH sets; a pattern that flags the clean set
is as much a failure as one that misses the corpus.

Also in scope (Quinn note N3, one pattern decision while you are here): a verification
stamp carrying a date is working-note scaffolding — e.g. `verified on the product page
2026-11-19`, `verified fetchable 2026-11-20` — and should flag as `internal_marker`,
while `We verified the address last week.` (no date) stays clean. Example 5 above is
already caught by its `Anchor:`; do not break it while adding this.

## Also fix — Quinn note N2 (the only UI change allowed)

The admin seller-edit sheet surfaces a rejected description save through
`friendlyError()` (find it under `v2/app/admin/sellers/`), which has no mapping for
`description_rejected`, so a human editor gets a generic failure with no reason.
Add a mapping whose message names the problem in plain words, e.g.:
"That About text can't be published: it contains a price or working notes. Remove
those and save again." Keep the mapping's shape consistent with its neighbours.

## Tests

- Extend `v2/tests/unit/seller-description-guard.test.ts` with the corpus shapes
  above: pipe-separated `Feed:`/`Badge:` blocks, the mid-sentence `Anchor:`, the
  dated verification stamps — and every clean lookalike listed above pinned as clean.
- All of PR #21's existing tests (both files) must keep passing unmodified in
  substance; `npm run verify` in `v2/` must pass in full.

## Out of scope — do not touch

- The endpoint, route table entry, body schema, and funnel hook (reproduce, don't revise).
- The price patterns (proven 29/29 against the corpus).
- The review-queue correction path (`applySellerCorrection`) — Quinn ruled it a
  tracked follow-up note, explicitly NOT part of this fix.
- Any production data. This is a code-only change; the data cleanup applies separately.
