# seeds.hues.flowers — Seed Finder Directory

A static seed-finder directory for Hues Floral Park. Every variety shows all suppliers that carry it, with verified prices (labelled with source and check date) and outbound links to buy. No cart, checkout, or user accounts — traffic-building only.

## Quick start (preview)

Requires Python 3 (pre-installed on most systems) or any static file server.

```bash
# From this directory (app/)
python3 -m http.server 8080
```

Then open **http://localhost:8080** in your browser.

The site uses `fetch()` for JSON files, so it must be served over HTTP — opening `index.html` directly as a `file://` URL will not work.

**Other options:**

```bash
# Node (npx serve, no install required)
npx serve .

# Node (http-server)
npx http-server . -p 8080
```

## Site structure

```
app/
├── index.html              Home — search + category browse
├── varieties/
│   └── index.html          Variety list (?v=<id> for detail view)
├── sellers/
│   └── index.html          Seller directory (?s=<id> for detail view)
├── 404.html
├── css/
│   └── styles.css
├── js/
│   ├── data.js             JSON loader + helpers
│   ├── utils.js            Formatting helpers (price, date, rating badge)
│   ├── search.js           Client-side search + dropdown UI
│   ├── variety-page.js     Variety list and detail renderer
│   └── seller-page.js      Seller directory and detail renderer
└── data/
    ├── varieties.json       All seed varieties
    ├── sellers.json         All sellers / suppliers
    └── listings.json        All verified listings (variety × seller)
```

## URL scheme

| URL | View |
|-----|------|
| `/` | Home with search + category browse |
| `/varieties/` | All flower varieties, alphabetical |
| `/varieties/?v=stock-katz-mix` | Detail page for a specific variety |
| `/varieties/?q=sweet+pea` | Filtered list from search |
| `/sellers/` | All suppliers |
| `/sellers/?s=geoseed` | Detail page for a specific supplier |

---

## Data schema

### `data/varieties.json`

Array of variety objects:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique slug, kebab-case. Used in URLs. |
| `commonName` | string | Common name, e.g. "Stock" |
| `latinName` | string | Latin / botanical name, e.g. "Matthiola incana" |
| `varietyName` | string | Cultivar or series name, e.g. "Katz Mix" |
| `category` | string | `"flowers"`, `"vegetables"`, or `"herbs"` |
| `subcategory` | string | e.g. `"annual"`, `"perennial"`, `"annual-climber"` |
| `description` | string | 1–3 sentence growing description |
| `sowingNotes` | string | Timing and sowing method |
| `heightCm` | number \| null | Mature height in centimetres |
| `colorSwatch` | string \| null | CSS hex color for the flower's representative color |
| `tags` | string[] | Descriptive tags, e.g. `["cut-flower", "fragrant"]` |

### `data/sellers.json`

Array of seller objects:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique slug, kebab-case |
| `name` | string | Display name |
| `type` | string | `"wholesale"`, `"retail"`, or `"specialty"` |
| `homepage` | string | Seller's website URL |
| `description` | string | Brief description of the supplier |
| `orderingNotes` | string | Account requirements, minimums, shipping notes |
| `location` | string | City, state |
| `rating` | null | Always `null` in Phase 1 → displays "Not yet rated". Future: set to a number 0–5 when ratings are collected. |
| `ratingCount` | number | Always 0 in Phase 1. Future: number of submitted ratings. |
| `ratingAverage` | null \| number | Always `null` in Phase 1. Future: average of submitted ratings. |

### `data/listings.json`

Array of listing objects — each is one supplier offering one variety:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique slug |
| `varietyId` | string | References `varieties[].id` |
| `sellerId` | string | References `sellers[].id` |
| `sku` | string \| null | Seller's catalog number |
| `packetSizes` | array | See below |
| `productUrl` | string \| null | Verified direct product URL. `null` → site links to seller homepage. |
| `notes` | string \| null | Any additional notes about this listing |

Each entry in `packetSizes`:

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Human-readable size, e.g. `"Trade Pkt (200 seeds)"` |
| `price` | number \| null | Price in USD. `null` → renders "See seller for price" |
| `priceSource` | string \| null | Source of the price, e.g. `"GeoSeed Catalog 2026–27"` |
| `priceCheckDate` | string \| null | ISO date the price was verified, e.g. `"2026-11-04"` |
| `inStock` | null | Reserved for future use. Leave `null`. |

---

## How to add a variety

1. Open `data/varieties.json`.
2. Add an object to the array following the schema above. Choose an `id` slug that is unique and URL-safe (lowercase, hyphens, no spaces).
3. Save. The variety appears on the `/varieties/` page immediately.

```json
{
  "id": "cosmos-sensation-mix",
  "commonName": "Cosmos",
  "latinName": "Cosmos bipinnatus",
  "varietyName": "Sensation Mix",
  "category": "flowers",
  "subcategory": "annual",
  "description": "4-foot branching cosmos with large flowers in white, pink, and crimson. Excellent cut flower, direct sown.",
  "sowingNotes": "Direct sow after last frost or in fall for winter/spring bloom in mild climates.",
  "heightCm": 122,
  "colorSwatch": "#FF69B4",
  "tags": ["direct-sow", "cut-flower"]
}
```

## How to add a seller

1. Open `data/sellers.json`.
2. Add a seller object. Leave `rating`, `ratingCount`, and `ratingAverage` at their Phase 1 values (`null`, `0`, `null`).
3. Save.

```json
{
  "id": "silver-falls-seed",
  "name": "Silver Falls Seed Company",
  "type": "wholesale",
  "homepage": "https://www.oregonwholesaleseed.com",
  "description": "Oregon bulk flower seed grower, wholesale storefront via Oregon Wholesale Seed Company.",
  "orderingNotes": "Wholesale pricing. Larger quantities quoted. Located in Silverton, OR.",
  "location": "Silverton, OR",
  "rating": null,
  "ratingCount": 0,
  "ratingAverage": null
}
```

## How to add a listing

1. Open `data/listings.json`.
2. Add a listing object linking a `varietyId` to a `sellerId`.
3. Set `price` to `null` if no verified price is available — the UI will display "See seller for price".
4. Set `productUrl` to `null` if no direct product URL is verified — the UI links to the seller homepage.
5. Always include `priceSource` and `priceCheckDate` when a price is given.

```json
{
  "id": "geoseed-cosmos-sensation",
  "varietyId": "cosmos-sensation-mix",
  "sellerId": "geoseed",
  "sku": "G283400",
  "packetSizes": [
    {
      "label": "Trade Pkt (1,000 seeds)",
      "price": 4.85,
      "priceSource": "GeoSeed Catalog 2026–27",
      "priceCheckDate": "2026-11-04",
      "inStock": null
    }
  ],
  "productUrl": null,
  "notes": "4 ft cut flower cosmos. Wholesale account required."
}
```

---

## Design rules (brief)

- **No invented data.** Prices only where the source file gives them, labelled with source + check date.
- **No hotlinked images.** Only typography and CSS color swatches.
- **No cart, checkout, or payments.** All seller links open the seller's own site.
- **Ratings: "Not yet rated" everywhere** until real ratings are collected. Never invent ratings.
- Mobile-first, WCAG 2.2 AA.

## Deployment

This is a plain static site. Deploy the contents of `app/` to any static host:

- **Netlify:** drag and drop the `app/` folder at app.netlify.com
- **GitHub Pages:** push to a repo, set Pages source to `/ (root)` or the `app/` folder
- **Any static host:** upload the contents of `app/` to the web root

No build step, no server, no database required.
