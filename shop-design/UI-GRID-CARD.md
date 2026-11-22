# Seller-as-Shop — UI Design Delta: The Product Grid and the Unified Variety Card

**Seat:** Mina, UI Design (author). **Delta to:** my delivered UI design (`shop-design/UI-DESIGN.md`) — this document designs the visual layer of the shop product grid, the unified variety card's grown anatomy, and two ruled additions to the control block and sort. The base design's §§3–8 and 10 stand except where §11 below (the grouped default) and §10 (the Crop group) amend its control-block composition, and §1 supersedes its §9.1–9.2 for the shop results region only.
**Date:** 2026-11-22 · **Status:** Design only. No code, no build.
**Sources ruled from:** Nadia's grid/card delta (`shop-design/SPEC-GRID-CARD.md` — structure §3, the swap §4, my slot list §7.1) and her SPEC deltas on `origin/main` (`SPEC.md` §5.8 — the Crop group, OQ-1 ruled in; §7.5 — the grouped sort default, OQ-3 ruled, with §7.5.4's presentation contract addressed to this seat); Thea's typography ruling (`shop-design/TYPE-GRID-CARD.md` — T-1…T-7); Elena's art rulings (`shop-design/ART-GRID-CARD.md` — tier order, `paper-deep` placeholder ground, tier-4 stem replaced, 1:2 frame concurred); Wren's card copy rulings (`shop-design/COPY-GRID-CARD.md` — all card strings as shipped; crop line in short form in both contexts; no Latin label); Ada's accessibility rulings (`shop-design/ADA-GRID-CARD.md` — G-A1…G-A7, including the binding floor-not-ceiling prescription at G-A6, carried at §5.1 below); the base design's token basis (`UI-DESIGN.md` §2) and the shipped components on `origin/main` (`VarietyCard`, `VarietyCardImage`, `VarietyGrid`, `ListingRow`, `Skeleton.tsx`, `globals.css`).
**House standards binding this delta:** the base design's, unchanged — phone-first, no new ground, border, shadow, radius, hue, or typeface enters the page; one grid system, learned once; absence composed, not apologized for.

---

## 0. Rulings at a glance

| # | Question | Ruling |
|---|---|---|
| G-U1 | Grid gap, shop context | **`gap-2` (8px), both axes, every breakpoint** — the browse grid's gap; one grid system, one gap (§1) |
| G-U2 | Card padding, shop context | **`p-4` (16px) on all sides** — the card's shipped padding; padding is card anatomy, not context (§1) |
| G-U3 | Browse text zone | **`min-height: 9.75rem` (156px) — a floor, not a ceiling** (Ada G-A6, binding); no `overflow: hidden`; growth under spacing overrides, never clipping (§5.1) |
| G-U4 | Shop text geometry | **No fixed text height.** Core stack in flow under the frame; the pinned footer absorbs variance; the card grows under overrides (§5.2) |
| G-U5 | Latin line dress | Thea's ruling, verbatim classes: `text-sm text-muted` wrapping `<i class="normal-case tracking-normal">` — italic Newsreader, muted, centered, natural wrap, no label, no clamp (§4) |
| G-U6 | Sold-out dress | Transferred whole from the ledger onto the card system: ground steps down surface → paper, shadow softens to `shadow-listing-flat`, pill goes outline-only and keeps working, plate at full fidelity (§7) |
| G-U7 | Skeletons | Mini-stem bar **out**, Latin bar **in** (browse); the shop results region takes a **grid skeleton of shop-context card skeletons** (§8) |
| G-U8 | Forced colors, artwork frame | `forced-color-adjust: none` scoped to the **artwork image only** (plate or pod device) — a true color specimen under the SH-16b precedent; never on the card, frame container, or any state-bearing element (§9) |
| G-U9 | Crop filter group (OQ-1) | A standard `BrowseFilters` group in every visual particular, **first** in the stack; plain-text chips, no swatch dot (§10) |
| G-U10 | Grouped sort default (OQ-3) | **Ordering only — no visible grouping of any kind.** No heading, divider, boundary gap, or ground change; the grid's 8px gap is uniform across the invisible boundary (§11) |

---

## 1. Grid composition in the shop context

- **The grid is `VarietyGrid`'s standard variant** (Nadia §3.2): `grid-cols-2` on phone, `sm:grid-cols-3`, `lg:grid-cols-4` — the classes the browse grids already render. The results region's frame around it is unchanged from the base design (§5.1 there): the grid sits 12px below the count line (or the all-sold-out notice), pagination keeps its shipped spacing below, and the in-place cascade (`listing-swap`, `duration.filter-item` / `ease.filter-settle`, 30ms stagger capped at 120ms) applies to the grid's `<li>`s exactly as it applied to the ledger list's — same tokens, same budgets, never on first load, never under reduced motion.
- **Gap: `gap-2` (8px), both axes, at every breakpoint — ruled.** The browse grid's gap is the starting point Nadia's §7.1 hands me, and one grid system argues one gap; the argument holds on inspection. The ledger list's 12px (`gap-3`) was *list* geometry — the breathing room between stacked ledger cards — and it retires with the list, not into the grid. A shop-only 12px gap would fork the one component Nadia §4.1 rules global, would make the same card change its spacing by context (the grid equivalent of a per-surface type size), and buys nothing: at 8px the cards' own borders, shadows, and 16px padding already separate products cleanly at phone width, as every browse grid on the site demonstrates. The 8px gap is also the forced-colors / focus geometry Ada G-A3 budgets against (ring + offset drawable inside gap + padding) — one gap keeps that budget one budget.
- **Card padding: `p-4` (16px) on all sides — ruled, identical in both contexts.** Padding is part of the card's anatomy (it sets the art frame's inset and the text measure Thea computed against: 143px at 390px, 128px at 360px, 108px at 320px). A shop-specific padding would silently change every one of Thea's wrap measurements and Elena's frame proportions in one context only. The shop card's extra content (fact block, footer) is accommodated by the card's *height*, which is free to grow (§5.2) — never by squeezing its padding.
- **Equal cells:** every `<li>` is `h-full` and every card `h-full` (both shipped grid behaviors), so a row's cards share one height — the tallest card in the row sets it, and §5.2's pinned footer is what makes that shared height compose instead of merely stretch.

## 2. The card shell — one component, two contexts

| Part | Both contexts | Shop context difference |
|---|---|---|
| Shell | `.card .packet` — `color.surface` ground, 1px `color.line` border, `radius.card` (18px), `shadow.card`; `flex flex-col`, `h-full`, `p-4`, `text-center` | — |
| Interaction dress | Browse: the whole card is one link and carries `.card-hover` (fine-pointer lift + border deepening) | **No `.card-hover`.** The shop card is not a link (Nadia §3.4); a hover lift on a non-interactive shell would promise a tap the card does not take. Hover and focus belong to its three real targets — name link, Report, pill (§6) — each with its own shipped treatment |
| Packet keyline | `.packet::after` inset keyline, shipped | Unchanged — including on sold-out cards (§7) and in forced colors, where the shipped rule already removes it (§9) |

The shell is the browse card's shell. Nothing about the shop context re-skins it: the shop card reads as a product because its *contents* are a product's (plate, name, stock, packets, a door), not because its box changed.

## 3. The art frame

- **Geometry (shipped, unchanged):** full card content width, `aspect-[1/2]`, `rounded-inner`, `card-image` (the sage hairline band under the frame), `mb-2` (8px) below it before the text stack. Whole plate, `object-contain`, self-hosted — Elena's doctrine, concurred at her §3 for this size.
- **Tiers and grounds (Elena's rulings, dressed):**

| Tier | Content | Frame ground |
|---|---|---|
| 1 | The variety's own first plate | `paper` — the plate's own margin, seamless with it |
| 2 | The crop's first plate (**tier 2 on all grids** — Elena Ruling 1) | `paper` |
| 3 | The crop's seed-pod device (`podArtForPlant`), decorative | **`paper-deep`** — Elena §1.3: the recessed ground is the signal "no painting yet, by design" |
| 4 | The **generic** seed-pod device (the directory's poppy-pod mark, derived web file per Elena §2.1) — **the in-frame stem is removed as a tier; no stem appears anywhere in the card, in any state** | **`paper-deep`** — tiers 3–4 are one tier with two forms of one device |

- **Pod device treatment inside the frame:** the shipped placeholder composition transfers — device centered, `object-contain`, `p-8` inset, `opacity-90` — on the new `paper-deep` ground. The device is decorative (`alt=""`, `aria-hidden`); the ground carries no text and creates no contrast pair (Ada G-A4).
- **The empty-frame fallback:** if Elena's F3 sizing check ever fails the generic device's derived file, the frame renders **empty on `paper-deep`** (her §2.1 fallback) — never the stem, never another crop's pod.

## 4. The Latin line — visual dress within Thea's ruling

Thea ruled the line's type (T-1…T-7); this section fixes its dress in the card's composition, spending nothing she did not rule:

```jsx
<span className="text-sm text-muted">
  <i className="normal-case tracking-normal">{plant.latinName}</i>
</span>
```

- **Position:** first line of the text stack, directly beneath the art frame (the frame's 8px `mb-2` is the gap above it), above the variety name — the removed mini-stem's slot, taken by information (Nadia §4.2). In the browse zone it is the centered stack's first line (Thea T-7: one stack, `gap-0.5` rhythm, no added space above it); in the shop card it is the flow stack's first line on the same 2px rhythm (§5.2).
- **Dress:** Newsreader true italic 400, 14px / 20px, `color.muted` — on `surface` 6.15:1 (Ada's unrounded recomputation, `ADA-GRID-CARD.md` preamble; Thea states 6.2:1), on the sold-out card's `paper` ground 5.56:1 — both past the 4.5:1 floor for 14px text. No label (Wren: the italic form is its identification), no clamp, no ellipsis, no `nowrap`, no size variation by string length — natural wrap to 3 lines at default spacing (§5.1 for what happens past that under overrides).
- **Distinction from the crop line** (same size, same color, below the name) is carried by italic vs roman, by position, and by the name standing between them — never by color (Ada G-A4).
- **Absence:** when `plant.latinName` is `null`, **no node renders** — no empty span, no placeholder, no reserved line (Ada G-A5: absence must be elemental). The card simply shows less, at the same rhythm (§5).

## 5. Text-zone geometry

### 5.1 Browse context — the zone is a floor, not a ceiling (Ada G-A6, binding)

**The browse text zone is `min-height: 9.75rem` (156px). It is never built as `height: 9.75rem`, and it carries no `overflow: hidden` (nor any overflow value that creates a scroll container or clipping mask).**

The default-spacing stack the 156px floor is sized from (Thea T-6, adopted):

| Line | Worst case | Height |
|---|---|---|
| Latin (14px / 20px) | 3 lines (measured — the Asclepias string at every phone width) | 60px |
| Variety name (18px / 24.75px, clamped 2 lines by design) | 2 lines | 49.5px |
| Crop line (14px / 20px) | 1 line | 20px |
| Seller-count line (14px / 20px) | 1 line | 20px |
| Gaps (`gap-0.5` × 3) | | 6px |
| **Total** | | **155.5px → floor 156px** |

- **At default spacing** the zone behaves exactly as Thea and Nadia ruled: uniform across the row, stack centered (`justify-center`), absence invisible — a Latin-less card's remaining lines center in the same 156px with the same 2px gaps (Thea T-7).
- **Under the WCAG 1.4.12 text-spacing overrides** (line-height 1.5×, letter-spacing 0.12em, word-spacing 0.16em, paragraph spacing 2×), the worst stack computes to ~165–180px (Ada G-A6's recomputation) and letter-spacing can push a Latin string to a **fourth line** — past any literal 156px height. The zone therefore **grows**: zone, card, and row all lengthen (the grid's `h-full` stretch keeps the row uniform at its tallest card), text is never clipped, lines never overlap, and the card never scrolls internally. A literal fixed height here **fails Ada's floor** — it would clip the very species strings Nadia §6.2 forbids rewriting — so the 3-line / 60px Latin allocation is specified throughout this design as a **default-spacing allocation, not a cap**: no build logic may count lines, clamp, or defend the 156px with an ellipsis. The same growth rule covers 200% text resize (Ada G-A7).
- **Gate check:** Quinn's **SH-G13a** (Ada G-A6) drives the Asclepias + two-line-name fixture at 390px and 320px under the verbatim override set. This design's obligation to that check is exactly the three properties above: `min-height`, no overflow clipping, no line-count logic.

### 5.2 Shop context — no fixed text height; flow plus a pinned footer

The shop card's text is **in flow** — there is no fixed-height zone in this context, and none may be introduced (Ada G-A6 prescription 4). The same lines, type, and rhythm as browse; a different alignment mechanism, because the shop card has what the browse card does not: a footer to pin.

| Stack part | Composition | Gap above |
|---|---|---|
| Art frame | §3 | — (card padding 16px above it) |
| Core stack — Latin line (§4, when present) → variety name (`<h3>`, Fraunces 18px semibold `leading-snug`, ink, clamped 2 lines) → crop line (`text-sm` muted, **short form** per Wren) | One centered stack, `gap-0.5` (2px) between every pair of lines — Thea's T-7 rhythm, present or absent | 8px (the frame's `mb-2`) |
| Stock line | Ledger dress transferred (§5.3) | 9px — `spacing.listing-status`, the ledger's own status step, transferred as a token, not invented |
| Packets / notes block | `PacketList` as shipped (`text-sm` muted, "Packets:" semibold ink); notes `text-sm` muted — in a `flex flex-col gap-1` (4px) block, rendered only when either exists | 8px (`mt-2`, the ledger's block step) |
| **Footer (pinned)** | §6 | `margin-top: auto`, with 16px minimum separation (§6) |

- **How alignment works without a fixed zone.** Every card in a row shares the same frame height (full width × 1:2), so every core stack starts at the same y. Latin lines of 0–3 lines and names of 1–2 lines push the fact block down by different amounts per card; the pinned footer (§6) absorbs exactly that variance at the card's bottom, so outbound actions align across the row while fact blocks flow at their natural heights. This is Thea §6's shop mechanism and Ada G-A5's — ruled here as the shop geometry, in place of any fixed zone: Nadia §4.1's one-anatomy rule is honored in the lines, type, and rhythm, and the alignment *mechanism* differs by context because the contexts' structures differ (a whole-card link has no footer to pin; a shop card does).
- **The name link's target (Ada G-A3, prescribed):** the `<h3>`'s link is `display: block` with `min-height: 44px` spanning the card's text width, its text within that box — measured on the link's rendered border box. Inside the flow stack this is free: a one-line name's link box (44px) is taller than its line box (24.75px), a two-line name's (49.5px) exceeds it, and the footer pin absorbs the difference like any other variance. Focus order in the card is DOM order — name link → Report → pill (Ada G-A3) — and the global ring (3px + 2px offset) must render unclipped around each; the card carries no `overflow: hidden` anywhere (§5.1's prohibition extends to the whole card in this context).
- **Growth under overrides:** with no fixed height anywhere in the card's text containers, 200% text and the 1.4.12 overrides simply lengthen the card; the pinned footer moves down, never over text (Ada G-A7).

### 5.3 The stock line — ledger dress, transferred without invention

Font-sans, `text-[13px]`, composed exactly as `ListingRow` composes it: an `aria-hidden` dot (8px, `rounded-full`, 6px right margin) in the ledger's tone class for the availability value; the availability word semibold in its tone color (`in_stock` leaf, `sold_out` petal, `preorder` leaf-600, `shop_closed` muted, `unknown` warn — the shipped `STATUS_TONE` map, unaltered); then the remainder (` · Checked {date}` / ` · Not yet checked`) in muted. Centered as a row within the card's centered stack. The word carries the state; the dot never does (Ada G-A4). Strings are Wren's, byte-for-byte as shipped (COPY-GRID-CARD §3).

## 6. The pinned footer — Report + "Visit shop →" pill row

| Part | Specification |
|---|---|
| Container | Full content width (`w-full` — it must span the card despite the shell's `items-center`), `flex items-center justify-between`, `gap-3` (12px), `margin-top: auto`, **`padding-top: 16px`** — so the separation from the content above is *at least* 16px: exactly 16px on a card whose content fills it, more on a shorter card in the same row, where the auto margin pushes the footer to the shared bottom |
| Bottom position | The card's `p-4` puts the footer's bottom edge 16px from the card's edge on every card — with `h-full` stretch and the pin, footer baselines align across each row |
| "Report a problem" (left) | Ledger dress verbatim: `inline-flex min-h-target` (44px) `items-center`, sans `text-[13px]`, muted, underlined (`underline-offset-[3px]`), the ledger's report URL (Nadia §3.3.8) |
| "Visit shop →" pill (right) | Ledger dress verbatim: `inline-flex h-11` (44px) `shrink-0 items-center justify-center`, `radius.full`, **1.5px `color.leaf` border** (`--border-visit`), 18px inline padding (`--spacing-visit-inline`), sans `text-[15px]` semibold `color.leaf`; at rest `color.visit` fill + `shadow.visit-pill`; strings per Wren (visible `Visit shop →`, screen-reader `Shop at {name} (opens in a new tab)`) |
| Above the footer | **Nothing.** No stem rule (the ledger's wheat-stem hairline is a ledger device and does not carry into the grid card — Nadia §3.3.8), no border, no ground change. The 16px of space is the separation |

## 7. Sold-out dress — transferred whole, values uninvented

SPEC-GRID-CARD §3.3 rules the transfer; the values are the ledger's own, mapped onto the unified card's shell without inventing a single new one:

| Signal | Available card | Sold-out card |
|---|---|---|
| Ground | `color.surface` (`.card`) | **`color.paper`** — the ledger's exact step-down (`bg-surface` → `bg-paper` in `ListingRow`) |
| Shadow | `shadow.card` | **`shadow.listing-flat`** (0 2px 8px, warm 0.08) — the system's named softened step; the value the ledger steps *down to*, spent here because the unified card's own shadow has no softer sibling and inventing one is forbidden by the slot |
| Border | 1px `color.line` | 1px `color.line` — unchanged (the ledger's sold-out border is also `line`) |
| Pill | `color.visit` fill + `shadow.visit-pill` | **Outline only:** fill transparent, shadow none; 1.5px leaf border and leaf text unchanged; the pill **keeps working** through `/go/{id}` — never disabled, never removed |
| Plate | Full fidelity | **Full fidelity** — no opacity, filter, or grayscale on the artwork in any state |
| Stock line | Word + dot in its tone | Word `Sold out` + petal dot (§5.3) — the state is carried by this text, never by the dress (Ada G-A4) |
| Latin line | Muted on surface, 6.15:1 | Muted on paper, 5.56:1 — still past 4.5:1 (§4) |

Two honest notes: (a) on a sold-out card the tier 1–2 frame's `paper` ground meets the card's `paper` ground — the frame still reads, carried by the plate itself and the frame's `card-image` hairline band; no frame border is invented to force a distinction the available card does not need either. (b) Under the grouped sort (§11), sold-out cards cluster in the bottom section — that clustering is per-card dress arriving in order, **not** section styling, and no treatment may be added to mark where the cluster begins.

## 8. Skeletons — the new bars and the shop results-region skeleton

### 8.1 `VarietyCardSkeleton` (browse) — Latin bar in, mini-stem bar out

- **Out:** the mini-stem bar (`mt-1 h-3 w-10`) is removed — a skeleton that still shows a stem bar would promise the motif the card no longer has (Nadia §4.4). Zero stem bars in any skeleton, plated or placeholder.
- **In:** a **Latin bar as the first bar inside the grown zone** — `h-5` (20px: one Latin line box at Thea's 14px/20px, per her §8 skeleton note), `w-3/5`, centered. The zone keeps the skeleton's established bar rhythm (`gap-2`, its looser abstraction of the real stack's 2px) and its height becomes the zone's floor value — specified as `min-h-[9.75rem]` for parity with §5.1, so the skeleton card's height equals the real card's at default spacing and the swap between them moves nothing.
- The frame bar (aspect 1/2, `rounded-inner`, `card-image`, `mb-2`) and the name / crop / availability bars (`h-5 w-4/5`, `h-4 w-1/2`, `h-4 w-2/5`) are unchanged.

### 8.2 The shop results-region skeleton — a grid skeleton at the page's count

- The seller route's loading shell replaces `ListingSheetSkeleton` (artwork variant) with **`VarietyGridSkeleton` in its standard variant** (2/3/4 columns, `gap-2` — §1's grid) rendering **shop-context card skeletons**, at the page shell's established item count: the shell is data-less by its own rule (`Skeleton.tsx`: a loading shell receives no count from data), and its current stand-in count is 4 (`ListingSheetSkeleton rows={4}`) — the grid skeleton renders **4 shop card skeletons** in that slot. Where a skeleton is ever rendered with a count in hand, the count is the page's own card count (`min(PAGE_SIZE, total)`); no fixed decorative count is introduced.
- **Shop card skeleton anatomy** (bars on the `.card .packet p-4 text-center` shell, mirroring §5.2's flow): frame bar as §8.1 → Latin bar `h-5 w-3/5` → name bar `h-5 w-4/5` → crop bar `h-4 w-1/2` → stock bar `h-4 w-3/5` → packets bar `h-4 w-2/3` (bars stacked at the skeleton's `gap-2` rhythm, centered) → **footer row** at `mt-4`, full width, `flex justify-between`: Report bar `h-4 w-24` and pill bar `h-11 w-32 rounded-full` — the ledger skeleton's own footer bars, transferred. **No rule bar above the footer** (the ledger skeleton's stem-rule border does not carry, §6).
- `ListingSheetSkeleton`'s default (variety-context) variant is untouched — variety pages keep their ledger cards and their skeleton (Nadia §3.6).

## 9. Forced colors — the artwork frame is a specimen; nothing else is

Under the base gate's SH-16b precedent (`forced-color-adjust: none` appears only on true color specimens — Hue swatch dots; card artwork/swatches — and never on any state-bearing element):

- **The artwork image itself is a true color specimen.** The plate `<img>` (tiers 1–2) and the pod-device `<img>` (tiers 3–4) carry `forced-color-adjust: none`, so a painting renders in its true colors in forced-colors mode — the specimen exemption Ada G-A7 records. The exemption is scoped to the image element only.
- **Never adjusted:** the card shell, the frame container, the pill, the stock dot, the Report link, and every text line. The frame container's `paper` / `paper-deep` grounds remap to system Canvas like all grounds — correctly: the frame's boundary in forced colors is carried by the card's border (border-carried, per Ada G-A3) and by the true-color image inside it, not by preserving a decorative ground. The empty-`paper-deep` fallback frame (§3) is the one presentation that reduces to a bordered empty frame in forced colors — an acceptable, honest rendering of a fallback that occurs on zero current cards.
- **State survives the mode change:** sold-out is carried by its word (§7), focus by the outline-carried global ring (SH-16a), and the packet keyline is already removed by the shipped forced-colors rule. No focus or state information is shadow-carried anywhere in this design.

## 10. The Crop filter group — OQ-1 (SPEC §5.8 / register S-13), presentation

Nadia's §5.8 behavior contract is complete; its presentation is the existing filter system's, with nothing Crop-specific invented:

- **Position: first in the control-block stack** — group order Crop · Season · Sowing method · Life cycle · Hue, then the sort group (SPEC §5.1 as amended). The stack's rhythm is the base design §6.1 table, unaltered: search field → first group 16px (Crop now occupies that slot where it renders); legend → strip 4px; group → group 12px; last group → sort 12px. Crop's arrival changes no gap anywhere.
- **The group itself:** a `BrowseFilters` group in every particular — `fieldset` with the `.eyebrow` legend **"Crop"**, a `FilterStrip` that never wraps (list padding 6px, `scroll-padding-inline: 3rem`, edge fades in `color.paper` — correct here because the page ground is paper, per base design §6.3), 44px fine-pointer chevrons with `shadow.strip-button`.
- **Chips: `.chip-filter` exactly as the base design §6.3 specifies** — 44px minimum height and width, `radius.full`, 1px `line-strong` border on `surface` at rest (ink text 14.02:1); hover leaf-600 border + `leaf-50` ground; selected leaf border + `leaf-50` ground + leaf text (8.60:1) at weight 600; 1px border in every state, so a chip never changes size or place when it changes state. **Plain text only: no swatch dot** (Hue alone carries dots — a dot on a crop chip would borrow the Hue channel's signal), no artwork, no Latin name. Chip labels are the crop common names in full as ruled (SPEC §5.8.1), set in the chip's 14px sans, never truncated — a long name makes a wider chip and the strip swipes; that is the strip's settled answer to length.
- **Counts** ride inside the chips in the base design §7.4 dress: same-size muted numeral span (`tabular-nums`; muted on surface 6.15:1, on `leaf-50` 5.08:1), screen-reader unit "listings". A zero-count crop renders its `0` and stays operable (SPEC §5.3). Chip order — "All" first, then common names A–Z (SPEC §5.8.4) — is **stable**: counts change under other selections, positions never do, so no chip moves between states.
- **Absence:** a shop whose Crop group fails discrimination (single-crop shops, SPEC §5.8.3) shows **no strip** — the gap-stack closes over it and Season takes the first-group slot at the same gaps. No disabled strip, no one-chip strip, no placeholder.
- **Applied row:** an active crop takes the standard remover dress (base design §7.2 — rest-dress `.chip-removable` + × glyph), labeled "Crop: {common name}" per SPEC §5.8.3. Nothing Crop-specific is drawn there either.
- **Cost, stated (updating base PB-M6 for this group):** where all five groups discriminate, the filters band now presents **six labeled strips** (five groups + sort) ≈ 528px of control block before the first card on a phone — one strip (~78px + its 12px step) more than the base design's flagged worst case. Nadia §8.4 accepts the same cost and flags the SH-17 fixture to grow from four groups to five; this design applies its only mitigation — the tight 12px rhythm, no panels, no decoration — unchanged.

## 11. The grouped sort default — OQ-3 (SPEC §7.5 / register S-14), presentation

**Ruling: the grouping is ordering-only and invisible. No visual grouping of any kind is designed, and none may be added by the build.**

Nadia §7.5.4's contract is explicit (no section headings, dividers, or separate section pagination), and this seat's presentation ruling executes it in the grid's own terms:

- **No boundary treatment exists.** No "Out of stock" subhead, no divider, no ground change, no extra space at the section boundary — and in a grid the strongest form of that rule matters most: **the 8px grid gap is uniform across the boundary**, on both axes. The boundary can fall mid-row or mid-page; a larger row-gap at that point would be a boundary marker by spacing, and it is prohibited for the same reason a rule is. The two sections are indistinguishable as layout — a visitor scrolling the grid meets one continuous product grid whose order the count line states.
- **What carries the information instead:** (1) the **count line's phrase** — "{N} listings, in stock first." at rest (SPEC §7.3) — in the count line's unchanged dress (base design §7.3: serif body, muted, dress never changes by state); (2) **each card's own stock line** (§5.3), which already states every card's availability in words; (3) the sold-out cards' stepped-down dress (§7), which clusters naturally in the bottom section as a *consequence* of the order — per-card dress, never section chrome (§7, note b).
- **The sort group at rest:** the chips render in SPEC §7.2's order — **"In stock first" · "Name A–Z" · "Recently checked"** — and the resting chip **"In stock first" carries the selected dress** (leaf border, `leaf-50` ground, leaf semibold text) from first render. The base design §6.4 principle governs: a single-select group shows its resting selection, never an unmarked group that reads as unset — under the old default that chip was "Name A–Z"; the delta moves the selection, not the principle. Selecting "Name A–Z" or "Recently checked" moves the same selected dress to that chip and removes every trace of grouping from the order (both are ungrouped orders, SPEC §7.5.2) — with, again, no visual change to the grid beyond the order itself.
- **While a query is active** the sort group is absent and relevance owns the order (SPEC §7.2; base design §6.4) — the grouped presentation question does not arise, and on clearing, the prior selection's dress returns with the group.
- **The un-tooled band (T ≤ 8)** renders the same grouped order with no control at all (SPEC §7.5.3): presentation there is §11's first bullet with no chip — one continuous grid, count line carrying the phrase. Nothing about a small shop's page announces that its order is grouped beyond the count line's words, which is the contract working as designed.

## 12. Contrast — pairs this delta introduces or newly composes

All values are shipped-token pairs, computed in the documents credited; no new pair is invented:

| Pair | Value | Source |
|---|---|---|
| Latin line — muted on surface | 6.15:1 | Ada recomputation (Thea states 6.2:1) |
| Latin line, sold-out — muted on paper | 5.56:1 | Base design §12 |
| Stock word tones on surface / paper — leaf, petal, leaf-600, muted, warn | petal 7.2:1 on paper (surface higher); all ≥ 4.5:1 as recorded in `globals.css` token comments | Shipped token record; ledger pairs, transferred |
| Crop chip text / counts | Identical pairs to base design §6.3/§7.4 (14.02:1 rest; 8.60:1 selected; counts 6.15:1 / 5.08:1) | Base design §12 |
| Pill — leaf on `color.visit` / leaf on paper (sold-out) | Shipped ledger pairs, unchanged | Ledger record |

## 13. Tokens — none new

**No new token is proposed, flagged or otherwise.** Every value above is a shipped token or a shipped component's own value: `gap-2`, `p-4`, `radius.card`, `shadow.card` / `shadow.listing-flat`, `color.paper` / `paper-deep` / `surface` / `line` / `visit`, `--border-visit`, `--spacing-visit-inline`, `--spacing-listing-status`, `size.target`. The one component value restated in a new place — the browse zone's `min-height: 9.75rem` — has the same status as the shipped `h-[6.25rem]` it grows from: a component class value derived from Thea's measured stack (§5.1), not a system token, and it enters the register only if the register wants component values, exactly as its predecessor did.

## 14. Verification checklist (this seat's, run before handoff)

- [x] Structure unchanged from Nadia's deltas — grid geometry (§3.2), card anatomy (§3.3), tier order (§4.3), thresholds, page size, in-place contracts identical; only visual values are this document's (§7.1 slot), plus the two presentation rulings her later deltas assign (§§10–11, from SPEC §5.8 / §7.5.4)
- [x] Thea's type ruling applied verbatim (§4); Elena's art rulings applied verbatim (§3); Wren's strings untouched (§§5.3, 6)
- [x] Ada's binding prescription carried: browse zone `min-height`, no overflow clipping, growth never clipping never internal scroll (§5.1); shop context carries no fixed text height (§5.2); heading-link 44px target on its border box (§5.2); absence elemental (§4)
- [x] Every spacing, radius, color, and shadow traces to a named shipped token (§13); sold-out values transferred, none invented (§7)
- [x] All states drawn: card rest / sold-out; chips rest / hover / selected / focus (inherited, §10); skeletons for both contexts (§8); forced-colors treatment (§9)
- [x] Hierarchy: squint and grayscale — the grid's focal order is plate → name → pill in every card, identically in both sections of the grouped order (§11 adds no competing element)
- [ ] **Deliberately not checked:** rendered verification. No build exists; Quinn's delta gate owns the rendered drives (SPEC-GRID-CARD SH-G1…SH-G14, with Ada's SH-G13 as ruled and the new SH-G13a override drive). Every rendered claim above is a specification to be verified there.

---

*— Mina, UI Design. Collaborators' positions applied: Nadia (structure throughout, and both later deltas — §5.8's Crop contract and §7.5.4's ordering-only contract, designed here as §§10–11 without re-deciding either), Thea (the Latin line's type and the zone arithmetic), Elena (tier order, grounds, the tier-4 replacement, the frame), Wren (every card string as shipped; short crop form in both contexts), Ada (floors G-A1…G-A7 — her G-A6 prescription is §5.1's governing rule, and her G-A5 shop mechanism is §5.2's). Evidence: `SPEC-GRID-CARD.md`, `SPEC.md` §§5.1–5.8 and 7.2–7.5 (as amended on `origin/main`), `TYPE-GRID-CARD.md`, `ART-GRID-CARD.md`, `COPY-GRID-CARD.md`, `ADA-GRID-CARD.md`, base `UI-DESIGN.md` §§2, 5–7, 12; shipped code from `origin/main` (`VarietyCard.tsx`, `VarietyCardImage.tsx`, `ListingRow.tsx`, `Skeleton.tsx`, seller skeleton, `globals.css` tokens and component layer). No code was written or changed by this design.*
