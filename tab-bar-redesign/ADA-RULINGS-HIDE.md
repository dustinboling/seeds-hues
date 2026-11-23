# Tab Bar Hide-on-Scroll — Accessibility Rulings (Ada, Accessibility Specialist)
### Seed Directory (seeds.hues.flowers) · 2026-11-22 · Rulings on Mina's A-H1–A-H6 (HIDE-BEHAVIOR-UI.md §8), on Nadia's focus contract (HIDE-BEHAVIOR-UX.md §5, §8.3 Q-A1–Q-A6), and on the standing concerns the Q6 behaviour change raises

**Commission.** Dustin's Q6 ruling, 2026-11-22 19:14 PT: the mobile tab bar
hides on scroll down, returns on scroll up — overriding the always-visible
default every earlier document in this record, including this seat's
`ADA-RULINGS.md`, was drawn under. Q6 is Dustin's word and it stands; this
pass rules only on whether the two hide passes (Nadia, behaviour;
Mina, visual form) keep the bar inside the WCAG 2.2 AA floor while it
hides, and on what replaces the always-visible clearance contract (Item 4 /
Assertion A4 of `ADA-RULINGS.md`) now that the bar can be absent.

**Scope and basis.** `tab-bar-redesign/HIDE-BEHAVIOR-UI.md` (Mina) §§1–9,
esp. §2 (hide geometry), §3 (motion), §5 (clearance), §7 (constraints on
Nadia), §8 (items A-H1–A-H6 as framed there — ruled on exactly as framed);
`tab-bar-redesign/HIDE-BEHAVIOR-UX.md` (Nadia) §§1–8, esp. §2 (clearance
held), §3 (Bar B), §5 (focus contract), §8.3 (Q-A1–Q-A6, answered in §9
below by cross-reference); `tab-bar-redesign/ADA-RULINGS.md` (this seat's
Items 1–4, Assertions A1–A6 — all of which stand except where §1 of this
document expressly re-states the clearance contract for a hiding bar);
`tab-bar-redesign/UI-DESIGN.md` §5 as background. Ground truth re-read for
this pass from `origin/main` (`git show origin/main:v2/app/globals.css`):
`--color-line-strong: #91825C` is the value on main today — see A-H6.
Floor: WCAG 2.2 AA. All ratios in this document were computed by this seat
from relative luminance (WCAG formula), **unrounded**, from the token hex
values; no recorded figure was taken on trust. These rulings block the
build until their assertions are met; they do not block Dustin's Q6 ruling
or his pick. This is an engineering ruling, not certification — the site
is built to WCAG 2.2 AA, not formally certified.

**Tokens ruled on:** `paper` #F8F1E1 · `paper-deep` #F0E5CB · `leaf`
#1E4634 · `line-strong` #91825C (see A-H6) · `focus` #7A3E10. Geometry
notation follows the two passes: **S** = `env(safe-area-inset-bottom)`;
**H** = the bar's rendered band height (H = 64 px at 100% text);
obstruction **O** = S + H + 20 px plate rise (the 1 px top rule is absorbed
into the margin on this seat's counting convention, as in A4 — both passes'
countings are reconciled where they meet, in A-H2).

---

## Summary

| # | Item (as framed by Mina §8) | Ruling |
|---|---|---|
| A-H1 | Static clearance contract under a hiding bar (§5.2 of the UI pass) | **STANDS — and is required.** Shown-state clearance (92 px + S) held permanently in both states is the correct floor reading of SC 2.4.11; any state-dependent shrink is prohibited (AH1) |
| A-H2 | Bar B derivation — clearance = H + 28 px + S, automatically derived (§5.4) | **STANDS WITH CONDITION** — the formula is correct and identical to Nadia's O + 8; the automatic derivation is binding, the margin does not scale, and the formula — never a capped constant — governs at every band height (AH2) |
| A-H3 | Focus into a hidden bar (§7 item 1 of the UI pass; Nadia §5) | **STANDS WITH CONDITIONS** — transform-only hidden state confirmed (tabs stay in tab order and the tree); focus forces a show; **a focus-forced show must SNAP with no transition, at every motion setting** — Nadia's pre-written fallback governs, not the animated return (AH3) |
| A-H4 | Reduced-motion form — instant swaps, no substitute animation (§3.3) | **STANDS** — confirmed against the floor, with one build condition: the swap must be real (CSS-transition collapse or an explicit `matchMedia` gate on any script-driven animation), proven at the gate (AH4) |
| A-H5 | Fully hidden state leaves nothing painted (§2.2) | **STANDS** — no floor provision requires a painted remnant of a hidden primary navigation; the travel distance is verified sufficient in both Bar A and Bar B (AH5) |
| A-H6 | The `line-strong` conflict — #91825C (record) vs #97865F (Mina's read of `globals.css`) | **#91825C SHIPS.** It is the value on `origin/main` today and it passes (3.0217:1 on `paper-deep`). **#97865F FAILS the floor on the bar's ground (2.8475:1, SC 1.4.11)** and must not ship in this component in any role; the A5 freeze stands (AH6) |
| + | Added by this seat | **A-H7** forced-colors behaviour of both states · **A-H8** no hide under a resting finger / moving-target rule · **A-H9** text-spacing and reflow growth ride the same measured formula |

Nothing in these rulings blocks the hide behaviour. Every element of both
passes can be built inside the floor as drawn, with the conditions below
carried into Quinn's build gate alongside Nadia's H1–H19 and this seat's
A1–A6.

---

## A-H1 — The static clearance contract under a hiding bar

**Ruling: STANDS — and, stated more strongly than the question was put,
permanent shown-state clearance is not merely permitted by the floor; it
is the only contract this seat will pass. A state-dependent clearance is
prohibited.**

The contract as specified (Mina §5.2, Nadia §2 — the two passes agree):

| Contract | Shown | Hidden |
|---|---|---|
| `scroll-padding-bottom` | `calc(5.75rem + env(safe-area-inset-bottom))` = **92 px + S** | **92 px + S — identical** |
| Footer mobile clearance (`padding-bottom`) | **≥ 92 px + S**, inset term included | **≥ 92 px + S — identical** |
| Painted obstruction | 85 px + S (84 px + the 1 px rule) | 0 px |

Reasoning, criterion by criterion:

- **SC 2.4.11 (Focus Not Obscured — Minimum, AA)** fails when a focused
  element is entirely hidden by author-created content. The judgement is
  made at the moment an element holds focus — and under this behaviour the
  bar can return at *any* moment: a 12 px upward run (Nadia §1.2), a zone
  forcing (§1.3), or a single `focusin` (Nadia §5.2, ruled on in A-H3).
  A clearance that shrank while hidden would therefore be a clearance
  that can be voided *by the return itself*, landing the returned bar on
  top of an element that was positioned against the shrunken value. The
  only contract under which A4's geometry (obstruction + 8 px, no part of
  a scroll-positioned focused element obscured at the centre column) is
  true in every reachable state is the shown-state contract, held
  permanently. Mina's §5.1 item 2 states this correctly; this seat adopts
  it as the ruling, not as a design preference.
- **The hidden state's over-clearance violates nothing.** No criterion
  requires reclaimed space, minimal padding, or layout tightness. While
  hidden, the contract simply clears empty viewport — the reading room
  the behaviour exists to give is delivered by the overlay's departure,
  not by moving the page's end. Nadia's Decision 6 ("hiding reclaims
  overlay space, not layout — content never reflows") is the correct
  shape, and the zero-reflow consequence is itself floor-friendly:
  content that does not move cannot move out from under a magnifier's
  panning viewport or a focused element (SC 1.4.10 context; this seat's
  low-vision standing rule).
- **What replaces the D1 clearance condition.** Assertion A4 of
  `ADA-RULINGS.md` was drawn for an always-visible bar. It is **re-stated
  for the hiding bar as Assertion AH1 below, which supersedes A4's
  statement of the contract** (A4's derivation — 84 px obstruction, 8 px
  margin, 92 px + S — is unchanged and is the value both states now
  hold). A4's driven-focus proof is unchanged in its targets and is run
  with the bar VISIBLE — the worst case, and the only case in which the
  proof means anything (see §9, Q-A3/Q-A6).

**Build-gate assertion AH1.** (a) In the built CSS, neither
`scroll-padding-bottom` nor the footer mobile clearance carries any
selector, class, media query, or script write keyed to the bar's hidden
state; both read 92 px + S with the bar shown, hidden, and mid-transition,
at 390 px and 320 px. (b) The footer's clearance includes the inset term —
flat `pb-24` (96 px, no inset) satisfies the contract only while S ≤ 4 px
and is **not** accepted as the implementation. (c) A4's driven-focus proof
(footer stem link, last listing card, first focusable under the plate's
column) passes with the bar visible, exactly as originally asserted.

---

## A-H2 — The Bar B derivation (200% text, grown band)

**Ruling: STANDS WITH CONDITION — the formula is correct, the two passes'
formulas are the same formula, and the automatic-derivation requirement
is binding on the build.**

The reconciliation, so the gate never has to choose between two specs:

- Mina §5.4: clearance = **H + 28 px + S** (H = rendered band height;
  28 = 20 rise + 1 rule + 7 breathing on the exact counting, = 20 rise +
  8 breathing on this seat's A4 counting, where the rule is absorbed).
- Nadia §3: clearance = **O + 8**, where O = S + H + 20 → **H + 28 px + S**.
  Identical, term for term.
- Checks: at H = 64 (Bar A) the formula returns **92 px + S** — A4's
  contract, as it must. At Nadia's expected grown band H = 88 (two-line
  labels, +24 px) it returns **116 px + S**. Mina's worked example
  (H = 100 → **128 px + S**) is arithmetically correct and is an example
  only — the build derives, it does not build to 116 or 128.

Conditions and clarifications:

1. **The margin does not scale.** The +8 is an absolute clearance: it
   exists so a focused element's bottom edge and its 3 px focus ring come
   to rest clear of the plate's highest point. Neither the ring nor the
   breathing room a reader needs grows when the band grows, so the margin
   is constant at every H. (This answers Nadia's Q-A4: confirmed, the
   A4 margin carries unchanged under Bar B growth.)
2. **Automatic derivation is a floor requirement, not an implementation
   preference.** Quinn's design-gate condition 3 already requires
   clearance derived from the rendered height; this seat makes the same
   demand of every value the obstruction feeds — `scroll-padding-bottom`,
   footer clearance, hide travel, and Nadia's top zone — from **one**
   measured quantity. A second hand-maintained pixel constant anywhere in
   that set is a defect by construction: it is correct at exactly one
   text size and silently wrong at the sizes Bar B exists to protect
   (SC 1.4.4 Resize Text, SC 1.4.10 Reflow). The mechanism (measured
   custom property, container/scroll-driven value, or equivalent) is the
   build's to defend at the gate; the derivation is not optional.
3. **No cap.** Nadia's "+24 px / H ≤ 88" describes the expected two-line
   wrap; it is not a ceiling the formula may assume. Under the SC 1.4.12
   text-spacing overrides (see A-H9) or a third label line, H can exceed
   88 — the formula, the travel, and the clearance must follow the
   measured H wherever it lands. Any hard-coded 84 / 86 / 92 / 108 / 116
   in the hide or clearance path is a gate defect (Nadia §3, adopted).
4. **Hide travel under Bar B needs no new value — verified.** Mina's
   `translateY(calc(100% + 22px))` is computed on the rendered border box
   (H + 1 rule + S), so travel = H + 23 px + S against an obstruction of
   H + 21 px + S (H + 20 rise + 1 rule + S): the disc's top edge clears
   the viewport's bottom edge by exactly 2 px at **every** H, because the
   only growing term is inside the percentage. The percentage form is
   therefore not merely convenient; a fixed-pixel offset would
   under-travel at 200% and leave the plate peeking at precisely the
   text size the gate protects. The form stands as specified.

**Build-gate assertion AH2.** At 200% text, with the grown band measured
on the real component: `scroll-padding-bottom` and footer clearance both
read measured-H + 28 px + S in **both** visibility states; full-hide
travel measures obstruction + 2 with no sliver of band, rule, plate, or
shadow painted; A4's driven-focus proof passes at 200% as at 100%
(Nadia's H13, joined). Runtime growth while HIDDEN updates the transform
in the same frame (Nadia's H14, joined) — a single frame showing a
partial grown band at the hidden offset is a defect against this ruling.

---

## A-H3 — Focus into a hidden bar

**Ruling: STANDS WITH CONDITIONS. The transform-only hidden state is
confirmed as the floor-correct mechanism. Focus forces a show. The
focus-forced show must be a SNAP — no transition — at every motion
setting. Nadia's pre-written fallback (§5.2) governs; the animated return
she provisionally accepted does not.**

### The mechanism — confirmed

While HIDDEN, the bar is transformed off-viewport and **nothing else
changes**: not `display`, not `visibility`, not `inert`, not
`aria-hidden`, not `tabindex`. The five links remain in the tab order and
in the accessibility tree, with labels and `aria-current`, in both
states, at all times. This is the only mechanism under which the standing
requirement — *focus landing on a tab must bring the bar back* — can be
honoured at all, and each alternative is a named failure:

- `visibility: hidden` / `display: none` / `inert` remove the tabs from
  the tab order: the requirement is void by construction, sequential
  navigation loses the primary destinations mid-page, and the nav's
  presence becomes inconsistent across pages and states (SC 3.2.3
  Consistent Navigation, SC 3.2.4 Consistent Identification).
- `aria-hidden` on focusable content is a flat failure (SC 4.1.3 / 1.3.1
  family; ARIA in HTML prohibits `aria-hidden` on focusable elements).

### The transit — ruled: snap

Nadia §5.2 accepts a 150 ms animated return on a `focusin`-driven show
(now 220 ms under Mina's `tabbar.motion.show`), with the snap fallback
pre-written if this seat rules the transit an exposure. **This seat so
rules.** Reasoning:

- At the instant focus lands on a tab of a fully hidden bar, the focused
  element — and its 3 px focus ring — sit entirely below the viewport's
  bottom edge (A-H5's travel puts the whole unit 2 px past it). An
  animated return then paints a run of frames in which the focused
  element is first entirely off-viewport, then partially so, arriving at
  rest up to 220 ms later. SC 2.4.11's minimum fails on an element
  *entirely* hidden by author-created positioning, and SC 2.4.7 requires
  a visible focus indicator — a keyboard user who has just pressed Tab
  is owed a first painted frame in which they can see where focus went,
  not a short film of it arriving. The house standard in this seat's
  playbook (design to the stricter focus geometry; focus is the keyboard
  user's cursor) admits no painted frame with focus off-viewport when a
  zero-frame alternative exists — and here it costs nothing: the state
  change is identical, only the transit differs.
- The snap is also the honest interaction: focus-driven return is not a
  scroll gesture the user is watching unfold; it is the interface
  answering a focus event. Instant is the correct register for an answer.
- **Scope of the snap:** it applies to *focus-forced* shows only —
  `focusin` on any descendant of the `nav` while HIDDEN, from any source
  (Tab, Shift+Tab, VoiceOver swipe-focus, programmatic focus). Scroll-
  driven shows keep Mina's 220 ms ease-out; zone-forced and route-arrival
  states are resting states, not transits. Implementation shape (for the
  build brief): the hidden class is removed synchronously in the
  `focusin` handler **and** the transform transition is suppressed for
  that state change (a no-transition class removed after the bar is at
  rest, or an equivalent mechanism), so the first frame painted with
  focus in the bar shows `translateY(0)` and the full ring. A handler
  that removes the class but lets the transition run is the animated
  return under another name and fails this ruling.
- A focus-forced return **is** a motion event for the purposes of A-H4 —
  and under this ruling it is an instant swap at *every* motion setting,
  so the reduced-motion question for focus shows is settled by this
  section, not by the media query (see §9, Q-A1).

### The rest of the contract — confirmed as specified

- **Focus is never moved, redirected, or dropped** by a hide or a show
  (Nadia §5.2). The focused tab keeps focus through the snap; at rest its
  full 3 px ring is visible, plate ring included.
- **Focus inside the `nav` suppresses HIDE absolutely** (Nadia §5.3):
  the bar never slides away under a working keyboard user. Together with
  the snap-return, this closes both stranding directions: focus cannot
  arrive at an absent bar, and the bar cannot leave under held focus.
- **The 500 ms `focusin` grace window** for page focus (Nadia §§1.7, 5.3)
  and **text-entry suppression** (Nadia §5.3 — HIDE suppressed while an
  `input` / `textarea` / `select` / `contenteditable` holds focus) both
  stand; text-entry suppression is confirmed against SC 2.4.11 in §9
  (Q-A5).
- **No announcement.** Hide/show is never announced — no live region, no
  aria attribute flips on state change (Nadia §5.5). Confirmed: the tree
  does not change, so there is nothing truthful to announce; a murmur on
  every scroll would be noise. **No state cue in the landmark's name or
  description either** (§9, Q-A2): the landmark is "Primary" in both
  states, because in the tree — the only place the name exists — it *is*
  the same bar in both states. A "(hidden)" cue would misdescribe the AT
  experience, would make the same component identify differently from
  moment to moment (SC 3.2.4), and would tell a screen-reader user the
  bar is unavailable at the exact moment it is fully available to them.
- **Sequential-browse consequence, answered plainly:** a screen-reader
  user browsing by virtual cursor meets the nav in the tree while it is
  visually receded. That is not a defect to be fixed; it is the correct
  asymmetry. AT users are not subject to a visual chrome economy, the
  destinations cost them nothing to pass, and the moment browse becomes
  focus (VoiceOver swipe-focus, Tab), §5.2's return fires for any sighted
  person sharing the screen. Sufficient as specified.

**Build-gate assertion AH3.** With the bar HIDDEN at 390 px and 320 px:
(a) Tab / Shift+Tab / VoiceOver swipe onto each of the five tabs — plate
included — results in the bar at `translateY(0)` on the **first painted
frame** after the focus event (computed transform at rest, transition
duration for that state change effectively 0), focus on the tab
throughout, full 3 px ring visible with no part off-viewport or under
any element (joins Nadia H10 and A4/F3). (b) The hidden bar's five links
are reachable by Tab in order, are present in the accessibility tree
with correct names and `aria-current`, and the `nav` carries no `inert`,
`aria-hidden`, `visibility`, or `display` change in the hidden state.
(c) With focus inside the `nav`, no scroll of any size or source hides
the bar (joins Nadia H11). (d) No live-region output and no accessible-
name change accompanies any hide or show.

---

## A-H4 — Reduced-motion treatment of the hide/show transition

**Ruling: STANDS — Mina §3.3 satisfies the floor as specified, with one
build condition on mechanism.**

- Under `prefers-reduced-motion: reduce`, hide and show are **instant
  state swaps** under the site's shipped global rule (all transition
  durations collapse to 0.01 ms): no slide in either direction, **no
  substitute animation** — no fade, no shortened slide, no "gentler"
  travel. The behaviour itself (hide on scroll down, return on scroll
  up) is unchanged; only its movement is removed. This is the correct
  reading of the floor from this seat: reduced motion governs
  *animation from interactions* (SC 2.3.3 at AAA; the vestibular
  standing practice in this seat's playbook — roughly a third of adults
  over 40 have measurable vestibular dysfunction, and a 87 px surface
  travelling the full width of the reading column is exactly the class
  of large-scale translation the preference exists to remove). A fade
  was already excluded for all users (Mina §2.3, opacity never animates
  — intermediate composites of the 92% ground are unmeasured pairs);
  under reduced motion it is doubly excluded. Reduce means the movement
  is gone, not replaced.
- At full motion, the specified transits raise no floor issue: a single
  180 ms / 220 ms transform of one chrome surface, user-initiated by
  scroll, no flashing content anywhere near SC 2.3.1's thresholds, no
  auto-moving content beside other content (SC 2.2.2 does not attach —
  nothing moves on its own, and nothing moves for five seconds).
  Interruption from the current rendered offset (Mina §3.2) stands.
- Focus-forced shows are instant at **every** setting under A-H3, so
  reduced motion changes nothing about them — consistent, and intended.

**Condition / build-gate assertion AH4.** The instant swap must be
*real*, not assumed from the global CSS rule: (a) if the hide/show is
implemented as a CSS `transform` transition, the shipped global
`prefers-reduced-motion` rule governs it and the gate verifies the
computed transition duration of the hide/show is ≤ 0.01 ms under the
emulated preference (Nadia H15, joined); (b) if any part of the transit
is driven by script (WAAPI, `requestAnimationFrame`, a JS easing loop),
the CSS rule does **not** reach it — that part must check
`matchMedia('(prefers-reduced-motion: reduce)')` itself and swap
instantly, and the gate verifies the same ≤ 0.01 ms / single-frame
outcome under emulation. A script-driven slide that survives the media
query is a defect against this ruling however the CSS behaves.

---

## A-H5 — The fully hidden state leaves nothing painted

**Ruling: STANDS — no floor provision requires a painted remnant of a
hidden primary navigation. Mina §2.2's reasoning is adopted, and the
travel distance is verified sufficient.**

- No criterion requires persistent painted navigation. SC 3.2.3
  (Consistent Navigation) governs the relative **order** of repeated
  navigation in the tree — which A-H3's transform-only mechanism
  preserves exactly — not its permanent visibility; SC 3.2.4 governs
  consistent identification of the component when it is presented.
  SC 1.4.11's boundary floor attaches to a component's boundary *when
  the component is there to be identified*; a fully departed bar
  presents no boundary and owes none. A 1–3 px sliver would carry no
  label, no name, and no state, would sit far below any target floor,
  and — as Mina §2.2 items 1–3 argue — would read as a rendering
  artifact while spending the system's most constrained value (the
  top rule at its 3.0217:1 floor, A-H6) on no boundary work. The honest
  states are *bar* and *no bar*; this seat requires the second to be
  complete.
- **Distance verified.** Travel = `translateY(calc(100% + 22px))`:
  border box (65 px + S at Bar A) + 22 px = **87 px + S** of travel
  against **85 px + S** of painted obstruction — the disc's top edge
  rests 2 px past the viewport's bottom edge, its ring's antialiased
  edge and its downward-falling shadow with it. Under Bar B the same
  +2 px clearance holds at every H (A-H2 item 4). Nothing of the plate
  peeks, in either bar, at either text size. A fixed-pixel offset in
  place of the percentage form would void this verification.
- Two completeness conditions, both already implied by the passes and
  stated here so the gate tests them: (i) the translated element must
  not create scrollable overflow or a tappable off-screen region that
  reaches back into the viewport — at the full offset no part of the
  unit, including any focus ring drawn inside it, is painted or
  hit-testable on screen (which is precisely why A-H3 requires the
  focus-forced snap rather than letting focus rest in the hidden
  state); (ii) in the hidden state the bar contributes **0 px** of
  obstruction to every other element — page content, including the
  footer and its links, is fully visible and operable to the viewport's
  bottom edge.

**Build-gate assertion AH5.** At full hide, 390 px and 320 px, Bar A and
Bar B: a screenshot and a DOM-rect measurement show the plate's top edge
≥ 0 px below the viewport's bottom edge (target: exactly 2 px), no
painted pixel of bar, rule, ring, artwork, or shadow inside the
viewport, and no hit-testable bar region inside the viewport (joins
Nadia H1/H13).

---

## A-H6 — The `line-strong` conflict

**Ruling: `#91825C` SHIPS. The conflict is resolved on ground truth, not
on preference: it is the value on `origin/main` today, and it is the
only one of the two that passes the floor on the bar's ground.
`#97865F` must not ship in this component.**

Measured facts (unrounded, computed by this seat):

| Pair | Ratio | Criterion | Floor | Result |
|---|---|---|---|---|
| `line-strong` **#91825C** on `paper-deep` #F0E5CB (the bar's ground; the top rule's and rest ring's outside pair) | **3.0217:1** | SC 1.4.11 | 3:1 | **Pass** — 0.7% headroom; A5 freeze applies |
| `line-strong` #91825C on `paper` #F8F1E1 (the rest ring's inside pair) | 3.3613:1 | SC 1.4.11 | 3:1 | Pass |
| `line-strong` **#97865F** on `paper-deep` #F0E5CB | **2.8475:1** | SC 1.4.11 | 3:1 | **FAIL** |
| `line-strong` #97865F on `paper` #F8F1E1 | 3.1676:1 | SC 1.4.11 | 3:1 | Pass — but not the governing pair |

- **Ground truth.** `git show origin/main:v2/app/globals.css` reads
  `--color-line-strong: #91825C` (line 18, annotated with this seat's
  2026-11-19 ruling). The #91825C value is the Tranche 1.3 fix, shipped
  and live-verified (PR #22 record: rendered pixel sampled at exactly
  #91825C, 3.02:1 on paper-deep). Mina's §1.2 read of `#97865f` came from
  a stale working tree — the same failure mode this project's record has
  flagged before — and her instinct to flag rather than resolve it was
  correct. There is no live conflict in the code; the conflict is
  between the current code and a stale read of it.
- **The floor decides it anyway.** Had both values been live candidates,
  the ruling would be the same: the governing pair for the bar's top
  rule is the rule against the bar's own ground, `paper-deep` — and
  there #97865F measures **2.8475:1, below the 3:1 SC 1.4.11 floor, no
  rounding**. Its recorded "3.2:1 on paper" is honest arithmetic on the
  wrong ground: the rule does not sit on `paper`. A value that passes on
  a ground the component never touches and fails on the ground it ships
  on is a failing value. **Nearest passing value:** #91825C itself —
  the same hue family moved darker along its own value until the
  unrounded pair on `paper-deep` passes — which is exactly the move
  Tranche 1.3 already made. No new colour is prescribed and none is
  needed.
- **Scope, stated precisely so the retirement is not over-read:**
  #97865F survives legitimately in exactly one place — as the **frozen
  RGB literal (151, 134, 95)** inside the listing shadows and the stem
  rule, where it is a shadow tint, carries no boundary or state
  information, and is explicitly marked *do not re-derive*. It must not
  appear as `line-strong`, as the bar's top rule, as the plate's rest
  ring, or as any component boundary in this redesign. The A5 freeze
  stands in full: no lightening of #91825C, no opacity reduction on the
  rule, no rest ring below 2 px; any change to the token voids A5 and
  A-H6 until re-measured. A6's token-freeze scope is unchanged.
- The hide geometry is, as Mina notes, indifferent to this answer — the
  rule translates with the bar under either value. The floor is not
  indifferent, which is why the item was this seat's to rule.

**Build-gate assertion AH6.** The built tab bar's computed
`--color-line-strong` is #91825C; Quinn's gate samples the rendered top
rule and the plate's rest ring on `paper-deep` and confirms the sampled
pair reads ≥ 3.0:1 unrounded (expected 3.0217:1) — a sample below 3.0:1,
or a computed token of #97865F anywhere in the bar, is a build defect
against A5 and this ruling.

---

## Added rulings by this seat

### A-H7 — Forced-colors behaviour of the hidden and shown states

Neither pass specified the hide under forced colors; the behaviour
change raises it, so it is ruled here. **The hide/show mechanism survives
forced colors unchanged, on three conditions:**

1. **Boundaries are real borders, never shadows or backgrounds.** In
   forced-colors mode the system palette replaces the author's, and
   backgrounds and box shadows are stripped. The bar's shown state
   therefore stands on what survives: the 1 px top **border** (a real
   `border-t` as shipped — it maps to a system border colour and remains
   visible), the plate's 2 px rest ring / 3 px `leaf` active ring (real
   borders per A4b — the active ring's forced-colors survival was
   already the reason for that construction), the labels as system text,
   and the glyphs in `currentColor`. The plate's `shadow-listing-flat`
   is stripped in this mode and carries no boundary duty — its loss
   changes nothing the user needs, which is the test every shadow in
   this component must pass. The pressed well, whose edge already does
   not bind (Item 3 of `ADA-RULINGS.md`), likewise loses its fill
   without losing the state, which remains carried by colour-of-text
   (system-mapped), weight, and `aria-current`.
2. **No `forced-color-adjust: none` on any interface part of the bar** —
   not the nav, the rule, the rings, the labels, the glyphs, or the
   focus outline. The single permitted exemption class on this site is a
   true colour specimen (a swatch); the three-seeds artwork is not one —
   and needs no exemption: the disc's identification is carried by the
   "Crops" label, the ring, and position (SC 1.4.1 is satisfied without
   the artwork resolving), so whether the art renders as authored
   (raster) or system-mapped (SVG in `currentColor`), nothing it alone
   carries can be lost.
3. **The hidden state is the same absence in forced colors.** The border
   translates with the element; no system-coloured hairline may remain
   at the viewport's bottom edge in the hidden state, and the
   focus-forced snap (A-H3) operates identically — focus outline in this
   mode is the system's own and is owed the same first-frame visibility.
   Token ratios do not bind in forced colors (the user's palette is the
   contrast guarantee); legibility does, and is a gate render, not a
   computation.

**Build-gate assertion AH7.** Forced-colors renders, shown and hidden,
at 390 px: shown — all five labels legible, glyphs resolved, top border
and plate ring visible as system borders, focus ring fully visible on a
focused tab at rest; hidden — no painted remnant of the bar anywhere in
the viewport; a focus-forced show from hidden lands snapped and fully
outlined, exactly as in the normal palette.

### A-H8 — No hide under a resting finger (moving-target rule)

Mina §7 item 2 states this as a geometric constraint on Nadia; Nadia's
trigger spec does not yet carry it. This seat adopts it as a **floor
condition**, so it binds the build regardless of which spec the builder
reads: **a hide may not begin while a pointer is down on any part of the
bar.** A transition that starts under a resting press moves the pressed
target up to 87 px out from under the finger mid-gesture; the tap then
either lands on page content the user never aimed at or cancels against
a target that left — a pointer-operation failure in the family of
SC 2.5.2 (Pointer Cancellation) and SC 2.5.8's premise that the target
presented is the target activated. The press must either complete as a
tap on a stationary bar or the hide waits for release and re-earns its
run from there. The same rule covers the plate: its hit area and its
paint already move as one rigid unit (Nadia §2, Mina §4 — confirmed);
this condition governs *when* that unit may start moving under a touch
that is already on it. Scroll-driven transits with no press in progress
are unaffected.

**Build-gate assertion AH8.** With a pointer held down on a flank tab
and on the plate, a qualifying downward scroll does not move the bar
until the pointer is released; a tap begun and released on a stationary
tab activates that tab and no other destination.

### A-H9 — Text-spacing overrides and reflow ride the same formula

Bar B was specified for 200% text *size* (SC 1.4.4). Two adjacent
criteria grow the same band and are ruled into the same contract so the
build does not pass one and fail the other: under the **SC 1.4.12
text-spacing overrides** (line height 1.5×, letter spacing 0.12 em, word
spacing 0.16 em, paragraph spacing 2×) the labels' line-height grows and
the band may grow beyond the two-line expectation — the measured-H
formula of A-H2 governs unchanged, labels wrap inside their own slots,
and nothing clips, overlaps, or scrolls within the bar. Under **SC
1.4.10 reflow at 320 CSS px**, the bar remains five slots with no
two-dimensional scrolling in either visibility state, and the hidden
state introduces no horizontal overflow (the transform is vertical
only). No new values arise; this item exists so Quinn's gate runs the
spacing-override render against the hide build and records it, rather
than inheriting the always-visible bar's pass.

**Build-gate assertion AH9.** With the SC 1.4.12 spacing overrides
applied at 320 px and 390 px: band height is measured, clearance and
travel read the overridden H, labels are unclipped in both states, and
the full-hide measurement of AH5 still passes.

---

## 9. Nadia's Q-A1–Q-A6 — answered by cross-reference

Nadia handed six questions (§8.3 of her pass) on the same ground Mina's
§8 covers from the form side. They are answered here so her record
closes; the rulings themselves live in the sections cited and are not
restated at a second strength.

| Question | Answer | Ruling |
|---|---|---|
| Q-A1 · Focus-return transit — animated return, or snap? | **Snap governs.** Focus-forced shows render without transition at every motion setting; the animated return is not approved for focus events | A-H3 |
| Q-A2 · Transform-only hidden state; any state cue in the landmark's name/description? | **Confirmed, and no cue.** Links stay in tab order and tree; landmark stays "Primary" in both states; no announcement of any kind | A-H3 |
| Q-A3 · Constant clearance satisfies A4? Proof targets driven while VISIBLE? | **Confirmed on both points.** Constant shown-state clearance is required, and A4/AH1's proof runs against the visible bar — its worst case | A-H1 |
| Q-A4 · Grown-band margin — must the 8 px scale with band height? | **No.** The margin is absolute (ring + breathing clearance do not scale); formula = obstruction + 8 at every H | A-H2 item 1 |
| Q-A5 · Text-entry suppression aligns with SC 2.4.11 expectations for Search? | **Confirmed.** While a field holds focus and the on-screen keyboard is up, a bar that slid away and returned over the field's reveal-scroll is the obscuring risk; suppression removes it. The cost Nadia names — no reclaim on that page while a field is focused — is accepted: reclaim is a convenience, focus visibility is the floor | A-H3 (contract confirmations) |
| Q-A6 · Bottom-zone forcing — any conflict with A4's footer proof or clearance? | **None — it strengthens both.** The proof was written against a visible bar; bottom-zone forcing guarantees the bar is in exactly that state wherever the footer targets live, so the proof's conditions are the page's resting conditions at its end | A-H1 |

One number in Nadia's pass is superseded by Mina's and should be read
accordingly wherever the two meet: the dwell of §1.4 is defined as the
transition duration; Mina's final durations are 180 ms (hide) / 220 ms
(show), so the dwell is **220 ms — the longer transit — never less**,
with the 2× yank override unchanged. A dwell shorter than the show
transit would let a reversal fire into a bar still travelling, which is
the flip-flop class §1.4 exists to prevent. This is a coordination note
between their two passes, recorded here because both were handed to this
seat; the behaviour remains Nadia's to amend.

---

## Summary of the contract the build must hit (accessibility items only)

1. **Clearance, both bars, both states, state-independent:** Bar A —
   `scroll-padding-bottom` 92 px + S and footer ≥ 92 px + S (inset term
   included). Bar B and any grown band — both properties = measured
   H + 28 px + S, automatically derived from the one measured
   obstruction. No hidden-state selector touches either property. (AH1,
   AH2)
2. **Hidden state:** transform only — `translateY(calc(100% + 22px))`,
   nothing painted, nothing hit-testable, links in tab order and tree,
   no `inert` / `aria-hidden` / `visibility` / `display` change, no
   announcement, landmark name unchanged. (AH3, AH5)
3. **Focus:** `focusin` on a tab forces a **snapped** show — first
   painted frame at `translateY(0)`, full 3 px ring visible; focus
   inside the bar suppresses hide absolutely; 500 ms page-focus grace
   and text-entry suppression as Nadia specified; focus never moved by
   the behaviour. (AH3)
4. **Motion:** scroll-driven hide 180 ms ease-in / show 220 ms ease-out
   as Mina specified (form, hers); reduced motion = instant swaps with
   no substitute animation, by CSS collapse **or** an explicit script
   `matchMedia` gate, gate-verified either way; focus-forced shows
   instant at every setting. (AH4, A-H3)
5. **`line-strong`:** #91825C ships; #97865F appears nowhere in this
   component as a boundary (its frozen shadow-literal use elsewhere is
   untouched); A5 freeze in full force. (AH6)
6. **Forced colors:** real borders carry every boundary; no
   `forced-color-adjust: none` on any interface part of the bar; hidden
   leaves no system-coloured remnant; gate renders both states. (AH7)
7. **Pointer:** no hide begins under a resting press, on a flank tab or
   on the plate. (AH8)
8. **Growth robustness:** SC 1.4.12 spacing overrides and 320 px reflow
   ride the same measured-H formula; labels never clip, shrink, or
   scroll. (AH9)

Nothing in these rulings blocks Dustin's Q6 behaviour or the picked D1
design. The bar may hide — on the contract above, it hides without
taking the floor with it.

*Ada, accessibility specialist. Conformance language: these rulings cover
the hide behaviour's clearance, focus, motion, forced-colors, and token
questions as specified in the two passes named above, on the token values
and geometry stated. They are engineering rulings toward WCAG 2.2 AA,
not a certification of the tab bar or of the site.*
