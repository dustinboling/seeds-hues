# Tab Bar Redesign — DELTA DESIGN GATE: Hide-on-Scroll Package (Quinn, QA)

### Seed Directory (seeds.hues.flowers) · 2026-11-22 · Delta gate on Dustin's Q6 ruling (2026-11-22 19:14 PT)

**Gate:** Quinn Assurance, independent QA. **Evaluator structure:** single
evaluator (this seat). The findings below are document-consistency and
ruling-fidelity findings, each resting on quoted text or a verified source
read; severity ratings are single-evaluator ratings and carry that flag.

## Verdict: PASS WITH NOTES

The package is buildable as it stands: every substantive question the hide
behaviour raises is answered somewhere in the package with a testable
assertion, and Ada's rulings A-H1–A-H9 are complete. Two **Major** findings
(D-1, D-2) are record defects in Nadia's behaviour spec whose governing
values are already fixed inside the package by Ada's rulings — they do not
block the design, but they are **binding conditions on the build brief**
(see §5): if the build brief ships without them, the build gate fails on
D-1/D-2 without further argument. Three Minor findings (D-3–D-5) and the
amended §6 build-gate list (D-6, §4) complete the delta.

The underlying D1 design is **not** re-gated here (it passed the original
design gate, all four directions FIT WITH NOTES, D1 picked). Scope is the
delta only: pick-set fidelity under Q6, cross-document consistency of the
hide mechanics, fidelity of Ada's rulings, and the hide's effect on the
original gate's §6 build-gate list.

---

## 1. What was inspected

Read in full, from `origin/main` (`git show origin/main:…`, main at
`1c233bf` at gate time; the three package documents verified byte-identical
between `3d65fe6` and `1c233bf`):

- `tab-bar-redesign/HIDE-BEHAVIOR-UX.md` — Nadia, behaviour (564 lines)
- `tab-bar-redesign/HIDE-BEHAVIOR-UI.md` — Mina, visual form (607 lines)
- `tab-bar-redesign/ADA-RULINGS-HIDE.md` — Ada, A-H1–A-H9 + AH1–AH9 (621 lines)

Ground-truth and reference reads:

- `tab-bar-redesign/QA-GATE-design.md` §4 and §6 (the original gate; the
  file is not on `origin/main` — read from this seat's design-gate
  worktree copy, the gate author's own record).
- `tab-bar-redesign/ADA-RULINGS.md` (on main) — Items 1–4, Assertions
  A1–A6, for the §6 disposition check.
- `v2/app/globals.css` on `origin/main`, read directly by this seat to
  test A-H6's ground-truth claim: line 18 reads
  `--color-line-strong: #91825C` (annotated with Ada's 2026-11-19 ruling),
  and line 32 carries the frozen stem-rule literal
  `rgb(151 134 95 / 0.45)` — i.e. #97865F survives exactly where Ada's
  A-H6 scope says it legitimately survives, and nowhere as `line-strong`.
  **A-H6's factual basis is confirmed, not taken on trust.**

## 2. Coverage ledger

- **Population:** the three package documents (complete), the original
  gate's §4 ruling and §6 build-gate list, Ada's original assertions
  A1–A6, and the one code fact the package's conflict turned on
  (`globals.css` line-strong on main).
- **Checked:** every number that appears in more than one document
  (thresholds, dwell, both transit durations, travel distance under both
  countings, clearance at 100% and under Bar B growth, top zone); every
  Ada ruling against the framing item it answers; every AH assertion for
  presence and testability; every §6 list item for hide impact.
- **Not re-checked (delta scope, by commission):** the D1 design itself,
  `UI-DESIGN.md` / `UX-STRUCTURE.md` in full (values quoted from them by
  the three passes were cross-checked only where the passes disagree),
  Elena's three-seeds artwork itself (its composition in the plate is a
  build-gate render check, as at the original gate).
- **Not applicable at this stage:** the human-interaction browser pass —
  there is no build to drive yet. It remains owed in full at the build
  gate against the amended list in §4; a design-gate PASS here is not
  evidence about the built behaviour.
- **Residual risk:** an inconsistency between the hide package and a part
  of the underlying D1 record none of the three passes quotes would not
  have been caught by this delta's coverage.

## 3. Scope checks

### 3.1 Pick-set fidelity — PASS

All three documents carry the identical pick set, with no drift:

- D1 "The Center Plate" geometry: disc Ø 56 px, rise 20 px, centre on the
  top rule (Nadia §§2–3; Mina §§1.2–1.3, §9.1; Ada's notation adopts the
  same geometry).
- Set **Home · Varieties · Crops (plate) · Sellers · Search** — Crops
  crowned per Q3, Account out per Q2, no badge (Mina §9.1; Nadia header).
- The plate carries Elena's three-seeds icon art inside the Ø 48 px safe
  disc; the painted medallion is out on Dustin's word and the original
  gate's **M4 keyline condition has lapsed** — recorded as lapsed by both
  Mina (§1.3/§8 preamble) and Nadia, not silently dropped. Confirmed:
  M4 comes off the build-gate list (§4).
- Desktop header: stem-rule "After A" active treatment only, and it does
  **not** hide — stated as behaviour scope by Nadia (§6 F-g) and as an
  explicit build constraint by Mina (§6). No document extends Q6 to the
  header.
- 200%-text Bar B as ruled at the original gate (§4 there): labels wrap
  inside their slots, the band grows, clearance derives from the rendered
  height, driven-focus proof at 200% as well as 100% — carried by Nadia
  §3, Mina §5.4, and ruled binding by Ada A-H2.

### 3.2 Cross-document consistency — PASS WITH NOTES (D-1, D-2, D-3, D-4)

**Agreements verified, not assumed:**

- **Thresholds and trigger model** are Nadia's alone (24 down / 12 up,
  2 px dead zone, reversal-erasure, 300 px jump classification, 500 ms
  focus grace); Mina sets none and her §7.3 travel-budget note composes
  with them without contradiction.
- **State definitions agree:** two states (VISIBLE/HIDDEN; shown/hidden),
  two resting transforms, no partial resting state — Nadia §1, Mina
  §§2.1/3.4.
- **The plate mid-hide agrees:** one rigid unit, single transform on the
  `nav`, no per-element motion, no internal clipping in both passes
  (Nadia §2; Mina §4); Mina's "disc last to leave, first to return" is
  the geometric consequence of the same rigidity, not a second behaviour.
  Shadow behaviour agrees (falls below the disc, travels with the unit,
  nothing pools at the edge).
- **Clearance formulas are the same formula.** Nadia's O + 8 and Mina's
  H + 28 px + S reconcile term for term (Ada A-H2 works the arithmetic:
  at H = 64 both return 92 px + S; at H = 88 both return 116 px + S;
  Mina's H = 100 worked example → 128 px + S is arithmetically correct
  and is an example only). Ada's reconciliation is accurate.
- **Focus-return transit:** Nadia §5.2 provisionally accepted an animated
  return and pre-wrote the snap fallback, expressly delegating the call
  to Ada (§8.3 Q-A1). Ada A-H3 rules **snap**. No contradiction — the
  delegation was honoured and the fallback governs. (Nadia's §5.2 text
  still cites a "150 ms" transit figure; see D-1.)
- **Ease-in departure:** Mina §3.1 flags her hide curve (180 ms ease-in)
  against Nadia's motion register herself, with a fallback; Ada's
  contract summary adopts Mina's durations/curves as specified. Resolved
  inside the package.

**Disagreements found:** D-1 (dwell), D-2 (resting-finger rule absent
from the trigger spec), D-3 (travel counting), D-4 (growth "cap"
language) — §5.

### 3.3 Ada's rulings — carried correctly and completely — PASS

Each ruling was checked against the item as framed by Mina §8 and the
question as handed by Nadia §8.3:

- **A-H1** — permanent shown-state clearance (92 px + S, identical
  shown/hidden, no state-dependent shrink): ruled STANDS and required;
  A4's contract expressly re-stated as AH1. Both passes already agree
  with the ruling (Nadia §2, Mina §5) — no pass needs amendment on this
  item.
- **A-H2** — measured-H formula at 200%: STANDS WITH CONDITION (margin
  absolute, automatic derivation binding on every value the obstruction
  feeds, no cap). The formula identity with Nadia's O + 8 is proven in
  the ruling, not asserted.
- **A-H3** — transform-only hidden state confirmed (no `inert`,
  `aria-hidden`, `visibility`, `display`, or `tabindex` change; links
  stay in tab order and tree); focus-forced show must **SNAP with no
  transition at every motion setting** — Nadia's pre-written fallback
  governs. AH3 is testable as written (first painted frame at
  `translateY(0)`, computed transform, tree state, no announcement).
- **A-H4** — reduced motion: STANDS with the mechanism condition this
  gate specifically looked for — the instant swap must be real under
  **both** implementations: CSS-transition collapse **or** an explicit
  `matchMedia('(prefers-reduced-motion: reduce)')` gate on any
  WAAPI/rAF/script-driven transit, gate-verified either way (AH4).
- **A-H5** — no painted remnant required: STANDS; no floor provision
  requires one; travel verified sufficient in Bar A and Bar B (AH5).
- **A-H6** — **#91825C ships**; #97865F measured by Ada at 2.8475:1 on
  `paper-deep`, below the SC 1.4.11 floor, and barred from the component
  in any boundary role; its frozen shadow-literal use elsewhere is
  expressly preserved. This seat independently confirmed the ground
  truth on `origin/main` (§1). Mina's stale-tree read is explained in
  the ruling and her flag-not-resolve handling was correct.
- **A-H7** (forced colors), **A-H8** (no hide under a resting finger),
  **A-H9** (SC 1.4.12 spacing overrides and 320 px reflow ride the same
  measured-H formula) — all three additions are within Ada's floor lane,
  raise questions neither pass had specified, and carry testable
  assertions (AH7 renders in both states; AH8 press-and-scroll;
  AH9 override renders at 320/390 px).
- **Assertions AH1–AH9: complete and testable.** Each names a measurable
  outcome, a viewport or state, and a pass mark. AH2 joins Nadia's
  H13/H14; AH3 joins H10/H11; AH4 joins H15; AH5 joins H1/H13 — the
  joins are stated in the assertions themselves, so the build gate runs
  one list, not two. Nadia's H1–H19 (§8.2 of her pass) were counted and
  are complete as handed over.
- Nadia's Q-A1–Q-A6 are all answered by cross-reference in Ada §9, each
  pointing at the ruling that decides it. None is left open.

## 4. The original gate's §6 build-gate list, as amended by this delta (D-6)

The hide behaviour's effect on each §6 item, and the consolidated list
the build brief must carry:

| §6 item | Delta disposition |
|---|---|
| A1 rendered sample (label/glyph over darkest real content, 390/320, ≥ 4.5:1) | **Stands.** Sample is of the shown bar; add: taken with the bar SHOWN and at rest (a mid-transit sample proves nothing). |
| A2 badge (count, accessible name) | **Moot for the picked set** — Account is out (Q2); no badge exists in this bar. Not a hide effect; recorded so the brief does not carry a dead item. |
| A3 pressed tint + channels incl. plate `aria-current` | **Stands, extended:** `aria-current`, names, and tree presence are now asserted in **both** visibility states (AH3b). The tint sample itself is a shown-state render, as A1. |
| A4 driven-focus proof (footer stem link, last listing card, first focusable under the plate's column; 390/320; plus 200% run; plus F3 plate focus render) | **Re-stated as AH1** (Ada): contract identical in both states, proof run with the bar VISIBLE — its worst case — at 100% and at 200% under the measured-H formula (AH2). F3's plate focus render is **joined by AH3a**: the same ring must be fully visible on the **first painted frame** of a focus-forced snap from HIDDEN. |
| A4b active ring = real 3 px `leaf` border | **Stands**, and is load-bearing a second time: it is the plate boundary that survives forced colors (AH7). |
| A5 rendered top-rule sample ≥ 3.0:1 unrounded | **Stands, strengthened as AH6:** computed token must be #91825C; rendered rule and rest ring sampled on `paper-deep` (expected 3.0217:1); #97865F anywhere in the bar is a build defect. |
| Forced-colors renders | **Extended by AH7:** both visibility states, plus a focus-forced snapped show in forced colors. |
| M4 keyline condition | **REMOVED — lapsed.** The medallion does not ship (Dustin); the condition was on the medallion shipping. The plate's build-gate render check is now of Elena's three-seeds art in the Ø 48 px safe disc (Mina §9.1). |
| F4 Crops glyph construction fix (24/20 px re-render) | **Superseded by the pick, not by the hide:** Crops is the plate and the disc carries artwork, not the flank glyph. Recorded so the brief does not carry it against a glyph that no longer exists in this set. |
| F1 corrected pressed rows spot-check | **Stands** (presentation-set item; no hide interaction). |
| Nadia H1–H19 | **Join the list in full**, with H5 amended per D-1 (dwell boundary at 220 ms — see below). |
| Ada AH1–AH9 | **Join the list in full.** |
| **NEW — D-H1 (desktop no-hide)** | At ≥ `md`, scrolling a long page down and up produces no transform, no hidden state, and no state class on the header or any shared layout ancestor; the header's only change is the Q4 stem-rule treatment. (No H/AH assertion covered this pick-set requirement; Mina §9.11 states it as a build value. Added here so it is tested, not trusted.) |
| **NEW — D-H2 (dwell boundary)** | Extends H5: a show attempted 150 ms after a hide on a 12 px upward run does **not** fire (this is the case that distinguishes the ruled 220 ms dwell from Nadia's superseded 150 ms text); the same attempt at ≥ 220 ms fires; the 2× yank override (24 px) fires immediately at any point in the dwell. |

Nothing else in §6 is touched by the hide. In particular, the hide does
**not** weaken the A1/A4 proofs: both were drawn against a visible bar,
and AH1/A-H6 (bottom-zone forcing) guarantee the visible bar is the
state those proofs' targets live under.

## 5. Findings

Severity on this seat's scale (Blocker / Critical / Major / Minor /
Trivial). Evidence class for all findings: **directly observed** in the
documents as read from `origin/main`, quoted by section.

### D-1 — MAJOR — Dwell: Nadia's text reads 150 ms; the package's governing value is 220 ms

- **Object:** `HIDE-BEHAVIOR-UX.md` §1.4 (and §5.2's transit citation)
  vs `HIDE-BEHAVIOR-UI.md` §3.1 and `ADA-RULINGS-HIDE.md` §9.
- **Evidence:** Nadia §1.4 sets the dwell at **150 ms**, defined as "the
  house motion token — Mina's transition duration; if her form pass
  changes the duration, the dwell equals it, never less." Mina's form
  pass sets **two** durations — hide 180 ms, show 220 ms — so "the
  transition duration" no longer names one number, and the literal
  150 ms in Nadia's text satisfies neither her own "never less" clause
  nor the longer transit. Ada's §9 coordination note resolves it:
  "the dwell is **220 ms — the longer transit — never less**, with the
  2× yank override unchanged," and records that "the behaviour remains
  Nadia's to amend." Nadia's §5.2 likewise still describes the
  focus-return transit as 150 ms (superseded twice over: by Mina's
  220 ms show token and by A-H3's snap).
- **Why Major:** a builder or brief-writer reading the behaviour spec
  alone builds a 150 ms dwell — shorter than the 220 ms show transit —
  re-opening exactly the reversal-into-a-travelling-bar flip-flop class
  §1.4 exists to prevent. The package as a whole is unambiguous (Ada's
  note + Nadia's own never-less clause), so the design is not blocked;
  the spec of record is wrong until amended.
- **Condition (binding):** the build brief carries **dwell = 220 ms**
  (the longer transit, never less; 2× yank override unchanged), and
  Nadia amends §1.4 and §5.2 to match. Build-gate assertion D-H2 (§4)
  tests the boundary that distinguishes the two values.

### D-2 — MAJOR — The resting-finger rule (A-H8) is absent from the trigger spec

- **Object:** `HIDE-BEHAVIOR-UX.md` §§1/6 (triggers, failure modes) vs
  `HIDE-BEHAVIOR-UI.md` §7 item 2 and `ADA-RULINGS-HIDE.md` A-H8.
- **Evidence:** Mina §7.2 states the constraint on Nadia ("her trigger
  spec must suppress hide initiation during an active press on the
  bar"); Ada A-H8 adopts it as a floor condition and states plainly
  "Nadia's trigger spec does not yet carry it." Checked: Nadia's §1
  trigger model and §6 failure modes contain no press-suppression rule
  — her F-series covers jank, flicker, teleports, keyboard, momentum,
  inner scrollers, and desktop, but not a pointer held on the bar while
  a qualifying scroll begins.
- **Why Major:** the behaviour spec is the document the trigger
  implementation is built from; a rule that lives only in the form pass
  and the floor ruling is the classic shape of a requirement lost
  between documents. The package binds it testably (AH8), so — as with
  D-1 — the design is buildable and the defect is in one document's
  completeness.
- **Condition (binding):** the build brief carries AH8 verbatim as a
  trigger requirement (no hide begins while a pointer is down on any
  part of the bar, flank or plate; the run re-earns after release), and
  Nadia amends her trigger spec to carry it.

### D-3 — MINOR — Travel distance: the two countings differ by the 1 px rule; Mina's form governs

Nadia §2 derives travel as T = O + 2 with O excluding the top rule
(86 px + S at Bar A), which under exact counting puts the plate's top
edge **1 px** past the viewport edge; Mina §2.1 counts the rule
(obstruction 85 px + S) and her `translateY(calc(100% + 22px))` yields
87 px + S — exactly 2 px past, at every H (verified in A-H2 item 4 /
A-H5). Both passes acknowledge both countings, and the assertions
already harmonize (H1 and AH5: ≥ 0 px below the edge, target 2 px).
No build risk while the build implements Mina's percentage form, which
Ada's rulings assume. Recorded so the build gate measures travel
against Mina's form and does not "correct" it toward Nadia's formula.
Nadia's §2 figure should be footnoted at her next amendment (with D-1).

### D-4 — MINOR — Nadia's Bar B growth language reads as a cap; Ada rules there is none

Nadia §3 describes the grown band as "+24 px, band 64 → up to 88 px."
Ada A-H2 condition 3 rules that this is an expectation, not a ceiling:
under SC 1.4.12 spacing overrides (A-H9) or a third label line, H can
exceed 88 and the formula must follow the measured H. The ruling is
explicit and in-package; the risk is only a brief that hard-codes 88 or
116. The build brief must carry the formula and the no-cap condition,
never the constants (Nadia §3 itself already prohibits hard-coded
84/86/92 in the hide path; the same prohibition extends to 88/108/116).

### D-5 — MINOR — Nadia's reduced-motion section understates the mechanism condition

Nadia §4 states the behaviour "inherits [the global rule] and adds
nothing." True for a CSS-transition implementation; not sufficient if
any part of the transit is script-driven — AH4 requires an explicit
`matchMedia` gate there, gate-verified. Nadia's text does not forbid a
script-driven transit, so there is no contradiction, but the build
brief must carry AH4's two-branch condition rather than §4's
inheritance sentence alone.

### D-6 — MINOR (process) — §6 list amendments

Recorded in full in §4: M4 removed as lapsed, A2 moot for the picked
set, A4 re-stated as AH1, A3/A5/forced-colors extended, F4 superseded
by the pick, and two assertions added (D-H1 desktop no-hide, D-H2 dwell
boundary). The build brief must carry the list **as amended here**;
carrying the original §6 list unamended would re-impose a lapsed
medallion condition and omit the snap-frame and desktop checks.

## 6. Conditions and hand-off

**Verdict: PASS WITH NOTES.** The coordinator may write the build brief
(queued after Item SI) on this package, provided the brief carries:

1. Dwell = **220 ms** (D-1), with D-H2 in its assertion list.
2. **AH8** as a trigger requirement (D-2).
3. The §6 build-gate list **as amended in §4** of this record, including
   AH1–AH9, H1–H19, D-H1, and D-H2.
4. The measured-H formula with the no-cap condition (D-4) and AH4's
   two-branch reduced-motion mechanism condition (D-5).

Nadia's amendments (D-1, D-2, and the D-3 footnote) are owed to the
record but do not gate the brief, because Ada's rulings already fix the
governing values inside the package. If the brief ships without items
1–4, this gate's verdict does not extend to it.

The build gate will additionally owe, per this seat's standing rules:
the full human-interaction drive of the built behaviour (hide/show,
focus snap, resting finger, keyboard-open, find-in-page) in a real
browser at 390/320 px, 100% and 200% text, reduced motion emulated and
forced colors rendered — the design-stage absence of that pass is
declared in §2, not rounded into coverage.

*— Quinn, Quality Assurance · 2026-11-22. Delta gate on the Q6
hide-on-scroll package: HIDE-BEHAVIOR-UX.md, HIDE-BEHAVIOR-UI.md,
ADA-RULINGS-HIDE.md, against QA-GATE-design.md §§4/6 and ADA-RULINGS.md.
Verdict PASS WITH NOTES; findings D-1–D-6 as graded above.*
