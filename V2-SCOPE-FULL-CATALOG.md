# Scope note — full flower seed catalog (Dustin, 2026-11-15, voice call)

Dustin's direction, verbatim substance: "Before moving forward do keep in mind that we will need to add every single seed variety of flowers to this app."

## Method (Dustin, 2026-11-15, voice call — his words)

1. **Enumerate the universe first:** figure out every **cut flower variety that can be grown from seed** and enter it into the database as the master variety list — varieties exist in the DB independent of any seller.
2. **Then find the sellers:** scrape/search the web for farm shops and seed sellers that carry each variety.
3. **Attach vendors to varieties:** each confirmed seller + packet/price becomes a listing on that variety (with provenance — source URL and date checked).

Consequences of the method:
- A variety page can legitimately launch with **zero vendors** ("no sellers found yet") — coverage grows as vendor discovery runs.
- Vendor discovery is a continuous pipeline, not a one-off import: new sellers and new listings keep attaching over time.
- Matching is the hard part: series names, synonyms, breeder vs retail naming, mixes vs single colours — matching needs confidence levels and a review queue, never silent guesses.
- Scraping etiquette/limits: respect robots/ToS and rate limits, prefer official feeds/catalogs/APIs where a seller offers them; a scrape is evidence for a listing, stored with its source URL + check date.
- **Head start already in hand:** the Nov 2026 Seed List Aggregator work already gathered full flower catalogs for GeoSeed, Johnny's (full cut flower seed catalog), Silver Falls (flowers only), Everwilde, Ball Seed and Onings — that data seeds both the master variety list and the first vendor attachments.

## What this changes

- The catalog's end state is **every flower seed variety** — not the 22-variety starter set. Realistically tens of thousands of varieties across all sellers.
- The v2 starter data (22 varieties / 9 sellers / 24 listings) is a seed set only; the architecture must be built for the full catalog from day one.
- Kiro's WASM threshold (~1,000 varieties / ~2 MB payload / join-heavy queries) WILL be crossed by design — so the WASM-ready sync protocol and schema discipline in V2-KIRO-LOCALFIRST.md are not optional extras; the local replica design must slot in without re-architecture.
- Search must scale server-side (D1 FTS5 trigram now; evaluate Typesense/Algolia-class search well before in-memory client search becomes the bottleneck). Client in-memory search is a starter-set convenience only.
- A **catalog ingestion pipeline** becomes a first-class workstream: bulk imports per seller (catalogs/feeds/APIs), variety deduplication and taxonomy normalisation (species layer matters at this scale), listing matching across sellers, and ongoing price/availability refresh. No invented prices, listings, or ratings — every listing still traces to a real seller source.
- URL/SEO structure must assume very large sitemap sets (sitemap index + sharding) and per-variety pages at scale.
- Data model consequences: plants (species) → varieties → listings → packet sizes stays; add import provenance (source, imported_at, source_sku) per listing.

## SELLER SCOPE RULING (Dustin, 2026-11-15, supersedes all earlier seller assumptions)

**No large seed companies are listed. Ever.** No Ball Seed, no GeoSeed, no Johnny's Selected Seeds, and no other large/national seed companies — as sellers, listings, or outbound buy links.

- **Sellers are small farms selling seed**, found by crawling the web (farm shops — Shopify/WooCommerce/Etsy-class stores and farm websites).
- The crawl + confidence-matching + review-queue pipeline is therefore the ONLY listing source, not a supplement to wholesale catalog imports.
- This ruling moots three earlier open items: Johnny's in/out (OUT — excluded like every large company), the Ball WebTrack login-gated price question (no Ball listings), and the wholesale objection policy for large sellers.
- Existing v1/starter listings from large companies (Ball, GeoSeed, Johnny's, Onings-class wholesalers) do NOT carry into v2 as listings.
- Working assumption (Dustin to correct if wrong): large-company and breeder catalogs may still be used as *reference* to enumerate which varieties exist for the master list — they are never listed, linked, or shown as sellers.

## What this does NOT change

- Phase order: PWA directory → store apps on /api/v1 → marketplace.
- No checkout in the directory phase; ratings ship as "Not yet rated" until real reviews exist.
- Build v2 on the starter set first, but verify it against a large synthetic catalog (e.g. 10k varieties) for search, sync payload, and page performance before calling the architecture proven.
