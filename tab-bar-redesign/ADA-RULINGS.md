# Tab Bar Redesign — Accessibility Rulings (Ada, Accessibility Specialist)
### Seed Directory (seeds.hues.flowers) · 2026-11-22 · Rulings on Mina's four flagged items, UI-DESIGN.md §9

**Scope and basis.** Mina's UI visual-form pass (`tab-bar-redesign/UI-DESIGN.md`,
esp. §1.3, §2, §4, §5, §9) and Nadia's constraints register
(`tab-bar-redesign/UX-STRUCTURE.md` §4.2), against the shipped ground truth:
`v2/app/globals.css` token block and `v2/components/layout/TabBar.tsx`
(`bg-paper-deep/92 backdrop-blur`, `border-t border-line-strong`). Floor:
WCAG 2.2 AA. All ratios below were computed by this seat from relative
luminance (WCAG formula), **unrounded**, from the token hex values — no
recorded figure was taken on trust; where a recorded figure exists it is
spot-checked and named. These rulings block the build until their assertions
are met; they do not block Dustin's pick. This is an engineering ruling, not
certification — the site is built to WCAG 2.2 AA, not formally certified.

**Tokens ruled on** (from `globals.css`): `paper` #F8F1E1 · `paper-deep`
#F0E5CB · `ink-soft` #4A4438 · `leaf` #1E4634 · `leaf-50` #E3EAD8 · `petal`
#8E2A52 · `line-strong` #91825C · `focus` #7A3E10.

**Method note for Items 1, 2 and 4 — the translucent ground.** The bar's
ground is `paper-deep` at 92% opacity with backdrop blur over scrolling page
content, so the effective ground is a composite: 0.92 × paper-deep + 0.08 ×
content. The composite is bounded. For the bar's dark foregrounds (`leaf`,
`ink-soft`, `line-strong`), the worst case is the **darkest** possible
content beneath — the composite over pure black, rgb(221, 211, 187). (Light
content raises these ratios: over white the composite gives `leaf` 8.6271:1.)
Backdrop blur averages neighbouring pixels; it cannot push a region darker
than the darkest content in it, so the black-composite figures below are the
floor every real frame sits above. All Item 1/2/4 pairs are ruled at that
bound, not at the solid-token figure.

---

## Item 1 — `leaf` on `paper-deep` at 92% over real page content (active label + glyph)

**Ruling: STANDS — measured by this seat at the worst-case bound; no
measurement is owed before the gate beyond Assertion A1's render sample.**

Measured facts (unrounded):

| Pair | Ratio | Criterion | Floor |
|---|---|---|---|
| `leaf` on solid `paper-deep` (the previously unrecorded pair, now recorded) | **8.4686:1** | SC 1.4.3 (label text, 12px/700 — normal text) | 4.5:1 |
| `leaf` on 92% composite over paper (typical page ground) | 8.5423:1 | SC 1.4.3 / 1.4.11 | 4.5 / 3.0 |
| `leaf` on 92% composite over **black** (absolute worst case) | **7.1028:1** | SC 1.4.3 / 1.4.11 | 4.5 / 3.0 |
| `leaf` on 92% composite over ink #2E2A23 (darkest real page element) | 7.3439:1 | SC 1.4.3 / 1.4.11 | 4.5 / 3.0 |

- The active label is 12px text: SC 1.4.3 binds at 4.5:1. The glyph is a
  meaningful graphic / state carrier: SC 1.4.11 binds at 3:1. The pair
  passes both at every point in the composite's range — the translucency
  can move the ratio only between 7.1028:1 (over black) and 8.6271:1 (over
  white). There is no content the site can scroll under this bar that takes
  the active state below the floor. The treatment may stand as designed.
- For completeness, the inactive pair on the same ground: `ink-soft` on
  solid `paper-deep` = 7.7123:1 (recorded 7.7:1 — honest), worst-case
  composite over black = 6.4684:1. Passes 4.5:1 throughout.
- The active state is not colour-alone in any case (weight 600→700, marker /
  well / ring shape channels, `aria-current`) — SC 1.4.1 satisfied by the
  design as drawn; this ruling covers the contrast question only.

**Build-gate assertion A1.** Quinn's gate samples the *rendered* active
label and glyph over the darkest real content the presentation set contains
(a dark plate photograph scrolled beneath the bar) at 390px and 320px; the
sampled pair must read ≥ 4.5:1. Expected ≈ 7.3:1 or better on real content.
A sample below 4.5:1 is a build defect against this ruling (wrong token,
wrong opacity), not a design question.

---

## Item 2 — White numeral on `petal` (Account alert-count badge, 11px/700)

**Ruling: THE PRIMARY STANDS. The pre-agreed `leaf`-fill fallback does NOT
govern; it is retained as a contingency only (see condition).**

Measured facts (unrounded):

| Pair | Ratio | Criterion | Floor |
|---|---|---|---|
| White on `petal` #8E2A52 (the previously unrecorded pair, now recorded) | **8.0671:1** | SC 1.4.3 (11px/700 numeral — normal text; it is not large text) | 4.5:1 |
| `petal` disc against solid `paper-deep` (badge as non-text indicator) | 6.4441:1 | SC 1.4.11 | 3:1 |
| `petal` disc against 92% composite over black (worst case) | 5.4048:1 | SC 1.4.11 | 3:1 |
| White on `leaf` (the fallback, for the record) | 10.6015:1 | SC 1.4.3 | 4.5:1 — recorded 10.6:1, honest |

- The badge fill is a solid disc; the numeral's ground does not composite
  with page content, so 8.0671:1 is the pair in every frame — it passes
  4.5:1 with 79% headroom. There is no floor basis for displacing the
  primary, and this seat does not trade a passing signal colour for a
  fallback on preference. Petal stands.
- The disc as an indicator against its adjacent ground passes SC 1.4.11 at
  every composite point (worst 5.4048:1).
- The badge is never the only channel (accessible name carries the count —
  "Account, 3 alerts"; the badge itself is `aria-hidden`; the account page
  lists the alerts) — SC 1.4.1 satisfied as designed. The two-digit pill
  growth and "99+" cap change no pair ruled here.

**Condition / contingency.** If the `petal` token value is ever changed,
this ruling is void for the badge and the fallback governs automatically —
`leaf` fill, white numeral (10.6015:1), `petal` as 2px ring (`petal` on
`paper-deep` = 6.4441:1, passes SC 1.4.11 as the ring's pair) — until this
seat re-measures the new petal. No other change triggers the fallback.

**Build-gate assertion A2.** Quinn's gate renders the badge at count 3 and
at two digits on the Account tab in the presentation set and confirms:
numeral legible at 1:1, disc does not cover the label, and the accessible
name announces the count. The forced-colors render of the badge (already on
Mina's §7 list) remains a gate check: in forced-colors the system palette
takes over and the numeral must remain legible against the system badge
ground — a failure there comes back to this seat.

---

## Item 3 — D2's derived pressed-well tint (`leaf-50` + 8% `leaf`)

**Ruling: STANDS WITH CONDITION — both state pairs pass in both possible
derivations; the build must pin the derivation (Assertion A3).**

Measured facts (unrounded). The derived tint depends on the `color-mix`
interpolation space, which Mina's spec does not name — so this seat computed
both. (The codebase's existing `color-mix` uses are `in oklab`.)

| Pair | Ratio | Criterion | Floor |
|---|---|---|---|
| `leaf` on `leaf-50` #E3EAD8 — the **active** well (recorded 8.6:1 — honest) | **8.5957:1** | SC 1.4.3 | 4.5:1 |
| `leaf` on pressed tint, mixed **in srgb** → rgb(211, 221, 203) | **7.5563:1** | SC 1.4.3 | 4.5:1 |
| `leaf` on pressed tint, mixed **in oklab** → rgb(210, 220, 202) | **7.4754:1** | SC 1.4.3 | 4.5:1 |
| `ink-soft` on pressed tint, srgb / oklab (an inactive flank tab being pressed — D1 §2 and D3 use the well on `:active`) | 6.8814 / 6.8077:1 | SC 1.4.3 | 4.5:1 |

- In the pressed state the label and glyph keep ≥ 7.47:1 under either
  derivation — the deepening costs about 1.1 points of ratio and lands far
  above the floor. The derived tint may stand.
- **The well's own edge does not bind, and the record should say why.**
  `leaf-50` against `paper-deep` = 1.0150:1; the pressed tint against
  `paper-deep` = 1.1207:1 — the well's boundary is essentially invisible as
  a contrast step. SC 1.4.11 binds only visual information **required** to
  identify a component or its state. The active state here is identified by
  the `leaf` colour change of glyph + label (itself passing at 8.5957:1
  against the well and 8.4686:1 against the bar ground), the 600→700 weight
  change, and `aria-current`; the well is a redundant region channel beside
  those, so its edge is not required information and the 3:1 floor does not
  attach to it. **Void condition:** if any of those channels is removed in
  build — label colour change, weight change, or `aria-current` — the well
  becomes a sole channel, this paragraph's ruling is void, and the well as
  drawn would fail SC 1.4.11. The channels are therefore not optional
  polish; they are load-bearing for this ruling.

**Build-gate assertion A3.** (a) The build declares the pressed tint as a
named value or an explicit `color-mix(in srgb, …)` / `color-mix(in oklab, …)`
— an unspaced default `color-mix` is not accepted, because the derived
value must be the one this ruling measured. Either space is approved; the
choice is Mina's. (b) Quinn's gate samples the rendered pressed well with
the active label inside it (≥ 4.5:1 expected ≈ 7.5:1) and confirms the
colour + weight + `aria-current` channels are all present in the pressed
and active states.

---

## Item 4 — D1's re-derived clearance, and the active plate ring's boundary status

### 4a. Clearance — `scroll-padding-bottom: calc(5.75rem + env(safe-area-inset-bottom))` (92px) + matching footer clearance

**Ruling: STANDS WITH CONDITION — the derivation is correct and satisfies
SC 2.4.11 with margin; the margin must be proven by driven focus at the
gate (Assertion A4).**

Derivation, checked line by line:

- Total obstruction from the viewport's bottom edge = safe-area inset +
  64px band + 20px plate rise (`tabbar.plate.rise`) = **safe-area + 84px**.
  The plate's `shadow-listing-flat` falls under the disc's lower arc, inside
  the band already counted; it adds nothing above the rise. The disc is the
  highest fixed element in every D1/hybrid frame.
- Contracted clearance = safe-area + 92px ≥ obstruction + **8px**. An
  element scrolled into view under this `scroll-padding` comes to rest with
  its bottom edge at least 8px clear of the plate's highest point.
- SC 2.4.11 (Focus Not Obscured — Minimum, AA) fails only when a focused
  element is **entirely** hidden by author-created content. This contract
  clears the stricter geometry as well: no **part** of a scroll-positioned
  focused element is obscured at the centre column (the 2.4.12 Enhanced
  geometry), and side columns — where the obstruction is only the 64px
  band — clear by 28px. The 92px figure is verified, not merely plausible.
- D2/D3 keep the shipped contract (80px + safe-area against a 64px band —
  16px margin); nothing in this ruling disturbs it.

**Conditions.** (i) The footer mobile clearance must actually rise to match:
footer `padding-bottom` on mobile ≥ 92px + safe-area in the D1/hybrid build
(the current `pb-24` = 96px satisfies this if retained; it must not be
reduced in the redesign). (ii) `scroll-padding` governs elements the
browser scrolls to; it does not rescue an element that receives focus while
already positioned under the plate without scrolling (e.g. after an in-page
state swap). That case is exactly what Assertion A4 drives.

**Build-gate assertion A4.** Quinn's gate drives real keyboard focus, at
390px and at 320px, in the D1/hybrid build, to: the footer stem link, the
last listing card's link, and the first focusable element below the plate's
column on a variety page — screenshotting each focused element with its
full 3px focus ring visible and no part under the disc. Any part obscured
is a gate defect against SC 2.4.11 and this ruling.

### 4b. The active plate ring — 3px `leaf` ring when Varieties is active

**Ruling: THE RING IS AN INDICATOR WHOSE CONTRAST BINDS — under SC 1.4.11,
against BOTH adjacent grounds — AND IT PASSES BOTH BY MORE THAN DOUBLE.
Mina's §9 framing ("needs no boundary ruling") is corrected on the first
point and confirmed in effect on the second: no fix is required.**

Reasoning and measured facts (unrounded):

- The ring is the plate's state channel: at rest it is `line-strong` at
  2px; active, it becomes `leaf` at 3px. A graphical element whose change
  identifies the current state of a user-interface component is visual
  information required to identify that state, and SC 1.4.11 sets its floor
  at 3:1 against adjacent colours. It has two adjacents, and both bind:
  - **Inside** — the disc's `paper` #F8F1E1 tile: `leaf` on `paper` =
    **9.4205:1** (recorded 9.4:1 — honest). Passes 3:1.
  - **Outside** — the bar ground / page content the raised disc overlaps:
    `leaf` on solid `paper-deep` = 8.4686:1; on the 92% composite at its
    worst (over black) = **7.1028:1**. Passes 3:1 at every point.
- The ring is not the sole channel (label turns `leaf` at 700,
  `aria-current` is set), which is why its failure would not have been
  catastrophic — but redundancy does not exempt a state indicator from
  1.4.11; it is ruled, and it passes. The plate's boundary at rest is
  covered in Assertion A5 below.

**Build-gate assertion A4b.** Quinn's gate confirms the active ring renders
at 3px in `leaf` (not a tint, not the 2px rest width) on `/variety` in the
state strip, and that the ring is a real border/outline — not a box-shadow —
so it survives forced-colors mode (where shadows are stripped).

---

## Additional assertions added by this seat

**A5 — `line-strong` sits at the floor with 0.02 of headroom; the token is
frozen for this component.** Computed unrounded, `line-strong` #91825C on
solid `paper-deep` = **3.0217:1** — it passes SC 1.4.11, and the recorded
"3.0:1" is honest, but the margin is 0.7%. This covers the bar's top rule
and the plate's 2px rest ring (whose inside pair, on `paper`, is 3.3613:1).
Rulings: (a) Mina's pass correctly lightened nothing — any lightening, any
opacity reduction on the rule, or any reduction of the rest ring below 2px
voids this seat's standing ruling on the pair and requires a fresh
measurement before build. (b) Nearest passing value, recorded now so a
future failure is a substitution, not a redesign: the value already in the
token set's history, #97865F's family — if `line-strong` is ever re-derived,
it moves darker along its own hue until the unrounded pair on `paper-deep`
reads ≥ 3.05:1, and Iris chooses within that constraint. (c) Quinn's gate
samples the rendered top rule on `paper-deep`; a sample below 3.0:1
unrounded is a build defect.

**A6 — Token-freeze scope of these rulings.** Items 1–4 are measured on the
tokens and the 92% bar opacity exactly as listed above. Any change to
`paper-deep`, `leaf`, `leaf-50`, `petal`, `line-strong`, or the bar's
opacity — in this redesign or a later one — voids the affected item's
ruling until re-measured. This is stated once here so the gate record
carries it, rather than rediscovered per change.

---

## Summary

| # | Item | Ruling |
|---|---|---|
| 1 | `leaf` on `paper-deep` @92% over content | **STANDS** — now recorded: 8.4686:1 solid; 7.1028:1 at the worst-case composite bound; SC 1.4.3 + 1.4.11 pass throughout (A1) |
| 2 | White numeral on `petal` badge | **PRIMARY STANDS** — white on `petal` = 8.0671:1 ≥ 4.5:1 (SC 1.4.3); disc 5.4048:1 worst-case ≥ 3:1 (SC 1.4.11); fallback does not govern, retained as token-change contingency only (A2) |
| 3 | D2 derived pressed-well tint | **STANDS WITH CONDITION** — `leaf` 8.5957:1 active; 7.5563:1 (srgb) / 7.4754:1 (oklab) pressed; well edge (1.0150:1) ruled non-binding as a redundant channel, void if the colour/weight/`aria-current` channels are removed (A3) |
| 4 | D1 clearance + active ring | **STANDS WITH CONDITION** — 92px + safe-area vs 84px obstruction = 8px clear, SC 2.4.11 satisfied (2.4.12 geometry met for scroll-positioned focus); footer ≥ 92px + safe-area (A4). **Active ring: binds under SC 1.4.11 against both adjacents and passes** — 9.4205:1 inside, 7.1028:1 outside worst-case (A4b) |
| + | Added by this seat | **A5** `line-strong` frozen at its 3.0217:1 boundary for this component · **A6** token/opacity freeze scope for Items 1–4 |

Nothing in these rulings blocks Dustin's pick among D1, the hybrid, D2 or
D3. Every direction Mina designed can be built inside the floor as drawn,
with Assertions A1–A6 carried into Quinn's design gate and the build brief.

*Ada, accessibility specialist. Conformance language: these rulings cover
the four flagged items and the two added assertions, on the token values
and geometry stated. They are engineering rulings toward WCAG 2.2 AA, not
a certification of the tab bar or of the site.*
