# Task: Variety page — description up top, sellers beside the painting

You are working in the `seeds-hues` repository (the Seed Directory,
seeds.hues.flowers). This prompt is self-contained — do not assume any
other context.

## Orientation

- The live app is the **Next.js app in `v2/`** (Next 16, React 19,
  Tailwind 4, deployed with @opennextjs/cloudflare). Run all commands
  from `v2/`. Note `v2/AGENTS.md`: this Next version has breaking
  changes vs. training data — read the relevant guide in
  `node_modules/next/dist/docs/` if you touch framework APIs. (This
  task is presentational; you should not need framework APIs.)
- The repository root also contains an `app/` directory — a **legacy
  static site**. Ignore it completely.
- Verification, from `v2/`:

  ```
  npm run verify
  ```

  (lint + typecheck + vitest in `v2/tests/`). Dependencies are
  already installed (`npm ci` was run in `v2/` before you started).

## The page today

Everything below is in **`v2/app/variety/[slug]/variety-view.tsx`**
(the `VarietyView` component, shared by the plain and `small-farms`
variety routes — one change covers both). Current top-to-bottom
order inside the `<article>`:

1. `<header>` — swatch, eyebrow, `<h1>` variety name, and the
   `data-testid="answer"` summary line.
2. `<VarietyHeroImage>` (`v2/components/variety/VarietyHeroImage.tsx`)
   — the variety's portrait illustration: fixed ~380px wide, 1:2
   aspect, `object-contain` on paper, rendered only when
   `v.media[0]` exists.
3. The **"Where to buy"** `<section aria-labelledby="buy-title">` —
   heading, the "N shops · M in stock" summary, the honesty line,
   then either the zero-seller state (spot art, "No sellers yet"
   paragraph, `<WaitlistBlock>`) or the seller filter chips, the
   `aria-live` listing-count line, the small-farm legend, the
   `ListingRow` list, and `<ResultsScrollClamp>`.
4. **Variety facts** section.
5. **About** section (`<section aria-labelledby="about-title">`) —
   `<p>{v.description ?? v.templateDescription}</p>` plus, when a
   written `v.description` exists, a second muted paragraph with the
   template description.
6. Sowing and growing section, report link, sibling varieties.

## Problem (owner-reported, on iPad/desktop widths)

- The content column is far wider than the 380px painting, so the
  painting sits alone with a large blank area to its right, and the
  sellers — the point of the page — are pushed far down.
- The variety's own description is buried near the bottom, below
  the sellers and the facts.

## The change — two moves, same component, nothing else

### Move 1: description directly under the header

Move the **About** section (both paragraphs and their conditional
logic, byte-identical copy) so it renders **directly beneath the
`<header>`**, spanning the full content width (it must NOT end up
inside either column of Move 2's grid), above the painting/sellers
block at every viewport width.

- Keep the `<h2 id="about-title">About {label}</h2>` heading and
  the section's `aria-labelledby`. After the move the heading order
  is h1 → About (h2) → Where to buy (h2) → Variety facts (h2) →
  Sowing (h2): still a logical outline. Do not change heading
  levels or text.
- Do NOT move anything else into this spot. In particular, the
  crop-level guidance box inside the **Sowing and growing** section
  (`v.plant.description` / `v.plant.sowingNotes`) is a different
  block — it stays exactly where it is.

### Move 2: two columns at the `md` breakpoint and up (≥768px)

Wrap the hero image and the "Where to buy" section in a two-column
arrangement that applies **only at ≥768px** (Tailwind `md:`):

- **Left column:** the hero painting, at its current size and
  appearance (max 380px wide, 1:2, shown whole on paper). Do not
  resize, re-crop, or restyle the image; `VarietyHeroImage` itself
  should not need changes.
- **Right column:** the ENTIRE "Where to buy" section, moved up
  alongside the painting — heading, shops/in-stock summary, honesty
  line, filter chips, `aria-live` count line, legend, and every
  `ListingRow`, all inside the section exactly as today. The tops
  of the painting and the section align.
- **Below the columns:** Variety facts and everything after it
  continue full width, unchanged.
- **Below 768px:** layout unchanged — stacked header → About →
  painting → sellers, same spacing rhythm as the page has today.
- **No hero image** (`v.media[0]` absent): no two-column layout and
  no empty left column — the "Where to buy" section simply follows
  the About block full width, as it does today.
- **Zero sellers:** the zero-seller state (spot art, "No sellers
  yet" paragraph, `WaitlistBlock`) renders in the RIGHT column,
  where the listings would have gone.
- If the sellers column is taller than the painting it simply
  extends; if shorter, the facts section follows below the
  two-column block as normal.

One acceptable shape (you may implement differently if the rendered
result matches): a wrapper `<div>` around the figure and the buy
section that becomes
`md:grid md:grid-cols-[380px_minmax(0,1fr)] md:items-start md:gap-8`
when a hero image exists, and stays a plain block otherwise. Both
children already carry `mt-6`, which aligns their tops in the grid
and preserves today's stacked spacing on mobile.

## Preserve exactly

- DOM/reading order: header → About → painting → Where to buy →
  facts → sowing → report link → siblings.
- The `aria-live="polite"` listing-count behaviour
  (`#variety-listing-count`), the seller filter chips (links,
  `aria-current`, `scroll={false}`), `<ResultsScrollClamp>` and its
  target/region ids, the small-farm legend, and the Quiet Ledger
  sorting of listings.
- Both ISR variants of the page (plain and `small-farms`) — they
  share this component; both get the new layout.
- JSON-LD output (`JsonLd`, `varietySellersJsonLd`), `ViewBeacon`,
  metadata — untouched.
- **No copy changes anywhere. No image changes. No changes to
  `ListingRow`, `WaitlistBlock`, or any other component's internals.**
  Expect the diff to be essentially confined to
  `app/variety/[slug]/variety-view.tsx`.

## Scope limits

- No refactors, no formatting sweeps, no dependency changes,
  nothing in the legacy root `app/`, nothing under `app/admin` or
  any admin route (a separate project owns those).
- Do not weaken, skip, or delete existing tests.

## Done means

1. `npm run verify` passes in full in `v2/`.
2. If the test suite has a workable pattern for asserting page
   structure/order (look at `v2/tests/` first — e.g. the component
   tests), add or extend a test pinning the new order (About before
   the buy section; buy section beside the hero at `md`). If no such
   pattern exists, say so in your summary rather than inventing a
   fragile one.
3. Your final summary states: the exact DOM order after the change,
   how the no-image and zero-seller cases are handled, and the
   files changed.
