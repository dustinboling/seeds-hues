# Seller listing photos — product artwork on seller profile pages

## Why (Dustin's direction, 2026-11-20)

On a seller's profile page (e.g. https://seeds.hues.flowers/seller/geoseed), the seller's
listings are plain text boxes with no photos. Each listing/product must carry its photo —
product-forward in the spirit of the variety page, but NOT a copy of the variety page: the
seller page keeps its own seller identity, and the seller header/profile stays primary.

## Governing design documents (read BOTH in full before writing any code)

- `seller-listings-photo-design/UX-STRUCTURE.md` — Nadia (UX): structure ruling.
- `seller-listings-photo-design/UI-VISUAL-SPEC.md` — Mina (UI design): visual spec on top of it.

Where this brief and the documents differ, the documents govern; where the documents leave
a choice open, this brief's rulings below govern.

## What ships (summary — details in the design documents)

1. **Data** (UX doc §3): `VarietyRefSchema` gains `media: Media[]` and `cropMedia: Media[]`
   (required, `[]` when none, never omitted). Populated in the one shared funnel,
   `listings()` in `v2/lib/services/catalog.ts`, via the existing batched
   `repo.listMediaForVarieties` + `repo.listMediaForPlants`; add internal `plantId` to
   `listingSelect` (internal row field only — never in the public schema). This is a visible
   contract change for the OpenAPI `Listing` and the `/sync` payload — intended and approved.
2. **Component** (UX doc §4, Mina spec): a new `ListingArtwork` component resolves four
   tiers — (1) variety's own first plate, (2) the crop's first plate, (3) crop pod motif,
   (4) divider-stem placeholder — and `ListingRow` gains the artwork slot in **seller
   context only**. The rail: fixed 1:2 frame, 72px on phone (`w-18`), 96px at `sm+`
   (`w-24`), `bg-paper` ground, 1px `border-line` hairline, `rounded-lg`, plate shown WHOLE
   edge-to-edge (`object-contain` via `lib/images.ts`, `fit=scale-down`), no padding, no
   shadow. Glyph tiers use the identical frame, centred (pod motif `p-3`/`sm:p-4`,
   `opacity-90`; stem `opacity-50` — inherited verbatim from `VarietyCardImage`).
3. **Layout**: text column classes byte-identical, top-aligned grid (`gap-3` / `sm:gap-4`);
   stem rule + footer span the full card width below the grid, existing CSS untouched;
   at `lg` the LIST becomes 2 columns (`lg:grid-cols-2`, `gap-3`, `h-full` li/article,
   seller-only), no `min-height`; pagination untouched. Artwork is NOT a link and gets no
   interaction styling whatsoever. Sold-out listings: full-fidelity artwork, card ground /
   shadow / working outline CTA exactly as today. Artwork stays still — no load fade, no
   hover motion, no cascade.
4. **Alt text** (per tier): tier 1 `"{varietyName} — illustration"`; tier 2
   `"{common name} — illustration"`; tiers 3–4 decorative (`alt=""`, `aria-hidden`).
5. **Skeleton**: the seller loading skeleton gains the rail via the opt-in variant of the
   shared `ListingSheetSkeleton` (Nadia's ruling); the variety skeleton is untouched.
6. **Variety context does not change**: with the enriched data shape, the variety-context
   card must render byte-for-byte as today. No opportunistic refactoring or tokenizing of
   the card's pre-existing hardcoded values (Mina spec §5.2 tables them for Batch A) — this
   diff does not touch them.

## Sequencing ruling (Hue, resolving Mina's flagged conflict §7.1)

The stem rule inside the Quiet Ledger card stays exactly as it ships today. Its removal
(Dustin's P1 ruling, Batch C item C7) is a separate, not-yet-built change and is OUT of
scope here; this build is stem-agnostic by design and must not add, remove, or restyle the
stem rule.

## Hard constraints

- **Prices are NEVER shown** (standing rule R1) — no price data enters any new field,
  attribute, or test fixture assertion on the rendered card.
- **Never hotlink** a seller's site photos and never invent imagery: artwork comes only
  from our own image system (`v2/lib/images.ts` → images.seeds.hues.flowers, R2 originals).
- Plates are always shown **whole** — `fit=scale-down` / `object-contain` only; no
  cover/crop anywhere in the new code.
- Token discipline (Mina spec §5): zero new tokens, zero new hex values, zero off-scale px
  in the new code; every value traces to an existing token/scale.
- Phone-first; correct at iPad and desktop widths; focus order and contrast unchanged or
  better; no information carried by the image alone (status stays a text line).
- This repo's Next.js differs from training data (`v2/AGENTS.md`): read the relevant guides
  in `v2/node_modules/next/dist/docs/` before writing code that touches conventions you are
  unsure of.

## Finish line (the builder's loop — non-negotiable)

The pipeline sandbox is fixed: you CAN execute shell commands now. Before ending your turn,
run the FULL `npm run verify` in `v2/` yourself; on ANY failure, fix the cause and re-run
the FULL verify from the top; repeat until it is completely green (lint + typecheck + all
tests). Ending your turn with a failing or never-run verify is a failed run regardless of
anything else. Update or add tests for: the enriched `listings()` mapping (media/cropMedia
populated, `[]` when none), the four `ListingArtwork` tiers and their alt text, and the
seller-context-only rendering (variety context unchanged). Do not weaken or delete existing
tests to get green.
