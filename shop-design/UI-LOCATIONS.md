# Seller-as-Shop — UI Design Delta: The Locations Area

**Seat:** Mina, UI Design (author). **Delta to:** my delivered UI design (`shop-design/UI-DESIGN.md`) — this document designs only the visual composition of the Locations area; everything it does not mention stands exactly as the base design rules it.
**Date:** 2026-11-22 · **Status:** Design only. No code, no build.
**Sources ruled from:** Nadia's delta SPEC (`shop-design/SPEC-LOCATIONS.md` — placement §4, contents §5, floors §6.3, the Item SI flag §7); Wren's ruled strings (`shop-design/COPY-LOCATIONS.md` — heading `{name}'s locations`; kind labels `Physical address` / `Warehouse address` / `Mailing address`; marker `Primary`; no intro line); Ada's semantics rulings (`shop-design/ADA-LOCATIONS.md` — L-A1…L-A6, landed while this pass was in progress and consumed here: her prescribed `<section>` / `<h2>` / `<ul>` / `<li>` structure is the structure this composition dresses, and her L-A5 no-links position is consistent with §5's Item SI ruling below); the base UI design's token basis (`UI-DESIGN.md` §2) and section system (§§3–5).
**House standards binding this delta:** the base design's, unchanged — phone-first, every surface a PWA, no new ground, border, shadow, radius, hue, or typeface enters the page (§0 of the base design); grouping by space before lines; absence composed, not apologized for.

---

## 0. Rulings at a glance

| # | Question | Ruling |
|---|---|---|
| L-U1 | Section dress | **Unboxed** — no card, ground, border, divider, or motif. The page's identity-section dress, exactly as About wears it (§2) |
| L-U2 | Gap above the section | **24px** (`mt-6`) — the header → About step, spent identically (§1) |
| L-U3 | Heading dress | The **About step**: display `text-xl` (20px) semibold, ink on paper — not the catalog's `text-2xl` (§3) |
| L-U4 | Measure | **`max-w-3xl`** — About's measure; the identity zone's one measure (§2) |
| L-U5 | Entry anatomy | Label line (kind label · `Primary` where it applies) 4px above the address lines; entries separated by **16px** of space, no rules (§4) |
| L-U6 | **Item SI — state outlines / links in entries** | **Text-only state names: no StateShape outline, no state link, on any entry, the primary's included.** A4 in the header stays the page's one state door (§5) |
| L-U7 | New tokens | **None** — no proposal, flagged or otherwise (§8) |

---

## 1. Placement in the page's composition (SPEC-LOCATIONS §4, dressed)

Nadia §4.1 fixes the position; this section fixes its spacing. When the area exists, the page's identity zone reads:

| Element | Gap above | Source of the step |
|---|---|---|
| Header (identity + contact block, disclosure line where present) | — | Base design §§3–4, unchanged in every class |
| **Locations area** | **24px** (`mt-6`) | The header → About step, spent identically |
| About | 24px (`mt-6`, its shipped class, unchanged) | Now measured from the Locations area instead of the header — SPEC-LOCATIONS §4.5's amendment, executed by changing nothing in About at all |
| "Reviews from Google" panel (where present) | shipped | Unchanged |
| Catalog section | 32px (`mt-8`, shipped) | Unchanged |

Three composition facts, stated because they decide arguments later:

- **The area is a sibling after the header, never an insertion into it** (SPEC-LOCATIONS §4.2). It does not extend the header's definition list, does not sit inside the header's `sm:flex` row, and never shares a line with the StatePlate. On desktop the section begins below the whole header block — text column and plate alike — at the container's left rail, where About also begins.
- **The 24px step is the identity-section step.** The page has exactly two section steps: 24px between identity matter (header → About today) and 32px for the turn from identity to catalog. Locations is identity matter (§4.3 of the delta SPEC extends the preservation rule to it by name), so it takes the 24px step on both sides. A 32px gap above it would promote a short address list to the catalog's rank; a 16px gap would bind it into the header it is ruled to sit outside.
- **Absence leaves no trace in the rhythm** (§6 below): when the area does not exist, About's shipped `mt-6` measures from the header exactly as today. The gap is a property of the following section, never a reserved slot above it — the same mechanism as the contact block's coverage matrix (base design §4.3).

## 2. Section composition — the identity-section dress, unboxed

- **Structure consumed, not re-decided:** a `<section aria-labelledby>` headed by its `<h2>` (SPEC-LOCATIONS §4.4), entries as a `<ul>` of `<li>` (Ada L-A3's prescribed structure). This design dresses that structure; it adds no element to it — no wrapper, no intro paragraph (Wren ruled none, COPY-LOCATIONS §4), no per-entry container.
- **No container.** The reasoning is the contact block's (base design §4.1), applied to a sibling with the same absence discipline: a bordered or grounded panel is a promise of contents, and this section's contents vary from two entries to a handful. Unboxed, every count is a complete composition — a stack of labelled addresses under a heading, grouped by proximity alone. A panel would also make the identity zone carry two framed objects (StatePlate frame + locations panel) around a heading whose job is to be read, not displayed.
- **Measure: `max-w-3xl`, About's measure.** The identity zone's prose and fact lines live at this measure (About's shipped class; the base design §11 desktop note). Address lines are short facts, but letting them run the full 72rem container would stretch the label/address relationship across a measure no other identity element uses, and would break the left-rail alignment the header text column, Locations, and About share. At phone width the measure never engages — the section takes the container's full width inside its 16px page padding, like every identity element.
- **No eyebrow, no rule, no motif.** The page spends its eyebrow in the header; the heading names itself (Wren §1). The stem divider is not used, for the base design §5.2 reason: a motif above one identity section alone would redraw the page's structure. The heading earns its emphasis from the 24px gap and its type step, as About's does.

## 3. The heading dress

| Part | Specification |
|---|---|
| Element / words | `<h2>`, `{name}'s locations` verbatim (Wren, COPY-LOCATIONS §1 — possessive per CS-05, sentence case, typographic apostrophe) |
| Type | Base-layer display (Fraunces), `text-xl` (20px), `font-semibold`, line-height 1.2, letter-spacing −0.01em, `text-wrap: balance` — **About's heading classes verbatim** |
| Color | Ink on paper, 12.68:1 (base design §12) |

**Why the About step and not the catalog step.** The page's two H2 dresses are a rank system: `text-xl` for identity sections (About), `text-2xl` for the catalog section that is the page's destination. Locations is a sibling of About in rank, content class, and position — dressing it at 24px would rank a two-entry address list above About and level with the shop itself, and would break the squint test: name (36px) → shop heading (24px) is the page's intended two-beat hierarchy, and a second 24px heading inside the identity zone spends that beat early. At 20px the heading is findable, correctly ranked, and identical in dress to the heading a visitor already learned one section later.

## 4. Entry anatomy — label line, address lines, space between

Entries render in SPEC-LOCATIONS §5.2's order (primary first, then physical, warehouse, mailing; state, then city within a kind). Each `<li>` is composed of two parts, in the SPEC §5.1 slot order:

### 4.1 The label line — kind label, and `Primary` where it applies

One text run on one line (wrapping as text if a width forces it — never `nowrap`, per Ada L-A6):

| Part | Dress |
|---|---|
| Kind label (`Physical address` / `Warehouse address` / `Mailing address`, verbatim, sentence case as ruled) | Sans, `text-sm` (14px / 20px), `font-semibold`, `color.ink-soft` on paper (8.58:1) |
| Separator (primary's entry only) | ` · ` in `color.muted` on paper (5.56:1) — punctuation between two words, itself carrying no fact |
| `Primary` marker (primary's entry only) | Sans, `text-sm`, `font-semibold`, `color.leaf` on paper (9.42:1) — its own text, never merged into the kind string (Wren §3), never a pill, badge, or ground |

- **Why sans semibold for the label line.** The label is classification metadata about the address below it, and the page's nearest relatives set exactly this kind of fact in the sans layer: the ledger's status line (sans, semibold word carrying the state) and the contact rows' labels (sans, peer of the value). Serif italic or an eyebrow would each misclaim — italic is the botanical register on this site, and the eyebrow's uppercase would rewrite Wren's sentence-case strings (a ruled verbatim failure, not a style choice). Same size and weight for kind and marker: the two strings answer two questions at the same rank (Wren §3's orthogonality), and the marker's distinction is carried by its word and its leaf color together — with color removed it still reads, in semibold, as a second fact on the line (Ada L-A4's test, passed by construction: both strings are real DOM text, no generated content, no icon).
- **No icon or glyph of any kind** appears on the label line or anywhere in the entry (see §5 — this includes the StateShape).

### 4.2 The address lines

| Part | Dress |
|---|---|
| Gap above (label line → first address line) | **4px** (`mt-1`) — the caption step: tight enough that the label binds to its address, a full step looser than the card zone's 2px line rhythm because these are two text blocks, not one stack |
| Lines | Serif body (Newsreader, 17px / 1.6, the page's inherited body setting), `color.ink` on paper (12.68:1), plain text, verbatim as published (SPEC-LOCATIONS §5.1.1): street / PO Box line, then the city, state, ZIP line — each published line its own block line; a city/state-only location renders that one line |
| Wrapping | Natural wrap at spaces inside the entry's full measure; no `text-transform`, no abbreviation, no reformatting (Ada L-A5) |

### 4.3 Separation between entries — space, not lines

- **16px between entries** (the list is a `flex flex-col` stack at `gap-4`, or equivalent margins). The rhythm argument is proximity: inside an entry the gaps are 4px and the address lines' own 1.6 leading; between entries the gap must be a clear step larger than anything inside an entry, or two addresses blur into one block of serif text with two label lines floating in it. 16px is the page's established block step (the contact block's slot margin, the control block's section step) — large enough to close one entry and open the next, small enough that a four-entry list still reads as one list under one heading.
- **No divider, rule, or ground change between entries.** A hairline per entry would import the ledger's card grammar into a text list and multiply lines the content does not need; the label line's sans semibold already opens each entry with a visible beat. Grouping by space is sufficient — the playbook's first grouping tool, and this design reaches for nothing stronger.
- **Heading → first entry: 8px** (`mt-2`) — About's heading → body step, spent identically.

### 4.4 The whole section, measured (two-entry example, phone)

Heading 24px (20px × 1.2) → 8px → entry 1 (label 20px + 4px + two address lines at 27.2px = 78.4px) → 16px → entry 2 (same, 78.4px) → section ends; About follows at 24px. Total ≈ 229px for the commonest case (primary + one additional, full addresses) — a compact identity block, proportionate between a header and an About section, and never taller than its content: no fixed height exists anywhere in the section (§6).

## 5. Item SI ruling — state names in the area are text only (normative)

**Ruling: every state name inside a Locations entry renders as plain text within its address line — no StateShape outline, no link to `/state/{slug}`, on any entry, including the primary's entry. Placement A4 in the header's Location line remains the page's only state outline and its only state link.**

This confirms Nadia's recommendation (SPEC-LOCATIONS §7.2) — not by deference, but because the placement spec's own logic, which is this seat's to apply, decides it three times over:

1. **The outline belongs at a surface's naming moment, once.** The placement spec's pattern (base SPEC §9A; base UI design §3.3) is that a state outline marks the one moment a surface names a state *as a filing* — and rules duplicates within a screenful as noise. The header's A4 is this page's naming moment: the primary state, named once, outlined once, linked once. The Locations area sits roughly a screenful below it; an outline per entry would put two, three, or more outlines on one page for one seller — the exact multi-outline field §9A forbids everywhere else on this page (header, heading, cards, control block all ruled no-icon).
2. **An outline + link per entry would imply multi-state filing, which the one-primary rule forbids implying.** The area can name states the seller is not filed under (SPEC-LOCATIONS §1.3: Plant Good Seed's Ojai, CA mailing address, against its Chimacum, WA filing). A state link is a door to a state page on which this seller does not appear under that state; an outline is the directory's filing mark. Rendering either beside the Ojai entry would state, in the directory's own visual language, a filing that does not exist. Text states the address; the directory's marks would state a claim. Only the text is true.
3. **The entries are information, not doors.** Nothing else in the area is interactive (Ada L-A1: no interactive element of any kind, confirmed as a binding negative). A lone link class inside a static list would also break the area's preservation calm — it is identity matter rendered once from the record (SPEC-LOCATIONS §4.3) — and would return link-purpose naming to Ada for a door whose destination contradicts the entry's own context (a "California" link inside a Washington-filed shop). The primary's entry needs no exception: its state already has its door at A4, a screenful above, and duplicating even that one outline is the duplicate-within-a-screenful case the spec's logic rejects first.

**Interim position superseded:** SPEC-LOCATIONS §7.3's text-only interim is now the ruled position, permanently, for this surface. A build that adds an outline or a state link inside the area exceeds this design.

## 6. Behavior at phone width, desktop measure, and text stress

- **Phone (320–390px).** Single column at every width (Ada L-A6: entries never form rows, tables, or grids). The label line's longest ruled form — `Warehouse address · Primary`, 27 characters of 14px semibold sans — measures ≈200px and fits the 288px measure at 320px on one line; if a future seller name or kind combination ever forces a wrap, the line wraps as text between its words, the separator travelling with the marker. Address lines wrap at spaces; the longest unbreakable tokens the content can hold (ZIP+4, PO Box numbers) are far short of the measure, so no word-breaking is needed or permitted. No horizontal scroll at any width.
- **Desktop.** The `max-w-3xl` measure (§2) caps the section while the container runs to 72rem: entries align on the identity zone's left rail with the header text column and About, and address lines never stretch into table-row proportions. The StatePlate does not return beside this section — the header's flex row ended above it.
- **200% text and the 1.4.12 spacing overrides.** Nothing in the section has a fixed height, fixed width, or `nowrap`; entries grow line by line and push About down — growth, never overlap, never clipping (Ada L-A6's obligations, consumed as composition rules here). Under forced colors, every fact survives: kind and primary status are words (the leaf on `Primary` remaps like all color; the semibold word remains), and no ground or border exists to lose.

## 7. Absence composition (SPEC-LOCATIONS §5.4, dressed)

When the area does not exist — one-location sellers, uncollected additionals, a sole additional whose kind is undetermined — **nothing renders**: no heading, no section, no reserved space, no absence copy (Ada L-A2's AT half states the same absence in the tree). The page is the base design's page, byte for byte: header → About at its shipped 24px → reviews → catalog. This is the contact block's discipline (§4.3 of the base design) at section scale: *present iff it earns its place, complete at every count* — a two-entry area and a five-entry area are both finished compositions, and a zero-entry area is correctly not a composition at all.

## 8. Contrast — every pair this delta composes

No new color, ground, or pair is introduced; every pair below already stands in the base design's §12 table, recomputed there. Stated here so Ada's recomputation verifies rather than discovers:

| Pair | Value | Floor |
|---|---|---|
| Heading — ink on paper | 12.68:1 | 4.5:1 ✓ |
| Kind label — ink-soft on paper | 8.58:1 | 4.5:1 ✓ |
| `Primary` marker — leaf on paper | 9.42:1 | 4.5:1 ✓ |
| Separator — muted on paper | 5.56:1 | 4.5:1 ✓ (carries no fact; passes regardless) |
| Address lines — ink on paper | 12.68:1 | 4.5:1 ✓ |

**Tokens: none new, none proposed.** Every value spent is a shipped token or shipped class step named in the base design §2: spacing steps 24 / 16 / 8 / 4px, the `text-xl` and `text-sm` type steps, the serif body setting, and the paper / ink / ink-soft / muted / leaf colors. SPEC-LOCATIONS §6.4's condition — a new token would consult Iris and Thea first — does not arise.

## 9. Register note — for the combined SH-13 audit

Per Quinn's base gate (§10 of `QA-GATE-design.md`): this area is the one new rendered difference on the shop page beyond the base design's S-1…S-12 map, authorized by SPEC-LOCATIONS register entry L-1. Recorded here in register form so the delta gate's SH-13 audit runs against the combined register: **L-1 (visual consequence, this delta): a Locations section — §2's unboxed composition, §3's heading, §4's entries, §5's text-only states — rendered between the header and About if and only if the seller carries ≥2 qualifying locations (SPEC-LOCATIONS §5.4); in its absence the page is identical to the base design.** No other rendered difference is introduced by this document.

## 10. Verification checklist (this seat's, run before handoff)

- [x] Structure unchanged from Nadia's delta — placement (§4.1), contents and slot order (§5.1), order of entries (§5.2), absence (§5.4) identical; only the visual layer is this document's
- [x] Wren's strings consumed verbatim — heading, three kind labels, `Primary`, and her no-intro ruling (§§3–4); no words finalized or altered here
- [x] Every spacing, type, and color value traces to a named shipped token or class step (§8); no new token proposed
- [x] Component states: none exist — the area has no interactive element (Ada L-A1); rest is the only state, and it is fully drawn (§4)
- [x] Hierarchy: squint test — H1 → shop H2 remain the page's beats; the Locations H2 reads at About's rank (§3). Grayscale test — kind and primary survive on words and weight with color removed (§4.1)
- [x] Item SI ruled from the placement spec's own logic, confirming Nadia's recommendation with reasons (§5)
- [x] Ada's floors consumed as composition obligations: real list structure (L-A3), real DOM text for both facts (L-A4), plain-text addresses (L-A5), reflow / resize / override growth (L-A6)
- [ ] **Deliberately not checked:** rendered verification. No build exists; Quinn's delta gate owns the rendered drives (SPEC-LOCATIONS SH-22…SH-27, with Ada's LOC-A1…LOC-A6 as the semantics half). Every rendered claim above is a specification to be verified there.

---

*— Mina, UI Design. Collaborators' positions applied: Nadia (the whole delta structure — placement, contents, absence, and the §7 flag this document rules at §5), Wren (every string, verbatim), Ada (semantics floors L-A1…L-A6, consumed as composition obligations; her L-A5 no-state-link floor and this seat's §5 ruling agree and were reached independently from the two seats' own disciplines), Iris and Thea (not consulted — no new color or type value arose, per SPEC-LOCATIONS §6.4's terms). Evidence: `SPEC-LOCATIONS.md`, `COPY-LOCATIONS.md`, `ADA-LOCATIONS.md`, base `SPEC.md` §9A and `UI-DESIGN.md` §§2–5, 11–12, all from `origin/main`; shipped seller page from `origin/main` (About section classes, header composition). No code was written or changed by this design.*
