# Task: Add the filter-update motion to the variety-page seller filter

You are working in the `seeds-hues` repository (the Seed Directory,
seeds.hues.flowers). This prompt is self-contained — do not assume any
other context.

## Orientation

- The live app is the **Next.js app in `v2/`** (Next 16, React 19,
  deployed with @opennextjs/cloudflare). Run all commands from `v2/`.
  Note `v2/AGENTS.md`: this Next.js version has breaking changes —
  read the relevant guide in `node_modules/next/dist/docs/` before
  writing code if you touch anything unfamiliar.
- The repository root also contains an `app/` directory — that is a
  **legacy static site**. Ignore it completely.
- The repo's verification is, from `v2/`:

  ```
  npm run verify
  ```

  That runs lint + typecheck + the vitest suite (`v2/tests/`).
  Dependencies are already installed (`npm ci` was run in `v2/`
  before you started).
- **Hard requirement: `npm run verify` must be fully green before
  your turn may end.** Run it yourself, in full, after your edits —
  targeted checks per edited file as you go, and the full suite at
  the end. If it is not green, fix the cause; do not finish with a
  red gate.

## Background

The variety-page seller filter (All sellers / Small farms only)
already updates **in place** — shipped 2026-11-20 (PR #8, Quinn gate
PASS WITH NOTES): local state, `history.pushState`, no reload, no
scroll/focus movement, a persistent `aria-live` count line. It works,
but the change is easy to miss: the rows simply appear different.

Dustin's direction, verbatim: **"add some visual animation so it's
noticeable that the list updated."**

The motion treatment has been designed by Mina, the UI Design
specialist. **Her specification is reproduced verbatim below and is
binding: implement it exactly. Any deviation returns to Mina — do
not improvise a different treatment, different values, or a
different mechanism.** The spec's source file is
`design-queue/filter-update-motion-spec.md` in this repo.

The component is `v2/components/variety/SellerFilterSection.tsx`;
the styles live in `v2/app/globals.css`. The relevant existing tests
are `v2/tests/unit/variety-seller-filter.test.ts` and
`v2/tests/unit/listing-row.test.ts`.

## Acceptance constraints (from the commission — all must hold)

(a) **Noticeable** — a visitor must SEE that the list changed, not
    just read the new count.
(b) **No layout shift; no scroll or focus disturbance** — only
    `opacity`/`transform` animate; no height/margin/padding/gap
    animation; no `min-height` added anywhere.
(c) **Total motion ≲ 400 ms** — the spec's budget is 340 ms.
(d) **Fires ONLY on filter change** — never on first load, SSR,
    hydration, or fresh navigation to either URL.
(e) **Both directions and the empty state** — All → Small farms,
    Small farms → All, into the filtered-empty state, and out of it.
(f) **`prefers-reduced-motion`: animation removed entirely** (Ada's
    floor, non-negotiable) — the spec's explicit `animation: none`
    block, not reliance on the existing global rule (see spec §7 for
    why the global rule alone is insufficient).
(g) **Nadia's shipped interaction semantics stay untouched** — chips,
    count line, live region, legend, focus handoff, history
    behaviour, `ListingRow` itself: all exactly as shipped.

---

## MINA'S SPECIFICATION (verbatim — binding)

# Filter-Update Motion Spec — Variety Page Seller Filter

**Author:** Mina, UI Design specialist · **Commissioned by:** Hue (lead) · **Date:** 2026-11-20
**Surface:** Seed Directory variety pages (`seeds.hues.flowers`), `SellerFilterSection` in `v2/components/variety/SellerFilterSection.tsx`
**Direction (Dustin, verbatim):** "add some visual animation so it's noticeable that the list updated."
**Status:** Specification only. Nothing in this document is built or shipped. Implement verbatim; any deviation returns to Mina.

---

## 1. The treatment in one paragraph

On a filter change only, the newly shown seller cards **cascade in**: each card fades from transparent while rising 6 px into place, one card every 30 ms from the top, each card's own movement lasting 220 ms, the whole cascade finished within **340 ms**. The swap itself is instant — the old set is gone and the new set is at its final layout height in the first frame — so the animation is pure feedback drawn *over* the final layout, never a height or reflow animation. There is no exit animation (see §4 for why, and what replaces it). Under `prefers-reduced-motion` there is no animation at all: the swap is instant, exactly as it ships today.

## 2. What animates, and what explicitly does not

### Animates

| Element | How |
|---|---|
| Each entering listing row — the `<li>` wrapping `ListingRow` inside `#variety-listings > ul` | `listing-item-in` keyframes: opacity + translateY, staggered per row (§3) |
| The filtered-empty paragraph (`<p data-testid="variety-small-farm-empty">`) when it is the incoming content | Same `listing-item-in` keyframes, no stagger (single item, delay 0) |

**Every row in the incoming set animates, including sellers who were already visible before the tap.** This is deliberate and load-bearing: the thing that changed is the *set*, not individual rows. If only newly appearing rows animated, filtering All → Small farms would leave the retained small-farm cards sitting motionless and the change would still be easy to miss — the exact defect this spec exists to fix. The trigger is therefore keyed to the filter state, never to listing identity (§5).

### Does NOT animate

- **The filter chips.** No new motion. Their selected state already renders in the same frame as the tap, with the existing `.chip` 160 ms `ease-out` background/border transition in `globals.css`. Size, shape, and position are unchanged in both states (the control keeps its face).
- **The count line** (`<p id="variety-listing-count">`). No animation, no remount, no markup change. It is the persistent `aria-live="polite"` region; Nadia's semantics for it are untouched, and its text change is already the announced signal. Animating it would add nothing the cascade doesn't already say.
- **The legend** (`SmallFarmLegend`). No animation. It mounts/unmounts instantly if it changes at all (per the gate report, its visibility derives from `badged > 0` in both states, so on most pages it does not change on toggle).
- **The section heading, the chips row layout, and everything above the section.** Untouched.
- **Everything below the section.** It receives no animation. Its position changes exactly once, at the swap commit, to the final position (see §4) — it never moves *during* the animation.
- **`ListingRow` cards themselves.** No animation on the `<article>` or its internals. The motion lives on the `<li>` wrapper in `SellerFilterSection`, so `ListingRow` stays exactly as shipped and the seller-page context (which also renders `ListingRow`) is unaffected.
- **No skeleton, shimmer, spinner, or loading treatment of any kind.** The content is already local; nothing is loading.

## 3. Treatment per element — exact values

### 3.1 Motion tokens (new, added to `globals.css`)

Motion values are tokens, per the design system. Add to the existing `@theme` block in `v2/app/globals.css`, beside `--radius-card` / `--shadow-card`:

```css
--duration-filter-item: 220ms;
--ease-filter-settle: cubic-bezier(0.22, 1, 0.36, 1);
```

- `--duration-filter-item` — one row's fade/rise duration: **220 ms**.
- `--ease-filter-settle` — `cubic-bezier(0.22, 1, 0.36, 1)`: a strong ease-out. Movement is fastest in the first frames (so the change registers immediately) and settles gently into place. Both control-point y-values are ≤ 1, so there is **no overshoot** — no bounce, no spring, nothing playful. This is the calm end of the motion vocabulary, in keeping with the Print Edition surface.

No colour is involved anywhere in this treatment — opacity and transform only — so no colour tokens are used and none are invented. The treatment is automatically safe in forced-colors mode for the same reason.

### 3.2 Keyframes (new, added to `globals.css`)

```css
@keyframes listing-item-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- Property animated: `opacity` 0 → 1 and `transform: translateY(6px)` → `translateY(0)`. Both are compositor properties: they do not trigger layout, do not affect the element's layout box, and cannot move neighbouring or following content.
- Nothing else is animated. Explicitly forbidden in this treatment: `height`, `max-height`, `margin`, `padding`, `gap`, `top`, and `scale` (scale would make card text shimmer/resize — wrong register for this surface).

### 3.3 Entering rows — stagger

Applied to the `<li>` elements of the incoming `<ul>`:

```css
.listing-swap > li {
  animation: listing-item-in var(--duration-filter-item) var(--ease-filter-settle) both;
}
.listing-swap > li:nth-child(2) { animation-delay: 30ms; }
.listing-swap > li:nth-child(3) { animation-delay: 60ms; }
.listing-swap > li:nth-child(4) { animation-delay: 90ms; }
.listing-swap > li:nth-child(5) { animation-delay: 120ms; }
.listing-swap > li:nth-child(n + 6) { animation-delay: 120ms; }
```

- Stagger step: **30 ms** per row, top to bottom (reading order — the eye follows the cascade down the list it is about to read).
- Delay cap: **120 ms**. Rows 6 and beyond all start at 120 ms; long lists do not cascade for seconds.
- `animation-fill-mode: both` (the `both` in the shorthand) is required: during a row's delay it must sit at the `from` state (invisible), not flash at full opacity and then restart.
- **Total motion budget:** last start 120 ms + duration 220 ms = **340 ms end-to-end**, inside the ≲400 ms ceiling with margin. The chips' pre-existing 160 ms colour transition runs concurrently inside the same window; it is not additive.

### 3.4 Leaving rows

**There is no exit animation, by design.** Leaving rows are removed in the same commit in which entering rows mount — an instant swap — and the entering cascade is the feedback. Rationale, in order:

1. The component re-renders the list from state; there is no exit-animation framework, and bolting one on means keeping the old list mounted alongside the new one for the exit's duration.
2. Two mounted lists means two heights. Any arrangement of them (stacked, overlapped, height-animated) either moves surrounding content during the animation or requires animating a container height — both violate the no-layout-shift constraint this feature was built on.
3. An exit-then-enter sequence doubles the time before the new content is readable and breaks the ≲400 ms budget for the *result* to be fully present.
4. Nothing is lost semantically: the visitor's question on tapping a filter is "what does the list look like now?", not "where did the old rows go?" Exits answer the second question. The cascade answers the first, noticeably.

## 4. No layout shift — how the constraint is held

- The swap commits at final height in frame one. When the incoming set is shorter or longer, content below the section moves **once**, at that commit, directly to its final position — this is the unavoidable and already-shipped behaviour of an in-place filter, not an animation effect.
- During the 340 ms animation, **nothing moves in layout at all**: the animated properties (`opacity`, `transform`) are layout-free, the animated elements' boxes are at their final positions from frame one, and the 6 px rise is a visual offset only — a card may visually overlap the 12 px (`gap-3`) row gap above it by up to 6 px at the first frame, shrinking to 0; it never pushes anything.
- No height is reserved, locked, animated, or transitioned on `#variety-listings`, the `<ul>`, or any wrapper. Do not add a `min-height` to the section as part of this work.
- Scroll position and focus are untouched by this spec: no element that can hold focus is inside the animated set at animation time (focus is on the tapped chip, which is outside `#variety-listings` and does not animate), and the one focus handoff — filtered-empty "Show all sellers" → "All sellers" chip — targets a chip **outside** the animated container, so the focus outline never rides the animation. The handoff code is not modified.

## 5. Trigger mechanism — fires only on filter change

CSS animations run when the element carrying them mounts. The mechanism therefore makes the incoming list mount *with* the animation class exactly when — and only when — the filter state changes:

**Component changes to `SellerFilterSection.tsx` (the only component changes in this spec):**

1. **Key the swapping elements by filter state.** Both elements are created directly in this component's JSX, so add to each of the `<ul>` and the filtered-empty `<p>`:
   - `key={smallFarmOnly ? "small-farms" : "all"}` — the key change forces React to remount the incoming element on every filter-state change, even when the element type is the same (`<ul>` → `<ul>`), which is what makes retained rows animate too (§2).
   - A conditional class: append `listing-swap` to the element's class list **only when `filterTouched` is true**:
     - `<ul>`: `className={`mt-3 flex flex-col gap-3${filterTouched ? " listing-swap" : ""}`}`
     - empty `<p>`: `className={`mt-3 text-muted${filterTouched ? " listing-swap" : ""}`}`
   - `#variety-listings` itself gets **no** key and **no** class change: it never remounts, preserving its identity exactly as shipped.
2. **Set `filterTouched` on Back/Forward.** In the existing `popstate` callback, add `setFilterTouched(true);` alongside the existing `setSmallFarmOnly(...)`. Both setStates live in the same event callback (the sanctioned pattern this component already documents) and batch into one commit, so the key change and the class arrive together. Without this line, a Back/Forward filter change after a fresh load would swap silently; with it, popstate-driven changes animate identically to chip taps. (Side effect, accepted and consistent with the gate's note N3: on a B = 0 variety, if a history traversal lands the visitor in the unfiltered state, the chips may now appear post-traversal — the same deliberate post-interaction divergence the shipped `filterTouched` logic already creates for the "Show all sellers" action.)

**No other component changes.** No new state, no timers, no effects, no refs, no `requestAnimationFrame`, no changes to `select()`, `showAllInPlace()`, the focus-handoff effect, the chips, the count line, or the legend. `filterTouched` already exists, is already set by `select()` in the same commit as `setSmallFarmOnly`, and starts `false` — it is the exact "has the visitor changed the filter in this page view" flag this mechanism needs.

**Why this satisfies "only on filter change":**

- **First load / SSR:** `filterTouched` is `false`; neither element carries `listing-swap`; nothing animates. Server markup gains no classes (the conditional appends nothing), so first-paint HTML is unchanged.
- **Hydration:** the hydration pass replays the server snapshot and `filterTouched` initialises identically on server and client — no class appears, nothing animates. The links→buttons chip swap is outside `#variety-listings` and is unaffected.
- **Page navigation:** a fresh page view is a fresh mount with `filterTouched = false`. No animation.
- **Chip tap (either direction) and empty-state "Show all sellers":** `select()` sets `filterTouched` and the new state in one commit; the incoming element remounts under the new key carrying `listing-swap`; the cascade runs once.
- **Back/Forward:** per change 2 above, same behaviour.
- **Re-renders without a filter change** (none are expected, but by construction): same key + same class = no remount, and a CSS animation does not restart on a re-render of an already-mounted element. The cascade cannot re-fire spuriously.
- **Identical-content edge case (B = N, every seller badged):** the shown set is the same in both states, but the key still changes, so the cascade still fires. Correct: the filter *was* applied, and the visitor gets confirmation of that even when the result happens to look the same.

## 6. The empty state, both directions

The filtered-empty `<p data-testid="variety-small-farm-empty">` is a first-class participant, animated with the identical treatment:

- **Into empty (All → Small farms, B = 0 result):** the `<ul>` unmounts instantly; the empty paragraph mounts carrying `listing-swap` and runs `listing-item-in` — opacity 0 → 1, translateY(6 px) → 0, 220 ms, `--ease-filter-settle`, delay 0. CSS:
  ```css
  p.listing-swap {
    animation: listing-item-in var(--duration-filter-item) var(--ease-filter-settle) both;
  }
  ```
  The "Show all sellers" action inside it is present and clickable from frame one (opacity/transform animation never disables hit-testing, and the button is not the focus target in this direction — focus is on the chip).
- **Out of empty ("Show all sellers" or the All sellers chip):** the paragraph unmounts instantly (no exit, per §3.4); the `<ul>` mounts under its key carrying `listing-swap` and the full row cascade of §3.3 runs. The focus handoff to the "All sellers" chip proceeds exactly as shipped, on an element outside the animated container (§4).

## 7. Reduced motion — exact treatment

Ada's floor, non-negotiable, and stricter here than the minimum:

- Under `@media (prefers-reduced-motion: reduce)`, the animation is **removed entirely** — not shortened, not faded down. The swap is instant, pixel-identical to today's shipped behaviour. No crossfade substitute: a crossfade is still a fade the user asked not to have, and the instant swap is already fully usable (chip state + count line carry the change).
- Implementation — add this block to `globals.css` in the components layer, immediately after the `.listing-swap` rules:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .listing-swap > li,
    p.listing-swap {
      animation: none;
    }
  }
  ```
- **Why an explicit block is required (do not rely on the existing global rule alone):** the base layer's existing reduced-motion rule collapses `animation-duration` to `0.01ms !important` but does **not** touch `animation-delay`. With the stagger in place, a reduced-motion visitor would otherwise get rows held at opacity 0 by fill-mode for up to 120 ms and then snapped in one by one — a staggered blink, the worst of both worlds. `animation: none` removes the animation, the delays, and the fill state together, so every row is at full opacity in the swap frame.
- Transform and opacity end-states are the elements' natural styles, so with the animation removed there is no residual offset or transparency to clean up.

## 8. Complete `globals.css` additions (for the build brief)

Two edits, nothing else in the file changes:

1. In `@theme`, after `--shadow-card`:
   ```css
   --duration-filter-item: 220ms;
   --ease-filter-settle: cubic-bezier(0.22, 1, 0.36, 1);
   ```
2. In `@layer components`, after the `.skeleton` / `.skeleton-delayed` block (motion code stays together):
   ```css
   /*
    * Filter-update cascade (Mina spec 2026-11-20): on an in-place seller-filter change the
    * incoming rows fade/rise in with a capped 30 ms stagger — feedback that the list changed,
    * drawn over the final layout (opacity/transform only, never height). The class is applied
    * by SellerFilterSection only after a visitor-initiated filter change, never on first load.
    * Total: 120 ms max delay + 220 ms duration = 340 ms.
    */
   @keyframes listing-item-in {
     from {
       opacity: 0;
       transform: translateY(6px);
     }
     to {
       opacity: 1;
       transform: translateY(0);
     }
   }
   .listing-swap > li {
     animation: listing-item-in var(--duration-filter-item) var(--ease-filter-settle) both;
   }
   .listing-swap > li:nth-child(2) { animation-delay: 30ms; }
   .listing-swap > li:nth-child(3) { animation-delay: 60ms; }
   .listing-swap > li:nth-child(4) { animation-delay: 90ms; }
   .listing-swap > li:nth-child(5) { animation-delay: 120ms; }
   .listing-swap > li:nth-child(n + 6) { animation-delay: 120ms; }
   p.listing-swap {
     animation: listing-item-in var(--duration-filter-item) var(--ease-filter-settle) both;
   }
   @media (prefers-reduced-motion: reduce) {
     .listing-swap > li,
     p.listing-swap {
       animation: none;
     }
   }
   ```

**Test-suite note for the engineer:** existing source-assertion tests pin aspects of `SellerFilterSection` (per Quinn gate N2, some are deliberate pattern guards). The `key` and conditional-class additions, and the one added line in the `popstate` callback, may require those assertions to be re-pointed; no test may be deleted, skipped, or weakened to accommodate this change — if an assertion conflicts, surface it rather than loosening it. `npm run verify` must be green.

— Mina, UI Design, 2026-11-20

---

## Scope

- **Only** the changes the spec names: the two `globals.css` edits in
  spec §8, and the `SellerFilterSection.tsx` changes in spec §5
  (key + conditional `listing-swap` class on the `<ul>` and the
  filtered-empty `<p>`; one added `setFilterTouched(true);` line in
  the `popstate` callback).
- Tests: extend the existing filter tests to cover the new behaviour
  in the suite's established style (static-markup/source assertions —
  the suite runs in a node environment; see how
  `variety-seller-filter.test.ts` already works). At minimum, cover:
  server/first-load markup carries NO `listing-swap` class; the
  `globals.css` additions exist with the spec's exact values (tokens,
  keyframes, stagger delays, the reduced-motion `animation: none`
  block).
- **No other changes**: no changes to `ListingRow`, the chips, the
  count line, the legend, `small-farm.ts`, middleware, routes, or
  revalidation. No refactors, no formatting sweeps, no dependency
  changes, nothing in the legacy root `app/`.
- Do not weaken, skip, or delete existing tests (spec §8 note).

## Done means

1. `npm run verify` passes in full in `v2/` — run by you, green,
   before your turn ends.
2. The implementation matches Mina's spec **verbatim**: token names
   and values, keyframes, stagger steps and cap, fill mode, the
   reduced-motion block, the keyed remount, the conditional class,
   and the one added `popstate` line — nothing more, nothing less.
3. New/updated tests cover the behaviour listed under Scope, in the
   suite's existing style, with no existing test weakened.
4. Your final summary states: what you changed file by file; how you
   confirmed first-load markup is unchanged (no `listing-swap` in
   server-rendered markup); and the verify result.
