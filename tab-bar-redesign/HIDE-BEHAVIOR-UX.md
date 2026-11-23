# Tab Bar Redesign — Hide-on-Scroll Behavior (UX Behavioral Spec)

**Seat:** Nadia, UX Design (behavior pass — structure and flows; Mina owns the visual form
of the hide, Ada rules the accessibility floor on this spec, Quinn gates the build)
**Commission:** Dustin's Q6 ruling, 2026-11-22 19:14 PT, verbatim in effect: **hide on
scroll down, return on scroll up.** This overrides the always-visible default every prior
document in this record carried (`UX-STRUCTURE.md` §4.4 excluded hide-on-scroll absent
Dustin's explicit word; he has now given it). There is **no always-visible fallback** in
this spec — hide-on-scroll is the behavior, designed whole.
**Applies to the picked set (Dustin, 2026-11-22):** Direction D1 "The Center Plate" as
drawn, set **Home · Varieties · Crops (plate) · Sellers · Search** — Crops crowned at
centre under the plate (Q3), Account out (Q2). The painted medallion is out; the plate
carries Elena's three-seeds icon art (the Option B favicon/touch artwork) composed for
the 56 px plate. Desktop header takes the stem-rule active treatment ("After A", Q4) —
the header does **not** hide; this spec is mobile-bar only. Ship on design reasoning,
no tap instrumentation (Q5).

**Conflict flagged, per playbook:** the field's guidance (NN/g) warns against hidden
primary navigation, and my own structure pass argued the plate makes hide-on-scroll
less attractive. Dustin's explicit ruling is the house standard and it wins. Two honest
qualifications: (1) the NN/g finding is about navigation that is *never* visible
(hamburger-hidden), not about chrome that recedes on scroll down and returns on scroll
up — a pattern both mobile platforms' own browsers use; (2) the discoverability cost
that remains is mitigated by design below — the bar is visible at the top and bottom
of every page, returns on a shorter upward run than the downward run that hid it, and
is always present to keyboard and assistive-technology users (§5). The cost is accepted
knowingly, on Dustin's word, not argued away.

**Ground truth (§7 gives the full account):** today's bar is a fixed bottom `nav`,
64 px band + `env(safe-area-inset-bottom)`, rendered last in the root layout, `md:hidden`,
with **no scroll behavior of any kind** and no scroll listener anywhere in the layout
components. Content scrolls on the document (no inner page scroller). Clearance today:
`scroll-padding-bottom: calc(5rem + env(safe-area-inset-bottom))` in `globals.css`;
footer `pb-24` (96 px) on mobile. The redesign's D1 contract (Ada A4) already moves
clearance to **92 px + safe-area** against an 84 px obstruction (64 band + 20 plate
rise). This spec builds on that derivation and makes it dynamic.

---

## 1. Trigger model — direction runs, asymmetric hysteresis, zones

The behavior is a two-state machine — **VISIBLE** and **HIDDEN** — driven only by the
document scroller. All values below are CSS pixels of scroll travel unless stated.

### 1.1 The run model (how direction is detected)

- The component listens to window `scroll` (passive listener), sampled at most once
  per animation frame; each sample reads `scrollY` once and does nothing else unless
  a state flip results (§6, failure mode F-a).
- **Effective position** `y = clamp(scrollY, 0, maxScroll)` where
  `maxScroll = document height − viewport height`. All math uses `y`, never raw
  `scrollY` — this is what makes overscroll safe (§1.5).
- Two accumulators, `downRun` and `upRun`. On each sample, `Δ = y − lastY`:
  - `Δ ≥ +2`: `downRun += Δ`, `upRun = 0`.
  - `Δ ≤ −2`: `upRun += −Δ`, `downRun = 0`.
  - `|Δ| < 2`: **dead zone** — the sample is ignored entirely (sub-pixel rounding and
    rubber-band noise can never accumulate).
- A direction reversal therefore *erases* the opposing run. Jitter around a resting
  point — alternating ±3 px samples — can never build either run past a few pixels,
  so the bar cannot flutter at a threshold. This is the hysteresis mechanism; the
  asymmetric thresholds below are the second layer.

### 1.2 Thresholds (the hysteresis pair)

| Trigger | Condition (all must hold) |
|---|---|
| **HIDE** | state = VISIBLE · `y > topZone` (§1.3) · `downRun ≥ 24` · focus conditions in §5 permit · dwell (§1.4) expired |
| **SHOW** | state = HIDDEN · `upRun ≥ 12` · dwell expired — or any forcing event in §1.3/§1.6/§5 |

- **24 down / 12 up is deliberately asymmetric.** Hiding must be a *decision* the
  scroll makes — 24 px is roughly a line and a half of body text, a deliberate reading
  scroll, not a thumb settling. Returning is easier because the intent behind an
  upward scroll is so often "go back / get my bearings," and the navigation is the
  bearing. A bar that is harder to lose than to recover is the whole usability
  posture of this spec.
- On every state flip, both runs reset to 0 and `lastY` re-anchors at the flip point.

### 1.3 Zones — where hide may never engage

Let **obstruction** `O` = the bar unit's total height from the viewport's bottom edge
= `env(safe-area-inset-bottom)` + rendered band height + plate rise (20 px). At 100 %
text, `O = safe-area + 84`. (§3 derives the Bar B grown-band values; §2 uses `O` for
travel distance. One measured quantity drives all three.)

- **Top zone:** while `y ≤ O + 16` (100 px + safe-area at 100 % text), the bar is
  VISIBLE and HIDE cannot fire. Rationale: until the page has scrolled more than the
  bar's own footprint plus a margin, hiding reclaims nothing the user can perceive,
  and the top of a page is where orientation happens — navigation present at arrival
  is the platform expectation. At `y = 0` exactly (and at any negative raw `scrollY`
  during top rubber-banding, which clamps to 0), the state is forced VISIBLE
  immediately — no run required.
- **Bottom zone:** while `y ≥ maxScroll − 2`, the bar is forced VISIBLE. At the end
  of the page there is nothing left to reclaim, the footer's own links sit there
  under the clearance contract, and this rule is what makes bottom rubber-banding
  (§1.5) end in a settled, visible bar instead of a bounce-driven flip.
- **Short pages:** if `maxScroll ≤ topZone`, the bar can never hide. Correct, not a
  defect — a page that barely scrolls keeps its navigation.

### 1.4 Dwell — no flip-flopping across a transition

After any flip, the opposite flip cannot fire for **150 ms** (the house motion token —
Mina's transition duration; if her form pass changes the duration, the dwell equals
it, never less) **unless** the opposing run reaches **twice** its threshold
(48 down / 24 up) inside the dwell — a hard yank always wins immediately. Runs keep
accumulating during the dwell; only firing is deferred.

### 1.5 Overscroll and rubber-banding (iOS Safari)

- All computation runs on the clamped `y` (§1.1). Stretching past the top moves raw
  `scrollY` negative; `y` stays 0; no run accrues; the top-zone rule holds the bar
  visible. Stretching past the bottom pins `y` at `maxScroll`; the bottom-zone rule
  holds the bar visible.
- On release, the bounce-back moves `y` monotonically toward its rest value. A
  bounce at the bottom therefore produces at most a genuine upward run ending in the
  bottom zone (visible); a bounce at the top produces nothing. **No bounce can hide
  the bar, and no bounce can flip it twice.**
- iOS Safari's own chrome collapsing/expanding on scroll is the platform's business;
  this bar is fixed within the layout viewport and its safe-area padding is
  unchanged. The two behaviors coexist — ours adds no compensation for theirs, and
  none is needed: our triggers read document scroll, not viewport height, and
  viewport-height changes are handled as resets (§6, F-d), never as scroll intent.

### 1.6 Route change, arrival, and restored positions

- **Any route change** (tab tap, any link, Back, Forward): the bar arrives
  **VISIBLE** on the new page, runs reset, `lastY` anchors at the new page's initial
  position. Hiding on arrival is prohibited — a user who just navigated is
  orienting, and the bar is the orientation instrument.
- **Scroll restoration** (Back/Forward landing deep, browser reload restoring a deep
  position, a shared link landing on a deep anchor): same rule — starts VISIBLE at
  whatever depth it lands, accumulators fresh from the landing position. It may hide
  only on a *new* qualifying downward run from there.
- **Re-tap of the active tab** (the redesign's scroll-to-top behavior): the bar is
  visible or becomes visible as the scroll rises (upward runs only reinforce
  VISIBLE), lands in the top zone, and stays. Focus stays on the tab throughout.

### 1.7 Programmatic, anchor, and find-in-page scrolls

A finger scroll and a teleport must not be read the same way:

- **Jump classification:** a single-sample `|Δ| > 300` is a *jump*, not a gesture.
  Jumps never count toward either run; both runs reset at a jump. (No single frame
  of a genuine gesture needs classifying — a hard fling's per-frame travel at 60 fps
  stays well under this; a teleport has no intermediate frames at all.)
- **Same-page anchor jumps and hash landings:** treated as arrivals (§1.6) — runs
  reset; if the landing is in the top or bottom zone the zone rule shows the bar;
  at a deep landing the current state is kept but must re-earn any change with fresh
  runs. A user who tapped an anchor deliberately relocated; the chrome does not
  editorialize about it.
- **Find-in-page:** the browser's match jumps are jumps under the rule above and
  can never hide the bar; stepping between matches likewise. Worst case is exactly
  today's always-visible behavior — find-in-page is a no-regression surface.
- **Focus-driven reveal scrolls** (the browser scrolling a newly focused element
  into view): governed by the focus contract, §5.3 — a **500 ms grace window** after
  any `focusin` during which HIDE cannot fire. Runs may accumulate; firing waits.

---

## 2. The plate mid-hide — one rigid unit, full clearance

- **Plate and bar are one rigid unit, unconditionally.** The hide is a single
  transform on the `nav` container; the plate is a child and is never transformed,
  clipped, faded, or animated separately — no stagger, no parallax, no plate lag.
  This is a behavioral rule, not only a visual one: if the plate's paint and its
  hit area ever moved on different curves, the target under the user's finger would
  not be the target they see. At every instant of the transition, the plate's
  offset from the band is exactly its resting offset (20 px rise, centre on the top
  rule).
- **What the hide must clear:** the highest point of the unit is the plate's top
  edge. Travel distance `T = O + 2` — the full obstruction (safe-area + band +
  20 px rise, §1.3) **plus 2 px**, so at full hide the plate's top edge sits 2 px
  *below* the viewport's bottom edge: no sliver of disc, ring, or artwork remains
  visible, and no part of the unit remains tappable on screen. (The disc's
  `shadow-listing-flat` falls *below* the disc inside the band per Mina's spec, so
  no upward shadow needs clearing; the +2 covers anti-aliasing at the edge.)
- At 100 % text: `T = safe-area + 86`. Under the grown Bar B band: §3.
- **Clearance does not shrink while hidden.** The `scroll-padding-bottom` contract
  (Ada A4: obstruction + 8 px margin = 92 px + safe-area at 100 % text) and the
  footer clearance hold their visible-state values in **both** states. The bar can
  return at any moment — a 12 px upward scroll, a `focusin` — and a focused element
  positioned against a shrunken clearance would be under the returned bar, voiding
  A4. Keeping clearance constant also means hiding causes **zero content reflow**:
  the bar is an overlay; the space it reclaims is reading room under the reader's
  eye, not layout. (This is put to Ada as a confirmation question, §8 — it is the
  conservative reading of her ruling and I do not expect it to move.)

---

## 3. The 200 %-text case — Bar B's grown band

Quinn's design-gate ruling (§4 of the gate): **Bar B ships** — at 200 % text, labels
wrap inside their own slot and the band grows in height; clearance tracks the grown
band, and the driven-focus proof runs at 200 % as well as 100 %. Hide mechanics
under the grown band:

- **What grows:** labels at 24 px wrap to two lines; the band grows by up to one
  label line (line-height 1 → **+24 px**), band 64 → up to **88 px**. The plate does
  not grow (56 px disc, 20 px rise — Mina's geometry is text-independent). New
  obstruction: `O = safe-area + 88 + 20 = safe-area + 108`.
- **Everything derived from `O` follows automatically, by formula, not by a second
  set of constants:** travel `T = O + 2` (safe-area + 110), top zone `O + 16`
  (safe-area + 124), clearance `O + 8` (safe-area + 116). The build must measure the
  rendered obstruction (the same dynamic measure Quinn's §4 condition 3 already
  requires for clearance) and feed all four values from it. A hard-coded 84/86/92
  anywhere in the hide path is a defect under this spec.
- **Thresholds do not change.** 24 down / 12 up / dead zone 2 / dwell 150 ms measure
  the *finger's intent*, not the bar's geometry; a taller bar is a reason the
  reclaim is worth more, not a reason the intent test should move.
- **Runtime growth while hidden:** if the band's measured height changes while the
  bar is HIDDEN (text resized mid-session, orientation change), the transform
  updates to the new `T` in the same frame — the grown band's top rule and the
  plate must not peek. The resize also resets both runs and re-anchors `lastY`
  (§6, F-d): a resize is not a scroll gesture.
- **Focus contract unchanged** (§5), with Quinn's addition standing: the A4
  driven-focus proof — footer stem link, last listing card, first focusable under
  the plate's (centre) column — is run at 200 % under the grown band as well.
  Note for the build: with Crops crowned, the plate column is still the centre
  column; the proof's targets are unchanged in kind.

---

## 4. Reduced motion

- The site's global `prefers-reduced-motion` rule already collapses transitions to
  0.01 ms; this behavior **inherits it and adds nothing**. Under reduced motion the
  hide and show still happen — the behavior is functional (it returns reading room;
  Dustin ordered the behavior, not an animation) — but as **instant cuts**: state
  flips with no slide. Thresholds, runs, zones, and the focus contract are
  identical; only the transit is removed.
- This also settles the transit question for focus-driven shows under reduced
  motion: a `focusin` show is instantaneous, so focus is never on a moving target.
  (The same question at full motion is Ada's to rule — §5.2, §8 Q-A1.)
- No other motion exists in this behavior: no bounce, no overshoot, no plate
  animation at any setting.

---

## 5. The keyboard / assistive-technology contract (handed to Ada for her ruling)

The standing requirements, as given: **a hidden bar must never trap or strand
keyboard/AT focus, and focus landing on a tab must bring the bar back.** This section
specifies the behavioral contract precisely; Ada rules on it next (§8 lists the exact
questions). Where a choice had to be made to make the contract specifiable, I made
it and marked it as a decision in §8.

### 5.1 Hidden is a visual state only — never a tree state

In the HIDDEN state the `nav` is transformed off-viewport and **nothing else
changes**: not `display`, not `visibility`, not `inert`, not `aria-hidden`, not
`tabindex`. The five links remain in the tab order and in the accessibility tree,
with their labels and `aria-current`, in both states, at all times.

Why this shape, stated for Ada's ruling: the alternatives each break a standing
requirement. `visibility: hidden` or `inert` would remove the tabs from the tab
order — focus could never land on a tab, and the requirement "focus landing on a
tab must bring the bar back" would be void by construction. `aria-hidden` on
focusable content is a flat WCAG failure. Transform-only is the one mechanism under
which the visual behavior and the AT behavior can both be whole. The known cost —
a screen-reader user browsing sequentially meets the nav in the tree while a
sighted user cannot see it — is answered by §5.2: the moment focus actually lands
there, the visual state ends.

### 5.2 Focus landing on a tab brings the bar back

- **`focusin` on any descendant of the `nav` forces SHOW, immediately and
  unconditionally** — ahead of zones, runs, dwell, and every other rule in §1. The
  state class is removed synchronously in the `focusin` handler; the return then
  animates on Mina's token (150 ms) at full motion, instantly under reduced motion.
- Focus is **never moved, redirected, or dropped** by a show or a hide. The focused
  tab keeps focus through the return; at rest its full 3 px focus ring is visible,
  plate ring included (the plate's focus render is already a build-gate item,
  Quinn F3).
- **Open point handed to Ada (§8 Q-A1):** during the ≤150 ms return transit, the
  focused tab is part-way up from below the viewport edge. My spec accepts the
  animated return (state correct synchronously, ring fully visible at rest); if
  Ada rules the transit itself an SC 2.4.11/2.4.7 exposure, the fallback written
  here in advance is: **focus-driven shows render without transition (snap)** —
  the behavior is identical, only the transit differs. Her call; the build takes
  whichever she rules, and this spec does not need amending either way.

### 5.3 Focus elsewhere — the bar never slides away under a working user

- **Focus inside the `nav` suppresses HIDE absolutely.** While focus is within the
  bar, no scroll event — the user's, the browser's, a script's — can hide it. A
  keyboard user tabbing across the five tabs is standing on the bar; it does not
  move. (This is the "never strand" guarantee in the direction nobody thinks of:
  not focus arriving at a hidden bar, but the bar leaving under held focus.)
- **Focus in the page (any `focusin` outside the `nav`)** starts the 500 ms grace
  window of §1.7: browser reveal-scrolls chasing a Tab keypress travel *downward*
  through a page, and without the grace each Tab could read as a downward run and
  hide the bar mid-traversal — the exact stranding the standing requirement
  prohibits. Grace renews on each `focusin`.
- **Focus inside a text-entry element** (`input`, `textarea`, `select`,
  `contenteditable`) suppresses HIDE for as long as the focus is held (§6, F-d —
  the on-screen-keyboard case). On blur, runs reset and §1 resumes from the
  then-current position.

### 5.4 Activation and what happens after

- Activating a tab navigates (route change): the new page arrives VISIBLE (§1.6).
  The build does **not** programmatically move focus into or out of the bar on
  activation — navigation focus handling stays whatever the router does today;
  this behavior neither steals focus nor manufactures a focus return.
- Re-tap of the active tab (scroll-to-top): focus stays on the tab, bar VISIBLE
  throughout (§1.6).

### 5.5 How a screen-reader user discovers and uses the bar, per state

- **VISIBLE state:** unchanged from today — a `nav` landmark labelled "Primary,"
  five labelled links, `aria-current` on the current section.
- **HIDDEN state:** *identical in the tree.* The landmark, the links list, and
  sequential browse order all present the same bar; a screen-reader user can find
  and use it without knowing or caring that it is visually receded. If their
  navigation (or VoiceOver swipe-focus, which fires `focusin`) lands focus on a
  tab, §5.2 returns the visual bar — which also serves a sighted user sharing the
  screen.
- **State changes are never announced.** No live region, no `aria` attribute flips
  when the bar hides or returns. Hide/show is a visual chrome behavior, not a
  content change; announcing it would be noise on every scroll. (For Ada's
  confirmation, §8 Q-A2.)
- **Keyboard scrollers** (arrow keys, space, Page Down — no focus involved) drive
  the same scroll events a finger does: the bar hides on their downward runs and
  returns on their upward runs and in the zones, exactly as for touch. A keyboard
  user who wants the bar while deep in a page has three always-true paths: scroll
  up 12 px of travel, jump to the top or bottom zone, or Tab to it (§5.2) — plus
  the header menu, early in the DOM, carrying the same destinations (Nadia
  §4.5 parity, unchanged by this spec).

---

## 6. Failure modes designed against

- **F-a · Scroll jank.** The listener is passive and frame-sampled; it reads
  `scrollY` and writes **nothing** except on a state flip (a class/attribute change
  on the `nav`). If built in React, the flip is the only permitted state change —
  a re-render per scroll frame is a defect against this spec. The hide itself is
  transform-only: no layout property animates, content never reflows (§2).
- **F-b · Direction flicker at threshold.** Three stacked defenses: the dead zone
  (|Δ| < 2 ignored), reversal-erasure of runs (jitter cannot accumulate), the
  asymmetric thresholds (24/12), and the dwell with its 2× yank override (§1.4).
  A user hovering at a boundary gets a bar that stays in whichever state it is in.
- **F-c · Teleports misread as gestures.** The 300 px jump classification (§1.7)
  covers find-in-page, anchor jumps, history restoration, and script scrolls.
- **F-d · Keyboard-open and viewport resizes.** A viewport-height change > 100 px
  (Android Chrome's keyboard resize, orientation change, browser chrome settling)
  resets runs and re-anchors `lastY` — resize-driven `scrollY` shifts are never
  counted as scroll intent. While a text-entry element holds focus, HIDE is
  suppressed outright (§5.3): on the Search page or a filter field, the bar stays
  put and stays reachable instead of sliding under or behind the keyboard. On iOS,
  where the keyboard overlays rather than resizes, the same suppression keeps the
  bar from translating away mid-typing and reappearing on dismiss.
- **F-e · Momentum and flings.** Continuous momentum scroll is just a long run —
  it hides once, at threshold, and the state then holds; deceleration produces
  shrinking same-direction samples, never a reversal, so a dying fling cannot
  re-show the bar it just hid. A fling that ends in a bottom bounce lands in the
  bottom zone: visible, once.
- **F-f · Inner scrollers.** Only the document scroller drives this behavior. A
  filter sheet, a menu, or any overflow container scrolling must not hide the bar
  behind which it sits — their scroll events do not reach the window listener's
  math (they do not move `window.scrollY`), and the build must not add listeners
  to them for this feature.
- **F-g · Desktop.** The bar is `md:hidden`; the behavior exists only where the bar
  exists. The desktop header never hides (Q4 was a rendering unification, nothing
  more), and the scroll logic must not attach behavior to it.

---

## 7. Grounding — what this changes vs keeps in the real product

Read from `v2/` on `main`, 2026-11-22: `components/layout/TabBar.tsx`,
`app/layout.tsx`, `app/globals.css`, `components/layout/SiteFooter.tsx`.

**Kept, untouched by this spec:**

- The component, its DOM position (last in the root layout), its five real links,
  labels, `aria-current`, safe-area padding, and `md:hidden` scope.
- **No-JS / pre-hydration behavior is exactly today's:** the server renders the bar
  visible; the hidden state can only ever be applied by hydrated script. Hide is
  an enhancement layered on a present bar (Nadia §4.4's register, now with Dustin's
  Q6 word answering it).
- The clearance *form*: a `scroll-padding-bottom` in `globals.css` plus footer
  bottom padding on mobile.
- The global reduced-motion rule — inherited, not reimplemented (§4).

**Changed by this spec (behavior only; the redesign's geometry changes are Mina's
record, not this one's):**

1. **New:** a scroll-driven VISIBLE/HIDDEN state on the `nav` — the component's
   first scroll behavior of any kind. Today there is no listener, no state, no
   transform.
2. **Clearance becomes measured, not constant.** Today `scroll-padding-bottom` is
   a fixed `calc(5rem + safe-area)` (80 px) and the footer a fixed `pb-24` (96 px).
   The redesign already re-derives the value to 92 px for the plate (Ada A4); this
   spec requires the value to be **derived from the bar's rendered obstruction**
   (one measured quantity feeding scroll-padding, footer clearance, travel, and
   top zone — §1.3, §3), because Bar B's grown band makes any fixed number wrong
   at 200 % text. The footer's fixed `pb-24` satisfies the 100 % contract (96 ≥ 92)
   but **not** the grown-band contract (116 needed) — the build must make the
   footer track the same measure; that is a change this spec imposes, flagged here
   so it is not discovered at the gate.
3. **New focus rules** attached to the bar (§5.2–5.3): `focusin`-forces-show,
   focus-within suppression, text-entry suppression, focus grace. Today the bar
   has no focus-coupled behavior at all (its focus *rendering* — the global 3 px
   ring and the scroll-padding contract — is unchanged).
4. **Nothing else moves.** No route, set, order, or desktop behavior changes in
   this spec; Q4's stem rule is Mina's rendering, already recorded.

**Where this spec constrains Mina's parallel form pass** (behavior bounding form,
nothing more): (a) the transform lives on the single `nav` container — no
per-element or staggered plate motion; (b) travel distance is a computed value
(`O + 2`), not a fixed token — her `tabbar.height` / `tabbar.plate.rise` tokens
feed the measure, they do not replace it; (c) the hidden state may not be built
with `visibility`, `display`, or opacity-to-absent on the unit (§5.1) — the hide
is translation, full stop; (d) the dwell in §1.4 is defined as *her* transition
duration — if she lengthens the transition past 150 ms, the dwell and the
§5.2 transit question both scale with it, and Ada's Q-A1 gets sharper, not softer.

---

## 8. Decisions made, and handoffs

### 8.1 Decisions I have made (and why)

1. **Run-accumulator trigger with reversal-erasure and a 2 px dead zone** — the
   only model in which ordinary scroll jitter is *incapable* of producing a flip,
   rather than merely unlikely to. Threshold-only models flutter; this one cannot.
2. **Asymmetric thresholds: hide at 24 px down, show at 12 px up.** Hiding is a
   decision, returning is a reflex — matches the intent statistics of the two
   directions and both platforms' browser chrome, which returns more eagerly
   than it leaves.
3. **Top zone `O + 16` and a forced-visible bottom zone.** Navigation present at
   arrival and at the end of the page; the reclaim is taken from the middle of
   the scroll, where it is worth something. Bottom-zone visibility also retires
   the whole rubber-band failure class in one rule.
4. **Plate and bar hide as one rigid unit; travel `O + 2`.** Hit area and paint
   never desync; the +2 guarantees zero visible sliver of the plate at full hide.
5. **All geometry derives from one measured obstruction `O`.** Bar B's grown band
   (Quinn's ruling) makes fixed constants wrong at 200 %; formulas stay right at
   every text size and survive future band changes.
6. **Clearance stays at visible-state values while hidden.** The bar's return is
   always one small scroll or one `focusin` away; a shrunken clearance would put
   focused elements under the returned bar and void Ada A4. Hiding reclaims
   overlay space, not layout — content never reflows.
7. **Hidden = transform only; tabs stay focusable and in the tree in both
   states.** The only mechanism under which the standing focus requirement can
   be honored at all (§5.1).
8. **`focusin` on a tab forces an immediate show; focus inside the bar or a text
   field suppresses hide entirely; 500 ms focus grace elsewhere.** Together:
   focus can neither arrive at an absent bar, nor have the bar leave under it,
   nor be chased down a page by reveal-scrolls.
9. **Route changes and restored landings always arrive VISIBLE.** Orientation
   first; hiding must be re-earned by a fresh downward run on the new page.
10. **Jumps (> 300 px/sample) are arrivals, not gestures** — they reset runs and
    never hide. This makes find-in-page and anchor navigation no-regression
    surfaces by construction.
11. **Reduced motion keeps the behavior, removes the transit** — instant cuts,
    inherited from the site's existing global rule; Dustin ordered a behavior,
    and motion preference governs animation, not whether chrome may recede.
12. **No announcement of state to AT, ever.** Hide/show is visual chrome, not
    content; a live-region murmur on every scroll would be noise, and the tree
    itself never changes (§5.5).

### 8.2 Assertions handed to the build gate (Quinn)

These join — do not replace — the design gate's §6 list (A1–A6, F1–F4, M4); where
both speak, both must pass.

- **H1 · Hide fires correctly:** from VISIBLE below the top zone, a sustained
  downward scroll hides the bar once `downRun` reaches 24 px; at full hide, the
  plate's top edge measures ≥ 0 px below the viewport's bottom edge in the DOM
  (target: 2 px below) at 390 px and 320 px, 100 % text.
- **H2 · Rigid unit:** sampled mid-transition, the plate's offset from the band
  (20 px rise, centred) is identical to its resting offset; plate and bar rects
  move by the same delta in every sample.
- **H3 · No flutter:** alternating ±3 px scroll samples for 5 s at depth produce
  zero state flips; a 20 px down / 20 px up / 20 px down sequence produces zero
  flips (no run ever completes).
- **H4 · Eager return:** from HIDDEN, a 12 px upward run shows the bar; a 10 px
  upward run does not.
- **H5 · Dwell and yank:** a show attempted 100 ms after a hide with a 12 px run
  does not fire; the same attempt with a 24 px run fires immediately.
- **H6 · Zones:** at `scrollY` = 0, at any point in the top zone, and at the page
  bottom (`maxScroll`), the bar is VISIBLE regardless of prior state and scroll
  history — including after a hard downward fling into the bottom (exactly one
  settle, visible).
- **H7 · Rubber-band:** on iOS Safari (device or faithful emulation), top
  overscroll never hides; bottom overscroll never hides and never double-flips
  on release.
- **H8 · Arrival:** client-side navigation to a deep page, Back with a restored
  deep position, and a deep-anchor landing each arrive VISIBLE with runs reset —
  proven by: immediately after arrival, a 20 px downward scroll does **not**
  hide (a full fresh 24 px run is required).
- **H9 · Jumps:** a find-in-page jump to a deep match, and a same-page anchor
  jump, do not hide the bar and reset the runs (H8's 20 px test applies after
  each).
- **H10 · Focus return:** with the bar HIDDEN, Tab (or VoiceOver swipe) focus
  onto any of the five tabs — plate included — makes the bar VISIBLE; focus is
  on the tab throughout, is never moved by the behavior, and at rest the full
  3 px ring is visible with no part under any element (390/320 px; joins A4/F3).
- **H11 · Focus suppression:** with focus inside the `nav`, programmatic and
  user downward scrolls of any size do not hide the bar; with focus in a text
  field on `/search`, scrolling does not hide it; within 500 ms after any
  `focusin`, a 24 px downward reveal-scroll does not hide it.
- **H12 · Keyboard-open:** opening the on-screen keyboard (Android Chrome resize;
  iOS overlay) causes no state flip and no run accumulation; the first scroll
  after the keyboard closes is measured from the post-close position.
- **H13 · 200 % text (Bar B):** with the grown band, hidden travel measures the
  grown obstruction + 2 (no sliver of band, rule, or plate visible at full
  hide); top zone and clearance read the grown values (clearance = grown
  obstruction + 8); A4's driven-focus proof passes at 200 % as at 100 %.
- **H14 · Runtime growth:** changing text size while HIDDEN updates the
  transform to the new travel in the same frame — no frame shows a partial
  band — and resets the runs.
- **H15 · Reduced motion:** with `prefers-reduced-motion: reduce`, flips H1/H4
  still occur and the computed transition duration of the hide/show is ≤ 0.01 ms
  (an instant cut).
- **H16 · No-JS floor:** with JavaScript disabled, the bar renders visible and
  fully usable, with no transform applied, on every route the bar serves.
- **H17 · Jank budget:** a scroll trace over a long page shows no DOM write and
  no component re-render on any scroll frame that does not produce a state
  flip; flips are the only writes.
- **H18 · Inner scrollers:** scrolling a filter sheet / overflow container to
  its end does not change the bar's state.
- **H19 · Footer under growth:** at 200 % text, the footer's bottom clearance
  measures ≥ grown obstruction + 8 (the fixed `pb-24` does not satisfy this —
  §7, change 2 — and the gate verifies the tracked value, not the old class).

### 8.3 Questions handed to Ada (she rules next, on this spec + Mina's form)

- **Q-A1 · The focus-return transit.** §5.2 accepts the 150 ms animated return on
  a `focusin`-driven show (state correct synchronously; ring fully visible at
  rest), with a pre-written fallback — focus-driven shows snap without transition
  — if you rule the transit itself an SC 2.4.11 / 2.4.7 exposure. Which governs?
- **Q-A2 · Transform-only hidden state.** §5.1 keeps the hidden bar's links in
  the tab order and the accessibility tree (no `inert`, no `aria-hidden`, no
  `visibility`), because the standing requirement — focus landing on a tab brings
  the bar back — presumes they can be landed on. Confirm this is your reading
  too, and rule on the sequential-browse consequence: a screen-reader user meets
  the nav in the tree while it is visually receded, answered in my spec only by
  §5.2's focus-triggered return. Sufficient, or do you want a state cue in the
  landmark's name/description? (My recommendation: no cue — §5.5 — but it is
  your floor, not mine.)
- **Q-A3 · Constant clearance.** §2 holds `scroll-padding` and footer clearance
  at visible-state values in both states (no reclaim, no reflow, A4 can never be
  voided by a return). Confirm this satisfies A4 as you intend it — including
  that A4's proof targets are driven while the bar is VISIBLE (its worst case).
- **Q-A4 · The grown-band margin.** §3 sets clearance at grown obstruction + 8,
  carrying your A4 margin unchanged under Bar B growth. Confirm the 8 px margin
  need not scale with band height, and that the formula (obstruction + 8, from
  the rendered measure) preserves A4 at both text sizes.
- **Q-A5 · Text-entry suppression.** §5.3 suppresses HIDE while a text-entry
  element holds focus (the keyboard-open case, F-d). Confirm this aligns with
  your SC 2.4.11 expectations for the Search page — the bar stays present and
  reachable while typing, at the cost of the reclaim on that page while a field
  is focused.
- **Q-A6 · Bottom-zone forcing.** §1.3 forces VISIBLE at the page bottom. Any
  conflict with your A4 footer proof or the footer clearance contract as you
  ruled them? (I expect none — the proof was written against a visible bar —
  but the forcing rule is new since your rulings and should be confirmed
  against them, not assumed.)

*— Nadia, UX Design · 2026-11-22. Behavior pass for Q6 complete; handed to Ada
for her ruling and to Mina's form pass as the behavioral bound. The file is the
deliverable; the pick it serves is Dustin's, already made.*
