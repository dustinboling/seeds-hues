# Preview visual fix — REPAIR: filter-strip root overflow (Quinn gate F1)

Repair dispatch for PR #84 ("Preview visual fix — tab bar port, preflight
parity, missing component CSS"). This run starts from PR #84's branch
(`start_from: muse/45751502048`); its tree is the starting tree. All work
is in `app/` only. No `v2/` changes, no D1 changes, no copy changes, no
behavior changes beyond what is listed.

Quinn's gate on PR #84 (record `QUINN-GATE-spa-preview-visual-fix.md` on
main) returned FAIL on one in-scope Major. Everything else in the PR
passed rendered: the tab bar is a faithful v2 port, preflight parity
holds, filters render as styled chip strips, the CSS-coverage accounting
reproduced at 0 unstyled classes, and both new tests were proven to
discriminate (16 failed / 1 passed on the pre-fix tree). Do not redo any
of that work; this repair is scoped to the single failing criterion.

## F1 — the defect

The brief's headline acceptance criterion — rendered at 390×844 and
1280×900, every route measures zero horizontal overflow
(`document.documentElement.scrollWidth == clientWidth`) — still fails on
every route that carries a filter strip, at both viewports. Measured by
Quinn's rendered sweep (Chromium, DOM CSS pixels, scroll position 0;
the other 28 of 36 route×viewport combinations measure 0):

| Route | Phone 390×844 | Desktop 1280×900 |
|---|---|---|
| `/variety` | +1255 | +429 |
| `/crop/snapdragon` | +915 | +89 |
| `/seller/geoseed` | +5603 | +4777 |
| `/search?q=zinnia` | +1148 | +322 |

This is real root scrollability (a probe `scrollTo(500)` lands at
`scrollX=500`), not a metric artifact.

**Mechanism, pinpointed by Quinn's live mutation probes on `/variety`
(each from a fresh reload) — start from this evidence:**

- Every beyond-viewport element on `/variety`, `/search`, and
  `/crop/snapdragon` sits inside a `.filter-strip-list` scroll container
  (`overflow-x: auto`) — there are no unclipped offenders — yet the root
  still inflates.
- Setting `overflow-x: hidden` on `.filter-strip` (the wrapper) collapses
  document scrollWidth 1645 → 390.
- Setting the list's `display` from flex to block also collapses it
  to 390.
- Setting `overflow-x: hidden` on the list itself changes nothing.

So: the flex strip scroller's scrollable overflow propagates to the root
in Chromium despite the intermediate scroll container; the containment
the design intends (strip scrolls, page does not) is not achieved.

**One independent contributor on the shop:** on `/seller/geoseed`,
`a.shop-card-visit` rects reach right=393 at the 390 viewport (3px
unclipped). It is subsumed in the shop's figure above but is NOT the
strip mechanism — after the strip fix the shop must still measure
exactly 0, so cure this too.

## The fix

Achieve real containment of the strip's scrollable overflow at the root,
on all four strip-carrying surfaces (browse index, crop detail, shop,
search), at both viewports — **without breaking the strip itself**:

- The strip must remain horizontally swipeable/scrollable exactly as v2
  renders it: its content overflows the strip's own box, the strip
  scrolls internally, and its scroll buttons/fades keep working.
  A "fix" that clips the strip's content, wraps it, or stops it
  scrolling is a v2-parity failure, not a fix.
- No visual redesign: rendered strip appearance (chips, counts, fades,
  chevrons) stays as PR #84 shipped it and as v2 renders today.
- Any component whose geometry shifts as fallout gets corrected to its
  v2-rendered geometry, and is named in the PR summary.

## Tests first (discriminating)

Write the guard BEFORE the fix and state its starting-red result in the
PR summary. jsdom has no layout engine, so the guard is structural: a
test that asserts the containment declarations your fix relies on are
present in the shipped CSS for the strip chain (wrapper / list / strip
ancestors as your fix defines them) — it must fail on this run's starting
tree (PR #84's tree, which has no such containment) and pass on yours.
Keep every existing suite green (`npm run verify` in `app/`, and the
root verify chain), including the tab-bar and CSS-coverage tests from
PR #84.

## Acceptance (Quinn's re-gate will prove these rendered)

- Full 36-combination sweep re-run (18 routes × 390×844 + 1280×900):
  **every** combination measures scrollWidth == clientWidth — not only
  the four strip routes; containment fixes routinely move overflow to a
  neighbor, and the re-gate checks the whole board.
- On each strip route, the strip still scrolls internally (its
  scrollWidth exceeds its clientWidth and its scrollLeft can advance),
  with chevrons/fades intact.
- The PR summary states: the new guard's starting-red result, the
  containment mechanism you shipped (which elements/declarations, and
  why it holds), any fallout corrections, and confirmation that the
  unstyled-class accounting still stands at 0.

## Out of scope — do not touch

- **F2 (Critical, pre-existing, separate lane item):** in a real
  browser, tapping a filter chip does not filter — the client-navigation
  `pageContext.json` response returns unfiltered totals while SSR of
  the same URL is correct. It is Slice 4-era data-path code, not this
  PR's diff and not this repair. Its fix is briefed separately
  (`muse-tasks/spa-browse-client-filter-fix.md`, held for its own
  dispatch). Do not change browse data hooks, `+data.ts`, or the serve
  layer in this repair.
- The tab bar, preflight rules, and all other PR #84 work except where
  the strip containment or the shop-card 3px contributor touches them.
