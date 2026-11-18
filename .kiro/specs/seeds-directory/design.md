# Design — seeds.hues.flowers Seed Finder Directory

## Architecture overview

Static site: plain HTML files + vanilla JavaScript + JSON data files. No build tooling required beyond a local HTTP server for preview (Python's `http.server` works). Deployable to any static host (Netlify, GitHub Pages, S3+CloudFront, etc.).

```
app/
├── index.html              # Home — search + category browse
├── varieties/
│   └── index.html          # Category browse page
├── sellers/
│   └── index.html          # Sellers directory
├── 404.html
├── css/
│   └── styles.css          # Single stylesheet, mobile-first
├── js/
│   ├── data.js             # Loads JSON, exposes window.SeedsData
│   ├── search.js           # Client-side search (lunr.js or manual)
│   ├── variety-page.js     # Renders a variety detail page
│   ├── seller-page.js      # Renders a seller detail page
│   └── utils.js            # Shared helpers (slugify, rating display, etc.)
├── data/
│   ├── varieties.json
│   ├── sellers.json
│   └── listings.json
└── README.md
```

Variety and seller detail pages are rendered **client-side** by reading the slug from the URL path, loading the JSON data, and writing HTML into the page shell. This avoids a build step while keeping URLs clean (`/varieties/stock-katz-mix/`).

The page shell for varieties is `varieties/detail.html` (served by a redirect rule or hash routing if hosting on plain static). For simplicity in Phase 1, URL scheme uses query parameters for detail pages:
- `/varieties/?v=stock-katz-mix`
- `/sellers/?s=geoseed`

The home page, category browse, and directory pages are pre-rendered HTML. Detail pages use the same shell with JS population.

---

## Data schema

### `varieties.json` — array of Variety objects
```json
{
  "id": "string — unique slug, kebab-case",
  "commonName": "string",
  "latinName": "string",
  "varietyName": "string — cultivar/series name",
  "category": "flowers | vegetables | herbs",
  "subcategory": "string — e.g. 'annual', 'perennial'",
  "description": "string — growing basics, 1–3 sentences",
  "sowingNotes": "string — timing, method (optional)",
  "heightCm": "number | null",
  "colorSwatch": "string — CSS hex color representing the flower (optional)",
  "tags": ["string"]
}
```

### `sellers.json` — array of Seller objects
```json
{
  "id": "string — unique slug",
  "name": "string",
  "type": "wholesale | retail | specialty",
  "homepage": "string — URL",
  "description": "string",
  "orderingNotes": "string — e.g. wholesale account required",
  "location": "string — city, state",
  "rating": null,
  "ratingCount": 0,
  "ratingAverage": null
}
```
`rating: null` → "Not yet rated". Future phase adds user review submission and updates `ratingAverage` / `ratingCount`.

### `listings.json` — array of Listing objects
```json
{
  "id": "string — unique slug",
  "varietyId": "string — FK → varieties.id",
  "sellerId": "string — FK → sellers.id",
  "sku": "string | null — seller's catalog number",
  "packetSizes": [
    {
      "label": "string — e.g. 'Trade Pkt (1,000 seeds)'",
      "price": "number | null — in USD",
      "priceSource": "string | null — e.g. 'GeoSeed Catalog 2026–27'",
      "priceCheckDate": "string | null — ISO date YYYY-MM-DD",
      "inStock": null
    }
  ],
  "productUrl": "string | null — verified product URL; null → use seller homepage",
  "notes": "string | null"
}
```
When `price` is null and `priceSource` is null, display renders "See seller for price". When `productUrl` is null, the outbound link uses the seller's `homepage`.

---

## Page designs

### Home (`index.html`)
- Header: site name "seeds.hues.flowers", tagline "Find where to buy any flower seed."
- Hero: large search input, placeholder "Search by variety, common name, or Latin name…"
- Search results appear below the input as a live dropdown list (no page reload).
- Below hero: "Browse by category" card grid — Flowers (active), Vegetables (coming soon), Herbs (coming soon).
- Footer: simple copyright line.

### Category browse (`varieties/index.html`)
- Heading "Flower Varieties" with count.
- Alphabetical list of all varieties with common name, Latin name, variety name, brief description excerpt.
- Each row links to the variety detail view.

### Variety detail (`varieties/index.html?v={slug}` — same shell, JS-rendered)
- Breadcrumb: Home → Flowers → Variety name
- Variety name (H1), Latin name, variety name in subtitle
- Color swatch (small circle of CSS color) if defined
- Description, sowing notes
- "Where to buy" table: Seller | Packet Sizes | Price | Rating | Link
- Outbound links open in a new tab with `rel="noopener noreferrer"`

### Sellers directory (`sellers/index.html`)
- Heading "Seed Suppliers"
- Table/card list: Seller name, type, description excerpt, rating badge, link to seller page.

### Seller detail (`sellers/index.html?s={slug}` — JS-rendered)
- Seller name (H1), type badge, homepage link, description, ordering notes
- Rating: "Not yet rated" badge
- "Varieties carried" table: Variety | Packet Sizes | Price | Link

---

## Visual design

### Color palette
- Background: `#FAFAF7` (off-white, warm)
- Surface (cards): `#FFFFFF`
- Primary accent: `#2D6A4F` (deep garden green)
- Secondary accent: `#52B788` (medium green)
- Text primary: `#1A1A1A`
- Text secondary: `#555555`
- Border: `#E0E0DC`
- Link: `#2D6A4F`, hover `#1B4332`
- "Not yet rated" badge: `#F0F0EC` background, `#777` text

### Typography
- Font stack: `'Segoe UI', system-ui, -apple-system, sans-serif` (no external font load)
- H1: 2rem, weight 700
- H2: 1.5rem, weight 600
- Body: 1rem / 1.6 line height
- Small/meta: 0.875rem, `#555`

### Layout
- Max content width: 960px, centered
- Mobile-first grid: single column → 2-col browse grid at ≥ 640px → 3-col at ≥ 960px
- Touch targets: min 44×44px

### No images
- Color swatches: CSS `background-color` circles (1rem diameter) beside variety names
- No `<img>` tags, no external image URLs

---

## Search implementation

Lunr.js (CDN, 9 kB gzipped) used for full-text search across `commonName`, `latinName`, `varietyName`. Index built once on page load from varieties JSON. Results render as a dropdown with keyboard navigation (arrow keys, Enter, Escape).

---

## Accessibility

- All interactive elements reachable by keyboard
- ARIA roles: `role="search"` on the search form, `aria-live="polite"` on search results
- Color contrast: verified ≥ 4.5:1 for all text/background pairs
- Skip-to-main link at page top
- Outbound links: `aria-label="View {variety} at {seller} (opens in new tab)"`

---

## Routing

Because this is plain static HTML with no server rewriting, detail pages use query-string routing:
- Variety detail: `varieties/?v=stock-katz-mix`
- Seller detail: `sellers/?s=geoseed`

The variety and seller directory pages (`varieties/index.html`, `sellers/index.html`) detect the query parameter on load and switch between list view and detail view. This requires no server config and works with `python3 -m http.server`.
