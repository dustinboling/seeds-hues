# Placement addendum A5 — state outline on the variety-page listing card (Mina, UI Design)

**Status.** Addendum to `PLACEMENT-SPEC.md`. It does **not** edit that
spec; it supplies the A5 placement values that Nadia's structure spec
(`SPEC-LISTING-CARD.md`, main `2cec22d`, §7.1) reserved for this seat,
and the fold-in text (§5 below) by which A5 enters the gated spec's
§1.1 inventory, §2 placement table, and §7 rendered-difference register
when the fold-in is performed. The gated spec stands unmodified until
then.

**Commission.** Dustin, 2026-11-22 16:41 PT — "Yes — state outlines on
variety-page listing cards too" — as structured by Nadia
(`SPEC-LISTING-CARD.md`): the variety-context subline of
`v2/components/variety/ListingRow.tsx` gains a second segment,
"· [outline] {State name}", keyed off `seller.region` via
`stateByCode()` under the A3 guard (country US + resolvable code),
rendered only when the state resolves; segment 1 (the seller's
free-text location) stays verbatim; absence renders nothing, with no
reserved box. Structure is Nadia's and is not reopened here. This
addendum decides only size/token, gaps, separation, inline composition,
and responsive behavior.

**Inputs read.** Nadia's `SPEC-LISTING-CARD.md` (§§1–7, esp. §5.2 and
§7.1); `PLACEMENT-SPEC.md` (the register this addendum folds into);
`ADA-RULINGS-SI.md` (Ruling 3: the 20 px inline floor, binding);
`IRIS-COLOR.md` and Iris's A5 extension `IRIS-COLOR-A5.md` (main
`459f443`: `currentColor` → `--color-muted`, no fill, extended to A5 —
cited in §5, not ruled here); Quinn's design gate `QA-GATE-design.md`
(the D-series register form; §5 amendments A1–A6); the shipped code on
`origin/main` — `ListingRow.tsx` (the host `<p>`), `SellerCard.tsx`
(the A3 segment this one mirrors), `StateShape.tsx` (component
contract) — and the type tokens as shipped: Tailwind 4.3.5
`theme.css` (`--text-base`, `--text-base--line-height`) checked against
`v2/app/globals.css`, whose `@theme` defines no `--text-*` override.

---

## 1. The A5 values — what the build carries

| Item | **A5 value** |
|---|---|
| Box | **`--size-state-icon-inline` at its amended value: 20 px** square (`size={20}` fed from the token, as on A3 after Ada's amendment — never a literal at the call site). No new token, no A5-specific size |
| Icon-to-name gap | **4 px** (`gap-1`; token `component.state-icon.gap-inline`, A3's gap) |
| Separator-to-icon gap | **4 px** (the same `gap-1` — the separator is a child of the segment, exactly as on A3, so one gap value spaces dot → icon → name) |
| Inter-segment separation (C1 only) | **One word space** — a single U+0020 text node between segment 1 and the state segment (§3). No margin, no padding, no flex gap (the host is not flex) |
| Segment composition | `<span className="inline-flex items-center gap-1" data-seller-state={code}>` inside the existing `<p>` — A3's segment span, transplanted (§3) |
| Alignment | Optical center: `items-center` centers the box on the name's line box inside the segment; the segment itself takes the `<p>`'s default baseline alignment, so the state name shares the subline's baseline with segment 1. Baseline alignment of the *glyph* is never used (the SI rule: an outline glyph has no baseline) |
| Color | Not ruled here. Per Iris's extension (`IRIS-COLOR-A5.md`): `currentColor` → `--color-muted` #6A5F4C, outline only, no fill — identical to A3's pairing |
| Stroke | Unchanged from the gated package: 1.25 px, non-scaling (`vector-effect="non-scaling-stroke"`), round caps per Quinn amendment A3 |

**Case composition** (Nadia §1.1's cases, with this addendum's
mechanism applied):

- **C1** (location + resolvable state): `{location}` + one space +
  segment span whose children are, in order: separator span
  (`<span aria-hidden="true">·</span>`), `StateShape`, state name text.
- **C2** (no location + resolvable state): the segment span alone, as
  the `<p>`'s first content — children `StateShape` + name only. **No
  separator, no leading space, no margin.** (Nadia §1.1: no leading
  separator; the raw-code fallback is replaced, not decorated.)
- **C3 / C4** (state does not resolve): no segment span in the DOM at
  all — the subline is byte-identical to today (Nadia §3, case A-1).
- **A-2** (state resolves, outline not yet drawn): the segment renders
  with `StateShape` returning `null` inside it. Because the segment's
  spacing is flex `gap`, which applies only between rendered children,
  the result is separator → 4 px → name, with **no phantom gap** where
  the 20 px box would have stood (Mina §5.2's fallback rule, applying
  to A5 exactly as registered in Nadia §3).

## 2. The measured box-to-line fit — why 20 px, ruled

The host line, measured from the shipped tokens (Tailwind 4.3.5
`theme.css`, the version in `v2/package.json`; `globals.css` adds no
override):

- `text-base` = **16 px** font size, line height
  `calc(1.5 / 1)` = **24 px**. The subline `<p>` carries no other
  line-height utility, and its margin (`mt-listing-subline`, 3 px) is
  above the line and unchanged.
- The candidate box, **20 px**, therefore occupies 20 ⁄ 24 = **83.3 %
  of the line box**, leaving **4 px of slack — 2 px above and 2 px
  below the box** when it is optically centered (§1). **The line
  cannot grow**: 20 < 24, the segment span's height is set by the
  name's 24 px line box (the taller child), and the card's vertical
  rhythm (heading → subline → status) is untouched. This is a
  token-derived measurement of the line the build will render; the
  build gate's rendered-rect measurement is still owed (§6, flag 1).

Against the alternatives:

- **18 px (the inline token's pre-amendment value) is not available.**
  Ada Ruling 3 sets a binding 20 px legibility floor for this set —
  at 18 px the flagged states' features close past the tested
  evidence — and rules the fix as one uniform box, not per-state
  exceptions. A5 takes the token at its amended value; a build that
  read the stale 18 px figure out of the un-folded §6 for A5 would
  breach the floor on this surface too.
- **22 px (the `--size-state-icon-detail` token) fits mechanically
  and is rejected.** It would leave only 2 px of slack (1 px per
  side) — spending A5's headroom for no legibility gain: Ada's
  evidence is that all 31 states pass *at* 20 px, and nothing in the
  record asks for more. Decisively, it would break cross-card parity:
  A5 and A3 render **the same seller's same state segment** on
  sibling cards a shopper compares across pages (Nadia §0, defect 3 —
  consistency is the reason this surface is being fixed at all), and
  the detail token's role is A4's standalone Location link, a
  different component in a different context. One segment, one box,
  everywhere it appears.
- **Fit comparison with A3, for the record:** on A3 the same 20 px
  box sits in the `text-sm` location line — the gated record
  (Ada Ruling 3, Quinn A1) carries that line at 21 px, i.e. 1 px of
  total headroom, the tightest figure in the build. On A5 the same
  box has 4 px. **A5 is the more comfortable host for the floor box,
  not the tighter one** — the one-step-larger host Nadia flagged is
  an argument for the shared token, not against it. (One honesty
  note on the comparison figure: the shipped `theme.css` computes
  `text-sm`'s line height as `calc(1.25 / 0.875)` = 20 px, not 21 px.
  A5's 24 px is computed from the same source and does not depend on
  A3's figure; whether the A3 record is reconciled is Quinn's
  delta-gate call — §6, flag 4.)

## 3. Inline composition inside the non-flex `<p>` — the mechanism

The host is a plain block `<p>`; Nadia §4 fixes its classes
(`mt-listing-subline text-base text-muted`) and forbids improvising
the segment's composition at build time. The mechanism is A3's,
adapted at exactly one point:

- **The segment is A3's span, unchanged in kind:**
  `inline-flex items-center gap-1`, carrying
  `data-seller-state={code}`, with the separator as an
  `aria-hidden` span child, then `StateShape`, then the name as a
  text node — the same child order and the same gap as
  `SellerCard.tsx` ships today. An `inline-flex` box is an **atomic
  inline box**: it participates in the paragraph's inline flow but
  can never split across lines internally, which is what guarantees
  the icon never separates from its name (§4).
- **The one adaptation is the inter-segment separation.** On A3 the
  host `<p>` is flex, and the 6 px between the location span and the
  state segment is the host's `gap-x-1.5`. A non-flex host has no
  gap to inherit, so in C1 the separation is **one word space** — a
  single space text node before the segment span. This is a
  typographic value, not a spacing-token step, and it is the right
  kind of value here: the join is *inside a sentence-like text line*,
  segment 1's own internal joins are literal text spaces (the
  seller's verbatim string; A3's first span likewise builds
  `` ` · ${location}` `` from text), and the font-default word space
  (≈ 0.25 em ≈ 4 px at 16 px) is the separation the reading line
  already uses. Two properties are load-bearing and are why a margin
  was **not** specced instead: a leading space **collapses at a line
  break**, so a wrapped segment starts flush at the left edge (§4);
  and in C2 the space simply does not exist, so the segment-alone
  case needs no conditional margin logic.
- **No other classes are added to the `<p>`, and the `<p>` does not
  become flex.** Making the host flex to reuse A3's `gap-x` would
  change how segment 1 itself wraps and truncates — a host change
  Nadia §4 puts out of scope — to buy a 2 px difference in one
  separation. Not traded.
- `StateShape`'s own `shrink-0` (in the component's class list)
  stands: inside the segment's flex row the box can never be
  squeezed by a long name.

## 4. Responsive behavior — 320 px, and 200 %

**Geometry at 320 px viewport.** Content width for the subline:
320 − 32 (`.container-page` padding-inline, 1 rem each side) − 32
(card `px-4`, 16 px each side) = **256 px**. The state segment at its
widest — longest state names, "North Carolina" / "South Carolina" —
measures ≈ **135 px** calculated (separator ≈ 4 px + 4 gap + 20 box +
4 gap + name ≈ 103 px at 16 px Newsreader), comfortably inside
256 px: **the segment always fits whole on one line at 320 px**, with
≈ 121 px to spare. (Calculated from font metrics, not yet rendered —
the build gate measures the real rect, §6 flag 1.)

- **Wrap behavior.** The two segments wrap as ordinary inline text at
  exactly one joint: *between* the segments. When location + segment
  exceed 256 px, the segment moves whole to the next line — the
  intervening word space collapses at the break, so line 2 starts
  flush, with no indent and no leading dot-space artifact — and the
  icon and name stay together on that line because the segment is
  atomic (§3). Segment 1's own text wraps word-by-word exactly as it
  does today. The subline grows by one 24 px line in that case, which
  is the same growth a long location string causes on today's card;
  nothing is clipped (the card sets no fixed height and no overflow
  hidden on this line), and no neighbour moves except by that ordinary
  text growth.
- **When the segment is absent** (C3/C4), there is no wrapper, no
  space, and no reserved box in the DOM — the 320 px rendering is
  byte-identical to today's card (Nadia §3, A-1).

**At 200 %.** Two distinct cases, both safe:

- **Browser zoom at 200 %:** every CSS pixel scales uniformly, so
  the fit ratio is invariant — a 640 px-wide device at 200 % zoom
  presents the 320 CSS px layout above, with box, gaps, and line
  height all doubled together on screen. Nothing about the segment's
  behavior changes.
- **Text-only resize to 200 %** (WCAG 1.4.4 / the 1.4.12 spacing
  overrides): the font goes to 32 px and the line box to 48 px; the
  SVG box and the 4 px gaps are CSS-fixed and do not grow. The
  segment still cannot split (atomic inline box, `shrink-0` glyph),
  wraps whole at the same joint, and at the 320 CSS px reflow width
  its widest form — name ≈ 206 px + separator ≈ 8 px + 8 px of gaps
  + the 20 px box ≈ **242 px** — still fits the 256 px content
  width on one line. The icon reads relatively smaller against the
  enlarged name; that is acceptable on the record because the icon is
  decorative and the name carries the information (Ada Ruling 1's
  fact pattern, whose extension to A5 is hers to confirm — §6,
  flag 3). The subline's own line height is already 1.5, so the
  1.4.12 line-height override changes nothing on this line.

**iPad and desktop** need no separate rule: the card column only
widens, the segment's values are size-invariant, and a segment that
fits at 320 px fits everywhere above it.

## 5. The PLACEMENT-SPEC fold-in for A5 (verbatim, for when the fold-in is performed)

### 5.1 Supersession — N5 → A5 (§1)

In §1.1, add the row:

| ID | Surface | Component / file | State name render | Icon today |
|---|---|---|---|---|
| **A5** | Variety page — listing card subline (variety context) | `v2/components/variety/ListingRow.tsx` — the subline `<p>` (`mt-listing-subline`), `context === "variety"` branch only | **Structured render (Nadia, `SPEC-LISTING-CARD.md` §1):** state segment "· {name}" from `stateByCode(seller.region)` beside the kept free-text location segment | **None — ADD.** Placement: this addendum, §1 |

In §1.2, **delete the N5 row** and annotate §8 pushback 3 where it
cites N5: the pushback was correct when written and is superseded by
Dustin's 2026-11-22 16:41 PT ruling and Nadia's structure spec — the
icon is **not** bolted onto the free-text string; the subline now
renders the state as structured data, which is the condition the
pushback itself named. The §1 inventory counts become: **17 line
items — 5 icon placements (A1–A5) and 12 ruled no-icon
(N1–N4, N6–N13)**.

### 5.2 The §2 placement row

| ID | Position relative to the name | Box (token, §6) | Gap | Alignment | Color |
|---|---|---|---|---|---|
| **A5** Listing card state segment | **Before the name**, inside the state segment: "· [icon] {name}" — the "·" separator stands first, opening the segment, exactly as on A3. The segment follows the location segment within the subline, separated by one word space; when no location string exists the segment stands alone with no separator (Nadia §1.1, C2) | `--size-state-icon-inline`: **20 px** (Ada Ruling 3 value; measured fit on this host: 20 px box in a 24 px line box, 2 px slack per side — addendum §2) | **4 px** (`gap-1`, token `gap-inline`) between separator and icon and between icon and name — one gap value inside the segment, as on A3. Inter-segment separation is one word space (addendum §3), not a gap token | Optical center on the subline's line box: `items-center` inside the segment's `inline-flex` span; the span takes the paragraph's baseline so the state name shares segment 1's baseline | `currentColor` → `--color-muted` (the subline's color) — per Iris's extension, `IRIS-COLOR-A5.md`; no fill |

### 5.3 The rendered-difference register — D7 (§7.1)

| # | Surface | Change |
|---|---|---|
| D7 | A5 — variety-page listing cards (`ListingRow`, variety context only) | **The SI build's one registered difference on this card.** The subline gains a structured state segment after the kept free-text location segment: "· [icon] {state name}", keyed off `seller.region` via `stateByCode` (primary location only, Nadia §2). Where the location string is absent, the segment alone replaces the raw-code fallback ("OR, US"). Sellers with no structured state (3 of 83) render byte-identical to today. Seller-context cards and every other element of the variety-context card are byte-identical. Placement values (this addendum): box `--size-state-icon-inline` **20 px** in the subline's 24 px line box (no line growth); gap **4 px** (`gap-1`) inside the segment; inter-segment separation one word space; segment composed as an `inline-flex` span inside the unchanged non-flex `<p>`; paint `currentColor` → `--color-muted`, no fill (Iris, `IRIS-COLOR-A5.md`). |

## 6. Flags for Quinn's delta design gate

1. **Rendered proof of the fit is owed, not yet taken.** §2's fit is
   measured from the shipped type tokens; no built A5 card exists
   yet. The delta/build gate should measure the rendered subline:
   line box 24 px, SVG rect 20 × 20 px, card heights equal across
   segment / no-segment cards at 390 px, iPad, and desktop (Nadia §6
   carries the check).
2. **The atomicity and wrap claims are mechanism claims.** Segment
   never splits, wrapped segment starts flush (space collapse), and
   the widest segment fits one line at 320 px and at 200 % text —
   all follow from §3's mechanism and §4's calculated widths; each
   wants one rendered confirmation at the gate, at 320 px and 200 %,
   with a longest-name state (NC/SC) and a long location string.
3. **Ada's extension to A5 is still outstanding.** This addendum
   adopts her 20 px floor *as the shared token's value* — it does not
   and cannot extend her Ruling 1 (decorative classification),
   Ruling 3 (floor), Ruling 4 (fallback), or Ruling 5 (forced-colors
   conditions) to the fifth surface. Nadia §7.3 flags that extension
   to her; the delta gate should not close until it lands. (Iris's
   extension, by contrast, has landed: `IRIS-COLOR-A5.md`, main
   `459f443`.)
4. **A3's recorded line height (21 px) vs the shipped token (20 px).**
   Noted in §2: `theme.css` computes `text-sm`'s line at 20 px where
   the gated record carries 21 px. Nothing in A5 depends on it, and
   this addendum corrects nothing in the gated record — flagged so
   Quinn can reconcile it at the delta gate if she judges it worth
   the ink, since her A1 amendment's headroom figure rests on it.
5. **C2's no-separator composition is the delta's easiest regression.**
   A build that reuses A3's span verbatim will ship the separator in
   C2 as well (A3's segment always has a preceding segment; A5's does
   not). Nadia §6's fallback-replacement check covers it; this flag
   names the mechanism so the gate tests the DOM, not the screenshot.

## 7. Honesty note — what this addendum does not discharge

**The pre-existing A1–A6 fold-ins for the original surfaces remain
owed.** Quinn's design gate (§5, amendments A1–A6 — the 20 px fold-in
touch list, the D6 geometry-vintage entry, the stroke reconciliation,
D5 made definite, the generator bridge, the A1 responsive mechanism)
have not been applied to `PLACEMENT-SPEC.md`, and this addendum does
not apply them, discharge them, or substitute for them. The SI build
brief still cannot be written from the gated spec alone until those
fold-ins land. What this pass adds is only A5's placement record, in
addendum form, so that when the fold-in is performed, A5 folds in
alongside A1–A6 from the text in §5 — it does not move to the front
of that queue by existing.

---

## Verification (this seat's checklist, applied)

- [x] Structure unchanged from Nadia's spec — composition, cases,
      guard, and fallback are hers verbatim; only the visual layer
      (box, gaps, separation, composition mechanism) is decided here
- [x] Every value traces to a named token or a stated typographic
      value: `--size-state-icon-inline` (20 px), `gap-inline` /
      `gap-1` (4 px), one font-default word space; no raw one-off
      numbers
- [x] Box-to-line fit measured from the shipped tokens (16 ⁄ 24 px
      host; 20 px box; 4 px slack), alternatives priced (18 px barred
      by Ada's floor; 22 px fits but rejected on parity)
- [x] Responsive behavior specified at 320 px and at 200 % (zoom and
      text-only resize treated separately), with calculated widths
      and the wrap joint named; rendered confirmation flagged to the
      gate rather than claimed
- [x] Color not ruled by this seat — Iris's A5 extension cited;
      Ada's outstanding extension flagged, not assumed
- [x] Artwork, Nadia's spec, the gated placement spec, and all site
      code untouched by this pass

**Deliberately left unchecked:** any rendered measurement of a built
A5 card (none exists); Ada's A5 extension; the A1–A6 fold-ins (§7).

*Prepared by Mina, UI Design — 2026-11-22. Returns to Hue for Quinn's
delta design gate with Iris's extension and, when it lands, Ada's.
Addendum only: PLACEMENT-SPEC.md, SPEC-LISTING-CARD.md, the art, and
all site code untouched.*
