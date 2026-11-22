# Seller-as-Shop — Typography Ruling: The Latin Line on the Unified Variety Card

**Seat:** Thea, Typography (author). Ruling on the slot Nadia's delta spec reserves at `shop-design/SPEC-GRID-CARD.md` §7.3, against §4.2 (the swap) and §6.2 (data form) of that spec, read in full before ruling.
**Date:** 2026-11-22 · **Status:** Typography ruling only. No code, no build. Values below are stated so Mina's UI pass (§7.1 of the delta spec) and the build can lift them verbatim.
**Scope:** the Latin line only — the stored `plant.latinName` string rendered in the removed motif's slot, directly beneath the art frame, as the first line of the text zone, above the variety name, identically in browse and shop contexts. Everything else about the card is other seats' work; where this ruling's consequences land on Mina's zone geometry, they are stated as consequences, not decided for her.

---

## 0. Rulings at a glance

| # | Question | Ruling |
|---|---|---|
| T-1 | Italic | **Yes** — `<i>`, Newsreader true italic, weight 400. The card follows the site precedent. |
| T-2 | Size / leading | **14px, 20px leading** — Tailwind `text-sm` exactly as shipped (ratio 1.43). No new type step. |
| T-3 | Color | **`text-muted`** (`#6A5F4C`) on the card ground (`surface`, `#FFFDF6`) — **6.2:1**, past the 4.5:1 AA floor for 14px text. |
| T-4 | Case | **Normal case, always.** The stored sentence-case string renders verbatim; no uppercase, no small caps, no letterspacing. Implementation carries `normal-case tracking-normal` as an explicit guard. |
| T-5 | Wrap | **Natural wrap, centered, up to 3 lines. No clamp, no ellipsis, no truncation, no size reduction.** The string is never rewritten to fit. |
| T-6 | Zone growth (consequence for Mina) | The Latin allocation inside the fixed browse zone is **3 lines (60px)**, not one. Worst-case browse stack = **155.5px → grown zone 9.75rem (156px)**, +56px over today's 6.25rem. Derivation in §6. |
| T-7 | Rhythm, present vs absent | One centered stack, one gap (`gap-0.5`, 2px) between every pair of lines, Latin included. When Latin is absent nothing re-spaces: the remaining lines center in the same grown zone, per §6.3 of the delta spec. |

---

## 1. Evidence — what was measured, not remembered

**The card's current type system** (from `origin/main`, `v2/components/variety/VarietyCard.tsx`): variety name — Fraunces (`font-display`), `text-lg` 18px, semibold, `leading-snug` (1.375 → 24.75px line), `text-ink`, clamped at 2 lines; crop line — `text-sm` (14px / 20px), `text-muted`; availability line — `text-sm`, `text-muted`. Text zone: fixed `h-[6.25rem]` (100px), `flex-col items-center justify-center gap-0.5`. Card ground is `surface` (`.card` in `globals.css`). The card's secondary register is therefore already 14px/20px muted — the Latin line joins an existing step; it does not need a new one.

**The site precedent for Latin names** (from `origin/main`, three renderings, all agreeing on italic + normal case):

- Variety page eyebrow (`v2/app/variety/[slug]/variety-view.tsx`): `<i className="normal-case tracking-normal">{latinName}</i>` inside `.eyebrow`; `globals.css` sets `.eyebrow i` to Newsreader (`font-serif`), 0.875rem (14px), weight 400, muted via the eyebrow's color.
- Crop page header (`v2/app/crop/[slug]/page.tsx`): `<p className="mt-1 text-lg"><i>{latinName}</i></p>` — Newsreader italic by inheritance.
- Crop index card (`v2/app/crop/page.tsx`): `<p className="text-sm text-muted"><i>{latinName}</i></p>` — 14px, muted, italic. This is the closest relative of the variety card (a card, a Latin line under a name-and-image composition) and it is the precedent this ruling weights most.
- One divergence, recorded: the variety page's facts table renders the Latin value in `<i>` at body **ink**. That is a data list in which every value is ink; it governs tables, not cards. On the card, ink would promote a secondary line into competition with the variety name (ink, Fraunces semibold) directly beneath it. Muted is the card-system choice (§4).

**The strings themselves** (live public API crawl, 2026-11-22, `catalog_seq 4618`, matching the delta spec's §6.2): 50 distinct strings. The 8 multi-species strings are 32–49 characters; the longest single binomials are 23 characters ("Rhodanthe chlorocephala", "Platycodon grandiflorus", "Heliopsis helianthoides"). One hybrid formula: "Dahlia × hybrida". Stored strings mix two hybrid notations — "Dahlia **×** hybrida" (multiplication sign) and "Aquilegia **x** hybrida" / "D. **x** belladonna" (letter x). Both are data; neither is normalized by type (T-4).

**String widths, measured in the served font.** Widths below were computed from the actual Newsreader italic file Google Fonts serves this site (advance widths, weight 400), at 14px, against the card's real text measures:

| Viewport | Grid | Card text measure* |
|---|---|---|
| 390px (design width) | 2 cols | **143px** |
| 360px | 2 cols | **128px** |
| 320px (WCAG reflow width) | 2 cols | **108px** |

\* Container `padding-inline: 16px`, grid `gap-2` (8px), card `p-4` (16px each side). E.g. 390px: (390 − 32 − 8) / 2 − 32 = 143px.

Greedy word-wrap simulation at those measures, 14px Newsreader italic:

| String class | @390 (143px) | @360 (128px) | @320 (108px) |
|---|---|---|---|
| 42 single binomials (11–23 chars, ≤141.2px wide) | 1 line | 1–2 lines | ≤2 lines |
| 7 multi-species strings (32–41 chars) | 2 lines | 2 lines | 2–3 lines |
| "Asclepias tuberosa / A. incarnata / A. physocarpa" (49 chars, 277.5px) | **3 lines** | **3 lines** | **3 lines** |

Two measurements decide the wrap ruling, so they are stated exactly:

1. The Asclepias string's best two-line break at 390px is "Asclepias tuberosa / A." (127px) + "incarnata / A. physocarpa" (**147px**) — it misses the 143px measure by **4px**. No break point makes it two lines at phone width at 14px.
2. At the 320px reflow width, **seven of the eight** multi-species strings need three lines at 14px. Any allocation or clamp below three lines therefore fails either the design width (Asclepias) or the reflow width (the other seven) — and a clamp does not merely fail, it *rewrites*: a clamped third line is a species silently dropped, which §6.2 forbids.

No single word in any of the 50 strings exceeds 108px at 14px (longest: "physocarpa", 63.7px), so natural wrap never overflows the measure and never needs hyphenation or `overflow-wrap` breaking inside a word.

---

## 2. T-1 — Italic: yes, the card follows the precedent

**Ruling: the Latin line is set in italic, in a `<i>` element, Newsreader, weight 400 — identical treatment in browse and shop contexts.**

Reasoning:

- **Botanical convention is the content's own grammar.** Binomials are italicized in every botanical, horticultural, and seed-trade context the directory's readers know; the italic *is* the signal "this is the scientific name," which is why the line needs no "Latin:" label (Wren's §7.4 slot already closes the label question; typography concurs — a label would be a second signal spent on what the first already says).
- **Site precedent is unanimous** (§1): eyebrow, crop header, crop card, facts table — every existing rendering of `plant.latinName` is italic. A roman Latin line on the card would be the site's only exception, and an exception in the *most-seen* rendering (every grid) would read as an inconsistency, not a choice.
- **True italic, never faux.** Newsreader ships a drawn italic (the served file measured in §1 is that italic); Tailwind's `italic` / the `<i>` element's default `font-style: italic` selects the family's real italic face from the variable font. No slant transform, no synthesized oblique is permitted — the playbook's faux-italic rejection applies verbatim.
- **One emphasis signal only.** Italic, and nothing else: not bold, not italic-plus-color-change beyond the muted step the whole secondary register uses. Butterick's budget — bold *or* italic, never both — is satisfied.

## 3. T-2 — Size and leading: 14px / 20px, the shipped `text-sm` step

**Ruling: `text-sm` with no line-height override — 14px, 20px leading (ratio 1.43). Weight 400. Letter-spacing 0.**

Reasoning:

- **It is the Latin size everywhere else.** The eyebrow's `<i>` is 14px (`.eyebrow i`, 0.875rem); the crop index card's Latin line is `text-sm`. One size for one kind of content across the site is what makes the line learnable: a gardener who has read a crop card already knows what the variety card's first line is before reading it.
- **It is the card's own secondary step.** Crop line and availability line are both 14px/20px. The Latin line at the same size keeps the zone a two-step system (18px name / 14px everything else) — three hierarchy levels total on the card, inside the playbook's three-to-four limit, each step decisive (18 vs 14 is a 1.29 ratio, a clear step, not a tentative one).
- **Leading 1.43 sits inside the body range** (120–145%) and, more importantly for a line that can run to three lines, it keeps a wrapped multi-species string reading as *one* entry: tighter display leading would still hold, but 20px is the line box the zone's other lines already use, so the whole stack shares one line rhythm (§6). No extra space above or below a wrapped Latin block — it is one block in the stack, not a paragraph.
- **Rejected: a smaller "long-string" size (13px).** Measured, not guessed: at 13px the Asclepias string does fit two lines at 390px (its second line becomes 136.6px) — and still needs three lines at 360px and 320px. The reduction buys nothing at the widths that bind, invents an off-system step below every other Latin rendering on the site, and makes identical content render at two sizes depending on its length — a per-card size lottery in a grid whose Latin row is meant to scan uniformly (delta spec §4.2). Rejected on all three counts.
- **Rejected: 12px or any size under the site's steps.** 14px is already the card's floor step; below it, Newsreader italic's fine strokes at phone sizes tax legibility for zero structural gain (the 3-line need at 320px persists to ~10px, under every platform minimum).

## 4. T-3 — Color: `text-muted` on surface, 6.2:1

**Ruling: `color.muted` (`#6A5F4C`), the same token as the crop and availability lines, on the card's `surface` ground (`#FFFDF6`).**

- **Contrast, measured:** the token record in `globals.css` gives muted at **6.2:1 on surface** (5.6:1 on paper). 14px regular text is ordinary text under WCAG 1.4.3 and needs 4.5:1; 6.2:1 clears it with margin. (Ada's pass recomputes; the values are stated here so she verifies rather than discovers.)
- **Hierarchy:** the zone's order must read name → Latin → crop → availability in *attention*, but the Latin line sits physically *above* the name. Muted italic above an ink semibold display name gets this right: the eye lands on the name (largest, darkest, display face), and the Latin line reads as its annotation — the seed-rack botanical label, present for the gardener scanning by species, quiet for everyone else. Ink or `ink-soft` (8.6:1 / higher on surface) would promote the annotation over the crop line and toward the name; `leaf` would spend the page's accent on a data line and falsely signal a link inside a whole-card link. Muted is also the color of both precedents that matter (crop card, eyebrow).
- **Distinction from the crop line** (same size, same color, two lines below) is carried by italic vs roman, by the name standing between them, and by position — three signals, none of them color. Color is never the sole carrier of anything here (WCAG 1.4.1 satisfied trivially: the Latin line is supplementary text; nothing depends on distinguishing it by hue).

## 5. T-4 — Case: normal case, verbatim, guarded

**Ruling: the card renders the stored string in normal case, character for character. No `uppercase`, no `text-transform` of any kind, no small caps, no letterspacing — and the implementation carries the explicit guard classes `normal-case tracking-normal`, copied from the variety-page eyebrow.**

- **Why a guard is needed at all:** the eyebrow precedent exists because `.eyebrow` forces `text-transform: uppercase`, and an uppercased binomial is a botanical error — "ZINNIA ELEGANS" destroys the genus/species case distinction that carries information (capital genus, lowercase epithet) and reads as shouting in a serif italic. The variety card does not sit inside an uppercase context today, but the Latin line's slot is *the slot the eyebrow pattern would naturally be reused for* (it is, functionally, the card's eyebrow). The guard classes cost nothing and make the rule survive a future refactor that wraps the line in an eyebrow-styled element. This is the variety page's own solution (`normal-case tracking-normal`, `variety-view.tsx`), adopted verbatim.
- **Verbatim includes the hybrid notations.** "Dahlia × hybrida" keeps its multiplication sign (the glyph is present in Newsreader's italic — verified in the served font during measurement) and "Aquilegia x hybrida" keeps its letter x. Normalizing one to the other is a data edit wearing a type costume; the card does not make it. If the catalog seat ever unifies the notation, every surface changes together by that decision, not by a card quietly tidying its own string.
- **No derived casing either:** the card never title-cases, never capitalizes a lowercase epithet, never lowercases a genus. Sentence case as stored is the botanical form; the string arrives correct and leaves correct.

## 6. T-5 + T-6 — Wrap: natural wrap to 3 lines; the zone grows by 3 Latin lines

**Ruling: the Latin line wraps naturally — centered, ragged at both edges as centered wrap is, breaks at spaces (and after a " / " separator where the engine offers that break), hyphenation off, no break inside a word. It is allocated up to 3 lines. There is no clamp, no ellipsis, and no truncation at any width.**

**The zone consequence, stated for Mina (browse context):** the fixed zone must hold the system's worst stack, and both maxima in that stack are bounds, not speculation — the name is clamped at 2 lines *by design* (existing `line-clamp-2`), and the Latin line's maximum is 3 lines *by measurement* (§1). The stack:

| Line | Lines × line box | Height |
|---|---|---|
| Latin (14px / 20px) | 3 × 20px | 60px |
| Variety name (18px / 24.75px, `leading-snug`) | 2 × 24.75px | 49.5px |
| Crop (14px / 20px) | 1 × 20px | 20px |
| Availability (14px / 20px) | 1 × 20px | 20px |
| Gaps (`gap-0.5` × 3) | | 6px |
| **Total** | | **155.5px → 9.75rem (156px)** |

So the grown browse zone is **9.75rem**, not the "browse zone + one Latin line" (7.5rem) the delta spec's §7.1 working assumption sketches: +56px over today's 6.25rem, of which 60px is the Latin allocation and the name/crop/availability stack is unchanged. A one-line allocation (7.5rem) overflows on 8 crops' cards at the design width; a two-line allocation (8.5rem, 136px) overflows on the Asclepias cards at every phone width and on seven more crops' cards at 320px. Three lines is the smallest allocation that never rewrites a string. That is the whole argument, and it is a measurement, not a taste.

**Shop context:** the same type ruling, the same 3-line maximum, but the height lands differently and Mina should note the difference: in shop anatomy (delta spec §3.3) the Latin line is in flow above the fact block and the footer is pinned to the card bottom, so a Latin block of 20/40/60px pushes the fact block down and the pinned footer absorbs the variance — row alignment survives without a fixed Latin allocation. The 156px figure binds the **browse** zone, where the centered fixed-height zone is the alignment mechanism. No shop-zone number is ruled here beyond: never clamp the Latin line to protect the fact block; the footer pin is the mechanism, use it.

**If the 156px zone is rejected, the choice comes back — named options, per §6.2's discipline.** This ruling does not silently pick a cheaper fit. The alternatives are:

- **(a) Accept 156px (this ruling).** Cost: every browse card's zone carries up to ~62px of air on the commonest cards (1-line Latin, 1-line name). Benefit: no string is ever rewritten, at any width, for any current or near-future string up to ~430px of Latin (3 lines × 143px) — headroom included.
- **(b) Variable zone heights** (zone sizes to each card's actual stack). Cost: breaks the fixed zone, which is the grid's row-alignment mechanism and delta spec §4.2's normative ruling — names and art stop aligning across rows. This is Nadia's call to reopen, not a type decision.
- **(c) Change the data** (split multi-species strings in the catalog, e.g. store a primary species for card display). Cost: the card would show a *selection* of the record, not the record — a cataloging decision with provenance implications, for the catalog seat and Dustin. Typography flags it as the only other honest route and takes no position on it.

What is **not** an option, at any zone height: `line-clamp` with ellipsis, truncation, dropping a species, shrinking the string's font size to fit, or condensing/scaling the letterforms. Each rewrites or distorts the datum. (For the record: shrink-to-fit also fails the playbook outright — artificially condensed type is a named anti-pattern, and a size that varies by string length is not a type system.)

**One further flag, for Ada and Mina jointly:** WCAG 1.4.12 lets a reader impose line-height 1.5×, under which the worst stack computes to ~180px — more than any fixed zone sized at 1.43 leading. A fixed-height zone with centered content can clip under that override. The zone is Nadia's and Mina's mechanism, so the mitigation is theirs (the natural one is the zone behaving as a floor, not a ceiling, under spacing overrides) — but the Latin line's 3-line allocation makes this ruling a party to the risk, so it is stated here rather than left for the gate to find.

## 7. T-7 — Rhythm: one stack, one gap, centered — present or absent

**Ruling: the Latin line joins the zone's existing stack unchanged in rhythm — `gap-0.5` (2px) between the Latin line and the variety name, the same 2px as every other inter-line gap in the zone; the stack remains `justify-center`; no space is added above the Latin line inside the zone, and none is reserved or removed when it is absent.**

- **Why one gap, not a larger Latin-to-name gap:** the variety page separates its eyebrow from the H1 by 4px (`mt-1`) because those are two *blocks* (a label and a heading). The card's zone is one block — a single centered stack whose lines are bound by the tight 2px rhythm the shipped card already uses (name-to-crop is 2px, and nobody reads those as detached). A 4px+ gap after the Latin line would group Latin *away* from the name it annotates and toward the art frame it does not belong to. Proximity is the grouping signal; the Latin line belongs to the name.
- **Present, 1 line (the common case — 42 of 50 strings at 390px):** the stack is Latin 20 + name + crop + availability, centered; the unused Latin allocation (40px of the 60px) becomes air split evenly above and below the whole stack by the centering — not air inside the stack. Line-to-line rhythm is identical on every card; only the block's position within the zone breathes.
- **Present, 2–3 lines:** the wrapped lines sit at the same 20px line box, no added leading, no paragraph space — a 3-line Asclepias block is one entry read over three lines, and its internal rhythm must not loosen, or it starts reading as three entries.
- **Absent (269 of 812 varieties at launch):** per delta spec §6.3 the line does not render and nothing is reserved for it *as a line* — but note precisely what the fixed zone does: the remaining three-part stack (name/crop/availability, ~94px at its tallest) centers in the 156px zone, carrying ~31px of air above and below. That air is the fixed zone's uniformity cost, already accepted by §6.3's centering rule; this ruling confirms type asks for no compensating device — no placeholder, no tightened zone, no re-spacing of the remaining gaps. The 2px gaps between name, crop, and availability are exactly the gaps a Latin-present card has. A Latin-less card is the same card showing less, at the same rhythm.
- **Alignment honesty, stated once:** because the stack is centered (the shipped behavior, and §6.3's rule for absence), the Latin line's top edge is *not* at a fixed height across a row — it rides on how many lines the name below it takes. Type cannot fix that without reopening the centering rule, and does not pretend otherwise: the "consistent Latin row" the delta spec hopes for (§4.2) holds exactly when neighboring names take the same line count, and approximately otherwise. If Dustin's phone test says the Latin row must lock, that is option (b) territory — a zone-structure change for Nadia — not a type treatment.

## 8. Implementation values (for the build brief, verbatim)

```jsx
{/* Latin line — first line of the text zone, both contexts, only when plant.latinName is non-null */}
<span className="text-sm text-muted">
  <i className="normal-case tracking-normal">{v.plant.latinName}</i>
</span>
```

- Element: `<i>` (italic is presentational-botanical here; `<i>` is the element every existing site rendering uses — consistency of markup with the eyebrow and crop card is deliberate).
- Classes resolve to: Newsreader italic 400, 14px, 20px line-height, `color.muted`, letter-spacing 0, no text transform. No `font-display`, no sans — the tool layer never sets botanical content.
- No `line-clamp-*`, no `truncate`, no `whitespace-nowrap`, no inline `font-size` adjustment, in either context, at any breakpoint. The class list is identical at 320px and 1280px; only the wrap outcome changes.
- Centered by inheritance from the zone (`text-center` on the card); no alignment class on the line itself.
- Skeleton parity (delta spec §4.4): the Latin bar in `VarietyCardSkeleton` should stand for a 20px line box at this size — final bar geometry is Mina's; the type fact she needs is that one Latin line = 20px, three = 60px.

## 9. Verification this ruling asks Quinn to run (type-specific, beyond SH-G5/SH-G6)

1. Render the Asclepias card at 390px and at 320px: the full string "Asclepias tuberosa / A. incarnata / A. physocarpa" is visible, whole, on 3 lines, no ellipsis, no clipped descenders (line box 20px at 14px clears Newsreader's descenders — check the "p" of "physocarpa" on the last line against the zone edge).
2. Render every multi-species crop's card at 320px: all species present on every card (the 3-line allocation is the mechanism; a 2-line render anywhere is a FAIL, not a variant).
3. Computed style of the Latin line on browse and shop cards: `font-style: italic`, `font-size: 14px`, `line-height: 20px`, `text-transform: none`, `letter-spacing: 0`, color `#6A5F4C` — identical in both contexts.
4. "Dahlia × hybrida" renders with the multiplication sign; "Aquilegia x hybrida / A. vulgaris" renders with the letter x. Neither string's characters differ from the payload's (SH-G12 already byte-compares; this names the two strings where a well-meaning normalization would show).
5. A Latin-less card beside a Latin-present card in the same row: equal card heights, name/crop/availability gaps measured at 2px on both, no Latin placeholder or empty element in the DOM.

---

*— Thea, Typography. Evidence: playbook `~/workspace/custom-skills/specialist_typography/SKILL.md`; delta spec `shop-design/SPEC-GRID-CARD.md` §§4.2, 6.2, 6.3, 7.1, 7.3 from `origin/main`; card and precedent code from `origin/main` (`v2/components/variety/VarietyCard.tsx`, `v2/app/variety/[slug]/variety-view.tsx`, `v2/app/crop/[slug]/page.tsx`, `v2/app/crop/page.tsx`, `v2/app/globals.css` — `@theme` tokens, `.eyebrow i`, `.card`); UI design token record `shop-design/UI-DESIGN.md` §2 (muted/surface values); live API crawl 2026-11-22 (`catalog_seq 4618`, all 812 varieties, 50 distinct Latin strings); string widths measured from the served Newsreader italic font file (advance-width computation, weight 400) against card text measures derived from the shipped container/grid/card padding values. No code was written or changed by this ruling.*
