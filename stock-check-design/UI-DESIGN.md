# Check Stock Now — UI Design

**Seat:** Mina, UI Design (author). Standing collaborators applied throughout: Thea (typography — §14 is her section, applied as a named type treatment in the shop-design precedent's form; every type value below is hers, the shipped system's, or flagged where the 44px target forces a compromise), Iris (color theory — feeling only; no new hue is introduced anywhere in this design, so her pass is a register check recorded at §2.3, not a palette ruling), Ada (accessibility — WCAG 2.2 AA floor; §13 states every foreground/background pair this design introduces or touches as computed hex pairs so her pass recomputes, it does not discover), Nadia (UX — her SPEC, `stock-check-design/SPEC.md`, is the contract this design dresses; placement, eligibility, and behavior are hers and are not re-decided here), Priya (catalog/data — her ENGINEERING.md timing envelope is the checking state's design input, §6), Wren (copy — §15 enumerates every wording slot this design needs; this document finalizes no words beyond Dustin's fixed link text).
**Date:** 2026-11-22 · **Status:** Design only. No code, no build, no live-site changes. Written so the CSN build brief can lift its visual layer from it verbatim, alongside Nadia's §§0–9 and Priya's response contract.
**Commission:** Dustin, voice call 2026-11-22 — a small link, "Check stock now," on a listing fires a worker to re-read that listing's stock on the seller's own product page; the result is cached for 24 hours. This document designs the control's visual form on both listing card types and the visuals of every state Nadia's §4 defines.

**Governing inputs, as handed to this seat and not re-litigated:** placement is decided (Nadia §2.1 — the control trails the checked-date segment inside the stock line on both card types); the element is a text-styled button in a minimal POST form (Nadia §2.4 / PB-CSN-2 — the visible design honors "link" completely); the freshness window is 24 hours; prices are never shown; the surface is phone-first, every surface a PWA.

**One input arrives reconciled, and this design proceeds on the reconciliation:** the coordinator's ruling keys the 24-hour window on the last check *attempt* (any outcome), matching Priya's §4.2 enforcement. After a couldn't-check, the control therefore does **not** return until 24 hours from that attempt. This contradicts Nadia §4.5 (control returns immediately) and her D-CSN-4 (notice shown only to an attempt's participants, never on a fresh render). §8 designs state (e) under the reconciled model; §16 DR-1 registers the difference in full, and §8.5 states exactly what changes visually if Dustin restores Nadia's version (the notice's dress does not change — only its persistence and the control's presence do). The reconciliation itself is flagged for Dustin in the coordinator's report; it is not this seat's ruling to make or unmake.

---

## 0. The one rule that governs this design

**The control is a clause in the stock line's sentence, dressed exactly as quietly as the sentence it completes.** The stock line already reads as one statement — dot, availability word, separator, checked date. "Check stock now" is that statement's trailing clause, and every visual decision below follows from keeping it one: same size, same sans, same line, one step of color darker than the muted date it follows (the link step the whole site already uses), an underline as its second signal, and no ground, border, radius, icon, or badge anywhere. The card's loudest action stays the "Visit shop →" pill; the heading stays the card's name; the availability word stays the line's semantic peak. If the control ever reads as a button that wandered into a sentence, this design has failed, whatever its measurements say.

Three consequences, stated now because they decide arguments later:

- **If a value is not in §2's token basis, it does not appear in this design.** The exceptions are component tokens composed from existing system values, proposed and flagged in §17 — the control's geometry, the checking pulse, and the emphasis timing. No raw hex, no off-scale pixel, appears anywhere below.
- **The stock line's facts never change dress.** Dot, word tones, date form, and muted remainder are shipped values (Nadia D-CSN-8). This design adds a slot at the line's end and, in one state, a notice line beneath it — and touches nothing else on either card: not the packets, not the notes, not the stem rule, not the footer, not the pill, not the sold-out dress (whose swap at a contradiction is Nadia §6.1 behavior rendered in the ledger's own shipped values, §9).
- **Absence is the design, in two states.** In the fresh state and in the reconciled couldn't-check window there is no control and no control-shaped placeholder — no disabled button, no greyed text, no reserved slot. A placeholder would be a dead control wearing a live one's clothes (Nadia §4.3's reasoning, extended to §8 by the reconciliation). What renders instead is information: a more precise date in the fresh state, a plain notice sentence in the couldn't-check state.

---

## 1. How to read this design / evidence

- §2 is the token basis — every value this design may spend, with its shipped source.
- §3 designs the stock line as a container: its anatomy with the slot, the 44px geometry (PB-CSN-1), alignment, and wrap behavior on both cards at phone and desktop widths.
- §4 designs the control itself — resting, hover, focus-visible, active — once, for both cards.
- §§5–8 design the five states: idle, checking, fresh, stale, couldn't-check (reconciled).
- §9 designs the contradiction moment and the quieter confirming treatment.
- §10 designs skeleton parity. §11 is breakpoints and platform stress. §12 is forced colors and reduced motion beyond §9's emphasis variant.
- §13 is the contrast table — computed hex pairs for Ada. §14 is the Thea type-treatment section. §15 is Wren's slot inventory as this design needs it. §16 is the differences register against Nadia's spec. §17 is token proposals. §18 is open questions with recommendations. §19 is this seat's verification checklist, including what was deliberately not checked.

**Evidence:** Nadia's SPEC read in full (`stock-check-design/SPEC.md` — placement §2, state set §4, contradiction §6, floors §9, my slot §10.1, PB-CSN-1/2 at §13); Priya's ENGINEERING.md (timing envelope §1.4 — typical fresh check 2–6s, slow 6–15s, hard deadline 25s; attempt-keyed 24h window §4.2; the response contract's `state` / `outcome` / `attempted_at` fields §1.2); the Tranche 2 token record (`v2/design-tokens/tokens.json`, kept in exact sync with `globals.css` `@theme`); shipped code from the worktree (`ListingRow.tsx` — the stock line's exact composition, STATUS_TONE map, card grounds and footer; `globals.css` — the global link treatment, `:focus-visible` ring, reduced-motion rule, `.listing-swap` cascade); my shop design (`shop-design/UI-DESIGN.md` §§2, 10, 12–14 — token basis, fact-state register, contrast method, collaborator recording) and grid-card delta (`shop-design/UI-GRID-CARD.md` §§5.2–5.3, 7 — the shop card's flow stack, pinned footer, stock-line transfer, sold-out dress); Thea's grid-card ruling (`shop-design/TYPE-GRID-CARD.md` — her method for type inside this card system). Contrast ratios in §13 were computed for this design from the shipped hex values by the WCAG relative-luminance formula (linearize sRGB; weight 0.2126 / 0.7152 / 0.0722; (L1 + 0.05) / (L2 + 0.05)), stated unrounded in computation and shown to two decimals; values the token record already carries are credited where they appear and agree with recomputation within 0.01.

---

## 2. Token basis — every value this design spends

The system of record is Tranche 2's `tokens.json` / `globals.css` `@theme` as shipped. This design consumes the following, and nothing else.

### 2.1 Color (reference → role in this design)

| Token | Value | Role here |
|---|---|---|
| `color.surface` | `#FFFDF6` | Card ground, available cards (both types) — the ground behind the stock line |
| `color.paper` | `#F8F1E1` | Card ground, sold-out cards (both types — the shipped step-down); page ground |
| `color.paper-deep` | `#F0E5CB` | The contradiction emphasis wash (§9) — the system's one recessed warm tint; no other use |
| `color.muted` | `#6A5F4C` | Date segments (both forms), checking status text, separator remainder — the stock line's shipped remainder color |
| `color.link` | `#1F5C3D` | The control at rest — the site's body-link step, one value step darker than muted |
| `color.leaf` | `#1E4634` | The control on hover and active (the shipped `a:hover` step); the in-stock word/dot (shipped) |
| `color.leaf-600` | `#2E6B4F` | The checking pulse dot (graphic); the control's active wash edge — see §4.4; preorder word/dot (shipped) |
| `color.leaf-50` | `#E3EAD8` | The control's active-state wash (§4.4) — the chip family's interaction tint |
| `color.ink-soft` | `#4A4438` | The couldn't-check notice text (§8) — the fact-notice step, one darker than muted (shop §10.4 precedent) |
| `color.focus` | `#7A3E10` | The global `:focus-visible` ring — unchanged |
| `color.petal` / `color.warn` | `#8E2A52` / `#8A5E08` | **Not spent by any new element.** They appear in §13 only because the shipped stock words in those tones sit on this design's emphasis wash and must be computed there. Petal means sold out and warn means unknown on these cards; no new element may borrow either (Iris's red-family audit, shop §13.1, applied) — in particular the couldn't-check notice takes neither (§8.3) |

### 2.2 Shape, shadow, motion, spacing, target

| Token | Value | Use here |
|---|---|---|
| `size.target` | 44px | The control's minimum height and width (§3.2); the checking status holds the same box (§6.2) |
| `radius.bar` | 4px | The focus ring's corner rounding (the global rule's own value) — the control takes no radius of its own; its active wash (§4.4) takes `radius.inner` |
| `radius.inner` | 8px | The active wash and the emphasis wash corners (§§4.4, 9.2) |
| Shadows | — | **No element in this design casts a shadow in any state.** The slot, status, notice, and washes are flat on the card ground |
| `space.4` / `space.8` | 4px / 8px | Notice gap (§8.2); control inline padding (§3.2); wash inset compensation (§9.2); wrapped-line row gap (§3.4) |
| `spacing.listing-status` | 9px | The stock line's shipped top margin (`mt-listing-status`) — unchanged in every state |
| `duration.filter-item` / `ease.filter-settle` | 220ms / `cubic-bezier(0.22, 1, 0.36, 1)` | **Not** used by the slot. Named here so its absence reads as a decision: the cascade belongs to list swaps; the slot's own timings (pulse, emphasis) are component values proposed in §17, because borrowing the filter tokens would claim a kinship the behavior does not have |
| Motion (proposed, §17) | pulse 1600ms; emphasis 2400ms | Checking pulse (§6.3); contradiction wash (§9.2) — flagged component tokens, composed of no new color or easing values (the pulse's easing is `ease-in-out`, the platform keyword, as the shipped CSS already uses keyword easings outside the token set) |

### 2.3 Iris — feeling check (her seat: feeling only; Ada's floor is §13)

No new hue, tint, or ground enters the system through this design. The control spends the palette's existing link step; the checking dot spends the existing secondary green; the emphasis wash spends the existing recessed paper tint — a *value* event, not a hue event, so a stock flip in either direction (toward leaf or toward petal) is announced by the same warm deepening and the wash itself claims nothing about which way the fact moved. The couldn't-check notice spends no attention hue at all (§8.3). The Quiet Ledger's register — quiet, warm, unhurried, trustworthy — is therefore spent on exactly as before; this feature adds no chroma to any card in any state. Recorded as a register check, not a palette ruling: if a future pass wants the control in any other color, that is Iris's question first, not a build tweak.

---

## 3. The stock line as a container — anatomy, the 44px geometry, alignment, wrap

### 3.1 Anatomy with the slot (normative)

The stock line remains one paragraph — the shipped `<p class="mt-listing-status font-sans text-[13px] text-muted">` — on both cards (ledger, variety context: left-aligned in the text column; shop grid card: centered in the card's centered stack, per UI-GRID-CARD §5.3). Its segments, in order:

| # | Segment | Dress (all shipped unless noted) |
|---|---|---|
| 1 | Dot | 8px circle, `rounded-full`, tone per availability (STATUS_TONE, unaltered), `aria-hidden`, 6px right margin (shipped `mr-1.5`), optically aligned to the word's x-height as shipped (`align-[1px]` in the inline form; centered in the flex form, §3.3) |
| 2 | Availability word | Semibold, tone color (shipped) |
| 3 | Date segment | Muted remainder: ` · Checked {date}` or ` · Not yet checked` — day-granular form in idle/stale/couldn't-check, relative form in fresh (§7). One segment for wrap purposes (§3.4): the separator travels with the date it introduces |
| 4 | **Check slot** (new) | The persistent wrapper Nadia §9.2 requires — never unmounted; contents per state: the control (§4), the checking status (§6), or nothing (fresh, §7; couldn't-check window, §8). When the control renders, the slot's text is ` · ` + the control, and the separator travels with the control unit at a wrap (§3.4) |

**Container mechanism.** In the shipped inline form, a 44px inline target cannot be aligned or wrapped to the rules below. When the slot carries the control or the status (states a, b, d, and e-after-an-attempt in the session that made it), the paragraph composes as a **flex row**: `display: flex; flex-wrap: wrap; align-items: center`, column gap 0 (the separators are text inside their segments, exactly as shipped), row gap 4px (`space.4`, §3.4). In the fresh state — and on any plain render with no slot content — the paragraph is the shipped inline paragraph, byte-for-byte. The flex form changes no rendered text, order, color, or spacing at single-line widths: segments sit on one line, centered on the line's midline, with the same 6px dot margin and the same literal ` · ` separators. It is a composition mechanism for the slot states, specified here because Nadia §10.1 assigns the wrap behavior and target geometry to this seat; §16 DR-4 registers it so the build and Quinn read it as a designed mechanism, not drift.

### 3.2 PB-CSN-1 — the 44px target inside a 13px line: geometry and the named cost

The house floor wins (Nadia PB-CSN-1); this section pays its cost openly and designs how each card absorbs it.

**The control's box.** The control is `display: inline-flex; align-items: center; justify-content: center; min-height: 44px` (`size.target`); `min-width: 44px` (trivially exceeded — see below); `padding-inline: 8px` (`space.8`); `padding-block: 0` (the min-height does the vertical work, so the box is exactly 44px, not 44px plus padding drift). Its text — "Check stock now," 15 characters at 13px sans regular — measures roughly 88–95px depending on platform font; with 16px of inline padding the rendered target is **≈104–111px wide × 44px tall** on both axes past the floor, DOM-measurable for CSN-2. The inline padding is functional, not decorative: it puts 8px of target between the control's text and the date segment's last character on its left, and 8px between the text and the paragraph's edge on its right, so a thumb landing at the phrase's edge still lands on the control, and the focus ring (§4.3) draws around a box that already includes that breathing room.

**The line-box growth.** The shipped stock line's box is one 13px line at the inherited 1.6 leading ≈ **21px** tall. With the control (or the checking status, §6.2) present, the flex line's height is set by its tallest item: **44px**. The stock line's block therefore grows by **≈23px** whenever the control or status is present, and returns to ≈21px in the fresh and couldn't-check states. Per card type:

- **Quiet Ledger (variety page).** The growth lands inside a card whose height already varies with packets and notes; cards in the stack are independent, nothing aligns across cards, and the elements below the stock line (packets/notes block at its shipped 8px step, stem rule, footer) simply sit ≈23px lower on eligible cards than on fresh ones. No other element moves, resizes, or re-dresses. This is invisible as a defect — it reads as the ordinary height variance the ledger already has.
- **Shop grid card.** The stock line sits in the flow stack above the packets/notes block; the pinned footer (`margin-top: auto`, UI-GRID-CARD §5.2/§6) absorbs the ≈23px exactly as it already absorbs Latin-line, name, packet, and note variance: the card's height is set by its row's tallest card, footers align at the shared bottom, and a row mixing fresh and eligible cards shows no misalignment anywhere a visitor can point to. The one honest consequence: on a row of otherwise identical cards, an eligible card's packets block sits ≈23px lower than a fresh neighbor's. That is the fact block flowing at natural height — the grid's established behavior for every other variance — not a CSN defect, and no compensating fixed height is introduced (a fixed stock-zone height would fail Ada's growth floor the way UI-GRID-CARD §5.1's fixed zone would have).

**What does not grow.** The dot, word, and date keep their 13px type and 21px line box *within* the 44px flex line — they center vertically (§3.3) rather than stretching. The card's outer padding, the stock line's 9px top margin, and every gap below the line are unchanged in every state. The growth is exactly one line box, on exactly the cards that carry a live control, for exactly the states that carry one.

### 3.3 Alignment inside the line

- **Vertical.** `align-items: center` on the flex row centers every segment on the 44px line's midline. The dot (8px) centers against the word's cap-to-x band closely enough that its shipped optical offset is preserved in effect: at 13px, the word's visual center and the line's geometric center differ by under a pixel, and the dot reads as sitting on the word, as shipped. The date segment and the control's text share the same centerline, so the sentence reads on one axis — no segment rides high or low against another.
- **Horizontal, ledger.** `justify-content: flex-start` — the line starts at the text column's left edge, under the heading, exactly as shipped.
- **Horizontal, grid card.** The card's stack is centered (`text-center` shell, UI-GRID-CARD §5.2); the flex row centers as a row (`justify-content: center`), so a single-line stock line sits centered exactly as the shipped centered line does, and the control's box is part of the centered whole — the line does not jump left when a control appears on a previously fresh card's next render.
- **The separator rhythm.** Each ` · ` is literal text with its shipped spaces, carried inside the segment it introduces (date segment, slot segment). On one line the rhythm is indistinguishable from the shipped line: word · date · control, evenly spaced by the text itself, never by flex gaps — so no state change can re-space the sentence.

### 3.4 Wrap behavior — the narrow grid column, and every other width

**The rule set (normative, both cards):**

1. **The control's phrase never breaks.** "Check stock now" is one flex item with `white-space: nowrap` on its text; it wraps as a unit or not at all. (Under the extreme resize conditions of §11 the box may grow rather than clip — nowrap governs design sizes; nothing ever breaks *inside a word*.)
2. **The separator travels with its segment.** A wrap never strands a ` · ` at the end of a line and never opens a line with a bare word: if the slot wraps, its leading ` · ` wraps with it, so line 2 opens ` · Check stock now` — the sentence's rhythm survives the break, and the break itself falls at a phrase boundary (Thea's headline rule applied at line scale, §14).
3. **Preferred break order.** Breaks are taken at segment boundaries, latest segment first: the slot wraps before the date segment does; the date segment wraps before the word/dot pair (which never separates — dot + word are one visual unit, and the dot's 6px margin binds them).
4. **Row gap at a wrap: 4px** (`space.4`). A wrapped stock block is therefore ≈21 + 4 + 44 = **69px** tall in an eligible state (21px fact line, 44px control line), or ≈46px in a checking wrap. The 4px also guarantees the control's focus ring (3px + 2px offset = 5px of draw above its box) never strikes the fact line's descenders: the ring's top draw overlaps at most the upper line's empty leading, never its ink.

**At 390px, per card:**

- **Ledger (text column ≈340px).** The common lines fit whole: dot + word + date + control ≈ 290px at 13px. The long tail — a long availability context does not exist (words are ≤11 characters), but "Preorder · Checked Nov 19 · Check stock now" class lines still fit. Wrap on the ledger at phone width is the exception, not the case; when it happens (200% text, §11), rule 2 puts the control unit on line 2, flush left under the dot.
- **Shop grid card (text measure 143px at 390px; 128px at 360px; 108px at 320px — Thea's measured measures, TYPE-GRID-CARD §1).** The line **usually wraps**, as Nadia §2.3 accepts: fact segments ≈ dot 14px + word ≈50–65px + date ≈95–110px already exceed 143px before the slot, so the typical eligible grid card shows the fact line (itself sometimes two lines at 320px: word, then date) with the control unit on the final line, **centered** under the card's centered stack. §16 DR-3 registers the centering against Nadia §2.3's "left-aligned under the dot" phrasing: that sentence describes the ledger's left-aligned line; the grid card's stock line is a centered row by its own anatomy (UI-GRID-CARD §5.3), and a left-flushed control under a centered fact line would be the one element on the card breaking its alignment system. Behavior is identical; only the wrapped line's horizontal rest position follows each card's own alignment, as every other wrapped line on each card already does.
- **Desktop widths.** Ledger text column is wide; grid cards at `lg` (4 columns inside the 72rem container) have text measures ≈230px — most eligible lines fit on one or two lines, and the same rules produce them. No breakpoint changes any value in this design; only the wrap outcome changes, which is what wrap rules are for.

**No horizontal scroll, ever.** At 320px the control unit (≈111px) exceeds the 108px text measure by ≈3px at default size — the one tight measurement in this design, stated plainly: the unit is a flex item in a wrapping row inside a `min-w-0` card stack, so it cannot force scroll; in the worst case its box overflows its line box by those ≈3px *inside* the card's 16px padding, visually absorbed, and CSN-2's 320px drive is the check that proves it. If Quinn's drive shows the phrase crowding the card edge at 320px, the prescribed fix is this seat's: drop the control's inline padding to 4px (`space.4`) at the smallest band only — the target stays 44px tall and ≈103px wide — never shrink the type, never break the phrase. Recorded in advance so the fix, if needed, is a decision already made (§18 OQ-M3).

---

## 4. The control — visual form in its interactive states

One control, one dress, both cards, both eligible states (idle §5, stale §7 — same form, ruled there). The element is a `<button type="submit">` inside its minimal POST form (Nadia §§2.4, 8); the form is `display: inline` in effect — it contributes no box, no margin, no line of its own — and everything below describes the button.

### 4.1 Resting

| Property | Value |
|---|---|
| Text | "Check stock now" — Dustin's fixed words (Wren's scope excludes them, Nadia §10.2) |
| Type | Sans (system stack, `font.sans`), 13px, weight 400, line-height 1.5 (19.5px nominal; the flex box centers it), letter-spacing 0 — the stock line's own type step (§14) |
| Color | `color.link` `#1F5C3D` on the card ground — 7.77:1 on surface, 7.02:1 on paper (§13) |
| Underline | Always on: 1px, currentColor, `text-underline-offset: 3px` — the card's own link offset (the heading link and "Report a problem" both ship `underline-offset-[3px]`). The underline is the second signal beyond color that WCAG 1.4.1 requires of a link-styled element inside text (§14) |
| Ground / border / shadow | None / none / none. The control has no box at rest; its 44px box (§3.2) is geometry, not dress |
| Cursor | The platform's button cursor behavior is left alone; no `cursor: pointer` is added — the underline and color are the affordance, as on every text link this site ships |

The resting control must pass one test above all: read in the line — "In stock · Checked Nov 19 · Check stock now" — it parses as one sentence in one voice, with the final clause one value-step darker and underlined. It does not read as a button, a chip, or a badge, and it never borrows the pill's dress (no fill, no border, no full radius) or the badge family's (no tint ground, no pill shape) — both would promote a reading action into competition with the card's buying action or its stock fact (Nadia §2.2's footer reasoning, applied inside the line).

### 4.2 Hover (fine pointer only)

Color moves `link` → `color.leaf` `#1E4634` — the shipped global `a:hover` step, applied to the button so the slot's hover is the site's hover (10.42:1 on surface, 9.42:1 on paper). The underline stays, same offset, same weight. Nothing else changes: no ground, no size, no position — one moving part per state, the shop design's standing rule. Touch devices get no hover treatment (the system's fine-pointer discipline); a touch user's first feedback is the active state and then the checking state in the same frame as the tap (Nadia §4.2).

### 4.3 Focus-visible

The global treatment, verbatim: `outline: 3px solid color.focus` `#7A3E10`, `outline-offset: 2px`, `border-radius: radius.bar` (4px) — 8.17:1 against surface, 7.39:1 against paper (§13). Geometry checks, both cards: the ring draws 5px beyond the control's box on every side. Above the box, the stock line's 9px top margin plus the segment above's own leading give ≥9px before any ink; below it, the packets/notes block (or the footer pin's minimum 16px on the grid card) sits ≥8px away; at a wrap, §3.4's 4px row gap plus the upper line's leading keep the ring off the fact line's ink. Inline, the ring may overlap the separator's spaces — empty text space, never ink at rest positions, because the 8px inline padding (§3.2) is inside the box the ring surrounds. The ring is never clipped: neither card carries `overflow: hidden` anywhere on the path (the grid card's prohibition is UI-GRID-CARD §5.2's; the ledger card has none), and the cards' 16px inline padding absorbs the ring's 5px draw with room to spare. Focus is never carried by the color change alone — hover's color step and focus's outline are different channels, as shipped everywhere.

### 4.4 Active (pressed)

Two changes, both inside the box: color deepens to `color.leaf` (as hover) and a wash of `color.leaf-50` fills the box at `radius.inner` (8px) for exactly the press — the chip family's interaction tint spent as a momentary press confirmation, the way Material's state layers spend the content color as a wash. The wash's corners are the one radius the control ever shows, and only while a finger or key is down. Text on the wash: link-on-leaf-50 is not a state that occurs (color is leaf in this state) — leaf on leaf-50 is 8.60:1 (§13). On release, the wash leaves with the press; if the press activates, the checking state (§6) replaces the control in the same frame, so the wash is never the last thing seen. No transform, no scale, no position shift in any press state — the control keeps its face (the in-place visual standard).

### 4.5 States the control never has

- **No disabled rendering.** The control is present-and-live or absent (Nadia §4.3). There is no disabled dress to design, and none may be invented at build.
- **No selected / visited dress.** It is an action, not a navigation (Nadia §2.4); `:visited` does not apply to a button and no "already checked" styling exists — recency is the date segment's fact to state.
- **No loading dress of its own.** Loading is the slot's checking state (§6), a different element by Nadia's spec, not a modifier of this one.

---

## 5. State (a) — Idle

**Renders:** the shipped stock line with the slot trailing it (§3.1): dot, word, day-granular date or "Not yet checked," separator, control (§4). Nothing else on the card differs from the shipped card.

**Visual notes specific to idle:**

- **Never-checked listings** ("Unknown · Not yet checked · Check stock now," or another availability with a null date) get no first-run emphasis, badge, or brightened control — the control's dress is identical whether the listing was checked 25 hours ago or never. The line already says the honest thing (Nadia §4.1); dressing the never-checked control louder would spend emphasis on the common case, since with no standing crawl most listings are idle most of the time.
- **The line's balance.** With the control present the ledger line runs ≈290px of its ≈340px column — the sentence sits comfortably left-aligned with air to its right, as a ledger entry should. On the grid card the wrapped form (§3.4) is idle's normal face, not its degraded one.

## 6. State (b) — Checking

Priya's envelope is the design constraint: a fresh check typically resolves in **2–6 seconds**, a slow one in 6–15s, and the state's hard bound is **25s** (ENGINEERING §1.4; Nadia §7.2 recommends a 30s attempt bound for the state itself). The visual must read as *working* at second 2, still read as working — not stalled, not broken — at second 20, and must never promise a proportion of progress it cannot know (Nadia §5.3: no progress bar, no estimate, no percentage). That rules the field's defaults in and out as follows.

### 6.1 What the status is

The slot's control is replaced in place by a **checking status**: a small pulse dot plus wording [slot S1 — Wren's; a short present-tense phrase, e.g. "Checking…"], set as one non-interactive element. The stock line's facts do not change — dot, word, and date stay exactly as they were (§3.1 segments 1–3 untouched) — so the line reads "In stock · Checked Nov 19 · Checking…" — last fact, its age, and the act now being performed on it, in one sentence.

### 6.2 Geometry — the slot does not move

The status occupies the **same box the control occupied**: `inline-flex`, aligned center, `min-height: 44px`, same position in the flex row, same wrap behavior (§3.4 — the status text is `nowrap` as a unit with its dot; its separator travels with it). The swap control → status therefore moves nothing: not the line's height, not the segments to its left, not a single element below it. A visitor's eye and finger stay where they were (the control-keeps-its-face rule, applied to its replacement). The status is not a target: it takes no taps, shows no hover, and its 44px box is a *stability* measure, not a hit area — stated here so Quinn's CSN-4 drive (taps on the status fire nothing) and a reader of the geometry do not mistake it for a control.

### 6.3 The pulse — an activity signal in the Quiet Ledger's register

**Form.** An 8px solid dot — the stock dot's own geometry, so the line carries two dots of one family: the fact's dot (static, tone color) and the act's dot (this one) — in `color.leaf-600` `#2E6B4F` (6.19:1 on surface, 5.60:1 on paper, as a graphic against the 3:1 floor), 6px before the status text, `aria-hidden`. Leaf-600 is chosen deliberately: it is the palette's secondary/working green (hover states, preorder), it is not any availability tone's *word* color in a way that could be mistaken for a second stock fact (the preorder word is leaf-600, but the status dot sits inside the status segment after the date, paired with wording — never beside the availability word), and it spends no attention hue.

**Motion.** Opacity breathes **1 → 0.3 → 1** over **1600ms**, `ease-in-out`, infinite. The values are the design's core timing decision, argued from the envelope:

- **Slow is what survives 25 seconds.** A 0.8–1s spinner cycle reads as urgency for the first seconds and as *stuck* by second ten — its speed keeps promising an imminent end. A 1.6s breath makes no promise: it says "alive," at the tempo of the wait itself. At 2s the visitor has seen one full breath (the tap registered, the act is running); at 20s they have seen twelve identical breaths, none of which claimed to be the last.
- **Opacity, not rotation or travel.** A rotating spinner is the web's loudest loading cliché and the Quiet Ledger has no rotating element anywhere; a traveling dot would move the eye along the line it should be reading. An opacity breath is the smallest motion that carries "in flight" — the same restraint as the site's 220ms cascade, spent at wait tempo instead of swap tempo.
- **No second animated element.** The text does not ellipsis-animate, the line does not shimmer, the card does not dim (Nadia §4.2 forbids the last two outright). One moving part, at one tempo, in one segment.

**Reduced motion.** Under `prefers-reduced-motion` the pulse stills at full opacity (the global rule collapses the animation; this design specifies the resting opacity as 1, not a mid-breath value). The state is carried by the wording, as Nadia §9.6 requires — the dot is decorative-redundant in every motion mode. §12 records the forced-colors behavior.

**The long wait.** Nothing about the status changes at any duration threshold — no "still working…" escalation, no apology copy, no second phrase (those wordings are not in Wren's S1 slot and this design does not open one). A status that changes its story mid-wait teaches the visitor that the first story was a stall warning. The breath at second 20 is the breath at second 2; the bound resolves the state (Nadia §§4.2, 7.2) before patience is the design's problem.

**Off-card.** No page-level indicator, no other card's change, no skeleton anywhere (Nadia §§4.2, 7.4). Other cards' controls stay live and independently checkable; each carries this same status in its own slot when its own check runs.

## 7. State (c) — Fresh, and state (d) — Stale

### 7.1 Fresh — the control absent, the date segment promoted in precision only

**Renders:** dot and word per the current observation; the date segment in Nadia's relative ladder [slot S2 — Wren's rungs: "just now" / minutes / hours]; the slot empty — no element, no placeholder, no reserved width or height. The stock line returns to its shipped inline form and ≈21px box (§3.1).

**The date segment's typographic form (this seat's ruling within Nadia's slot):** the relative form wears *exactly* the day-granular form's dress — sans 13px, weight 400, `color.muted`, same separator, same position — with one addition: `font-variant-numeric: tabular-nums` (§14 gives Thea's reasoning and rules it for both date forms, so the segment's dress never changes between states). Freshness is stated by the words' precision ("Checked 2 hours ago" against "Checked Nov 19"), never by a color step, a weight step, or a "fresh" tint: a greener date would claim a quality (goodness) for what is only a quantity (recency), and would have to un-claim it at the boundary. The boundary crossing itself (state d) is likewise silent in dress — the segment's wording returns to day-granular and the control returns, and those two facts are the whole signal (Nadia §4.4: no live countdown, no mid-read sprouting; evaluated at render).

**Why absence reads correctly here.** The fresh line is the shortest, calmest form of the sentence — fact, word, precise age, full stop. A visitor who has learned the line reads the missing clause as "nothing to do," which is the truth (§0.3 of Nadia's spec). This design adds no "checked ✓" mark, no recency badge, and no leaf tint to help it — each would be a second freshness signal competing with the date the line already carries.

### 7.2 Stale — the control returns, in idle's exact form (ruled)

**Ruling: stale renders identically to idle.** Same control, same dress, same geometry, same position; the date segment in day-granular form (§7.1). The path difference (a card that *was* fresh vs one that never was) has no visual expression.

Reasoning, briefly: the affordance is the same act with the same meaning, and one act gets one dress — a "stale" variant (a different color, an added "again" cue, a weight step) would teach visitors two controls where the system has one, and would spend emphasis at the exact moment the design wants none (the return of the control *is* the signal, Nadia §4.3). What distinguishes the states lives where it belongs: in the date segment's wording, which the visitor is already reading when they reach the control.

## 8. State (e) — Couldn't check, under the reconciled 24-hour attempt window

### 8.1 What renders (reconciled model)

The attempt produced no observation, and under the coordinator's reconciliation it has spent the listing's 24-hour attempt window (Priya §4.2: `attempted_at` is the clock, whatever the outcome). The card therefore renders:

- **The previous facts, byte-for-byte** (Nadia §4.5, unchanged by the reconciliation): dot, word, and date exactly as before the attempt; `lastCheckedAt` unmoved; no stock state guessed, softened, or removed. The stock line is the shipped inline line at ≈21px — the slot is empty, as in fresh, but for the opposite reason, which is why this state needs its second element:
- **One notice line under the stock line** [slot S4 — Wren's cause variants, §15], stating that the check could not be completed, that the stock shown is as of the date on the line, **and when checking becomes possible again** — the reconciled model's required third fact (the retry horizon, stated in the notice's plain terms — a day word or a time, as Wren rules the phrasing; this design specifies no countdown, no timer, and no live ticking element, extending Nadia §4.4's no-countdown principle to this state).
- **No control**, and no control-shaped placeholder, until the window lapses — at which render the card is stale (§7.2) and the notice is gone.

**Persistence under the reconciliation.** Because the window now keys on the attempt, the notice is a property of the listing's current state for that window, not only of the session that attempted: a visitor arriving an hour after someone else's failed check sees the same card — true old facts, the notice, no control. §16 DR-1 registers this against Nadia D-CSN-4 in full. The visual consequence this seat designs for: the notice must read as a *standing fact about the listing's checkability*, calmly stated — not as an error banner left behind by someone else's session. §8.2's dress is chosen to survive that reading.

### 8.2 The notice line's dress

| Property | Value |
|---|---|
| Position | Directly under the stock line, inside the card's text flow, before the packets/notes block (ledger) / inside the centered stack (grid card) |
| Gap above | 4px (`space.4`) — the fact-line step (the shop design's count-line → notice step, §10.4 there), binding the notice to the line it annotates |
| Type | Sans 13px — the stock line's own size and family (it belongs to the stock block, not to the card's 14px notes register), weight 400, line-height 1.5 (19.5px) |
| Color | `color.ink-soft` `#4A4438` on the card ground — 9.49:1 on surface, 8.58:1 on paper (§13). One value step darker than muted: findable beside the line it follows, in the fact register — the shop §10.4 notice precedent, at the stock block's size |
| Alignment | Ledger: left, with the stock line. Grid card: centered, with the card's stack; wraps at phrase boundaries within the text measure (§8.4) |
| Ground / border / icon | None / none / none. No `warn-50` panel, no left rule, no glyph — the §10.0 fact-state register of the shop design: plain text on the card ground |

### 8.3 Why the notice takes no attention dress

Three candidate dresses were considered and rejected, for the record:

- **`color.warn`** (the in-place failure line's color, shop §10.5) — rejected. Warn is the palette's *transient* attention register ("that didn't apply — try again"), spent on a line that clears at the next success. This notice stands for up to 24 hours as a property of the listing; dressing a day-long fact in the transient alarm color would cry wolf on every card it touches and would read, to the next visitor, as something *wrong with the seller's stock* — precisely the implication Nadia §7.3 forbids publishing. The situations also differ in kind: the failure line reports *the visitor's own* action failing; this notice reports *our* reading failing, earlier, possibly for someone else.
- **A tinted panel (`warn-50` ground, border, icon)** — rejected. A panel is a container, and a container claims an event; there is no event here for a later visitor, only a standing fact. Panels also break the card's composition in the grid, where the notice would become the card's only boxed element.
- **Dimming the stock line** (reduced opacity, a greyer word) to mark its age — rejected outright. The facts stand at full standing (Nadia §4.5); dimming would falsify them visually, would drop the word/dot pairs below their computed contrast, and would punish the honest date for the attempt's failure. The line's age is stated by its date and by the notice's words — never by making the fact harder to read.

What remains — one quiet ink-soft sentence — is the dress that lets the card look **unbroken**: a normal card, with its normal stock line, plus a plainly-worded note that we could not re-read it and when we can try again. It does not look dead, because it does not present a dead control; it does not look alarming, because it spends no alarm register; it does not look like an accusation against the seller, because its dress is the directory's own fact voice (Wren's wording obligations at §15 carry the same restraint in words).

### 8.4 The notice in the narrow grid column — an honest cost, with a copy-length note

At the grid card's 143px text measure (390px), a two-clause notice at 13px wraps to roughly **4–6 lines** (≈78–117px of card height, absorbed by the pinned footer like all variance, §3.2). That is the reconciled state's real cost on the shop card, and no visual treatment in this seat's power removes it without shrinking type (forbidden — 13px is already the line's floor step) or truncating the fact (forbidden — the retry horizon must be stated). The mitigation available is wording length, which is Wren's craft: §15 flags S4 with a design recommendation that the grid rendering be held in mind — a notice that carries its three facts in **one short sentence** (≈90 characters or fewer) wraps to ≈4 lines at 390px and ≈5 at 320px, and reads as a note; a two-sentence notice reads as a paragraph that wandered into a product card. On the ledger (≈340px column) the same sentence is 2 lines and unremarkable at any plausible length.

### 8.5 If Dustin restores Nadia's version

The visuals that change are exactly two, and neither is a dress: (1) the control returns immediately in the slot, in §4's form, below-right of the same facts; (2) the notice becomes session-scoped (participants only, never a fresh render). The notice's type, color, position, and gap are unchanged — they were chosen to read correctly as either a standing fact or a session note. No other section of this design depends on the reconciliation.

## 9. The contradiction moment — transient emphasis on an in-place flip

Nadia §6.1 fixes the behavior: at resolution, dot tone, word, date segment, and the sold-out dress swap **once, atomically**, the live region announces once (naming old and new), and the stock line carries a brief visual emphasis. This section designs the emphasis and its confirming-case counterpart.

### 9.1 What the emphasis is for — and what it must not do

It exists for one visitor: the one *looking at the card* when the answer lands, whose peripheral reading would otherwise miss a silent swap (change blindness, Nadia §6.1). It must draw that eye without alarming it, must say "this line changed" without claiming *which way* it changed (the word and dot say that), must leave no residue in any later render, and must never replay for a returning visitor (Nadia §5.2 — off-screen and return cases get the truthful card, not a re-enactment; the emphasis class is applied only by the in-place resolution path, never by a render).

### 9.2 The changed-result emphasis — a warm wash behind the stock line

- **Form:** a background wash of `color.paper-deep` `#F0E5CB` behind the **stock line only** — the full stock block (both wrapped lines on a grid card), at `radius.inner` (8px) corners. Paper-deep is the system's recessed warm tint: on a surface card it reads as the line being briefly *held up to the light*; on a paper (sold-out) card it is one step deeper than the ground — visible in both directions of flip, hue-neutral in both (§2.3), and already the ground the system uses for quiet factual emphasis (the protection notice's ground). No border, no outline, no shadow accompanies it.
- **Geometry — reserved, so nothing shifts.** The stock paragraph carries the wash's inset permanently in the slot states: `padding: 2px 6px; margin: -2px -6px` (block/inline; `space`-scale-adjacent component values, §17) — text position is identical with the wash transparent or full, so the emphasis changes a background and nothing else: no reflow, no jump, no neighbor movement, on either card. (In the fresh state's plain inline paragraph the same padding/margin pair applies whenever the emphasis class is applied at resolution — the class and the inset arrive together and leave together, and because margin compensates padding exactly, even that arrival moves no ink.)
- **Timing:** one pass, **2400ms** total, then transparent, class removed, no residue: fade in over the first ≈300ms (the `ease.filter-settle` curve's character — fast settle, no bounce — spent as a component timing, §17), hold at full strength ≈1500ms, fade out over the remaining ≈600ms. The hold is the design point: a sub-second flash is a flicker a reading eye discounts; ≈1.5s at full strength is long enough to be *noticed and read against* ("that line — it changed") while the announcement lands, and the slow exit returns the card to the Quiet Ledger's register without a second event. Total elapsed is well inside the Doherty comfort band for a state change the visitor caused and awaited.
- **Scope discipline.** The wash touches the stock line and nothing else: not the card ground (the sold-out dress swap is a separate, permanent-until-next-fact change rendered in its own shipped values, in the same atomic swap — the wash must not blur the line between "this fact changed just now" and "this card's standing dress"), not the pill, not the packets. A flip to sold out therefore shows: ground steps down, shadow softens, pill fill leaves, word/dot/date swap — and the stock line alone carries the transient wash over its new ground. Every pair the wash creates is computed in §13, including the tightest (warn word on paper-deep, 4.55:1 — §18 OQ-M1 flags it for Ada by name).
- **Forced colors:** the wash's background remaps like all grounds (§12); the emphasis is simply absent in that mode, and nothing depends on it — the word, dot, dress, and announcement all survive. The wash never carries meaning alone in any mode.

### 9.3 The reduced-motion variant (mandatory)

Under `prefers-reduced-motion`, the fade is not run. The variant is a **static hold**: the wash appears at full strength with no transition, holds **3000ms**, and is removed with no transition. Nothing moves, nothing animates; a background steps on and later steps off, which is a state change, not a motion effect — and a sighted reduced-motion visitor who watched their tap land gets the same "this line changed" signal the announcement gives a screen-reader user. §16 DR-2 registers this against Nadia §6.1's "suppressed under `prefers-reduced-motion`" phrasing, with this seat's reasoning: suppression would leave the visual channel entirely empty for exactly the visitors who asked for calm, when a motionless variant exists that respects the request's letter (no motion) and its intent (no vestibular or attention hijack). If Ada or Quinn rules suppression instead, the change is one line of this spec — the wash's dress, timing, and geometry are unaffected.

Implementation note for the build, stated as a design requirement: the shipped global reduced-motion rule collapses CSS animation durations, so the static hold's 3000ms must be carried by the same class-removal timing the animated pass uses (a timed class), not by an animation the global rule would instantly complete. The animated pass may be CSS-animation-driven; its removal at 2400ms and the variant's at 3000ms are the contract either way.

### 9.4 The confirming result — deliberately quieter (ruled)

When the check confirms the displayed stock, the swap still happens (date segment refreshes to the relative form, the control leaves, the confirming announcement fires — Nadia §6.1) and **no wash is applied**. The difference is binary and learnable: **the wash means the answer changed.** A confirming check's visual news is already real — the control the visitor tapped resolves, the status leaves, and the date sharpens to "just now" in the same swap — and spending the emphasis there too would halve its meaning on the occasions it matters (a directory where half of all checks confirm would train visitors to ignore the wash precisely before a flip needs it). No smaller or shorter wash variant is designed: a 50%-strength echo is a third signal nobody can learn. Confirmation reads as calm; change reads as a held breath of warm tint. That contrast is the design.

## 10. Skeleton parity

Nadia §10.1 requires it: any skeleton of a listing card gains a slot bar in the trailing position, so a loading card promises the control it will carry.

- **Ledger skeleton** (`ListingSheetSkeleton`): the shipped status bar (`mt-2 h-3 w-40`) gains a trailing segment — the bar lengthens in composition, not in kind: status bar `w-40` followed on the same line by a **slot bar `h-3 w-24`** (≈96px — the control's text width at skeleton abstraction), separated by the skeleton bars' established gap rhythm. Because a skeleton cannot know whether the loaded card will be eligible or fresh, the slot bar renders on **every** ledger skeleton card: it promises the *slot*, not the control — a fresh card resolving without a control is a skeleton that promised slightly more than the card holds, which is the skeleton contract everywhere (bars promise anatomy, not data). The alternative — no slot bar — would make every eligible card grow a line segment its skeleton never promised, a visible pop on the directory's most common card.
- **Shop grid card skeleton** (UI-GRID-CARD §8.2's shop-context skeleton): its stock bar (`h-4 w-3/5`) gains the same trailing slot bar at the stock bar's height (`h-4 w-16`, centered composition) — and, because the grid card's stock block wraps, the skeleton's stock zone takes the two-line rhythm (fact bar, then slot bar centered beneath) that §3.4 makes the eligible card's normal face. No other skeleton bar changes; no stem bar is involved in either skeleton (the grid skeleton's stem exclusion is UI-GRID-CARD §8's, untouched).
- Skeleton bars are decorative (`aria-hidden` in the shipped skeleton pattern) and create no contrast pair for §13.

## 11. Breakpoints and platform stress

Phone-first throughout; iPad is a wider phone for this public surface; desktop is the proper desktop layout. No value in this design changes at any breakpoint — only wrap outcomes (§3.4) change.

| Width | The slot's behavior |
|---|---|
| 320px (reflow floor) | Ledger line wraps per §3.4 (control unit to line 2, flush left). Grid text measure 108px: fact segments wrap to two lines, control unit on its own line, centered; §3.4's ≈3px worst-case snugness applies and CSN-2 is its check. No horizontal scroll |
| 390px (design width) | Ledger: single line, the common case. Grid: wrapped form is the normal eligible face (§3.4) |
| 744px (iPad portrait) | Public layout as at phone widths with more air; ledger lines single; grid at 3 columns — measures ≈180px, eligible lines wrap less often, same rules |
| 1280px (desktop) | Ledger column wide — single lines always. Grid at 4 columns, measures ≈230px — most eligible lines on one line or two. Hover treatments (§4.2) active for fine pointers |

**Text at 200% / text-spacing overrides (WCAG 1.4.4 / 1.4.12).** The control's box is a *minimum* height: at 200% text the phrase (≈26px) still fits the 44px box on one line at ledger widths; at grid widths the flex row wraps (§3.4) and the stock block grows — it never clips, because no container on either card fixes the stock block's height (§3.2) and neither card clips overflow (§4.3). Under the 1.4.12 overrides (line-height 1.5×, letter-spacing 0.12em ≈ +24px across the phrase, word-spacing 0.16em), the control unit widens to ≈135px: on the ledger it still fits its line in most cases and wraps cleanly in the rest; on the grid card it takes its own line, as designed. The status and notice grow by the same rules. The one property that must survive implementation verbatim: `min-height`, never `height`, on the control and status boxes.

**PWA / lifecycle.** No visual state in this design is stored client-side; a killed-and-restored PWA renders the listing's current state server-side (fresh, stale, or couldn't-check window) with no resurrected checking status and no emphasis replay (Nadia §5.2) — the design's states are all render states, so restoration needs no visual provision beyond what is specified.

## 12. Forced colors and reduced motion (beyond §9.3)

- **Forced colors.** Every distinction in this design lives in real text, a real outline, or a real underline — never in a ground, a tint, or a shadow — so the mode costs the design only its decorations: the control remains identifiable (its text and underline are text), focus remains the outline-carried global ring, the checking state remains its wording (the pulse dot remaps or vanishes — decorative-redundant by design), the notice remains its sentence, and the emphasis wash (§9.2) remaps to the system ground and effectively disappears, with the announcement and the swapped facts carrying the moment. The stock dot remaps as all shipped dots do; the word beside it was always the carrier (Nadia §9.3).
- **Reduced motion.** The pulse stills (§6.3), the emphasis becomes the static hold (§9.3), hover/active color steps are instant (the global rule collapses transitions — no information rides them), and no other element in this design moves in any mode. There is no loading spinner anywhere in this feature, in any state, under any preference — that sentence is a design invariant, recorded for Quinn.

## 13. Contrast — every pair this design introduces or touches, for Ada

Method: §1. Floors: 4.5:1 normal text (every text element here is 13px — none qualifies as large), 3:1 non-text (graphics, focus) per WCAG 2.2 AA 1.4.3 / 1.4.11. **No value is rounded into a pass.** Pairs wholly inside shipped components are the Tranche 2 record's except where this design newly composes them (the emphasis wash is a new ground behind shipped words, so those pairs are computed here in full).

| # | Foreground (hex) | Background (hex) | Ratio | Floor | Verdict |
|---|---|---|---|---|---|
| K-1 | Control at rest — `color.link` `#1F5C3D` | Card ground, available — `color.surface` `#FFFDF6` | 7.77:1 | 4.5 | ✓ |
| K-2 | Control at rest — link `#1F5C3D` | Card ground, sold-out — `color.paper` `#F8F1E1` | 7.02:1 | 4.5 | ✓ |
| K-3 | Control hover/active — `color.leaf` `#1E4634` | surface `#FFFDF6` | 10.42:1 | 4.5 | ✓ |
| K-4 | Control hover/active — leaf `#1E4634` | paper `#F8F1E1` | 9.42:1 | 4.5 | ✓ |
| K-5 | Control active text — leaf `#1E4634` | Active wash — `color.leaf-50` `#E3EAD8` | 8.60:1 | 4.5 | ✓ |
| K-6 | Focus ring — `color.focus` `#7A3E10` | surface `#FFFDF6` | 8.17:1 | 3.0 | ✓ |
| K-7 | Focus ring — focus `#7A3E10` | paper `#F8F1E1` | 7.39:1 | 3.0 | ✓ |
| K-8 | Focus ring — focus `#7A3E10` | leaf-50 wash `#E3EAD8` (ring over the active wash's edge) | 6.75:1 | 3.0 | ✓ |
| K-9 | Date segment, both forms; checking status text — `color.muted` `#6A5F4C` | surface `#FFFDF6` | 6.15:1 | 4.5 | ✓ |
| K-10 | Date segment; checking status text — muted `#6A5F4C` | paper `#F8F1E1` | 5.56:1 | 4.5 | ✓ |
| K-11 | Checking pulse dot (graphic) — `color.leaf-600` `#2E6B4F` | surface `#FFFDF6` | 6.19:1 | 3.0 | ✓ |
| K-12 | Checking pulse dot (graphic) — leaf-600 `#2E6B4F` | paper `#F8F1E1` | 5.60:1 | 3.0 | ✓ |
| K-13 | Couldn't-check notice — `color.ink-soft` `#4A4438` | surface `#FFFDF6` | 9.49:1 | 4.5 | ✓ |
| K-14 | Couldn't-check notice — ink-soft `#4A4438` | paper `#F8F1E1` | 8.58:1 | 4.5 | ✓ |
| K-15 | Stock word "In stock" — leaf `#1E4634` | Emphasis wash — `color.paper-deep` `#F0E5CB` | 8.47:1 | 4.5 | ✓ |
| K-16 | Stock word "Sold out" — `color.petal` `#8E2A52` | paper-deep `#F0E5CB` | 6.44:1 | 4.5 | ✓ |
| K-17 | Stock word "Preorder" — leaf-600 `#2E6B4F` | paper-deep `#F0E5CB` | 5.03:1 | 4.5 | ✓ |
| K-18 | Date segment / remainder — muted `#6A5F4C` | paper-deep `#F0E5CB` | 5.00:1 | 4.5 | ✓ |
| K-19 | Stock word "Shop closed" — muted `#6A5F4C` | paper-deep `#F0E5CB` | 5.00:1 | 4.5 | ✓ |
| K-20 | Stock word "Unknown" — `color.warn` `#8A5E08` | paper-deep `#F0E5CB` | **4.55:1** | 4.5 | ✓ — thinnest margin in this design; flagged for Ada at §18 OQ-M1 |
| K-21 | Control text during changed-result wash (slot is empty at that moment — listed to close the set: no control pair exists on the wash) | — | — | — | n/a by state |

**Summary for Ada:** 20 computed pairs, all passing their floors. Every pair is a shipped-token pair; the only *new compositions* are K-5 (active wash), K-8 (ring over that wash), and K-15…K-20 (shipped stock-line text on the paper-deep emphasis wash). The tightest text pair in the design is K-20 (warn on paper-deep, 4.55:1, transient ≤2.4s, on a word whose standing pairs are 5.60:1 / 5.06:1) — named here and at §18 so her pass rules on it knowingly. The pulse dot's opacity breath (K-11/K-12 at full strength) dips its *instantaneous* ratio toward the ground at the breath's trough (opacity 0.3); the dot is decorative-redundant (the wording carries the state, §6.3), so no floor attaches to the trough — stated so she does not have to discover the reasoning.

## 14. Type treatment — Thea (standing collaborator; her standards applied)

*This section is the deliverable's named type-treatment section, in the form of the shop design's §14 precedent: every text element this feature sets, with its full settings stack, each value traced to Thea's playbook ranges or the shipped system, and every compromise the 44px target forces flagged by name.*

### 14.1 The settings stacks

| Element | Face / weight | Size / line-height | Spacing | Color (token) | Notes |
|---|---|---|---|---|---|
| Control — "Check stock now" | Sans (system stack) / 400 | 13px / 1.5 (19.5px nominal, flex-centered in the 44px box) | Letter-spacing 0; underline 1px, offset 3px | link → leaf (states, §4) | §14.2 |
| Date segment — day-granular ("Checked Nov 19") | Sans / 400 | 13px / inherited 1.6 (≈21px line box) | 0; `tabular-nums` | muted | Shipped dress, unchanged; §14.3 |
| Date segment — relative ladder ("Checked 2 hours ago") | Sans / 400 | 13px / inherited 1.6 | 0; `tabular-nums` | muted | Identical dress to the day form — §7.1; §14.3 |
| Checking status [S1] | Sans / 400 | 13px / 1.5 nominal, flex-centered in the held 44px box | 0 | muted | §14.4 |
| Couldn't-check notice [S4] | Sans / 400 | 13px / 1.5 (19.5px) | 0 | ink-soft | §14.5 |
| Stock word / dot (context, not set by this design) | Sans / 600 | 13px / inherited 1.6 | 0 | tone per availability | Shipped; recorded because every element above is set *against* it |

### 14.2 The control's type — a link's dress at the line's own step

- **Size: 13px, the stock line's step — no new step is minted.** Thea's scale discipline (roles before sizes; a new step only for a new role) governs: the control is not a new role, it is the line's trailing clause, and setting it at any other size would either demote Dustin's words below the date they follow (12px — also below the card system's floor step) or promote them toward the availability word (14px+), breaking the sentence's hierarchy. The site's other in-card text action, "Report a problem," is also 13px sans — the control joins an existing in-card action step rather than inventing one.
- **Weight: 400, regular.** The line's emphasis budget is already spent — the availability word carries the line's one semibold. A semibold control would double-signal the line (Thea's doubled-emphasis rejection, applied at line scale) and would read as a button label rather than a clause. The control's affordance is carried by color step + underline, the link system's two signals, not by weight.
- **Underline: always on, 1px, offset 3px.** Three grounds: (1) WCAG 1.4.1 via Thea's rule — a link-styled element inside text needs a second signal beyond color, and inside a 13px muted line the color step alone (link vs muted) is exactly the subtle distinction that rule exists for; (2) the card's own precedent — heading link and Report both ship underlined at offset 3px, so the control's underline makes the card's three text actions one family; (3) the phrase itself cooperates — "Check stock now" contains **no descenders**, so the underline at 3px offset sits clear of every letterform with room to spare (Thea's descender-slicing objection to underlines does not arise on this string, and would not at this offset regardless).
- **Case and spacing:** sentence case as Dustin wrote it; letter-spacing 0 (tracked lowercase is a type crime in Thea's catalog; nothing here is a label in the caps sense). No italic — italic in this card system is botanical (the Latin line's signal, Thea T-1 on the grid card); an italic control would borrow the scientific-name channel for an action.

### 14.3 The date segments — one dress, two precisions, tabular figures

Both date forms share one settings stack (§14.1) so the segment's *dress* never changes when its *precision* does — the state change is carried by wording alone (§7.1), which is what lets the stale boundary pass silently and the fresh swap read as a sharpening rather than a restyle. `font-variant-numeric: tabular-nums` is ruled for **both** forms: Thea's tabular case is figures that update in place, and this segment is exactly that — it swaps "Nov 19" → "just now" → "2 hours ago" in place at resolution — so its digits take the figure style that does not shift width as values change. Lining figures (the sans default) stand; no oldstyle figures are introduced into the tool layer. The ladder's rungs themselves (where "just now" ends and minutes begin) are Nadia's structure and Wren's words; the typographic obligation this section adds is only that every rung fit the segment's dress without a size, weight, or color exception — a rung that needed emphasis to parse would be a wording failure sent back to Wren, not a type fix.

### 14.4 The checking status — the line's remainder voice

The status is set as the date segment's peer: 13px sans regular muted, letter-spacing 0, no italic, no ellipsis animation in the type itself (the wording's ellipsis, if Wren's S1 carries one, is a static character). Its nominal line-height (1.5) differs from the line's inherited 1.6 for one reason only: inside the held 44px flex box the text is centered by the box, so its line-height is a nominal stack value, not a rhythm value — flagged at §14.6 with the rest of the target's compromises. The status never takes the control's link color or underline: it is not an action, and dressing it as one would be the dead-control failure in type form.

### 14.5 The couldn't-check notice — fact register at the line's size

13px (the stock block's size — the notice annotates the stock line, and stepping it to the card's 14px notes size would promote it above the line it serves), line-height **1.5** — inside Thea's 120–145% body band's upper neighborhood at 150%… stated precisely: 1.5 sits just above her 145% body ceiling, chosen because the notice is a two-to-six-line wrapped block in a 108–143px measure on the grid card, where the extra leading is what keeps wrapped lines from reading as a solid lump at caption size; it matches the shop design's failure-line leading family (sans tool text at 1.5) rather than the serif body band, because this is tool-layer text, not reading prose. The deviation from the 145% figure is named here rather than rounded away: if Thea rules 1.45 (18.85px) instead, the design takes her value with no other change — the difference is 0.65px per line. Weight 400, letter-spacing 0, ragged right / centered-by-card (§8.2), hyphenation off (screen ragged-right rule).

### 14.6 Compromises the 44px target forces — flagged, as commissioned

1. **The line's leading rhythm breaks, by ≈23px, in the slot states.** Thea's vertical-rhythm doctrine binds gaps to the base leading; the stock line's base leading is ≈21px, and the control's box makes its flex line 44px — an effective leading of 3.38× the 13px size inside that line. There is no typographic fix: the alternatives are a sub-floor target (rejected by the house standard, PB-CSN-1) or shrinking the type (rejected at §14.2). The compromise is contained — it affects one line's box, on eligible cards only, and the card's other gaps (9px above, 8px below) are untouched multiples of the spacing scale — but it is a real break in the line's rhythm and it is recorded as the type cost of the house target, not smoothed over.
2. **Centered, not baseline, alignment inside the slot states.** A 44px flex line aligns its segments by center (§3.3); the shipped inline line aligns by baseline. At 13px the optical difference is sub-pixel for the word/dot pair (§3.3), but the mechanism change is named: baseline purists would keep the date on the word's baseline and let the control's box overflow its line — which is precisely the layout instability PB-CSN-1 forbids. Center alignment is the honest mechanism for a mixed-height line.
3. **The notice's 1.5 leading** (§14.5) — a 5-point step above Thea's body ceiling, in tool-layer text, flagged for her confirmation rather than silently set.

No other type compromise exists in this design: no size is reduced to fit, no letterform is condensed or scaled, no faux style is used anywhere, and every string renders verbatim at every width (§3.4, §11).

## 15. Copy-slot inventory for Wren — as this design needs it

This design finalizes no words. Nadia §10.2 owns the slot definitions (S1–S5); below is only what the *visual* design adds to each slot's obligations.

| Slot | Visual-design addition |
|---|---|
| S1 — Checking status | Must parse as the stock sentence's trailing clause after the date ("… · Checking…") at 13px, `nowrap` as one unit with its dot (§6.2) — keep it short (≤ ~14 characters incl. ellipsis) so the ledger line stays one line in the common case and the grid wrap stays at two lines |
| S2 — Relative ladder | Every rung must fit §14.3's dress with no exception; the longest plausible rung ("Checked 23 hours ago") is the wrap-test string for §3.4 |
| S3 — Result announcements | No visual rendering; no design constraint beyond Nadia's |
| S4 — Couldn't-check notices (×3 causes) | Under the reconciliation each variant must also carry the retry horizon (§8.1) in the same sentence rhythm. **Length recommendation (§8.4): one sentence, ≈90 characters or fewer**, so the grid card's notice wraps to ≈4 lines at 390px rather than 6. The three variants must be visually indistinguishable in dress — cause is carried by words only |
| S5 — Accessible name pattern | No visual constraint; the visible label is Dustin's fixed text and leads the name (label-in-name, Nadia §9.5) |
| — (confirmation) | Wren also confirms, per Nadia §10.2, that the stale/idle line reads as one sentence with the control trailing it in both card contexts, including the "Not yet checked" form — §4.1's resting test is the visual half of that check |

## 16. Differences register — what this visual design forces back onto Nadia's spec

| ID | Difference | Disposition |
|---|---|---|
| DR-1 | **State (e) persistence and control absence follow the coordinator's reconciled model, not Nadia §§4.5/D-CSN-4.** Nadia: control returns immediately after a couldn't-check; notice is participant-only and never part of a fresh render. Reconciled (this design): control absent for 24h from the attempt; notice renders as the listing's standing state for that window (§8.1). Consequences Nadia's checks must absorb if the reconciliation stands: CSN-10's "the control is present again immediately" and "a later fresh visit shows no notice" are both reversed; the notice needs a render-state definition (it is now D-CSN-4 revised, not D-CSN-4 as written) | **Flagged for Dustin** (coordinator's report carries the ruling); Nadia to re-point §4.5 and CSN-10 to whichever model he confirms. This design's §8.5 states the exact visual delta if he restores hers |
| DR-2 | **Reduced-motion emphasis is a static hold, not suppression** (§9.3), against Nadia §6.1's "suppressed under `prefers-reduced-motion`" | This seat's recommendation, with reasoning at §9.3; Ada/Quinn may rule suppression — one-line change, no other section affected |
| DR-3 | **Wrapped control alignment on the grid card is centered**, against a literal reading of Nadia §2.3's "left-aligned under the dot" (§3.4) | Ruled here as each card's own alignment system governing its wraps; behavior identical. Nadia to confirm the sentence was ledger-scoped |
| DR-4 | **The stock paragraph composes as a flex row in the slot states** (§3.1) — a mechanism Nadia's spec leaves to this seat (§10.1: wrap behavior and target geometry), registered so the DOM change is read as designed, not drift. Rendered text, order, and single-line appearance are byte-identical to the shipped line | Within the §10.1 slot; no behavior change |

**Otherwise, the register is empty.** No placement, eligibility, state, announcement, focus, or sort behavior in Nadia's spec is altered by this visual design; in particular §6.2's grouped-sort hold (OQ-CSN-1, Dustin's to rule) is untouched — the emphasis and dress designs above are identical whether the flipped card later holds position or re-orders, because both are properties of the card, not of its cell.

## 17. Token proposals — flagged for the register

**No new system token and no new raw color, radius, shadow, or type value is proposed.** The following **component tokens** are proposed for `tokens.json`'s register, composed entirely from existing system values and platform timing keywords — they name the slot's assemblies so the build implements them from one source of truth (the shop design §16 discipline):

| Proposed token | Value | Justification |
|---|---|---|
| `component.stock-check.control.min-height` | `{size.target}` (44px) | PB-CSN-1's geometry, named where the control is defined (§3.2) |
| `component.stock-check.control.padding-inline` | `{space.8}` (8px) | Target extension + ring clearance inside the box (§§3.2, 4.3) |
| `component.stock-check.status.min-height` | `{size.target}` (44px) | The stability box (§6.2) — same value, separately named because its reason differs (stability, not target) |
| `component.stock-check.pulse.duration` | 1600ms | The checking breath (§6.3); easing `ease-in-out` (platform keyword), opacity range 1 → 0.3 |
| `component.stock-check.emphasis.duration` | 2400ms (3000ms static hold under reduced motion) | The contradiction wash (§§9.2–9.3) |
| `component.stock-check.emphasis.ground` | `{color.paper-deep}` | Alias, recorded so the wash's ground is a token reference, not a class decision (§9.2) |
| `component.stock-check.wash.inset` | 2px block / 6px inline (padding with compensating negative margin) | The no-shift wash geometry (§9.2); 6px is on the spacing scale's documentation (Tailwind 4px-base, `space` steps include 4/8 — 6px is the shipped `.packet` keyline-adjacent half-step the skeleton and strip paddings already use at `px-1.5`/`py-1.5` = 6px, so the value has shipped precedent) |

If the register declines any of these, the design is unchanged — the values stand, only their naming home differs.

## 18. Open questions — each with this seat's recommendation

- **OQ-M1 — The warn word on the emphasis wash passes at 4.55:1 (K-20), the design's thinnest margin.** It is a shipped word on a transient (≤2.4s) ground, and every alternative wash ground is worse for some other word or spends a hue (§9.2). **Recommendation: accept, with Ada ruling knowingly.** If she wants more margin, the prescribed fix is hers by the house rule (nearest passing value) — this seat's candidate to hand her is deepening the wash one step toward `paper-deep`'s neighbor in value only, never a hue change; no unilateral adjustment is made here.
- **OQ-M2 — S4 notice length on the grid card (§8.4).** **Recommendation: Wren holds the ≈90-character, one-sentence guidance** when ruling S4's three variants under the reconciliation; if a cause variant cannot carry its facts in that length, the design accepts the longer wrap (the footer absorbs it) rather than truncating a fact — length is a recommendation to copy, never a license to cut content.
- **OQ-M3 — The 320px control snugness (§3.4).** **Recommendation: build as specified; let CSN-2's DOM measurement decide.** The pre-ruled fix (inline padding 8px → 4px at the smallest band) is recorded at §3.4 so the gate does not improvise one.
- **OQ-M4 — The pulse under Quinn's gate (§6.3).** If Quinn's real-browser drive finds the 1.6s breath reads as anxious at the 15–25s tail in the Quiet Ledger's company, the fallback is pre-designed: the static dot at full opacity (the reduced-motion form) for all users. **Recommendation: ship the breath; it is the only element that distinguishes "in flight" from "forgotten" for a sighted visitor at second 20** — but the fallback costs nothing to take at the gate, and this seat will not defend the breath against a gate finding.

## 19. Verification checklist (this seat's, run before handoff)

- [x] Structure unchanged from Nadia's spec — placement, states, transitions, announcements, focus floors identical; only the visual layer is this document's, plus the registered differences (§16, four entries, each dispositioned)
- [x] Reconciled couldn't-check model designed as commissioned (§8), with the contrary model costed (§8.5) and the conflict registered, not silently resolved (DR-1)
- [x] Every spacing, radius, color, shadow, and type value traces to a named shipped token (§2); the only new names are §17's component tokens, flagged, composed of existing values
- [x] All component states drawn: control rest / hover / focus-visible / active (§4), with never-states ruled out (§4.5); checking (§6), fresh (§7.1), stale (§7.2), couldn't-check (§8); emphasis + confirming + reduced-motion variant (§9); skeletons (§10); forced colors (§12)
- [x] PB-CSN-1 solved visually with its cost named in numbers: 44px box, ≈23px line growth, per-card absorption, wrapped heights (§3.2, §3.4)
- [x] Checking visual survives Priya's full envelope (2–25s) without progress claims, spinners, or escalation (§6.3)
- [x] Hierarchy: the control never competes with the availability word (weight/color budget, §14.2) or the pill (no box dress, §4.1); squint and grayscale readings argued from values — the line's order survives on size/weight/position with color removed (dot shapes and underlines persist in grayscale)
- [x] Contrast computed for every new or newly composed pair, unrounded in computation, floors stated (§13 — 20 pairs, all pass; thinnest flagged)
- [x] Thea's section delivered as §14 with full settings stacks and the target's compromises flagged by name (§14.6)
- [x] In-place visual standard held: instant state swap, stable frame (slot box held across control → status, §6.2), no layout shift from the emphasis (compensated inset, §9.2), control keeps its size and place in every state it has
- [ ] **Deliberately not checked:** rendered verification at real viewports. This is a design document; no build exists to measure. Quinn's CSN gate (SPEC §12 — CSN-1…CSN-17, with CSN-2's DOM-measured target and wrap drives and CSN-10 as re-pointed per DR-1) owns the rendered proof, and Ada's floor pass on the assembled design follows this document per the commission's sequence. Every rendered claim above is a specification to be verified there, not a verification reported here.

---

*— Mina, UI Design. Collaborators' positions applied: Nadia (the whole behavior contract — this design dresses her SPEC and re-decides none of it; four registered differences at §16, of which DR-1 is the coordinator's reconciliation, not this seat's deviation), Priya (timing envelope and attempt-keyed window, §§6, 8), Thea (type — §14, including her tabular-figures rule, her doubled-emphasis and tracked-lowercase rejections, and her wrap-at-phrase-boundary rule at §3.4), Iris (register check — §2.3; no palette question arose), Ada (floors as computed pairs — §13; her pass follows and rules on K-20 and DR-2), Wren (slots enumerated with visual obligations — §15; no copy finalized here), Elena (no artwork requested or touched — the slot is interface text on existing cards, and no art question arises). Evidence: `stock-check-design/SPEC.md` and `ENGINEERING.md` read in full; Tranche 2 `tokens.json`; shipped code from the worktree (`ListingRow.tsx`, `globals.css`, `Skeleton.tsx`); `shop-design/UI-DESIGN.md`, `UI-GRID-CARD.md`, `TYPE-GRID-CARD.md`. No code was written or changed by this design, and the file is left uncommitted for the coordinator.*
