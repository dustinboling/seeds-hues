# Task: Make the variety page's seller filter update in place

You are working in the `seeds-hues` repository (the Seed Directory,
seeds.hues.flowers). This prompt is self-contained — do not assume any
other context.

## Orientation

- The live app is the **Next.js app in `v2/`** (Next 16, React 19,
  deployed with @opennextjs/cloudflare). Run all commands from `v2/`.
- The repository root also contains an `app/` directory — that is a
  **legacy static site**. Ignore it completely.
- Read `v2/AGENTS.md` first. Per its rule, before writing code read the
  relevant Next.js guides in `v2/node_modules/next/dist/docs/` for the
  pieces you touch (client components, `next/link` click handling, and
  any History/popstate handling you use). Do not work from memory of an
  older Next.js.
- The repo's verification is, from `v2/`:

  ```
  npm run verify
  ```

  That runs lint + typecheck + the vitest suite (`v2/tests/`).
  Dependencies are already installed (`npm ci` was run in `v2/`
  before you started).

## Owner direction (the reason for this task)

Dustin, the site owner, used a variety detail page on his phone,
tapped **“Small farms only”**, and the page behaved like a full-page
reload. His ruling, verbatim in substance:

- That is bad user experience.
- Change it.
- Local filtering must feel like a dynamic single-page app: it must
  **update in place**.

This is an interaction fix, not a redesign and not a copy change.

## Current implementation (inspect before changing)

- `v2/app/variety/[slug]/variety-view.tsx` — the shared variety detail
  view. Its `SellerFilterChips` renders Next `Link`s to
  `/variety/{slug}` and `/variety/{slug}?small_farm=true`.
- `v2/app/variety/[slug]/page.tsx` renders the all-sellers view;
  `v2/app/variety/[slug]/small-farms/page.tsx` renders the filtered
  view. `v2/middleware.ts` rewrites `?small_farm=true` onto the
  internal small-farms path so each first-load view has its own ISR
  cache entry.
- `v2/lib/small-farm.ts` — `sellerFilterView()` already computes the
  shown set, the count line, and whether the control/legend show.
- The listings for the variety are **already loaded** by the page.
  Nothing about this filter needs new data from the server after the
  page has loaded.

## Required outcome

After the page has loaded and hydrated, tapping **All sellers** or
**Small farms only** on a variety detail page must:

1. Update the visible listing cards **in place** — no document reload,
   no Next router navigation to the sibling route, no page-level
   loading skeleton, no repaint of the whole page.
2. Update, in the same in-place change: the active chip state, the
   listing count line, the small-farm legend's visibility, and the
   empty state if it applies.
3. Keep the visitor exactly where they are: **scroll position does
   not move and focus stays on the tapped control** (the control must
   not unmount/remount on toggle).
4. Preserve the current Quiet Ledger ordering inside the shown set
   (in-stock first, sold-out last, stable within groups) and the exact
   current card rendering — this task changes interaction, not cards.
5. Keep the address shareable: the URL gains/loses
   `?small_farm=true` via the History API (no router navigation), and
   the browser Back/Forward buttons move between the two filter
   states **in place** (listen for `popstate` and re-sync).
6. Not fire another variety page-view beacon for a filter toggle.

## What must NOT change

- **First load stays server-rendered.** A direct visit to
  `/variety/{slug}` renders all sellers; a direct visit or shared link
  to `/variety/{slug}?small_farm=true` still renders the filtered
  view from the server, with its current canonical/noindex treatment.
  Keep the middleware rewrite and the small-farms sibling route (and
  the revalidation expansion in `v2/lib/api/revalidate.ts`) working —
  they exist for first load and cache separation, not for the
  hydrated toggle.
- **Progressive enhancement:** the server-rendered control remains a
  real link to the same public URLs, so the filter still works with
  JavaScript disabled or before hydration. Once hydrated, clicks are
  intercepted and handled locally. Do not ship a control that is dead
  without JS. (Check the current Next docs for how `Link` treats a
  click handler that prevents default, and disable prefetch on these
  chips if prefetching the other variant would waste or confuse the
  in-place behavior.)
- No label or copy changes. The chip keeps its current label from
  `SMALL_FARM_CHIP_LABEL`; the count-line wording stays exactly as
  `sellerFilterView()` produces it.
- No changes to the browse filters on `/variety`, crop pages, or any
  other surface. No seller/badge data changes. No card redesign.
- Do not weaken, skip, or delete existing tests.

## Implementation shape (expected, not a straitjacket)

- Extract the sellers section's interactive part (chips + count line
  + legend + listing list + empty state) into a client component that
  receives the variety's full listing set and the initial filter state
  from the server component, derives the shown set with the existing
  `sellerFilterView()` logic, and holds the filter in local state
  initialised from the server-rendered state (no hydration mismatch).
- If `ListingRow` cannot be rendered from a client component as-is,
  solve that narrowly (it is presentational; check its imports) rather
  than redesigning it.
- The existing `ResultsScrollClamp` exists to repair scroll after a
  navigation. An in-place toggle performs no navigation and must not
  scroll at all — do not let a clamp fire for this control.

## Done means

1. `npm run verify` passes in full in `v2/`.
2. There is test evidence in the repo covering the new behavior,
   following the suite's existing patterns: at minimum that the shown
   set/count derive correctly for both states from one loaded listing
   set, and that the toggle path does not depend on a router
   navigation (component test if the suite's tooling allows; otherwise
   the strongest evidence the existing patterns support — say which
   you used and why).
3. Your final summary states plainly: what the tap did before, what it
   does now, how first-load/direct-link behavior is preserved, and how
   you proved no navigation/reload occurs on toggle.
