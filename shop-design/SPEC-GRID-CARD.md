# Seller-as-Shop — Delta Specification: Shop Product Grid + Variety Card (Motif Out, Latin Name In)

**Seat:** Nadia, UX Design (author). Delta to my delivered shop SPEC (`shop-design/SPEC.md`) and locations delta (`shop-design/SPEC-LOCATIONS.md`), both read back from `origin/main` before designing. Standing collaborators with slots in this delta: Mina (UI design — all visual values of the grid and card, §7.1), Elena (art direction — the artwork tier harmonization and placeholder rulings, §7.2), Thea (typography — the Latin line's treatment, §7.3), Wren (copy — the card's remaining wording, §7.4), Ada (accessibility — semantics floors, §7.5). Quinn's delta gate closes on this document (§9).
**Date:** 2026-11-22 · **Status:** Design spec only. No code, no build.
**Commission — the additions (Dustin, voice call 2026-11-22 15:35 PT, verbatim):** "For the sellers pages the products or the varieties that they carry currently in the profile page doesn't have any photos or illustrations of the varieties. We need to make that look more like a shop grid of products and also I'd like that motif removed off of the variety card and replaced with the Latin name."
**House standards binding this delta:** the base SPEC's standards, unchanged — US spelling; prices never shown; packet sizes shown; phone-first; illustrations shown whole, never cropped, never hotlinked; no placeholder text and no invented facts anywhere (a card without a fact shows less).

---

## 1. The rule that governs this delta

**The shop's catalog stops being a ledger with pictures attached and becomes a grid of products; and there is exactly one variety card in the directory, used by every grid.** Two consequences, stated now because they decide arguments later:

1. **One card component, globally.** The shop grid and the `/variety` browse grid (and the crop, series, and variety-page sibling grids) render the *same* variety card. The card carries a context block the way `ListingRow` already does (`context="variety" | "seller"` is the shipped precedent): the art + Latin + name + crop core is identical everywhere; what differs below the crop line is the fact block each surface owes (browse: seller count; shop: this listing's stock, packets, and outbound pill). A split into two card designs is rejected in §4.1 with its reasons.
2. **This delta repeals one base-SPEC protection, by name.** The base SPEC's §12 register and its SH-10 check hold the seller page's Quiet Ledger cards "byte-identical" and untouched. That protection was written before this commission. Under this delta it **survives only for variety context** (the variety page's listing cards, §5.1); on the seller page the ledger presentation is *replaced* (§3). Quinn's SH-10 must be re-scoped accordingly (§10, G-1) — a build that keeps seller-context ledger cards to pass the old SH-10 would fail this commission, and a build that follows this delta would fail the old SH-10. The register in §10 is the reconciliation.

Everything else in the base SPEC stands: header, contact block, Locations area (SPEC-LOCATIONS), thresholds (§8 of the base SPEC), filters/search/sort contracts, URL/history discipline, pagination as navigation, the no-JS floor. This delta changes what a result *looks like* inside the results region, and nothing about how the region behaves.

---

## 2. Current state (verified 2026-11-22)

Method, as before: code from `origin/main` via `git show`; live truth from `curl` against production and the public API (`catalog_seq 4618`, generated 2026-11-22T23:37–23:39Z). Numbers below are measured, not remembered.

### 2.1 What the seller page's varieties actually look like today — and why Dustin reads them as imageless

**The presentation, exactly.** The catalog section (still headed "Listings at {name}" live; the base SPEC's shop build has not shipped) renders `ListingRow` in seller context — the Quiet Ledger card — in a single-column stack on phone (`flex flex-col gap-3`), becoming 2 columns only at `lg` (≥1024px). PR #13 added an artwork rail to that card (`ListingArtwork`): a fixed 1:2 frame, **72px wide × 144px tall on phone, 96×192 at `sm` and up**, sitting at the left of a text column that carries the variety-name heading (20px, underlined), crop subline, stock line (dot + word + checked date), packet sizes, notes; a wheat-stem hairline rule; and a footer ("Report a problem" left, "Visit shop →" pill right). The artwork resolves four tiers: variety plate → crop plate → crop pod motif → divider-stem placeholder, whole (`object-contain`) on paper.

**The artwork is there. Measured:** across all 83 sellers' 1,489 listings (public API, full crawl), **1,156 listings (77.6%) show their variety's own plate and 333 (22.4%) show their crop's plate — 100% show a real plate; zero fall to the motif or stem tiers.** On GeoSeed page 1 (live HTML probe): 24 cards, 24 rails — 14 variety plates, 10 crop plates.

**Why it nevertheless fails Dustin's reading — the diagnosis, in order of weight:**

1. **The plate is a thumbnail, not a product image.** 72px wide on the phone — the surface this site is designed phone-first for — with the 1:2 plate contain-fitted inside it. At that size the painting is a colored sliver; a shopper cannot recognize a flower from it, so it does not register as "the product's picture" at all. Recognition-over-recall only works when the image is big enough to recognize.
2. **The card's bounded region reads as a record, not a product.** Gestalt: a wide, short ledger entry whose area is ~80% text and administration (status, dates, packets, a report link) with a picture appended at its left edge. The eye files it as "a listing about a variety," which is what a profile page has — precisely Dustin's description of what he is looking at.
3. **There is no grid.** One column on phone and tablet portrait, two at desktop, with card heights varying by notes and packet counts, so no two plates align and nothing scans as a wall of products. A shop grid is defined by aligned, equal cells with the product image as each cell's dominant element; today's stack has neither property.
4. **Crop-plate repetition at thumbnail size reads as decoration.** 10 of GeoSeed's 24 page-1 cards repeat a shared crop plate. At product size that repetition is truthful grouping (PR #13's reasoning, which stands); at 72px it is indistinguishable from a generic ornament repeated down a list.

So the commission is not "add artwork" — the artwork exists and is complete. It is "change the presentation until the artwork does the product's job": art-dominant cells, aligned in a grid. §3 designs exactly that, and §5.1 rules what happens to the rail.

### 2.2 The variety card today — and the motif, identified precisely

The variety card is `v2/components/variety/VarietyCard.tsx`, rendered by `VarietyGrid` on four surfaces: `/variety` (the `wide` variant: 2 / 4 / 5 columns), crop pages, series pages, and the variety page's sibling grid (standard variant: 2 / 3 / 4 columns). The whole card is one link to `/variety/{slug}`. Anatomy, top to bottom:

1. The art frame (`VarietyCardImage`): 1:2, full card width, the variety's first plate whole on paper; without media, the crop's pod motif in-frame, else the divider stem in-frame (§2.3, tier note).
2. **The motif: `<span aria-hidden="true" className="divider-stem-mini mt-1" />`** — the site's stem-and-two-leaves divider at mini size (element 2.5rem × 12px; `/theme/divider-stem.svg` at 110×12), sitting between the art frame and the text zone, on **every** card, plated or not. This is the motif the commission removes. It is a CSS class instance, not the class: `.divider-stem-mini` also serves the header wordmark lockup and the homepage crop packet cards, which are **not** variety cards and are **not** in this delta's scope (§4.5).
3. A fixed-height text zone (`h-[6.25rem]`, content centered): variety name (≤2 lines), one muted crop line, one availability line ("N sellers" / "No sellers yet").

The card's own header comment records the current contract, including two facts this delta must reckon with honestly: "no latin eyebrow" was a *deliberate* exclusion when the card was designed, and the mini stem is a named part of the anatomy (the skeleton mirrors it: `VarietyCardSkeleton` renders a mini-stem bar above a 6.25rem zone).

### 2.3 Coverage — artwork (measured)

| Fact | Count | Source |
|---|---|---|
| Varieties in the catalog | 812 | API total |
| With their own plate (`media[0]`) | 583 (71.8%) | API crawl, all 812 |
| With **no plate of their own** | **229 (28.2%)** | API crawl |
| Crops (plants) in the catalog | 124 | API crawl |
| Crops carrying a plate | 124 / 124 | API crawl |
| Listings (all sellers) | 1,489 | API crawl, 83 sellers |
| Listings showing variety plate / crop plate / motif-or-stem | 1,156 / 333 / **0** | API crawl |

Two honesty notes. (a) The commission's "~211 varieties with no plate" is stale: the 2026-11-21 full audit named 220 missing plates (212 from the queue record + 8 late additions); the live API today measures **229** without their own media. The number moves as the catalog grows; this delta is written against 229. (b) Because every crop carries a plate, *no variety in the catalog is without an available plate image* — a fact that decides the fallback design in §4.3.

### 2.4 Coverage — Latin names (measured; full treatment in §6)

There is **no variety-level Latin name anywhere in the system**. The Latin name is a plant-level field, `PlantRef.latinName` (nullable string), inherited by every variety of that crop; it already rides both card payloads (`VarietyListItem.plant`, `PublicListing.variety.plant`) and already displays on the variety page (italic, in the eyebrow and the facts table) and crop pages. Coverage: **543 of 812 varieties (66.9%) inherit a Latin name; 269 (33.1%) inherit `null`**, because **74 of 124 crops carry no `latinName`** (50 do). §6 states the classes, the stored form, and the absence rule.

---

## 3. Addition 1 — the shop product grid (normative)

### 3.1 What replaces what

Inside the shop's results region, the seller-context Quiet Ledger presentation is replaced by the **variety card in its shop context** (§4), laid out as a product grid. The results region's other contents do not change: the control block, applied row, count line (the persistent live region), the designed empty/depleted states, the all-sold-out notice, and pagination all behave exactly as the base SPEC rules them — they now frame a grid instead of a ledger stack. The list semantics stay a list (`<ul>` of cards), as on every other grid surface.

### 3.2 Grid geometry (normative structure; visual values are Mina's, §7.1)

- **Columns: 2 on phone, 3 at `sm`, 4 at `lg`** — the standard `VarietyGrid` variant's classes, because the shop grid *is* `VarietyGrid` (§1.1). The `wide` variant (4/5 columns) stays exclusive to `/variety`, as its code comment already rules. One grid system, learned once: a shopper who knows the browse grid already knows the shop grid (Jakob's Law).
- **The plate is the card's dominant element**: full card width, 1:2 frame, shown **whole** (`object-contain` on the paper ground, our own image CDN — Elena's doctrine, unchanged). At 2-column phone width (~175px cells) the frame renders ~350px tall — roughly five times the rail's phone area, and the first presentation on this page where the painting can actually be recognized. The 1:2 frame at grid size is a deliberate acceptance, not an oversight: the plates *are* 1:2, whole-plate display is the house doctrine, and a shorter frame would either crop (forbidden) or letterbox the painting into a smaller picture inside a bigger box (the opposite of this commission). The cost — tall cards, about two rows per phone screenful — is the browse grid's already-accepted cost, and consistency with it is worth more than a shop-only frame invention.
- **Equal cells**: every card in a row stretches to the row's height (`h-full`, as both grids already do); the fixed-height text zone (§4.4) keeps art and text aligned across the row.

### 3.3 Card anatomy in shop context (normative)

Top to bottom (the core is §4.2's, identical to browse; the shop fact block follows):

1. **Art frame** — §4.3's tier resolution, whole plate.
2. **Latin line** — §4.4's slot (the motif's former place), when the variety's crop carries one.
3. **Variety name** — an `<h3>` linking to `/variety/{slug}` (the ledger's heading pattern; the shop card is *not* a whole-card link, §3.4).
4. **Crop common-name line** — the card's subline, as in seller context today.
5. **Stock line** — dot + availability word + friendly checked date, byte-for-byte the ledger's status line ("In stock · Checked Nov 19"; "Not yet checked" when null). Never an ISO string, never a pill.
6. **Packet sizes** — `PacketList`, when the listing carries any (shown, per the settled model; prices never).
7. **Listing notes** — when present, the ledger's muted notes line. Dropping seller notes silently would lose data the page shows today; nobody commissioned that loss.
8. **Action footer** — "Report a problem" (left, 44px target, the ledger's report URL with seller + variety parameters) and the **"Visit shop →" pill** (right; `/go/{id}`, new tab, `nofollow noopener noreferrer`, the ledger's component contract unchanged). In shop context the footer is **pinned to the card's bottom** (`margin-top: auto`): in a grid, pills that float at different heights read as breakage, and aligned outbound actions are the product-grid convention (Baymard PLP uniformity). This is a named difference from the ledger, where the unpinned footer was correct for a list; the wheat-stem hairline rule does **not** carry into the grid card — it is a ledger device (and a motif-adjacent element this commission's spirit removes from the product presentation), its absence here is deliberate, and variety context keeps it untouched (§5.1).

**Sold-out dress transfers whole**: card ground steps down from surface to paper, shadow softens, the pill keeps working through `/go/{id}` with its fill removed (outline only), the plate renders at full fidelity, and the stock line carries the sold-out word — the ledger's four signals, on the grid card, unchanged in meaning. A shopper must be able to tell a sold-out product from an available one without opening it; the grid does not get to hide the shop's stock honesty to look tidier (base SPEC §9.4's stance, applied per card).

### 3.4 Why the shop card is not a whole-card link (ruled)

The browse card is one link because it has one destination. The shop card has two — the variety page (name) and the seller's product page (the pill, via `/go/`) — plus a third utility (Report). Wrapping the card in the variety link would nest interactive elements (invalid, and a focus/announcement tangle Ada would rightly fail) and would make the whole product surface a mis-tap route away from the outbound action the listing exists for. The ledger already solved this correctly (heading link + pill); the grid card inherits that solution. Pushback PB-G3 (§8) records the considered alternative.

### 3.5 What the grid does to the settled contracts (each ruled)

- **Thresholds (base SPEC §8): unchanged.** The bands are properties of the shop's total T, not of card shape. The §8.1 scan math still lands where it landed: at 2 columns, a phone screenful holds ~4 grid cards, so ~8 listings ≈ two screenfuls — the point where scanning fails and tools earn their chrome is the same point. No band moves; SH-2's expectations stand.
- **Page size: `PAGE_SIZE` stays 24.** 24 is divisible by every column count the grid takes (2, 3, 4 — and by the wide variant's counts on `/variety`), so a full page never leaves an orphan row at any breakpoint. The honest cost: a 24-card grid page is a longer scroll than the 24-card ledger page was (taller cards, fewer per row on phone). That is the commission's own trade — product presence over list compactness — and it is accepted here rather than silently "fixed" by forking the page size, which is a site-wide constant (`lib/config`) the browse surfaces share. If the scroll proves heavy in Quinn's drives, page size is a one-constant question for Dustin (OQ-G1, §8) — not a decision this delta takes.
- **True-404 bounds: unchanged.** Pagination remains navigation (base SPEC §10.3); bounds are computed against the narrowed total exactly as before. The grid changes what a page's items look like, never how many there are or which pages exist. GeoSeed's live bounds (page 8 = 200, page 9 = 404) remain the regression case (SH-G9).
- **In-place updates: unchanged, and they render grid cards.** Filter, search, and sort updates swap the results region in place under the base SPEC §4 preservation rules; in *every* state — filtered, searched, sorted, combined — the region shows the same grid of the same card (§4), Latin lines included or absent per the same data. There is no state in which the shop falls back to ledger cards. The loading skeleton for the region becomes the grid skeleton (`VarietyGridSkeleton` parity, §7.1) in place of the ledger skeleton.
- **Counts, applied row, live region, empty states: unchanged.** The §9.2/§9.3 states render inside the region as designed, not as grids; the all-sold-out notice (§9.4) is unaffected — a fully sold-out shop now shows a grid of stepped-down cards under the notice, which is the notice's point made visible.

### 3.6 The relationship to the Quiet Ledger — ruled

- **Seller page**: the grid card **replaces** the Quiet Ledger listing presentation. `ListingRow` in seller context no longer renders on this page.
- **Variety page**: the Quiet Ledger listing cards (variety context — seller as heading) **stay, byte-for-byte**. Confirmed, not merely defaulted: that surface's job is comparing *sellers* of one variety beside the variety's own hero plate; a product grid there would duplicate the hero, demote the seller (the actual heading), and answer a question the page does not ask. PR #13's §3.3 reasoning stands untouched.
- **PR #13's rail: superseded on the seller page.** `ListingArtwork` has exactly one caller (`ListingRow`, seller context). Its *logic* — the four-tier resolution and per-tier alt discipline — is not discarded; it moves into the unified card's image resolution (§4.3), where tier 2 (crop plate) additionally reaches the browse grids for the first time (§4.3's flagged harmonization). The component itself has no remaining caller after this build and the build retires it — registered here (G-4) so its removal is a decision, not drift.

---

## 4. Addition 2 — the variety card: motif out, Latin name in (normative)

### 4.1 One component — the ruling, with the split considered and rejected

**The variety card is one component globally**: `VarietyCard`, gaining a shop context alongside its browse form, on the `ListingRow` context precedent. Every grid — `/variety`, crop, series, variety-page siblings, and now the shop — renders it. The alternative, a separate shop card component, was considered and is rejected for three reasons: (a) two card designs for the same variety *will* drift (the exact failure the "ONE public listing shape" discipline exists to prevent); (b) Dustin's addition names "the variety card" as one thing — the Latin-for-motif swap is commissioned on the card, not on a surface; (c) the surfaces' real differences (fact block, link shape) are already expressible as context, as the ledger proves. **No split is proposed; this paragraph is the flag the brief asked for if one were found — none was.**

Context differences, closed list: browse context = whole-card link, seller-count line, no stock/packets/actions; shop context = heading link, stock line, packets, notes, action footer, sold-out dress. Everything above the fact block — art frame, Latin slot, name, crop line, text-zone geometry — is one anatomy in both.

### 4.2 The swap (normative)

- **Out**: the `<span className="divider-stem-mini mt-1" />` element between the art frame and the text zone — removed from the card in both contexts, in every state (plated, placeholder, filtered, searched, skeleton). No replacement ornament takes its place; what takes its place is information:
- **In**: the **Latin line**, occupying the stem's slot — directly beneath the art frame, as the first line of the text zone, above the variety name. Position is ruled here (it is the replacement Dustin described, and it gives a grid a consistent top-aligned Latin row — gardeners scanning a crop grid by species read that row the way they read a seed rack's botanical labels). The line's content is the stored string, verbatim (§6.2). Its typographic treatment — italic botanical convention, size, color, wrapping of long multi-species strings — is **Thea's slot** (§7.3); the site's existing precedent (variety page eyebrow and crop pages render `plant.latinName` in `<i>`, normal-case) is the starting point her pass confirms or adjusts.
- The text zone remains **fixed-height** (its value grows by the Latin line's height — Mina's, §7.1) so grid rows stay equal and no layout shifts when a card lacks a Latin name (§6.3).

### 4.3 The card's image resolution — one tier order, everywhere (normative, with one flagged harmonization)

The unified card resolves its art frame in `ListingArtwork`'s shipped order, first hit wins:

1. **The variety's own first plate** — alt "{varietyName} — illustration".
2. **The crop's first plate** — alt "{crop common name} — illustration".
3. **Elena's designed seed-pod placeholder** — the crop's pod device (`podArtForPlant`), decorative (`alt=""`, `aria-hidden`). This is the fallback of record where *no plate of either kind* exists: a designed device in a uniform frame (Elena's C6 ruling), never a broken image, a stock photo, or a guessed painting.
4. **The generic seed-pod placeholder** — the designed pod device in its generic, directory-mark form (ART-GRID-CARD §2), decorative, on `paper-deep`, where the crop has no pod art either; the in-frame divider stem is removed as a tier.

**Flagged harmonization (Elena's confirmation is a slot, §7.2 — read this before building):** tier 2 is new to the browse grids. Today `VarietyCardImage` jumps from a variety's own plate straight to the pod motif — a conflict with Elena's binding rule ("a variety without its own plate uses its crop's plate") that PR #13 §2.4 recorded and explicitly left for Elena to settle as its own decision. One component forces the decision now, because one card cannot run two tier orders. My ruling adopts Elena's plate rule (a real painting of the crop over a decorative device — and the 2026-11-19 design audit's finding stands: at the observed ratios, placeholder-heavy grids read as "rows of empty picture frames"). Measured consequence: all 229 plateless varieties have a crop plate available (§2.3), so on browse grids those cards change from pod/stem placeholders to their crop's plate, and tiers 3–4 become what they should be — a designed fallback for a case that currently occurs on **zero** cards, kept correct for the day a crop loses or has not yet gained a plate. If Elena instead rules pod-before-plate for variety cards, the one-component rule means the shop grid inherits that order too, revising PR #13's tier 2 on the seller page — the consequence is named here so her ruling is taken with both surfaces in view. The placeholder's ground (C6 specifies the pod device on `paper-deep`; shipped placeholders sit on `bg-paper` — a divergence Mina recorded at PR #13) is settled in the same slot (§7.2).

**Payload consequence (build input, §6.4):** the shop payload already carries `cropMedia` (PR #13, on `VarietyRef`); the browse payload does not (`VarietyListItem` carries `media` only). Tier 2 on browse grids requires `cropMedia` on `VarietyListItem`, populated batched exactly as listings populate it. That is this delta's only payload change.

### 4.4 What the swap does to the card's other surfaces and states (normative)

- **Skeleton**: `VarietyCardSkeleton` mirrors the new anatomy — the mini-stem bar is removed; a Latin-line bar takes its position; the zone's bars reflect the grown zone. A skeleton that still shows a stem bar would promise the motif the card no longer has.
- **The art frame's in-frame placeholders are not "the motif on the card"** in the commission's sense — they are tiers 3–4 *inside* the frame, holding the frame's shape when no plate exists. They stay as pod devices only: tier 3 the crop's own pod device, tier 4 the generic pod device (ART-GRID-CARD §2). No stem instance remains on the card in any state — the in-frame divider stem is removed as a tier (Elena's ruling; the §7.2 slot was decided).
- **The ledger's wheat-stem hairline** (`.listing-stem-rule`) is not on the variety card and is untouched: it stays in variety-context ledger cards (§3.6) and does not enter the grid card (§3.3.8).
- **Nothing else that used the mini stem changes**: the class, its wordmark-lockup use, and its homepage crop-packet-card use are outside this delta (§4.5). The variety *detail* page, crop pages' own headers, and every other stem placement (footer, prose) are untouched.
- **Filtered/searched states**: the card is the card in every state (§3.5). A Latin line never appears or disappears because of a filter — only because of the variety's data (§6.3).

### 4.5 Scope fence (normative)

This delta touches: `VarietyCard` / `VarietyCardImage` (anatomy + tier order), `VarietyCardSkeleton`, `VarietyListItem` (payload, §6.4), and the seller page's results region (grid + shop context). It does **not** touch: `.divider-stem-mini` as a class or its other instances; the homepage motif commission (a separate, Dustin-gated item — the picked Twine & Tag swap is its own build); `ListingRow` variety context; the variety detail page (which already shows the Latin name twice); search results rows; or the OG card template's stem shapes.

---

## 5. (Reserved — relationship rulings are stated at §3.6 and §4.5; numbering kept parallel to the base SPEC's habits.)

## 6. Data verification — the Latin name (normative findings)

### 6.1 Source — where the Latin name comes from

**Inherited from the crop (plant), never stored on the variety.** Verified in three places that agree:

- **Schema of record**: `VARIETY-FACTS-SCHEMA.md` row 29 — `scientific_name`, level **Plant**, "plant-level `latinName`". (Its "filled on 19/19 plants" is a fossil of the 68-variety seed catalog; the catalog has since grown to 124 crops — do not quote 19/19. Live coverage is §6.3.)
- **Validators** (`v2/lib/validators/index.ts`): `PlantRefSchema.latinName: z.string().min(1).nullable()`. `VarietyRef`, `VarietySummary`, and `VarietyListItem` carry **no** Latin field — they carry `plant`, and the Latin rides inside it. The sync schema agrees (`SyncCrop.latin_name`; no variety-level equivalent).
- **Live API payload** (crawl of all 812 varieties + 124 crops, 2026-11-22): every variety's `plant.latinName` is either a string or `null`; the crops endpoint returns the identical value per crop.

**Build consequence: Addition 2 needs no new field, no migration, and no payload change.** Both card contexts already receive `plant.latinName` on every render. (Addition 1's single payload change is browse-side `cropMedia`, §4.3.)

### 6.2 Data form — what the slot receives (normative for Thea's pass)

The stored value is **one free-text display string per crop** — it is *not* decomposed into genus / species / cultivar parts, and the card must not decompose it:

- 50 distinct strings across the 50 Latin-carrying crops. Most are a clean binomial ("Zinnia elegans", "Cosmos bipinnatus").
- **8 of the 50 are multi-species strings** with " / " separators and hybrid markers, stored as one string, e.g. "Asclepias tuberosa / A. incarnata / A. physocarpa", "Aquilegia x hybrida / A. vulgaris", "Delphinium elatum / D. x belladonna". One is a hybrid formula without a species epithet: "Dahlia × hybrida".
- **No cultivar epithet is stored anywhere.** The variety name is a trade/common name, not a Latin cultivar name; appending it in quotes (the botanical-cultivar convention) would *invent* a Latin name the record does not hold. Forbidden (§6.3).

The slot therefore takes: the string, verbatim, whole — including its "×" and " / " — or nothing. Thea rules how a long multi-species string wraps or clamps inside the fixed zone (§7.3); truncation that *rewrites* the string (dropping a species silently) is a data change, not a treatment, and is not permitted — if space forces a choice, the choice comes back to this spec.

### 6.3 Coverage and absence (normative)

| Route | Carries a Latin name | Lacks one |
|---|---|---|
| Crops (124) | 50 (40.3%) | 74 (59.7%) |
| Varieties (812), inherited | **543 (66.9%)** | **269 (33.1%)** |
| Listings (1,489), inherited | 1,005 (67.5%) | 484 (32.5%) |
| GeoSeed's listings (179) | 152 | 27 |

**Which classes lack one — stated plainly, because the honest answer is not the expected one:**

- **Absence tracks the crop's data completeness, nothing else.** A variety lacks a Latin line if and only if its crop's `latinName` is `null`. The largest Latin-less crops by variety count: ornamental squash (54 varieties), marigold (15), china aster (13), pansy (12), statice (10), pea (9), foxglove (8), phlox (8). These are unfilled crop records, not a variety kind.
- **Mixes do not lack one as a class.** 72 varieties are mix-named; 58 (80.6%) inherit a Latin name — a mix is a mix *of a crop's* seed, and it takes the crop's name like any other variety. By `colorFamily`, 91 varieties are `mix`; 75 carry Latin. There is no mix exception to design.
- **Multi-species crops split two ways**: where the catalog holds a multi-species string (§6.2), the card shows it verbatim; where a genuinely multi-species crop's record is still `null` (the Latin-less list above includes several), the card shows nothing — the string is a cataloging task, not a card behavior.

**Absence behavior (normative)**: when `plant.latinName` is `null`, **the Latin line does not render** — no placeholder text, no "Latin name unknown" (that string exists on the variety *detail* page's facts table, a surface whose job is enumerating facts; a card is not), no empty slot, no reserved line, and **never a derived or guessed name** — not from the common name, not from a neighbouring crop, not from general knowledge (several Latin-less crops have famous binomials; famous is not sourced, and this directory's no-invention discipline is absolute). The card simply shows less: the fixed-height zone (§4.2) centers its remaining lines, so a Latin-less card is the same size as its neighbours with slightly more air in the zone — uniform in the grid, honest in content. Roughly one card in three will render this way at launch; that is a data frontier (PB-G2, §8), not a design defect, and no design device in this delta disguises it.

### 6.4 Payload build inputs (closed list)

1. `VarietyListItem` gains `cropMedia` (media array, `[]` when none, never omitted — the established media convention), populated batched by plant in the variety-list path, exactly as `listings()` already populates it for `VarietyRef`. No other field changes; **no price field enters any payload** (the standing grep check applies).
2. No Latin payload work: `plant.latinName` is already present in both card payloads (§6.1).
3. The shop grid consumes the existing `PublicListing` payload entire (media, cropMedia, plant incl. `latinName`, packetSizes, availability, lastCheckedAt, notes, id) — the same fields the ledger renders today. Nothing new is fetched for the shop side.

---

## 7. Slots for the collaborator deltas

### 7.1 Mina (UI design) — visual values, hers to rule

Grid composition from §3's structure: grid gap and card padding in the shop context (the browse grid's `gap-2` is the starting point — one grid system argues for one gap); the grown fixed text-zone height (browse zone + one Latin line; the shop zone's taller fact block, including the pinned footer's spacing); the Latin line's visual dress *within* Thea's type ruling; the shop footer's composition (Report / pill row at the card's bottom); sold-out dress values transferred without invention; `VarietyCardSkeleton`'s new bars and the shop results-region skeleton (grid skeleton at the page's count); forced-colors treatment of the artwork frame (a true color specimen under the SH-16b precedent). No new tokens are proposed by this delta; if her composition needs one, it is flagged in her pass, not assumed here.

### 7.2 Elena (art direction) — two rulings asked

1. **Tier-order harmonization (§4.3)**: confirm crop-plate-as-tier-2 on the browse grids (her binding plate rule, against the shipped pod-first card behavior), or rule pod-first globally with the shop consequence named there. Include the placeholder ground (`paper-deep` per her C6 vs shipped `bg-paper`).
2. **Tier 4's in-frame stem (§4.4)**: confirm it stays as the last-resort frame-holder, or name its replacement device. Also her concurrence on the 1:2 whole-plate frame at shop-grid size (§3.2) — the plates' treatment at grid size was expressly left open by the commission, and her doctrine is the one it answers to.

### 7.3 Thea (typography) — the Latin slot's treatment

The slot is specced (§4.2, §6.2): one line position, verbatim stored string, both contexts identical. Hers to rule: italic treatment (the site precedent is `<i>` on the variety/crop pages — confirm the card follows it), size/leading/color within the card's type system, case (stored strings are sentence-case binomials; the variety-page eyebrow forces `normal-case` — the card should not uppercase a binomial), and the wrap/clamp behavior for the 8 multi-species strings and long binomials at 2-column phone width, under §6.2's no-rewriting constraint. Also the grown zone's line rhythm with Mina.

### 7.4 Wren (copy) — the card's remaining wording

No new copy is introduced by this delta. Wren's pass reviews the card's surviving strings as one set, in both contexts: the crop line, the seller-count line ("N sellers" / the zero-seller short line), the stock line's words and checked-date phrasing (inherited from the ledger — confirm they still read correctly on a product card), packet-size labels (unchanged component), and the "Visit shop →" pill (already hers; unchanged). The Latin line is data, not copy — no wording slot exists for it, and none may be created (no "Latin:" prefix label is designed in; the italic botanical line under a plate needs no label, and a label would be one more thing for Latin-less cards to lack).

### 7.5 Ada (accessibility) — floors stated, values hers

Floors this delta states for her ruling: (a) shop-context heading structure — the variety name is an `<h3>` under the section `<h2>`, as the ledger's was; browse context keeps its no-per-card-heading pattern; (b) the browse card's `aria-label` ("{varietyName} — {crop}") versus the new Latin line — my recommendation is the label stands (a concise name beats a four-part name including a possible three-species string) and the Latin line is visible text inside the link; she rules; (c) focus order inside the shop card (heading link → Report → pill), all targets ≥44px, focus never obscured in the grid; (d) the Latin line and stock dot are never the sole carriers of anything (Latin is supplementary text; stock keeps its word beside the dot, as today); (e) absence (§6.3) must not produce an announcement or a layout shift — the fixed zone is the mechanism, she verifies; (f) the grid at 320px and 200% text reflows without horizontal scroll, as the browse grid already must.

---

## 8. Pushback and open questions

- **PB-G1 — The artwork was already complete; say so before anyone "fixes" data.** §2.1's measurement (100% of listings already show a real plate) matters beyond this design: any narrative that PR #13 "didn't ship" or that sellers' varieties "have no images" in the data is false, and acting on it (a data or crawl task) would waste a commission. The defect was presentation geometry — 72px and a list — and this delta is scoped to exactly that.
- **PB-G2 — One card in three will have no Latin line, and the remedy is catalog work, not design.** 269 varieties across 74 crops (§6.3). I recommend Hue commission the sourcing of `latinName` for the 74 crops as a catalog task in the catalog seat's own provenance discipline (a sourced binomial per crop, recorded per field) — it is cheap, bounded, and it completes Dustin's addition in a way no card treatment can. Until then the absence rule (§6.3) is the design, and Quinn's checks treat a missing line as correct rendering, not a defect.
- **PB-G3 — Against making the shop card a whole-card link for "shop feel".** Considered at §3.4 and rejected on structure (two destinations + a utility link), not taste. If Dustin wants the whole card tappable, the honest price is losing the in-card Report link or demoting the variety page to a secondary tap target — neither is worth it; the name and the pill are both large, clear targets.
- **PB-G4 — Against a shop-only frame aspect to shorten the scroll.** A 4:5 or square frame would contain-fit the 1:2 plates into a smaller picture with more paper — less product, not more — and would fork the card (§4.1). The scroll cost is real (§3.5) and is the commission's trade to make knowingly; it is recorded here rather than engineered around.
- **OQ-G1 — Page size, if the grid scroll proves heavy.** `PAGE_SIZE` stays 24 (§3.5). If Quinn's drives or Dustin's own phone say a 24-product grid page is too long *for shops*, the remedy is a shop-specific page size — a one-line ruling for Dustin, deliberately not taken here because the constant is shared and the evidence does not exist yet.

---

## 9. Acceptance checks — for Quinn's delta gate (all executable; series SH-G, see §10's collision note)

Run in a fresh scratch worktree per the standing gate approval; before/after comparisons against pre-build `origin/main`. Real-browser drives at 390px first, then 820px and 1280px. Test surfaces: GeoSeed (179 listings, 8 pages), 3 Porch Farm (34), a ≤8-listing seller, a 0-listing seller; browse surfaces `/variety`, one crop page (Zinnia — Latin-carrying), one crop page whose crop lacks Latin (Marigold), a series page, and a variety page's sibling grid.

- **SH-G1 (grid replaces ledger, seller page only):** on GeoSeed and 3 Porch Farm, the results region renders a grid of variety cards (2 cols at 390px, 3 at 820px, 4 at 1280px) and zero `ListingRow` seller-context cards; on a variety page, the listing cards are byte-identical to pre-build (variety context untouched, wheat-stem rule present).
- **SH-G2 (art dominance and wholeness):** DOM-measure a page-1 GeoSeed card's art frame on both axes at 390px: frame width equals card content width (not 72px), aspect 1:2, image `object-contain`, no `object-cover` or crop transform anywhere in the new card code or rendered URLs; every one of the 24 page-1 cards shows a plate image (14 variety + 10 crop, per §2.1's live count, or the then-current equivalent).
- **SH-G3 (tier order, both contexts):** fixture or find one card per tier: own plate → variety alt; plateless variety (e.g. a pansy variety without media) → its crop's plate with the crop-name alt, on *both* a browse grid and the shop grid; tiers 3–4 exercised by fixture only (no live case exists) and render the pod device decoratively on `paper-deep` (`alt=""`, `aria-hidden`) — tier 3 the crop's own pod device, tier 4 the generic pod device (ART-GRID-CARD §2).
- **SH-G4 (motif out):** rendered DOM of every grid surface in SH-G1's list contains zero stem elements of any class inside variety cards — no `divider-stem-mini` element and no in-frame `divider-stem` placeholder — in plated, placeholder, filtered, searched, and skeleton states (an in-frame placeholder stem inside a variety card counts as the motif's presence: ART-GRID-CARD §2); the `divider-stem-mini` class still renders in the header wordmark lockup (grep + rendered check) — removal of the class itself is a FAIL.
- **SH-G5 (Latin in — presence):** a Zinnia card renders the Latin line "Zinnia elegans" verbatim, positioned between the art frame and the variety name, in both browse and shop contexts; a milkweed-crop card renders its full multi-species string verbatim ("Asclepias tuberosa / A. incarnata / A. physocarpa" — no truncation that drops a species, no recomposition); a Dahlia card renders "Dahlia × hybrida" with the hybrid marker intact.
- **SH-G6 (Latin absence):** Marigold and Pansy browse cards and a Latin-less shop card (GeoSeed carries 27) render **no** Latin line, no placeholder text, no "unknown" string, and no empty reserved slot; card height equals a Latin-carrying neighbour's in the same row (fixed zone); a DOM diff of the card against its data shows the line absent iff `plant.latinName` is `null` (spot-check ≥10 cards each way, incl. one mix-named variety with Latin and one without).
- **SH-G7 (one component):** the same variety rendered on `/variety` and on its seller's shop page shows identical art frame, Latin line, name, and crop line (geometry and content); the only differences are the ruled context blocks (browse: seller-count line + whole-card link; shop: stock line, packets where present, notes where present, Report + pill footer).
- **SH-G8 (shop card facts and commerce):** on GeoSeed page 1, every card's stock line matches its listing's availability + checked date; packet sizes render where the listing carries them and nowhere else; every pill targets `/go/{id}` in a new tab with `nofollow`; a sold-out card (13 on GeoSeed) shows stepped-down ground + outline-only working pill + full-fidelity plate; no price string appears in any rendered state or in the §6.4 payload (grep + rendered check).
- **SH-G9 (pagination and bounds under the grid):** GeoSeed renders 24 cards per full page; unfiltered bounds unchanged (page 8 = 200, page 9 = true 404); under a filter narrowing GeoSeed, the last in-range page answers 200 and the next a true 404 against the narrowed total; full pages leave no orphan row at 2, 3, or 4 columns.
- **SH-G10 (thresholds and in-place behavior unchanged):** the ≤8 shop shows no tools; the 9–24 shop shows filters + sort, no search; GeoSeed shows all three (base SH-2 expectations); driving filter → hue multi-select → sort → search on GeoSeed updates the grid in place (no document load, focus and scroll preserved, ≤400ms, one history entry per deliberate change, one live-region announcement per change) and every intermediate state renders grid cards — never ledger cards.
- **SH-G11 (states):** filtered-to-empty and searched-to-empty render the base SPEC's designed states inside the region (not as empty grids); the 0-listing shop is unchanged; a fixture all-sold-out shop shows the §9.4 notice above a grid of stepped-down cards; the region's loading skeleton is the grid skeleton with no mini-stem bar (SH-G4 applies to skeletons).
- **SH-G12 (payload):** `VarietyListItem` responses carry `cropMedia` (`[]` when none, never omitted) with no other shape change; seller-page payload is unchanged from pre-build; the Latin line's rendered string equals the payload's `plant.latinName` byte-for-byte on every spot-checked card.
- **SH-G13 (accessibility floor inputs for Ada):** at 320px and 200% text, both grids reflow without horizontal scroll or clipped focus; keyboard walk of a shop card visits heading link, Report, pill in that order with visible focus; a screen-reader pass over a browse card announces the ruled accessible name (§7.5b as Ada rules it) and over a shop card announces the `<h3>` name, stock word, and pill purpose; stock state is never carried by the dot alone.
- **SH-G14 (register audit):** the before/after comparison across all test surfaces shows exactly §10's G-1…G-9 and nothing else — in particular, the wordmark mini stem, the homepage packet cards, the footer stem, and the variety page's ledger cards are all still present and unchanged.

---

## 10. Difference register — against the base SPEC (and a numbering note for Quinn)

| ID | Difference | Base SPEC / prior locus |
|---|---|---|
| G-1 | **Repealed in part:** the seller page's Quiet Ledger cards are no longer protected as byte-identical; they are replaced by the grid (§3). The protection survives for variety context only. SH-10 must be re-scoped to variety context + §3.3's shop fact lines. | Amends base SPEC §12 ("must NOT change" list) and §13 SH-10 |
| G-2 | **New:** the shop results region renders `VarietyGrid` (2/3/4 cols) of the unified variety card in shop context (§§3.2–3.3), in every shop state (§3.5). | Amends base SPEC §3.3 item 5 (results region composition) |
| G-3 | **New:** the variety card's anatomy changes on every grid surface — mini stem out, Latin line in (§4.2); fixed text zone grows by one line (Mina's value). | New surface change; the base SPEC did not govern the browse card |
| G-4 | **Superseded:** PR #13's `ListingArtwork` rail on the seller page; its tier logic moves into the unified card; the component retires with no remaining caller (§3.6). | Supersedes PR #13's presentation (its data path, `VarietyRef.media`/`cropMedia`, is retained and extended by G-5) |
| G-5 | **Payload:** `VarietyListItem` gains `cropMedia` (§6.4.1). The browse grids gain tier-2 crop-plate rendering (§4.3, Elena's slot). No Latin payload change; no price field. | Extends base SPEC §11's payload discipline to the browse list path |
| G-6 | **Skeleton:** `VarietyCardSkeleton` loses the mini-stem bar, gains the Latin bar; the seller page's results skeleton becomes the grid skeleton. | Amends the seller skeleton's opt-in rail variant (PR #13) |
| G-7 | **Unchanged, stated to prevent drift:** thresholds (§8), `PAGE_SIZE` = 24, true-404 bounds, in-place contracts, counts/live region, empty states, contact block, Locations area, header. | Base SPEC §§3–10 and SPEC-LOCATIONS stand |
| G-8 | **Scope fence:** `.divider-stem-mini` the class, its wordmark and homepage packet-card instances, the ledger's wheat-stem rule in variety context, and all other stem placements are untouched (§§4.4–4.5). | New fence; no base text contradicted |
| G-9 | **New checks** SH-G1…SH-G14 (§9). | Extends base SPEC §13 |

**Numbering collision — for Quinn to settle (flagged, not resolved here).** The identifier `SH-15` currently names two different checks: Quinn's design-gate amendment **A-1** added an SH-15 (focus landing) to the base SPEC §13 series (which also gained SH-16a/SH-16b and SH-17 from A-5), while my locations delta (`SPEC-LOCATIONS.md` §10) independently used **SH-15…SH-20** for the locations checks — so SH-15, SH-16, and SH-17 are each double-assigned across the assembled record. This delta's checks are numbered **SH-G1…SH-G14** precisely to avoid adding a third claimant. Recommendation to Quinn: renumber the locations series (e.g. SH-L15… or fold into her amended series) at the delta gate, since the base §13 series has the stronger claim to the bare numbers (it was amended into the SPEC itself); whichever way she rules, one series must move before a build brief cites any of them.

**Sequencing note for Hue.** The live page still renders the pre-shop presentation (§2.1), so the base shop build has not shipped. If it is still unbuilt when this delta is briefed, fold G-1…G-9 into the shop build brief as amendments to the S-register (the results region is built once, as a grid) — do not build ledger cards in order to replace them. If the shop build has shipped by then, this delta is a results-region swap in its own worktree, gated by §9 alone.

---

*— Nadia, UX Design. Evidence: base SPEC and SPEC-LOCATIONS read back from `origin/main`; code from `origin/main` via `git show` (`VarietyCard.tsx` incl. its anatomy comment, `VarietyCardImage.tsx`, `ListingRow.tsx`, `ListingArtwork.tsx`, the seller page's list composition, `Skeleton.tsx`, `validators/index.ts` — `PlantRef` / `VarietyRef` / `VarietyListItem`, `globals.css` — `.divider-stem-mini` / `.listing-stem-rule`); `VARIETY-FACTS-SCHEMA.md` row 29 and `SPEC-CANONICAL.md` §2 (plant-level scientific name); PR #13's design pair (`seller-listings-photo-design/UX-STRUCTURE.md` §2.4's flagged card-fallback conflict; `UI-VISUAL-SPEC.md`) and Elena's C6 designed-placeholder ruling (`ui-audit-2026-11-20`); live production probes 2026-11-22 via `curl` — the GeoSeed shop page (24 rails, 14 variety + 10 crop plates, "179 listings · page 1 of 8") and full public-API crawls at `catalog_seq 4618`: all 812 varieties (543 with inherited Latin, 229 without their own plate), all 124 crops (50 with Latin, 124 with plates), all 83 sellers' 1,489 listings (1,156 variety-plate / 333 crop-plate / 0 fallback tiers; 1,005 with Latin). No code was written or changed by this delta, and no other specialist was dispatched.*
