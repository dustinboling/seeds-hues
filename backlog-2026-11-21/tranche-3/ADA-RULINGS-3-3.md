# Tranche 3, Item 3.3 — Accessibility Rulings (Ada)

**Seat:** Ada, Accessibility — owner of the WCAG 2.2 AA floor. **Date:** 2026-11-22.
**Subject:** Mina's field-state set, `FIELD-STATES-DESIGN.md`, against Nadia's Tranche 3 SPEC §4.2 (behavior contract), §4.4 (rulings flagged to this seat), and §3.4 (no-JS floor form, as amended).
**Method:** every contrast pair in the design's §9 was recomputed by this seat from the shipped hexes (`origin/main` `v2/design-tokens/tokens.json`, spot-confirmed: ink `#2E2A23`, paper `#F8F1E1`, surface `#FFFDF6`, paper-deep `#F0E5CB`) using the WCAG relative-luminance formula — linearize sRGB, weight 0.2126 / 0.7152 / 0.0722, (L1 + 0.05) / (L2 + 0.05). Unrounded values decide. Floors: 4.5:1 normal text (1.4.3), 3:1 non-text — component boundaries, states, meaningful graphics, focus (1.4.11). Mina's arithmetic was not taken on faith; it was reproduced. **It is exact: every value below matches her table to four decimal places, including the §5.2 alpha-blend computations (warn at 75% over surface = 3.0409:1 against paper; at 70% = 2.7609:1 — both below the 3:1 floor against the outer adjacency, confirming full-strength warn as the only compliant border).**
**Conformance language:** these rulings are engineering evidence that the design, as specified, meets the WCAG 2.2 AA criteria named. Built to WCAG 2.2 AA, not formally certified — certification requires a specialist firm testing with assistive technology and disabled users, and the real-AT session list remains open.

---

## Ruling 1 — The §9 contrast pairs, rows 1, 2, 4–13, 15–18: **APPROVED as designed**

All recomputed by this seat; all pass their floors with real margins. No value changes.

| §9 row | Pair | My recomputation | Floor | Result |
|---|---|---|---|---|
| 1 | warn `#8A5E08` on surface `#FFFDF6` (error text, glyph, border vs field fill) | 5.5988:1 | 4.5 / 3 | Pass |
| 2 | warn on paper `#F8F1E1` (same, page-ground forms) | 5.0636:1 | 4.5 / 3 | Pass |
| 4 | warn border on paper (outer adjacency) | 5.0636:1 | 3 | Pass |
| 5 | line-strong `#91825C` on warn-50 `#F7EDD3` (summary border vs own ground) | 3.2440:1 | 3 | Pass |
| 6 | line-strong on paper / on surface (summary border vs sitting ground) | 3.3613:1 / 3.7166:1 | 3 | Pass |
| 7 | warn on warn-50 (summary heading text) | 4.8868:1 | 4.5 | Pass |
| 8 | link `#1F5C3D` on warn-50; hover leaf `#1E4634` on warn-50 (summary entries) | 6.7793:1 / 9.0916:1 | 4.5 | Pass |
| 9 | ink-soft `#4A4438` on surface / on paper (filled border, both adjacencies) | 9.4858:1 / 8.5791:1 | 3 | Pass |
| 10 | leaf on leaf-50 `#E3EAD8` (selected card border; selected label text) | 8.5957:1 | 3 / 4.5 | Pass |
| 11 | muted `#6A5F4C` on leaf-50 (in-card hint on a selected card) | 5.0765:1 | 4.5 | Pass |
| 12 | leaf-600 `#2E6B4F` on leaf-50 (card hover border); ink `#2E2A23` on leaf-50 (card text) | 5.1099:1 / 11.5701:1 | 3 / 4.5 | Pass |
| 13 | leaf on surface / on paper (native checked mark) | 10.4162:1 / 9.4205:1 | 3 | Pass |
| 15 | focus `#7A3E10` on warn-50 / leaf-50 / paper-deep (programmatic ring grounds) | 7.1350:1 / 6.7459:1 / 6.6461:1 | 3 | Pass — each more than double the floor |
| 16 | leaf on surface (success glyph); ink on surface (success heading) | 10.4162:1 / 14.0205:1 | 3 / 4.5 | Pass |
| 17 | muted on surface (placeholder text; CodeEntry lifetime hint on card grounds) | 6.1516:1 | 4.5 | Pass |
| 18 | white `#FFFFFF` on leaf (busy / disabled primary submit, held at resting values) | 10.6015:1 | 4.5 | Pass |

Use-of-color (1.4.1) is satisfied by construction across the set, and this ruling records it because ratios alone do not: error is carried by border + glyph + words; selected by border + ground + weight + the native mark; filled by a value step on a state that carries no validity meaning; the warning and success glyphs are redundant channels beside text that names the state in words. No distinction in the set rides on hue alone.

## Ruling 2 — §9 row 3, warn on paper-deep (4.5520:1): **APPROVED as designed — margin accepted, with one binding condition**

My recomputation: warn `#8A5E08` on paper-deep `#F0E5CB` = **4.5520:1**, against the 4.5:1 normal-text floor (1.4.3). That is an unrounded pass, and this seat does not fail passing pairs — the same discipline that forbids rounding a 4.47 up forbids rounding a 4.5520 down. The margin (0.052) is accepted as designed, for three recorded reasons: (i) the value passes unrounded, computed from the exact shipped hexes with no alpha, gradient, grain, or photograph between the text and its ground — there is no rendering mechanism in the set that erodes it; (ii) no form in the §4.3 inventory renders on paper-deep today — the pair exists only because the components are portable; (iii) on any ground, the error state is triple-encoded (border at 4.5520:1 against the same ground for the non-text reading, glyph, and message text, plus summary/focus discipline), so no reader depends on this one ratio alone.

**Binding condition (no change to the design as built):** the acceptance covers warn text and warn border on paper-deep only at the shipped token values. If any form or recessed band ever actually places warn text on paper-deep, the builder must either re-submit the pair as rendered or use the nearest passing value of the same color, computed by this seat: **warn darkened to `#895D08` = 4.6175:1 on paper-deep** (one step darker in the same hue; it also raises every other warn pair — 5.6794:1 on surface, 5.1365:1 on paper, 4.9572:1 on warn-50). Mina changes nothing now; `component.field.error.color` stays `{color.warn}`.

## Ruling 3 — §9 row 14, the disabled border (line on paper, 1.2977:1) and the 1.4.11 exemption: **APPROVED as designed — the exemption applies; the stated fallback is NOT adopted**

My recomputation: line `#E0D5B8` on paper = **1.2977:1**; muted on paper (disabled value text and label) = **5.5636:1**, passing the 4.5:1 text floor outright with no exemption needed.

Criterion 1.4.11 by its own text does not apply to inactive components: "Visual information required to identify user interface components and states, **except for inactive components** or where the appearance of the component is determined by the user agent and not modified by the author." A genuinely disabled field is an inactive component, and the exemption is the criterion's, not a reading Mina invented. It is accepted here because the conditions that make the exemption honest all hold in this design, and they are part of this ruling:

1. The exemption is claimed for the **border only**. Everything a reader needs from the disabled field — its label, its value, and (§3.7's design rule) the reason it is disabled, carried in its hint — is real text passing 4.5:1 outright. Nothing informational rests on the 1.2977:1 line.
2. The state does not ride on the border: ground step (surface → paper), muted text, and `cursor: not-allowed` carry "off" redundantly, and the control is natively `disabled`, so assistive technology announces the state programmatically regardless of any pixel.
3. The exemption is scoped to **genuinely unavailable** fields. It may never be extended to the busy state — and the design already honors that line: §7 disables only the submit control during a flight and never a data-bearing field, so no active component ever borrows this exemption.

`component.field.border.disabled` stays `{color.line}`. The line-strong fallback (3.3613:1 on paper) is not adopted; it remains on record in the design should a future state fail condition 1 or 3, at which point the exemption lapses and the fallback becomes mandatory without a new ruling.

## Ruling 4 — A4 final pattern form (design §2.1, §5): **APPROVED as designed — this is the prescription's final form**

Mina's implementation is my A4 prescription (audit §8: per-field `aria-invalid` + `aria-describedby` wired to per-field error ids, the admin sheets' shipped pattern) in its final form, and I confirm each element:

- Hint id `{fieldId}-hint`, error id `{fieldId}-error`; `aria-describedby` composed hint first, error second, both present whenever both exist — the hint is never displaced by the error (SPEC §4.2.1, adopted verbatim, and correct: 1.3.1 / 3.3.1 / 3.3.3 are answered together, not traded).
- `aria-invalid="true"` present only while the field is in error — present-true or absent, never `"false"` — matching the admin convention exactly. The visual error border is keyed to `[aria-invalid="true"]` (§4 of the design), so the visual and programmatic states cannot drift apart; that coupling is part of the approved form.
- The inline error line carries **no** `role` — correct. Announcement comes from the focus move and, where one exists, the summary; a self-announcing line beside a summary would double-announce.
- Choice groups: the error attaches to the `<fieldset>`, `aria-describedby` on the fieldset pointing to `{groupId}-error`, the line under the legend, focus to the group's first control. A single required checkbox is treated as the single control it is, describedby on the checkbox itself. Both are correct under 1.3.1 — the group is the unit that is invalid, and it is the unit that is described.
- Summary entries character-identical to the inline messages, each a link whose activation moves focus to its field (SPEC §4.2.2). Approved.

No correction. The 3.3 build implements §2.1 and §5 as written, and SPEC §4.4's flag on A4 is closed: the pattern's owner has signed the final form, and it is this one.

## Ruling 5 — CodeEntry `aria-describedby` composition (design §8.5, §12): **APPROVED as designed — the contract's hint-then-error composition governs; my W-2 literal string is amended by this ruling**

My W-2 prescription (audit §6) was written against the component as it then existed: an input with **no hint at all**. Its literal string — `aria-describedby="{idPrefix}-code-error"` — specified the only description the component had. U7.1 has since given CodeEntry a second description, the lifetime hint, and a prescription written for one description does not silently repeal the set-wide composition rule for two.

**Governing composition, final:** when the lifetime hint is present, the input's `aria-describedby` is **`"{idPrefix}-code-hint {idPrefix}-code-error"`** — hint first, error second — exactly as Mina built it under SPEC §4.2.1. When no error is showing, the attribute carries the hint id alone; the W-2 substance — `aria-invalid="true"` on failure and the describedby resolving to the error paragraph carrying `id="{idPrefix}-code-error"` — stands unchanged and is fully satisfied by this composition. Consistency is itself the accessibility feature here: a screen-reader user who learns "hint, then error" on every other field in the set must meet the same order on the code field, and an error state that dropped the lifetime line from the description would reproduce, inside one component, the exact hint-displacement failure §4.2.1 exists to prevent. Mina changes nothing; the design document's §12 flag is resolved in favor of the design as built, and W-2's record should be read as amended by this ruling wherever the two are cited together.

## Ruling 6 — Focus treatment composition (design §3.3): **APPROVED as designed**

The global ring (3px solid focus, 2px offset) is unchanged, draws **outside** the state border, and composes with every state — focus + error reads as two rings, warn border at the field's edge and the umber ring 2px beyond it, each passing independently (rows 2/4 and 15; ring on paper 7.3932:1 and on surface 8.1745:1 are the existing recorded pairs). That composition is the correct answer to 2.4.7 / 1.4.11: the state is never hidden by the focus indicator, and the indicator is never hidden by the state. The ring exceeds the stricter focus-appearance measure this seat designs to (a full 2px-perimeter-plus indicator at 3:1+ between focused and unfocused states) on every ground in the set. The requirement that field stacks carry no clipping ancestor, and Quinn's rendered proof of the unclipped ring on an error field at 390px (design check 3.3-V2), are part of the approved treatment — the approval is of the composed, rendered ring, not of the CSS values alone.

## Ruling 7 — The summary box's programmatic focus ring (design §5.3, §3.3): **APPROVED as designed**

The summary box and the success heading are focused by script after a submit, and the design applies the same ring under plain `:focus`, not only `:focus-visible`. That is correct and it is the point: a browser's focus-visible heuristic may judge a programmatic focus move as not needing a visible indicator, and a visitor whose page just re-rendered around an error summary must be able to **see** where focus landed (2.4.7). Same values as the global ring (3px / 2px / focus token); the ring's pair on the box's own ground, warn-50, recomputes at 7.1350:1 (row 15). `tabIndex={-1}` on a non-interactive box is the correct mechanism — focusable by script, absent from the tab order.

One observation, recorded as a note and **not** a condition: the box carries both `role="alert"` and the focus move (the admin box's shipped discipline). Some screen readers may therefore announce the summary's content twice — once as an alert, once as the focused element. That is a verbosity nit, not a criterion failure, and it does not block this ruling; if Quinn's real-browser drive (checks 3.3-V2 / 3.3-V8) hears the doubling, the compliant fix is to drop the `role` and keep the focus move, and that change may be made under this ruling without returning to this seat.

## Ruling 8 — Busy and disabled-submit semantics (design §7, §8.5): **APPROVED as designed**

This treatment satisfies, point for point, the BusyForm gate criteria from my audit §10, which SPEC §4.2.6 adopted:

- **No data-bearing control is ever disabled, greyed, faded, or remounted during a submission** — the fieldset-disable defect class is designed out, not merely avoided, and there is no opacity reduction on any control in any state in the set. Entered data stays editable-visible for the whole flight (4.1.3 / 3.3.1 protected by construction; SPEC §4.2.3 and §4.2.6 answered).
- **Busy is exposed programmatically:** `aria-busy="true"` on the form for the flight's duration, and every resolution lands on an announced state — the summary box (`role="alert"`, focus moved), the error field (focus moved, describedby read), or the success heading (focus moved, `role="status"` where the panel replaces the form). A status that resolves into a headed, focused, announced outcome meets 4.1.3 for this pattern; no silent state exists in the flight.
- **The submit control's busy dress holds its pair:** label swap + native disabled + loss of the inset edge, ground unchanged — white on leaf stays at its recorded 10.6015:1 (row 18) instead of being faded into a failure. State is carried by words and semantics, not by a color failure. Correct.
- CodeEntry's in-flight treatment (§8.5) follows the same discipline: both buttons disable in flight, Verify's label swaps to "Verifying…", and a resend's outcome lands in the component's existing `role="status"` note slot. Approved.

## Ruling 9 — The no-JS floor form's error presentation (SPEC §3.4 as amended; design §8.6): **APPROVED WITH ADJUSTMENT — one adjustment, stated exactly**

What is approved as designed: the floor form renders the **same** states as the enhanced form — error borders via `aria-invalid`, error lines with their §2.1 ids, describedby composition per Ruling 4, the summary box at the form's head for multiple errors (design §8.6) — so a no-JS visitor meets the same dialect, and 1.3.1 / 3.3.1 / 3.3.3 are answered server-side, not by client behavior. The floor form's phone field is visible, labeled as needed only for text alerts, and never carries `required` — correct: native validation must never block an email-only submission the server would accept, and phone-required-if-text is enforced by the server per SPEC §3.3. The entered channel selection is preserved across a failed submission (SPEC check 3.2-G), and neither failure drive may strand the visitor on an error page, a blank state, or `/account`. All of that stands.

**The adjustment:** a failed floor submission is a full document load. Nothing in SPEC §3.4 or design §8.6 places the re-rendered error state in front of the visitor on that load — the summary sits at the head of the waitlist block, but the block sits partway down a variety page, and a visitor returned to the top of the page with no indication in view has, in effect, an unannounced error (the magnifier and low-vision case is the sharpest: a viewport showing the top of the page contains no trace that the submission failed). WCAG does not require focus movement on a document load, but 3.3.1 requires the error to be identified to the user, and identification a visitor never reaches is identification in name only. Mina / the 3.2 build must therefore adopt exactly this:

> **On a failed plain-POST submission (join or code form), the redirect-back URL carries the fragment of the waitlist block's own element id, so the re-rendered page loads with the block at the viewport; the summary box (or, for a single error, the block's error state) renders as designed at the head of the block, unchanged.** On a *successful* floor submission the same fragment applies, so the verify / joined state the visitor is sent back to read is the thing in view.

Nothing else in §3.4 changes: states, copy obligations, the Turnstile disposition (SPEC §3.4.5 — Dustin's ruling, outside this seat), and the enhancement rule that a failed status fetch leaves the floor form on screen are all untouched by this adjustment. Quinn's check 3.2-G gains one observable under this ruling: in both failure drives, the block's error state is in the initial viewport on load, without scrolling.

---

## Summary of dispositions

| # | Item | Ruling | Changes the design? |
|---|---|---|---|
| 1 | §9 pairs, rows 1, 2, 4–13, 15–18 | APPROVED as designed | No |
| 2 | Row 3 — warn on paper-deep, 4.5520:1 | APPROVED as designed, binding condition recorded (contingent value `#895D08` = 4.6175:1 if the pair is ever actually placed) | No — nothing changes now |
| 3 | Row 14 — disabled border exemption | APPROVED as designed; exemption accepted; line-strong fallback not adopted | No |
| 4 | A4 final pattern form | APPROVED as designed — confirmed as the prescription's final form | No |
| 5 | CodeEntry describedby composition | APPROVED as designed — hint-then-error governs; W-2 literal amended by this ruling | No |
| 6 | Focus treatment composition | APPROVED as designed | No |
| 7 | Summary box programmatic-focus ring | APPROVED as designed (one non-blocking note on `role="alert"` + focus) | No |
| 8 | Busy / disabled-submit semantics | APPROVED as designed | No |
| 9 | No-JS floor form error presentation | **APPROVED WITH ADJUSTMENT** — redirect-back URL carries the waitlist block's fragment on failed (and successful) floor submissions | **Yes** — one addition to SPEC §3.4 / the 3.2 build; no visual or token value changes |

No item is rejected. One item (Ruling 9) changes what the 3.2 build must do; no ruling changes any color, token, type, or geometry value in Mina's design.

*— Ada, Accessibility. Evidence: independent recomputation of all §9 pairs and the §5.2 blends from the shipped token hexes (all values reproduced to four decimal places); A4 and W-2 as filed in `full-audit-2026-11-21/sections/ada-accessibility.md` §§6, 8; the BusyForm criteria, ibid. §10; Nadia's Tranche 3 SPEC §§3.4, 4.2, 4.4. Unmeasured and still open, stated plainly: no part of this set has yet been driven with a real screen reader, in forced-colors mode, or at 400% zoom — Quinn's rendered checks (design §11) and the standing AT session list are where those proofs happen, and nothing in these rulings claims them early.*
