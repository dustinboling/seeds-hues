# Requirements — seeds.hues.flowers Seed Finder Directory

**Source brief:** PROJECT-BRIEF.md, 2026-11-15  
**Data sources:** sourcing-list.md (checked 2026-11-02 through 2026-11-13); hues-geoseed-order-list-2027-growing-season.md (prices checked 2026-11-04)

---

## Functional requirements

### FR-01 Home page
- Prominent search bar allowing queries by variety name, common name, or Latin name.
- Quick links to browse varieties by category (Flowers initially; structure supports Vegetables, Herbs later).
- Site identity: seeds.hues.flowers, tagline, brief description.

### FR-02 Browse / category pages
- List all varieties in a category with links to individual variety pages.
- Filterable/sortable by common name or Latin name.

### FR-03 Variety pages (one per variety, SEO-friendly slug)
- URL pattern: `/varieties/{slug}/`
- Shows: common name, Latin name, variety name, category, brief growing description.
- Lists every seller offering that variety, each row showing:
  - Seller name (linked to seller page)
  - Packet size(s) available
  - Price (with source label and check date) OR "See seller for price"
  - Seller rating (displays "Not yet rated" in Phase 1)
  - "View at seller" outbound link (product URL if verified, else seller homepage)
- If no sellers carry the variety, shows an informational message.

### FR-04 Sellers directory
- URL: `/sellers/`
- Lists all sellers with name, type (seed company / wholesale / specialty), rating ("Not yet rated"), and link to seller page.

### FR-05 Seller pages (one per seller, SEO-friendly slug)
- URL pattern: `/sellers/{slug}/`
- Shows: seller name, website, description, rating, ordering notes.
- Lists all varieties the seller carries (linked to variety pages) with packet sizes and prices.

### FR-06 Search
- Client-side fuzzy search across variety names (common, Latin, variety name).
- No server required; works from static JSON.

### FR-07 Ratings model
- Seller record has a `rating` field (null in Phase 1 → displays "Not yet rated").
- Schema supports future addition of user-submitted ratings (average score, review count).
- Never invent ratings or reviews for real businesses.

### FR-08 Data integrity rules
- Prices only where verified in source files, labelled with source name and check date.
- Where no verified price: "See seller for price."
- Where no verified product URL: link to seller homepage.
- Never fabricate variety listings, prices, product URLs, or availability.

---

## Non-functional requirements

### NF-01 Architecture
- Static HTML + JSON data files. No server-side rendering, no database, no AWS.
- All data in `/app/data/` as JSON files: `varieties.json`, `sellers.json`, `listings.json`.
- Pages generated from templates at build time (or rendered client-side from JSON).

### NF-02 Accessibility
- WCAG 2.2 AA compliance.
- Semantic HTML5, ARIA labels where needed, keyboard navigation, color contrast ≥ 4.5:1 for text.

### NF-03 Mobile-first
- Responsive design from 320 px up. Touch-friendly tap targets (≥ 44 px).

### NF-04 Performance
- No external image hotlinks. Typography and color swatches only.
- Minimal external dependencies. Vanilla JS or a small bundled library.

### NF-05 Maintainability
- Adding a variety, seller, or listing requires only editing a JSON file — no code changes.
- README covers schema, preview command, and how to add entries.

---

## Seed dataset (Phase 1)

### Sellers to include
| Seller | Type | Homepage | Has listings in source data |
|---|---|---|---|
| GeoSeed | Wholesale seed | geoseed.com | Yes — full 2027 list |
| Everwilde Farms | Retail/bulk seed | everwilde.com | Yes — Virginia Stock |
| Park Seed | Retail seed | parkseed.com | Seller entry only |
| Ball Seed | Wholesale seed | ballseed.com | Seller entry only |
| Onings America | Wholesale/specialty | shopOningsAmerica.com | Seller entry only |
| Reimer Seeds | Retail seed | reimerseeds.com | Yes — Breadseed Poppy (note only) |
| Johnny's Selected Seeds | Retail/wholesale seed | johnnyseeds.com | Seller entry only (checked, no Phase 1 listings to add) |
| Baker Creek Heirloom Seeds | Retail seed | rareseeds.com | Seller entry only |
| Floret | Specialty/retail | floretflowers.com | Seller entry only |

### Mother's Day 8 focal flowers + varieties (from source files)
1. **Stock** (Matthiola incana) — Katz Mix (GeoSeed G893522)
2. **Snapdragons** (Antirrhinum majus) — Rocket Mix (GeoSeed G76796), Madame Butterfly Mix F1 (GeoSeed G74300), Toulon Mix (GeoSeed G80012)
3. **Larkspur** (Consolida ajacis) — Imperial Choice Mix (GeoSeed G323941)
4. **Cornflower / Bachelor's Buttons** (Centaurea cyanus) — Frosty Mix (GeoSeed G237644)
5. **Nigella / Love-in-a-Mist** (Nigella damascena) — Miss Jekyll Double Mix (GeoSeed G672156)
6. **Calendula** (Calendula officinalis) — Pacific Beauty Formula Mix (GeoSeed G188542)
7. **Sweet Peas** (Lathyrus odoratus) — Winter Elegance Mix (GeoSeed G538224); Mammoth Mix (Everwilde Farms)
8. **Iceland Poppies** (Papaver nudicaule) — Champagne Bubbles Formula Mix F1 (GeoSeed G719712)

### Additional varieties from source files (also in scope)
- **Shirley Poppy** (Papaver rhoeas) — Angel's Choir (GeoSeed G723250)
- **Nigella** (Nigella damascena) — Miss Jekyll Double Mix (GeoSeed G672156) [already listed]
- **Virginia Stock** (Malcolmia maritima) — XL Packet / 1 oz / 1/4 lb / 1 lb (Everwilde Farms, verified 2026-11-06)
- **Breadseed Poppy** (Papaver somniferum) — Reimer Seeds (seller entry; product page checked 2026-11-06, per-size prices not displayed)

---

## Out of scope (Phase 1)
- Cart, checkout, payments, user accounts
- User-submitted ratings/reviews (model only)
- Vegetable/herb categories (structure supports them)
- Any variety or listing not in the two source files
