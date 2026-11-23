# State Outline Icons — Variety-Page Listing Card: Subline Structure Spec (A5)

**Seat:** Nadia, UX Design · **Commission:** Dustin, 2026-11-22 16:41 PT, verbatim: "Yes — state outlines on variety-page listing cards too." This rules the SI design package's one open scope question **IN**: Mina's N5 / Quinn's design gate §6.3.
**Site:** Seed Directory (seeds.hues.flowers), app code in `v2/` · **Code basis:** `origin/main`, read via `git show` (`v2/components/variety/ListingRow.tsx`, `v2/components/seller/SellerCard.tsx`, `v2/components/seller/StateShape.tsx`, `v2/lib/data/states.ts`), cross-checked against the gated SI package (`PLACEMENT-SPEC.md`, `IRIS-COLOR.md`, `ADA-RULINGS-SI.md`, `QA-GATE-design.md`) and the shop programme's locations spec (`shop-design/SPEC-LOCATIONS.md` §1.1, F-L2).
**Status:** Structure decided; build-ready as structure. Three follow-ons are flagged, not decided here (§7): **Mina's placement pass** for A5 (size/token/gap on this card), **Iris's extension** of the `currentColor` ruling to A5, **Ada's extension** of the decorative classification and floor rulings to A5. Quinn design-gates this delta after Mina's pass.

---

## 0. Audit of the current surface — what is actually broken

The surface is the **Quiet Ledger listing card in variety context** (`ListingRow.tsx`, `context === "variety"`): the seller listings under a variety. Its subline today is one line of free text:

```tsx
<p className="mt-listing-subline text-base text-muted">
  {context === "variety" ? (l.seller.location ?? (region || "Location unknown")) : …}
</p>
```

where `region = [l.seller.region, l.seller.country].filter(Boolean).join(", ")`. Measured defects, in the terms of the SI gate record:

1. **The state is never rendered as structured data here** (Mina N5, verbatim). The subline prefers the seller's free-text `location` string; when that is absent it falls back to the **raw code pair** ("OR, US"). A `StateShape` icon is keyed by USPS code; bolting it onto either string would decorate data the directory does not stand behind — the reason this surface was ruled out, correctly, until the structure changed.
2. **The raw-code fallback speaks the system's language, not the user's** (heuristic: match between system and real world). "OR, US" is an internal representation leaking into a shopper-facing card; every other directory surface prints the state's name.
3. **Inconsistency with the directory's own cards** (heuristic: consistency and standards). The same seller, on the seller index and state pages, appears on `SellerCard` (A3) with a structured state segment — "· [icon] {state name}" keyed off `stateByCode(s.region)`. On the variety page, where a shopper is comparing sellers of one variety side by side, that seller's state is the *least* legible of any surface. The variety context is precisely where state comparison matters (which of these sellers is near me / in my state), and it is the one card that cannot show it honestly today.

Nothing else on the card is broken for this commission's purposes, and nothing else on it is in scope (§4).

---

## 1. The decision — what the subline renders

The subline becomes a **two-segment line**, composed from two data sources of different provenance, each rendered only from its own source:

| Segment | Source | Render |
|---|---|---|
| **1. Location segment** (existing, unchanged) | `seller.location` — the seller's own published free-text location string | Verbatim, exactly as today, when present. Never edited, trimmed of its state, parsed, or re-ordered by this build. |
| **2. State segment** (new — the structured state) | `seller.region` — the seller's structured region field, resolved through `stateByCode()` (`v2/lib/data/states.ts`), the same expression A3's `SellerCard` already uses | `· [StateShape outline] {state name}`, as its own inline segment carrying `data-seller-state={code}`, when — and only when — the state resolves (see §1.2). The outline is `StateShape` with `region={state.code}`: it keys off the structured code, **never** off any character of the location string. |

### 1.1 Composition, case by case

| # | Location string | Structured state | Subline renders |
|---|---|---|---|
| C1 | Present | Resolves | `{location} · [icon] {State name}` — the location string verbatim, then the segment (the duplication this can produce is priced in §1.3) |
| C2 | Absent | Resolves | `[icon] {State name}` alone, with **no leading separator** — this **replaces** today's raw-code fallback ("OR, US") in this case; the code pair is never printed beside its own expansion |
| C3 | Present | Does not resolve | `{location}` alone — byte-identical to today; no icon, no segment (§3) |
| C4 | Absent | Does not resolve | Today's fallback chain, untouched: the `region` string if any part of it exists, else "Location unknown" |

### 1.2 When the state segment exists — the resolution rule

The segment renders under exactly A3's existing guard, so the directory has one resolution rule, not two: the seller's `country` is `"US"` **and** `stateByCode(seller.region)` returns a state. `stateByCode` covers all 50 states, so "resolves" means a real USPS code is on the record; it does not depend on whether an outline has been drawn for that state yet (§3, case A-2).

### 1.3 The duplication in C1 is deliberate — and the alternative is rejected on the record

A seller's free-text location often already ends with its state ("Clinton, SC", "Skagit Valley, Washington"), so C1 can read "Clinton, SC · [icon] South Carolina". This is accepted, for three stated reasons:

1. **It is the directory's already-gated pattern.** A3's `SellerCard` composes its location line exactly this way — free text kept, structured segment appended — and that composition passed the SI design gate. One composition rule across every card is worth more than a locally tidier line on one card (consistency heuristic; users learn the segment's meaning once).
2. **The two segments have different provenance, and both are honest.** Segment 1 is the seller's own words, verbatim. Segment 2 is the directory's filed state — the state the seller is indexed, filtered, and paged under. Neither is edited to accommodate the other.
3. **The tidy alternative is the dishonest one.** Suppressing or trimming segment 2 (or segment 1's tail) when the free text "already mentions" the state requires the render to parse the free-text string — string-matching a state name or code out of seller prose. That is precisely the mechanism N5 was ruled out for: presence of the icon would then depend on prose parsing, would fail silently on non-standard strings ("Ojai, CA 93023", valley/region names, typos on the seller's own site), and could show an outline for a state the record is not filed under. **No render-time parsing of `seller.location` is authorized anywhere in this design.**

---

## 2. Which location — the primary, only

The state segment is the state of the seller's **primary location**, and no other. This is not a new decision; it is the directory's standing locations rule (Dustin, 2026-11-22; `shop-design/SPEC-LOCATIONS.md` §1.1, F-L2) applied to this card:

- A seller record carries exactly one primary location. The `location` / `region` pair **is** that primary — `region` is derived from the single location field and is the only value state filing, the state link, and the schema read.
- `PublicListing`'s seller carries that same `region`, so the segment on this card is the primary's state by construction. No new field, no selection logic, no "which location?" question exists at render time.
- A multi-location seller's additional locations (e.g. Plant Good Seed's Ojai, CA mailing address, against its Chimacum, WA primary) appear **only** in the shop page's information area. They never render on this card, never contribute a second outline or state name here, and never affect this card's filing. On a variety page, Plant Good Seed's card shows its primary's state — Washington — and nothing about Ojai.

---

## 3. Absence — the SI fallback governs, in two distinct cases

The established SI fallback (Mina §5.2, endorsed by Ada Ruling 4) is **render nothing: no placeholder, no generic outline, no reserved box, no gap artifact**. On this card it applies at two different levels, which must not be conflated:

- **A-1 — No structured state on the record** (region empty, not a USPS code, or non-US country). **3 of the 83 sellers carry no state.** The state segment does not exist: no outline, no state name, no separator dot, no empty inline-flex span. The subline composes from segment 1 alone (C3), or from today's fallback chain (C4) — in both cases **byte-identical to the card as it ships today**. A shopper cannot tell a no-state card from a pre-SI card, which is correct: there is no fact to show, and the design shows no fact-shaped hole.
- **A-2 — Structured state known, outline not yet drawn** (a future 32nd+ state whose code resolves in `stateByCode` but has no entry in `STATE_SHAPES`). The segment **does** render — the state *name* is structured data and prints — with `StateShape` returning `null` inside it, per the component's existing contract. The name stands alone in its segment until the outline lands through the generator (§5.3 of Mina's spec), at which point this card picks it up with no caller change. This is Mina's registered future difference applying to A5 exactly as it does to A2–A4.

In neither case does the card's height, the subline's line height, or any neighbour's position change (§4, §6).

---

## 4. What does NOT change — and the cross-programme register note

**Everything else on the card is out of scope and unchanged**, in variety context and everywhere else:

- The heading row (seller name, Fraunces 600 20 px, its link to `/seller/{slug}`, underline treatment) and the **Small Farm badge** on that row — presence, position, and rule (variety context, real `isSmallFarm` flag only) all untouched.
- The **status line** (dot + availability word + checked date), the **packet list and notes** block, the **stem rule**, and the **footer** ("Report a problem" link, "Visit shop →" pill, `/go/{id}` behaviour) — contents, order, and behaviour identical.
- The **sold-out treatment** (ground step-down, softened shadow, pill fill removed, never disabled) — identical, with and without a state segment.
- **Seller context** (`context === "seller"`): entirely untouched. Its subline remains the variety's plant common name; no state segment, no icon, no artwork-rail change. This spec's whole scope is the variety-context branch of one `<p>`.
- Card geometry: padding, radius, border, shadow, the subline's own classes (`mt-listing-subline text-base text-muted`) and line height, and the vertical rhythm heading → subline → status are unchanged. The segment is inline content inside the existing line, composed the way A3's segment is composed inside its line.
- No copy changes anywhere else; no link destinations change; the heading link's accessible name (the seller's name) is unchanged. The state name is real text and will be read as part of the subline — read **once**, from segment 2's text node; the SVG contributes nothing (§5, semantics).

**Cross-programme note (for both registers, so the programmes cannot collide):** the shop build's register protects the variety-context listing card byte-for-byte within the shop programme's scope. This change is **not** a shop-programme change and does not amend that protection. It is entered in the SI register as **the SI build's one registered difference on this card (§5, D7)**: within SI's scope, the variety-context subline differs from its pre-SI bytes in exactly the segment-2 composition of §1 — and in nothing else. If the shop programme's gate ever diffs this card, D7 is the citation that explains the delta; any *other* byte difference on this card remains a defect under whichever register catches it.

---

## 5. Register entry — A5 (in the form of Mina's PLACEMENT-SPEC)

### 5.1 Surface inventory addition (§1.1 form)

| ID | Surface | Component / file | State name render | Icon today |
|---|---|---|---|---|
| **A5** | Variety page — listing card subline (variety context) | `v2/components/variety/ListingRow.tsx` — the subline `<p>` (`mt-listing-subline`), `context === "variety"` branch only | **New structured render (§1):** state segment "· {name}" from `stateByCode(seller.region)` beside the kept free-text location segment | **None — ADD (§1 of this spec).** Formerly ruled no-icon as **N5**; N5 is superseded by this entry and by Dustin's 2026-11-22 16:41 PT ruling |

### 5.2 Placement row (§2 form — geometry columns are Mina's placement pass, §7)

| ID | Position relative to the name | Box (token, Mina §6) | Gap | Alignment | Color |
|---|---|---|---|---|---|
| **A5** Listing card state segment | **Before the name**, inside the state segment: "· [icon] {name}" — the "·" separator stands first, opening the segment, exactly as on A3. The segment follows the location segment within the subline (§1.1) | **PENDING MINA** — candidate is the existing `--size-state-icon-inline` token (20 px per Ada Ruling 3 / Quinn amendment A1); the host line here is `text-base`, not A3's `text-sm`, so the box-to-line fit is hers to measure and rule (§7) | **PENDING MINA** — A3's segment uses 4 px (`gap-1`) inside the segment; whether A5 adopts it, and what separates the two segments, is her pass | Optical center on the subline's line box (the SI rule: an outline glyph has no baseline) — mechanism is Mina's pass; the subline is a plain `<p>` today, not a flex host, so the segment's inline composition is specified there, not improvised by the build | **PENDING IRIS extension** — expected `currentColor` → `--color-muted`, the subline's own color and A3's pairing; Iris's ruling enumerated A1–A4, so A5 is hers to confirm (§7). No fill, per her standing ruling for the set |

### 5.3 Semantics (extension of Mina §4 / Ada Ruling 1 — confirmation flagged to Ada, §7)

- The icon on A5 is **decorative**, on the same fact pattern Ada confirmed for A1–A4: the state name is present as real text immediately beside it, and the icon adds no information the text does not carry. Treatment: `aria-hidden="true"`, `focusable="false"`, no `alt`, no `<title>`, no `aria-label`, no role — inherited from the `StateShape` component contract unchanged.
- The icon is never rendered without its name on this card: segment 2 exists only as icon + name together (or name alone under §3 A-2). **No icon-only state reference is authorized on A5**, as on every SI surface.
- The segment is plain text inside the subline paragraph — it is not a link (the card's state door is the seller page's A4 link, reached via the heading), carries no target, and changes no tab order.

### 5.4 Rendered-difference entry (§7.1 form)

| # | Surface | Change |
|---|---|---|
| D7 | A5 — variety-page listing cards (`ListingRow`, variety context only) | **The SI build's one registered difference on this card.** The subline gains a structured state segment after the kept free-text location segment: "· [icon] {state name}", keyed off `seller.region` via `stateByCode` (primary location only, §2). Where the location string is absent, the segment alone replaces the raw-code fallback ("OR, US"). Sellers with no structured state (3 of 83) render byte-identical to today. Seller-context cards and every other element of the variety-context card are byte-identical. Icon size, gap, and paint are Mina's placement pass and Iris's extension (§5.2), recorded there when ruled. |

*(D7 continues Mina's D-series: D1–D5 are hers, D6 is the geometry-vintage entry added by Quinn's design-gate amendment A2.)*

---

## 6. Acceptance checks for the build gate (SI §9 style)

- [ ] **Honest keying — the defining check:** for every variety-page listing card, the state segment is present **if and only if** a structured state is rendered from `seller.region`; the segment's `data-seller-state` code, the outline's `data-state-shape` code, and the seller record's `region` are the same code; and the state name printed is `stateByCode(region)`'s name. No card's icon or segment is derived from the `location` string by any mechanism.
- [ ] **Honest keying — adversarial cases:** (a) a seller whose free-text location names a *different* state than its `region` (the GeoSeed pattern: text and field disagree) renders the outline and name of the **`region`** state — the filed state wins, the prose is never parsed; (b) a seller whose location string contains a state name but whose `region` is empty renders **no** icon and **no** segment.
- [ ] All sellers in the 31 SI states render outline + name at A5; spot-check the aspect extremes beside A3's renders of the same sellers (TX and MT wide, ID and CA tall, CO square) — the same seller shows the same state, segment shape, and separator composition on both cards.
- [ ] **Absence (A-1):** each of the 3 no-state sellers renders byte-identical to its pre-SI card — subline text, spacing, and card height unchanged; no separator dot, no empty span, no reserved box in the DOM.
- [ ] **Absence (A-2):** with a code that resolves in `stateByCode` but is absent from `STATE_SHAPES` (simulated), the segment renders the state name with no outline, no gap artifact, no console error.
- [ ] **Primary only:** a multi-location seller (Plant Good Seed) renders only its primary's state (Washington) at A5; no trace of any additional location (Ojai / California) appears on the card in text, icon, or data attributes.
- [ ] **Fallback replacement:** a seller with a structured state and no location string renders "[icon] {State name}" — the raw code pair ("OR, US" form) appears nowhere on any variety page.
- [ ] **Nothing else moved:** seller-context cards byte-identical; on variety-context cards, heading row + badge, status line, packets/notes, stem rule, footer, and sold-out treatment byte-identical; card heights equal across segment / no-segment cards in the same list, measured at 390 px, iPad, and desktop.
- [ ] **Accessibility:** the heading link's accessible name is identical before and after; the state name is announced exactly once as subline text; the SVG contributes nothing to any accessible name (diff, not eyeball). Decorative treatment per §5.3, subject to Ada's extension ruling (§7).
- [ ] Forced-colors mode: outline visible and following the subline's text color (with Ada, per her standing conditions — no `forced-color-adjust: none` on the icon or its hosts).
- [ ] Text at 200% and viewport at 320 px: the two segments wrap as ordinary text without squeezing the icon, separating the icon from its name onto a different line, or overflowing the card.
- [ ] Deliberately unchecked by this spec: icon size/token and gaps on this card (Mina's placement pass), the `currentColor` extension (Iris), the decorative/floor confirmation for A5 (Ada) — §7.

---

## 7. Flags — decisions that belong to other seats

1. **To Mina (placement pass, next):** A5's box size and token, the icon-to-name gap inside the segment, the separation between the location and state segments, and the segment's inline composition mechanism inside a non-flex `<p>` (§5.2). Facts her pass needs from this spec: the host line is `text-base text-muted` (`mt-listing-subline`), one step larger than A3's `text-sm` host; Ada's binding inline floor is 20 px; the existing inline token is the obvious candidate but the box-to-line fit on *this* line is unmeasured — measure it, don't assume it. Her fold-in to `PLACEMENT-SPEC.md`: move N5 to A5 (§5.1), add the §2 row, and register D7.
2. **To Iris:** extend the `currentColor`, no-fill ruling to A5. The expected pairing is the subline's `--color-muted` — identical to A3's host — but her ruling enumerated A1–A4, and a fifth surface is hers to confirm, not mine to assume. No new color token is proposed.
3. **To Ada:** extend Ruling 1 (decorative classification) and the Ruling 3 floor to A5. The fact pattern matches A3's exactly (name as real text beside the icon; icon contributes nothing to any accessible name), and Ruling 4's fallback endorsement covers §3 as written — but her rulings name four surfaces, and the fifth is hers to add. Her forced-colors conditions (Ruling 5) are carried into §6 unchanged.
4. **Data limitation, recorded (no action in this build):** there is **no structured city field** on the seller record — the record holds one free-text `location` string plus the derived `region` (shop SPEC-LOCATIONS F-L1/F-L2). That is why §1 composes two segments instead of decomposing the string into "city + structured state": the city exists only inside prose, and prose is never parsed. If a composed single-string subline ("City, [icon] State") is ever wanted, it requires a structured city on the record first — an additive data change, commissioned separately, not a render change.
5. **To Quinn:** this delta goes to your design gate after Mina's placement pass (§7.1), with Iris's and Ada's extensions (§7.2–3) folded in. The §6 checks are written for that gate and the build gate that follows it.

---

*Prepared by Nadia, UX Design — 2026-11-22. Returns to Hue. Structure only: no size, token, color, or floor is decided in this document; each is flagged to the seat that owns it.*
