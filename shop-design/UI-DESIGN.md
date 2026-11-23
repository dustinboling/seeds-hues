# Seller-as-Shop — UI Design

**Seat:** Mina, UI Design (author). Standing collaborators applied throughout: Iris (color theory — feeling only; every feeling call below is hers in substance, recorded in §13), Thea (typography — every type value below is hers or the shipped system's; applications recorded in §13), Ada (accessibility — WCAG 2.2 AA floor; this design states computed pairs in §12 so her pass after me recomputes, it does not discover), Nadia (UX — her SPEC, `shop-design/SPEC.md` on `origin/main`, is the contract this design dresses; nothing structural in it is re-decided here), Wren (copy — §14 enumerates every slot this design needs; this document finalizes no words), Elena (art direction — §15 flags what she is and is not being asked for).
**Date:** 2026-11-22 · **Status:** Design only. No code, no build. Written so the shop build brief can lift its visual layer from it verbatim, alongside Nadia's §§3–11.
**Commission:** Dustin, 2026-11-22: each seller's profile page becomes the seller's shop — presentation only, model unchanged (directory-only; buying leaves via outbound `/go/` links; prices never shown; packet sizes shown) — plus the seller's homepage link ruled into the header and a seller contact block (homepage + customer service phone + email where published).

**House standards binding this design:** US spelling throughout. Prices never shown — no element designed here may ever carry one, and none does. Phone-first for public surfaces (iPad-first is admin-only), every surface a PWA. Illustrations shown whole, never cropped or stretched, never hotlinked. No typography baked into any artwork — this design proposes no artwork (§15). One design thread at a time.

---

## 0. The one rule that governs this design

**The shop is dressed by composition and rhythm, not by costume.** Nadia's ruling stands and this design executes it literally: no re-skin, no banner, no new route, no new ground, border, shadow, radius, hue, or typeface enters this page. Every visual value below is a value the shipped site already renders, named by its Tranche 2 token. What makes the page read as a shop, visually, is three things this design controls:

1. **One accent, spent once in the header.** The leaf-filled primary button is the header's only saturated element (§13, Iris's 60-30-10 discipline). The contact rows beneath it are quiet text rows, the definition list is ink and muted, the StatePlate is the header's one picture. A visitor's eye lands on the seller's name, then the one green door — exactly the hierarchy a shop signboard wants.
2. **One tool language in the catalog.** Search field, filter strips, sort group, applied row, and count line are all built from the shipped control vocabulary — eyebrow legends, `.chip-filter`, the SearchBox field geometry, the `.btn` family — so the three threshold bands (§8) read as one page at three densities, never as three pages or as bolted-on machinery.
3. **Absence is composed, not apologized for.** The contact block has no container — no card, ground, border, or reserved space — so a one-channel block and a three-channel block are both complete compositions (§4.3). The no-tools shop has no ghost chrome (§8). Empty states are plain fact lines in the results region's own register (§10).

Three consequences, stated now because they decide arguments later:

- **If a value is not in §2's token basis, it does not appear in this design.** The two exceptions are proposed, named, and flagged for the token register in §16 — both are component tokens composed from existing system values, plus one icon size on the existing scale. No raw hex, no eyeballed pixel, appears anywhere below.
- **The Quiet Ledger card is not touched — including by proximity.** §9 designs only its context: list spacing, grouping, and the shipped cascade motion. Any design impulse that would change a card to "match the shop" is out of scope by Nadia's §12 register and by this rule.
- **Rendered differences from today's page are exactly the visual consequences of Nadia's S-1…S-12** (§17 maps them). A thirteenth rendered difference is a defect in this design, not a flourish.

---

## 1. How to read this design / evidence

- §2 is the token basis — the complete palette of values this design may spend, with the shipped source of each.
- §§3–4 design the header and the contact block (Nadia §3.2, §3.5; scope item 1).
- §§5–7 design the catalog section: heading, control block, search, filters, sort, applied row, count line (Nadia §§3.3, 5, 6, 7; scope items 2–3).
- §8 designs the three threshold bands as visual states (Nadia §8; scope item 3). §9 designs the results region's context around the shipped card (scope item 2). §10 designs the empty, depleted, and failure states' composition (Nadia §9; scope item 4).
- §11 is breakpoints and platform stress. §12 is the contrast table — every foreground/background pair this design introduces or newly composes, computed, unrounded values stated to two decimals. §13 records Iris's and Thea's rulings where applied. §14 is Wren's copy-slot inventory. §15 is Elena's flags. §16 is the token-register proposals. §17 is the rendered-difference map. §18 is pushback. §19 is the verification checklist, including what was deliberately not checked.

**Evidence:** Nadia's SPEC via `git show origin/main:shop-design/SPEC.md` (498 lines, read in full); Tranche 2 SPEC (`backlog-2026-11-21/tranche-2/SPEC.md`, the token/component system of record); Tranche 3 SPEC §§2, 5.2, 5.3 and the Item 3.1-F FilterStrip finish; the Tranche 3.3 field-states design for the field/failure precedents; code truth from `origin/main` via `git show` only (seller page, `globals.css` `@theme` and component layer, `BrowseFilters`, `FilterStrip`, `SearchBox`, `OutboundLink`, `StatePlate`, `icons.tsx`, `design-tokens/tokens.json`). Contrast ratios in §12 were computed for this design from the shipped hex values by the WCAG relative-luminance formula (linearize sRGB; weight 0.2126 / 0.7152 / 0.0722; (L1 + 0.05) / (L2 + 0.05)); values carried from Tranche 2's recorded computations are credited where they appear and agree with recomputation within 0.01.

---

## 2. Token basis — every value this design spends

The system of record is Tranche 2's `tokens.json` / `globals.css` `@theme` as shipped on `origin/main`. This design consumes the following, and nothing else. (DTCG names are the `tokens.json` names; CSS variables are the `@theme` keys.)

### 2.1 Color (reference → role on this page)

| Token | Value | Role in the shop design |
|---|---|---|
| `color.paper` | `#F8F1E1` | Page ground — header, contact block, control block, and empty states all sit directly on it |
| `color.surface` | `#FFFDF6` | Field ground (search input), chip ground at rest, card ground (cards unchanged) |
| `color.paper-deep` | `#F0E5CB` | Not used by any new element. Named here so its absence reads as a decision: the contact block and empty states take **no** recessed ground (§0.3) |
| `color.ink` | `#2E2A23` | H1/H2 text (via base heading color), definition values, empty-state primary lines, chip text at rest |
| `color.ink-soft` | `#4A4438` | Contact-row labels; the all-sold-out notice (§10.4) |
| `color.muted` | `#6A5F4C` | Eyebrow legends and labels, definition terms, count line, chip count numerals, "No website" line, disclosure line |
| `color.line-strong` | `#91825C` | Chip borders at rest, search-field border (2px, §6.2), FilterStrip chevron borders — component boundaries only, never text |
| `color.leaf` | `#1E4634` | Primary button ground; selected-chip text and border; H1 text (shipped); link hover |
| `color.leaf-600` | `#2E6B4F` | Primary button hover ground; chip hover border; search and contact-row icons |
| `color.leaf-50` | `#E3EAD8` | Selected/hover chip ground; Small Farm badge ground (shipped) |
| `color.link` | `#1F5C3D` | Contact-row values, did-you-mean link, state link, all body links (shipped behavior) |
| `color.focus` | `#7A3E10` | The global `:focus-visible` ring (3px + 2px offset) — unchanged everywhere in this design |
| `color.warn` | `#8A5E08` | The in-place failure line only (§10.5) |
| `color.petal` / `color.petal-50` | — | **Not used.** Petal means sold out on this page's cards; no new element may borrow it (§13) |
| `color.visit` / `color.listing` / `color.stem-rule` | shipped | Inside the Quiet Ledger card only — context, not components of this design (§9) |

### 2.2 Shape, shadow, motion

| Token | Value | Use here |
|---|---|---|
| `radius.search` | 14px | The shop search input — the search control's own radius step, inherited from SearchBox (§6.2) |
| `radius.control` | 12px | `.btn` family (primary button, shipped) |
| `radius.full` | 999px | Chips, badge (shipped classes carry it) |
| `radius.field` | 10px | **Not** used by the shop search field — that field is a search control, not a data field, and takes `radius.search` (§6.2). Recorded so the choice is visible |
| Shadows | — | **No new element in this design casts a shadow.** The contact block, control block, applied row, count line, notice, and empty states are all flat on paper. The only shadows on the page remain the cards' shipped `shadow.listing-raised` / `shadow.listing-flat` and the FilterStrip chevrons' `shadow.strip-button` |
| `duration.filter-item` / `ease.filter-settle` | 220ms / `cubic-bezier(0.22, 1, 0.36, 1)` | The results cascade (§9.2) — shipped tokens, shipped behavior |

### 2.3 Spacing, target, type

- **Spacing** is Tailwind's 4px-base scale as tokenized in Tranche 2 (`space.0`…`space.48` documentation of the used range): the values spent below are 4, 8, 12, 16, 24, and 32px, each cited at its point of use as the utility the shipped page already uses (`mt-1` = 4px, `gap-2` = 8px, `mt-3`/`gap-3` = 12px, `mt-4` = 16px, `mt-6` = 24px, `mt-8` = 32px). No off-scale value is introduced; the card's and badge's off-scale component values (Tranche 2 §§2.1.4, 3.3) are inside shipped components this design does not open.
- **Target size** is `size.target` = 44px (`min-h-target` / `min-w-target`): contact rows, chips, and the search submit all meet it (§§4, 6, 7).
- **Type** is the shipped stack, no new step: display (Fraunces) headings per the base layer (H1 `text-3xl`/`md:text-4xl`, section H2 `text-2xl`, About H2 `text-xl` — all shipped classes on this page); serif body (Newsreader, 17px/1.6 base) for the count line, notice, and empty-state lines; sans tool layer (system stack) for eyebrow legends (12px, 700, uppercase, 0.09em tracking — the shipped `.eyebrow`), chips (14px/1.5, `.chip-filter`), fields and buttons (`.field`/`.btn` families), and the contact rows (§4.2). The one type *behavior* this design adds is `tabular-nums` on updating counts (§7.4) — Thea's tabular-figures rule applied, §13.

---

## 3. Header and identity block (scope item 1)

### 3.1 Composition — unchanged, drawn here so the contact block's slot is exact

The header's shipped composition stands verbatim (Nadia §3.2). This design changes no class, order, or spacing in it; the table records the shipped rhythm because §4 builds inside it.

| Element | Shipped treatment (unchanged) | Gap above |
|---|---|---|
| Eyebrow — seller type | `.eyebrow`, `color.muted` on paper (5.56:1, §12) | — |
| H1 — seller name | Display, `text-3xl` (30px) / `md:text-4xl` (36px), `font-semibold`, `color.leaf` on paper (9.42:1) | 4px (`mt-1`) |
| Small Farm badge row (badged sellers only) | Large badge (`.badge` + small-farm tone: leaf on leaf-50, 8.60:1; border blend 3.13:1 vs own ground, Tranche 2 §3.2) + legend line, `text-sm` muted, on the same wrapping row | 8px (`mt-2`) |
| Definition list — Location / Varieties listed / Rating | `grid-cols-1` stacking on phone, `sm:grid-cols-3`; terms `text-sm` muted (5.56:1); values ink (12.68:1); Location carries the free-text line, then the state link (StateShape 22px + state name, `color.link` 7.02:1) — **placement A4, the page's only state outline** (§3.3) | 12px (`mt-3`) |
| **Contact block** | §4 — occupies the shipped website-button slot and grows downward from it | 16px (`mt-4`, the shipped slot margin) |
| Disclosure line (site-owner seller only) | `text-sm` muted | 12px below the block's last element (`mt-3`) |
| StatePlate (where a plate exists) | Beside the header at `sm` and up (`sm:flex`, gap 32px); below the header text on phone (`mx-auto mt-6`, widths 280 / 300 / 320px at the shipped steps), `.art-frame`, shown whole, no caption | — / 24px on phone |

**Rhythm note.** The header's gaps ascend 4 → 8 → 12 → 16px as the content moves from name to facts to action, then the section gap to About is 24px and to the catalog section 32px (§5.1). That ascending ladder is the page's layout-scale rhythm; the contact block is designed to extend it without breaking it (§4.3), and the catalog control block repeats the same steps (§6.1) so header and shop read as one page's rhythm, not two systems'.

### 3.2 Hierarchy check (Mina's squint and grayscale tests, applied on paper)

- **Squint:** name (largest, darkest green) → badge row (the one tinted pill) → primary button (the one filled block) → everything else in ink/muted text steps. One focal point: the name. One accent: the button. The StatePlate, where present, is a picture at the side — it does not compete because it carries no text and no saturated UI color.
- **Grayscale:** hierarchy survives on size, weight, and position alone; the badge survives on its border and mark; selected states in the catalog survive on weight + border + `aria-current` (§7), never on hue alone.

### 3.3 State icon — protective note only

Placement A4 (Item SI) already sits in the Location line: 22px StateShape, `aria-hidden`, inside the state link, before the state name. This design adds **no** second outline anywhere — not beside the H1, not in the shop heading, not on cards, not in the control block (Nadia §9A, adopted in full). The build's only obligation from this seat is that the contact block's rows, which render *below* the definition list, never crowd the state link's 44px-class tap geometry: they cannot — they are in a later block, separated by the slot's 16px margin.

---

## 4. The contact block (scope item 1; Nadia §3.5)

### 4.1 The governing visual decision: no container

The block is **unboxed** — no card ground, no border, no `paper-deep` recess, no heading, no divider above or below. Three reasons, in order of weight:

1. **Graceful absence requires it (Nadia §3.5.3).** A container is a promise of contents. A bordered panel holding one button reads as a panel missing its other rows; an unboxed stack of one button reads as a page with a button — which is exactly today's shipped page. The no-container design is what makes all seven coverage combinations (§4.3) complete compositions rather than degradations.
2. **The header already has a picture and a pill.** A panel would be the header's third framed object (StatePlate frame, badge pill, contact panel) and would demote the primary button inside a box of its own. Unboxed, the button stays the header's single filled accent (§0.1).
3. **Grouping by proximity is sufficient** (the UI playbook's first grouping tool): the 16px slot margin separates the block from the definition list, the 8px gap separates the primary action from the secondary rows, and the rows' own 44px rhythm binds them into a list. No line is needed to do what space already does.

### 4.2 Anatomy of the parts

**The website channel — the shipped primary button, untouched.** `.btn .btn-primary` via `OutboundLink`: leaf ground, white text (10.60:1), `radius.control`, `shadow.button-inset` letterpress edge, min-height 44px, padding 8px/16px, sans 16px semibold; hover ground leaf-600 (white on it 6.30:1). Its label is copy slot CS-01 (§14) — including the OQ-2 collision with the cards' "Visit shop →" pills, which Wren rules as part of this block's label set (Nadia §3.5.4). This design adds one visual observation to that ruling: the two doors are already separated by dress (a filled leaf button in the header vs a sage outline pill inside a card) and by position; the collision is verbal, not visual, and no re-dress of either element is proposed or needed.

**Phone and email rows — one row design, two channels.** Each row is a single full-row link (Nadia §3.5.2) composed of three parts on one baseline:

| Part | Treatment |
|---|---|
| Icon | New glyph (§4.4), 20px, `color.leaf-600` on paper (5.60:1 as a graphic, floor 3:1), `aria-hidden` — a redundant channel; the label and value carry the meaning |
| Label | Sans 16px, regular weight, `color.ink-soft` on paper (8.58:1), **not** underlined — copy slot CS-02 / CS-03 (the service-label wording is Wren's; the slot's position and dress are this design's) |
| Value | Sans 16px, semibold, `color.link` on paper (7.02:1), underlined (`text-underline-offset: 0.15em`, the shipped link treatment) — the number as published, the address in full (Nadia's visible-destination principle, §3.5.1) |

Row geometry (component tokens proposed in §16): `display: flex; align-items: center; gap: 8px; min-height: 44px` (`size.target`); width 100% of the header text column, capped at 32rem from `sm` up so a row on a wide desktop column reads as a contact list, not a table row (§18, PB-M4 records the reasoning for Nadia). Padding-inline: 0 — the icon's left edge aligns with the definition list's text edge and the button's box edge, so the header's left rail stays one clean line at every coverage level. The focus ring is the global `:focus-visible` treatment (focus on paper 7.39:1); the row sits in open flow with 16px page padding around it, so the 3px ring + 2px offset is never clipped. Hover (fine pointer only, per the system's hover discipline): the value's color moves link → leaf (9.42:1) by the shipped `a:hover` rule; label and icon do not change — one moving part per state, as with the chips. There is no pressed/selected/disabled state: these are plain links, server-rendered, identical before hydration, after hydration, and with no JavaScript at all (Nadia §3.5.2).

**Why the label is not an eyebrow.** Every other label in the header's fact zone (definition terms) is quiet sentence-case text, and the eyebrow register belongs to the page eyebrow and the catalog's control legends. A 12px uppercase label inside a 44px row would also sit a full type step below its own value and read as a caption to a control that is not there. The row's label is a peer of its value — same size, quieter color, lighter weight — which is the definition list's own label/value relationship, repeated. Consistency with the nearest neighbor wins over consistency with the distant one.

**Why the rows are not `.btn-secondary`.** A bordered button per channel would stack two or three outlined boxes under a filled one — three competing button silhouettes in one header, and a visual claim that phone and email are the same kind of door as the website. They are not: the website is the destination, the rows are contact facts that happen to be tappable. Text-row dress states that truth; button dress would overstate it and spend the header's accent budget (§13).

### 4.3 The coverage matrix as compositions (normative)

The block's height is the sum of what renders (Nadia §3.5.3: no placeholders, no reserved space, no absence copy beyond the shipped "No website on file" line). Gap rules: definition list → block 16px (shipped slot margin); button → first row 8px; row → row 0 (the 44px rows stack as a continuous list — their internal centering gives the text a 44px rhythm); "No website" line → first row 4px (the line is small muted text; the tighter gap binds the rows to it as its continuation); block → disclosure line 12px (shipped `mt-3`, measured from the block's last rendered element, whatever it is).

| # | Website | Phone | Email | Composition (top → bottom) | Block height* |
|---|---|---|---|---|---|
| 1 | ✓ | ✓ | ✓ | Primary button · phone row · email row | 44 + 8 + 44 + 44 = **140px** |
| 2 | ✓ | ✓ | — | Primary button · phone row | **96px** |
| 3 | ✓ | — | ✓ | Primary button · email row | **96px** |
| 4 | ✓ | — | — | Primary button alone — **exactly today's page** | **44px** |
| 5 | — | ✓ | ✓ | "No website" line · phone row · email row | 21 + 4 + 44 + 44 = **113px** |
| 6 | — | one | — | "No website" line · the one row present | **69px** |
| 7 | — | — | — | "No website" line alone — **exactly today's page** | **21px** |

\* Heights exclude the 16px slot margin above the block, which is constant in all seven. The "No website" line is the shipped `text-sm text-muted` paragraph (14px/1.5 = 21px).

**Why each level reads as finished.** Rows 4 and 7 are today's shipped page — finished by definition. Rows 2, 3, and 6 add a single 44px row 8px (or 4px) below the anchor element: one anchor, one row, one rhythm — the composition is a pair, and pairs need no third element to close. Rows 1 and 5 are lists of two rows under an anchor: the repeated 44px beat is the closure. At no level is there a gap shaped like a missing row, because no row's space is ever reserved; at no level do two filled or bordered objects compete, because only the button has a ground. Quinn's SH-14 drive compares each level against its own completeness (§19) — this table is the visual half of that check.

**Long values.** A long email address wraps inside its row: the row's height grows (44px is a minimum), the icon and label stay top-aligned with the first line — specify `align-items: center` for the single-line case and let the flex row's natural growth handle the wrapped case; the value's underline follows the wrapped text. A phone number never wraps (it is one token). At 200% text resize the same growth applies; nothing in the block has a fixed height (§11).

### 4.4 Two new interface glyphs — specified, with fallback

The interface icon family (`v2/components/layout/icons.tsx`) has no phone or mail glyph today. This design specifies two, drawn at build to the family's shipped rules — 24px grid, 20px live area, stroke 1.8, `currentColor`, no fill, `aria-hidden`, `focusable="false"` — named `PhoneIcon` and `MailIcon`, rendered at **20px** in the contact rows (component token, §16: 24px at full intrinsic size overwhelms a 16px text row; 16px, the ProtectionIcon's size, under-reads for a primary channel mark; 20px is the family's live-area size and sits on the spacing scale).

- **PhoneIcon subject:** a handset — the platform-conventional receiver path, drawn in the family's open-stroke hand. Not a mobile-phone rectangle (the channel is a voice line, and the rectangle reads as "device" in this family, cf. PersonIcon/MenuIcon's literalism).
- **MailIcon subject:** an envelope — rectangle with the family's diagonal flap lines. The most learned glyph in the set; no invention is wanted here.

**Fallback (the ProtectionIcon precedent, Tranche 2 §3.5):** if either glyph fails Quinn's visual check against the family hand, the rows ship **without** that glyph rather than with a borrowed or filled one. The rows pass every floor without icons — label + visible value is the complete channel — the glyph is finish, not function. These are interface icons: they are this seat's specification and the builder's drawing, **not** an Elena commission (§15).

### 4.5 What the block never does

No channel renders as unlinked text (Nadia §3.5.2). No row is ever rendered empty, dashed, or greyed. No summary or absence line is added for phone or email at any coverage level (copy slot CS-04 is enumerated as *closed* in §14 so Wren's pass records the decision rather than re-opening it). The block never moves, hides, or re-renders under any catalog state — it is above the catalog section and outside the results region's update scope (Nadia §3.3 preservation).

---

## 5. The catalog section and the "{name}'s shop" heading (scope item 2)

### 5.1 Section composition and spacing (normative)

The section keeps its shipped slot: `mt-8` (32px) below whatever precedes it (About, the reviews panel, or the header) — the page's largest gap, correctly spent on the page's largest turn, from *who this is* to *what they sell*. Inside, top to bottom, with the gap above each element:

| Element | Gap above | Notes |
|---|---|---|
| H2 — "{name}'s shop" (slot CS-05) | — (the 32px section gap) | §5.2 |
| Control block (§6) — only the parts the band earns (§8) | 16px to its first element | Composes from what is present; no slot is reserved for an absent part |
| Applied row (§7.2) — only when something is applied | 12px | Absent at rest, by Nadia §5.5 |
| Count line (§7.3) | 12px below the applied row; 12px below the control block when no row is present; 4px (`mt-1`, shipped) below the H2 in the no-tools band | One line, three contexts, one dress |
| All-sold-out notice (§10.4) — only in its state | 4px below the count line | A fact line in the count line's register |
| Results region (§9) | 12px (`mt-3`, shipped) | Cards, or a §10 state |
| Pagination | Shipped component spacing, unchanged | True navigation (Nadia §10.3) |

The claim line below the section keeps its shipped `mt-8`. Nothing above the section repaints or moves under any catalog state (Nadia §3.3).

### 5.2 The heading treatment

The heading is the shipped H2 with new words — and that is the whole treatment, deliberately:

- **Type:** base-layer display (Fraunces), `text-2xl` (24px), `font-semibold`, line-height 1.2, letter-spacing −0.01em, `text-wrap: balance` — the exact classes and computed values the section heading renders with today ("Listings at {name}"). Ink on paper, 12.68:1. The possessive name can be long ("GeoSeed Wholesale" scale and beyond); `balance` wrapping plus the container measure keep a two-line heading composed rather than ragged, and at 200% resize it wraps further without clipping (no fixed height anywhere in the section header).
- **No eyebrow above it.** The page already spends its eyebrow in the header (seller type). A second eyebrow ("Shop" / "Catalog") above this heading would be a label for a heading that names itself — decoration, not hierarchy.
- **No rule, stem, or motif under it.** The system owns a stem divider (`.divider-stem`), and it is the obvious dressing — rejected here, for the record: Nadia's register (§12 of her SPEC) admits no element not in S-1…S-12, and a motif above the catalog alone would visually expel About and the reviews panel from the shop the heading names. The heading earns its emphasis from the 32px gap above and the tool block below, which is how the page's other H2 (About, 20px) is already out-ranked by size and position. (§18, PB-M5 records this as a considered-and-rejected option so the absence is a decision.)
- **No count in the heading.** The count line (§7.3) is the live number; a number in the heading would be a second, static one (Nadia §3.1.3's two-counts rule, applied visually).

---

## 6. The control block (scope items 2–3)

### 6.1 Order and rhythm

Nadia §3.3 fixes the order — search, filter strips, sort — and §3.3's preservation fixes everything outside the block. The visual rhythm inside the block reuses the header's steps:

| Transition | Gap | Source |
|---|---|---|
| H2 → search label (or first filter legend, bands without search) | 16px | The block's top margin — the same 16px that opens the contact block; tools begin at a section step, not a caption step |
| A control's eyebrow legend → its control | 4px | The shipped `BrowseFilters` legend pattern (`eyebrow mb-1`) — every group in the block, including search and sort, labels this way |
| Search field → first filter group | 16px | Search is its own act (recall); the filters are another (recognition). The larger step separates the acts; 12px would merge them into one undifferentiated stack |
| Filter group → filter group | 12px | Shipped `BrowseFilters` `gap-3` |
| Last filter group → sort group | 12px | Sort joins the same stack at the same step — it is one more labeled group visually, whatever its semantic difference |
| Sort group (or last control) → applied row / count line | 12px | §5.1 |

The block is a gap-based stack (`flex flex-col`), not a grid of reserved slots: when a part is absent — no search in the 9–24 band, a filter group failing discrimination, the sort group while a query is active (§6.4) — the stack closes over the absence with the surrounding gaps unchanged. No hole, no doubled gap, no placeholder. This is the mechanical fact that makes §8's three bands one design.

### 6.2 The search field (Nadia §6; PB-S1's plain field, dressed)

A plain labeled search input in a GET form — no combobox, no listbox, no panel (Nadia §6.6). Its dress is the shipped SearchBox's `md` geometry with the panel removed, so the site's two search fields are visibly the same instrument at two scopes:

| Part | Specification |
|---|---|
| Label | **Visible**, set in `.eyebrow` above the field (gap 4px), carrying the scope in the seller's name — slot CS-06. Nadia §6.1 permits a screen-reader label + scope-carrying placeholder instead; this design chooses the visible label because the block's every other group is visibly labeled, an unlabeled field among labeled strips reads as a global search (the exact mistake §6.1 guards against), and a visible label survives the placeholder being replaced by typed text. The placeholder then only has to exemplify, not explain — slot CS-07, which must not promise Latin names or aliases (Nadia §6.3) |
| Form | `role="search"`, `action` = the shop URL, `method="get"`, `position: relative` (the SearchBox form's construction) |
| Input | `type="search"`, `name="q"`, `enterKeyHint="search"`; height 48px (`h-12`); `radius.search` (14px); border **2px** `color.line-strong` on `color.surface` (boundary 3.72:1 vs its own ground, 3.36:1 vs the paper it sits on — both past the 3:1 non-text floor, §12); text ink on surface (14.02:1), sans 16px (`text-base`); placeholder `color.muted` on surface (6.15:1); padding-inline: 40px left (icon slot), 96px right (submit slot) — the SearchBox `md` values `pl-10 pr-24` |
| Icon | The family's `SearchIcon`, 24px intrinsic, positioned left 12px (`left-3`), vertically centered, `color.leaf-600` on surface (6.19:1 graphic), `pointer-events: none`, `aria-hidden` — the SearchBox placement verbatim |
| Submit | `.btn .btn-primary` ("Search", slot CS-08), positioned right 6px (`right-1.5`), vertically centered; min-height 44px inside the 48px field (2px clearance top and bottom — the SearchBox `md` relationship, shipped) |
| Resting / hover | No hover treatment — the SearchBox precedent: a field does not change its border for a pointer that has not committed. Deliberate, recorded so Quinn does not file the absence |
| Focus | The SearchBox focus pair, verbatim: border moves to `color.leaf` (10.42:1 vs surface, 9.42:1 vs paper) **and** the global `:focus-visible` ring (focus, 3px + 2px offset; 8.17:1 vs surface, 7.39:1 vs paper). The block clips nothing — the field sits in open page flow with the container's 16px inline padding around it, so ring + offset (5px) always fit |
| Filled | No filled treatment. The Tranche 3.3 filled modifier belongs to the `.field` data-field set; this field is not in that set, and borrowing its dress would claim a kinship the behavior does not have. The typed text and the applied row (§7.2) are the filled state's evidence |
| Disabled / error | Neither exists for this control. A failed in-place update is the results region's state (§10.5), never the field's — the field's contents are never rewritten by the system (Nadia §6.2) |

At 320px reflow the field holds: label wraps above it if the seller's name is long (the eyebrow is a block label, it wraps as text), the input is full-width, and the submit's 96px right padding is inside the field, not added to it — no horizontal scroll, no clipped ring (§11).

### 6.3 Filter strips in the shop context (Nadia §5)

The strips are `BrowseFilters` + `FilterStrip`, inherited whole — this section designs nothing new inside them and records the context they land in, because context is what this seat owns:

- **Groups and legends:** Season · Sowing method · Life cycle · Hue, in the model's order, legends in `.eyebrow` verbatim (slots CS-09 — inherited words, enumerated for completeness, no new copy). The Sellers group never appears here; the Small Farm legend line never appears here (it belongs to the Sellers strip, which is absent — no orphaned legend).
- **Strip mechanics, as shipped plus Item 3.1-F:** single-line swipeable rows that **never wrap**; list padding 6px (`px-1.5 py-1.5` after 3.1-F) so a focused chip's ring shows whole; `scroll-padding-inline: 3rem`; edge fades in `color.paper` — correct on this page without alteration, because the shop's ground *is* paper (on surfaces whose ground differed, the fade color would be that ground's token; here the shipped value and the page agree, recorded so the build does not "fix" it); chevron buttons 44px after 3.1-F, fine-pointer only, `shadow.strip-button`, border `line-strong` on paper (3.36:1).
- **Chips:** `.chip-filter` exactly as Tranche 2 §4.2 — 44px minimum height and width, full radius, 1px `line-strong` border on surface at rest (3.72:1), ink text (14.02:1); hover (fine pointer): leaf-600 border, leaf-50 ground, ink text (11.57:1); selected (`aria-current` / `aria-pressed`): leaf border, leaf-50 ground, leaf text (8.60:1), weight 600 carried by the class; 160ms ease-out color transitions; 1px border in every state, so a chip never changes size or place when it changes state — the in-place visual standard (§9.2).
- **Hue swatch dots:** 14px, `aria-hidden`, beside the text label on every Hue chip (the shipped `SwatchDot`, border `line-strong`). The dot is a redundant channel — the family name is the carrier (WCAG 1.4.1) — and the "Mixed" conic gradient is the shipped treatment. No dot appears on any other group's chips.
- **Discrimination in visual terms (Nadia §5.2):** a group that cannot discriminate in this shop is *absent*, not disabled, not greyed, not shown with one chip. A one-strip shop and a four-strip shop are both complete blocks (§8). A group's options may still go to zero-count under other selections — those chips render their `0` and stay operable (Nadia §5.3), in the count dress of §7.4.

### 6.4 The sort group (Nadia §7)

The sort control is one more labeled group in the stack — a `fieldset` with the eyebrow legend (slot CS-10, "Sort") and a `FilterStrip` of three `.chip-filter` options (slots CS-11: "Name A–Z" · "In stock first" · "Recently checked", in Nadia's order). Single-select: exactly one chip carries the selected dress at all times, including the default (Name A–Z, per PB-1 as Nadia §7.4 follows it — the resting chip is *shown* selected, not left unmarked, because an unmarked group would read as unset). It rides the same strip mechanics as the filter groups — on a 320px screen three chips may still overflow, and the swipe/fade/chevron treatment is the honest answer, identical to its neighbors. It is **not** in the applied row (Nadia §5.5) and carries no counts.

**While a query is active** the group is absent (Nadia §7.2 — relevance order owns the list). Visually: the gap-stack closes over it (§6.1), the applied row gains the search remover, and the count line states the relevance order (§7.3). Nothing else in the block moves relative to its neighbors; the content below rises by the group's height (legend 4+18px + strip 56px ≈ 78px). That is the largest single layout movement on the page, it is Nadia's contract, and §18 PB-M1 records this seat's reservation about it with its reasoning — the design above is what her contract looks like executed cleanly, not a silent deviation from it.

---

## 7. Applied row, counts, and the count line

### 7.1 The rows beneath the block — shared rules

Two elements live between the control block and the results: the applied row (§7.2, present only under an applied state) and the count line (§7.3, always present). Both are text-and-chip rows in the system's existing dress; neither takes a ground, a border, or a container of its own; and neither ever re-dresses itself between states — their contents change, their appearance does not. Group order and legends inside the block itself are §6.3's.

### 7.2 Applied row — position and dress (Nadia §5.5)

Directly above the results, 12px below the control block (§5.1), present only when something is applied. Dress:

- A wrapping flex row, `gap: 8px` (`gap-2`) — the applied row **wraps**, unlike the strips: it is a reading row, not a scanning row, and a wrapped remover is findable where a swiped-away one is lost. (The strips' never-wrap rule is theirs; this row's wrap is the shipped Tranche 3 §2.6 pattern.)
- One `.chip-filter.chip-removable` per active group and per selected hue, plus the shop's addition — one for an active search query — each with the drawn × glyph (14px, `currentColor`, 6px after the label, `aria-hidden`; the whole chip one 44px target, glyph never separately focusable — Tranche 2 §4.4 verbatim). Label pattern is slot CS-12.
- **Clear All** ends the row: a plain `.chip-filter` (no glyph — it is an action, not a remover), slot CS-13 with its two ruled variants (filters only / search and filters).
- The row's chips are the *same* component as the strips' chips — same geometry, same selected-adjacent dress — but they do **not** take the selected (leaf) dress: they are not options in a group, and dressing them as selected would claim a group state they do not have. They render at rest dress (surface, line-strong border, ink text) with the remover glyph as their distinguishing mark. Hover and focus are the chip system's, unchanged.

### 7.3 Count line (Nadia §§3.3, 5.6, 7.3)

- **Dress:** the shipped count line's own — a plain paragraph, serif body (17px/1.6), `color.muted` on paper (5.56:1). No size, color, or weight change in any state: the line's *words* change (slots CS-14…CS-17), its dress never does, because the line is a live region (Nadia §5.6: persistent, `aria-live="polite"`, `aria-atomic="true"`, id `#seller-results-count`) and a region that also changed its appearance on every update would flicker at exactly the moment a screen-reader user is listening to it. Visual calm and announcement discipline are the same decision here.
- **Position:** §5.1's table. The no-tools band keeps the shipped 4px (`mt-1`) below the heading, because there the line is the heading's caption, exactly as today. In the tooled bands the line sits 12px below the control block (or the applied row), because there it belongs to the results it counts, not to the heading. The difference is deliberate and recorded: caption position in the band where the line captions the heading, results position where tools intervene. (§18 PB-M3 names the alternative — one position everywhere — and why it loses.)
- **Numerals** in the line take `tabular-nums` (§7.4 below) so "179 listings" and "24 listings" do not change the line's width character by character as states change.

### 7.4 Counts inside chips, and tabular figures (Thea application)

Per-option counts render inside the filter chips (Nadia §5.3), in the chip's own text run: the label in the chip's dress, the count as a following numeral span in `color.muted` — on surface at rest 6.15:1, on leaf-50 under hover/selected 5.08:1, both past 4.5:1 for the 14px numeral (§12). The count is the same 14px sans as the label (a smaller numeral would invent a type step; a same-size muted numeral is the system's existing secondary-numeral pattern, cf. the badge family's count treatments). The screen-reader unit word is slot CS-18. Both the chip counts and the count line set `font-variant-numeric: tabular-nums`: these are figures that update in place, which is exactly Thea's tabular case (prices, tables, timers, counters), and tabular figures keep a chip's width stable across a count change from 9 to 10… within the accepted 1–2px selected-weight shift Tranche 2 §4.3.3 already records for strips.

---

## 8. The three threshold bands as visual states (scope item 3; Nadia §8)

Thresholds are Nadia's (T = the shop's listing total): **T 0** — the empty shop (§10.1); **T 1–8** — no tools; **T 9–24** — filters + sort; **T ≥ 25** — search joins. Today's catalog splits 48 / 17 / 18 sellers across the three tooled bands. The visual problem is one problem stated three ways: the sparse page must not look unfinished, the tooled page must not look bolted-on, and a shop crossing a band between visits must gain or lose tools without changing its identity. The design's answer is that **the bands share everything except the control block's contents**:

| Shared in all bands | No-tools band (1–8) | Filters band (9–24) | Full shop (≥25) |
|---|---|---|---|
| Header + contact block (§§3–4), About, reviews panel, section gap 32px, H2 treatment (§5.2), count-line dress, card list (§9), pagination, claim line | Heading → count line at the shipped 4px caption step → list at 12px. **The page is today's page with the heading's words changed** | Heading → control block at 16px (filters, then sort) → applied row when active → count line → list | Identical to the filters band, with the search group (§6.2) at the top of the block |

- **Why the no-tools page does not look sparse.** Sparseness is a property of empty *frames* — a page looks unfinished when it shows the mountings of absent things. This page shows none: no disabled search, no greyed strip, no "tools coming soon" slot (§6.1's gap-stack is the whole mechanism — the block is absent, not emptied). What remains is a headed list of up to eight tall cards under an identity header with About and (often) a reviews panel — the same visual weight as today's shipped page, which nobody reads as a fragment. The shop framing at this size is carried by the heading's words and the header's completeness, which is proportionate: an eight-listing shop *is* its keeper's page with stock on it.
- **Why the tooled bands do not look bolted-on.** Every tool is a shipped component in its shipped dress (§§6–7): the search field is the site's search field, the strips are the browse strips, the chips are the site's chips, the legends are the site's eyebrows. A bolted-on look comes from a second design language arriving mid-page; here the catalog section's tools and the variety page's tools are one language, learned once (Nadia §0.1) — a visitor who has filtered `/variety` already knows this shop's controls before seeing them.
- **Band transitions.** A shop crossing 8→9 gains a control block between its heading and its count line; crossing 24→25 gains the search group at the block's top, with the filter groups keeping their order and relative spacing. Nothing else on the page moves, changes dress, or changes words (the count line's position rule is §7.3's, by band). The heading, header, and cards are band-invariant — identity is stable, density is the variable. No hysteresis treatment is designed, per Nadia §8.2.3: the change between visits is a data fact, rendered plainly.
- **Discrimination inside the bands** (§6.3) is the second density variable: a 30-listing single-season shop shows fewer strips than a 30-listing mixed shop. The same gap-stack argument covers it — the block composes from the groups that discriminate, at the same gaps, and a one-strip block is complete in the same way a one-row contact block is (§4.3). The two absence systems rhyme deliberately: *present iff it earns its place, complete at every count.*

**Control-block height, stated honestly.** At the top of the filters band a shop can present four discriminating groups + sort: five labeled strips ≈ 5 × (18px legend + 4px gap + 56px strip) + gaps ≈ 400px of tools before the first card on a phone. That is the contract's cost (Nadia §8.1's scan-failure math earns the tools at 9 listings), and no visual treatment in this seat's power removes it without changing behavior — collapsing or wrapping strips is behavior, and it is Nadia's to rule, not mine to style around. §18 PB-M6 carries the observation to Dustin with the mitigation this design does apply: the block's rhythm is tight (12px inter-group steps, no decorative separation), so the tools read as one compact instrument, not five stacked panels.

---

## 9. The results region — the shipped card in its shop context (scope item 2)

### 9.1 What does not change

The Quiet Ledger card (`ListingRow`, `context="seller"`) is byte-identical (Nadia §12, SH-10): artwork rail shown whole at its shipped geometry, variety heading, crop subline, stock dot + word + checked date, packet sizes, stem rule, footer with "Report a problem" and the sage "Visit shop →" pill through `/go/{id}`. Its internal tokens (`color.listing`, `color.visit`, `color.stem-rule`, `shadow.listing-raised` / `shadow.listing-flat`, its off-scale component spacings) are its own and are not re-specified, re-derived, or "harmonized" here. Sold-out cards keep their stepped-down dress (paper ground, outline-only pill that still works) — a shop's honesty about stock is carried by the cards, and the page adds no dimming, grouping, or separation of its own (Nadia §9.4).

### 9.2 Context: spacing, grouping, motion

- **List geometry, shipped:** a vertical stack at phone width, `gap: 12px` (`gap-3`), each item full-height in its row; at `lg` (1024px) a two-column grid with the same 12px gap — the card's width halves, its internal layout is the card's own business. The shop changes none of this.
- **Grouping:** the list is one group under the count line — 12px from the line (or notice) to the first card, 12px between cards, and the pagination's shipped spacing below the last. No sub-grouping by crop, season, or availability is introduced at any band or under any sort: ordering is the sort control's job (§6.4), and a visual sub-group (headings, rules, ground changes mid-list) would be a second, uncontracted ordering claim.
- **The cascade-in motion, in context:** on a visitor-initiated in-place change, the incoming list takes the shipped `.listing-swap` treatment — `listing-item-in` keyframes (opacity 0→1, translateY 6px→0), `duration.filter-item` 220ms with `ease.filter-settle`, stagger 30ms per item capped at 120ms from the fifth item on (total 340ms worst case) — drawn over the final layout, opacity and transform only, never height, so the frame holds while the change registers. It applies **only** after a visitor-initiated filter/search/sort change, never on first load, never on pagination navigation, and never under `prefers-reduced-motion` (the shipped media rule removes it entirely). An empty state (§10) entering the region takes the same single-item treatment (`p.listing-swap` precedent in the shipped CSS) so a narrowing to zero and a narrowing to three feel like the same kind of event.
- **No skeletons, no spinners, no busy dress** in the region for in-place changes (Nadia §4): the set is on the page, updates land inside the feedback budgets, and the prior results stand until the new ones replace them in the same frame's computation. Page-load skeletons are the route's existing business and are unchanged.
- **Layout stability:** the control block, applied row, and count line are outside the swapped region; a change swaps the list (and the count line's text) and nothing else. The one accepted movement is the list's own height changing as its contents change — inherent to a results list, and the reason the region sits last in the section, with only pagination and the claim line below it.

### 9.3 Pagination in context

Unchanged component, unchanged behavior (Nadia §10.3): true navigation, parameters carried, bounds against the narrowed total. Visually it keeps its shipped spacing below the list in every state; under an empty state (§10) pagination is absent (there are no pages), and the empty block's bottom spacing (§10.6) closes the section instead.

---

## 10. Empty, depleted, and failure states — visual composition (scope item 4; Nadia §9)

### 10.0 The shared dress

Every state in this section renders **inside the results region**, in one shared dress, so a visitor learns it once: plain text on paper — **no card, no border, no ground, no icon, no illustration**. The reasoning is Iris's register discipline: these are *fact* states in a directory, not errors and not celebrations; the page's paper-and-ink register (the same one Tranche 2 §3.5 chose for the Protection notice's facts) is the register facts wear here. A boxed or tinted empty state would import the badge family's notice dress for a message that is not a notice, and a petal or warn tint would claim an alarm the situation does not carry. Composition per state: a **primary line** (ink, serif body 17px/1.6, 12.68:1), an optional **secondary line** 4px below it (muted, same size, 5.56:1), and — only where the state itself owns an action the applied row does not — an action row 16px below (§10.3's did-you-mean is a link inside its line, not a row). The states are announced through the count line's live region like any other result (Nadia §9 preamble); the count line reads "0 listings" above the filtered/searched states.

### 10.1 The empty shop (T = 0) — unchanged

Shipped rendering stands (Nadia §9.1): the `SELLER_NO_LISTINGS` line with its "Browse all varieties" link, under the shop heading, no count line, no tools. This design changes nothing — the line's existing muted dress is grandfathered as the state's shipped form, and §10.0's primary-line dress governs only the *new* states (§§10.2–10.3), recorded explicitly so the inconsistency is a decision: re-dressing a shipped state to match new siblings is a rendered change nobody commissioned, and the two dresses (muted paragraph vs ink primary line) never appear on the same page at the same time, because T = 0 excludes every tooled state.

### 10.2 Filtered to empty (Nadia §§5.7, 9.2)

- **Primary line** (slot CS-19): names the situation and the shop, ink on paper.
- **No secondary line, no action row.** The recovery — Clear All — is already offered in place by the applied row 12px above the region, in full chip dress, and focus lands on it when the producing action unmounted its control (Nadia §5.7's exception). Duplicating Clear All inside the state would put two identical 44px actions 30px apart, each claiming to be *the* recovery; the state's job is to say what happened, the row's job is to undo it. The composition is therefore one line, deliberately bare: message in the region, remedy in the row, nothing competing with either.
- The applied row and count line ("0 listings") stay in place above it — the state never appears under a bare heading.

### 10.3 Searched to empty (Nadia §6.5)

- **Primary line** (slot CS-20): names the query and the shop, ink on paper.
- **Secondary line, only when filters are also active** (slot CS-21): states the combined scope, muted, 4px below the primary. When no filters are active the line is absent — the composition closes over it (§6.1's rule, applied to text).
- **Did-you-mean line, only when a candidate qualifies** (slot CS-22): 8px below the last line above, muted text with the candidate as a link (link on paper 7.02:1, underlined, shipped offset). The link is a suggestion, not a recovery — the recoveries (clear the search; clear search and filters) already live in the applied row as the search remover and Clear All, one tap each, and are not duplicated here for the same reason as §10.2. The link's inline size is the one sub-44px target this design admits, and it is admitted on the shipped precedent of the zero-shop state's inline "Browse all varieties" link: a tertiary suggestion inside a sentence, with both primary recoveries present at full target size directly above. Ada's pass may overrule this; if she does, the fix is hers to prescribe and this design accepts it in advance (§19).
- Quotes around the query in these lines are typographic (curly) quotes, per the site's shipped copy convention (cf. the applied row's search remover, Nadia §5.5) — a Thea detail, recorded in §13.

### 10.4 The all-sold-out shop — the notice line (Nadia §9.4)

When T > 0 and nothing is orderable, one notice line renders **directly under the count line**, 4px below it, above results that render completely normally:

- **Dress:** serif body (17px/1.6, the count line's own type), `color.ink-soft` on paper (8.58:1) — one value step darker than the count line's muted. The step is the whole design: the notice must be *findable* next to the line it follows (it changes how every card below is read), but it is a fact, not an alert, so it takes no icon, no ground, no border, no warn or petal color, and no weight change. Two adjacent fact lines in neighboring value steps, separated by 4px, read as a statement and its consequence — which is what they are (slots CS-17 for the count line's forms, CS-23 for the notice).
- It renders once, as a property of the shop (computed on T), never re-triggered or duplicated by filtering or searching (Nadia §9.4), and it takes no live region of its own — it is present in the server render, not announced as a change.

### 10.5 Failure of an in-place update (Nadia §9.5)

- **Dress:** one line placed **with the applied row** — directly below it when a row is present, in the row's slot (12px below the control block) when none is — sans 14px (the tool layer's size, matching the row it accompanies), `color.warn` on paper (5.06:1, past 4.5:1 for 14px text), regular weight. Warn is the palette's attention register and this is its correct, narrow job: a transient "that didn't apply," not a state of the data. The line carries `role="alert"` per Nadia; visually it is a line, not a banner — no warn-50 ground, no border — because the prior results standing unchanged below it are most of the message, and a banner would shout over them.
- The Tranche 3.3 field-error glyph (`FieldErrorIcon`, 16px, warn) is **not** borrowed here: that glyph belongs to the field group it marks, and this line marks no field. Text alone, per the §10.0 register. If Ada's pass wants a redundant channel, the glyph question reopens with her — recorded as an open adjacency, not a silent borrowing.
- Prior results, counts, and URL stand (Nadia §9.5); nothing in the region changes dress while the line is present, and the line clears on the next successful change without ceremony.

### 10.6 Bottom spacing of states

An empty or failure state is the region's last content: below its last line, the section closes with the claim line at its shipped `mt-8` (32px) — pagination absent (§9.3). The 32px closing step keeps a one-line state from leaving the page looking amputated: heading, tools, count, one honest line, then the page's normal closing rhythm.

---

## 11. Breakpoints and platform stress

Phone-first throughout; iPad is a wider phone for this public surface (the admin iPad-first rule does not apply), and desktop is a proper desktop layout, not a stretched phone.

| Width | What changes (all shipped behavior unless noted) |
|---|---|
| 320px (reflow floor) | Header stacks; definition list single-column; StatePlate centered below at 280px; contact rows full-width (the 32rem cap is inert); search label wraps if the name is long; strips swipe; applied row wraps; cards single-column. No horizontal scroll; focus rings fit inside the container's padding |
| 390px (design width) | As 320px with the plate at 280px; roughly three to four cards per screenful (Nadia §8.1's scan math) |
| 640px (`sm`) | Header becomes the flex row: text column + StatePlate beside (300px, `mt-1`); definition list goes three-column; contact rows cap at 32rem inside the text column |
| 744px (iPad portrait) | Public layout as at 640px with more air; the two-column card grid has **not** yet engaged (it is `lg`), so cards stay single-column at reading measure — correct: an iPad-width single column of Quiet Ledger cards is a ledger, and the design does not force the grid early |
| 1024px (`lg`) | Card list becomes two-column (`lg:grid-cols-2`, 12px gap) |
| 1280px (desktop) | Container caps at 72rem (`container-page`); StatePlate 320px; About keeps its shipped `max-w-3xl` measure; the catalog section uses the full container width (it is a list, not prose — the 65ch prose cap of Tranche 5.2 governs prose surfaces, and the count/notice/empty lines are fact lines whose length is bounded by their content, recorded here so the exemption is stated, not assumed) |

**Text at 200% / text-spacing overrides (WCAG 1.4.4 / 1.4.12):** every element in this design grows — rows and fields state minimum heights, chips are content-width inside scrolling strips, the applied row and badge row wrap, headings wrap with `balance`, the definition list stacks. No fixed-height container exists in the header, block, or states. The one clipping risk the system already owns — a focused chip's ring inside a strip — is Item 3.1-F's shipped fix (§6.3), inherited here.
**Forced colors:** all state in this design lives in real borders (chips, field, badge), real text, and weight — grounds may be remapped by the OS and every distinction survives (selected = border + weight + `aria-current`; contact channels = label + visible value; failure = text). No state is carried by a shadow anywhere in this design (§2.2).
**Reduced motion:** the cascade (§9.2) is removed by the shipped media rule; chip/button color transitions collapse under the global rule; nothing else in this design moves.
**PWA / lifecycle:** no new route, shell, or stored state (Nadia §10.5); the design's states are all URL states, so kill-and-restore and tab-switch land on the view the URL names.

---

## 12. Contrast table — every pair this design introduces or newly composes

Method: §1. Floors: 4.5:1 normal text, 3:1 large text and non-text (component boundaries, meaningful graphics, focus) per WCAG 2.2 AA 1.4.3 / 1.4.11. Values are unrounded in computation, shown to two decimals; **no value is rounded into a pass**. Pairs wholly inside shipped components (the card's interior, the badge's interior, the StatePlate) are the Tranche 2 record's and are not re-tabled here except where the shop newly composes them against the page ground.

| # | Foreground | Background | Ratio | Floor | Verdict |
|---|---|---|---|---|---|
| C-1 | White `#FFFFFF` on `color.leaf` — primary button text (resting) | leaf | 10.60:1 | 4.5 | ✓ |
| C-2 | White on `color.leaf-600` — primary button text (hover) | leaf-600 | 6.30:1 | 4.5 | ✓ |
| C-3 | `color.ink-soft` on `color.paper` — contact-row label | paper | 8.58:1 | 4.5 | ✓ |
| C-4 | `color.link` on `color.paper` — contact-row value; did-you-mean link; state link | paper | 7.02:1 | 4.5 | ✓ |
| C-5 | `color.leaf` on `color.paper` — contact-row value / body links (hover) | paper | 9.42:1 | 4.5 | ✓ |
| C-6 | `color.leaf-600` on `color.paper` — contact-row icons (graphic) | paper | 5.60:1 | 3.0 | ✓ |
| C-7 | `color.muted` on `color.paper` — "No website" line, disclosure, definition terms, count line, eyebrow legends | paper | 5.56:1 | 4.5 | ✓ |
| C-8 | `color.ink` on `color.paper` — empty-state primary lines, definition values, H2 | paper | 12.68:1 | 4.5 | ✓ |
| C-9 | `color.ink-soft` on `color.paper` — all-sold-out notice | paper | 8.58:1 | 4.5 | ✓ |
| C-10 | `color.warn` on `color.paper` — in-place failure line (14px) | paper | 5.06:1 | 4.5 | ✓ |
| C-11 | `color.ink` on `color.surface` — search input text; chip text at rest | surface | 14.02:1 | 4.5 | ✓ |
| C-12 | `color.muted` on `color.surface` — search placeholder; chip count numeral at rest | surface | 6.15:1 | 4.5 | ✓ |
| C-13 | `color.line-strong` on `color.surface` — chip border vs own ground; search-field border vs own ground | surface | 3.72:1 | 3.0 | ✓ |
| C-14 | `color.line-strong` on `color.paper` — search-field border and strip chevron border vs the page ground they sit on | paper | 3.36:1 | 3.0 | ✓ |
| C-15 | `color.leaf` on `color.surface` — search-field border in focus vs own ground | surface | 10.42:1 | 3.0 | ✓ |
| C-16 | `color.leaf-600` on `color.surface` — search icon (graphic) | surface | 6.19:1 | 3.0 | ✓ |
| C-17 | `color.leaf` on `color.leaf-50` — selected chip text; Small Farm badge text (header composition) | leaf-50 | 8.60:1 | 4.5 | ✓ |
| C-18 | `color.ink` on `color.leaf-50` — chip text under hover | leaf-50 | 11.57:1 | 4.5 | ✓ |
| C-19 | `color.muted` on `color.leaf-50` — chip count numeral under hover/selected | leaf-50 | 5.08:1 | 4.5 | ✓ |
| C-20 | `color.leaf-600` on `color.leaf-50` — chip border under hover vs own ground | leaf-50 | 5.11:1 | 3.0 | ✓ |
| C-21 | `color.focus` on `color.paper` — focus ring vs page ground | paper | 7.39:1 | 3.0 | ✓ |
| C-22 | `color.focus` on `color.surface` — focus ring vs field/chip ground | surface | 8.17:1 | 3.0 | ✓ |
| C-23 | `color.focus` on `color.leaf-50` — focus ring on a selected/hovered chip | leaf-50 | 6.75:1 | 3.0 | ✓ |
| C-24 | `color.leaf` on `color.paper` — H1 (large text; floor shown is the stricter normal-text value) | paper | 9.42:1 | 4.5 | ✓ |

**Summary for Ada:** 24 pairs, all computed from shipped hex values, all passing their floors with margin — the tightest text pair is the failure line (C-10, 5.06:1) and the tightest boundary pair is `line-strong` on paper (C-14, 3.36:1, a shipped Tranche 1.3 value this design inherits, not sets). No new color, alpha, or blend is introduced anywhere in this design, so there is no pair in this table that Ada has not already passed in substance on another surface; her pass on this design should be a recomputation exercise, and §19 writes it that way.

---

## 13. Collaborator rulings applied — Iris (color) and Thea (typography)

### 13.1 Iris — feeling and meaning (her seat: feeling only; Ada's floor is §12)

- **Feeling target and how the palette serves it.** The directory's read is *an illustrated seed catalog: quiet, warm, unhurried, trustworthy* — a light value key (paper L* high), a gentle chroma budget, a warm temperature bias, hues borrowed from garden objects. The shop design spends nothing outside that budget: the page's chroma lives exactly where it already lives (the leaf button, the badge tint, the cards' artwork rails and swatch dots), and every new element is paper, ink, or a single leaf step. A "shop" treatment that raised chroma to signal commerce — a filled banner, a tinted tool panel — would break the catalog read for a signal the heading's words already send. *Built to read as the same catalog, keeping shop hours* — an association claim, graded **moderate** on the evidence pattern of the feeling section of Iris's playbook (congruence and pleasantness drive retail-environment response; no behavioral guarantee is claimed).
- **Value and chroma before hue (her evidence-ranked order).** Every distinction this design makes is made in value first: notice darker than count line (ink-soft vs muted, §10.4), contact label quieter than its value (ink-soft vs link), primary line darker than secondary (ink vs muted). No distinction anywhere in the design is carried by hue alone.
- **60-30-10 proportion.** Paper and its neutrals own the page (~60+), ink text supports (~30), leaf is the accent (~10, and in the header nearer 5: one button). The contact rows were kept unbuttoned (§4.2) precisely to defend this proportion.
- **Red-family audit (her standing rule).** Petal — the palette's red family — appears on this page only where it already means *sold out*, inside the shipped cards. No new element uses it: not the failure line (warn, §10.5), not any empty state, not the contact block. The signal stays single-meaning.
- **Green credited honestly.** The leaf register borrows the garden association; this design claims no restorative or calming *effect* for it — the park is real, the page is a catalog, and the claim made is association fit only.
- **Simultaneous-contrast check.** The new compositions were judged in place, not as chips: contact rows sit on paper below a leaf button (the button's green makes the rows' ink-soft label read marginally cooler — acceptable, the label's value step, not its hue, carries it); the search field's surface ground sits on paper (a near-white on cream — the 2px border, not the ground step, is what separates them, which is why the border is 2px and `line-strong`, §6.2); selected chips (leaf-50) sit among resting chips (surface) on paper — the tint step plus border plus weight separates them, and §12 C-17…C-20 compute the pairs in that actual arrangement.

### 13.2 Thea — type (her seat: every type value; this design invents none)

- **Roles before sizes.** The page's roles are the shipped ones: display headings (H1 30/36, shop H2 24, About H2 20 — a decisive step between each pair, per her hierarchy rule), serif body (17/1.6) for reading and fact lines, eyebrow (12 bold uppercase, +0.09em — her caps-with-tracking rule) for control legends, sans tool text for chips (14/1.5), fields, buttons, and contact rows (16/1.5). No role was added; the contact row is set in the *definition list's* label/value relationship (§4.2), and the failure line in the *tool layer's* 14px, each borrowed from the nearest existing role rather than minted.
- **Sentence case** for the shop heading and all new lines (proper nouns excepted by their nature); the eyebrow legends' uppercase is the system's existing label exception, with its tracking, unchanged.
- **Tabular figures where numbers update in place** (§7.4): chip counts and the count line. Lining figures in interfaces — the shipped fonts' defaults — stand.
- **Curly quotes** around the query in the searched-empty and remover slots (§10.3), matching the site's shipped copy convention; apostrophe in the possessive heading is the typographic apostrophe (slot CS-05 carries the obligation for Wren).
- **Measure.** Reading prose keeps its shipped measures (About `max-w-3xl`); fact lines (count, notice, empty) are single short lines whose measure is their content (§11's desktop note). Headings wrap with `text-wrap: balance` (shipped base layer) — line breaks fall at phrase boundaries, never mid-name where avoidable.
- **Resize truth.** Nothing in this design is set in a fixed-height box; at 200% and under the 1.4.12 spacing overrides, rows grow, strips scroll, rows of chips wrap (§11). Type is real text everywhere — no text is baked into any artwork, and none is introduced as an image (the StatePlate's alt is its flower's name, shipped).

---

## 14. Copy-slot inventory for Wren — complete (scope requirement)

Every line of words this design needs, enumerated. **This design finalizes no words.** Each slot states: where it renders, the obligation the words must carry (Nadia's contract), and its status. Slots marked *inherited* are shipped or model-verbatim text listed so the pass is complete, not because new words are wanted. Slots marked *closed* are decisions that **no** words are wanted, recorded so they are not re-opened downstream.

| ID | Slot | Where | Obligation (the contract the words must meet) | Status |
|---|---|---|---|---|
| CS-01 | Website button label | Contact block, primary button | shows the host (visible destination before the click, Nadia §3.5.1); label as ruled in COPY §1 | **Ruled — COPY §1 (OQ-2 closed)** — rules with CS-02/CS-03 as one set |
| CS-02 | Phone row label | Contact block, phone row | Names the channel as the seller's customer service (the concept is fixed; the words are Wren's); composes with the visible number as one link whose purpose is determinable from the row (Nadia §3.5.2) | New |
| CS-03 | Email row label | Contact block, email row | Same obligation as CS-02, for the address; same wording family as CS-02 (the two labels must read as a set) | New |
| CS-04 | Phone/email absence lines | Contact block | **No words.** No absence line, summary line, or "contact unavailable" copy is designed or permitted at any coverage level (Nadia §3.5.3, argued there) | **Closed** |
| CS-05 | Shop heading | Catalog section H2 | "{name}'s shop" — carries the seller's name and the word "shop"; possessive handling for names ending in "s" is Wren's to rule; typographic apostrophe (§13.2) | New (pattern fixed by Nadia §3.1) |
| CS-06 | Search field label | Control block, above the field (visible `.eyebrow`) | Names the scope in the seller's name before any typing — "Search {name}'s shop" is the contract's example; must not read as a directory search | New |
| CS-07 | Search placeholder | Inside the field | Exemplifies what to type (variety or flower name); must **not** promise Latin names or aliases — the in-shop matcher does not search them (Nadia §6.3) | New |
| CS-08 | Search submit button | Inside the field | The site's search verb ("Search" is the SearchBox's shipped word) | Inherited pattern |
| CS-09 | Filter group legends ×4 | Control block strips | "Season" · "Sowing method" · "Life cycle" · "Hue" — `BrowseFilters` verbatim (Nadia §5.1) | Inherited — no new words |
| CS-10 | Sort legend | Control block, sort group | "Sort" (Tranche 3 §5.2's shipped pattern) | Inherited pattern |
| CS-11 | Sort options ×3 | Sort group chips | "Name A–Z" · "In stock first" · "Recently checked" (Nadia §7.2 fixes the three and their order; Wren confirms) | Pattern fixed by Nadia |
| CS-12 | Applied remover labels | Applied row chips | "{Group}: {Value}" per group; one per selected hue; search remover "Search: “{q}”" with curly quotes; accessible names "Remove the {Group} filter, {Value}" / "Clear the search for {q}" (Nadia §5.5 fixes the patterns) | Pattern fixed by Nadia |
| CS-13 | Clear All label — two variants | Applied row, final chip | "Clear all filters" with filters only; "Clear search and filters" when a query is also active (Nadia §5.5; Wren confirms final wording — the behavior, one action clearing both, is the contract) | Pattern fixed by Nadia |
| CS-14 | Count line — at rest | Above results | "{N} listings" (+ "· page {p} of {pages}" when paginated) — today's shipped text | Inherited |
| CS-15 | Count line — sorted forms ×3 | Above results | States the narrowed total and the true order: A–Z / in stock first / most recently checked first (Nadia §7.3 gives the forms; the line must never claim an order the list is not in) | Pattern fixed by Nadia |
| CS-16 | Count line — searched form | Above results | "{N} matches for “{q}”, best match first." (Nadia §7.3; curly quotes; the filtered-scope fact rides the applied row, not this line) | Pattern fixed by Nadia |
| CS-17 | Count line — filtered forms | Above results | The narrowed total replaces N in CS-14/CS-15's forms; no separate "filtered" wording is designed (the applied row carries that fact) | Pattern fixed by Nadia |
| CS-18 | Chip count unit (screen reader) | Inside filter chips | The unit word is "listings" — "{count} listings" announced per option (Nadia §5.3); the visible numeral carries no unit | Fixed by Nadia |
| CS-19 | Filtered-empty primary line | Results region (§10.2) | Names the situation and the shop — "No listings in {name}'s shop match those filters." is Nadia §9.2's voice; Wren confirms | Pattern fixed by Nadia |
| CS-20 | Searched-empty primary line | Results region (§10.3) | Names the query and the shop — "No matches for “{q}” in {name}'s shop." (Nadia §6.5) | Pattern fixed by Nadia |
| CS-21 | Searched-empty combined-scope line | Results region, only when filters are active | States the filters' part — "…with the current filters applied." (Nadia §6.5) | Pattern fixed by Nadia |
| CS-22 | Did-you-mean line | Results region, only when a candidate qualifies | Offers the one in-shop candidate as a link — "Did you mean {name}?" pattern (Tranche 3 §5.3.4's bounded rule, scoped in-shop by Nadia §6.5) | Pattern fixed by Nadia |
| CS-23 | All-sold-out notice line | Under the count line (§10.4) | Names the seller, states the fact, points at the checked dates the cards show — "{name} has nothing in stock right now — listings are shown with their last checked dates." is Nadia §9.4's form; Wren confirms | Pattern fixed by Nadia |
| CS-24 | In-place failure line | With the applied row (§10.5) | States the failure and the standing truth — "That didn't apply — you're still seeing the previous results. Try again." is Nadia §9.5's form; Wren confirms | Pattern fixed by Nadia |
| CS-25 | Zero-shop line + link | Results region (§10.1) | Shipped `SELLER_NO_LISTINGS` + "Browse all varieties" — unchanged | Inherited — closed |
| CS-26 | "No website on file for this seller." | Contact block, no-website cases | Shipped line, kept verbatim (Nadia §3.5.3) | Inherited — closed |
| CS-27 | Strip chevron accessible names | FilterStrip / sort strip | "Scroll {legend} left/right" — the shipped pattern; the sort group's legend (CS-10) feeds it, no new words | Inherited pattern |
| CS-28 | New-tab screen-reader suffix (website button) | Contact block | Shipped "(opens the seller's site in a new tab)" on `OutboundLink` — unchanged by any CS-01 rewording | Inherited — closed |

**Sequencing note for the coordinator:** CS-01…CS-03 are one commission (Nadia §3.5.4) and should be ruled before the build brief lifts, so the block ships with its final labels (§18, PB-M2). The remaining new slots (CS-05…CS-08) ride Wren's normal pass on Nadia's flagged confirmations; none of them blocks this design.

---

## 15. Flags for Elena — art direction

- **No new artwork is required by this design. None.** No banner, hero, cover, spot illustration, or motif is specified, requested, or left as a placeholder for one. The shop framing is naming, structure, tools, and rhythm (§0) — if Dustin later commissions a visual storefront treatment beyond this composition, that is a separate commission with its own gate (Nadia PB-S2), and it would start from Elena, not from a gap in this document.
- **Existing art is untouched and unmoved:** the StatePlate keeps its placement, sizes (280/300/320px), `.art-frame` handling, and whole-image rule (§3.1); the cards' artwork rails are inside the shipped card (§9.1); the divider-stem motif exists in the system and is **deliberately not used** (§5.2) — no motif work, no new stem variant, no shop variant of any existing art.
- **The two contact glyphs (§4.4) are interface icons, not artwork.** They are specified by this seat to the icon family's rules and drawn at build; Elena is not being handed them. They are flagged here only so the absence of an art request reads as complete: if Quinn's family-hand check fails a glyph, the fallback is no glyph (§4.4), not an illustration.
- **No typography is baked into any artwork** — trivially, since there is no new artwork; stated for the standing rule's checklist.

---

## 16. Token proposals — flagged for the register

**No new system token and no new raw value is proposed.** No color, radius, shadow, spacing-step, or type-step value enters the system through this design. Two **component-token groups** are proposed for `tokens.json`'s register, composed entirely from existing system tokens — they name assemblies the shop build will implement, so the assemblies have one source of truth instead of living as class strings (the Tranche 2 §3.3 / §4 discipline, applied to the two genuinely new assemblies in this design):

| Proposed token | Value | Justification |
|---|---|---|
| `component.contact.row.min-height` | `{size.target}` (44px) | Nadia §3.5.2's house-target ruling for the rows, named where the rows are defined |
| `component.contact.row.gap` | `{space.8}` (8px) | Icon–label–value separation inside the row (§4.2) |
| `component.contact.row.icon-size` | 20px | The one value not already a component token somewhere: the icon family's live-area size, on the 4px spacing scale. 24px (intrinsic) overwhelms the 16px row text; 16px (ProtectionIcon's size) under-reads for a primary channel mark. Flagged individually so the register decision is visible |
| `component.contact.stack.gap-after-primary` | `{space.8}` (8px) | Button → first row (§4.3) |
| `component.contact.stack.gap-after-nowebsite` | `{space.4}` (4px) | "No website" line → first row (§4.3) |
| `component.shop-search.field.height` | `{space.48}` (48px) | The SearchBox `md` field height, named for the shop instance (§6.2) |
| `component.shop-search.field.radius` | `{radius.search}` (14px) | Alias, recorded so the shop field's radius choice (§2.2) is a token reference, not a class decision |
| `component.shop-search.field.border-width` | 2px | The SearchBox's shipped border width, named for this component; no other field in the design uses it |

Everything else in this design references existing tokens directly (§2) or ships inside existing components (`.chip-filter`, `.btn`, `.eyebrow`, `BrowseFilters`, `FilterStrip`). If the register declines the two groups, the design is unchanged — the values stand, only their naming home differs — which is the test of a component token proposed honestly.

---

## 17. Rendered-difference map (against Nadia's register)

This design produces exactly the visual consequences of Nadia's S-1…S-12 and no others:

| Nadia ID | Its visual consequence, as designed here |
|---|---|
| S-1 heading | Same H2 dress, new words (§5.2) |
| S-2 search | §6.2's field, bands per §8 |
| S-3 filters + sort | §§6.3–6.4, shipped components in shop context |
| S-4 count line | Same dress, new words by state; becomes the live region (§7.3) |
| S-5 applied row | §7.2 |
| S-6 chip counts | §7.4 |
| S-7 in-place updates | §9.2's context and motion; no repaint of header/About/panel |
| S-8 empty states | §§10.2–10.3, 10.5 |
| S-9 sold-out notice | §10.4 |
| S-10 payload | No visual consequence |
| S-11 metadata | No visual consequence |
| S-12 contact block | §4 — the block is the shipped button slot plus rows beneath it; rows 4 and 7 of the coverage matrix render **identically to today** |

Header invariance (Nadia SH-1) holds with the single S-12 exception: eyebrow, H1, badge row, definition list (including A4), disclosure, and StatePlate are class-for-class and pixel-for-pixel the shipped header.

---

## 18. Pushback — for Hue to carry to Dustin

Nothing below is silently deviated from: where a pushback touches a section, the section designs Nadia's contract as written and the pushback records the cost with its reasoning.

- **PB-M1 — The sort group's disappearance while a query is active is the page's one real layout shift, and it sits in tension with the in-place standard.** Nadia §7.2 removes the sort group while `q` is active (relevance owns the order — a sound ruling, mirroring `/search`). The visual cost is mine to name: a whole labeled group (≈78px) vanishes from the control block on the first settled keystrokes and returns when the query clears, moving everything below it. The in-place visual standard this seat holds (stable frame, no jump) is met *inside* the results region and violated, mildly and unavoidably, at the block's bottom edge. Mitigations applied in this design: the gap-stack closes cleanly (§6.1), no other control changes place relative to its neighbors, and the count line re-states the order so the change is explained at the moment it happens. I design it as ruled — but if Dustin ever weighs a shop-specific exception, the honest alternative is keeping the group visible with its chips inert *and a stated reason in the legend line*, a pattern the site does not currently use and Nadia rejected for that reason. Recorded so the trade is his to see, not buried in a build.
- **PB-M2 — The contact block should not ship with the old button label if Wren's pass slips.** Nadia §16 OQ-2 routes the "Visit {name}" / "Visit shop →" collision into Wren's block-label pass (§14, CS-01). Visually the two doors are already separated by dress (§4.2), so this is not a design defect — it is a sequencing risk: S-12 is the commission's most visible change, and shipping it with the one label known to collide would spend the launch on the confusion the spec already diagnosed. My recommendation: CS-01…CS-03 are ruled *before* the build brief lifts (Nadia §3.5.4's own sequencing instinct), and the build does not proceed on placeholder labels.
- **PB-M3 — The count line's two positions (caption step in the no-tools band, results step in the tooled bands) is a deliberate inconsistency; the alternative is worse, and I record both.** One-position-everywhere would either (a) put the tooled bands' line 4px under the heading — above the tools it counts, which is false composition, or (b) move the no-tools band's line 12px below its heading with nothing between, a gap with no content to justify it on the page that must not look sparse (§8). The line's *dress* is identical in every band; only its attachment differs, and attachment follows what the line is attached *to* in each band. If Quinn's drives show visitors reading the tooled line as belonging to the tools rather than the results, the fix is spacing, not words — flagged here so the question is asked at the gate with this reasoning on record.
- **PB-M4 — The contact rows' 32rem width cap at `sm` and up is this seat's call inside Nadia's "full-row link," flagged for her confirmation.** Nadia §3.5.2 fixes a full-row link at the house target height. On a desktop header the text column can run past 500px; a literal edge-to-edge row is a wide, mostly empty tap target whose empty right half reads as a table cell missing its content. The cap keeps the target generous (32rem × 44px, far past any minimum) while keeping the row reading as a contact list under the button. The phone — the primary surface — is unaffected (the cap never engages). If Nadia intended literal full-column width, the difference is one utility class; I ask her to confirm rather than discover it in review.
- **PB-M5 — Recorded as rejected, not pushed: a stem motif or rule dressing for the shop heading.** The system owns the motif and it would be the cheapest way to make the section "feel designed." It is rejected in §5.2 for Nadia's register reason and a visual one: a divider above the catalog alone re-draws the page's structure, demoting About and the reviews panel to pre-shop matter. The shop is made by naming, structure, and tools; this design holds that line even where a flourish was available. Recorded so Dustin hears that the plainness of §5.2 is a position, not an oversight.

- **PB-M6 — Control-block height at the top of the filters band is the design's largest visible cost, and no visual treatment in my power removes it.** A 9–24-listing shop with four discriminating groups presents five labeled strips (≈400px, §8) before its first card. Nadia's scan-failure math earns those tools, and collapsing, wrapping, or accordioning strips is behavior — hers to rule, never mine to style around. What this design does is rhythm: tight 12px steps, no panels, no decoration, so the block reads as one compact instrument. I flag it so Dustin sees the cost where it lands — on the smallest tooled shops — and so Quinn's gate drives a 9-listing, four-group fixture alongside Nadia's §13 test shops, rather than discovering the density on GeoSeed alone, where 179 listings justify any amount of chrome.

---

## 19. Verification checklist (this seat's, run before handoff)

- [x] Structure unchanged from Nadia's spec — flows, order, content, and the S-register identical; only the visual layer is this document's (§17)
- [x] Every spacing, radius, color, shadow, motion, and type value traces to a named shipped token (§2); the only new names are §16's component tokens, flagged for the register, composed of existing values
- [x] All component states drawn: contact rows (rest/hover/focus; no others exist), search field (rest/focus; hover/filled/disabled/error ruled out with reasons, §6.2), chips (rest/hover/selected/focus, inherited §6.3), primary button (rest/hover, shipped), empty/failure/notice states (§10)
- [x] Hierarchy passes the squint test and the grayscale test at every breakpoint (§3.2, §11) — argued from values and composition; **not** render-tested (see below)
- [x] Contrast computed for every new foreground/background pair, unrounded, floors stated (§12 — 24 pairs, all pass)
- [x] In-place changes meet the visual standard: instant state, stable frame, local change only, controls keep size and place (§§6.3, 9.2); the one contract-inherent exception named (PB-M1)
- [x] Icons one family, one stroke language, sized by optical context (§4.4); critical actions labeled — contact rows carry label + visible destination, never icon alone
- [x] Artwork: none requested, none moved; StatePlate handling untouched (§15); no hotlinked anything
- [x] Iris's and Thea's rulings recorded where applied (§13); Ada's floor stated as computed pairs for her recomputation (§12)
- [x] Copy slots enumerated completely for Wren, including the closed slots (§14)
- [ ] **Deliberately not checked:** rendered verification at real viewports. This is a design document; no build exists to measure. Quinn's gate on the *build* owns the rendered drives (Nadia §13 SH-1…SH-14, with §4.3's matrix and §12's table as the visual inputs), and Ada's floor pass on the assembled design follows this document per the commission's sequence. Any claim in this document about rendered appearance is a specification to be verified there, not a verification reported here.

---

*— Mina, UI Design. Collaborators' positions applied: Nadia (the whole structure — this design dresses her SPEC and re-decides none of it; PB-M4 asks her one confirmation), Iris (feeling and meaning — §13.1), Thea (type — §13.2), Ada (floors as computed pairs — §12; her pass follows and may overrule §10.3's one admitted sub-target link, accepted in advance), Wren (slots enumerated — §14; no copy finalized here), Elena (no art requested — §15). Evidence: `origin/main` via `git show` (seller page, globals.css, BrowseFilters, FilterStrip, SearchBox, OutboundLink, StatePlate, icons, tokens.json), Tranche 2 SPEC (system of record), Tranche 3 SPEC §§2/5.2/5.3 + 3.1-F finish, Tranche 3.3 field-states design. No code was written or changed by this design.*
