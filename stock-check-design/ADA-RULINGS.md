# Check Stock Now — Accessibility Rulings (Ada)

**Seat:** Ada, Accessibility — owner of the WCAG 2.2 AA floor for public surfaces.
**Date:** 2026-11-22 · **Status:** Rulings on the assembled design set. No code, no build, no redesign.
**Documents ruled on:** `SPEC.md` (Nadia, UX — §§2.4, 4, 5, 6, 8, 9, 13), `UI-DESIGN.md` (Mina, UI — §§3, 4, 6, 8, 9, 11–14, 16–18), `COPY.md` (Wren — S1–S5, PB-W1–W6), `ENGINEERING.md` (Priya — polling contract §1.4 only, per commission).
**Method:** profession's best practice first (WCAG 2.2 criteria and their Understanding documents), Dustin's house standards on top; conflicts flagged, never silently resolved. Every contrast pair in Mina §13 was recomputed from the hex values by the relative-luminance formula (linearize sRGB; weight 0.2126 / 0.7152 / 0.0722; (L1 + 0.05) / (L2 + 0.05)) — none of her arithmetic was taken on faith. Conformance language: these rulings are engineering evidence that the *design* meets the floor as specified; they are not certification, which comes only from a specialist firm testing with assistive technology and disabled users.

**Summary of outcomes:** PB-CSN-2 closed (button-in-form stands; Dustin's word "link" stands as the visible design). PB-CSN-1 closed (44px house standard governs; Mina's geometry passes). §9.1 checking announcement approved as a scoped departure. K-20 accepted knowingly at 4.5520:1. DR-2 ruled for Mina (static hold stands). No contrast failures. Four floor prescriptions the other documents missed are at §7 — two of them (single-owner announcements, state-(e) focus landing under the reconciled model) are build-blocking.

---

## 1. Element semantics — PB-CSN-2 closed

**Ruling: the control is a `<button type="submit">` inside a minimal `<form method="post">`, exactly as Nadia §2.4 and §8 specify. This is definitive for the build. Dustin's word "link" stands in full as the visible design and does not stand as the element's semantics.**

The measured facts and criteria:

- The control performs an action (it fires a check; it changes server state; it navigates nowhere). Under WCAG 4.1.2 (Name, Role, Value) and 1.3.1 (Info and Relationships), the programmatic role must match the operation. A link role promises navigation — screen-reader users encounter links in link lists, expect a destination, and expect Back to undo the trip. A button role promises an action in place. Putting a link role on this operation would be a false programmatic statement, and no visual preference can license a false statement to assistive technology.
- The visible design is untouched by this ruling. "Link" as Dustin used the word names a look — small, quiet, inline text in the stock line's sentence — and Mina §4 delivers exactly that look (13px, link color step, always-on underline, no box). Semantics are not visible. Nothing Dustin asked to *see* changes.
- If Dustin overrules and demands a literal link element, the floor consequences are his to accept knowingly, and they are recorded here so the choice is informed: the endpoint becomes GET, with the prefetch/scanner exposure Nadia §8 names; the role statement to assistive technology becomes false; and this seat records a known 4.1.2 non-conformance against the surface. Recommendation: do not overrule.

**Keyboard and screen-reader behavior of the no-JS floor form (ruled conforming, with one named difference):**

- The button is natively focusable, appears once in the tab order at its DOM position in the stock line, and activates with both Enter and Space (Enter submits the form natively; Space activates the button). No script is needed for any of that — this is precisely why the form is the floor and a bare button is not.
- On the floor path, activation navigates and returns to the same page anchored at the same card (Nadia §8). One difference from the enhanced path is ruled acceptable and must be understood by Quinn's CSN-14 drive: after a full navigation, focus sits at the document start by platform convention — a new page context resets focus, which is expected behavior users of forms rely on, not a dropped-focus failure. The §3 focus discipline below governs the *enhanced* path, where no navigation occurs. CSN-14 must therefore assert the anchor scroll position on the floor path, not a focus position. What the floor path must never do is present the control inert, pre-hydration or otherwise — the form satisfies this by construction.
- The form must carry no other fields and no other submit control; the button's `type="submit"` must be explicit (an untyped button inside a form is a submit button by default, but the build states it, so no future edit can change the behavior by accident).

---

## 2. Live-region rulings

### 2.1 The region — one per card, polite, atomic, persistent, single-owner

**Ruled:** each card carries exactly one persistent live region for this feature: `aria-live="polite"`, `aria-atomic="true"`, present in the document from first render, never remounted across any state change (Nadia §9.1, Tranche 3 §2.5.9 pattern — upheld). Assertive politeness and `role="alert"` are prohibited for every event in this feature, including couldn't-check (Nadia §9.7 upheld — nothing here requires immediate attention).

**Prescription — single-owner announcements (build-blocking; nobody raised this):** Nadia §9.1 makes the stock line's *wrapper* the region, §9.2 makes the slot a persistent wrapper, and §9.7 makes the checking status "a status" — but `role="status"` is itself an implicit live region. Stacked mechanisms double-announce: a status element inside an `aria-live` wrapper, or a region whose text includes the visible stock line (whose own mutation at the swap would announce the line's new text *in addition to* the S3 string), produces compound or duplicated speech. The testable property, which is the ruling, is: **exactly one announcement, containing exactly the intended string, per event.** To make that achievable, the live region's announced content is limited to the announcement/status strings (S1, S3, and the §2.4 couldn't-check announcement); the interactive control must not sit inside an `aria-atomic` region, and the visible stock line's own text mutations must not be the announcement mechanism. If the build's wrapper-as-region structure cannot pass the one-announcement test in NVDA, JAWS, and VoiceOver, the build restructures to a dedicated visually-hidden live region inside the persistent slot wrapper — that restructure is pre-authorized by this ruling as a floor fix, not a redesign. Quinn's gate tests the property (one announcement, exact string), not the mechanism.

**Prescription — clear between events (build-blocking; nobody raised this):** the announcement node must be emptied between events (the clear-then-set pattern). If an S3 string remains resident in the region, a later identical announcement — the same card re-checked 24 hours on, returning the same confirming result — produces no text mutation, and several screen readers will not re-announce unchanged content. The feature would then resolve into exactly the silence §6.1 of the spec forbids. Server renders must ship the region empty of S3/S4 announcement text (see also §2.5).

### 2.2 The checking announcement — §9.1 departure approved

**Ruled: Nadia's scoped departure stands. Entering the checking state announces once, with S1 ("Checking…"), for the visitor who activated or joined the check in the current page session.**

Reasoning: the house discipline Nadia departs from ("announces no loading or intermediate states") was written for result counts, where the user took no per-item action. Here the announcement is the acknowledgment of a deliberate activation — the screen-reader user's equivalent of the visible status change the spec (§4.2) requires in the same frame for sighted users. WCAG 4.1.3 (Status Messages) points the same way: a status that is shown visually must be programmatically determinable without moving focus. Withholding the announcement would leave a tap unacknowledged for up to ~25 seconds (Priya's envelope) — the worse failure. The departure is scoped exactly as Nadia scoped it: this feature announces no counts, no page-level state, and no intermediate progress — one announcement on entering checking, one on resolution, nothing between.

Conditions: (a) a card *rendered* mid-flight for a visitor who did not activate or join in this session announces nothing on load — initial region content is not an announcement, and the build must not manufacture one post-hydration; (b) polling ticks, retries, and the passage of time never re-announce checking; (c) where focus is moved to the status element under §3, the focused element's own reading and the live announcement are the same event — the single-owner rule of §2.1 applies, and the gate's screen-reader pass must hear S1 exactly once, not twice.

### 2.3 Result announcements — confirming results included

**Ruled:** on resolution with an observation, the region announces exactly once — the flipped form or the confirming form of S3 — when, and only when, the visitor started or joined the check in this session and the card is on-screen at resolution (Nadia §§5.2, 6.1 upheld). The confirming announcement is mandatory, not optional: a deliberate action that resolves into silence teaches the user the control cannot be trusted, and the date segment's visual refresh is not a channel a screen-reader user receives. A late result under Nadia §7.2 (arriving after a timed-out attempt, while the participant is still on the page with the card on-screen) announces as a result under this same rule, in the same swap that removes the notice.

### 2.4 Couldn't-check — an announcement is required (gap in the spec, closed here)

Nadia §9.1's cadence names two announcements (checking, result) and §4.5 designs the couldn't-check notice as visible text — but a participant using a screen reader who activated the control receives, under the cadence as written, a checking announcement and then nothing: the failure would be the one resolution never announced. **Ruled: a couldn't-check resolution announces exactly once, on the same region, with the S4 notice text as the announcement content.** It is a resolution of a deliberate action and takes the same channel and politeness as a result. The notice is plain text in the card flow (not an alert — §2.1), and because the notice also persists visibly, the single-owner rule applies: insertion of the notice must not produce a second, separate announcement of the same words from a second mechanism.

### 2.5 PB-W4 — the "checked just now" timing requirement, stated as a testable rule

Wren's PB-W4 is upheld and converted into the following accessibility property, which Quinn can test as written:

> **The S3 announcement is inserted in the same DOM update (the same render commit / mutation batch) as the atomic stock-line swap it describes. It is never stored, queued, persisted, server-rendered, or replayed. If an announcement cannot fire as part of that update, it does not fire at all.**

Consequences that follow and are part of the ruling: (a) a fresh render, a reload, a return visit, and a PWA restoration contain no S3 text and announce nothing about past checks — the off-screen rule (Nadia §5.2) is one instance of this, not a separate rule; (b) once the client's polling window closes (Priya §1.4: 2-second polls, 30 seconds maximum), later landings update the card silently — an announcement fired after the window would say "just now" about a check the user has stopped waiting for, and would be false in the site's own voice within a minute in any case; (c) "just now" is bounded by Wren's S2 rung (under one minute) — the same-update requirement keeps the real latency at milliseconds, three orders of magnitude inside the bound. CSN-7's announcement assertion should test timing (announcement and swap in one commit) and non-persistence (no S3 text in a fresh render), not text alone.

### 2.6 What must never be announced

Polling ticks and elapsed wait; the `deferred` outcome's internal bookkeeping (but see §7.3 — a *silent exit* from the checking state is separately prohibited); other cards' results on this card's region, and any result on any page-level region; the fresh-to-stale boundary crossing at render; emphasis/wash events (decorative); any price (no price exists in any payload — Nadia §3.4/CSN-16 — and none may ever enter an announcement); and the same event twice, from any combination of mechanisms (§2.1).

### 2.7 Accessible name — S5 ruled

**Ruled: Wren's S5 pattern stands — "Check stock now for {Variety} at {Seller}".** It satisfies WCAG 2.5.3 (Label in Name): the accessible name begins with the visible label verbatim, so voice-control users speaking the visible words activate the control. It satisfies 3.2.4 (Consistent Identification): one pattern on both surfaces, the shop context's mild redundancy accepted for exactly the consistency reason Wren gives. Implementation conditions: if the name is supplied by `aria-label`, it replaces the content wholesale and must therefore reproduce the pattern exactly, punctuation included; the name is per-listing static and needs no live updating; the checking status and the S4 notice take no accessible name (they are not controls — Wren is correct).

---

## 3. Focus discipline

The Tranche 3 invariant governs every transition below: **focus is never dropped to `body` and never stolen; it is always somewhere deliberate inside the same card, or exactly where the visitor left it.**

1. **Activation (control → checking status).** Nadia §9.2's stated exception is approved: when activation replaces the control, focus transfers programmatically to the status element (`tabindex="-1"`) in the same update. A control that removes itself must land focus by design (Tranche 3 §2.6.3 precedent). Conditions: the status element is never in the tab order; it carries its S1 wording as its text, so the landing is perceivable (the focused element reads "Checking…"); no visible focus ring is required on this non-interactive landing target, and none may be faked onto it to imply interactivity.
2. **Resolution to fresh.** If focus is still on the status element, it lands on the card's heading link — the always-present primary control one stop earlier in the card's tab order (seller heading link in variety context; variety-name heading link in shop context). If the visitor has moved focus anywhere else during the wait, it is **never touched**. Nadia §9.2 upheld in full.
3. **Resolution to couldn't-check — under the reconciled model (prescription; nobody addressed this).** Nadia's §9.2 lands focus on the returned control, but under the coordinator's reconciled model (Mina §8, Wren S4) no control returns for 24 hours — the status element disappears and, unhandled, focus drops to `body`: a floor failure. **Ruled: under the reconciled model, resolution to couldn't-check lands focus on the card's heading link, under the same condition as the fresh case (only if focus still rests on the status element).** Under Nadia's model, if Dustin restores it, focus lands on the returned control. Either way the landing is designed, never accidental. Quinn's CSN-15 drive must be re-pointed to whichever model ships — flagged at §8.
4. **The contradiction swap.** The swap itself moves no focus and remounts nothing: the slot wrapper and the heading survive it as the same nodes, so a focus resting anywhere in the card is undisturbed by the word, dot, dress, and date changing around it.
5. **The shop grid, under either OQ-CSN-1 outcome.** Under the recommended hold-position behavior, focus is trivially safe: no node moves. If Dustin rules re-ordering, the guarantee becomes conditional, and the condition is stated now: the flipped card's DOM node must be **moved, never remounted** (the same node keeps focus, focus order, and any in-progress interaction); focus resting on any *other* card must not change its element or its position relative to the reader's place; and the behavior ships only if a CSN-15-style keyboard drive — focus on the flipped card's heading and on its slot across the re-order — passes in a real browser. Absent that proof, hold-position is the only outcome under which this seat's focus guarantee is unconditional. This is recorded as accessibility input to OQ-CSN-1, not as a veto: the decision remains Dustin's.
6. **Off-screen and backgrounded resolutions** move no focus, ever (Nadia §5.2 upheld).

---

## 4. Target size — PB-CSN-1 closed

**Which is floor and which is house, stated plainly:** the WCAG 2.2 AA floor is criterion 2.5.8 (Target Size, Minimum) — **24 × 24 CSS px**, subject to its spacing and inline exceptions. The **44px** standard is Dustin's house standard (it coincides with the AAA criterion 2.5.5 value). The house standard governs this build; the floor is recorded so nobody later mistakes a 24px pass for compliance with the house rule, or the 44px rule for a WCAG requirement.

**Ruling: PB-CSN-1 is resolved for the house standard, and Mina's geometry (§3.2) is verified against both.** The control is `inline-flex`, `min-height: 44px`, `min-width: 44px`, `padding-inline: 8px`, `padding-block: 0`, rendering at ≈104–111px wide × 44px tall — past the house standard on both axes with the width more than doubled, DOM-measurable per CSN-2. Three verifications beyond the numbers:

- **The hit area is the element's own box** (min-height and padding on the button itself), not a pseudo-element overlay extending over neighbors. An overlay would risk overlapping the heading link above or the packet lines below and failing 2.5.8's spacing logic in spirit and in test. Mina's construction does not do this. Pass.
- **No exception is relied on.** Criterion 2.5.8's inline exception (targets within a sentence) arguably covers a control inside a text line; this design does not invoke it. The full house size is delivered inside the sentence, which is the stronger position and the one PB-CSN-1 asked for. The named cost — the stock line's box grows ≈23px when the control or status is present — is accepted as the price of the house standard, absorbed per card type as Mina §3.2 describes (ledger: ordinary height variance; grid: the pinned footer). No compensating fixed height may be introduced (it would break the growth behavior §7.4 requires).
- **The 320px pre-ruled fix is approved in advance:** if CSN-2's DOM measurement shows the control unit crowding the card edge at 320px, inline padding drops 8px → 4px at the smallest band only, giving ≈103px × 44px — still past the house standard on both axes. Type size and phrase integrity are never the fix. The checking status's identical 44px box is a stability measure, not a target; it takes no taps (Nadia §4.2, CSN-4) and is not measured as one.

---

## 5. Contrast verification — all 20 pairs recomputed

Method per the header. Floors: 4.5:1 for text (every text element in this feature is 13px; none qualifies as large text), 3.0:1 for non-text (focus ring, pulse dot as graphic). **No value below is rounded into a pass; ratios are shown to two decimals with the unrounded computation behind them.** Mina's claimed values agreed with recomputation within 0.01 on all 20 pairs — her arithmetic is verified, not merely consistent.

| # | Pair (foreground on background) | Recomputed | Floor | Verdict |
|---|---|---|---|---|
| K-1 | link `#1F5C3D` on surface `#FFFDF6` | 7.77:1 | 4.5 | PASS |
| K-2 | link `#1F5C3D` on paper `#F8F1E1` | 7.02:1 | 4.5 | PASS |
| K-3 | leaf `#1E4634` on surface | 10.42:1 | 4.5 | PASS |
| K-4 | leaf `#1E4634` on paper | 9.42:1 | 4.5 | PASS |
| K-5 | leaf `#1E4634` on leaf-50 `#E3EAD8` (active wash) | 8.60:1 | 4.5 | PASS |
| K-6 | focus `#7A3E10` on surface | 8.17:1 | 3.0 | PASS |
| K-7 | focus `#7A3E10` on paper | 7.39:1 | 3.0 | PASS |
| K-8 | focus `#7A3E10` on leaf-50 `#E3EAD8` | 6.75:1 | 3.0 | PASS |
| K-9 | muted `#6A5F4C` on surface | 6.15:1 | 4.5 | PASS |
| K-10 | muted `#6A5F4C` on paper | 5.56:1 | 4.5 | PASS |
| K-11 | leaf-600 `#2E6B4F` on surface (pulse dot, graphic) | 6.19:1 | 3.0 | PASS |
| K-12 | leaf-600 `#2E6B4F` on paper (pulse dot, graphic) | 5.60:1 | 3.0 | PASS |
| K-13 | ink-soft `#4A4438` on surface (S4 notice) | 9.49:1 | 4.5 | PASS |
| K-14 | ink-soft `#4A4438` on paper (S4 notice) | 8.58:1 | 4.5 | PASS |
| K-15 | leaf `#1E4634` ("In stock") on paper-deep `#F0E5CB` (wash) | 8.47:1 | 4.5 | PASS |
| K-16 | petal `#8E2A52` ("Sold out") on paper-deep | 6.44:1 | 4.5 | PASS |
| K-17 | leaf-600 `#2E6B4F` ("Preorder") on paper-deep | 5.03:1 | 4.5 | PASS |
| K-18 | muted `#6A5F4C` (date segment) on paper-deep | 5.00:1 | 4.5 | PASS |
| K-19 | muted `#6A5F4C` ("Shop closed") on paper-deep | 5.00:1 | 4.5 | PASS |
| K-20 | warn `#8A5E08` ("Unknown") on paper-deep | **4.55:1** (unrounded 4.5520) | 4.5 | **PASS — ruled explicitly below** |

Supplementary pairs computed by this seat to close gaps in the table: focus `#7A3E10` on paper-deep `#F0E5CB` = **6.65:1** (floor 3.0, PASS — a focus ring adjacent to the washed line at resolution); warn `#8A5E08` standing pairs, confirming Mina §13's summary claim: **5.60:1** on surface, **5.06:1** on paper (floor 4.5, PASS both).

**No pair fails. No nearest-passing-value fix is prescribed, because there is nothing to fix.**

### K-20 — explicit ruling (OQ-M1)

**Accepted, knowingly, as designed. Mina's recommendation is upheld.** The basis is the ratio, stated without decoration: warn `#8A5E08` on paper-deep `#F0E5CB` computes to **4.5520:1 unrounded**, which meets the 4.5:1 floor of criterion 1.4.3 on its own numbers — not by rounding (4.5520 rounds to 4.55, and either way it is above 4.5 before any rounding occurs), and **not** by its transience. WCAG 1.4.3 has no duration exception, and this ruling does not invent one: the pair would pass if the wash were permanent. The transience (≤2.4s animated; 3.0s static hold under reduced motion, §6) and the redundancy (the word "Unknown" carries its meaning as text; the dot is decorative beside it) are recorded as context, not as grounds.

Two conditions attach, because the margin is 0.05 and thin margins are where silent regressions live: (a) **any future change to either token — `color.warn` or `color.paper-deep` — voids this ruling automatically** and the pair must be recomputed before the token change ships; (b) if headroom is ever wanted, the fix is prescribed in advance in this seat's manner — move the *wash ground's* value, not the shipped warn word (darkening warn would re-value a token with directory-wide jobs; a one-step deeper paper-deep raises K-15 through K-20 together, and every one of those pairs must be recomputed at the new value before adoption). That is an option recorded for Iris and Mina, not a requirement: the design as specified passes.

**Pulse-dot trough (Mina §13, final note) — ruled:** at the breath's trough (opacity 0.3), the dot's effective ratio against the card ground computes to ≈1.54–1.57:1. No floor attaches: criterion 1.4.11 governs graphics *required to understand the content*, and this dot is `aria-hidden`, decorative-redundant — the S1 wording carries the checking state in every mode (Nadia §9.3). At full opacity the dot passes 3.0:1 in any case (K-11/K-12). Mina's reasoning is correct and is adopted, with the standing condition that the wording must never be removed while the dot remains.

---

## 6. Motion — DR-2 ruled; the breathing dot

**DR-2: Mina's reduced-motion variant stands. Nadia's "suppressed" phrasing is overruled, with the conflict flagged rather than silently resolved** (Nadia §6.1 vs Mina §§9.3/16 DR-2; the coordinator carries the flag). Reasoning: `prefers-reduced-motion` is a request to remove *motion* — vestibular triggers are movement, parallax, zoom, and travel — not a request to remove *information*. A static wash that steps on at full strength, holds, and steps off involves no transition, no movement, and nothing animated; it is a state change, of the same kind as the sold-out dress swap itself, which nobody proposes suppressing. Suppression would leave the reduced-motion visitor as the only on-screen witness with no visual signal that the line changed, while screen-reader users receive the announcement — an unequal outcome produced in the name of the very users it short-changes. **Conditions:** under reduced motion the wash appears and is removed with **no transition in either direction**; the hold is **3000ms**; and the hold must be carried by the timed-class mechanism Mina §9.3 specifies, because the shipped global reduced-motion rule collapses CSS animation durations — an animation-driven hold would be collapsed to a flash. Quinn verifies the static hold under reduced-motion emulation, at full strength, for its full duration.

**The breathing dot (Mina §6.3): approved.** Opacity 1 → 0.3 → 1 over 1600ms, `ease-in-out`, on an 8px dot: no translation, no rotation, no scale — nothing that engages the vestibular system. Flash safety (criterion 2.3.1): one opacity cycle per 1.6 seconds is ≈0.6 cycles per second, far below the three-flashes-per-second threshold, over a minute screen area with a modest luminance step; no PEAT analysis is required for a change of this size and rate, and the record states why rather than assuming. Under reduced motion the pulse stills at full opacity (1) — **prescription:** the build must remove the animation under reduced motion (`animation: none` or equivalent), not merely shorten it; a collapsed-duration infinite animation can strobe, and a strobing "stilled" dot would convert the safest element in the feature into its only flash risk. The dot remains decorative-redundant in all modes (§5, trough ruling).

**What must still (complete list):** under `prefers-reduced-motion` — the pulse (above), the wash's fades (replaced by the static hold), and any transition on the sold-out dress swap (the global rule already collapses transitions; the swap itself is an instantaneous state change and is permitted). Nothing else in this feature moves in any mode; Mina §12's invariant — no spinner anywhere, in any state, under any preference — is endorsed and made part of this ruling.

---

## 7. The sweep — floor issues nobody raised

### 7.1 The notice's 1.5 leading (§14 flag) — accessibility clears it; the ceiling question is Thea's

Mina §14.5 flags the S4 notice's line-height 1.5 as sitting above Thea's 145% body ceiling and asks, in effect, whose call it is. **From the floor: no objection — 1.5 is affirmatively safe.** WCAG 1.4.12 (Text Spacing) requires that content survive a *user* override to line-height 1.5 with no loss or clipping; an author value of 1.5 cannot itself violate anything, and the notice sits in no fixed-height container, so nothing clips. For 13px text wrapped in a 108–143px measure, read by an audience with aging contrast sensitivity and magnifier viewports, the extra leading is a readability gain, not a risk. The 145% figure is a house typography standard, not a WCAG value, so the deviation is **deferred to Thea with this seat's evidence attached**: the floor is indifferent between 1.45 and 1.5, and slightly favors 1.5 at this size and measure. If Thea rules 1.45, the design takes her value with no accessibility consequence in either direction.

### 7.2 Single-owner announcements and clear-between-events

Prescribed at §2.1 — repeated here for the register: stacked live mechanisms (wrapper region + `role="status"` + the visible line's own mutations) and resident announcement text are the two most likely ways this feature fails real screen-reader testing while passing every automated check. Both are build-blocking prescriptions with testable properties.

### 7.3 The `deferred` outcome must not exit checking silently

Wren's coverage table (COPY §2) rules `deferred` (Priya §5.1: domain pacing spent no fetch and burned no window) as: the card stays in checking until the bound, then returns to idle/stale plain with the control — no notice, correctly, since no failure occurred and no wording may imply one. But a participant who activated the control and heard "Checking…" cannot be returned to a silent idle: the checking state they were told about has ended, and 4.1.3's logic (§2.2) requires that ending to be determinable. **Ruled: either the card remains in the checking state until a real resolution (result or couldn't-check) within the attempt bound, or the exit from checking on a deferral announces once that checking ended without a result — which requires a Wren slot that does not yet exist.** The first option is recommended (Priya's envelope makes deferral rare and bounded); the choice and, if needed, the wording are flagged for the coordinator at §8. What is prohibited is the silent exit.

### 7.4 Text-spacing overrides at 320px on the grid card — a test Quinn does not yet own

Mina §11 verifies the 1.4.12 overrides (letter-spacing 0.12em, word-spacing 0.16em) widening the control unit to ≈135px, and §3.4 verifies the ≈111px unit against the grid card's 108px measure at 320px — but not the two together: a ≈135px `nowrap` flex item in a 108px measure at the reflow floor is the one composition in the set that could force overflow or clipping (criteria 1.4.10 Reflow, 1.4.12). **Prescription:** CSN-2 gains an explicit case — 320px, 1.4.12 overrides applied, grid card — asserting no horizontal scroll and no clipped phrase. If it fails, the permitted fix is that the control unit may wrap *under override conditions only*; the design-size `nowrap` (§4 of Mina's wrap rules) stands, because 1.4.12 tests the user's override environment, not the design's own sizes. Nothing else in the feature fixes a height or clips overflow, so the rest of the 1.4.12 surface is clean by construction.

### 7.5 Non-participant renders of the reconciled notice must not announce

Under the reconciled model the S4 notice is standing listing state, rendered to any visitor inside the window (Mina §8.1). Server-rendered in initial HTML, it announces nothing on load — correct. **Ruled:** the build must not insert the notice into the DOM after the live region registers on a non-participant's client (a hydration-time insertion would announce someone else's failed check to a bystander, violating Nadia §5.2's principle). Participants receive the notice through the §2.4 announcement path; non-participants receive it as silent initial content. Same words, two delivery disciplines.

### 7.6 Forced colors — verified clean, one note

Mina §12 is correct: every distinction in the feature is carried by text, underline, or outline, so forced-colors mode costs only decoration (wash gone, dot remapped, announcement and facts intact). One note for the build: in forced-colors mode the button acquires the system's button face and will *look* like a button, not a text link — that is the user's own chosen rendering, it preserves identifiability, and it is not a defect to be "fixed" with `forced-color-adjust` exemptions. No exemption is authorized for any element in this feature.

---

## 8. Flags — for Quinn and for Dustin

**For Quinn (gate inputs):**
1. CSN-15 must be re-pointed for the reconciled model's state-(e) focus landing (§3.3: heading link, not a returned control) if the reconciliation ships; CSN-10 likewise (per Wren PB-W1 and Mina DR-1 — outside this seat's rulings, noted because CSN-15 is an accessibility check).
2. New testable properties from these rulings: one-announcement-exact-string per event in NVDA/JAWS/VoiceOver (§2.1); identical repeat announcements still fire (§2.1, clear-between-events); S3 timing — announcement and swap in one commit, no S3 text in any fresh render (§2.5); the reduced-motion static hold at full strength for 3000ms with no transition and no strobing dot (§6); the 320px + 1.4.12-override grid case (§7.4).
3. Rendered verification remains Quinn's: nothing in this document is a rendered measurement — contrast is computed from token hex values, target geometry from specified values, and every rendered claim is a specification to be proven at the gate.

**For Dustin (decisions and knowing acceptances):**
1. **PB-CSN-2 closure (§1):** your word "link" is honored completely in what visitors see; the element is a button in a form because it *does* something rather than *going* somewhere, and because the no-JavaScript floor requires a form. Overruling is possible and its costs are recorded at §1 — this seat recommends against it.
2. **OQ-CSN-1 input (§3.5):** hold-position keeps the focus guarantee unconditional; re-ordering is buildable only under the move-never-remount condition with a passing keyboard drive. The decision is yours; the accessibility price of each outcome is now on the record.
3. **K-20 (§5):** the thinnest pair in the design passes at 4.5520:1 and is accepted; any future change to the warn or paper-deep token reopens it automatically.
4. **The reconciled couldn't-check model** (attempt-keyed 24-hour window; Mina DR-1, Wren PB-W1) is a coordinator's reconciliation awaiting your confirmation, not this seat's ruling — but two of its accessibility consequences are now designed for either outcome: focus landing (§3.3) and non-participant announcement discipline (§7.5). The `deferred` exit question (§7.3) also needs a decision if that outcome ships as Wren's table describes.

**Conflicts flagged, none silently resolved:** DR-2 (motion — ruled for Mina over Nadia's phrasing, §6); DR-1 / PB-W1 (couldn't-check model — coordinator's reconciliation, Dustin confirms; accessibility designed for both outcomes); §14.5 leading (floor clears 1.5; Thea's ceiling is hers to enforce or waive, §7.1). No conflict in this set touches the legal floor unresolved: every floor question put to this seat has a ruling above.

*— Ada, Accessibility. Evidence: the four design documents as listed in the header; WCAG 2.2 criteria 1.4.1, 1.4.3, 1.4.10, 1.4.11, 1.4.12, 2.3.1, 2.4.7, 2.5.3, 2.5.8, 3.2.4, 4.1.2, 4.1.3; contrast recomputed independently from the shipped token hex values (all 20 pairs, plus three supplementary pairs computed by this seat). No code was written or changed, and the file is left uncommitted for the coordinator.*
