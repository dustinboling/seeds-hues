# Tasks — seeds.hues.flowers Seed Finder Directory

## Task 1 — Data files
Create `/app/data/sellers.json`, `/app/data/varieties.json`, `/app/data/listings.json` from verified source data only.

- Sellers: GeoSeed, Everwilde Farms, Park Seed, Ball Seed, Onings America, Reimer Seeds, Johnny's Selected Seeds, Baker Creek Heirloom Seeds, Floret.
- Varieties: all 8 Mother's Day flowers + named varieties from source files (stock, snapdragons x3, larkspur, cornflower, nigella, calendula, sweet peas x2, Iceland poppies, Shirley poppies, Virginia stock, Breadseed poppy).
- Listings: only where source files give verified data (GeoSeed catalog 2026–27, Everwilde 2026-11-06). Reimer listing with no prices. No fabrication.

## Task 2 — CSS
Create `/app/css/styles.css` — mobile-first, WCAG AA color contrast, design tokens from design.md.

## Task 3 — JavaScript utilities
Create `/app/js/data.js` (fetch+cache JSON), `/app/js/utils.js` (slugify, rating display, format price).

## Task 4 — Home page
Create `/app/index.html` — search hero, category browse cards, header/footer.

## Task 5 — Search
Create `/app/js/search.js` — Lunr.js-based search, live dropdown, keyboard navigation.

## Task 6 — Varieties directory page
Create `/app/varieties/index.html` — dual-mode: list view (all varieties) + detail view (one variety, query param `?v=`).

## Task 7 — Variety detail JS
Create `/app/js/variety-page.js` — reads `?v=` param, renders variety detail with sellers table.

## Task 8 — Sellers directory page
Create `/app/sellers/index.html` — dual-mode: list view + detail view (query param `?s=`).

## Task 9 — Seller detail JS
Create `/app/js/seller-page.js` — reads `?s=` param, renders seller detail with varieties table.

## Task 10 — 404 page
Create `/app/404.html`.

## Task 11 — README
Create `/app/README.md` — preview command, data schema, how to add variety/seller/listing.

## Task 12 — Verification
Run `python3 -m http.server` and verify home page, a variety page, and the sellers page load without errors.
