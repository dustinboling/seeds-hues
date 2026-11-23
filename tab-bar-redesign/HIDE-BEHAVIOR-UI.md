# Tab Bar Hide-on-Scroll — UI Visual-Form Spec

**Seat:** Mina, UI Design (visual form only — component appearance, geometry, motion
form, tokens). Nadia owns the behaviour (triggers, thresholds, focus contract) in her
parallel pass; Ada owns the accessibility floor and rules on §8; Quinn gates the build.
**Commission:** Q6, ruled by Dustin 2026-11-22 19:14 PT — **hide on scroll down,
return on scroll up** — overriding the always-visible default every earlier document
in this record was drawn under. This pass designs the *visual form* of that behaviour
for the picked design. It does not re-open any other pick.
**The picked design this applies to (the pick set, complete):**

- Direction D1 "The Center Plate," as drawn. Set: **Home · Varieties · Crops (plate) ·
  Sellers · Search** — Crops is crowned at centre under the plate (Q3); Account stays
  out (no badge anywhere in this bar).
- The painted medallion is **out** (Dustin: "that medallion needs to go. It doesn't
  match the branding"). The M4 keyline condition in Quinn's design gate therefore
  **lapses** — it was a condition on the medallion shipping, and the medallion does
  not ship. The plate instead carries Elena's three-seeds icon art (the Option B
  artwork from `icon-redo-2026-11-22/b-sown-seeds/`, the same art as the new favicon /
  touch icon), composed for the 56 px plate under the discipline of `UI-DESIGN.md` §6
  as adapted in §1.3 below. No artwork is created or altered by this pass.
- Desktop header matches the bar's stem-rule active treatment ("After A" model) — Q4.
  **Q6 does not extend to the desktop header** — see §6, stated as a build constraint.
- Ship on design reasoning — Q5. No measurement gate attaches to this behaviour.

**Record read for this pass:** `UI-DESIGN.md` (this seat's visual-form pass),
`UX-STRUCTURE.md` (Nadia), `QA-GATE-design.md` including its §6 build-gate list and
the §4 200%-text Bar B ruling, `presentation/PRESENTATION.md`, and the current
implementation in `v2/` (§1). **One record gap, stated plainly:** `ADA-RULINGS.md`
is cited throughout the record (main `5c96eae`, Items 1–4 + A5/A6) but no standalone
copy of it was present in the design-record folders available to this pass. Ada's
rulings are used here exactly as carried and quoted in Quinn's gate (§6 dispositions)
and the presentation's "Ada's rulings, as assembled" section — the 92 px clearance
contract, the frozen tokens, and the measured ratios cited in §1.2. Nothing below
invents a ruling Ada has not made; §8 hands her the new questions this behaviour
raises, with exact numbers.

---

## 1. Grounding — the bar as it actually ships, and the picked geometry on top of it

### 1.1 The current implementation (`v2/components/layout/TabBar.tsx`, `v2/app/globals.css`)

Read as ground truth, not assumed:

- The bar is a `position: fixed` nav, `bottom: 0`, `z-40`, `md:hidden`, with a 1 px
  top border (`border-t border-line-strong`), ground `bg-paper-deep/92` with
  `backdrop-blur`, and `padding-bottom: env(safe-area-inset-bottom)` set inline.
- The band is the inner list: `h-16` = **64 px**, `max-w-lg`, five equal columns.
  Each tab is a real link, 24 px icon + label at 12 px / 600, `transition-colors
  duration-150 ease-out` — colour is the only thing that has ever animated on this bar.
- The bar takes **no layout space**: it overlays the page, and the rest of the system
  pays for it in exactly two places — `html { scroll-padding-bottom: calc(5rem +
  env(safe-area-inset-bottom)) }` (80 px + inset, written for WCAG 2.2 SC 2.4.11) and
  the footer's mobile `pb-24` (96 px). Both numbers are load-bearing and both are
  re-derived for the plate design in `UI-DESIGN.md` §5 (see §5 below).
- Reduced motion is already a global floor in `globals.css`: under
  `prefers-reduced-motion: reduce`, every transition and animation duration on the
  page collapses to 0.01 ms. §3.3 builds on that rule; it does not restate it.
- There is **no existing transform, no existing hide state, and no motion token for
  movement** anywhere in the current bar. Everything in §2–§3 is new form on top of
  the existing token system, and every new token is flagged NEW where it is named.

### 1.2 Tokens this spec uses (existing — no new values)

| Token | Value | Source / note |
|---|---|---|
| `tabbar.height` | 64 px | `UI-DESIGN.md` §1.4; ships today as `h-16` |
| `tabbar.plate.diameter` | 56 px | `UI-DESIGN.md` §1.4 |
| `tabbar.plate.rise` | 20 px (plate top above the bar's top rule) | `UI-DESIGN.md` §1.4 / §2 |
| `tabbar.motion` | 150 ms ease-out | `UI-DESIGN.md` §1.4 — state colour transitions only; **not** repurposed for movement (§3.1) |
| Bar ground | `paper-deep` `#F0E5CB` at 92 % + backdrop blur | shipped; frozen by Ada A5/A6 |
| Bar top rule / plate rest ring | `line-strong`, 1 px rule / 2 px ring | frozen by Ada A5 — see the value note below |
| Plate active ring | `leaf` `#1E4634`, real 3 px border | Ada A4b construction (border, not shadow, so it survives forced-colors) |
| Plate shadow | `shadow-listing-flat`, under the disc's lower arc only | `UI-DESIGN.md` §2 — one elevation step, set into the bar, never floating |
| Focus ring | `focus` `#7A3E10`, global 3 px `:focus-visible` | shipped, unchanged |

**Value note — flagged, not resolved by this seat:** the design record froze
`line-strong` at `#91825C` (Ada A5, verified in the presentation source by Quinn),
while `v2/app/globals.css` as read for this pass carries `--color-line-strong:
#97865f` (recorded there at 3.2 : 1 on paper). One of these is the build's value and
the record disagrees with itself. The hide geometry in §2 does not depend on which
wins — the rule translates with the bar either way — but the build must not proceed
on both. It is on Ada's list (§8, item A-H6) because her A5 freeze is the ruling
in conflict.

### 1.3 The plate's new artwork — what changes and what does not

Only the plate's *contents* change. The geometry this spec is built on is untouched:
disc Ø 56 px, centre on the bar's top rule, 20 px rise, 36 px seated in the band,
`paper` tile ground inside the disc, 2 px rest ring / 3 px `leaf` active ring, label
("Crops") inside the band under the disc, whole centre cell one link. Elena's
three-seeds art is composed inside the disc's safe area (the Ø 48 px safe disc of the
medallion discipline) by the same rules that governed the favicon composition —
silhouette-first, full-strength and solid, background only transparent. Because the
art is flatter and more graphic than the painting it replaces, nothing in §2–§5
needs re-derivation: the rise, the ring, and the shadow are the plate's geometry,
independent of what the disc carries.

---

## 2. Hide / show geometry — how far it moves, and what remains

### 2.1 The distance

The bar's painted height, measured from the top of the plate to the bottom of the
viewport, in the shown state:

| Layer | Height |
|---|---|
| Plate rise (disc top → bar's top rule) | 20 px |
| Top rule | 1 px |
| Band | 64 px |
| Safe-area padding (`env(safe-area-inset-bottom)`, call it **S**) | S px (device-dependent; 0 on many devices, up to ~34 px on home-indicator phones) |
| **Total painted obstruction** | **85 px + S** |

(Ada's existing contract counts this as 84 px + S — band + rise — with the 1 px rule
absorbed into her 8 px breathing margin. Both countings are in this record; §5 keeps
her contract numbers untouched, and the hide distance below is derived from the
larger, exact figure so it holds under either counting.)

**The hide translation is:**

> `transform: translateY(calc(100% + 22px))` — NEW token `tabbar.hide.translate`

- `100%` is the bar element's own border-box height: 65 px + S (band + rule +
  safe-area padding). It is deliberately a percentage, not a fixed pixel value, so
  the distance **self-adjusts** to the safe-area inset on every device and to the
  grown band under 200% text (§5.4) with no second value to keep in sync. A fixed
  pixel offset (87 px at S = 0) would be correct on exactly one device class and
  would leave a peeking remnant on every taller configuration — that failure mode
  is designed out here, not documented around.
- `+ 20 px` is the plate's rise: the part of the bar that lives *above* its own
  border box. Without it, the disc's top 20 px — the three-seeds art itself — would
  sit in the viewport permanently, a disembodied plate floating at the screen's
  bottom edge. This is the single easiest number in this spec to get wrong and the
  one the commission names explicitly: **nothing of the plate may peek, and at this
  distance, nothing does.**
- `+ 2 px` is clearance: it puts the disc's top edge 2 px past the viewport's bottom
  edge, so sub-pixel rounding, the disc's antialiased ring edge, and any shadow
  hairline have somewhere to go that is not on screen. Total travel at S = 0 is
  87 px against an 85 px obstruction.

The shown state is `translateY(0)`. There are exactly two resting transforms; the
bar never rests at a partial offset (§3.4).

### 2.2 What remains visible while hidden — nothing

**Recommendation: nothing remains. No sliver, no top rule, no plate edge, no shadow.**

Reasoning, in order of weight:

1. **A remnant reads as a defect, not an affordance.** A 1–3 px strip of translucent
   `paper-deep` over scrolling content, or the top rule alone, has no label, no
   target, and no state to communicate. On this site's paper ground it would read
   as a rendering artifact — a hairline the page forgot to clean up — in a design
   system whose whole register is deliberate paper and rules that mean something.
2. **A visible remnant invites a tap it cannot honour.** Anything painted at the
   thumb's home position reads as touchable. A remnant strip is far below the 44 px
   house target floor; making it tappable would fail the floor, and leaving it
   painted but inert teaches the visitor that part of the chrome is decoration
   that looks like a control. The honest states are *bar* and *no bar*.
3. **The rule's contrast is not ours to spend as a ghost.** The top rule sits at
   the SC 1.4.11 floor (Ada A5 froze it for exactly this reason). A permanent
   hairline at the floor value, doing no boundary work because the component it
   bounded has left, spends the system's most constrained value on nothing.
4. **The return path does not need a handle.** The bar returns on scroll up
   (Nadia's behaviour), which is the platform-taught pattern for this chrome
   (mobile browser toolbars, Material's bottom app bar behaviour). No commercial
   pattern of standing requires a persistent tab-bar sliver, and the visitor is
   never more than one upward scroll from the full bar, labels and all.
5. **The plate settles it.** Any remnant tall enough to be noticeable is tall
   enough to catch the disc's lower arc or its shadow — a partial plate is the
   worst of both states: the landmark broken, the space not actually returned.

While hidden, the full 85 px + S of viewport height — including the safe-area
strip — returns to the page. Page content may paint to the viewport's bottom edge;
no element of the bar, its shadow, or its inset strip remains painted over it.

### 2.3 The hidden state's form (paint only — behaviour is Nadia's)

- The transform is applied to the **nav element as one unit**. Nothing inside it
  gets its own transform, transition, or opacity change, in either direction.
- Opacity never animates. The bar is translucent by design (92% over blurred
  content); fading it would pass through intermediate composites Ada has never
  measured, for a movement that already explains itself. It slides, or (reduced
  motion, §3.3) it swaps. It does not fade.
- Whether the fully hidden bar also leaves the accessibility tree and the tab
  order while off-canvas is **not** a form question — it is Nadia's focus contract
  and Ada's ruling (§8, A-H3). The form guarantees only this: at the full offset,
  nothing of the bar is *painted*, including a focus ring drawn around one of its
  tabs — which is precisely why §7 constrains Nadia's spec the way it does.

---

## 3. Motion — duration, easing, reduced motion

### 3.1 Two new motion tokens (both flagged NEW)

State colour changes keep the existing `tabbar.motion` (150 ms ease-out). Movement
gets its own tokens, because a 64 px surface travelling 87 px is not a colour
change and must not inherit one's timing:

| Token (NEW) | Value | Used for |
|---|---|---|
| `tabbar.motion.hide` | **180 ms**, `cubic-bezier(0.4, 0, 1, 1)` (standard ease-in) | shown → hidden |
| `tabbar.motion.show` | **220 ms**, `cubic-bezier(0, 0, 0.2, 1)` (standard ease-out) | hidden → shown |

- **Hide is faster than return** — the field's standing pattern (exits faster than
  entrances; Atlassian's published ranges, this seat's playbook). The bar is
  leaving because the visitor is reading downward; it should get out of the way
  promptly. The bar returns because the visitor has asked for it by scrolling up;
  a slightly longer, decelerating arrival lets the eye land on it and reads as
  the bar *settling back into place*, not snapping.
- **Easing is asymmetric for the same reason.** Hide eases **in**: a gentle first
  frame (the bar does not lurch the moment a scroll begins) accelerating away.
  Return eases **out**: it arrives quickly and settles the last few pixels slowly,
  so the plate — the landmark — never appears to overshoot its seat.
- **Flagged deviation, per this seat's rule that conflicts are named, not silently
  resolved:** Nadia's constraints register (§4.2) records the house motion range
  as "150–220 ms ease-out." Both durations above sit inside 150–220 ms. The hide's
  ease-**in** curve departs from the register's blanket "ease-out" wording. This
  seat's judgement: the register's range was written when the only motion in the
  chrome was colour transitions, and exit-easing is a form decision in this seat's
  lane — but the departure is recorded here for Nadia and Quinn to see, and if the
  register is held to govern curves as well as durations, the fallback that costs
  least is hide at 160 ms ease-out with the distance unchanged. The geometry in
  §2 does not depend on this choice.
- Both transitions animate **`transform` only**. Height, padding, and margin never
  animate — an animated height on the fixed bar would repaint the backdrop blur
  every frame and, worse, would imply the layout is moving, which §5 forbids.

### 3.2 Interruption

A reversal mid-flight (scroll direction changes while the bar is travelling)
reverses from the **current rendered offset** toward the other resting state,
using that direction's duration and curve. There is no jump to an endpoint, no
restart from 0 or from full offset, and no queue: the latest direction wins,
immediately. A transition that cannot be interrupted cleanly would make the bar
feel haunted at exactly the moment the visitor changes their mind.

### 3.3 Reduced motion — Ada's floor, stated

Under `prefers-reduced-motion: reduce`, the shipped global rule in `globals.css`
already collapses all transition durations to 0.01 ms. Applied here, that means:

- **No slide, in either direction.** Hide and show are **instant state swaps**:
  one frame the bar is fully shown, the next it is fully hidden (or back).
- **No substitute animation.** No fade, no shortened slide, no "gentler" version
  of the travel. A fade was already excluded in §2.3 for all users; under reduced
  motion it is doubly excluded — the floor is *no* motion treatment, not a
  different one.
- The behaviour itself (hide on scroll down, return on scroll up) still applies;
  only its movement is removed. A visitor who has asked their system for no
  motion gets the same bar, the same destinations, and the same gained reading
  space — delivered without travel. This seat regards anything else as failing
  the floor Ada owns; her confirmation is §8, A-H4.

### 3.4 No partial resting states

The bar has two resting states and is never *left* anywhere between them: no
condensed half-bar, no plate-only resting state, no "mostly hidden" stop. Partial
offsets exist only as frames of a running transition. (Whether a *slow* scroll
drags the bar proportionally — a scrubbed, finger-following hide — is a behaviour
model, Nadia's to specify or reject; the form above is written for the triggered
transition model, and if she specifies scrubbing, the same tokens bound its
endpoints and §2's distance still governs. Flagged so the two specs meet
deliberately rather than by accident.)

---

## 4. The plate through the transition

- **Rigid with the bar.** The disc, its ring, its shadow, the "Crops" label, and
  the whole centre cell translate as one rigid assembly with the nav. The plate
  gets **no independent animation** of any kind: no lead or lag, no settle, no
  scale, no counter-movement, at no point in either direction. The landmark
  behaving differently from the bar it is set into would break the "seal pressed
  into the strip" read the design is built on — and a plate that lingers while
  the bar leaves is the peeking failure of §2.1 wearing a nicer name.
- **No internal clipping.** The build must not put `overflow: hidden` (or any
  clip) on the nav, the list, or the centre cell to achieve the hide. The plate
  rises 20 px above the bar's border box by design; any internal clip that the
  bar's shown state tolerates only because the disc currently overflows *upward*
  into open page would shear the disc the moment geometry changes. The **only**
  boundary that ever clips the bar is the viewport's bottom edge itself, which is
  the mechanism of the hide: the assembly stays whole until it crosses that edge.
  The disc, riding highest, is the **last** part of the bar to leave on the way
  down and the **first** to reappear on the way back — the landmark announcing
  the bar's return, which is correct and desirable.
- **Shadow and ring intact throughout.** The disc's `shadow-listing-flat` and its
  2 px / 3 px ring are painted in every frame of both transitions, unchanged. The
  shadow travels with the element; at the full hide offset the disc's top sits
  2 px below the viewport edge and its shadow falls further downward still, so
  no shadow remnant can pool at the screen's edge in the hidden state.
- **Pressed and active states do not restart the transition.** A press landing on
  a flank tab or on the plate renders its well / halo exactly as specified in
  `UI-DESIGN.md`, in the bar's current offset, without affecting travel. (Whether
  a hide may *begin* while a finger is down on a tab is a trigger question —
  but it has a hard geometric edge, stated in §7.)

---

## 5. The clearance contract — shown, hidden, safe-area, and the grown band

### 5.1 The model: fixed overlay, static clearance — in both states

**Decision: the clearance contract does not change between the shown and hidden
states. Not the scroll-padding, not the footer padding, not any content padding,
at any point, in either direction, animated or otherwise.**

The bar is a fixed overlay today and stays one. The alternative — shrinking the
page's clearance when the bar hides and restoring it when it returns — is
rejected on this seat's standing rules, and the rejection is the substance of
this section:

1. **Layout shift is the enemy, and this would be layout shift as a feature.**
   Padding that changes with scroll direction moves every element it protects,
   on every direction change, for the whole session. The house in-place
   standard (instant feedback, stable frame, nothing jumps) exists because
   Dustin's surfaces do not move under the visitor. A clearance that breathes
   with the bar makes the page's end breathe too.
2. **The focus contract cannot survive a moving floor.** SC 2.4.11 is judged
   against the bar *shown*: the bar can return at any moment (any upward
   scroll), including while an element near the page's end holds focus. If
   clearance dropped while hidden, a returning bar could land on top of the
   focused element it was previously clearing. The only safe contract is the
   shown-state contract, held permanently. The hidden state's over-clearance
   is not waste; it is what makes the return unconditionally safe.
3. **The gain of hiding is reading room mid-page, not clearance at the end.**
   What hide-on-scroll actually gives the visitor is 85 px + S of unobstructed
   viewport while reading — which the overlay model already delivers the
   instant the transform lands. Nothing real is bought by also shrinking the
   end-of-page contract, and a live risk (item 2) is paid for it.

### 5.2 The numbers — Bar A (100% text), both states

Ada's re-derived contract for the plate design (`UI-DESIGN.md` §5, her A4),
**unchanged by this pass and now stated for both states**:

| Contract | Shown | Hidden |
|---|---|---|
| `scroll-padding-bottom` | `calc(5.75rem + env(safe-area-inset-bottom))` = **92 px + S** | **92 px + S — identical** |
| Footer mobile clearance (`padding-bottom`) | **≥ 92 px + S** (`calc(5.75rem + env(safe-area-inset-bottom))`) | **≥ 92 px + S — identical** |
| Painted obstruction | 85 px + S (84 + rule, §2.1) | 0 px |
| Breathing margin inside the contract | 92 − 85 = **7 px** minimum (8 px on Ada's counting) | contract held in full |

Build notes on the numbers as shipped today: `globals.css` currently carries
`scroll-padding-bottom: calc(5rem + …)` (80 px + S) and the footer `pb-24`
(96 px, a flat value with no inset term). The plate build already owes the move
to 92 px; this pass adds two precisions for that same build — the footer's
clearance must carry the **inset term** (`pb-24`'s flat 96 px satisfies the
contract only while S ≤ 4 px, which home-indicator phones exceed), and the
92 px value is to be implemented as a **state-independent constant**: no
selector keyed to the bar's hidden state may touch either property.

### 5.3 The safe-area inset — both states

- **Shown:** exactly as shipped — the nav's `padding-bottom:
  env(safe-area-inset-bottom)` places the band above the gesture area; no tab
  target enters the inset; the inset strip is painted with the bar's ground.
- **Hidden:** the inset strip leaves with the rest of the element (it is inside
  the translated border box — one more reason §2's distance is a percentage of
  the whole box, inset included). Nothing is painted in the inset region by the
  bar; the page shows through to the viewport's bottom edge. No separate inset
  element, shim, or background strip is left behind, and none is animated
  separately on return — the inset arrives and leaves as part of the one rigid
  element.
- The inset's *contract* role does not change with state: it remains inside both
  clearance formulas in §5.2 in both states, because the shown state — the one
  the contract protects against — can resume at any time.

### 5.4 Bar B — the 200%-text grown band, both states

Quinn's design-gate ruling (§4 of the gate) stands and binds this behaviour:
at 200% text, labels wrap inside their own slots and **the band grows in
height**; labels never shrink, clip, or scroll; and the gate's condition 3
requires clearance to be **derived from the bar's rendered height**. This pass
specifies that derivation:

- **Definitions.** Let **H** = the bar's rendered band height at 200% text
  (band only, excluding rule, rise, and inset — the build measures it on the
  real component; at 100% text H = 64 px). The plate does not grow: disc
  Ø 56 px and rise 20 px are artwork geometry, fixed at every text size. The
  plate's label ("Crops") grows and wraps inside the band like every other
  label — it is a band element, not a disc element.
- **Hide distance under Bar B — no new value needed.** `translateY(calc(100% +
  22px))` is computed against the *rendered* border box, which already includes
  the grown band. The percentage absorbs the growth exactly; the +22 px (rise +
  clearance) is unchanged because the rise is unchanged. This is the second
  place the percentage form earns its keep (§2.1): a fixed-pixel offset would
  silently under-travel at 200% and leave the grown band's top — or the plate —
  peeking, at precisely the text size the gate ruling protects.
- **Clearance under Bar B — formula, binding; example, illustrative.**

  > `scroll-padding-bottom` (Bar B) = **H + 28 px + S**
  > footer mobile clearance (Bar B) = **≥ H + 28 px + S**

  (H + 20 px rise + 1 px rule = obstruction; + 8 px breathing margin, on Ada's
  counting convention; at H = 64 this returns her 92 px + S, as it must.)
  *Worked example only:* if the build's measured grown band is H = 100 px
  (two-line labels at 24 px), the contract becomes **128 px + S** in both
  properties. The example is not a value to build to — the formula is, and the
  build gate's driven-focus proof must run at 200% text against the measured
  H, per the gate's existing condition.
- **Both states, again:** the Bar B clearance, like Bar A's, is **identical
  shown and hidden**. Text size changes the contract's value; the bar's
  visibility never does.
- **Implementation form (for the build brief, not a behaviour choice):** the
  derivation must be automatic — the clearance computed from the bar's rendered
  height (a measured custom property, a container/scroll-driven value, or an
  equivalent mechanism the build defends at its gate) — never a second
  hand-maintained pixel constant that can drift from the band it protects.
  Quinn's condition 3 said "derived from the rendered height (or an equivalent
  dynamic measure)"; this pass makes that a requirement of the form, not a
  preference.

---

## 6. Desktop — Q6 does not extend there (build constraint, stated explicitly)

**The desktop header does not hide. Not on scroll down, not ever, under this
commission.**

- The `SiteHeader` / `HeaderNav` surface gets **no** transform, **no** hidden
  state, **no** hide/show motion tokens, and no scroll-coupled behaviour of any
  kind from this spec. Its only change in this redesign remains the Q4 "After A"
  stem-rule active treatment (rendering of the current state), exactly as
  `UI-DESIGN.md` §5 (desktop relationship) specifies.
- The desktop header is not a fixed bottom bar; it is a different component with
  a different relationship to the page, and Q6's ruling was made about the
  mobile tab bar. Extending it would be a new behaviour on a surface Dustin has
  not ruled on — design drift, named here so the build cannot slide into it.
- Mechanically: the hide state and its tokens are scoped to the tab bar
  component only, which already renders below `md` only (`md:hidden`). The
  build must not lift the hidden-state class, the transform, or any scroll
  listener outcome onto the header, the header menu, or any shared layout
  ancestor. If a future commission wants a hiding desktop header, it comes back
  through Nadia and this seat as its own pass.

Scope note, for completeness: this spec governs the tab bar wherever that
component renders, with the one geometry in §2. It designs no separate variant
for any route family.

---

## 7. Where this geometry constrains Nadia's behaviour spec

Form constraining behaviour, listed so her parallel pass can build on fixed
ground (the triggers and thresholds themselves remain hers):

1. **Focus precondition.** A focus ring around a tab is painted *inside* the
   translated element. If focus lands on any tab while the bar is at the hidden
   offset, the ring — and the tab — are off-viewport by construction. Her focus
   contract must therefore treat **shown (`translateY(0)`) as a precondition
   for tab focus being visible**: any path that moves focus into the bar must
   put the bar in the shown state, and the shown state reached for focus must
   be the full resting state, not a mid-transition frame. (The SC 2.4.11 /
   focus-not-obscured ruling on this is Ada's — §8, A-H3.)
2. **No hide may begin under a resting finger.** A transition that starts while
   a pointer is down on a tab moves that tab's target out from under the press
   by up to 87 px. Her trigger spec must suppress hide initiation during an
   active press on the bar (the press either completes as a tap on a stationary
   target, or the hide waits for release). The geometry cannot soften this;
   it can only state it.
3. **Travel budget for thresholds.** The full hide takes 180 ms and the full
   return 220 ms (§3.1). Any threshold or debounce she sets composes *with*
   those durations, not instead of them — a trigger that fires late and then
   travels 220 ms is a ~half-second answer to a scroll-up, which is the felt
   behaviour her numbers will actually produce. End-to-end responsiveness is
   hers to budget with these figures in hand.
4. **Default state is shown.** The bar's un-enhanced, no-JS, pre-hydration, and
   first-paint state is `translateY(0)` with the full §5 clearance — the
   no-JS rule from her own register (§4.4 of her pass) expressed as form: the
   hidden state may only ever be *applied*, never the default the page is
   built in.
5. **Scrubbing, if she specifies it,** is bounded by §2's endpoints and §3.4's
   rule that no partial offset is a resting state; a scrub model that parks
   the bar mid-travel on scroll-stop would contradict this form and needs a
   joint revision, not a silent override in either spec.

---

## 8. Handed to Ada — for her ruling

Exact numbers, ready to rule on. Items A-H1–A-H3 are the clearance and focus
questions this behaviour opens; A-H4–A-H6 are confirmations and one conflict
this pass will not resolve over her.

- **A-H1 — The static clearance contract under a hiding bar.** §5.2: shown and
  hidden states both hold `scroll-padding-bottom: calc(5.75rem +
  env(safe-area-inset-bottom))` (92 px + S) and footer mobile clearance
  ≥ 92 px + S, with **no state-dependent change to either property, ever**.
  The design knowingly over-clears while hidden (painted obstruction 0 px,
  contract 92 px + S) on the reasoning in §5.1 item 2: the bar can return over
  a focused element at any time. Rule on: is permanent shown-state clearance
  the correct floor reading of SC 2.4.11 for a bar that hides, or does the
  floor permit (or require) anything different in the hidden state?
- **A-H2 — The Bar B derivation.** §5.4: at 200% text, clearance =
  **H + 28 px + S** for both `scroll-padding-bottom` and footer clearance,
  where H is the bar's measured rendered band height, derived automatically
  from the rendered height, identical in shown and hidden states; worked
  example H = 100 px → 128 px + S. Rule on the formula and on the automatic-
  derivation requirement, for the build gate's 200%-text driven-focus run.
- **A-H3 — Focus into a hidden bar.** §7 item 1: this form makes the shown
  state a precondition for visible tab focus, and §2.3 leaves the hidden bar's
  presence in the tab order / accessibility tree to you and Nadia. Rule on:
  what the hidden bar must be to keyboard and assistive-technology users
  (removed from tab order while hidden? focus forces an instant show? show
  with the §3 motion or without?), and whether a focus-forced return is a
  motion event the reduced-motion rule in A-H4 governs.
- **A-H4 — Reduced-motion form.** §3.3: under `prefers-reduced-motion`, hide
  and show are instant swaps under the shipped global 0.01 ms rule, with no
  fade or substitute animation, and the behaviour itself unchanged. Confirm
  this satisfies the floor, or rule the form you require.
- **A-H5 — The fully hidden state leaves nothing painted.** §2.2: no sliver,
  no rule, no shadow at the hidden offset (`translateY(calc(100% + 22px))`,
  total travel 87 px + S against an 85 px + S obstruction). Confirm no floor
  provision (component identification, boundary, or otherwise) requires a
  painted remnant of a hidden primary navigation — or name the provision and
  the minimum remnant it requires, and this geometry will be re-derived
  around it.
- **A-H6 — The `line-strong` conflict.** §1.2: the record's frozen value is
  `#91825C` (your A5, verified by Quinn in the presentation source);
  `v2/app/globals.css` as read for this pass carries `#97865f`. The build
  needs one value and your freeze is the authority in conflict. Rule on which
  value ships; note the hide geometry is indifferent to the answer, but the
  A5 freeze's "any token change voids the affected ruling" clause is not.

---

## 9. The build must hit — exact values

1. **Set and plate:** Home · Varieties · **Crops (plate)** · Sellers · Search;
   plate disc Ø **56 px**, rise **20 px**, centre on the top rule, carrying
   Elena's three-seeds art inside the Ø 48 px safe disc; no medallion, no
   Account tab, no badge.
2. **Shown transform:** `translateY(0)`. **Hidden transform:**
   `translateY(calc(100% + 22px))` (token `tabbar.hide.translate`, NEW) —
   never a fixed pixel offset. Travel at S = 0: **87 px**; obstruction
   **85 px + S**; disc-top clearance past the viewport edge: **2 px**.
3. **Hidden remnant:** **none** — no sliver, no top rule, no plate arc, no
   shadow painted in the hidden state.
4. **Motion (both NEW tokens):** hide **180 ms** `cubic-bezier(0.4, 0, 1, 1)`;
   show **220 ms** `cubic-bezier(0, 0, 0.2, 1)`; `transform` is the only
   animated property; state colour transitions remain **150 ms ease-out**
   (`tabbar.motion`, unchanged).
5. **Reduced motion:** instant swap in both directions under the shipped
   global `prefers-reduced-motion` rule; no fade, no substitute animation.
6. **Plate rigidity:** one transform on the nav element only; no transform,
   transition, or opacity change on the plate or any child; no
   `overflow: hidden` or clip on nav, list, or centre cell; ring and shadow
   painted unchanged in every frame.
7. **Interruption:** a reversal starts from the current rendered offset with
   the new direction's duration and curve; no jump, no queue. Only two
   resting states exist: 0 and the full offset.
8. **Clearance, Bar A (100% text), BOTH states, state-independent:**
   `scroll-padding-bottom: calc(5.75rem + env(safe-area-inset-bottom))`
   (**92 px + S**); footer mobile `padding-bottom` **≥ 92 px + S** with the
   inset term included (flat `pb-24` alone does not satisfy this where
   S > 4 px). No hidden-state selector may alter either property.
9. **Clearance, Bar B (200% text), BOTH states:** `scroll-padding-bottom`
   and footer clearance = **H + 28 px + S**, H = the bar's measured rendered
   band height, derived automatically from the rendered height — not a
   hand-maintained constant. Labels wrap inside their slots; the band grows;
   nothing shrinks, clips, or scrolls (Quinn's Bar B ruling).
10. **Safe area:** nav `padding-bottom: env(safe-area-inset-bottom)` as
    shipped, inside the translated element in both states; no separate inset
    element or remnant in the hidden state.
11. **Desktop:** the header receives **no** hide behaviour, transform, or
    motion token — its only change is the Q4 "After A" stem-rule active
    treatment. Hide state and tokens scoped to the tab bar component only
    (below `md`).
12. **Default state:** shown. No-JS, pre-hydration, and first paint all render
    the bar at `translateY(0)` under the full §5 clearance; the hidden state
    is only ever applied by the behaviour layer.

---

## Verification checklist (this seat's playbook)

- [x] Structure unchanged from the pick — set, order, crown, plate geometry,
      and desktop scope exactly as ruled; only the hide behaviour's form is new
- [x] Every value traces to a named token: existing tokens quoted from
      `globals.css` / `UI-DESIGN.md` §1.4; the three new values named as NEW
      tokens (`tabbar.hide.translate`, `tabbar.motion.hide`,
      `tabbar.motion.show`) — no raw one-off numbers in the spec body
- [x] All states of the behaviour drawn: shown · hidden · hide-in-flight ·
      show-in-flight · interrupted reversal · reduced-motion swap · Bar A and
      Bar B geometries · safe-area in both states
- [x] No layout shift: the clearance contract is static across states by
      decision (§5.1), defended against the alternative
- [x] Focus: the geometric precondition for visible tab focus stated (§7.1);
      the ruling itself handed to Ada (A-H3), not assumed
- [x] Artwork: Elena's three-seeds art placed whole inside the safe disc,
      never cropped or stretched; no artwork created by this seat; the
      medallion and its M4 condition recorded as out / lapsed, not silently
      dropped
- [x] Conflicts flagged, not resolved silently: the ease-in departure from
      Nadia's motion register (§3.1, with fallback), and the `line-strong`
      value conflict (A-H6, Ada's to rule)
- [ ] Deliberately unchecked by this seat: trigger thresholds and the focus
      contract's behaviour (Nadia, parallel pass); every floor ruling in §8
      (Ada); rendered verification at 390 / 320 px and 200% text (the build
      and Quinn's build gate, against §9's list)

— Mina, UI Design · 2026-11-22
