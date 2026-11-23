# Tab Bar Redesign — UI Visual-Form Pass

**Seat:** Mina, UI Design (visual form — the second step of the design-first chain:
Nadia structure → **Mina visual form** → Iris / Thea / Ada consults → Quinn design gate →
Dustin picks → build queue)
**Input:** `UX-STRUCTURE.md` (Nadia, main `0f16f1a`) — audit, B-1…B-7 diagnosis, directions
D1 / D2 / D3, constraints register §4, handoffs §5. Structure is taken as given; this pass
designs only the visual layer of the directions Nadia specified.
**Ground truth read for this pass:** `v2/components/layout/TabBar.tsx` and `icons.tsx` as
shipped, the token block in `v2/app/globals.css` (all values below are those tokens, quoted
with their recorded contrast figures), `THEME-ART-DIRECTION.md` §5, Iris's colour consult
for the seed-pod icon mark (2026-11-22), Thea's typography playbook, and this seat's
favicon SPEC (`icon-redo-2026-11-22/SPEC.md`) as the form precedent for §6 /
`MEDALLION-SPEC.md`.
**Housekeeping note:** this surface has **no dark theme** — `globals.css` defines no dark
variant and the bar has no `dark:` styling. "Light/dark" in the presentation plan therefore
means: light as shipped, plus the dark-*chrome* proof ground (`#20241F`, the icon family's
proof ground) for the medallion only. Inventing a dark bar theme is not in this commission.

---

## 1. The shared visual system (all directions)

Directions differ in geometry and state model; they share one icon language, one type
setting, one colour assignment, and one token set, so Dustin is picking structure and
emphasis — not three unrelated skins.

### 1.1 Icon language — the 1.8 px stroke family is retired in the bar

Nadia's B-2 finding is accepted in full: the current family (24 px grid, 1.8 px stroke,
`currentColor`, no fill) is the generic line-icon dialect, and two of its five glyphs are
the universal template marks. The replacement, specified here as a system:

- **Filled-silhouette glyphs.** Each mark is one solid silhouette in `currentColor`, drawn
  on the same 24 px grid with a 20 px live area, with detail carried by **one paper
  cut-line** (a negative-space channel, ≥ 2 px wide on the grid) instead of by stroke.
  No stroke weight exists to vary, so the family cannot drift the way stroke families do.
- **Why filled:** a silhouette holds its read at 24 px, in grayscale, and in forced-colors
  mode; it is the same boldness discipline that just made the seed-pod favicon mark work
  (silhouette-first, masses over detail); and it sits in the site's own register — the
  plates are masses of gouache, not outlines. The bar's icons stop looking imported.
- **Subjects** (standard actions keep their standard symbols, per platform discipline —
  novelty is spent on the botanical marks, not on re-teaching Home or Search):
  - **Home** — house silhouette, door as the cut-line. (Universal symbol, kept universal.)
  - **Crops** — an upright seed pod silhouette, one vertical cut-line seam. Kin to the
    shipped pod favicon mark, drawn as a glyph, not a copy of the painting.
  - **Varieties** — a bloom head silhouette (five rounded petals as one mass) on a short
    stem mass. In D1 directions this glyph is *replaced by the medallion* (§6); it is
    still specified because D2 and D3 need it and the header menu reuses the family.
  - **Sellers** — barn silhouette, door-cross as cut-lines.
  - **Search** — magnifier: solid ring (outer Ø 15 px on the grid, ring thickness 3 px)
    with a solid handle. The universal symbol, rebuilt in the family's mass language.
  - **Account** — person silhouette: solid head disc over a solid shoulder mass. (D2 /
    hybrid only; also the header account icon's replacement glyph.)
- **Sizes:** glyphs render at **24 px** in the bar (unchanged slot), 20 px in the header
  menu. One optical size: the marks are drawn for 24 and the 20 px use is a render of the
  same paths — acceptable because silhouette detail is ≥ 2 px on the grid at both sizes;
  no second cut is commissioned.
- **Creation route:** these are interface glyphs — vector construction to this spec by the
  build, checked by this seat at render. They are **not** paintings and are not Elena's
  commission. Elena's commission is the medallion only (§6, §7).

### 1.2 Label typography (Thea consulted — §8.2)

Labels stay in the **sans tool layer** — that two-register system (sans tools, painted
world) is the site's, and the bar is a tool. Setting, unchanged in face, tightened in role:

- Face: `--font-sans` (system stack). Size **12 px** (`text-xs`, the current setting —
  it is the Material label-small / Apple caption floor region and the 320 px case in
  Nadia's §4.2 caps label length, not size). Weight **600** inactive, **700** active —
  weight, not size, carries the active emphasis, so no label ever changes width between
  states and nothing shifts.
- Tracking: **+0.01 em** on labels (Thea's rule: small labels take slightly positive
  tracking; lowercase body text takes none — a one-word label is the label case, not the
  body case). Sentence case as today ("Varieties", never "VARIETIES").
- Line-height 1 (single-line labels, no wrap; "Varieties" is the longest word and is the
  fit-test word at 320 px — §5).

### 1.3 Colour assignment (Iris consulted — §8.1)

No new colour enters the system. Every value is an existing token on the bar's existing
ground, `paper-deep` `#F0E5CB` at 92 % with backdrop blur:

| Role | Token | Value | Recorded contrast |
|---|---|---|---|
| Bar ground | `paper-deep` | `#F0E5CB` | — |
| Inactive icon + label | `ink-soft` | `#4A4438` | 7.7 : 1 on paper-deep (recorded) |
| Active icon + label | `leaf` | `#1E4634` | 9.4 : 1 on paper; **on paper-deep not recorded — Ada to measure (§9)** |
| Active marker (stem rule / plate ring) | `leaf` | `#1E4634` | shape channel, not text |
| Pressed well / active well (D2) | `leaf-50` (sage-tint) | `#E3EAD8` | leaf on it 8.6 : 1 (recorded) |
| Retired 3 px dot's colour | `petal` | `#8E2A52` | leaves the flanking tabs; survives only in the badge (§4) |
| Bar top rule | `line-strong` | `#91825C` | **3.0 : 1 on paper-deep — exactly the SC 1.4.11 floor; nothing in this pass lightens it (§9)** |
| Focus ring | `focus` | `#7A3E10` | global 3 px `:focus-visible` ring, unchanged |

The chroma budget (Iris's standing discipline): the bar is a low-chroma field — paper,
ink, one green. The single high-chroma event in any direction is either the medallion's
painting (D1) or the badge's petal (D2 / hybrid). Never both at full strength in the same
slot's neighbourhood: in the hybrid the badge sits on Account, two slots from the plate,
which is the separation that keeps the budget honest.

### 1.4 Shared geometry and tokens

- Spacing scale: the project's 4 px baseline. Bar band **64 px** + `env(safe-area-inset-bottom)`
  (as shipped). Content cap `max-w-lg` retained on phones; five equal columns.
- New component tokens (names by role; values light-theme — the only theme):

| Token | Value | Used by |
|---|---|---|
| `tabbar.height` | 64 px | all |
| `tabbar.plate.diameter` | 56 px | D1, hybrid |
| `tabbar.plate.rise` | 20 px (plate top above the bar's top rule) | D1, hybrid |
| `tabbar.marker.width` / `.height` | 28 px / 3 px, radius `radius-bar` 4 px | D1 flanks, D3 |
| `tabbar.well.radius` | 16 px | D2, hybrid pressed |
| `tabbar.well.inset` | 4 px vertical, 6 px horizontal inside the cell | D2 |
| `tabbar.badge.size` | 18 px disc, 11 px lining figures | D2, hybrid |
| `tabbar.motion` | 150 ms ease-out (house range; reduced-motion rule wins) | all |

- **States drawn for every direction:** default · active · pressed (`:active`) · focus-visible ·
  no-tab-lit (utility routes — the bar renders in its default state, by rule, per Nadia) ·
  badge / no-badge where the set carries Account. Pressed never resizes or moves the
  control: a well darkens into existence inside the cell (opacity/colour transition only),
  so the finger's target is identical in every state.
- **Scroll behaviour rendering:** always-visible in all directions (Nadia §4.4; hide-on-scroll
  is excluded without Dustin's explicit ruling). The bar does not condense, recede, or
  animate on scroll. The only scroll-coupled numbers are the clearance contracts (§5).

---

## 2. Direction 1 as drawn — "The Center Plate"

**Set:** Home · Crops · **Varieties (plate)** · Sellers · Search (Nadia's D1, unchanged).

- **The plate:** a **56 px disc** centred on the middle column, its centre on the bar's
  top rule, so the disc rises **20 px** into the page and sits 36 px into the band. The
  disc is a `paper` `#F8F1E1` tile (flat, full-bleed inside the disc — the medallion's
  ground, per the icon family's tile discipline) carrying Elena's medallion painting
  (§6 / `MEDALLION-SPEC.md`), ringed by a **2 px `line-strong` ring** at rest — the
  boundary value already at its 3.0 : 1 floor, not lightened. One elevation step only:
  `shadow-listing-flat` (the system's existing warm flat shadow) under the disc's lower
  arc, so the plate reads as *set into* the bar, not floating over it.
- **The plate's label:** "Varieties" sits inside the band, directly under the disc
  (disc bottom overlaps the label's slot top by 0 px — label baseline zone is the band's
  lower 20 px). The whole centre cell — disc + label — is the one link; the tappable
  area is the full column width × (band + rise), with the disc's own tappable disc
  ≥ 44 px as Nadia's envelope requires. The rise is part of the target, and §5's
  clearance contract is re-derived to include it.
- **Flanking tabs:** filled-silhouette glyph (§1.1) + label, stacked as today.
  Active flank = `leaf` glyph + label at 700 + **stem rule**: a 28 × 3 px `leaf` rule
  centred under the label, in a 5 px slot **reserved on every flank tab** (the retired
  dot's no-shift discipline, kept; the marker is now 9× the dot's width — B-4 answered).
- **Plate active state (on `/variety`):** the ring turns `leaf` at **3 px**, the label
  turns `leaf` at 700, `aria-current` set. The painting itself never recolours, tints,
  or scales — artwork is not a state channel. Inactive plate = the same painting, the
  quieter ring: the landmark is constant, the ring is the state.
- **Pressed:** flanks get the `leaf-50` well (§1.4) for the press duration; the plate
  gets a `leaf-50` halo ring outside its ring (colour only, no scale — a scale change
  on the landmark would move the target under the finger).
- **What it looks like, in one line:** a quiet ledger strip with a painted seal pressed
  into its centre — the site's two registers, tool and plate, in one bar.

## 3. Direction 1 + D2's set — the recommended hybrid (Nadia's recommendation, designed)

**Set:** Home · Sellers · **Varieties (plate)** · Search · **Account (badge)**.

Everything in §2 stands, with three deltas:

- **Flank order** per Nadia: browsing doors left of the plate (Home, Sellers), action /
  personal doors right (Search, Account). Glyphs per §1.1 (Farm/barn for Sellers,
  person for Account).
- **The badge** rides the Account tab (§4's badge spec, shared with D2).
- **Crops' glyph** (§1.1) is still built — the header menu and desktop HeaderNav keep
  Crops, and set parity between bar and menu is an accessibility property (Nadia §4.5);
  the family is specified whole even where one direction doesn't seat every member.

This is the direction the presentation (§7) leads with, because it is the only one that
answers B-1…B-7 together. It is presented as a direction, not a verdict — the pick is
Dustin's, and D1-as-drawn remains fully designed above if he will not move Crops.

## 4. Direction 2 as drawn — "The Working Five"

**Set:** Home · Varieties · Search · Sellers · **Account (badge)** (Nadia's D2 order).

- **Flat geometry, deliberately:** no rise, no disc, band exactly as shipped (64 px +
  safe area). This direction's novelty is the set and the state model; its silhouette
  against the page is the current bar's, and the presentation must show it honestly as
  such — its difference is felt in use, not in outline.
- **Active state — the pressed well:** the active tab's glyph + label sit in a
  `leaf-50` sage-tint well, radius 16 px, inset 4 px / 6 px inside the cell, glyph and
  label in `leaf` (label 700). The well is a *region* channel: it survives grayscale,
  reads at a glance, and speaks the site's existing chip language (active filter chips
  are already sage-tint + leaf). The well's space is reserved in every state (invisible
  when inactive) so activation shifts nothing.
- **Pressed:** the well deepens one step — a `color-mix` of `leaf-50` with 8 % `leaf` —
  for the press duration. (A derived value, not a new token hue; flagged for Ada's
  measurement with the other state pairs, §9.)
- **The badge (also the hybrid's):** an **18 px disc** on the Account glyph's upper
  right, overlapping the glyph's bounding box by 4 px, never covering the label.
  Fill `petal` `#8E2A52`, numeral in paper-white at **11 px, 700, lining figures**
  (Thea: figures in interfaces are lining; a count that updates in place takes tabular
  lining figures so "3" → "12" never wobbles the disc — the disc grows to a 22 px pill
  at two digits, height fixed). Counts above 99 render "99+". Signed-out or zero:
  **no badge at all** — no empty disc, no reserved badge space (the badge is an overlay;
  its absence moves nothing). The accessible name carries the count ("Account, 3
  alerts"); the badge itself is `aria-hidden` decoration on a labelled tab, never the
  only channel — the account page lists the alerts, as today.
  **Floor flag:** white on `petal` is **not a recorded pair** (petal's recorded figure
  is 7.2 : 1 *on paper*). The badge does not ship on an assumed ratio — §9 flags it for
  Ada's measurement, with the pre-agreed fallback if it fails 4.5 : 1 for its 11 px
  text: `leaf` fill with white numeral (white on leaf is recorded at 10.6 : 1), petal
  surviving as a 2 px ring so the alert hue is not lost.
- **Identity:** the ledger strip Nadia named — five entries, the current one pressed
  into the paper, your number annotated in the margin. Typographic and behavioural,
  no painting surface. Stated plainly so Dustin picks it, if he does, for what it is.

## 5. Direction 3 — the control, honestly presentable

**Set and geometry unchanged.** D3 gets exactly the treatment Nadia scoped — the
unification rendering, drawn properly, and nothing dressed up beyond it:

- The **stem rule** (§2's flank marker: 28 × 3 px `leaf`, reserved slot, label 700 +
  `leaf`) replaces the 3 px dot **on all three navigation surfaces** — tab bar,
  HeaderNav (rule under the current text link), header menu (rule as a left rail on
  the current row, since a dropdown row has no "under" worth using). One model,
  specified once, three renderings of the *same* marker logic.
- The **filled-silhouette glyph family** (§1.1) — D3's freshness is the new icon family
  inside the existing slots, per Nadia's costing, plus the pressed well on `:active`
  and re-tap-to-top behaviour (behaviour is Nadia's/build's; its visual half — the
  pressed well — is specified in §1.4 and applies here).
- Presented to Dustin labelled as what Nadia labelled it: **a repair, not a redesign.**

### Clearance, safe-area, and fit contracts (all directions)

- **Safe area:** `padding-bottom: env(safe-area-inset-bottom)` unchanged; no direction
  puts a target inside the gesture inset. The plate's rise goes *up*, never down.
- **Focus-never-obscured (SC 2.4.11):** D2 / D3 keep the shipped contract
  (`scroll-padding-bottom: calc(5rem + env(safe-area-inset-bottom))`, footer `pb-24`).
  **D1 / hybrid re-derive it in the same build:** the plate obstructs up to
  64 + 20 = 84 px at the centre column, so `scroll-padding-bottom` becomes
  `calc(5.75rem + env(safe-area-inset-bottom))` (92 px — the plate's full obstruction
  plus an 8 px breathing margin) and footer mobile clearance rises to match. This is a
  build requirement written here, not a hope; Ada verifies it at her pass (§9).
- **320 px / 200 % text:** five slots at 320 px = 64 px per slot. "Varieties" at
  12 px / 600 / +0.01 em measures ≈ 52 px — fits with 6 px to spare per side; labels
  never wrap and never shrink (a shrunk label is a failed render, not a responsive
  strategy). At 200 % text the labels may overflow their slots — the build's check
  (§7) renders it; the designed behaviour is that the bar scrolls nothing and clips
  nothing: labels are the last element permitted to grow the band's height, and if the
  gate render shows clipping, that is a gate defect, not an accepted cost.
- **Forced-colors mode:** glyphs and markers are `currentColor`-driven and survive;
  the well and the badge fill must be declared with `forced-color-adjust` handling in
  the build brief (system colours take over; the badge numeral must remain legible
  against the system badge ground — checked in §7's render list).

### Desktop relationship (Nadia's scope: active-state rendering only)

- **D1 / hybrid picked →** HeaderNav adopts the **stem rule** under its current link
  (same 28 × 3 logic, sized to the link's text width capped at 28 px), semibold +
  `leaf` retained. The plate does **not** travel to desktop — a raised disc in a text
  header is a different component, and none is designed here.
- **D2 picked →** HeaderNav adopts the **pressed well** (sage-tint pill behind the
  current link's text), and the header's account icon gains the §4 badge.
- **D3 picked →** the §5 unification *is* the desktop work.
- All three are the flagged amendment to the shipped 5.3 surface (rendering only, no
  set or layout change) and stand or fall with Dustin's Q4 answer. If Q4 is "leave the
  header untouched," the mobile designs above are complete without this section.

---

## 6. The medallion — summary (full spec: `MEDALLION-SPEC.md`)

For the D1 directions, the plate carries **one painted gouache medallion: a single
upright poppy seed pod** — the same subject as the shipped seed-pod favicon/touch mark,
so the bar's centre and the phone's home screen carry one family face, and the pod
says "seed" — the directory's whole subject — without claiming any cultivar. Key
numbers (full rules in the spec file, in the favicon SPEC's form):

- Disc **Ø 56 px** on screen; painting's safe disc **Ø 48 px**; Elena delivers a
  **1024 × 1024 px** master, transparent ground (background only transparent; the
  painting full-strength and solid — Dustin's standing transparency ruling).
- Subject bounding box **78–88 % of the disc diameter**, one connected mass, ≤ 3 value
  masses, adjacent masses **ΔL\* ≥ 20**, no load-bearing feature narrower than
  **3 px at the 48 px acceptance render**.
- Acceptance renders at **56 / 48 / 44 px**, on `paper-deep` and on dark `#20241F`,
  plus a grayscale 48 px proof — judged at 1:1, disc first.

## 7. Presentation plan — how Dustin picks from real renders

No direction is presented as a drawing of a bar alone. Every direction is rendered
**in situ, in a device frame, on real pages**, assembled by Mina from the build's
render of the spec (coded mock, not a painting of a mock — the bar is interface, and
its renders must be the real component at real size):

**Elena paints exactly one thing:** the medallion master per `MEDALLION-SPEC.md`
(1024 × 1024, transparent ground, verbatim prompt saved alongside per the 2026-11-21
rule). Nothing else in the presentation is painted. The flank glyphs are built as SVG
from §1.1's construction spec; if Quinn's gate or Dustin's eye rejects a glyph's
silhouette, the redraw is a construction fix, not a new painting commission.

**Mina assembles, per direction (D1, hybrid, D2 full; D3 as the labelled control):**

1. **Device frames at 390 × 844** (Dustin's judging size) with the bar in situ on
   three real pages: Home (plate/well at rest), a Variety page (Varieties active —
   the plate's ring / the well doing their work), and the Account page for D2/hybrid
   (Account active **with badge showing 3**). One frame per direction per page-state
   that differs; states that don't differ between pages aren't re-rendered.
2. **A state strip per direction:** default · active · pressed · focus-visible ·
   no-tab-lit (on `/about`) · badge / no-badge (D2/hybrid), at 1:1, on the bar's own
   ground — the strip is where Quinn checks states; the frames are where Dustin judges feel.
3. **The tight cases:** one 320 px-wide frame per direction (label fit), one
   200 %-text render of the hybrid, one forced-colors render of D2's badge.
4. **Medallion acceptance set** per `MEDALLION-SPEC.md` §A (56/48/44 px, both grounds,
   grayscale) — shown *before* the frames that use it, so the painting is judged at
   its own sizes first, per the favicon precedent's order of judgement.
5. **Desktop strip:** HeaderNav in its current form beside the §5 amended rendering
   for the picked-model variants — one strip, so Q4 is decided on evidence.
6. Every file delivered under a **fresh filename** (house caching rule), self-hosted,
   no hotlinks. Dustin picks a direction (Q1), the set (Q2), the crown (Q3), and the
   desktop scope (Q4) from these renders; Quinn's design gate runs on this same set
   before it reaches him.

## 8. Consults

### 8.1 Iris — colour theory (feeling). Recorded from her seat's rulings as applied to
this design: her token discipline in `globals.css`, her seed-pod icon consult of
2026-11-22 (the direct precedent — same ground, same families), and her playbook's
feeling method. Her rulings on this pass:

> **Ground and families — approve.** The bar stays on `paper-deep` with `ink-soft`
> inactive and `leaf` active: no new colour enters the system, and the chrome keeps
> borrowing its colours from the plates' world instead of inventing a UI palette.
> **Feeling read (evidence grade: moderate — association literature, a read, not a
> guarantee):** a warm paper field with one deep foliage green is built to read as
> *the catalogue's paper, handled* — unhurried, warm, quietly botanical. Value and
> chroma do the work: the field is light (positive, low-arousal read), the green is
> mid-dark and moderate-chroma (living foliage by ecological valence — the site's
> already-approved foliage green, so it inherits the plates' world).
> **The chroma budget is the ruling that binds:** saturation lives in exactly one
> place per direction — the medallion's painting (D1) or the petal badge (D2). The
> petal dot's retirement from the flanking tabs is correct on feeling grounds as
> well as Nadia's: petal at 3 px was a signal colour spent below the size where a
> signal can read, which is how a jewel becomes noise. In the hybrid, plate and
> badge coexist only because they are two slots apart and different in kind —
> painting vs. signal; if the badge ever moved adjacent to the plate, the badge
> would go `leaf` and petal would leave the bar entirely.
> **The well (D2):** sage-tint `leaf-50` under `leaf` is the site's own pressed-into-
> paper pairing (8.6 : 1 recorded) and reads as an entry *marked in the ledger*,
> not as a button lighting up — the right register for this directory. Approved.
> **Not hers to rule:** every ratio's floor is Ada's; the one pair Iris flags *to*
> Ada is white-on-petal for the badge, because petal is a signal red-family colour
> and red-family appearances are audited as signals — if its floor fails, the leaf
> fallback in §4 keeps the signal's shape and loses only its hue, which feeling
> can accept and preference cannot overrule.

### 8.2 Thea — typography. Recorded from her playbook's rules as applied to the bar's
one text role (her scale discipline: roles before sizes; a new step only for a new role):

> **No new type role is created.** The tab label already exists in the system (sans,
> caption size); this redesign sets it properly rather than re-founding it: **12 px,
> 600 inactive / 700 active, +0.01 em tracking, sentence case, lining figures** where
> figures appear. Weight carries the active state because a size change would move
> every label's width on every navigation — hierarchy by weight is the platform
> pattern (Apple's Headline/Body separation) and the only one that costs no layout.
> **The badge numeral** is interface data: lining, tabular where two digits must not
> wobble, 11 px / 700 — Apple's 11 pt floor, met exactly, and therefore *not* to be
> set smaller for elegance. **Labels are never tracked-out lowercase prose and never
> caps** — the +0.01 em is the small-label allowance, not a licence to letterspace.
> **"Varieties" is the fit-test word** at 320 px and at 200 %: if it clips in the
> gate render, the fix is layout (band height), never a smaller size or a condensed
> face — artificially condensed type is rejected outright, as is any faux-bold: the
> 700 must be the system stack's drawn bold, which the current 600 already relies on.

## 9. Flagged for Ada — formal ruling needed before the Quinn gate

This pass designs *within* the floors in Nadia's §4.2 register. Four items exceed
what a visual pass may assume and need **Ada's formal ruling/measurement** before
Quinn's design gate; none blocks Dustin's pick, all block the build:

1. **`leaf` on `paper-deep` at 92 % over real page content** — the active label/glyph
   pair. Recorded on paper (9.4 : 1) and on `leaf-50` (8.6 : 1), **not recorded on
   paper-deep**, and the bar's translucency means the true ground is paper-deep over
   whatever scrolls beneath. Ada measures the shipped composite, worst-case content.
2. **White numeral on `petal`** (badge, §4) — unrecorded pair; needs ≥ 4.5 : 1 at
   11 px or the pre-agreed `leaf`-fill fallback takes effect. Also the badge disc
   against the bar ground as a non-text indicator (SC 1.4.11, 3 : 1).
3. **D2's pressed-well deepened tint** (`leaf-50` + 8 % `leaf`) — a derived value;
   Ada confirms the active label's ratio inside it in the pressed state.
4. **D1's re-derived clearance contract** (§5: scroll-padding 92 px + footer) —
   Ada verifies the plate (disc + rise) can never obscure a focused element
   (SC 2.4.11), including focus landing on the footer stem and the last listing card.
   Plus her standing check: the plate ring at its 3.0 : 1 floor boundary value —
   this pass did not lighten it; Ada confirms the *active* 3 px `leaf` ring needs
   no boundary ruling (it is a state marker with colour + label channels beside it,
   not a sole boundary), or rules otherwise.

Also noted for the gate, not for Ada: forced-colors rendering of the badge (§5) and
the 200 %-text render (§7) are Quinn-gate checks on the presentation set.

## 10. Verification checklist (this seat's playbook)

- [x] Structure unchanged from Nadia's spec — sets, orders, active models, desktop
      scope are hers; only the visual layer is this seat's
- [x] Every colour, size, and spacing value traces to a named token in `globals.css`
      or a new component token named in §1.4 — no raw values
- [x] All states drawn per direction: default · active · pressed · focus-visible ·
      no-tab-lit · badge/no-badge
- [x] Hierarchy: squint test — D1/hybrid read as one landmark + four quiet tabs;
      D2 reads as one pressed entry; both survive grayscale (shape/region channels
      beside every colour channel)
- [x] Icon family: one language (filled silhouette), one grid, optical size stated;
      standard actions keep standard symbols; no tab is icon-only
- [x] Artwork: the medallion is Elena's commission under spec (§6), placed never
      cropped or stretched; nothing hotlinked anywhere in the presentation plan
- [x] Consults recorded in the consultants' own sections (§8); Ada's items flagged,
      not assumed (§9)
- [ ] Deliberately unchecked by this seat: rendered-pixel verification — that belongs
      to the presentation renders (§7) and Quinn's gate, which measure the real
      component at 390 / 320 px, not this document

— Mina, UI Design · 2026-11-22
