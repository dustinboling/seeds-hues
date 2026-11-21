# Seller listings with product photos — UX structure ruling

**Seat:** Nadia, UX Design · **Surface:** Seed Directory (seeds.hues.flowers), seller profile page (`/seller/{slug}`, e.g. `/seller/geoseed`) · **Date:** 2026-11-20
**Direction from Dustin (2026-11-20):** listings on a seller's profile page are plain text boxes with no photos; each listing should carry its product photo, product-forward in the spirit of the variety page — but **not** a copy of the variety page. The seller page keeps its own identity.
**Method:** profession best practice first (Nielsen heuristics, Gestalt grouping, Jakob's Law, Baymard-style list scanning), then Dustin's house standards; house wins. Conflicts are flagged, not silently resolved — see §2 and §7.

---

## 0. Audit of the current surface (before designing)

What exists today, verified in `~/workspace/seeds-hues/v2`:

- Seller page (`v2/app/seller/[slug]/page.tsx`): header (type eyebrow, seller name, Small Farm badge row, location / varieties / rating facts, Visit website button, state plate) → About → imported-rating panel → **"Listings at {seller}"**: a vertical stack of cards, paginated at `PAGE_SIZE` = 24, then the Pagination control.
- Listings render through the shared `v2/components/variety/ListingRow.tsx` (Quiet Ledger card, Dustin's pick 2026-11-20) with `context="seller"`: variety-name heading linking to `/variety/{slug}`, plant common name subline, status line (dot + availability word + friendly checked date), packet sizes, notes, stem rule, footer ("Report a problem" left, "Visit shop →" pill right via `/go/{id}`, new tab). **There is no image element anywhere in the card.**
- The data cannot support a photo today: `PublicListing.variety` (`VarietyRefSchema`, `v2/lib/validators/index.ts`) carries `{slug, varietyName, plant, colorSwatch}` — no media — and the catalog service's `listings()` mapper (`v2/lib/services/catalog.ts`, `mapListing`) attaches only packet sizes.

**Problems this ruling fixes:**

1. **Findability / scanning (the core defect).** Twenty-four text-only cards per page force serial reading: a shopper hunting one variety must read every heading. A recognisable plate per card turns the list into a scannable product index — recognition over recall, and the Von Restorff effect working for the shopper instead of against them. This is the e-commerce first law in list form: if the user cannot find the product, the listing does not exist for them.
2. **Identity blur in the other direction.** The naive fix — pasting the variety page's full-width 1:2 hero frame into each card — would make the seller page a slower, worse variety grid and bury the seller (the page's actual subject) under 24 portraits. Plates are 1:2 (1120×2240); at card width on a phone that is ~650 px of art per listing. Rejected in §1.
3. **A latent artwork-rule conflict** between Elena's fallback rule and the existing card-image fallback — ruled on explicitly in §2, not papered over.

**What is not broken and is not redesigned:** the seller header and its primacy, the Quiet Ledger card itself, the status line, the footer, pagination, and the variety-context card. See §5.

---

## 1. Card anatomy — seller context

### 1.1 The ruling in one line

In seller context only, the Quiet Ledger card gains a **left artwork rail**: a fixed-width, fixed-aspect (1:2) frame holding the variety's plate **whole**, beside the existing text column, with the existing stem rule and footer spanning the full card width beneath both. The card stays a ledger entry about *this seller's listing of that variety* — it does not become a variety card.

### 1.2 Layout by width

The card's outer shell is unchanged (radius 18 px, border, surface/paper ground, sold-out step-down, existing padding `px-4 pb-3 pt-[18px]`). Inside it:

```
┌──────────────────────────────────────────────┐
│ ┌─────┐  Variety name (h3, link)             │
│ │     │  Plant common name                   │
│ │ art │  ● In stock · Checked Nov 12         │
│ │     │  Packet sizes…                       │
│ │     │  Notes…                              │
│ └─────┘                                      │
│ ─ ─ ─ ─ ─ stem rule (full width) ─ ─ ─ ─ ─ ─ │
│ Report a problem              [ Visit shop →]│
└──────────────────────────────────────────────┘
```

- **Phone (320–639 px) — the primary surface.** Two-column internal grid: artwork rail **72 px** wide, **12 px** gap, text column `1fr` with `min-w-0` (long variety names wrap inside the column; they never push the rail or overflow). Frame is `aspect-[1/2]` → 72×144 px. The text column keeps today's exact internal order and spacing: heading row → common-name subline → status line → packets/notes block. Stem rule and footer move *below the grid* and span the full card width, exactly as wide as they are today.
- **iPad portrait / small tablet (640–1023 px).** Same single-column list (the seller page is a profile with a reading flow; nothing about a wider viewport changes that job). Rail widens to **96 px** (96×192 frame), gap **16 px**. Everything else identical.
- **Desktop (≥1024 px, `lg`).** The **list** changes, the card does not: the listings `<ul>` becomes a **2-column grid** (`lg:grid-cols-2`, same 12 px gap). Rail stays 96 px, gap 16 px. Rationale: the page container is 72 rem; a single column of ~1150 px-wide ledger cards gives unreadable line lengths and wastes the desktop surface (house rule: desktop must be a proper desktop website, not a stretched phone layout). Two columns halve the scroll length of a 24-listing page while each card (~550 px) keeps a comfortable text measure. This is deliberately **not** the variety grid (2/3/4/5 columns of whole-card links with art on top): two ledger columns with art on the *side* reads as a seller's catalogue, not a variety index — the seller page keeps its identity.
  - Cards in a desktop row stretch to equal height (`h-full` on `<li>`/`<article>`). The footer is **not** pinned to the card bottom: it flows after the content as today. Pinning would tear the stem rule away from the packets it closes and leave floating gaps under short listings; ragged footer positions inside equal-height cards are the honest ledger look.
  - iPad landscape (≥1024 px) takes the desktop 2-column rule; iPad portrait stays single-column. The breakpoint is `lg`, stated once so builder and QA test the same line.

### 1.3 The artwork frame

- **Whole, always.** `object-contain` on the existing `bg-paper` ground, inside the fixed 1:2 frame, served through `v2/lib/images.ts` (`fit=scale-down`, our own `images.seeds.hues.flowers` R2 — never cropped, never stretched, never hotlinked). The fixed aspect reserves the box before the file arrives: zero layout shift, which matters 24 times per page.
- **Not a link.** The variety-name heading directly beside it already links to `/variety/{slug}`. Wrapping the art in a second link to the same destination adds a duplicate tab stop and a large accidental-tap target while scrolling; the card's primary outbound action remains "Visit shop →". Ruled against deliberately (Jakob's Law argues for tappable product images; the heading link 12 px away satisfies the destination, and focus-order cleanliness wins — flagged in §7 as the one judgement call worth user-testing later).
- **Not interactive, not decorative — informative.** It carries the variety's identity, so it gets real alt text (§2.3), but no information lives *only* in the image: name, availability, packets and the CTA are all text, unchanged (Ada's floor).
- **Loading:** `loading="lazy"`, `decoding="async"` (these listings sit below the seller header; the header/state plate keeps LCP priority). Request the existing 480-wide transformation; set `sizes` to the rail (`72px` below `sm`, `96px` at `sm` and up) if a srcset is offered, so no browser pulls the 768 candidate for a 96 px slot. Width/height attributes follow the existing card-image pattern (480×960).
- **Sold out:** the plate renders at **full fidelity** — no greying, no opacity cut, no grayscale. Sold-out is already carried three ways (card ground step-down, softened shadow, status word in petal). Dimming Elena's artwork would add a fourth signal by degrading the product's identity, which is the one thing a sold-out listing still needs to communicate ("this is the one to come back for"), and the working outline-style "Visit shop →" pill stays exactly as it is.
- **Top-aligned rail.** When notes make the text column taller than the frame, the frame sits at the top beside the heading (Gestalt proximity: art binds to the name it illustrates) and paper shows beneath it. The frame never stretches to match the text.

### 1.4 What the seller page around the cards does

Nothing moves. Header first and primary, About, imported-rating panel, then "Listings at {seller}" with its count line — the seller stays the page's subject; the photos make the *listings section* product-forward without promoting it over the profile. The section heading, count text and Pagination are untouched (see §5 on pagination).

---

## 2. No-plate fallback ruling

### 2.1 The conflict, flagged plainly

- **Elena's artwork rule (binding):** a variety without its own plate uses **its crop's plate**.
- **Existing code:** `VarietyCardImage.tsx` (variety grids) falls back to the crop's seed-pod **motif** (`podArtForPlant` → `/ornaments/motif-<key>.webp`, decorative), else the divider-stem placeholder. The motif is *not* the crop's plate.

These conflict wherever a crop plate exists but a variety plate does not: the existing component shows a decorative pod where Elena's rule requires the crop's actual plate. The seller listing must not silently inherit that conflict.

### 2.2 Ruling — a four-tier resolution, seller context

The seller-listing artwork resolves in this order, first hit wins:

1. **The variety's own first plate** (`variety.media[0]`, media-id order — the same first plate the variety page hero uses).
2. **The crop's first plate** (`variety.cropMedia[0]` — plant media, `/artwork/crops/…`), shown whole in the same frame. This is Elena's rule, and the data path already exists (`repo.listMediaForPlants`, §3). A seller page will repeat one crop plate across several of that crop's varieties; that repetition is truthful and is a scanning *aid* (same-crop listings visually group), not a defect.
3. **Only when the crop has no plate either:** the crop's seed-pod motif, exactly as `VarietyCardImage` renders it today (decorative).
4. **Otherwise:** the divider-stem placeholder (decorative). Never a broken image, never a stock photo, never a guessed painting of the variety.

### 2.3 Alt text follows the tier (Ada's floor)

Alt text must say what the image actually is — a crop plate labelled as the variety would be a false alternative:

- Tier 1 (variety plate): `"{varietyName} — illustration"` — the existing pattern, unchanged.
- Tier 2 (crop plate): `"{plant common name} — illustration"` — mirroring `CropCardImage`'s existing pattern.
- Tiers 3–4 (motif / stem): `alt=""`, `aria-hidden="true"` — decorative, exactly as today.

### 2.4 Scope note on the conflict

This ruling governs the **seller listing** only. The same conflict exists in `VarietyCardImage` on the variety/crop/series grids; changing those surfaces is **out of scope** for this build and is **not** authorised by this ruling. It is flagged here for Hue to route to Elena as a separate decision — harmonising the grids is her call, not a side effect of this task.

---

## 3. Data-attachment ruling

### 3.1 Where the artwork data attaches

**On the listing's variety ref.** `VarietyRefSchema` gains two fields, so every `PublicListing` carries:

```ts
variety: {
  slug, varietyName, plant: { … }, colorSwatch,
  media:     Media[],   // the variety's own plates, media-id order; [] when none, never omitted
  cropMedia: Media[],   // its plant's (crop's) plates, media-id order; [] when none, never omitted
}
```

- `VarietyRefSchema` is used in exactly one place — inside `PublicListingSchema` — so this extends the one public listing shape without touching variety summaries, detail pages or search results.
- **Two raw arrays, not one pre-resolved "artwork" field.** Existing schemas consistently carry raw media and let the component resolve the first plate (`VarietyListItem.media`, `CropListItem.media`, `VarietyDetail.media`). A pre-resolved field would (a) break that convention, and (b) destroy information the component needs: §2.3 requires different alt text per tier, so the renderer must know *which* tier resolved. Keep resolution in the component (§4), data in the service.
- Field naming follows the house pattern (`media` everywhere media appears today); `cropMedia` names the plant's plates unambiguously from the variety's point of view.

### 3.2 Where it is populated

**In the one shared funnel: `listings()` in `v2/lib/services/catalog.ts`.** It is the sole caller of `mapListing` and every listing surface flows through it (`getSeller`, `sellerListings`, `varietyListings`, the listings endpoints). Extend it to make **two batched fetches** alongside the existing packet grouping:

- distinct `varietyId`s of the returned rows → `repo.listMediaForVarieties` (already exists, chunks at 50 ids);
- distinct plant ids → `repo.listMediaForPlants` (already exists, same chunking).

`mapListing` gains the two resolved arrays as parameters (defaulting to `[]`), mapping rows through the existing `toMedia`. One wrinkle the builder must handle: `PublicListingRow` / `listingSelect` does **not** currently select `plants.id` (`plantRefCols` carries season/methods, not the id) — add `plantId: plants.id` to `listingSelect`. It is an internal row field only; it does not enter the public schema.

**Cost, stated honestly:** two extra batched queries per `listings()` call, bounded by distinct ids (a 24-listing seller page: ≤24 variety ids, typically a handful of plant ids). No N+1. `getSeller` loads all of a seller's listings before the page slices its 24, so media attaches for the full set, not just the visible page — acceptable at directory scale, and it keeps the service free of page-slice knowledge.

### 3.3 The variety context does **not** change

- Data: the variety-context card receives the same enriched `PublicListing` (the schema is one shape — a seller-only data fork would split the "ONE public listing shape" the validators file declares, and diverge the API, `/recent` and `/sync`, which all share `PublicListingSchema`).
- Rendering: `ListingRow` in variety context renders **no artwork and no new wrapper** (§4) and ignores the new fields. The variety page already sits beside its painting (hero plate + variety grid); a second plate inside each seller card there would duplicate the hero and demote the seller — the actual heading in that context. Default confirmed: **variety context is byte-for-byte the card it is today.**

### 3.4 Contract flag for the lead

`PublicListingSchema` is also the OpenAPI `Listing` and the `/sync` payload. Adding two **required** arrays is a visible contract change for those consumers. Required-with-`[]` is the right shape (it matches the established media convention — "[] when none, never omitted" — and keeps parsers fail-loud rather than silently optional), but Hue should note it as a contract change in the build brief, not discover it in review.

---

## 4. Component ruling — slot in `ListingRow`, artwork in its own component

**Ruling: `ListingRow` gains a seller-context artwork slot; the artwork itself is a new dedicated component. No separate seller-listing card component.**

```
// v2/components/variety/ListingArtwork.tsx  (new)
export function ListingArtwork({ media, cropMedia, varietyName, commonName, plantSlug })

// ListingRow.tsx (modified)
{context === "seller" ? <ListingArtwork … /> : null}   // inside the §1 grid, seller context only
```

Reasoning:

1. **One Quiet Ledger, not two.** The card's load-bearing behaviours — status tones, sold-out ground/shadow/pill treatment, stem rule, footer, report link, the badge rule — are shared, already Quinn-gated, and certain to evolve. A separate `SellerListingRow` duplicates all of it; every future fix then has to land twice, and the two copies *will* drift (consistency heuristic, and this codebase's own history of shared-module divergence). `context` already decides the heading and the badge inside this component; an artwork slot is the same established pattern, not a new one.
2. **But not `VarietyCardImage` reused, and not logic inlined in `ListingRow`.** `VarietyCardImage` cannot be reused as-is: its frame is full-width with grid `sizes`, it carries a `mb-2` for grid stacking, and its fallback is the tier-3 motif only — reusing it would import the §2 conflict and the wrong geometry. Adding props to fork its behaviour would bend a grid component into a rail component. A small dedicated `ListingArtwork` owns the four-tier resolution and per-tier alt text in one testable place, leaves `VarietyCardImage` untouched for the grids, and keeps `ListingRow`'s diff to a grid wrapper plus one element.
3. **Seller-only means seller-only.** In variety context the component renders no artwork node and no grid wrapper — the existing flat layout is the render path, so the variety page cannot regress spacing, focus order or card height from this change. The builder must prove this (variety-page listings diffed before/after, §6), not assert it.
4. **The seller loading skeleton follows the same split.** `ListingSheetSkeleton` (`v2/components/ui/Skeleton.tsx`) is shared by the seller and variety loading pages. Give it an opt-in seller variant (e.g. `artwork` prop, default off) that adds the rail block (72 px / 96 px at `sm`) inside the card and, on the seller page, the `lg` 2-column list — seller `loading.tsx` opts in, variety `loading.tsx` is untouched. A skeleton that promises the wrong shape causes exactly the jump the playbook forbids.

---

## 5. What changes, what deliberately stays

### Changes (seller context / seller page only)

| # | Change |
|---|---|
| C1 | Card gains the §1 artwork rail (72 px phone / 96 px `sm`+), text column beside it, stem rule + footer spanning full width below. |
| C2 | Listings list becomes 2 columns at `lg` on the seller page (card internals unchanged at that breakpoint). |
| C3 | `VarietyRefSchema` gains `media` + `cropMedia`; `listings()` populates them batched; `listingSelect` gains internal `plantId` (§3). |
| C4 | New `ListingArtwork` component with the §2 four-tier resolution and per-tier alt text. |
| C5 | Seller loading skeleton gains the rail (and `lg` 2-column) via an opt-in skeleton variant. |

### Deliberately kept — do not "improve" these in this build

- **Seller header stays primary and unchanged** — order, badge row, facts, Visit website button, state plate. Listings remain below About and the imported-rating panel.
- **Pagination unchanged.** Same `PAGE_SIZE` (24), same slicing, same `Pagination` component, same URLs. The artwork changes how a listing *reads*, not how many belong on a page; changing the page size would rewrite existing page URLs and counts with no evidence behind it. Desktop's 2-column grid already halves the perceived length.
- **Prices are never shown (R1).** No price appears anywhere in the new anatomy; packet sizes remain labels/counts only.
- **Sold-out listings keep a working "Visit shop →"** — outline style, never disabled, never removed; artwork at full fidelity (§1.3).
- **Status line unchanged** — dot + word + friendly checked date, in text, in the text column. Availability is never carried by the image, its presence, or its absence.
- **Heading hierarchy and link targets unchanged** — variety name is the card's `h3` and its only variety link; "Report a problem" and the footer order are untouched; both footer targets keep their 44 px heights.
- **Focus order unchanged.** The artwork is a non-interactive `<img>`; the interactive order (variety link → Report a problem → Visit shop) is identical to today, and no focusable element is added, moved or hidden behind fixed chrome.
- **No Small Farm badge change.** Seller context shows no badge today (the seller's badge lives in the page header); the artwork build does not add one to the card.
- **No colour-swatch element.** `variety.colorSwatch` exists in the data and stays unused in this card — the plate supersedes it; adding a swatch chip would be decoration competing with the artwork (minimalist heuristic).
- **Variety-context card: completely unchanged** (§3.3, §4.3).
- **No new colours, no new type.** The frame reuses the existing `bg-paper` ground and the card's existing border/shadow tokens; all text keeps its current faces and sizes. Because this ruling makes no colour or typography decisions, no colour-theory or typography pass is triggered by it; if the builder wants any new tint or treatment, that is a new decision and routes through the colour specialist plus an Ada contrast check before it ships.

---

## 6. Verification required before handoff (builder + Quinn)

Per the UX playbook's proof standard — rendered surface, not file match:

1. Screenshots of a real seller page at **390 px** and at **desktop width**, plus a **320 px** pass (rail + longest variety name: no horizontal scroll, no clipped text) and **200 % text resize**.
2. DOM-measure the rail on both axes at phone and desktop (72×144 / 96×192) — a fitted element is verified by its rendered rect, never by eyeballing a screenshot.
3. A seller whose listings cover **all four fallback tiers**, incl. a variety with no plate whose crop has one (tier 2 must show the crop plate, not the motif), and a sold-out listing (art full fidelity, pill working).
4. Keyboard walk of one page: focus order and visibility exactly as §5; screen-reader pass confirming tier-1 vs tier-2 alt text and silent tiers 3–4.
5. Variety page listings rendered before/after the change and diffed — the variety-context card must be identical.
6. Contrast: unchanged pairings only (no new text/background combinations are introduced); confirm the status line over the sold-out paper ground still measures as it does today.
7. Check the deployed page live after release, not only the local build.

---

## 7. Flags and open items for the lead

1. **⚠ Elena conflict (needs her ruling, grids only):** `VarietyCardImage`'s motif fallback conflicts with Elena's "crop's plate" rule on the variety/crop/series grids. This ruling fixes it for seller listings only (§2.4); the grids await Elena's separate call.
2. **Contract change:** `PublicListing` (OpenAPI `Listing`, `/sync`) gains two required arrays (§3.4) — note it in the build brief.
3. **Judgement call left visible:** artwork is not a link (§1.3). If user testing ever shows shoppers tapping plates and stalling, revisit — the heading link is the current answer.
4. **No colour/typography decisions** are made in this ruling (§5); any builder-introduced tint or type change is out of brief until it clears the standing colour/typography collaboration and Ada's floor.
