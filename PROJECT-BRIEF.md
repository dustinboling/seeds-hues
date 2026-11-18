# seeds.hues.flowers — Seed Finder Directory

**Owner's brief (Dustin Boling, 2026-11-15, verbatim intent):** A source people go to
to find seeds. For each seed variety, list ALL the farms/suppliers that offer that
seed, with links to buy it from them. The single go-to source for "where can I get
this seed." Each farm/supplier has **ratings**. **No ordering through this site
yet** — the goal now is to build traffic. Future phase (NOT in scope now): turn it
into a marketplace like Amazon with third-party sellers.

**Builder:** Kiro (Pro), spec-driven flow — requirements → design → tasks → build.
**Reviewer/deployer:** Hue. Kiro builds; Hue verifies and handles any deployment.

## Phase 1 scope (this build)

- **Home** with prominent seed search (by variety name, common name, or Latin name).
- **Browse** varieties by category (flowers first; structure must allow vegetables/herbs later).
- **Variety page** (one URL per variety, SEO-friendly): description, Latin name,
  growing basics, and the list of sellers offering it — each with packet sizes,
  price where known, seller rating, and an outbound "View at seller" link.
- **Sellers directory + seller page**: every farm/supplier, its rating, and all
  varieties it carries.
- **Ratings system**: data model + star display for sellers. V1 ships with
  **"Not yet rated"** everywhere — NEVER invent ratings or reviews for real
  businesses. (User-submitted ratings are a later phase; design the model so they
  can be added.)
- **Data-driven**: all content in structured data files (JSON or a DB-ready
  schema) — varieties, sellers, listings — so listings can grow without code changes.
- **No cart, no checkout, no payments.** Outbound links only.

## Starter dataset (real, sourced — do not fabricate)

Seed the catalog from Hues' own verified sourcing work on this machine:
- `~/workspace/seed-sourcing/sourcing-list.md`
- `~/workspace/goals/flower-seed-and-plug-sourcing/files/hues-geoseed-order-list-2027-growing-season.md`

Start with the 8 Mother's Day seed flowers — stock, snapdragons, larkspur,
cornflower, nigella, calendula, sweet peas, Iceland poppies — and their named
varieties from those files (GeoSeed Catalog 2026–27 prices checked 2026-11-04,
Everwilde checked 2026-11-06). Sellers to include: GeoSeed, Everwilde Farms,
Park Seed, Ball Seed, Onings America, Reimer Seeds (plus Johnny's Selected
Seeds, Baker Creek Heirloom Seeds, Floret as seller entries with no listings
until sourced). Rules:
- Prices ONLY where the source files give them, labelled with source + check date.
- Where no verified price/listing exists: "See seller for price" and link to the
  seller's homepage — never invent a product URL, price, or availability.

## Hard rules

- **No hotlinked images.** V1 uses no photos (typography + color swatches) unless
  images are self-hosted in the project.
- Mobile-first, fast, accessible (WCAG 2.2 AA), clean modern design.
- No AWS resources in v1 — static/JSON architecture, deployable anywhere.
  Build in `~/workspace/seeds-hues/app/`; spec docs in `.kiro/specs/`.
- Deliverable includes a short README: how to run the preview, how to add a
  variety/seller/listing, and the data schema.

## Explicitly NOT in Phase 1

Marketplace features, seller accounts, ordering, payments, user accounts,
user-submitted reviews (model for ratings only).
