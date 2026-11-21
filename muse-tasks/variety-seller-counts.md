# Variety pages must count SELLERS, not listings

## Why (Dustin's ruling, 2026-11-21)

Live defect on https://seeds.hues.flowers/variety/basil-cinnamon : the page title says
"(17 Sellers)" — correct, that is the distinct-seller count — while the body says
"24 shops · 22 in stock", and the About paragraph says "It is listed by 24 seed sellers
in this directory." Those body numbers count LISTINGS (one seller can hold several
listings for the same variety — different packet sizes, treated/untreated, a second
product URL). A separate data dedupe is collapsing duplicate listings in parallel, but
Dustin's ruling is permanent and semantic: **any count the site labels as sellers or
shops must be computed from distinct sellers**, so the copy stays true even if a seller
legitimately holds two listings again. Honest listing counts are fine only where the
label actually says "listings".

This is a public-side fix only. Do NOT touch admin code (`v2/app/admin/**`,
`v2/lib/admin/**`, `v2/lib/admin-*.ts(x)`) and do NOT touch the open admin Slice D
branch/PR (branch `muse/44905008306`, PR #18) — this work is based on `main`.

## The rule

- "Distinct sellers" for a variety = the number of distinct sellers (by seller id /
  slug) among that variety's visible (public) listings — the same set the page lists.
- A seller-labelled count uses distinct sellers. A listing-labelled count keeps
  counting listings. Presence checks ("has any listing"), sorting, and filter
  behaviour are NOT labels and do not change.

## Known defect sites (verified against main, 2026-11-21 — fix each)

1. **Variety page header** — `v2/app/variety/[slug]/variety-view.tsx`, the Quiet Ledger
   header block ("N shops · M in stock", currently fed by `v.listings.length` and an
   in-stock listing filter):
   - "N shops" becomes the distinct-seller count of `v.listings`.
   - "M in stock" becomes the number of distinct sellers who have at least one
     in-stock listing for the variety (the line is a seller-framed summary; a seller
     with one in-stock and one sold-out listing counts once, as in stock).
   - Same markup, same classes, same words — only the numbers' meaning changes. The
     zero-listings case (line not rendered) is unchanged.

2. **About sentence** — `v2/lib/services/template.ts` `templateDescription()` renders
   "It is listed by N seed sellers in this directory." from `TemplateFacts.listingCount`,
   and its only caller, `getVariety()` in `v2/lib/services/catalog.ts`, passes
   `ls.length` (the listing count). Feed it the distinct-seller count of `ls` instead.
   Rename the facts field to `sellerCount` so the next reader cannot reintroduce the
   bug by passing a listing count into a seller sentence. The 0 / 1 / many sentence
   shapes stay exactly as they are. (`availabilityPhrase()` in the same file has no
   callers; leave it or align its parameter name the same way — no behaviour change.)

3. **Variety cards** — `v2/components/variety/VarietyCard.tsx` renders
   `plural(v.listingCount, "seller")` ("N sellers" / "No sellers yet"). The summary's
   `listingCount` is a raw listing count from SQL. Cards must show distinct sellers:
   - In `v2/lib/repositories/catalog-read.ts`, `listingStatsSq()` gains a
     distinct-seller aggregate over the same visible-listing set
     (`count(distinct seller id)`), exposed on the summary row as `sellerCount`.
   - Thread it through `VarietySummary` (`summaryFrom()` in
     `v2/lib/services/catalog.ts`, and the zod schema in `v2/lib/validators/`):
     an additive `sellerCount: number` beside the existing `listingCount`.
   - `VarietyCard` uses `sellerCount` for its seller label. `listingCount` stays for
     its existing presence/sort/filter uses everywhere else.

4. **Search results** — `v2/lib/services/catalog.ts`, the variety search subtitle
   ("{Crop} · N sellers" / "no seller listing yet") is built from `v.listingCount`.
   Use the summary's new `sellerCount` for the number; wording otherwise unchanged.

## Already correct — do not regress

- Page `<title>`: `varietyTitle()` in `v2/lib/seo/metadata.ts` already counts distinct
  seller slugs.
- The answer sentence (`answerSentence()` in `v2/lib/services/catalog.ts`) already
  dedupes seller names.
- Variety JSON-LD (`v2/lib/seo/jsonld.ts`) already dedupes sellers by slug.
- The variety filter count line (`varietyListingCountLine()` in `v2/lib/small-farm.ts`)
  is labelled "listings" and counts listings — honest as-is; do not change its
  semantics or wording. (Same for `sellerFilterView()`'s narrowing behaviour.)
- Seller pages' "N varieties listed" counts varieties, not listings — correct, untouched.
- State pages count sellers in the state — correct, untouched.

## Audit requirement

The four sites above are the known ones, not a guaranteed-complete list. Before
finishing, grep the whole public surface (`v2/app`, `v2/components`, `v2/lib` —
excluding `admin` paths) for every rendered use of `listingCount`, `listings.length`,
`inStockCount`, and any other count rendered next to the words "seller", "sellers",
or "shop(s)" — including `v2/app/llms.txt/route.ts` and the sitemap/llms section of
`v2/lib/repositories/catalog-read.ts`. Any additional seller-labelled count fed by a
listing count gets the same fix. Listing-labelled counts stay as they are.

## Tests (required, non-vacuous)

Add tests such that reverting to listing counts makes them FAIL:

- A fixture variety with multiple listings from one seller (e.g. 3 listings across
  2 sellers, one seller holding 2) asserting:
  - the About/template description says "2 seed sellers" (not 3);
  - the variety summary's `sellerCount` is 2 while its `listingCount` is 3;
  - the card/search seller label derived from that summary reads 2 sellers.
- The header computation: a seller with one in-stock and one sold-out listing counts
  once in "shops" and once in "in stock". If you extract a small helper for the
  header counts, unit-test the helper directly with that fixture.
- Follow the existing test layout (`v2/tests/unit`, `v2/tests/integration`) and its
  fixture patterns. If a contract test pins the exact summary shape, update the
  fixture to include the additive `sellerCount` field — that contract evolution is
  intended and approved here.

## Hard constraints

- **Prices are NEVER shown** (standing rule) — nothing in this change adds price data
  anywhere.
- No layout changes, no styling changes, no copy changes beyond the count semantics
  above. Words stay; numbers start meaning what the words say.
- Standing code constraints: no `setState` in effect bodies; React children are
  passed as JSX children, never via a `children` prop object; the R4 guardrail's
  scope and token list are unchanged — do not rename public copy to dodge a scanner.
- US spelling in any copy you touch.

## Verify before you finish

You can run commands. In `v2/`, run `npm run verify` (lint + typecheck + tests)
yourself; if anything fails, fix it and re-run until the full gate is green. Do not
finish with a failing or unrun gate — the workflow runs the same gate after you and
opens no PR unless it passes.
