# Seller-as-Shop — Design Specification

**Seat:** Nadia, UX Design (author). Standing collaborators: Mina (UI design — designs the assembled shop surface from this spec next; owns all visual values), Ada (accessibility — WCAG 2.2 AA floor pass on the assembled design after Mina; this spec states floors and never invents her values), Iris (color — consulted only if a new state mark is proposed; none is), Thea (typography — no type values are set here; the shop consumes the existing heading/chip/eyebrow system), Wren (copy — lines marked "Wren confirms" are hers to finalize; the obligations those lines carry are this spec's).
**Date:** 2026-11-22 · **Status:** Design spec only. No code, no build. Written so a pipeline build brief can be lifted from it verbatim.
**Commission:** Dustin, voice call 2026-11-22, verbatim: "I'd like to turn each seller's profile page into the seller's shop." Clarifications ruled on the same call: "Don't change the model. We just want it to appear like their shop with filters" and "and a search bar that just searches their shop."
**Additions, same call:** (1) 15:09 PT — "Should probably put their homepage URL on their main shop page." Designed at §3.5.1: the page already carries this link (§2.1), and the addition is satisfied by ruling its place in the shop header and its outbound convention, not by adding a second one. (2) 15:10 PT — the shop page gains a **seller contact block**: homepage plus the seller's published customer service phone and email, collected by the approved location sweep. Designed at §3.5.
**Deltas, same call:** (1) 15:48 PT — "Add a Crop filter group in shops." §16 OQ-1 is RULED IN; designed at §5.8, registered at §12 S-13, checked at §13 SH-18–SH-20, with the §8 threshold consequence stated at §8.4. (2) 15:49 PT — "In stock should be at the top but it should also be A to Z in both the top and the out of stock sections." §16 OQ-3 is RULED; the shop sort default becomes the grouped order designed at §7.5, registered at §12 S-14, checked at §13 SH-21. PB-1 is unchanged for site-wide browse — the split is shop-only, exactly as OQ-3 contemplated.
**Scope — settled, not re-opened by this spec:** Presentation only. The model does not change: Phase 1 stays directory-only; buying still leaves via outbound `/go/` links to the seller's own product pages (new tab, `nofollow`); prices are never shown anywhere; packet sizes are shown; listings data is unchanged. The seller page (`/seller/<slug>`) becomes the seller's shop front. Filters are the site's existing filter model (Season, Sowing method, Life cycle, Hue) scoped to that seller's listings, plus the shop-only Crop group ruled in later the same day (§5.8). Search searches only that seller's shop.
**Model of record:** Tranche 3 SPEC §2 (the filter model) and §5.3 (the search pattern), in `backlog-2026-11-21/tranche-3/SPEC.md`. This spec scopes that machinery to one seller's listings. It does not design a second filter system, a second search system, or a second sort control. PB-2 is ruled (2026-11-22): Hue is multi-select — OR within Hue, AND across groups. PB-1 is ruled (2026-11-22): on `/variety` the sort default stays "Name A–Z"; §7 states this spec's position for the shop.
**House standards binding this spec:** US spelling throughout. Prices never shown — the only numbers this spec adds are result counts computed from listing presence. Phone-first for public surfaces (the iPad-first rule is admin-only), every surface a PWA. No public source attributions except the exact label "Reviews from Google". No typography baked into any artwork (nothing here proposes artwork). Illustrations shown whole — the listing cards' artwork rail is untouched.

---

## 0. The one rule that governs this spec

**The page does not change its address, its data, or its job — it changes its stance.** Today `/seller/<slug>` is a profile that happens to end in a list of listings. After this build it is a shop that happens to open with who runs it. Everything that makes that true is structural and verbal — the catalog section becomes the shop, gains the find-tools a catalog of that size earns, and is named as the seller's shop — and nothing else moves: same URL, same header facts, same cards, same outbound buying path, same ratings separation. Three consequences, stated now because they decide arguments later:

1. **One pattern, learned once (Tranche 3 §0.3, applied).** Filters, applied-filter chips, Clear All, sort, live-region announcements, and URL/history discipline behave on the shop page exactly as they behave on `/variety` after Item 3.1a — same components (`BrowseFilters` / `FilterStrip`), same behavior contract (Tranche 3 §2.5), same parameter names. Where the shop legitimately differs, the difference is named in this spec as a settled exception with its reason (§5.4, §6.3, §10.3) — never left as an accident of a separate build.
2. **The enhancement layer is never the only layer.** Every state this spec designs — filtered, searched, sorted, paginated — server-renders correctly from its URL for a first paint, a refresh, a shared link, and a no-JavaScript visit. The shop page already loads the seller's entire listing set server-side (§2.3), so this floor costs no new architecture.
3. **Behavior contracts are stated as observables.** Every normative claim below can be watched happening — a count, a focus position, a history-entry count, a status code. §13 is Quinn's executable checklist.

---

## 1. How to read this spec

- §2 is the verified current state — code truth from `origin/main` via `git show` (the working tree sits on a stale branch and was never read) and live truth from production probes run 2026-11-22 with `curl` (headless Chromium cannot reach production from this VM; `curl` can).
- §§3–10 are the normative design, one section per question the commission poses.
- §11 is the data/payload build input — the one place this presentation-only change touches what the server sends, stated exactly so the build does not discover it.
- §12 is the **change register**: the complete, closed list of differences from today's page. If it is not in §12, it must not change.
- §13 is the acceptance checklist Quinn executes. §14 is the recommended build placement. §15 is pushback. §16 is open questions — things the commission implies that Dustin has not ruled on, flagged rather than silently decided.

---

## 2. Current state (verified)

### 2.1 The seller page today (`v2/app/seller/[slug]/page.tsx`, `origin/main`)

Top to bottom, the page is:

1. **Breadcrumbs** — Home / Sellers / {seller name}.
2. **Header** (`<article>`, `aria-labelledby="seller-title"`): eyebrow with the seller type label; `<h1>` = seller name; for badged sellers, a Small Farm badge row (large badge + the `SMALL_FARM_LEGEND` line) directly under the H1; a three-column definition list — **Location** (the free-text `where` line, then the state link: `StateShape` outline at 22px + state name, linking to `/state/{slug}` — placement A4 in Mina's state-icons spec), **Varieties listed** (a count), **Rating** (`RatingDisplay`, which renders "Not yet rated" — our own rating, review count 0 for every seller today); a primary button "Visit {name} ({host})" — an `OutboundLink` to the seller's homepage: direct `href` (not routed through `/go/`), `rel="nofollow noopener noreferrer"`, `target="_blank"`, a fire-and-forget tracking beacon to `/api/track`, and a screen-reader suffix "(opens the seller's site in a new tab)"; the component's own contract records the site rule (R6: outbound links carry `nofollow noopener`; listing shop buttons go through `/go/{id}` instead, R7) — or, when no homepage is on file, the line "No website on file for this seller."; a disclosure line for the site-owner seller only. A state-flower `StatePlate` sits beside the header where one exists.
3. **About** — a section headed "About this seller" with the description and, where present, "Ordering notes:", rendered only when either exists.
4. **"Reviews from Google"** — `ImportedRatingPanel`, rendered only when an imported rating exists: a separate bordered panel, headed "Reviews from {source}", aggregate and count only, kept apart from our rating by design and by its own code comment. It never feeds our rating or structured data.
5. **The listings section** — headed "Listings at {name}", with a count line ("{N} listings", plus "· page {p} of {pages}" when paginated), then the listings as **Quiet Ledger cards** in seller context (`ListingRow`, `context="seller"`): variety name as the card heading linking to the variety page, crop common name as the subline, the slim artwork rail (variety plate, else crop plate, else motif), stock as dot + word + friendly checked date, packet sizes, and the footer with "Report a problem" and the sage "Visit shop →" pill (a `/go/{id}` link, new tab, `nofollow noopener noreferrer`). Pagination is `PAGE_SIZE` = 24 per page, true navigation, with true-404 bounds (verified live: GeoSeed page 8 answers 200, page 9 answers 404). A seller with no listings renders `SELLER_NO_LISTINGS` ("No listings for this seller yet.") plus a "Browse all varieties" link.
6. **Claim line** — "Is this your farm or company? Claim, correct or remove this listing."

There are **no filters, no search, and no sort** on the page today. The only controls are pagination links. There is likewise **no phone or email anywhere on the page today**, and no customer-service contact fields exist in the seller payload — the contact block in §3.5 consumes fields the location sweep is collecting under a separate commission; until a seller's fields exist, that seller's page simply shows less (§3.5.3).

### 2.2 Live scale (probed 2026-11-22)

83 sellers. Listing-catalog sizes (the public API's `varietyCount` per seller, used here as the scale proxy; the runtime count that governs §8 is the page's own listings total):

| Shop size (varieties) | Sellers | Notes |
|---|---|---|
| 0 | 16 | The empty shop is a common case, not an edge case |
| 1–4 | 25 | |
| 5–8 | 7 | |
| 9–24 | 17 | Fits one page (24) but not one glance |
| 25–179 | 18 | GeoSeed is the ceiling at 179 listings (verified live: "179 listings", 8 pages) |

3 Porch Farm (34 listings, 2 pages) and GeoSeed (179 listings, 8 pages) were probed directly; both render exactly as §2.1 describes, including "Not yet rated" and, where present, the "Reviews from Google" panel.

### 2.3 The data the page already holds — and the two fields it does not

`getSeller` returns the seller's **complete** listing set, unpaginated; the page slices 24 for display. This is the fact the whole design stands on: in-shop filtering, searching, sorting, and per-option counts never need a network round trip, because the set being scoped is already whole on the page (server-side for the first paint, and shippable entire to the enhancement layer — the largest shop is 179 listings).

Facet availability per listing, from the shipped schemas:

- **Season and Sowing method are already on the page.** Each listing's variety carries its crop (`PlantRef`), which carries `season_class` and `sowing_methods`.
- **Life cycle is not in the payload.** The crop carries a life cycle in the catalog layer (crop lists filter by it), but `PlantRef` does not include it.
- **Hue is not in the payload.** `VarietyRef` carries `colorSwatch` (a hex) but not `colorFamily`; the variety summary layer carries `colorFamily` — the value the Hue filter groups by everywhere else. Filtering Hue by swatch hex would be a different, wrong facet.

§11 specifies the payload completion. It changes no listing data and no model — it carries two existing catalog fields to a page that already receives everything else about the same listings.

### 2.4 What the shop inherits, already built or building

- **Item 3.1a (building now)** — the in-place filter core on `/variety`: `BrowseFilters`/`FilterStrip` enhancement, per-option counts, applied row, Clear All, the persistent live region, Hue multi-select per PB-2. The shop consumes this core; §14 sequences the shop build after it.
- **Item 3.4 / §5.2–5.3 (Tranche 3)** — the sort control's form and the search ranking/empty-state patterns, scoped down in §§6–7 of this spec.
- **Item SI (state icons)** — placement A4 already sits in this page's Location link (§9).
- **The exemplar toggle** — variety detail's `SellerFilterSection` proves the in-place pattern on a listing set; the shop is its browse-scale sibling, not a new invention.

---

## 3. Shop structure — header, identity, and the catalog section (Question 1)

### 3.1 What makes it read as "their shop" — structurally

A page reads as a shop because of what it *does*, in this order: it names whose shop it is, it shows the stock, and it gives the visitor the tools to find a thing in that stock. The design therefore changes exactly three structural things and nothing else:

1. **The catalog section is named the shop.** The listings section heading changes from "Listings at {name}" to **"{name}'s shop"** (possessive handling for names ending in "s" is Wren's to confirm; the contract is that the heading carries the seller's name and the word "shop"). The heading stays an `<h2>` in the same position, and the section keeps `aria-labelledby` pointing at it.
2. **The catalog section gains the shop's find-tools** — search (§6), filters (§5), sort (§7) — inside the section, above the results, when the shop's size earns them (§8). A catalog with find-tools is a shop; a catalog without them, at 179 listings across 8 pages, is a warehouse corridor.
3. **The header states the shop's size as a fact of identity.** It already does: the "Varieties listed" definition-list entry stays exactly where it is. No new count is added to the header — the shop section's own count line (§3.3) is the live one, and two counts that can disagree in phrasing ("varieties" vs "listings") must not compete. (If a seller's variety count and listing total ever diverge, the header keeps the variety count it has today and the shop line keeps the listing total it has today — both are already true statements about different things; §16 OQ-7 flags the divergence case for Dustin rather than papering over it.)

**Explicitly not part of the shop framing:** no banner, hero image, or cover artwork is added to the header; no "Welcome to…" copy; no new route (`/shop/<slug>` is rejected in §15 PB-S3); no change to the page `<title>` pattern in this spec (§16 OQ-6 flags titles for Bea's seat). The StatePlate, where it exists, is the header's artwork today and remains it, unchanged.

### 3.2 Header composition — unchanged, and why each piece stays

The header is the shop's signboard and identity block, and every element in it survives verbatim, in its current order:

- Eyebrow (seller type), H1 (seller name), Small Farm badge row with its legend — unchanged. The badge row is part of "whose shop this is"; badged sellers only, exactly as today.
- The definition list — **Location** (with the A4 state link, §9), **Varieties listed**, **Rating** ("Not yet rated") — unchanged in content, order, and placement.
- The "Visit {name} ({host})" primary button — unchanged in destination, component, and behavior; it becomes the website channel of the seller contact block (§3.5), which is built around its existing slot. Its label now sits in a page that also carries a "shop" heading and per-card "Visit shop →" pills; that wording collision is real and is flagged as §16 OQ-2 with a recommendation, **not** silently renamed here, because the button's destination (the seller's own website) and the pills' destination (a product page on that website, via `/go/`) are different doors and any rename is a copy decision Dustin and Wren should see — and Wren's copy pass now covers the whole contact block's labels together (§3.5.4), which is the right place for it.
- The site-owner disclosure line — unchanged, rendered for the same seller only.

### 3.3 The catalog section — composition (normative)

Inside the section, top to bottom:

1. `<h2>` — "{name}'s shop" (§3.1).
2. **The control block** (present per the §8 thresholds): the in-shop search field first (§6), then the filter strips (§5), then the sort control (§7) — the same control-block order Tranche 3 §5.2.3 sets for browse surfaces (filters, then sort, then the applied row), with search above the filters because in a single shop the name-recall path is the primary one (§6.1).
3. **The applied row** (§5.5) — directly above the results, present only when something is applied.
4. **The count line** — the section's existing count line, upgraded to the persistent live region (§5.6). At rest it reads as today ("{N} listings"); under any applied state it states the narrowed total and the active ordering (§7.3). When pagination applies it keeps today's "· page {p} of {pages}" suffix.
5. **The results region** — the Quiet Ledger card list, byte-identical cards (§12), or a designed state (§9) when the set is empty.
6. **Pagination** — unchanged component and behavior (§10.3).

Nothing above the section — header, About, reviews panel — repaints, moves, or hides under any filter, search, or sort state (Tranche 3 §2.5.1–2.5.2 preservation, applied to this page).

### 3.4 Where About sits, where the ratings sit (normative)

- **About stays where it is** — between the header and the catalog. A shop front introduces its keeper before its shelves; the description and ordering notes are also genuinely useful before browsing (ordering notes in particular shape whether a visitor bothers). Moving About below a catalog that can run 8 pages would bury it where only the most determined scroll reaches, and would make the page's information order depend on catalog size.
- **Our rating stays in the header definition list** ("Not yet rated"), exactly as today. It is an identity fact, not catalog furniture.
- **The "Reviews from Google" panel stays where it is** — after About, before the catalog section, rendered under the same condition as today (only when an imported rating exists), with its exact label, its separation from our rating, and its content unchanged. Two reasons, stated for the record: (a) it is a trust fact about the seller, and it belongs with the identity block, not interleaved with stock; (b) it must never move, appear, or disappear as a side effect of filtering or searching — pinning it outside the catalog section guarantees that structurally, not by discipline. The cost is named honestly: on shops that have the panel, the catalog starts one panel lower. That cost is accepted — the alternative (reviews below a paginated catalog) strands them past page controls and the claim line, which is worse.

### 3.5 The seller contact block — website, phone, email (Additions 1 and 2)

Dustin's two additions land in the header, in the slot the homepage button already occupies. The block is part of the identity composition: it answers "whose shop is this, and how do I reach them" before the catalog answers "what do they sell". It is **not** part of the catalog section, and no filter, search, or sort state ever moves, hides, or re-renders it (§3.3's preservation rule covers it).

#### 3.5.1 The website channel — the existing homepage link, ruled (Addition 1)

- **The slot already exists and does not move.** The header's primary button (§2.1) *is* the seller's homepage link; this build adds no second homepage link anywhere on the page. One door to the seller's site, in one place — a duplicate link in a "contact" row below would compete with the primary button and split the click tracking that tells the directory which sellers get visits.
- **Convention — ruled: the plain outbound convention (`OutboundLink`, site rule R6), not the `/go/` pattern (R7).** The link keeps its shipped form: direct `href` to the seller's homepage, `rel="nofollow noopener noreferrer"`, `target="_blank"`, the fire-and-forget `/api/track` beacon, and the screen-reader new-tab suffix. Why not `/go/`: `/go/{id}` exists for *listings* — it resolves one listing to its product page, logs that product click, and tags it. The homepage link has no listing, is not a product click, and routing it through `/go/` would corrupt the per-listing click data every later decision reads, while buying nothing: the beacon already records the visit. Why `nofollow` stands: it is the site's settled rule for direct seller-site links (R6), and this spec does not relitigate settled rules as a side effect of a placement decision. (For the record, the brief's framing — "plain outbound convention *or* the `/go/` pattern" — maps onto the site's real distinction, which is direct-vs-`/go/`; the direct convention itself carries `nofollow`, so the two candidate conventions differ in routing and tracking, not in the `rel` value.)
- **Destination presentation — ruled: the destination is visible before the click.** The label carries the seller's name and the site's host in parentheses ("Visit {name} ({host})" today) — a visitor can see *where* the button goes, not just that it goes somewhere. This is the block's presentation principle for every channel (§3.5.2): phone shows the number, email shows the address, website shows the host. No channel is hidden behind a bare "Contact us" label. Final wording is Wren's (§3.5.4); the visible-destination obligation is this spec's.
- **Distinct from listings — stated plainly, because the two now share a page and a vocabulary.** The homepage link goes to the seller's *homepage*. Every listing's "Visit shop →" pill goes, via `/go/{id}`, to *that variety's individual product page* — never to a homepage or a category page, per the governing rule. The contact block changes nothing about listing links, and no listing link may ever be replaced by, fall back to, or be supplemented with the homepage link: a listing whose product page is the reason the directory exists does not become a homepage link because a homepage link happens to be nearby.

#### 3.5.2 Phone and email — the service channels (Addition 2)

Where the sweep has collected them (§3.5.5), the block gains up to two more channels, rendered as labeled link rows **directly under the website button**, in this order: website (the button), phone, email. Semantics, specced cleanly for Ada's pass:

- **Phone:** an `<a href="tel:…">` whose **visible text is the phone number as the seller publishes it** (display formatting is the seller's own; the `href` carries the dialable form — country code + digits, punctuation stripped — so a tap dials what the eye read). The row's label slot (Wren's wording; the concept is "customer service") precedes the number, so the link's purpose — whose service line this is — is determinable from the row, not from the digits alone.
- **Email:** an `<a href="mailto:…">` whose **visible text is the email address itself**, labeled by the same service-label slot. The address is the destination, shown in full, per §3.5.1's visible-destination principle.
- Both are plain server-rendered links: no JavaScript, no component state, no enhancement — they work identically in the no-JS floor (§10.4), in the installed PWA, and before hydration. Neither opens a new tab (native `tel:`/`mailto:` behavior hands off to the phone/mail app; there is no document to open in a tab). Tap targets: each row is a full-row link at the house 44px minimum height — Ada rules on the specifics (link-purpose naming, target geometry, focus treatment) in her pass; this spec fixes only that the rows are real links with visible destinations and house-standard targets, so her pass starts from a sound structure.
- Neither channel is ever rendered as plain unlinked text: a published service phone or email that cannot be tapped is a recall trap on the device whose whole point is tapping it.

#### 3.5.3 Graceful absence — the coverage matrix (normative)

Coverage will be partial at build time and for long after; absence is the common case, and the block is designed from the absence outward. The governing rule: **a channel renders if and only if its field is present; the block is the sum of what renders; nothing marks the gaps.**

| Website | Phone | Email | What the header shows |
|---|---|---|---|
| ✓ | ✓ | ✓ | Button + phone row + email row |
| ✓ | ✓ | — | Button + phone row |
| ✓ | — | ✓ | Button + email row |
| ✓ | — | — | Button alone — **exactly today's page** |
| — | ✓ | ✓ | The existing "No website on file for this seller." line + phone row + email row |
| — | ✓ / — | — / ✓ | The "No website" line + the one row present |
| — | — | — | The "No website" line alone — **exactly today's page** |

- **No placeholders, no empty slots, no reserved space.** Rows are not rendered empty, greyed, or dashed; the block's height is whatever its present channels make it. A one-channel block and a three-channel block are both complete designs, not degraded versions of each other.
- **No "contact unavailable" copy — argued explicitly, as the brief requires.** The only absence line on the page remains the pre-existing "No website on file for this seller.", which is a shipped, factual statement about one specific field, kept because removing settled copy is a change nobody commissioned. This build adds **no** equivalent line for phone or email, and no summary line ("This seller hasn't published contact details") in the all-absent case, for three reasons: (a) absence is ambiguous — during and after the sweep it means "not published" *or* "not yet collected", and the page cannot tell which, so any sentence it prints about absence risks stating a falsehood about the seller; (b) a negative line reads as a defect — in the directory's data or in the seller's professionalism — and quietly punishes sellers who simply run their service through their website's own contact page; (c) the block's job is to present channels that exist, and a directory page that narrates its own gaps trains visitors to distrust complete blocks too. Silence is the honest rendering of "we don't have it".
- **The block never looks broken at any coverage level** — the test Quinn runs (§13 SH-14) is the matrix above, all seven rows, each compared against its own completeness rather than against the full block.

#### 3.5.4 Labels — Wren's, as a set

Every label in the block is Wren's to rule in her copy pass, which now covers the block as one commission: the website button's wording (including the §16 OQ-2 collision with the cards' "Visit shop →"), the service-label wording for the phone and email rows, and their exact composition with the visible number/address. This spec fixes the slots (button; label + number; label + address), the order (website, phone, email), the visible-destination obligation (§3.5.1), and the purpose-from-context obligation (§3.5.2) — and no words.

#### 3.5.5 Data provenance — what qualifies (normative contents)

The block consumes exactly three seller fields: homepage (existing), customer service phone, customer service email (new, from the location sweep). A phone or email qualifies **only** if it is a channel the seller themselves publishes as a customer service contact — on their own site or storefront, presented by them for customer contact. Personal numbers, numbers or addresses inferred from other directories, WHOIS or registration data, and guessed patterns (`service@…` constructed from a domain) never qualify and must never render. The sweep owns collection and its own verification standard; this design's obligation is narrower and absolute: **the block renders a field verbatim as collected, or not at all** — it never formats a number into a different number, never completes a partial address, and never derives one channel from another (a homepage domain does not imply an email). Payload contents are added to §11's build inputs.

---

## 4. Classification of the new controls

Search, every filter group, the sort control, the applied-filter removers, and Clear All on this page are **local-scope controls** under the playbook's in-place standard and Tranche 3 §2.5.1: each re-scopes or re-orders content the visitor is already looking at. Once hydrated, each updates the results region, the count line, the applied row, and the per-option counts **in place** — no document navigation, no route skeleton, no repaint of header, About, or reviews panel; scroll position does not move; the activated control keeps focus and stays mounted. Pagination is the boundary of this contract (§10.3), exactly as on `/variety`.

Because the shop's full listing set is already on the page (§2.3), the updated results are computed from data in hand: the selected state acknowledges in the same frame as the tap and the results land effectively immediately — inside the ~0.1s / ~400ms budgets with room to spare, no spinner, no skeleton, no busy indication in the normal case. The failure clause of Tranche 3 §2.5.6 applies unchanged in form (prior results stand, one in-place error line with the applied row, `role="alert"`, announced once) even though the expected failure surface here is smaller.

---

## 5. In-shop filters (Question 2)

### 5.1 The groups — the existing model, scoped (normative)

The shop offers the browse model's variety groups, computed over this seller's listings only, plus the shop-only Crop group ruled in by the §5.8 delta:

| Group | Source field per listing | Logic |
|---|---|---|
| Crop | the listing's crop (its `PlantRef`: slug + common name) — §5.8 | Single-select (a listing's variety belongs to exactly one crop) |
| Season | the listing crop's season class | Single-select (the data is single-valued per crop) |
| Sowing method | the listing crop's sowing methods | Single-select, as on `/variety` |
| Life cycle | the listing crop's life cycle (§11) | Single-select |
| Hue | the listing variety's color family (§11) | **Multi-select per PB-2** — OR within Hue, AND across groups |

Group order — Crop · Season · Sowing method · Life cycle · Hue (§5.8.2): the four inherited groups keep the model's relative order — the scan order a shopper learned on `/variety` never reshuffles (§0.1) — and Crop leads. Legends are the `BrowseFilters` eyebrow legends verbatim ("Crop" is the new group's legend).

Two groups from other surfaces are **not** offered, as decisions, not omissions:

- **Sellers** — meaningless inside one seller's shop; the facet is constant by construction.
- **Series** — on crop pages, Series groups one crop's varieties; inside one shop a series facet would subdivide a single crop's varieties, a grain no ruling asks for, and it is not offered. (The companion question — a crop facet — was §16 OQ-1; Dustin ruled it in on 2026-11-22 and it is designed at §5.8.)

### 5.2 The discrimination rule (normative)

A group renders on a shop only when it can discriminate there — Tranche 3 §2.2's principle ("a facet that is constant on a surface is shown as a fact, never as a one-option filter") applied per shop:

- A group is offered only if the shop's listings carry **at least two distinct values** in that group **and** at least two of those values have a non-zero count. A shop whose stock is all one season shows no Season strip; its season is a fact the About and the cards already carry, not a control.
- The rule is evaluated against the shop's **full** listing set, not the currently filtered set — a group never vanishes because the visitor narrowed another group. (A group's options may go to zero under other selections; §5.3 governs that.)
- Where Season, Sowing method, or Life cycle values are unclassified for some listings (the catalog carries null season classes and empty method lists), those listings belong to no option in that group; selecting any option in that group excludes them, and the group's "All" includes them. This matches the browse model, where the same nulls exist; the counts (§5.3) make the arithmetic visible before the tap, which is the protection.

### 5.3 Per-option counts — computed within the shop (normative)

Tranche 3 §2.4's contract, scoped: an option's count is the number of **this seller's listings** the shop would show with that option selected and every other group held at its current selection, **and the current search query held** (§6.4). Hue's counts follow §2.4.5's toggle definition under multi-select. Counts render inside the chips exactly as §2.4.2 specifies (muted numeral + screen-reader unit — the unit here is "listings": "12 listings"). A zero-count option renders its `0` and **stays operable** (§2.4.3). Counts and results always derive from the same set in the same computation, so the two can never disagree on screen.

### 5.4 Behavior (normative)

The strips are `BrowseFilters` + `FilterStrip` — single-line swipeable rows that never wrap, eyebrow legends, `.chip-filter` chips with swatch dots on Hue, edge fades, fine-pointer chevrons, and the Item 3.1-F FilterStrip finish (padding, scroll-padding, 44px chevrons) inherited, not re-specified. Enhancement semantics are Tranche 3 §2.5.8 verbatim: links with `aria-current` before hydration / without JS; `aria-pressed` buttons after; selected state never carried by color alone; targets 44px. A filter change resets pagination to page 1 (§10.2).

**Settled exception, named per §0.1:** there is no counts *payload* on this surface. Tranche 3 §2.5.6 specifies a server round trip for browse surfaces because their sets are paginated server-side; the shop's set is whole on the page (§2.3), so counts and results are computed locally from the shipped set. The observable contract — atomic consistency of results, counts, and applied set; last selection wins; failure leaves the prior state standing — is identical. The mechanism differs because the data's shape differs, and the difference is recorded here rather than discovered in review.

### 5.5 The applied row and Clear All (normative)

Tranche 3 §2.6, scoped: directly above the results, below the control block, one row shows what is shaping the view — one `.chip-filter.chip-removable` per active group ("{Group}: {Value}", accessible name "Remove the {Group} filter, {Value}"), one remover per selected hue under multi-select, and — shop addition — **one remover for an active search query** ("Search: “{q}”", accessible name "Clear the search for {q}"), because search is a scope on this page and the row's job is to show everything shaping the view except ordering (§2.6.1 excludes sort for the same reason it is excluded here). The row ends with **Clear All** ("Clear all filters" — or "Clear search and filters" when a query is active; Wren confirms final wording, the behavior is the contract) resetting every group **and** the search query in one action: one history entry, one announcement, one update. With nothing applied, the row is absent. The no-JS floor renders the row server-side with removers and Clear All as links (§10.4).

**Focus landing when an activation unmounts its own control (Ada Ruling 7, normative).** On any activation that unmounts the activated control in or from the applied row — if the applied row remains after the update, focus lands on the row's Clear All; if the row is removed because nothing remains applied, focus lands on the "{name}'s shop" `<h2>`, which the build makes programmatically focusable (`tabindex="-1"`, absent from the tab order) and which takes the global ring under plain `:focus`, not only `:focus-visible`; the count line's announcement is unchanged in both cases. This landing generalizes §5.7's zero-combination landing (where the row survives and Clear All receives focus) to every remover activation and to Clear All itself; §13 SH-15 tests it.

### 5.6 Announcement (normative)

The shop's count line (§3.3.4) is a **persistent live region** — present in the document before any change, `aria-live="polite"`, `aria-atomic="true"`, never remounted — whose text changes exactly once per deliberate change, in step with the visible results, announcing no loading or intermediate states. Proposed id: `#seller-results-count`, following the `#variety-results-count` / `#crop-results-count` naming. (The page has no count-line live region today; this is one of the register's differences, §12 S-4.)

### 5.7 The zero-combination state (normative)

A filter combination that empties this shop — including a combination with an active search — renders the designed empty state **inside the results region** (§9.2): the applied row stays visible above it, the count line reads "0 listings", and Clear All is offered in place. If the action that produced the empty state unmounts the activated control, focus lands on the applied row's Clear All — the playbook's one stated focus exception, applied as Tranche 3 §2.6.3 applies it. The general focus-landing rule for every activation that unmounts its own control in or from the applied row — including the case where the row itself is removed and focus lands on the "{name}'s shop" `<h2>` — is stated at §5.5 (Ada Ruling 7).

---

### 5.8 The Crop group — shop-only fifth group (Delta: OQ-1 ruled in, 2026-11-22)

Dustin, voice call 2026-11-22 15:48 PT, verbatim: "Add a Crop filter group in shops." This section is the delta that ruling commissions. The group is **shop-only**: it does not appear on `/variety` or any other browse surface, and nothing in this section changes the browse model of record. Everything not restated here is inherited from §§5.2–5.7 unchanged.

#### 5.8.1 The group (normative)

- **Legend:** "Crop". **Source field per listing:** the listing's crop — its `PlantRef`, which already carries the crop's slug and common name (§2.3). **Values:** the crops this seller stocks. **Chip labels:** the crop common names — the same words the cards carry as their subline, so the filter vocabulary and the results vocabulary are one vocabulary. Plain text chips: no swatch dot (Hue alone carries dots, §5.4), no artwork, no Latin name.
- **Single-select.** A listing's variety belongs to exactly one crop, so Crop partitions the shop's set — the same shape as Season and Life cycle, not Hue's multi-select. One active crop at a time; "All" is the resting value, as in every group.

#### 5.8.2 Placement — first in group order (normative)

Crop leads the group order: **Crop · Season · Sowing method · Life cycle · Hue** (§5.1, as amended). Two reasons: (a) crop is the primary browsing axis inside a shop — it is how the OQ-1 recommendation framed the shopper's first question ("show me their zinnias"), and the primary axis leads; (b) the four inherited groups keep their model's relative order after it, so the learned scan order is extended, never reshuffled (§0.1).

#### 5.8.3 Discrimination, counts, combination (normative — inherited, stated for the gate)

- **Discrimination (§5.2 applies unchanged):** the Crop strip renders only when the shop's **full** listing set carries at least two distinct crops **and** at least two of them have non-zero counts. A single-crop shop shows no Crop strip: its crop is a fact every card's subline already states, never a one-option filter (§5.2's principle).
- **Counts (§5.3 applies unchanged):** each crop's count is computed locally from the shop's whole on-page set, holding every other group's current selection **and** the current search query. A zero-count crop renders its `0` and stays operable (§5.3). **No new payload:** the crop slug and common name are already shipped per listing (§2.3); §11 is unchanged by this delta.
- **Combination (§6.4 applies unchanged):** Crop AND-combines with Season, Sowing method, Life cycle, Hue (OR within Hue), and search. Selecting a crop resets pagination to page 1 (§10.2), creates exactly one history entry, and announces once through the §5.6 live region.
- **Applied row and focus (§5.5 applies unchanged):** an active crop appears in the applied row as a remover ("Crop: {common name}", accessible name "Remove the Crop filter, {common name}"); Clear All clears it with everything else in one action; and §5.5's focus-landing rule (Ada Ruling 7) governs a Crop remover activation exactly as it governs every group's — if the activation unmounts the remover and the row remains, focus lands on Clear All; if the row is removed, focus lands on the "{name}'s shop" `<h2>`.

#### 5.8.4 Ordering of values within the group (normative — ruled here, no precedent exists)

"All" first (the resting chip, as in every group), then **crop common names A–Z**. The inherited groups order their values by a canonical vocabulary order (season classes, method, life-cycle progression, the Hue spectrum) because their vocabularies are closed and semantic. Crops have no canonical order anywhere in the catalog — the vocabulary is open and shop-specific — so no canonical order exists to inherit. Alphabetical is ruled because: (a) it is the order a shopper can predict and scan by recognition — the chip they want is where its letter puts it; (b) it matches the shop's own Name A–Z discipline, so one ordering idea serves the whole page; (c) it is **stable** — computed from the shop's full set, it never re-sorts when counts change under other selections, so a chip's position is learnable within a visit. Ordering by count (largest crop first) was considered and rejected for exactly that stability reason: counts move as other groups narrow, and a strip that reshuffles under the visitor's fingers charges re-scanning on every tap.

#### 5.8.5 Value cap — none (normative — ruled here, following the inherited precedent)

**There is no cap.** Every crop in the shop's full set renders as a chip in the one strip, however many crops the shop spans. The inherited groups set the precedent: each renders its complete vocabulary (Hue renders all thirteen families) with no truncation, no "more" expander, and no overflow menu — and the `FilterStrip` mechanics (§5.4: single line, swipeable, edge fades, chevrons) are the site's settled answer to a long strip. A cap would break three contracts at once: a capped-out crop could not be selected, counted, or deep-linked (§10.1), and an active crop must always be present as a chip. The honest cost is named: the largest shop's Crop strip is a long swipe. That cost is accepted — it is the same cost Hue already charges on `/variety`, paid in the same currency.

#### 5.8.6 URL parameter (normative)

Crop state lives in the shop URL as **`crop=<slug>`** — the site API's existing crop parameter name (`listParam("crop", "Crop slug")`), new only to this page, so §10.1's vocabulary is extended, not invented. Parsing follows the site's filter-parser discipline (the `paging.ts` pattern): an unrecognized value is ignored — the shop renders with all crops — never a 404. A **valid crop slug the shop does not stock** is a different case: the URL states a real crop and a real shop that simply has none of it, so the shop renders the §9.2 zero-combination state with the Crop remover in the applied row — not a 404, and never an unfiltered list under a filtered URL (§10.4).

---

## 6. In-shop search (Question 3)

### 6.1 Placement and form (normative)

One search field, inside the catalog section's control block, above the filter strips (§3.3.2), present when the shop's size earns it (§8). It is a plain search input in a GET form — **not** the global `SearchBox` combobox:

- `<form role="search">` with `action` = the shop's own URL and `method="get"`; the input is `type="search"`, `name="q"` (the site's existing query parameter), `enterKeyHint="search"`, with a visible submit button ("Search").
- The field's label names the scope, in the seller's name, as a **visible label** — e.g. label "Search {name}'s shop", placeholder "Variety or flower name…". The contract is that the scope is perceivable before typing and remains perceivable while typing. A generic "Search" field on this page would lie by omission: the visitor must be able to tell, before typing, that this searches the shop and not the directory. (Final wording is Wren's; the scope-naming obligation is this spec's.) **Ada Ruling 6 governs the labeling:** the visible label is binding — it must be the field's programmatic label — and the screen-reader-label + scope-carrying-placeholder alternative formerly offered here is struck and **not approved** for this build; a placeholder is an example, never a carrier of scope.
- The field never appears in the site header, the page header, or anywhere else on the page — one search field per shop, in the shop section, so it can never be mistaken for the directory search.

### 6.2 Behavior — as-you-type, in place (normative)

- **Typing narrows the shop in place.** From **2 characters** (the site search's `MIN_QUERY_CHARS`, applied for consistency), the results region updates in place under §4's preservation rules: no navigation, no skeleton, scroll and surrounding content unmoved. Debounce follows the site's search discipline (~300ms, the `SearchBox` value); because the data is on the page, the update itself is effectively instant once the debounce fires. Focus stays in the field throughout — typing is never interrupted by the update, and the field's content is never rewritten by the system.
- **Submit also works and means the same thing.** Enter or the Search button applies the query as one deliberate change (one history entry, §10.2). Without JS, submit is the mechanism: the GET form navigates to the shop URL with `q`, and the server renders the narrowed shop (§10.4). The enhanced and floor paths land on identical states.
- **Clearing the field clears the scope.** Deleting the query back below 2 characters (or emptying the field) restores the un-searched — but still filtered, still sorted — view in place, as one change. The search remover in the applied row (§5.5) and Clear All do the same from outside the field. The field and the applied row never disagree: an active query shows in both, an inactive one in neither.
- **No page-view bookkeeping.** A search change fires no page-view analytics and no view beacon (§4, Tranche 3 §2.5.7). Whether in-shop searches are additionally logged as search events with the seller's scope is **not** decided here — §16 OQ-8.

### 6.3 What it matches, and in what order (normative)

The query matches against, for each of the seller's listings:

- the **variety name**, and
- the **crop (common) name** — the card's subline, so a shopper who remembers "zinnia" but not the variety name finds the shop's zinnias. This is the in-shop equivalent of the directory search matching crops. Since the §5.8 delta, browsing by crop also has a recognition path — the Crop filter group; search-by-crop-name remains the recall path, and the two combine (§6.4).

Matching follows the site search's classes (Tranche 3 §5.3.2), scoped: exact name match, then prefix (name or a word of it starts with the query), then substring. While a query is active, the results order is **match class first, then variety name A–Z** — searching imposes relevance order, exactly as the directory's `/search` carries no alphabetical sort (§7.2 states the sort interaction). Variety aliases are **not** matched in this build: the listing payload does not carry them (§2.3), and inventing a second alias source for one page is out of proportion; if a future payload carries aliases, matching them is an amendment, not a silent extension. Latin names are likewise not matched in-shop (the directory search's placeholder promises them; the shop field's placeholder must therefore not promise them — §6.1's wording obligation includes this honesty).

### 6.4 How search and filters combine (normative)

- **AND, always.** The visible set is: listings in this shop ∧ matching the query (if active) ∧ satisfying every filter group's current selection (OR within Hue). Neither mechanism resets, clears, or suspends the other. Applying a filter while a query is active narrows the searched set; typing a query while filters are active searches within the filtered set.
- **Counts respect both.** Per-option counts hold the current query (§5.3); the count line under a query reads as a match count (§7.3).
- **One state, one URL.** Query, filters, and sort share the page's single state and URL (§10.1); Back steps through deliberate changes of any of them in the order the visitor made them.

### 6.5 The no-matches state (normative)

A query with no matches in this shop renders inside the results region (§9.3): it names the query and the shop ("No matches for “{q}” in {name}'s shop."), states the combined scope when filters are also active ("…with the current filters applied."), and offers recovery in place — clear the search (one tap, filters kept) and, when filters are active, clear search and filters together. Where a near match exists **within this shop's names**, the state offers it as a did-you-mean link under Tranche 3 §5.3.4's bounded rule (same first letter, edit distance ≤2, at most one suggestion, ties to the name with stock then alphabetical) — scoped to the shop's variety and crop names, computed from the set already on the page. If no candidate qualifies, the state is the plain recovery above. Wren confirms final wording; the obligations — name the query, name the shop, name the combined scope, offer both recoveries — are the contract.

### 6.6 Settled exception — no autocomplete panel (normative)

The directory's search pattern (Tranche 3 §5.3) is a combobox with a suggestion panel, because there the visitor is choosing a *destination*. In the shop there is no destination to choose: the results are the list directly below the field, updating as the visitor types. A suggestion panel would duplicate the results region a few inches above itself, compete with it for focus semantics, and charge the visitor a second list to read for zero additional finds. The shop field therefore has **no listbox, no combobox semantics, and no suggestion fetch** — it is a labeled search input whose results region is the page's own list, announced by the §5.6 live region. This is the §0.1 named exception, with its reason; §15 PB-S1 carries it as pushback so the deviation from the search pattern of record is Dustin-visible, not buried.

---

## 7. Sort within the shop (Question 4)

### 7.1 The control (normative)

Where it appears (§8), the sort control is the Tranche 3 §5.2 control in form and behavior — a single-select chip group labeled "Sort", built from `.chip-filter`, rendered in the control block after the filter groups and before the applied row, riding §4's in-place contract in full: URL parameter `sort` (absent = default), one history entry per change, page reset to 1, links as the no-JS floor, announcement via the count line. It is not in the applied row (§5.5).

### 7.2 Options — translated to a one-seller world (normative)

The `/variety` options do not transplant literally: "Most sellers first" is meaningless where there is one seller. The shop's three options, maximum, in the control's order:

1. **"In stock first"** — the grouped order (§7.5): the orderable section first, the not-orderable section below, variety name A–Z within each section. **This is the shop's default and resting order** (OQ-3, ruled 2026-11-22), and the order the un-tooled shop (§8) renders in.
2. **"Name A–Z"** — variety name ascending across the whole set, availability ignored. This is PB-1's order, retained as an explicit choice; it is no longer the shop's default (§7.5.2).
3. **"Recently checked"** — the listing's last-checked date descending, then name ascending: the freshest stock information first, which in a single shop is the "what's new / just verified" order. Ungrouped (§7.5.2).

Parameter values follow §5.2.3's vocabulary where they correspond: `sort=name` for Name A–Z, `sort=recent` for Recently checked; the availability value is `sort=availability`, read in-shop as "In stock first" (the parameter names the ordering concept, the label names it in the shop's terms — the same split §5.2.3 already accepts between value and label). Per §7.1, an absent `sort` parameter means the default — which in the shop is now the grouped "In stock first" order; `sort=availability` is the explicit selection of that same order.

While a search query is active, results are relevance-ordered (§6.3) and the sort control is **not offered** — it renders in its place in the control block but disabled-with-reason is a pattern this site does not use; the control is absent while `q` is active and returns, with its prior selection intact, when the query clears. This mirrors `/search` carrying no sort control (§5.2.1 of Tranche 3) and prevents two orderings from claiming the same list. The count line states the truth in both states (§7.3).

### 7.3 The count line's ordering phrase (normative)

The line must never claim an order the list is not in (Tranche 3 §5.2.3's honesty rule):

- At rest (the grouped default, §7.5): "{N} listings, in stock first." (plus the pagination suffix when paginated). The resting line now carries the ordering phrase because the resting order is no longer the alphabetical order a bare count once implied — a line that said only "{N} listings" would let a visitor assume A–Z over a list that is grouped.
- Sorted explicitly: "{N} listings, A–Z." / "{N} listings, in stock first." / "{N} listings, most recently checked first." — the phrase always names the order actually applied, including when the grouped order was reached by explicitly selecting "In stock first".
- The grouped phrase is uniform: it does not change when one section is empty. "In stock first" states the ordering rule, and it is true of a shop with nothing out of stock and of a shop with nothing in stock alike; the all-sold-out fact itself is carried by the §9.4 notice, not by bending the count line per state.
- Filtered: the narrowed total replaces N, phrasing otherwise as above (filtered sets are ordered by the active sort — under the default, grouped within the narrowed set, §7.5.3).
- Searched: "{N} matches for “{q}”, best match first." (plus the filtered-scope fact carried by the applied row; Wren confirms final phrasing, the facts are the contract.)

### 7.4 Position on the default — RULED: the shop splits from PB-1 (§7.5)

**The shop default is the grouped "In stock first" order (§7.5).** As first written, this section followed PB-1 (Name A–Z) and §16 OQ-3 carried the shop-specific split as an open question, with §15 recording the storefront case for availability-first. Dustin ruled that question on 2026-11-22 (§16 OQ-3): shops get the grouped default. **PB-1 itself is unchanged** — site-wide browse on `/variety` keeps pure Name A–Z as its default; the split is shop-only, exactly as OQ-3 contemplated. The one-pattern rule (§0.1) yields here to an explicit ruling by the only person who can split a default by surface, and the split is recorded in §7.5 rather than left as an accident of the build.

---

### 7.5 The grouped default (Delta: OQ-3 ruled, 2026-11-22)

Dustin, voice call 2026-11-22 15:49 PT, verbatim: "In stock should be at the top but it should also be A to Z in both the top and the out of stock sections."

#### 7.5.1 The two sections (normative — ruled here from the availability vocabulary)

The shop's listings carry exactly five `Availability` values: `in_stock`, `preorder`, `unknown`, `shop_closed`, `sold_out`. The grouped order partitions them into two sections:

- **Top section — orderable now:** `in_stock` and `preorder`. This is §9.4's existing definition of an orderable state, adopted rather than reinvented. Preorder belongs at the top because a preorder listing can be ordered today — the visitor's errand succeeds there — and printing it in an "out of stock" section would state a falsehood about a card whose own stock line says otherwise. Dustin's "in stock" is read through this orderable definition; the alternative reading (only `in_stock` at the top, preorder demoted) was rejected for that falsehood, and the reading is recorded here so the gate can see the translation.
- **Bottom section — not orderable now:** `unknown`, `shop_closed`, `sold_out`. Unknown cannot be promised as orderable (the top section is a promise the data must be able to keep), shop-closed means the seller is not selling, and sold out is sold out.

**Within each section, variety name A–Z is the sole ordering key.** There is no availability sub-tiering inside the bottom section: Dustin's ruling requires A–Z *in* the out-of-stock section, and interleaving tiers (all unknowns before all sold-outs, say) would break pure A–Z across that section. This supersedes the five-tier ordering (in stock → preorder → unknown → shop closed → sold out, name within tier) that §7.2 specified for the pre-delta "In stock first" option; that tier order no longer exists anywhere in the shop's sort.

#### 7.5.2 Interaction with the other sort options (normative)

- **The grouped order REPLACES the tier-based "In stock first" option — it does not coexist with it.** The label "In stock first" survives; its definition is now the grouped order (§7.2, as amended). Two availability-first options differing only in how the bottom section interleaves would be an indistinguishable choice — the visitor cannot predict the difference from the labels, which is a Hick's Law and consistency failure bought for nothing.
- **"Name A–Z" is retained** as the pure alphabetical order across the whole set (§7.2) — PB-1's order, one tap away, for the visitor who wants the catalog straight.
- **"Recently checked" is unchanged and ungrouped.** Its primary key is freshness across the whole set; grouping it would falsify its count-line phrase ("most recently checked first") wherever an older-checked in-stock listing jumped a fresher sold-out one.
- While a search query is active, relevance order still governs and the sort control is still absent (§7.2); when the query clears, the prior sort state — the grouped default included — returns as §7.2 already provides.

#### 7.5.3 Where the grouped order applies (normative)

The grouped order is the shop's resting order **at every §8 band**, including the un-tooled T ≤ 8 shop, which has no sort control but renders its full list grouped — a shop's resting order must not depend on whether its size earned it a control. Filtered and paginated views inherit it the same way: a narrowed set under the default is grouped within itself, and pagination slices the grouped list as one list (§7.5.4).

#### 7.5.4 Presentation — ordering only (normative behavior contract for Mina)

**The grouping is an ordering, not a presentation.** The results remain one continuous card list: no section headings, no "Out of stock" subhead, no divider, no boundary marker of any kind, and no separate pagination of sections — a page break falls wherever `PAGE_SIZE` falls, including inside a section. The behavior contract Mina designs from:

1. The boundary between sections is invisible. Each card already carries its own stock state (dot + word + checked date), so the information a heading would announce is already on every card it would cover.
2. Section chrome was rejected on mechanics, not taste: under filters and search the sections change size or vanish per state, so headings would appear, disappear, and strand across page breaks — layout shift and orphaned labels on exactly the states §9 designs for calm.
3. List semantics stay single-list; the order is announced by the count line's phrase (§7.3), which is the designed channel for it.
4. Dustin ruled an ordering ("at the top"), not a presentation. If usability evidence later argues for visible sections, that is a new amendment through Mina's pass and Quinn's gate — the builder adds no section chrome under this spec, and the register (§12 S-14) contains none.

#### 7.5.5 Scope (normative)

Shop only. `/variety` and every other browse surface keep PB-1 untouched: pure Name A–Z default, no grouping. No other surface's sort options change.

---

## 8. Small-catalog thresholds — when the tools appear (Question 6)

### 8.1 The principle

A find-tool is worth its chrome only when the set has outgrown the cheaper find-path it replaces. There are two cheaper paths, and they fail at different sizes:

- **Scanning fails first.** The seller-context card is a tall card (artwork rail, status, packets); at phone width roughly three to four cards fill a screenful. A set a visitor can take in within about **two screenfuls** needs no tooling at all — the whole shop is effectively visible, and any control costs more attention than the scrolling it saves (Hick's Law; the minimalist heuristic). Two screenfuls ≈ **8 listings**.
- **Paging fails second.** The site's own definition of "one page of results" is 24 (`PAGE_SIZE`). Up to one full page, attribute narrowing (filters) plus ordering (sort) plus scanning covers the set: every listing is at most one page away and the page is the unit the visitor already understands. Past one page, a visitor who knows a name must not have to page for it — **name recall (search) becomes the fastest path**, and search earns its place.

Filters and sort are recognition tools (the visitor picks from what is shown); search is a recall tool (the visitor must produce a name). Recognition tools earn their chrome as soon as scanning fails; the recall tool earns its chrome when the set outgrows the page. That asymmetry is the principle; the numbers are its application to this site's card height and page size.

### 8.2 The rule (normative)

Let T = the shop's listing total (the page's own `total`, as the count line states it — not the header's variety count):

| T | Search | Filters | Sort | The page |
|---|---|---|---|---|
| 0 | — | — | — | The empty shop (§9.1) |
| 1–8 | No | No | No | The full list in the shop's grouped default order (§7.5.3), one page — exactly today's page plus the §3.1 heading and the §7.5 order |
| 9–24 | No | **Yes** | **Yes** | One page; filters per the §5.2 discrimination rule |
| 25+ | **Yes** | **Yes** | **Yes** | Search + filters + sort; pagination as today |

Applied to today's catalog (§2.2, variety count as proxy): 48 sellers land in the no-tools band, 17 in the filters band, 18 in the full shop band — the tools appear exactly on the shops whose size makes today's page hard to use, and the median shop keeps today's simple page.

Three corollaries:

1. **Thresholds are evaluated on T, never on the narrowed set.** Filtering a 179-listing shop down to 3 results does not remove the tools that got the visitor there; the control block's presence is a property of the shop, stable across every state of the visit.
2. **The §5.2 discrimination rule still applies inside the filters band and above** — a 30-listing single-season shop shows Hue (if it discriminates) and no Season strip. Threshold decides *whether tooling*; discrimination decides *which groups*.
3. **No hysteresis, no per-visitor variation.** T changes only when the catalog changes; a shop crossing a threshold between visits simply gains or loses the tools, in the same positions, which is the correct behavior for a directory whose data is rechecked continuously.

### 8.3 Below the threshold — what the page looks like

For T ≤ 8 the page is today's page with the §3.1 heading change and nothing else: header, About, reviews panel, the full card list under "{name}'s shop", claim line. No disabled or greyed-out tools are shown (a control that cannot help is not rendered, per the error-prevention and minimalist heuristics — and a visible-but-absent search would invite the directory-scope mistake §6.1 guards against). For 9 ≤ T ≤ 24 the control block holds filters and sort only; there is no search-shaped hole in the layout — the block composes from what is present.

---

### 8.4 Effect of the fifth group (Crop) on the bands — the bands stand (Delta, §5.8)

Adding Crop changes the control block's size wherever filters appear, and this section states the consequence honestly rather than letting the build discover it:

- **The threshold numbers stand — 8 and 24, unchanged.** The bands are derived from T by the failure of the cheaper find-paths (§8.1): scanning fails at about two screenfuls of cards, paging at one `PAGE_SIZE` page. Neither failure point is a property of how many filter groups exist; a fifth group does not make an 8-listing shop harder to scan or a 24-listing shop span more pages. Re-deriving the numbers from chrome size would optimize the wrong variable.
- **The size cost is real, bounded, and stated:** one additional strip is one eyebrow legend plus one 44px chip row in the `FilterStrip` stack — exactly one row more than the four-group design at the 9–24 band and at 25+. At 9–24 that band's worst case is now five strips plus sort above the first card (search is still absent there — Crop does not move the search threshold, because search's justification is variety-name recall past one page, and a crop recognition path is not a substitute for it). The §5.2 discrimination rule prunes the worst case in practice: a 9–24-listing shop that discriminates on all five groups at once is possible but uncommon, and a single-crop shop in the band shows no Crop strip at all.
- **The cost lands on scroll distance to the first card**, which is a composition and measurement concern — Mina's control-block composition and the PB-M6 fixture drive (SH-17) — not a threshold input.

---

## 9. Empty and depleted states (Question 5)

Every state below renders **inside the results region** (except §9.1, which *is* the region's resting content), keeps the control block and applied row in place above it, and is announced through the §5.6 live region like any other result count.

### 9.1 The empty shop — no listings at all

T = 0 (16 sellers today). Unchanged from today in substance: the `SELLER_NO_LISTINGS` line ("No listings for this seller yet.") with the "Browse all varieties" link, under the "{name}'s shop" heading. No tools (§8.2), no count line change (the line does not render a bare "0 listings" above the message — today's rendering stands). The shop framing does not invent stock, a "coming soon", or any promise the data does not make.

### 9.2 Filtered to empty

Covered at §5.7: "0 listings", the state names the situation and the shop in the fixed form ruled at COPY §5 (CS-19): "No listings in {name}'s shop match those filters." (possessive per COPY CS-05; the shop is named because the visitor's recovery differs from the directory's), the applied row stays visible, Clear All recovers in place, focus follows §5.7's rule.

### 9.3 Searched to empty

Covered at §6.5: query and shop named, combined scope named when filters are active, both recoveries offered, bounded did-you-mean where a candidate exists in-shop.

### 9.4 The all-sold-out shop

Listings exist, and every one is sold out (or shop-closed): the catalog renders **normally** — sold-out cards already have their designed dress (stepped-down ground, outline-only pill that still works through `/go/`), and a shop's honesty about its stock is carried by the cards, not hidden by the page. One addition: when T > 0 and the number of listings in an orderable state (in stock or preorder) is **zero**, a single notice line renders directly under the count line: "{name} has nothing in stock right now — listings are shown with their last checked dates." (Wren confirms wording; the obligations are: name the seller, state the fact, point at the checked dates the cards already show.) The notice is a fact line, not an error state: tools behave normally, filters still narrow, and a filter or search that surfaces only sold-out stock does not re-trigger or duplicate the notice (it is a property of the shop, computed on T, per §8.2's corollary 1). No equivalent notice exists for partial stock-outs — the cards and the "In stock first" sort carry that information at the right grain.

### 9.5 Failure of an in-place update

Per §4: prior results, counts, and URL stand; the control's selected state reverts; one in-place error line appears with the applied row ("That didn't apply — you're still seeing the previous results. Try again." — Wren confirms), `role="alert"`, announced once, not repeated per retry.

---

## 10. URL, history, pagination, and the no-JS floor (Questions 7–8 in part; §9 covers Item SI)

### 10.1 URL as state (normative)

In-shop state lives in the shop URL's query parameters, using the site's existing parameter names — no new names are minted: `crop` (the Crop group's slug value, §5.8.6 — the site API's existing crop parameter, new only to this page), `season`, `method`, `life_cycle`, `color_family` (Hue multi-select encoding exactly as Item 3.1a builds it for `/variety`), `sort`, `q`, `page`. A shop URL with parameters is a complete, shareable description of a shop view: "GeoSeed's cool-season zinnias" is a link a gardener can send, and it lands on exactly that view. Filtered, searched, and sorted shop views are **noindexed with the canonical set to the unfiltered shop URL** — the metadata discipline `/variety` already applies to its filtered views, extended to this page unchanged in spirit: the shop is one document with many views, and the unfiltered view is the canonical one. The page `<title>` does not change with state (as on `/variety`).

### 10.2 History discipline (normative)

Tranche 3 §2.5.4 verbatim, applied: state updates go through the History API; **one deliberate change = exactly one history entry** (a filter tap, a hue toggle, a sort change, a search submit, an applied-state change from typing that settles — see below); re-tapping the active option is a no-op (no entry, no announcement); hydration and programmatic sync create none; Back/Forward restore the prior state **in place** — selections, query, counts, results, applied row together — and Back never exits the shop over a shop-state change. Any filter, search, or sort change resets pagination to page 1 (`?page=` is never carried across a state change). A local-scope change is not a page view and fires no view beacon (§4).

One shop-specific ruling on typing: as-you-type search updates (§6.2) do **not** create a history entry per keystroke or per debounce. The entry is created by the deliberate act — submit, or the field losing focus with a changed query, or clearing via the applied row — so Back from a searched shop returns to the pre-search view in one step, not through a trail of partial queries. The live URL reflects the settled query (updated with `replaceState` during typing, `pushState` on the deliberate act), so a refresh or a copied link mid-typing still lands on the current view. (This refines, for the typing case only, §2.5.4's one-change-one-entry rule; the refinement is stated here so the build does not have to invent it, and Quinn's check §13 SH-7 tests it.)

### 10.3 Pagination remains navigation (normative)

Moving between pages of an unchanged shop state remains true navigation, exactly as Tranche 3 §2.5.5 rules for browse surfaces: each page is an indexable document (subject to §10.1's canonical discipline for stated views), pagination links keep their behavior, and the bounds rule holds against the **narrowed** total — an out-of-range page under a filter or query answers a true 404, as the unfiltered shop already does (§2.1, verified live). Pagination links carry the active filter/search/sort parameters, as `chipHref`'s discipline already provides on browse surfaces.

### 10.4 The no-JS floor (normative)

With JavaScript disabled or before hydration, the shop is fully usable at every state:

- Filter chips and sort chips are links to the same state URLs; the search field is the §6.1 GET form; applied-row removers and Clear All are links (§5.5).
- The server renders, for any shop URL, the correct narrowed results, counts (including per-option counts), selected states, applied row, count line, and pagination for that URL — never an unfiltered list under a filtered URL, never a dead control.
- The floor may navigate (that is what a fallback is); it may never present a state the enhanced path cannot also reach, or vice versa: the two paths share one state vocabulary (§10.1) and one rendering of it.

### 10.5 PWA and lifecycle

Nothing in this design adds a route, a shell requirement, or stored state: the shop is the existing seller page with an enhancement layer, installable and restorable exactly as the page is today. Shop state lives in the URL (§10.1), so the kill-and-restore and tab-switch cases reduce to the URL discipline — a relaunched shop deep link lands on the view it names, with a sensible back path (the seller index via breadcrumbs, as today).

---

## 11. Data and payload build inputs (normative contents)

Presentation-only in the model; two payload completions and one computation placement are build inputs, stated here so the brief carries them:

1. **Per-listing facet fields.** Each listing shipped to the seller page gains its crop's `lifeCycle` and its variety's `colorFamily`, sourced from the same catalog rows the variety summary and crop layers already read (§2.3). No new data is collected, no listing field changes meaning, and **no price field enters any payload** — the facet block contains exactly: season class, sowing methods, life cycle, color family (the first two already present via `PlantRef`).
2. **The full set ships.** The enhancement layer receives the seller's complete listing set with the facet fields (the server already loads it entire, §2.3), plus each listing's availability and last-checked date (already on the card payload) for the §7.2 orders. At the current ceiling (179 listings) this is a modest page-weight addition; §13 SH-12 measures it rather than assuming it. If a future seller's catalog grows by an order of magnitude, the fallback shape is Tranche 3 §2.5.6's payload pattern scoped by seller — the observable contract in §§4–7 is written so either mechanism satisfies it.
3. **Counts are computed from the shipped set**, server-side for the first paint and client-side for updates, from the same facet fields — one definition (§5.3), two execution sites, no possibility of the SSR and enhanced counts disagreeing in definition.
4. **Contact fields.** The seller payload gains two nullable fields — customer service phone and customer service email — populated only from the sweep's verified, seller-published channels (§3.5.5). Null/absent is the expected value for most sellers at build time and renders as absence (§3.5.3), never as an empty string or a placeholder value. Field names are the builder's; the contents and the provenance bar are this contract's. The homepage field already exists and does not change.

---

## 12. Change register — the complete list of allowed differences

The build is correct if and only if a before/after comparison of `/seller/<slug>` shows **these changes and no others**:

| ID | Change | Where |
|---|---|---|
| S-1 | Listings section heading: "Listings at {name}" → "{name}'s shop" | Catalog section |
| S-2 | Search field appears in the catalog control block, per §8 thresholds (T ≥ 25) | Catalog section |
| S-3 | Filter strips (Season · Sowing method · Life cycle · Hue, discrimination-gated per §5.2) and the sort control appear, per §8 thresholds (T ≥ 9), on the shared `BrowseFilters`/`FilterStrip` machinery | Catalog section |
| S-4 | The count line becomes a persistent live region and gains ordering/match phrasing per §7.3 | Catalog section |
| S-5 | Applied-filter row + Clear All appear above the results when any filter or search is active (search remover included; sort excluded) | Catalog section |
| S-6 | Per-option counts appear inside filter chips, computed within the shop | Catalog section |
| S-7 | Filter/search/sort activations update in place after hydration (no document navigation, no skeleton); pagination remains navigation; state lives in the URL per §10 | Catalog section |
| S-8 | New designed states inside the results region: filtered-to-empty (§9.2), searched-to-empty with bounded did-you-mean (§9.3), update-failure line (§9.5) | Results region |
| S-9 | All-sold-out notice line under the count line, when T > 0 and nothing is orderable (§9.4) | Catalog section |
| S-10 | Payload: per-listing facet fields (life cycle, color family) added; full listing set available to the enhancement layer (§11). No price field anywhere | Server payload |
| S-11 | Filtered/searched/sorted shop views become noindexed with canonical to the unfiltered shop URL (§10.1) | Metadata |
| S-12 | The seller contact block appears in the header (§3.5): the existing homepage button is ruled the block's website channel (component, destination, and convention unchanged), **and its label changes as ruled in COPY §1 (CS-01): "Visit their website ({host})", replacing the shipped "Visit {name} ({host})"** — destination, component, and convention unchanged; and a phone row (`tel:`) and/or email row (`mailto:`) render directly under it **when and only when** the seller's sweep-collected fields are present — visible number/address as the link text, service-label slot before each. Sellers without the fields show no rows, no placeholders, and no absence copy (§3.5.3's matrix) | Header |
| S-13 | **Delta (OQ-1 ruled, 2026-11-22):** a fifth, shop-only filter group, Crop, appears in the catalog control block (§5.8): first in group order, single-select, plain-text chips labeled by crop common name ("All" first, then A–Z, no value cap), discrimination-gated per §5.2, counts per §5.3 computed locally from the already-shipped set (**no payload change — §11 unchanged**), AND-combined with the other groups and search, applied-row remover under §5.5 (focus landing included), state in the URL as `crop=<slug>` (§10.1). Renders only where filters render per §8 and only when the shop stocks ≥2 crops | Catalog section |
| S-14 | **Delta (OQ-3 ruled, 2026-11-22):** the shop's default and resting order becomes the grouped order (§7.5): orderable listings (`in_stock`, `preorder`) first, not-orderable (`unknown`, `shop_closed`, `sold_out`) below, variety name A–Z as the sole key within each section; the "In stock first" sort option's definition changes to this grouped order (the former five-tier order is removed); "Name A–Z" and "Recently checked" options unchanged in definition; the resting count line gains the "in stock first" phrase (§7.3); ordering only — no section headings, dividers, or separate section pagination. Shop only: `/variety` keeps PB-1 | Catalog section |

**What must NOT change — checked at the gate:** the header except for S-12's contact-block rows (eyebrow, H1, badge row and legend, the three definition-list entries and their order, the A4 state link with its 22px `StateShape`, the Visit button's component, destination, and outbound convention, the disclosure line, the StatePlate — all unchanged); About's position, heading, and content; the "Reviews from Google" panel's position, label, content, and separation from our rating; our rating's rendering ("Not yet rated"); the Quiet Ledger cards in variety context, byte-for-byte (seller context is replaced by the unified variety card per SPEC-GRID-CARD G-1/G-2), including the artwork rail, packet sizes, stock line, and the "Visit shop →" pill's `/go/` behavior — and, per §3.5.1, no listing link is ever replaced by or supplemented with the homepage link; pagination's component and page size; the claim line; breadcrumbs; the zero-listing rendering (`SELLER_NO_LISTINGS` + link); the seller index and every other surface. In particular: **no second state outline is added anywhere on this page** (§9A), and no copy changes beyond the lines this spec names, each subject to Wren's confirmation where marked.

---

## 9A. Relationship to Item SI — the state outline (Question 7)

Mina's placement spec (`state-icons/PLACEMENT-SPEC.md`) places the state outline on this page at exactly one point: **A4** — inside the Location definition-list entry's state link, 22px box, before the state name, linking to `/state/{slug}`. That placement already exists in the shipped page (§2.1) and is inside the shop's header.

**Ruling: the shop header adds nothing.** No state outline beside the H1, none in the shop heading, none on the catalog cards, none in the control block. Reasons:

1. **One naming moment per surface.** Mina's pushback §8.1–8.2 argues the icon belongs at the surface's naming moment and that duplicates stacked within a screenful are noise, not wayfinding. The shop page's naming moment for the state is the Location link — a link whose entire job is that state. A second outline in the same header would duplicate it within the same screenful.
2. **The cards cannot carry it honestly.** In seller context the card subline is the crop name, not a location; the state name is never rendered as structured data on the card (the same fact Mina's N5 records for variety context). Bolting an outline onto a card that does not name the state would decorate data the card does not present.
3. **The shop framing does not change what the icon means.** "Their shop" is a stance toward the catalog (§0), not a new identity block; the identity block — including A4 — is §3.2's unchanged territory.

The build's obligation is purely protective: A4 renders exactly as today after the build (22px, same link, same accessible name — the icon is `aria-hidden` and contributes nothing to it), for all 31 states as Item SI completes the set, and the §12 register's no-change list is the gate's checklist for it.

---

## 13. Acceptance checks — for Quinn's gate (all executable)

Run in a fresh scratch worktree per the standing gate approval; before/after comparisons against pre-build `origin/main`. Real-browser drives are usability gates: drive the built surface as a user with a goal, at 390px first, then 820px and 1280px. Test shops: a 0-listing seller, a ≤8 seller, a 9–24 seller, 3 Porch Farm (34), GeoSeed (179).

- **SH-1 (header invariance):** on all five test shops, the header, About, and reviews panel (where present) render identically before/after — including the A4 state link's accessible name and target, the badge row, and "Not yet rated" — with the sole exceptions of §3.5 contact-block rows on test shops whose fixtures carry the new fields (SH-14 governs those) and the S-12 website-button label change (the ruled CS-01 label "Visit their website ({host})" replacing the shipped "Visit {name} ({host})"; §12 S-12). A diff anywhere else above the catalog section fails.
- **SH-2 (thresholds):** the ≤8 shop shows no search, filters, or sort; the 9–24 shop shows filters + sort and no search; 3 Porch Farm and GeoSeed show all three. Presence is a property of T: narrowing GeoSeed to 3 results removes none of the tools.
- **SH-3 (discrimination):** on a shop whose stock is single-season (find or fixture one), no Season strip renders; on GeoSeed, every rendered group has ≥2 non-zero options at rest.
- **SH-4 (in-place drive):** on GeoSeed: tap Season → a Hue (multi-select: tap a second Hue) → sort → type a 3-character query. Pass: no document load at any step; scroll position and focus preserved per §4 (focus stays in the search field while typing); each update lands ≤400ms; history grows by exactly one per deliberate change (typing contributes one, per §10.2, on submit/blur — not per keystroke); Back steps restore each prior state in place without leaving the page.
- **SH-5 (counts reconcile):** for each group on GeoSeed and 3 Porch Farm, every option's displayed count equals the result total of a fresh server load of the URL that option represents with the other groups and the query held (spot-check ≥8 options incl. one 0-count, one selected Hue under multi-select, and every "All").
- **SH-6 (combination semantics):** with a query and two filter groups active, the visible set equals the AND of the three scopes (verify against the shipped data for one hand-computed case); clearing the query alone keeps both filters; removing one filter keeps the query; Clear All clears query + filters in one action, one entry, one announcement.
- **SH-7 (URL/history/no-JS):** with JS disabled, on GeoSeed: every chip is a working link; the search form submits to the shop URL with `q`; each state URL server-renders its correct results, counts, selected states, and applied row; Back/Forward across a pagination entry behaves as today, across a filter entry restores in place (JS on). A filtered URL never renders an unfiltered list. No page-view beacon fires on any in-place change (network log).
- **SH-8 (empty states):** (a) drive GeoSeed to a zero combination: §9.2 state inside the results region, applied row visible, Clear All recovers in place, focus per §5.7; (b) search a no-match string: §9.3 state naming query and shop, both recoveries work; search "alsion"-style near-miss against a shop carrying the near name: exactly one did-you-mean, pointing in-shop; (c) the 0-listing shop renders §9.1 unchanged; (d) a fixture all-sold-out shop shows the §9.4 notice once, above results that render normally.
- **SH-9 (sort):** the control offers exactly the three §7.2 options with the §7.2 labels; default (no `sort` param) is the grouped "In stock first" order (§7.5) on every test shop — SH-21 drives the grouped order itself; "In stock first" produces the grouped order of §7.5 — every orderable listing above every not-orderable listing, variety name A–Z the sole key within each section, and no availability tier ordering anywhere in the shop's sort (SH-21 drives the grouped order itself); the count line's phrase matches the active order in all states incl. searched ("best match first", sort control absent while `q` is active, prior sort restored when `q` clears).
- **SH-10 (cards and commerce invariance):** listing cards in variety context are byte-identical to pre-build cards for the same listings (diff the rendered card HTML); shop-context cards are the unified variety card of SPEC-GRID-CARD §§3.3/4 (their facts are governed by SH-G8); every "Visit shop →" pill still targets `/go/{id}` in a new tab with `nofollow`; no price string appears in any rendered state or in the §11 payload (grep + rendered check).
- **SH-11 (pagination bounds):** under a filter on GeoSeed, the last in-range page answers 200 and the next answers a true 404 against the narrowed total; unfiltered bounds unchanged (page 8 = 200, page 9 = 404).
- **SH-12 (weight and accessibility floor inputs for Ada/Mina):** report the seller page's shipped listing-set payload size for GeoSeed before/after §11; at 320px width and 200% text, the control block wraps/swipes without horizontal scroll or clipped focus rings (FilterStrip finish inherited); with a screen reader, one filter change produces exactly one announcement from `#seller-results-count`, a region present before the change.
- **SH-13 (register audit):** the before/after comparison across the five test shops shows exactly the combined register — §12's S-1…S-14, SPEC-LOCATIONS' L-1…L-9, and SPEC-GRID-CARD's G-1…G-9 — and nothing else. A further difference is a FAIL until reverted or carried back as a register amendment.
- **SH-14 (contact block coverage matrix):** with fixtures for all seven rows of §3.5.3's matrix: each renders exactly the channels present — no empty row, placeholder, or absence copy beyond the pre-existing "No website on file" line where it already applies; the phone row's `href` is a dialable `tel:` form of the displayed number; the email row is a `mailto:` whose visible text is the full address; the website button's `href`, `rel`, `target`, and beacon behavior are byte-identical to pre-build; both new rows measure ≥44px tall; with JS disabled both rows still render and work; and on a shop with all three channels, no listing card's pill href changes (every pill still `/go/{id}`).
- **SH-15 (focus landing when an activation unmounts its own control — Ada Ruling 7, §5.5):** activating the last remaining remover, and activating Clear All from a combined search + filters state, each leave focus on the shop heading ("{name}'s shop" `<h2>`) with a visible ring, with exactly one count announcement and no focus visit to `<body>`; a remover activation that leaves items applied lands focus on Clear All.
- **SH-16a (forced-colors drive — build-gate check adopted by Quinn's design gate, Ada Ruling 10):** in forced-colors mode, the focus ring is visible (outline-carried) on a chip, on the search field, and on a contact row.
- **SH-16b (forced-color-adjust confinement — build-gate check adopted by Quinn's design gate, Ada Ruling 10):** `forced-color-adjust: none` appears only on true color specimens (Hue swatch dots; card artwork/swatches), never on any chip as a whole, the search field, the contact rows, the applied row, or any state-bearing element.
- **SH-17 (PB-M6 fixture drive — build-gate check adopted by Quinn's design gate; fixture amended to five discriminating groups by Quinn's delta gate, 2026-11-22):** a 9-listing shop with five discriminating groups (Crop, Season, Sowing method, Life cycle, Hue — all five discriminating across the fixture's 9 listings), driven at 390px alongside §13's five test shops, reporting scroll distance to the first card and a named-listing find task.
- **SH-18 (Crop presence and discrimination — §5.8.2–5.8.3):** on GeoSeed and 3 Porch Farm (both multi-crop), the Crop strip renders **first** in group order with legend "Crop"; on a single-crop shop (find or fixture one) in the filters band, no Crop strip renders while other discriminating groups do; on the ≤8 test shop no Crop strip renders (threshold, §8). Every Crop option at rest has a non-zero count for at least two crops.
- **SH-19 (Crop counts and combination — §5.8.3, §6.4):** for each crop option on GeoSeed, the displayed count equals the result total of a fresh server load of the URL that option represents with the other groups and the query held (spot-check ≥4 crops incl. one driven to 0 by another group's selection — it renders `0` and stays operable); one hand-computed case verifies Crop ∧ another group ∧ query equals the AND of the three scopes against the shipped data; removing the Crop remover keeps the query and other filters; Clear All clears Crop with everything else in one action, one entry, one announcement; activating the Crop remover as the last remaining remover lands focus per §5.5/SH-15.
- **SH-20 (Crop ordering, completeness, and URL — §5.8.4–5.8.6):** the strip reads "All" first, then common names in strict A–Z; the order is byte-identical before and after narrowing another group (counts change, positions do not); every crop in the shop's full set appears as a chip — chip count equals the shop's distinct crop count, with no truncation or expander at any shop size; with JS disabled, `?crop=<slug>` server-renders the correct narrowed set, counts, selected state, and applied row; an unrecognized `crop` value renders the all-crops shop (ignored, not 404); a valid crop slug the shop does not stock renders the §9.2 zero-combination state with the Crop remover present, not a 404; pagination links under an active crop carry the `crop` parameter.
- **SH-21 (grouped default order — §7.5):** on a fixture shop mixing all five availability values with names chosen to interleave alphabetically across the sections (an orderable "Z…" variety and a sold-out "A…" variety among them): at rest, every orderable listing (`in_stock`, `preorder`) precedes every not-orderable listing (`unknown`, `shop_closed`, `sold_out`), and within each section the names are in strict A–Z with no availability sub-ordering (the sold-out "A…" does not rise above an orderable "Z…", and a sold-out "B…" precedes an unknown "C…" in the bottom section); the ≤8 test shop renders the same grouped order with no sort control present; explicitly selecting "Name A–Z" produces pure A–Z across the whole set (the sold-out "A…" first); "Recently checked" is ungrouped (freshest first regardless of section); the resting count line reads "{N} listings, in stock first." and keeps that phrase on a fixture with no out-of-stock listings and on the §9.4 all-sold-out fixture; the rendered list is one continuous list — no section heading, divider, or boundary marker appears in any state, and a page break under pagination can fall inside a section without acquiring one; `/variety`'s default remains pure Name A–Z (PB-1 untouched).

---

## 14. Recommended build placement

One build, after **Item 3.1a** lands and passes Quinn's gate — the shop consumes 3.1a's in-place core, counts discipline, and Hue multi-select machinery, and building it earlier would mean building that core twice. It does not depend on 3.1b (the browse spread), 3.2, 3.3, or 3.4's SearchBox work (the shop field is a plain form, §6.6), and it should ride in its own worktree per the standing rule. Mina designs the assembled surface from this spec next (control-block composition, the shop heading treatment, the §9.4 notice's dress, the §3.5 contact block's composition at every coverage level); Ada's floor pass follows on the assembled design (the contact block's link-purpose and target rulings are hers, §3.5.2); Wren's copy pass rules the contact block's labels as a set (§3.5.4) alongside the copy confirmations flagged throughout. Suggested order: this spec → Mina's visual pass + Ada's floor pass → build brief lifted from §§3–11 → Quinn's gate per §13.

---

## 15. Pushback — for Hue to carry to Dustin

Specialists are expected to push back; these are mine. Nothing in §§3–11 silently deviates from a ruling; where a pushback touches a section, the section says so.

- **PB-S1 — The in-shop search should NOT reuse the directory's autocomplete combobox.** *The pattern of record:* Tranche 3 §5.3's SearchBox — combobox, suggestion panel, ranking — is "the search pattern" a minimal reading would transplant. *Where that hurts:* in-shop, the suggestions would be the same listings already rendering as results directly beneath the field, updating with the same keystrokes. The visitor would be offered two copies of one answer, one of them in a floating panel with its own keyboard contract, and the panel's whole reason to exist — choosing among destinations — is absent: every suggestion leads to a card already on the page. *My design (§6.6):* a plain labeled search input, results in the page's own list, ranking classes (§6.3) applied to that list. The deviation is from the component, not from the behavior contract: debounce, minimum characters, match classes, empty-state honesty, and announcement discipline are all inherited. If Dustin prefers literal component reuse for consistency's sake, the cost is the duplicated list and a second focus model on the page — I recommend against, and the build differs by which component §6.1 names.
- **PB-S2 — "Their shop" must not become a new route, a banner, or a re-skin.** *The commission's risk:* "turn each seller's profile page into the seller's shop" can be read as a visual overhaul — cover art, a storefront hero, a `/shop/` URL. *Why I resist:* the page's findability (Bea's workstream) and every existing link, bookmark, and variety-page card point at `/seller/<slug>`; a route change spends that equity for a word. A banner spends the first screenful — the scarcest resource on a phone — on decoration in front of stock, and the header already carries identity (name, place, badge, plate) at higher information density than any banner would. *My design (§§0, 3.1):* the shop is made by naming, structure, and tools — the things a shopper can use — and the register (§12) is deliberately short. If Dustin wants a visual storefront treatment beyond Mina's composition of the control block, that is a separate commission with its own gate, not a rider on this one.
- **Recorded, not pushed — the sort default (§7.4).** The storefront argument for "In stock first" as the shop default is genuinely stronger than it was on `/variety`: a shop whose first screenful is sold-out stock reads as a closed shop, and a visitor on a seller page has already chosen the seller, so availability is the remaining question. I weighed it and still land on following PB-1 — Dustin ruled on the underlying trade-off today; the one-pattern rule (§0.1) is a house-level good, not a convenience; and the option sits one tap away in the control. It is recorded here so the decision is visible as *considered*, and §16 OQ-3 put the shop-specific version of the question to Dustin directly, since he is the only one who can split the default by surface. **Postscript, 2026-11-22:** he split it — OQ-3 is ruled and the grouped shop default is designed at §7.5; this note stands as the record of the position the ruling superseded, and PB-1 remains in force for browse.

---

## 16. Open questions — flagged, not decided

Each of these is implied by the commission and unruled. None blocks §§3–11 except where stated; each names my recommendation so Dustin's ruling is one line.

1. **OQ-1 — A crop facet inside the shop? RULED IN (Dustin, voice call 2026-11-22 15:48 PT, verbatim: "Add a Crop filter group in shops.").** The recommendation below was adopted as made — a shop-only fifth group, placed first in group order — and is designed as the §5.8 delta, registered at §12 S-13, and checked at §13 SH-18–SH-20; the §8 threshold bands stand, with the SH-17 fixture question flagged for Quinn's delta gate (§8.4). Closed. *Original text:* Shoppers think crop-first ("show me their zinnias"), and in a 179-listing shop the four ruled groups cannot express that; search covers it by name (§6.3) but is a recall path. A shop-only Crop filter group (options = the crops this seller stocks, counted) would be the highest-value facet in large shops — and it is outside the commission's stated model ("the site's existing filter model (Season, Sowing method, Life cycle, Hue) applied within the shop"), so this spec does not design it. *Recommendation:* rule it in as a shop-only fifth group if Dustin wants it; the machinery (§5) absorbs it without change, placed first in group order. If he declines, search-by-crop-name is the documented path.
2. **OQ-2 — The two "visit" doors.** The header button reads "Visit {name} ({host})" (the seller's website) while every card's pill reads "Visit shop →" (a product page, via `/go/`). On a page now framed as the shop, a visitor can reasonably read the header button as "go to the real shop" and the pills as something else. Additions 1–2 (§3.5) sharpen this: the button is now formally the website channel of a labeled contact block, so its wording is decided inside Wren's copy pass for the whole block (§3.5.4) rather than as a lone rename. *Recommendation:* Wren re-labels the button in website language (e.g. "Visit their website — {host}") as part of that pass, destination and behavior unchanged; the wording should be ruled before the brief lifts so the build ships the block with its final labels. This spec's register does not include the wording change because it is unruled.
3. **OQ-3 — Should shops specifically default to "In stock first"? RULED (Dustin, voice call 2026-11-22 15:49 PT, verbatim: "In stock should be at the top but it should also be A to Z in both the top and the out of stock sections.").** Shops are treated differently: the shop default is the grouped order designed at §7.5 (orderable — `in_stock` and `preorder` per §9.4's definition — first, not-orderable below, Name A–Z as the sole key within each section), registered at §12 S-14 and checked at §13 SH-21. PB-1 is unchanged for `/variety`. Closed. *Original text:* The PB-1 ruling settled `/variety`; §7.4 follows it for the shop and §15 records the storefront counter-argument. If Dustin wants shops treated differently, §7 changes by one parameter's meaning. *Recommendation:* keep one default everywhere unless shopper evidence (Quinn's drives, search/filter analytics) shows shop visitors bouncing off sold-out first pages.
4. **OQ-4 — Does the seller index's language change?** `/seller` lists "sellers"; its cards link to what are now shops. Whether the index heading, card language, or the "Sellers" breadcrumb crumb should say "shops" is a site-language decision this spec does not make (the shop page's own breadcrumb is unchanged per §12). *Recommendation:* leave index language alone for this build; if the shop framing proves out, a copy pass can align the index deliberately rather than as a side effect.
5. **OQ-5 — Do variety-page listing cards change?** In variety context, the card heading is the seller's name, linking to the seller page — now a shop. Nothing about the card needs to change for the link to land somewhere better, and this spec changes no card anywhere (§12). Flagged only so the absence reads as a decision: the improvement is entirely on the landing side.
6. **OQ-6 — Page titles and discoverability language.** Whether the seller page's `<title>`/meta should gain shop language ("{name}'s shop — seed listings at…") belongs to Bea's SEO/GEO seat: it touches how the page is represented in search and answer engines, and her no-fabrication discipline governs claims the page makes about itself. *Recommendation:* Bea reviews the §3.1 heading change for title/meta alignment as a consult; this build changes no metadata beyond §10.1's canonical/noindex discipline.
7. **OQ-7 — Variety count vs listing count.** The header's "Varieties listed" and the shop's "{N} listings" are different counts that agree today (GeoSeed: 179 and 179). If a seller ever lists two listings for one variety (or the counts otherwise diverge), the two lines will visibly disagree in number while both telling the truth. *Recommendation:* no action until a real divergence exists; if one appears, the shop line is the operative count and the header line is a catalog fact — but Dustin should see the first divergence rather than have a rule invented for it here.
8. **OQ-8 — In-shop search logging.** Directory searches are logged as search events; whether in-shop queries should be logged (with seller scope) for catalog intelligence — e.g. "shoppers search GeoSeed for zinnias and find none" is a sourcing signal — is an analytics decision with a privacy dimension this spec does not settle. The §10.2 rule (no page-view beacon on in-place changes) stands regardless. *Recommendation:* log them, scoped and query-only, if Dustin wants the sourcing signal; the build should be told before it lifts, because retrofitting logging into the enhancement layer is a second touch.

---

*— Nadia, UX Design. Collaborators' positions applied: Mina (Quiet Ledger card contract and StateShape placement A4 as shipped facts; her visual pass follows this spec), Ada (floors stated, values left to her pass — live region, focus, target, and semantics contracts inherited from Tranche 3 §§2.5–2.6, which carry her prior rulings), Quinn (acceptance probes written as drives, §13), Wren (copy confirmations flagged in place; no copy is finalized by this spec). Evidence: `origin/main` via `git show` (seller page, ListingRow, StateShape placement, validators — PublicListing / VarietyRef / PlantRef schemas, catalog service `getSeller`, SearchBox, BrowseFilters parameter names, PAGE_SIZE), Tranche 3 SPEC §§2, 5.2, 5.3, 10 (PB-1, PB-2 as ruled), Mina's state-icons PLACEMENT-SPEC (A4, N5), and live production probes run 2026-11-22 via `curl` (GeoSeed 179 listings / 8 pages with true-404 bounds, 3 Porch Farm 34 listings, the seller index, and the public API's per-seller variety counts for all 83 sellers). No code was written or changed by this spec.*
