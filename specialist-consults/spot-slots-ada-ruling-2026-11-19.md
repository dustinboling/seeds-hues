# Spot Painting Slots — Accessibility Ruling (Ada, Accessibility Specialist)
### Seed Directory (seeds.hues.flowers) · 2026-11-19 · Ruling on Nadia's flags, spec §6

**Scope and basis.** Nadia's slot spec `spot-slots-nadia-2026-11-19.md` (§§3–6,
with §§1–2 for the audited precedent), and the stable code only:
`components/ui/ThemeArt.tsx` and `app/globals.css` (`.container-page`,
`.art-frame`, tokens, forced-colors blocks, `:focus-visible`). Per the brief,
no conclusion here rests on a mid-edit read of the two `page.tsx` files — the
bench is building in parallel. Floor: WCAG 2.2 AA. This is an engineering
ruling on classification and construction, not certification — neither site
is formally certified, and this ruling does not claim it.

**Slots ruled on**

- `farm-gate` (880×1100, 4:5) — head of `/add-your-farm`, in `page.tsx`
  outside the form component; persists across form and success states.
- `account-organizer` (880×1100, 4:5) — head of `/account`, signed-out
  render only (persists through code-entry/error sub-states and the
  `?deleted=1` landing; absent, with no space reserved, on the signed-in
  `AccountPanel`).

Both render only via `ThemeArt` (entries already in the `ART` table at
880×1100, `wide: null`), inside `.art-frame`, on the paper ground outside all
cards/forms, no caption, no overlaid text. Display: `w-full` under a 280px
cap centred on mobile (280×350), 320×400 in the right cell of the desktop
head grid `md:grid-cols-[1fr_320px]`.

---

## Flag 1 — Decorative alt classification (`alt=""` via ThemeArt)

**Ruling: CONFIRMED — decorative is correct for both paintings.**

Measured facts / construction:

- `ThemeArt.tsx` hardcodes `alt=""` on a plain `<img>` inside `<picture>`:
  no `role`, no `title`, no `tabindex`, not wrapped in a link or control.
  An image with an empty alt is removed from the accessibility tree —
  screen readers skip it entirely. That is the correct implementation of
  the decorative treatment under **WCAG 2.2 SC 1.1.1 (Non-text Content)**,
  which requires images that are pure decoration to be implemented so
  assistive technology can ignore them.
- Neither painting carries information that exists nowhere else, which is
  the test that decides this classification:
  - *Farm-gate:* a bucket of cut flowers and a stack of the farm's own seed
    packets on a gate-side table, morning light. By spec there is **no
    signage lettering** and the packet labels carry no readable text. The
    page's actual content — what the page is, who it is for, how to be
    listed — is carried in full by the H1 (`#farm-title`) and the intro
    paragraph that precede the painting in reading order (§4).
  - *Account-organizer:* an open seed-packet organiser / garden journal
    with **blank labels** and a pencil. It suggests orderliness and the
    seed-keeping theme; it states nothing. The H1 (`#account-title`) and
    intro (§5) carry the create-an-account / sign-in content in full.
- Both paintings are invitation/mood only — Elena's stated job for them —
  and a descriptive alt would restate the adjacent heading and intro for
  screen-reader users, adding announcement noise and no information. Nadia's
  §6 reasoning on this point is correct.
- Supporting criteria, all satisfied by the spec as written: no text is
  baked into either image, so **SC 1.4.5 (Images of Text)** is not engaged;
  neither image is functional, a CAPTCHA, a complex graphic, or a link, so
  none of the 1.1.1 exceptions to the decorative treatment apply. The
  signed-in absence of the organiser painting raises no issue under this
  flag: a decorative element owes no equivalent in any state, and reserving
  space for it on `AccountPanel` would be worse, not better.

Condition of the ruling (construction, not a reservation): the bench must
not wrap either painting in a link, add a caption/title, or let any lettering
appear in the final artwork. Any of those voids this ruling and requires a
fresh consult.

## Flag 2 — `.art-frame` hairline below 3:1

**Ruling: CONFIRMED — the existing decorative-edge classification covers
both new slots.**

Measured fact, computed from relative luminance (WCAG formula, unrounded):

- `--color-line` **#E0D5B8 on paper #F8F1E1 = 1.30:1** (1.2977:1). That is
  below the 3:1 threshold — the number is not in dispute and is not rounded
  into anything.

Why the 3:1 threshold does not apply here:

- **SC 1.4.11 (Non-text Contrast)** requires 3:1 only for (a) visual
  information needed to identify a user-interface component and its states,
  and (b) parts of graphics **required to understand the content**. The
  `.art-frame` hairline (`.art-frame` in `globals.css`: 1px solid
  `var(--color-line)`, 18px radius, paper background, no shadow) is neither:
  - It identifies no component. The paintings are non-interactive (Flag 5);
    nothing can be clicked, selected, or mistaken for a control because of
    this edge, and no state is ever shown by it.
  - It is not required to understand anything. Both paintings are decorative
    (Flag 1) and are painted to the edge of the same #F8F1E1 paper ground
    the page sits on — delete the hairline and no information, boundary of
    content, or meaning is lost; the plate simply blends into the paper,
    which is the theme's intended effect.
- Parity is exact, not approximate: same class, same token, same ground,
  same non-essential role as `farms-basket`, `about-data`, the hero, and
  the portrait empty/offline spots. Nothing about either new painting is
  essential content, and neither slot gives the frame a new job (it does
  not separate a form from the page, delimit a card, or mark the success
  state — the farm-gate slot sits in the page head, outside the form, in
  both states). The accepted treatment therefore transfers in full.

No fix is required or proposed. For the record: were this edge ever given
an essential job, the nearest passing value already exists in the token
set — `--color-line-strong` #97865F, 3.2:1 on paper — and that substitution,
not a redesign, would be this seat's fix. It is **not** to be applied here:
darkening a decorative edge to satisfy a criterion that does not govern it
would change the design for no accessibility gain.

## Flag 3 — 320px reflow and 200% resize

**Ruling: CONFIRMED WITH MEASUREMENT OWED — the spec and the stable CSS
yield no horizontal scroll and no overlap by construction; the built pages
must still be measured at Quinn's gate and on the live deploy.**

Construction evidence (spec §3 + `globals.css`):

- **320 CSS px viewport (SC 1.4.10 Reflow).** `.container-page` is
  `width: 100%`, `max-width: 72rem`, `padding-inline: max(1rem, …)` per
  side → content width at 320px is 320 − 32 = **288px**. The article
  (`max-w-3xl`) imposes no minimum width. The spot is `w-full` under
  `max-w-[280px]`: it renders **280px wide — inside the 288px content box
  with room to spare** — and `h-auto` with the reserved 880×1100
  width/height attributes holds the 4:5 ratio, giving 350px tall. Below a
  ~312px viewport the cap stops binding and `w-full` shrinks the painting
  with the article, height scaling proportionally. There is no fixed-width
  element, no minimum width, and no two-dimensional layout anywhere in the
  slot at this width.
- **Desktop grid cannot leak into small widths.** The two-column head
  exists only at `md:` (≥768 CSS px). At the 768px article cap it resolves
  exactly: 320px art cell + 32px gap + **416px text column** = 768px — it
  fits its container by arithmetic, and below the breakpoint the layout is
  a single stacked column in reading order.
- **200% text resize (SC 1.4.4 Resize Text).** The slot contains no
  fixed-height text container: the H1 and intro sit in a fluid `1fr` /
  full-width column and wrap as text grows; the painting's box is sized in
  CSS pixels with `h-auto`, sits in normal flow (mobile) or its own grid
  cell (desktop), and is not positioned over or beside-with-overlap any
  text. Enlarged text therefore reflows around a slot that does not move
  into it — no clipping, no overlap, no loss by construction. (Full-page
  zoom reduces the CSS-pixel viewport, which returns the layout to the
  320px case above, including dropping the `md:` grid.)
- `.art-frame`'s `overflow: hidden` clips only the painting to its own
  rounded corners; it does not clip page content and creates no scroll
  container.

**Measurement owed — stated explicitly, this ruling does not substitute
for it:** on the built pages, at Quinn's gate and again on the live deploy,
per spec §7.4 —

1. DOM-rect measurement of the rendered `<img>` on **both axes** at 320px,
   375px and 390px viewports (expect ≤280×350, scaling down below 312px)
   and at desktop (320×400), on both pages and in the `/add-your-farm`
   success state;
2. a no-horizontal-scroll check (`scrollWidth` vs viewport) at 320 CSS px
   and at the 400%-zoom equivalent, both pages;
3. a 200% text-resize pass confirming no overlap or clipped head text.

If any of those measurements contradicts the construction above, the defect
is a build defect against this spec, and it comes back to this seat with the
numbers before the pages ship.

## Flag 4 — Forced-colors parity

**Ruling: CONFIRMED — parity with the existing theme paintings is
acceptable; no special forced-colors handling is required or wanted for
these two spots.**

Facts:

- The site's existing forced-colors treatment in `globals.css` is exactly
  two suppressions under `@media (forced-colors: active)`: the paper-grain
  layer (`body::before`) and the packet keyline (`.packet::after`). Theme
  paintings have no forced-colors rules, and the new spots add none — parity
  is literal.
- Parity is safe here for a structural reason, not by habit: **nothing in
  either slot depends on author colors surviving.** The paintings are
  decorative (Flag 1), carry no text, no state, and no information; the
  frame is a decorative edge (Flag 2). In forced-colors mode the operating
  system remaps author colors and strips backgrounds/shadows — the site
  already survives that by carrying boundaries and focus in real borders
  and outlines (`:focus-visible` is a 3px solid outline, untouched by this
  work). A painting that renders recolored, flattened, or (in some user
  configurations) not at all takes nothing with it: heading, intro, and
  forms are real text and controls outside the image and are unaffected.
- **Do not** add `forced-color-adjust: none` to preserve the paintings'
  exact palette. This seat reserves that exemption for true color specimens
  (e.g. swatches) whose exact color *is* the content. A decorative
  painting does not qualify, and claiming the exemption would assert an
  essentialness Flags 1–2 have just ruled out.

One routine verification, not a condition: Quinn's gate should include a
forced-colors view of both built pages, as it should for any page — the
expected result is the head text and forms fully legible with the painting
present-but-remapped, and any surprise comes back to this seat.

## Plus — Focus order on both pages

**Ruling: CONFIRMED — focus order is unchanged on both pages, by
construction.**

- `ThemeArt` renders a plain `<img alt="">`: not a link, not a button, no
  `tabindex`, no `role`. It is **not focusable and never enters the tab
  sequence** (SC 2.1.1 is not engaged; there is nothing new to operate).
- The slot lives in the page head in `page.tsx`; the form components
  (`AddYourFarmForm`, `CreateAccountForm`, `SignInForm`) and `AccountPanel`
  are untouched per the bench checklist (spec §7.3). Nothing focusable is
  added, removed, or reordered. Tab order remains exactly: …intro links →
  first form field → …, as today.
- Reading/visual order also holds (SC 1.3.2, SC 2.4.3): in source order the
  text cell (H1, intro, note/banner) precedes the painting on both pages;
  on mobile the painting stacks after the intro, and on desktop the grid
  places the first source cell left and the painting right — source order,
  visual order, and reading order agree, and a non-focusable decorative
  image between intro and form interrupts none of them.
- Focus visibility is untouched: the global `:focus-visible` indicator
  (3px solid `--color-focus` #7A3E10, 7.4:1 on paper — more than double the
  3:1 of SC 1.4.11) and the existing `scroll-padding` protection against
  the fixed tab bar (SC 2.4.11) are unchanged, and the in-flow painting
  introduces no sticky or fixed element that could obscure a focused
  control. The `/add-your-farm` success swap and the `/account` sub-state
  swaps happen inside components below the head; the persisting painting
  plays no part in them.

Conditions, as in Flag 1: this ruling holds only while the paintings are
rendered exactly as spec'd — via `ThemeArt`, unwrapped, unfocusable. A
linked or otherwise interactive treatment is a different slot and a new
consult.

---

## Summary

| # | Flag | Ruling |
|---|---|---|
| 1 | Decorative `alt=""` for both paintings | **CONFIRMED** |
| 2 | `.art-frame` hairline, #E0D5B8 on #F8F1E1 = 1.30:1, under SC 1.4.11 | **CONFIRMED** — criterion does not govern a decorative edge on non-essential art; existing classification transfers |
| 3 | 320px reflow / 200% resize | **CONFIRMED WITH MEASUREMENT OWED** — sound by construction from spec + stable CSS; DOM-rect, no-scroll, and 200% checks owed at Quinn's gate and live (list in Flag 3) |
| 4 | Forced-colors parity, no special handling | **CONFIRMED** — and no `forced-color-adjust` exemption |
| + | Focus order, both pages | **CONFIRMED** — unchanged by construction |

No objections. No code changes requested. The only outstanding items are
the Flag 3 measurements (and the routine forced-colors view) at Quinn's
gate / live verification, which were already owed under spec §7.4 — this
ruling adds nothing to the bench's work and removes nothing from it.

*Ada, accessibility specialist. Conformance language: this ruling covers
the five questions above, on the evidence stated. It is not a certification
of either page or of the site.*
