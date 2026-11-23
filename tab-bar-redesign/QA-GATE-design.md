# QA DESIGN GATE — Tab Bar Redesign Presentation (seeds.hues.flowers)

**Gate:** Quinn, Quality Assurance (independent reviewer; no part in making this work)
**Date:** 2026-11-22
**Subject:** The assembled presentation for Dustin's pick — `presentation/PRESENTATION.md`,
frames 01–19, and their coded source `presentation/frames-source-pres-2026-11-22.html` —
judged against the design record behind it: Nadia's `UX-STRUCTURE.md` (main `0f16f1a`),
Mina's `UI-DESIGN.md` + `MEDALLION-SPEC.md` (main `f0a53fe`), Ada's `ADA-RULINGS.md`
(main `5c96eae`, Items 1–4 + A5/A6), Elena's `CREATION.md` (medallion PASS at 48, M4 flag).
**Gate type:** design gate on a coded presentation. There is no live build to drive; the
human-interaction pass on the real product is a build-gate act and is named as owed there
(§7). These verdicts judge the directions **as presented** — whether each is sound, honest,
and fit to put before Dustin — not which one he should pick.

---

## Verdicts (summary)

| Direction | Verdict |
|---|---|
| **Hybrid — D1 plate + D2 set** (§2 of the presentation) | **FIT WITH NOTES** |
| **D1 as drawn — "The Center Plate"** | **FIT WITH NOTES** |
| **D2 as drawn — "The Working Five"** | **FIT WITH NOTES** |
| **D3 — the control, labelled a repair** | **FIT WITH NOTES** |
| **The 200%-text question (open behaviour)** | **RULED: Bar B ships; Bar A is rejected** (§4) |

No direction is UNFIT. No finding below is a Blocker or Critical. The defects found are in
the presentation mock's peripheral states and in two sentences of its claims — correctable
without redesign — plus build-gate conditions that were already the plan. The vital few are
F1 and F2; everything else is notes.

**Four axes, kept separate (per this seat's W2 discipline):** severities are in §3 (defect
impact only); evidence grades are stated per finding (directly observed / measured /
inferred); coverage is §2's ledger, not a defect; verdicts are above and in §5. Nothing
unfinished (build-gate proofs) is priced as a defect.

---

## 1. What was inspected

Every frame was viewed at its true size; the coded source was read line by line; the four
design-record documents were read in full. Measurements were taken from the rendered PNG
files (file-pixel coordinate space) and from the source's CSS values (CSS-pixel space) —
the two are named separately wherever a number appears.

**Verified directly (evidence: directly observed / measured):**

- **File geometry.** All ten device frames are exactly 390 × 844 px file pixels; strips
  12–15 are 430 px wide at 1:1 bar width (390 px bars); frame 16's bars are 320 px;
  frame 19 is 1,060 px wide. The medallion master is 1,024 × 1,024 RGBA.
- **Bar geometry in source matches spec.** Band 64 px; disc Ø 56 px at `top: -20px`
  (20 px rise); stem rule 28 × 3 px, radius 4; well radius 16 px, inset 4/6 px; badge
  18 px, 11 px/700. Pixel check on frame 04 (file pixels): the `line-strong` top rule
  sits at y = 757 of 844 — exactly 64 (band) + 22 (safe-area stand-in) + 1 (rule) from
  the bottom — and the disc's rise is consistent with rule + 20 px.
- **Tokens exact, freezes respected (Ada A5/A6 — see §6).** Source `:root` carries
  `paper` #F8F1E1, `paper-deep` #F0E5CB, `ink-soft` #4A4438, `leaf` #1E4634,
  `leaf-50` #E3EAD8, `petal` #8E2A52, `line-strong` **#91825C exactly**, `focus` #7A3E10;
  bar ground is `rgba(240,229,203,.92)` = paper-deep at the ruled 92%; rest ring is a
  real 2 px border; active ring is a real **3 px `leaf` border** (not a shadow — Ada
  A4b's forced-colors requirement is pre-satisfied in the mock's construction).
- **Badge = primary as ruled.** Petal fill, white numeral; the leaf fallback appears
  nowhere as a design. Pixel sampling of strips 13/14 finds the petal badge colour
  present (1,260 px in each strip's badge rows); frames 06/09's account page lists
  exactly the 3 alerts the badge counts — the badge is never the only channel, and
  its count agrees with the page.
- **Pressed tint pinned as Ada A3 requires.** `--pressed: rgb(211,221,203)` with the
  srgb mix space named in the source comment — the exact value Ada measured at
  7.5563:1. In strip 14 both tints are measurably present: `leaf-50` wells
  (11,943 px sampled) and one deepened pressed well in the pinned tint (3,009 px) —
  D2's active-beside-pressed row renders as captioned.
- **320 px fit (frame 16).** All four bars render at 64 px slots with no wrap, shrink,
  or clip; "Varieties" fits in every direction, as measured by the maker (54 px) and
  confirmed visually at 1:1.
- **Forced-colors (frame 18).** Rendered with emulation actually on: the badge keeps a
  ButtonText-bordered ground and its numeral **3 is legible** at 1:1 (dark numeral on
  the system ground); the active (Account) well is outlined; glyphs and labels ride
  system colours, and the active tab is distinguishable by outline + colour + weight/
  underline — not colour alone. Ada Item 2's forced-colors check **passes for D2**.
- **Desktop strip (frame 19).** Before / After A (stem rule) / After B (well pill +
  badge on the account icon) differ only in active-state rendering; set and layout are
  untouched; the plate does not travel. Q4 is decidable from this strip.
- **Medallion (frame 01 + Elena's files).** At 48 px, on paper-deep, on dark #20241F,
  and in grayscale, the assembly reads in one glance as a green ribbed seed pod with a
  gold lid; it does not read as a flower. Elena's measured table (M1 = 1 component,
  3 masses, ΔL\* 24.1, bbox 83.3% × 75.0%, safe-disc max radius 23.51 of 24, 97.8%
  opaque interior) is carried into the sheet accurately. Her PASS at 48 is confirmed
  by direct observation; the M4 flag is dispositioned in §6.

---

## 2. Coverage ledger

- **Population:** 19 presentation frames, 1 coded source file, `PRESENTATION.md`, and
  the 4 design-record documents (UX structure, UI design + medallion spec, Ada's
  rulings, Elena's creation note).
- **Strata checked:** every direction (D1, hybrid, D2, D3) × every state the set
  claims (default, active, pressed, focus-visible, no-tab-lit, badge present/absent/
  two-digit) × tight cases (320 px, 200% text, forced-colors) × desktop strip ×
  medallion acceptance set.
- **Structured sample:** all 19 frames viewed; the full source read; all four record
  documents read. No sampling was needed inside the frame set — it is small enough
  to check whole.
- **Adversarial additions:** pixel-count sampling of the rendered strips for the
  `leaf-50` well colour, the pinned pressed tint, and the petal badge (this is what
  caught F1 — the captions were not taken on trust); a source-selector trace of the
  pressed-state CSS (F1's root cause); a semantics trace of the plate cell and badge
  name in the source (F2).
- **Exclusions, with reasons:** no live build exists to drive (design gate — the
  driven-focus proof, Ada A4, and the rendered dark-content contrast sample, Ada A1,
  are build-gate acts, confirmed deferred in §6); no Search-crowned plate render
  exists (the maker discloses this herself; gate note in §8); forced-colors is
  rendered for D2 only (plate directions' forced-colors disc is a build-gate check,
  §6).
- **Evaluator structure:** single evaluator (Quinn). No cold second rater was
  commissioned for this gate; per the evaluator-effect evidence in this seat's
  playbook, a single pass finds a subset of problems and its severity ratings carry
  that flag. The findings below are the ones this pass found, stated with their
  evidence; they are not a claim that no others exist.
- **Residual risk:** the class this coverage can still miss is behaviour that only
  exists in the real component — hydration, the real font stack on Dustin's phone,
  real photograph content under the translucent bar, and focus/scroll interaction.
  Those are exactly the build gate's charter (§6, §7).
...[truncated 13571 chars]
---

## 3. Findings

### F1 — Major — The flank pressed state does not render in the D1, hybrid, or D3 strips

- **Object:** strips 12, 13, 15 (pressed rows) and their captions; source CSS.
- **Expected (standard):** `UI-DESIGN.md` §1.4/§2/§5 — a flank press shows the
  `leaf-50` well for the press duration, colour only, target unmoved.
  `PRESENTATION.md` §6 captions claim exactly that render ("leaf-50 well, colour
  only"; "leaf-50 well on :active").
- **Actual (evidence: directly observed + measured + source-traced):** no flank well
  is present. Pixel sampling of the rendered strips for `leaf-50` rgb(227,234,216):
  D2 strip 11,943 px (its wells render); hybrid strip **45 px** (antialiasing noise);
  D3 strip **21 px**; D1 strip 887 px, which is the plate's pressed **halo** alone
  (the halo does render) — no flank well anywhere. Root cause in the source: the
  pressed class is placed on the well element itself
  (`<span class="well pressedflank">`), but the CSS rule is written for a class on
  the tab (`.tab.pressedflank .well { background: var(--leaf-50) }`), so the rule
  never matches. D2's pressed well works because its rule (`.well.pressed`) matches
  its markup.
- **Impact:** one full state is misrepresented in three of the four directions'
  evidence, in the last gate before Dustin. The design spec is correct; the render
  is wrong. Pressed is transient and the well is deliberately near-invisible at its
  edge (Ada measured the well boundary at 1.0150:1 — the *interior tint* is what
  shows, as D2 proves), so this does not distort Dustin's pick among directions —
  but the package may not ship captions claiming a render that isn't there.
- **Disposition:** one-class source fix by the maker; strips 12/13/15 re-rendered;
  Quinn spot-checks the three pressed rows by pixel sample before the package is
  released. No redesign, no re-gate of the whole set.

### F2 — Major — The presentation overclaims two accessibility semantics its own source does not model

- **Object:** `PRESENTATION.md` ("colour + weight + `aria-current` — all three
  channels are present in every active/pressed render in this set"; the badge
  presented with its accessible-name behaviour as a design fact) vs the source.
- **Actual (evidence: directly observed in source):** (a) the plate cell is built as
  a `<div class="tab platecell">` — it is not a link and carries **no
  `aria-current`** in any state, so for the plate directions the load-bearing third
  channel (Ada A3's void condition names `aria-current` explicitly) is absent from
  the coded render, though `UI-DESIGN.md` §2 specifies it correctly for the build.
  (b) The badge is `aria-hidden` (correct) but nothing in the source gives the
  Account link the count-bearing accessible name ("Account, 3 alerts") that Ada's
  A2 assertion requires — the rendered name is "Account" alone.
- **Impact:** the *visual* design is unaffected and Dustin's pick is unaffected.
  The harm is record accuracy at exactly the points Ada's rulings make load-bearing,
  and the risk that a builder treats the mock as the semantic spec.
- **Disposition:** the claims in `PRESENTATION.md` are corrected to name these as
  build requirements, and both enter the build gate as explicit assertions (§6):
  plate link with `aria-current` on `/variety`; Account accessible name carrying
  the count, checked with the badge at 3 and at two digits (Ada A2).

### F3 — Minor (coverage) — The plate's own focus-visible state is rendered nowhere

- No strip or frame shows focus on the Varieties plate cell — the hero control of
  the two plate directions. Flank focus is proven (strips 12–15: the 3 px `focus`
  #7A3E10 outline renders whole, and in strip 13 it is not clipped by the badge),
  and the spec applies the same global ring to the plate, so this is an unshown
  state, not a suspected defect. It joins the build gate (§6): the plate's focus
  ring, rendered at 390/320 px, is a required build-gate screenshot — including
  how the ring reads where the disc rises above the band.

### F4 — Minor — The Crops pod glyph reads as "0" / a pill at render size

- **Object:** the Crops glyph (source symbol `g-pod`) in frames 02, 10, 16.
- **Evidence: directly observed.** As constructed — a symmetric upright ellipse
  with one central vertical cut-line seam — it renders at 24 px as a narrow oval
  with a slit: the first read is a numeral zero or a capsule, not a seed pod.
  `UI-DESIGN.md` §1.1 specifies an upright pod silhouette kin to the shipped pod
  mark; the shipped mark's read depends on its plump body and lid, neither of which
  this silhouette carries. This is a **construction** observation, per the gate
  brief: the fix is Mina's vector construction (give the silhouette the pod's
  taper — plumper base, a lid/neck indication at the top — so the seam reads as a
  pod's seam), re-rendered at 24 px and at the 20 px header-menu size. It is not a
  repaint and not Elena's.
- **Why only Minor:** no tab is icon-only; the "Crops" label sits directly beneath
  in every state, so recognition is never glyph-alone. It affects D1 and D3 (the
  directions that seat Crops) and the header menu's family parity.

### Positive glyph read — Search (no finding)

- The Search glyph (source `g-search`: solid ring, paper counter, chunky rotated
  handle joined at the ring's lower right) reads instantly as a magnifier at 24 px
  in every frame, in the header context, and in forced-colors (frame 18). Its
  construction is sound as drawn; no fix. Home, Sellers (barn), Varieties (bloom),
  and Account (person) were likewise read in every frame: all legible at size,
  none confusable with another slot's mark at a glance.

### F5 — Trivial — The mock's safe-area zone is a fixed 22 px stand-in, not `env()`

- The source renders the safe area as a fixed 22 px strip with a home-indicator
  bar. That is a fair representation for a screenshot, and the build spec
  (`UI-DESIGN.md` §5) correctly requires `env(safe-area-inset-bottom)`. Noted only
  so the record distinguishes the mock's stand-in from the build's contract.

---

## 4. RULING — The 200%-text question (frame 17): Bar B ships

**Bar A (as drawn) is rejected. Bar B (Mina's recommended build behaviour — labels
wrap inside their own slot; the band grows in height) is the behaviour that ships,
for whichever direction Dustin picks.**

Reasoning, against the criteria that bind:

- **WCAG 2.2 SC 1.4.4 Resize Text (AA)** requires that text resized to 200% loses
  no content **or functionality** without assistive technology. Bar A loses no
  letters — nothing clips — but it loses the functionality the labels exist for:
  measured on the render, Sellers (79 px), Search (80 px), and Account (97 px)
  exceed their 78 px slots and adjacent labels touch and run together (frame 17's
  Bar A shows "HomeSellers…SearchAccount" as one string, with the plate's
  "Varieties" label overlapping its neighbours). A label a user cannot unambiguously
  associate with its own target has failed as a label, even with every letter
  surviving. Target identification is the function; Bar A degrades it at exactly
  the text size the criterion protects.
- **SC 1.4.10 Reflow (AA)**'s principle — content presents without loss and without
  two-dimensional confusion at enlarged sizes — points the same way: Bar B keeps
  every label inside its own slot's width; no label leaves its control, nothing
  scrolls horizontally, nothing is clipped.
- **The house typography rule decides the currency.** Thea's standing rule for this
  bar (`UI-DESIGN.md` §8.2): if a label doesn't fit, "the fix is layout (band
  height), never a smaller size or a condensed face." Bar B pays in the allowed
  currency — band height — and holds 24 px type untouched. Bar A pays in label
  association, which is not a currency the spec offers: `UI-DESIGN.md` §5 permits
  the band to grow and forbids shrink/clip; it never permits labels to leave their
  slots.
- **Bar B's cost is cosmetic, and is accepted knowingly:** single-word labels break
  mid-word ("Variet/ies", "Searc/h") because a single word has no natural break.
  Every letter survives, inside its slot, at full size. That is a Minor cosmetic
  cost at an accessibility setting, against Bar A's Major legibility failure at
  the same setting. (Severity axes: Bar A's overlap rated Major as a presentation
  finding — it would block a clean pass for any direction shipping it; under Bar B
  it does not arise.)
- **SC 1.4.12 Text Spacing** is not engaged by either bar (the +0.01 em label
  tracking is far inside its allowances) and decides nothing here; it is named so
  the record shows it was considered.

**Conditions carried with the ruling into the build brief:**
1. Wrap-inside-slot engages only when a label would overflow at enlarged text;
   at 100% the bars render exactly as drawn in frames 02–11 (single-line, 12 px).
2. Labels never shrink, never clip, never scroll — at any text size.
3. **Clearance tracks the grown band.** The 92 px scroll-padding / footer contract
   (Ada A4) is derived from the 64 px band. When the band grows under Bar B, the
   obstruction grows with it, so the build's clearance must be derived from the
   bar's rendered height (or an equivalent dynamic measure) — and the build gate's
   driven-focus proof (§6) is run **also at 200% text**, not only at 100%.

---

## 5. Per-direction fitness — detail

**Hybrid (D1 plate + D2 set) — FIT WITH NOTES.** State legibility is the strongest
in the set: flank active = leaf + 700 + stem rule; plate active = 3 px leaf ring +
leaf 700 label with the painting constant; no-tab-lit reads as a deliberate rest
state (strip 13, badge still reporting — the designed behaviour, and it reads as
designed, not broken). The badge's present/absent/two-digit behaviour is fully
shown and honest (strip 13's badge rows; frame 06's count agrees with its page).
The plate's rise reads cleanly against the frames' content — with the §6 caveat
that no frame puts dark or busy content directly behind the disc, which is A1's
build-gate sample, not a presentation failure. Notes carried: F1, F2, F3, the M4
build condition, the §4 ruling (frame 17 is this direction's own render, so the
ruling is evidenced on the hybrid itself).

**D1 as drawn — FIT WITH NOTES.** Same plate evidence as the hybrid. Its known
cost — no Account tab, so the account page lights nothing — is presented honestly:
disclosed in `PRESENTATION.md` §3, and the no-tab-lit state itself is shown in
strip 12 rather than hidden. That cost is Dustin's to weigh at Q2; it is not a
presentation defect. Notes carried: F1, F2, F3, F4 (D1 seats Crops), M4 condition.

**D2 as drawn — FIT WITH NOTES (the cleanest evidence set).** The only direction
whose pressed state is proven by measurement in its own strip (both well tints
pixel-verified, §1). Active legibility is three-channel and glanceable in every
frame; the well survives grayscale by construction (a region channel) and is
outlined in forced-colors (frame 18 passes). The presentation is honest that its
silhouette is the shipped bar's — "its difference is felt in use, not in outline"
is stated, not spun. Notes carried: F2 (badge accessible name, build gate). No
plate flags attach.

**D3, the control — FIT WITH NOTES, for the purpose it declares.** It is labelled
in every place it appears as "a repair, not a redesign" — Nadia's label, carried
verbatim — and the frames bear the label out: same set, same geometry, the new
glyph family and the stem rule doing honest work. Presented as a control, it is a
sound one; Dustin cannot mistake it for a redesign unless he skips the labels.
Notes carried: F1 (its pressed row has the same missing well), F4 (it seats Crops).

---

## 6. Carried flags — dispositions

**Elena's M4 headroom (91.0% vs the 90% floor; weakness on the lid's top edge) —
ACCEPTED for the pick; CONDITIONED for the build; NOT sent back now.**
The measurement passes the spec it was judged against, and M4's own stated allowance
covers the weak passage (the lid's top edge is keyline-enclosed on every side). The
at-48 read — the judgement that matters — was confirmed by direct observation on both
grounds and in grayscale (§1). Sending the painting back now would spend an Elena pass
on a passing measurement, and would be wasted entirely if Dustin picks D2 or D3 (the
medallion retires with the plate). The condition, if a plate direction is picked:
**before the medallion ships in the build, Elena makes the heavier keyline pass on the
lid** (her own named fix — not a darker lid; marigold is G2's family), the M4 share is
re-measured on the new 48 px render and must come back **above 91.0%**, and Quinn
re-checks the 48 px assembly on both grounds. That re-check is a build-gate item with
a named pass mark, not a hope.

**Ada A1 (rendered-sample check) — CONFIRMED correctly deferred to the build gate.**
A1 asks for the *rendered* active label/glyph sampled over the darkest real content
in the set (a dark plate photograph scrolled beneath the bar) at 390/320 px, ≥ 4.5:1.
The presentation cannot perform it honestly: its page content is representative
context (gradient blocks, not the site's dark plate photographs), and the worst-case
bound is already proven analytically (7.1028:1 over black — Ada Item 1). The deferral
is written, owned (Quinn, build gate), and carries its pass mark and its failure
meaning (a sample below 4.5:1 is a build defect — wrong token or opacity — not a
design question). Not dropped; not performable earlier. The same reasoning covers
A3's rendered pressed-well sample, which joins it.

**Ada A4 (driven-focus proof) — CONFIRMED correctly deferred to the build gate.**
A static presentation cannot drive keyboard focus; the presentation draws the 92 px
contract to geometry and says so plainly ("a static presentation cannot perform it,
and this set does not pretend to"). The assertion stands with its named targets —
footer stem link, last listing card's link, first focusable under the plate's column,
at 390 and 320 px, full 3 px ring visible, no part under the disc — **plus two
additions from this gate:** the plate's own focus-visible render (F3), and the whole
proof repeated at 200% text under the §4 ruling's grown band.

**Ada A5/A6 (freezes) — VERIFIED respected in this set.** Checked against the source,
not the maker's word: `line-strong` at exactly #91825C everywhere it is used (bar top
rule, disc rest ring at 2 px); no token lightened; bar opacity exactly 92%; Items 1–4
tokens used exactly as ruled, including the srgb-pinned pressed tint and the petal
primary badge. Any future token change voids the affected ruling per A6 — that
sentence is carried into the build brief by reference to Ada's document.

**Build-gate assertion list (consolidated, for the build brief):** A1 rendered sample
(label/glyph over darkest real content, 390/320, ≥ 4.5:1) · A2 badge at 3 and two
digits (numeral legible, label uncovered, **accessible name announces the count** —
F2) · A3 pressed tint declared with its mix space named; colour + weight +
`aria-current` channels all present in active/pressed (incl. **plate `aria-current`**
— F2) · A4 driven focus (targets above, 390/320, plus 200%-text run and plate focus
render — F3, §4) · A4b active ring renders as a real 3 px `leaf` border (mock
construction already complies) · A5 rendered top-rule sample ≥ 3.0:1 unrounded ·
forced-colors renders for the plate directions (disc + ring under system colours;
D2's already passes, frame 18) · M4 keyline condition (above) if a plate direction
is picked · Crops glyph construction fix re-rendered at 24/20 px (F4) · F1's
corrected pressed rows spot-checked in the presentation set itself.

---

## 7. Usability pass — desk form (declared partial, per this seat's rules)

A coded presentation cannot be driven in a browser as a user with a goal; the
task-based pass belongs to the build gate (§6) and **no interactive flow is passed
here on inspection alone**. What this gate ran instead is the desk instrument — a
cognitive walkthrough of state comprehension from the strips and frames, single
evaluator, findings rated on Nielsen's 0–4 scale after collection:

- **Goal taken:** "Tell, at a glance, which section you are in — on a section page,
  on a utility page, and with alerts waiting." Steps: frames 02–11 (one per
  direction per state), then strips 12–15 state by state. **Result:** in every
  direction the active state is identifiable at a glance by at least two non-colour
  channels (rule/well/ring shape + weight); the no-tab-lit state reads as a
  deliberate rest, not an error, in all four strips. No severity-3+ usability
  finding. The one comprehension cost found is F4's glyph read (Nielsen 1 —
  cosmetic; the label carries it), and Bar A's 200% label association failure,
  ruled on in §4 (Nielsen 3 as a behaviour — which is why it could not ship; the
  ruling removes it from every direction).
- **Boundaries:** everything past the static render — real focus order, real scroll
  behaviour under the plate, real content under the translucent bar — is unproven
  by this gate and owned by the build gate (§6). Dustin's own judgement of feel on
  his phone remains the pick itself; this gate does not lend the presentation his
  eyes.

---

## 8. The pick package — can Dustin answer Q1–Q6 from this set?

- **Q1 Direction — yes.** §2–§5's frames plus strips give each direction's set,
  geometry, and states at his judging size.
- **Q2 The set (Account in? Crops out?) — yes, with one note.** Account-in is shown
  in use (frames 06/09, badge behaviour in strips); Account-out's cost is shown as
  the no-tab-lit state and disclosed in words. **Note:** the "six slots / another
  slot gives way" branch of Q2 has no render — if Dustin reaches for it, a design
  pass is owed before build. The two branches he is actually choosing between are
  both fully rendered.
- **Q3 The crown (Varieties vs Search) — answerable as a decision, not on visual
  evidence for the alternative.** Every plate frame crowns Varieties; no
  Search-crowned render exists, and the presentation says so itself and offers to
  make one. Gate note, not a block: if Dustin leans Search, the render is made and
  Quinn spot-checks it before build — he should not be asked to crown Search from
  imagination while Varieties sits rendered in front of him.
- **Q4 Desktop scope — yes.** Frame 19 is sufficient evidence for a rendering-only
  decision, including the "leave it untouched" branch, which the strip prices
  honestly (the mobile designs stand complete without it).
- **Q5 Measurement — yes, because the absence is stated plainly.** There is no tap
  data; no frame pretends otherwise. Dustin can make the ship-on-reasoning vs
  instrument-first call with the honest state of the data in front of him.
- **Q6 Scroll behaviour — yes.** Every frame in every direction is always-visible;
  the exclusion of hide-on-scroll is explicit, so a "yes" to exploring it would be
  his word opening new work, not a hidden default.

**Package verdict:** PRESENTATION.md + frames 01–19 are sufficient for the pick,
subject to F1's corrected strips being swapped in before release and the §8 notes
travelling with Q2/Q3. Nothing Dustin needs for Q1–Q6 is silently missing; the two
gaps (six-slot branch, Search crown) are disclosed gaps with a named remedy.

---

## Sign-off

Design gate complete. All four directions are **FIT WITH NOTES** to go to Dustin;
the 200%-text behaviour is **ruled Bar B**; Elena's M4 is accepted for the pick and
conditioned for the build; Ada's A1/A4 are confirmed as build-gate items, correctly
deferred and not dropped; A5/A6 are verified respected in the source. Conditions
F1–F4 and the §6 assertion list travel with whichever direction is picked.

— Quinn, Quality Assurance · 2026-11-22
