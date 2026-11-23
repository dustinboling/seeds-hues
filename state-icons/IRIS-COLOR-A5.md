# State Outline Icons — Color Ruling, Extension to A5

**Seat:** Iris, Color Theory (feeling only) · **Commission:** extension of the SI color ruling (`IRIS-COLOR.md`, A1–A4) to the new surface A5 · **Date:** 2026-11-22
**Inputs read:** my `IRIS-COLOR.md` (the A1–A4 ruling); Nadia's `SPEC-LISTING-CARD.md` (main `2cec22d`, §5.2 flagging this extension to this seat); the shipped `ListingRow.tsx` on `origin/main` (the A5 host and its card grounds).
**Scope note:** This ruling covers only A5 and only what color *means and feels like* there. A1–A4 are not reopened. The WCAG 2.2 AA floor and the decorative classification for A5 are Ada's seat (her extension is flagged separately in Nadia §7); the contrast figures quoted below are the values already recorded in the A1–A4 record, given for context — they are not my floor verdict. Box size, token, and gap on A5 are Mina's placement pass, not ruled here; this ruling is independent of which size lands, because `currentColor` paint is identical under any box.

---

## Ruling in one paragraph

**The A1–A4 ruling extends to A5 unchanged: `currentColor` inheritance, outline only, no fill — on A5 the inherited color is the subline's own `--color-muted` #6A5F4C, the same pairing as A3.** No new token, no per-surface exception, no per-state color. The pairing is identical to A3's host, and everything that differs about this surface (§2) argues the same way A3 argued, or more strongly.

| ID | Surface | Ruling |
|---|---|---|
| A5 | Variety-page listing card — structured state segment in the subline | `currentColor` → **muted** `--color-muted` #6A5F4C (the subline's own color, `text-base text-muted`) |
| — | Fill, A5 | **None.** Outline only, as on all of A1–A4 |

---

## 1. Why the extension holds — the job is the same, and the pairing is the same

The job analysis that decided A1–A4 decides A5 without modification. The state name is printed beside the outline as real text (Nadia §1, §5.3), so the icon is again **identification as a redundant channel**: its color carries no information and should claim no independent meaning. Inheritance makes "[shape] {state name}" read as one text unit — same color, same rank, same fate — which is what a confirming channel should feel like.

The host pairing is literally A3's. A3's segment sits in a `--color-muted` line; A5's subline is `text-base text-muted` — the same token, muted #6A5F4C (CIELAB, D65, from the A1–A4 record: L* 40.8, C* 12.5, hue angle 85°, a warm taupe at Munsell value ≈ 4.1). The recorded pairs carry over with it: muted on surface #FFFDF4 at 6.14:1 and on paper #F8F1E1 at 5.6:1 (Ada's computed table and my §5 respectively; the floor verdict on A5 is hers to extend). No new color decision exists to make, because the host has already made it — that was the point of the family ruling, and A5 is its first proof: a fifth surface arrived, and inheritance absorbed it with zero new paint.

## 2. What differs on this surface — considered, and none of it changes the paint

- **The host line is one step larger (`text-base`, against A3's `text-sm`).** A larger host gives the muted line slightly more presence, but presence is not rank: the card's hierarchy is unchanged — seller name first (Fraunces 600, 20 px, ink), subline as ledger metadata beneath it. Muted at `text-base` is still the ledger voice. Nothing about the step up justifies promoting the mark to ink (the heading's color — it would pull the subline up into competition with the seller names it sits under) or to leaf (see next point).
- **This segment is not interactive, and its color must not pretend otherwise.** On A2 the leaf turn means *selected*; on A4 the link green #1F5C3D means *this goes somewhere*. A5's segment is plain text in a paragraph — not a chip, not a link (Nadia §5.3: the card's state door is the seller page's A4 link, reached via the heading). Painting it leaf or link green would borrow either of those meanings for a mark that has neither state to announce. Muted is not merely the quiet choice here; it is the honest one.
- **This is a comparison surface, and uniform muted is what makes the shapes comparable.** A variety page stacks these Quiet Ledger cards as alternatives for one variety, and the shopper's live question is comparative — which of these sellers is in my state. When every outline in the stack wears the identical muted, the only thing that varies from card to card is the *shape*, so shape differences do the comparison work at a glance. Any stronger or varying paint would spend the eye's attention on color that encodes nothing. The repetition argument from A3 also applies with more force: a stack of cards repeats the mark more densely than any A1–A4 surface, and a deep-green C* 20.3 hairline repeated down the stack would sum — contrast of extension — into a brand shout running through the one list that was designed as a quiet ledger. *Feeling claim, graded:* built to read as a calm, scannable ledger in which state is confirmed, not announced — an association-level read (muted, low-chroma neutrals read as documentary/metadata across interface convention), claimed as a read, not a mood guarantee.
- **The card has two grounds, and inheritance is the only treatment indifferent to both.** In-stock cards sit on surface #FFFDF4; sold-out cards step down to paper #F8F1E1 (the shipped sold-out treatment). The subline's host stays `text-muted` on both, so an inherited outline is the identical mark on either ground. A fill would not be: the retired 8% tint already rendered as a different color on every ground it touched (my §3 on A1–A4), and on A5 it would render one tint for an in-stock listing and another for a sold-out one — coupling the state mark's appearance to availability, a fact it has nothing to do with. No fill on A5 is therefore not just consistency with the set; on this two-ground card it is the only treatment that keeps the state's appearance independent of stock status.

## 3. Conditions for Quinn's delta design gate (color-side only)

1. **Paint check, computed not eyeballed:** the rendered A5 outline's stroke computes to `--color-muted` #6A5F4C via `currentColor`, with `fill: none`, on **both** card grounds — an in-stock card (surface) and a sold-out card (paper). No fixed leaf, ink, link, sage, or gold paint; no fill; no per-state color.
2. **No double-muting in the sold-out state:** the sold-out treatment steps the card's ground and softens its shadow; it must not additionally dim, fade, or set opacity on the outline or its segment. The mark inherits the host's treatment exactly — nothing more is applied to it.
3. **No borrowed interactive color:** the outline's color does not change under any card state — heading-link hover or focus, card hover, or any other state the card acquires. A5's host has no color states, so the mark has none; a mark that turned leaf or link green on hover would claim an affordance the segment does not have.
4. **Judge it in the stack, not alone:** the gate views a full variety page of listing cards (Albers' rule — never judge a color in isolation). Pass condition in feeling terms: the seller names remain the loudest element on every card, the sublines read as one quiet muted rhythm down the list, and the only chroma in the cards is the chroma that was already there before A5 (status tones, badge, pill) — the state outlines add none.

*Not conditions of this seat, noted so they are not mistaken for omissions:* forced-colors behavior and the decorative classification extend to A5, if at all, by Ada's ruling — inheritance is the mechanism her A1–A4 forced-colors confirmation relied on, and A5 uses the same mechanism, but the floor and the classification are hers to say. Mina's box/gap pass may proceed on the candidate inline token without waiting on color: paint is a paint-only question and it is settled here.

## Verification (this seat's checklist, applied)

- [x] Recommendation states exact values (hex + token; CIELAB carried from the measured A1–A4 record, D65)
- [x] Judged in place on A5's real grounds (surface and paper, incl. the sold-out ground swap in the shipped component) — not as an isolated swatch
- [x] No meaning rides on hue alone: shape + printed state name carry identification; color is a redundant channel, as on A1–A4
- [x] Feeling claim phrased as a read and graded (§2); value/chroma reasoning precedes hue (muted's value/chroma *are* A3's — the pairing, not a new hue choice, is the ruling)
- [x] WCAG floor: deferred to Ada's extension ruling, with the recorded pairs supplied (§1) — not rounded, not pre-judged
- [x] House standards applied (Print Edition chroma discipline: chroma stays reserved for the accent moments that already exist; A5 adds none); no house/field conflict on color

*Prepared by Iris, Color Theory — 2026-11-22. Returns to Hue. Extends `IRIS-COLOR.md` to A5 only; A1–A4 stand as ruled.*
