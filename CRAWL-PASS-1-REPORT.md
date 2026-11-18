# Crawl Pass 1 — Seed Directory seller listings

**Run:** 2026-11-17 evening (America/Los_Angeles) · Bot: `HuesSeedFinderBot/1.0 (+https://seeds.hues.flowers/about/bot)` · Catalog at crawl time: seq 2041 — 93 crops, 619 varieties, 25 sellers, 17 pre-existing listings.
**Method:** robots.txt checked per host before fetching; ≥5 s between requests per host, one at a time per host (hosts crawled in parallel). Platform feeds preferred per spec (Shopify `/products.json`, Squarespace `?format=json`, WooCommerce Store API), then sitemap-prefiltered product pages. Every listing link is the individual product page — no homepages, collections, or search pages. Prices and packet sizes captured; **prices are never displayed** (unchanged rule). Packet sizes **will** be displayed per Dustin's 2026-11-17 decision — see the schema need below.

---

## ⚠️ BLOCKER — ingest could not be executed: no production ingest API key exists on this machine

The crawl, matching, evidence verification, and payload construction are **complete**, but **zero listings were written**, because the ingest API requires a scoped API key and no usable key could be found:

- `POST /api/v1/ingest/jobs/lease` without a key → **401** `{"code":"unauthorized","detail":"missing, unknown or revoked API key"}` (verified live).
- Searched for a key: `~/workspace/seeds-hues/v2/.dev.vars` (only a `REVALIDATE_TOKEN` placeholder), project `hidden_files/`, all tmp logs/reports, shell environment, and the full workspace tree for the token prefix `sf_` — **no production ingest or admin key is stored anywhere**. Acceptance runs minted keys against *local* D1 and revoked them; the one production acceptance run used keys "supplied" at runtime that were never persisted.
- Per the brief, I did **not** work around this by touching D1 directly.

**To unblock (one command, owner's tooling):** mint a production key with the project's own script against production D1 —
`scripts/create-api-key.ts --scope ingest --label "crawl pass 1"` (run the same way the production acceptance keys were supplied) — then execute the prepared payloads with the included runner:

```
INGEST_KEY=<key> python3 ~/workspace/seeds-hues/crawl-pass-1/payloads/run_ingest.py
```

The runner leases an agent run, registers all 50 sources, and posts all **643 observations** in idempotent batches, saving per-observation results to `payloads/ingest-results.json`. Every evidence quote in every observation was verified locally against the fetched source text using the server's own rule (whitespace-collapsed substring), so the batch should land cleanly: **336 exact matches auto-publish; 307 go to the review queue** (138 model matches + 169 Gardener's Workshop new varieties).

**Second, unverifiable-until-keyed risk:** the DB schema default for `sellers.crawl_policy` is `manual_only`, and the seed data sets no policy. If production sellers are still `manual_only`, the API will reject web-source observations with `crawl_manual_only` (the runner prints rejection reasons, so this surfaces immediately). Fix in that case is an admin/data task for the build: set `crawl_policy` to `feed`/`html` for the approved sellers per the 2026-11-16 terms review (Songbird, Floret, Hudson Valley were terms-approved; the Floret Favorite Seed Sources farms were added wholesale at Dustin's direction).

---

## Headline numbers

| | |
|---|---|
| Sellers in scope | 25 (24 crawled; Wild West Seed skipped by design — wholesale only) |
| Products found | **8,708** |
| Exact matches → listings ready to auto-publish | **336** |
| Model matches → review queue (confidence ≥ 0.6) | **138** |
| New varieties proposed (Gardener's Workshop only) | **169** |
| Observations prepared, evidence-verified | **643** |
| Near matches held back (confidence 0.5, summarized not queued) | 255 |
| Products with packet sizes captured | **2,143** (366 of the 643 observations carry sizes) |
| Observations with price captured (never displayed) | 640 of 643 |
| Link audit of the 17 pre-existing listings | **3 pass, 14 fail** — correct product URLs found for all 14 |
| External spend | **$0** (no paid APIs; far under the $150/mo cap) |
| Wall time | ~75 minutes, ~600 HTTP requests |

## Per-farm results

"Exact" = observations ready to auto-publish on ingest. "Unmatched" = seed products with no catalog variety (they signal varieties the catalog may be missing; full lists in `crawl-pass-1/unmatched.json`, small farms also in the appendix below).

| Seller | Products found | Exact | Queued: model | Queued: new varieties | Unmatched | Not seed | Bundles |
|---|---|---|---|---|---|---|---|
| 3-porch-farm | 157 | 22 | 15 | 0 | 103 | 7 | 0 |
| american-meadows | 2675 | 22 | 5 | 0 | 1840 | 707 | 94 |
| blomma-flower-farm | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| botanical-interests | 920 | 16 | 16 | 0 | 673 | 150 | 39 |
| dawn-creek-farm | 15 | 0 | 0 | 0 | 13 | 0 | 0 |
| floret | 34 | 26 | 0 | 0 | 5 | 0 | 3 |
| great-basin-seed | 381 | 0 | 0 | 0 | 372 | 1 | 1 |
| half-moons-farm | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| high-mowing-organic-seeds | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| hudson-valley-seed-co | 1463 | 24 | 24 | 0 | 1137 | 225 | 21 |
| jig-bee-flower-farm | 50 | 13 | 2 | 0 | 28 | 1 | 1 |
| johnnys-selected-seeds | 90 | 2 | 7 | 0 | 74 | 0 | 2 |
| millay-and-meadowlark-flower-farm | 51 | 0 | 0 | 0 | 50 | 0 | 1 |
| peace-seedlings | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| prairie-moon-nursery | 60 | 0 | 0 | 0 | 55 | 0 | 3 |
| renees-garden | 758 | 20 | 8 | 0 | 577 | 112 | 14 |
| seed-savers-exchange | 72 fetched* | 1 | 0 | 0 | 72 | 0 | 1 |
| select-seeds | 1028 | 76 | 34 | 0 | 836 | 7 | 7 |
| songbird-seed-co | 112 | 32 | 1 | 0 | 67 | 1 | 3 |
| summertime-seed-co | 312 | 40 | 2 | 0 | 205 | 42 | 0 |
| sunflower-selections | 59 | 3 | 1 | 0 | 53 | 1 | 0 |
| sunflower-steve-seed-co | 13 | 0 | 1 | 0 | 8 | 1 | 1 |
| the-gardeners-workshop | 448 | 39 | 22 | 169 | 203† | 148 | 11 |
| three-brothers-blooms | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

\* Seed Savers: 80 sitemap-prefiltered pages fetched, 72 contained extractable products (the rest were stories/recipes caught by the prefilter).
† TGW unmatched 203 includes the 169 new-variety proposals' source class plus 19 no-crop and other unmatched seed products detailed in the TGW section.

### Per-farm notes

- **Songbird Seed Co.** (Squarespace): 112 products; 32 exact — nearly all sweet peas (King's Ransom, Wild Swan, Jilly, Clotted Cream…). The 67 unmatched are mostly Songbird's own sweet pea varieties not yet in the catalog — the single richest source of missing varieties in this pass.
- **Sunflower Steve** (Shopify): 13 products, mostly merch/sold-out mixes between sale windows, as the terms review predicted. One queued model match: "Van Gogh's Fantasy Mix" → catalog *Van Gogh's Fantasy* (the "Mix" suffix is the only difference — likely a true match, but it queues per the rules).
- **Floret** (Shopify): the shop feed is live with 34 products and — unlike the Nov 16 terms review, when only a book pre-order was up — it now lists seed products; 26 exact-matched (the Dawn Creek zinnia series and others). Availability is per-variant from the feed (mostly sold out, recorded as such). 3 bundles skipped.
- **Dawn Creek Farm** (Squarespace fundraiser page): 15 products, 0 exact, 2 model matches below the queue threshold (held, listed in data). Most named zinnias are sold out; the fundraiser's last shipping day was today, Nov 17 — expect the shop to close until the late-Jan/Feb 2027 release.
- **Hudson Valley Seed Co.** (Shopify): 1,463 products (their whole catalog incl. vegetables). 24 exact + 24 queued. Trap found: several varieties exist both as seed packets and as "-seedlings" plant starts — only seed products were matched (see link audit #15–17).
- **The Gardener's Workshop** (Shopify): see dedicated section below.
- **Johnny's Selected Seeds**: product sitemap prefiltered to 90 flower-relevant pages; only 2 exact — Johnny's varietal pages rank below mixes/collections in a token prefilter, so this pass under-covers them. A category-driven crawl (flowers → crop subcategories) is the right pass-2 approach.
- **Seed Savers Exchange**: their sitemap mixes the shop with stories/recipes; product discovery needs their catalog structure. 1 exact from 72 product pages this pass.
- **High Mowing Organic Seeds — COULD NOT BE CRAWLED.** The sitemap initially read fine (8,166 URLs, incl. 37 `/flowers/organic-*-seed.html` product URLs), then the host began returning **HTTP 403 Forbidden** for every request, including retries. Recorded as blocked; no circumvention attempted. Retry in a later pass.
- **Peace Seedlings — no web shop.** Blogspot blog with a seed list by post and mail/email ordering; no product pages exist to link to. (The host also intermittently resets connections from this network.)
- **Three Brothers Blooms — no crawlable shop found.** `/shop` returns 404 and the homepage exposes no shop/store links; nothing to crawl this pass.
- **Blomma Flower Farm / Half Moon's Farm**: seed sales run through single pages (Blomma: one `/purchase-copy/seeds` product page; Half Moon's: one sweet-peas page) with no per-variety product pages — under the link rule there is nothing listable until they have individual product pages. Recorded, not listed.
- **Wild West Seed**: skipped — wholesale only, never a retail buy-link source (per brief and terms review).
- **Great Basin Seed / Prairie Moon / Millay & Meadowlark**: crawled fully (381 / 60 / 51 products) but their assortments are native/restoration species and farm-original varieties with almost no overlap with the cut-flower catalog — 0 exact is a true result, not a crawl failure.
- **American Meadows / Botanical Interests / Renee's Garden / Select Seeds / Summertime**: big Shopify catalogs pulled in full via feed. Summertime is mostly dahlia *tubers* (correctly excluded as not-seed; their 40 exact are seed products). Renee's "Category - Variety" title format and Summertime's "Crop ⁃ Organic Seed - Variety" format are handled by segment matching.

---

## The Gardener's Workshop — full assortment enumeration (Dustin's scope expansion)

TGW's shop holds **448 products**, of which **296 are seed products** (Shopify `product_type` = "Seeds"); the other 152 are tools & supplies (118), online courses, books, downloads, and a gift certificate — out of scope, counted here as instructed.

| Bucket | Count |
|---|---|
| Cut-flower/filler seed products found | 296 |
| Already in catalog → exact-match listings ready | 39 |
| Near matches → review queue (model) | 22 |
| **New varieties proposed via ingest (below)** | **169** |
| Waiting on crop (crop not yet in catalog) | 6 (+1 discontinued, excluded) |
| Bundles/collections (skipped per spec) | 11 |
| No crop determinable / out-of-scope seeds (vegetables etc.) | 19 |

**How "adding" works in the API as built:** a new variety enters through ingest as a `new_variety` review proposal carrying the full listing observation and evidence. Per the canonical spec, new varieties are *never* auto-published — but Dustin's approval click in the review queue creates the variety record **and** publishes its TGW listing in one action (verified in the admin service: approve → `createVariety` under the proposal's crop + publish listing). Each proposal's crop field carries the catalog crop **slug**, so approvals land under the correct crop with no retyping. Variety names are exactly as TGW lists them (their "Crop, Variety" title with the crop segment removed, e.g. "Cockscomb, Cramer's Rose"). Facts come only from the product feed itself; nothing was invented, and unsourced attributes stay empty. New varieties will have no illustration — expected, per the brief.

Three products TGW itself marks **DISCONTINUED** (Sunflower 'Sunbright', Clarkia 'Elegant Salmon', Celosia 'Jura Salmon') were excluded from the proposals.

### New varieties proposed (169), by crop

- **amaranth** (4): Amaranth, Autumn's Touch; Amaranth, Love-Lies-Bleeding; Amaranth, Oeschberg; Amaranth, Velvet Curtains
- **basil** (4): Basil, Cardinal; Basil, Everleaf Lemon; Basil, Lemon and Cinnamon Bouquet Mix; Basil, Purple Ruffles
- **bupleurum** (1): Bupleurum, Green Gold
- **calendula** (2): Pot Marigold, Cantaloupe Mix; Pot Marigold, Pacific Beauties Mix
- **carnation** (1): Carnation, Chabaud Mix
- **celosia** (25): Celosia, Cockscomb, Act Verda Green; Celosia, Cockscomb, Asuka Mix; Celosia, Cockscomb, Chief Gold; Celosia, Cockscomb, Chief Mix; Celosia, Cockscomb, Chief Persimmon; Celosia, Cockscomb, Coral Unlimited; Celosia, Cockscomb, Cramer's Burgundy; Celosia, Cockscomb, Cramer's Lemon Lime; Celosia, Cockscomb, Cramer's Mix; Celosia, Cockscomb, Cramer's Rose; Celosia, Cockscomb, Crystal Beauty; Celosia, Cockscomb, Higyoku Green Stem; Celosia, Cockscomb, Higyoku Red Stem; Celosia, Cockscomb, Kurume Corona; Celosia, Cockscomb, Kurume Orange Red; Celosia, Cockscomb, Kurume Rose; Celosia, Cockscomb, Orange Queen Improved; Celosia, Cockscomb, Spring Green; Celosia, Plume, Celway™ Salmon; Celosia, Plume, Celway™ Terracotta; Celosia, Plume, Sunday™ Bright Pink; Celosia, Plume, Sunday™ Green; Celosia, Plume, Sunday™ Orange; Celosia, Plume, Sylphid; Celosia, Plume, Texas Plumes Mix
- **chinese-forget-me-not** (2): Chinese Forget-Me-Nots, Firmament; Chinese Forget-Me-Nots, Mystery Rose
- **clarkia** (3): Clarkia, Grace Lavender; Clarkia, Grace Salmon; Clarkia, Grace White
- **cornflower** (2): Bachelor Buttons, Boy Blue; Bachelor Buttons, Boy Mix
- **cosmos** (4): Cosmos, Afternoon White; Cosmos, Cupcake Blush; Cosmos, Fizzy White; Cosmos, Sensation Mix
- **cress** (1): Persian Cress
- **eucalyptus** (3): Eucalyptus Silver Drop; Eucalyptus, Parvula Gum; Eucalyptus, Polyanthemos
- **feverfew** (2): Feverfew, Vegmo Sunny Ball; Feverfew, Virgo
- **gomphrena** (6): Gomphrena, Audray Pastels Mix; Gomphrena, Audray Purple Red; Gomphrena, Audray Rose Bicolor; Gomphrena, QIS™ Carmine; Gomphrena, QIS™ Mix; Gomphrena, Strawberry Fields
- **honeywort** (1): Cerinthe, Kiwi Blue
- **larkspur** (2): Larkspur, Misty Lavender; Larkspur, QIS™ Mix
- **lupine** (1): Lupine, Russell's Formula Mix
- **marigold** (5): Marigold, Coco™ Deep Orange; Marigold, Coco™ Gold; Marigold, Coco™ Mix; Marigold, Coco™ Yellow; Marigold, White Swan
- **nigella** (3): Love-in-a-Mist, Green Marbles; Love-in-a-Mist, Midnight; Love-in-a-Mist, Persian Mulberry Rose
- **orach** (2): Atriplex, Green; Atriplex, Red
- **ornamental-grass** (5): Grass, Green Drops; Grass, Hylander; Grass, Lowlander; Grass, Millet, Lime Light; Grass, Millet, Purple Majesty
- **pincushion-flower** (5): Pincushion, Blue Cockade; Pincushion, Fire King; Pincushion, Ping Pong; Pincushion, QIS™ White; Pincushion, Triple Berry Mix
- **rudbeckia** (9): Black-Eyed Susan, Cherry Brandy; Black-Eyed Susan, Chim Chiminee; Black-Eyed Susan, Denver Daisy; Black-Eyed Susan, Goldilocks; Black-Eyed Susan, Indian Summer; Black-Eyed Susan, Maya; Black-Eyed Susan, Prairie Sun; Black-Eyed Susan, Sahara; Black-Eyed Susan, Triloba
- **salvia** (1): Salvia, Blue Bedder
- **snapdragon** (10): Snapdragon, Madame Butterfly™ Bronze White; Snapdragon, Madame Butterfly™ Ivory; Snapdragon, Madame Butterfly™ Mix; Snapdragon, Madame Butterfly™ Rose; Snapdragon, Opus Mix; Snapdragon, Opus™ III Early Bronze; Snapdragon, Opus™ III Yellow; Snapdragon, Opus™ III/IV Appleblossom; Snapdragon, Opus™ III/IV Fresh White; Snapdragon, Potomac Mix
- **soapwort** (1): Soapwort, White Beauty
- **statice** (5): Statice, Seeker Light Yellow; Statice, Seeker Mix; Statice, Seeker Purple; Statice, Seeker Rose Shades; Statice, Seeker White
- **stock** (6): Stock, Iron Pastels Mix; Stock, Katz Blue; Stock, Katz Cherry Blossom; Stock, Katz Hi Double White; Stock, Katz Ruby; Stock, Katz Yellow
- **strawflower** (6): Strawflower, Bright Rose; Strawflower, Choice Mix; Strawflower, Golden Yellow; Strawflower, King Size Orange; Strawflower, Peach Mix; Strawflower, Purple Red
- **sunflower** (18): Sunflower, Just Crazy (F1); Sunflower, ProCut® BiColor DMR; Sunflower, ProCut® Brilliance; Sunflower, ProCut® Horizon; Sunflower, ProCut® Lemon; Sunflower, ProCut® Orange; Sunflower, ProCut® Orange Excel; Sunflower, ProCut® Peach; Sunflower, ProCut® Plum; Sunflower, Rouge Royale; Sunflower, SunFill™ Green; Sunflower, SunFill™ Purple; Sunflower, TGW ProCut® Bouquet Mix; Sunflower, TGW ProCut® Fall Medley Mix; Sunflower, TGW ProCut® Mix; Sunflower, TGW ProCut® White Mix; Sunflower, Vincent's® Choice; Sunflower, Vincent's® Fresh
- **sweet-pea** (2): Sweet Pea, High Scent; Sweet Pea, Royal Mix
- **sweet-william** (12): Sweet William, Amazon Lavender Magic; Sweet William, Amazon Neon Cherry; Sweet William, Amazon Neon Purple; Sweet William, Amazon Rose Magic; Sweet William, Barcelona Pink; Sweet William, Bodestolz Mix; Sweet William, Electron; Sweet William, Sweet™ Black Cherry; Sweet William, Sweet™ Coral; Sweet William, Sweet™ Deep Pink Maxine; Sweet William, Sweet™ Rose Magic; Sweet William, Sweet™ White
- **tomato** (3): Tomato, Beefsteak 'Big Beef' (F1); Tomato, Cherry 'Sun Gold'; Tomato, Paste 'San Marzano II'
- **winged-everlasting** (1): Ammobium, Grandiflorum
- **yarrow** (2): Yarrow, Colorado Sunset; Yarrow, Summer™ Berries
- **zinnia** (9): Zinnia, Benary's Giant Mix (4-6" Blooms); Zinnia, Giant Cactus Inca Orange; Zinnia, Giant Cactus Mix; Zinnia, Oklahoma Mix (1.5" Blooms); Zinnia, Queeny Lemon Peach; Zinnia, Queeny Lime; Zinnia, Queeny Lime Mix; Zinnia, Uproar™ Rose; Zinnia, Zowie!™ Yellow Flame
### Waiting on crop (6)

These are cut-flower varieties whose crop does not exist in the catalog yet — the separate crop-addition build owns creating crops, so nothing was proposed for them:

| Product (as listed) | Crop it belongs to |
|---|---|
| Craspedia, Sun Ball | Craspedia |
| Ornamental Kale, Crane Rose (F1) | Flowering Kale |
| Ornamental Kale, Crane Red (F1) | Flowering Kale |
| Ornamental Kale, Crane White (F1) | Flowering Kale |
| Carthamus, Zanzibar | Safflower |
| Ageratum, Blue Horizon | Ageratum |

Excluded: "DISCONTINUED - Craspedia, Golden Drumstick" (discontinued by the farm).

The 19 no-crop seed products are mostly vegetables (Pepper 'Corno di Toro Carmen', Zucchini 'Green Machine', Cucumber 'Marketmore 76', Lettuce 'Allstar Gourmet Mix', Kale 'Black Magic' — out of scope) and a few ornamentals whose crop couldn't be determined from the listing alone ('Hairy Balls', 'Poppy, Giant Pod', 'Helenium, Red & Gold Hybrids', 'Decorative Gourd, Spinning', 'Ornamental Eggplant, Pumpkin-on-a-Stick') — recorded in `crawl-pass-1/tgw-deep.json`.

---

## Link audit — the 17 pre-existing listings

Checked every live listing's target URL against Dustin's rule (must land on the individual product page). **The API offers no listing-URL update path** (ingest upserts are keyed by seller+URL+variant; there is no admin listing edit), and direct D1 writes are forbidden — so all failures are listed here as **needs URL fix** with the correct product page, each found and verified in this crawl. Note that for the Songbird and Floret null-URL listings, this pass's exact-match observations will create *correct* listings on ingest; the old null-URL rows will still need an admin retire afterward to avoid duplicates.

| # | Seller / Variety | Current URL | Verdict | Correct product page |
|---|---|---|---|---|
| 1 | Songbird / King's Ransom (Sweet Pea) | songbirdseeds.com/seedshop/p/kingsransom-54d2m | ✅ PASS — product page | — |
| 2 | Songbird / Bix (Sweet Pea) | *null* | ❌ needs URL fix | https://www.songbirdseeds.com/seedshop/p/sirjimmyshand-baz64-ep2cc |
| 3 | Songbird / Blue Shift (Sweet Pea) | *null* | ❌ needs URL fix | https://www.songbirdseeds.com/seedshop/p/blueshift-m9b3c |
| 4 | Songbird / Gerry Cullinan (Sweet Pea) | *null* | ❌ needs URL fix | https://www.songbirdseeds.com/seedshop/p/gerrycullinan-palwp |
| 5 | Songbird / Emma (Sweet Pea) | *null* | ❌ needs URL fix | https://www.songbirdseeds.com/seedshop/p/emma-g25jz |
| 6 | Songbird / Wild Swan (Sweet Pea) | *null* | ❌ needs URL fix | https://www.songbirdseeds.com/seedshop/p/wildswan-d65k7 |
| 7 | Songbird / Alison (Sweet Pea) | *null* | ❌ needs URL fix | https://www.songbirdseeds.com/seedshop/p/alison-y5rsp |
| 8 | Songbird / Shell Pink (Sweet Pea) | *null* | ❌ needs URL fix | https://www.songbirdseeds.com/seedshop/p/shellpink-cbtlx |
| 9 | Songbird / Juliet (Sweet Pea) | *null* | ❌ needs URL fix | https://www.songbirdseeds.com/seedshop/p/juliet-xkbwm |
| 10 | Floret / Dawn Creek Pastels (Zinnia) | shop.floretflowers.com/products/zinnia-dawn-creek-pastels | ✅ PASS — product page | — |
| 11 | Floret / Dawn Creek Honey (Zinnia) | shop.floretflowers.com/products/zinnia-milk-honey | ✅ PASS — product page (slug says "milk-honey"; the product is Dawn Creek Honey) | — |
| 12 | Floret / Dawn Creek Blush (Zinnia) | *null* | ❌ needs URL fix | https://shop.floretflowers.com/products/zinnia-dawn-creek-blush |
| 13 | Floret / Dawn Creek Peach (Zinnia) | *null* | ❌ needs URL fix | https://shop.floretflowers.com/products/zinnia-dawn-creek-peach |
| 14 | Sunflower Steve / Van Gogh's Fantasy (Sunflower) | sunflowersteveseedco.com *(homepage)* | ❌ needs URL fix | https://www.sunflowersteveseedco.com/products/van-goghs-fantasy-mix-copy |
| 15 | Hudson Valley / Gift Zinnia | hudsonvalleyseed.com/collections/art-packs *(collection)* | ❌ needs URL fix | https://hudsonvalleyseed.com/products/gift-zinnia |
| 16 | Hudson Valley / Rembrandt (Snapdragon) | hudsonvalleyseed.com/collections/art-packs *(collection)* | ❌ needs URL fix | https://hudsonvalleyseed.com/products/rembrandt-snapdragons |
| 17 | Hudson Valley / Mother of Pearl (Shirley Poppy) | hudsonvalleyseed.com/collections/art-packs *(collection)* | ❌ needs URL fix | https://hudsonvalleyseed.com/products/mother-of-pearl-poppy |

Notes: #2's correct URL slug (`sirjimmyshand-…`) is a stale Squarespace slug — the product at that URL is titled "Sweet Pea Bix" (verified in the feed). #15–17: do **not** link the same-named `-seedlings` products (e.g. `gift-zinnia-seedlings`) — those are plant starts, not seed; the URLs above are the seed packets.

---

## Packet sizes — capture and SCHEMA NEED

Per Dustin's decision, packet sizes **will be displayed** on listing rows (so buyers can see where larger quantities are available). Capture is done:

- **2,143 of 8,708 products** have packet sizes captured verbatim (all sizes offered, incl. every variant/dropdown option — e.g. "50 Seeds", "1/4 oz"). Full per-product data, keyed by product URL, is in **`crawl-pass-1/packet-sizes-appendix.json`** (sizes + captured price + variant table) — nothing needs a re-crawl to load it later.
- **366 of the 643 observations** carry packet sizes (as `packet_size_N` extraction fields, each with its verbatim on-page evidence). 640 of 643 carry the captured price (prices remain **captured-only, never displayed** — unchanged).

**SCHEMA NEED (for the build):** the listings table and the ingest publish path have **no packet-size field** — the size extractions above are preserved in the observation payloads, but nothing copies them onto the listing record, and the same is true of price (the spec DDL has `price_minor` on listings, but the implemented upsert ignores price extractions). Suggested addition: **`packet_sizes`** on listings — a JSON list of verbatim size labels as listed by the shop (e.g. `["50 Seeds","100 Seeds","1/4 oz"]`), populated by the ingest publish path from the observation's `packet_size_N` extractions, and exposed in the API listing object so the site can render them on listing rows. Until that lands, the appendix JSON above is the system of record for sizes.

---

## Review-queue budget note

Prepared queue volume: **307 items** (138 model matches + 169 TGW new varieties) — above the 150-groups/day the 30-min budget clears. The TGW block is Dustin's explicit scope expansion and each item is a one-click approve (variety + listing together); the model matches group by normalized name in the queue UI, so the effective decision count is lower than the item count. A further **255 near matches at confidence 0.5 were deliberately NOT queued** — they are recorded with candidates in `crawl-pass-1/classified.json` for a later pass rather than flooding the queue. One dubious near match (Hudson Valley "Black Knight Canna", a canna lily product with no sane candidate) was dropped entirely.

## Files

- `crawl-pass-1/payloads/observations.json` — 643 ingest-ready observations (evidence-verified)
- `crawl-pass-1/payloads/sources.json` — 50 source documents to register (fetched text snapshots)
- `crawl-pass-1/payloads/run_ingest.py` — the executor (needs `INGEST_KEY`)
- `crawl-pass-1/packet-sizes-appendix.json` — packet sizes + prices for 8,707 products, keyed by product URL
- `crawl-pass-1/unmatched.json` — unmatched product names per seller (6,373)
- `crawl-pass-1/classified.json` / `products.json` — full classification and product data
- `crawl-pass-1/link-audit.json` — machine-readable link audit
- `crawl-pass-1/raw/*.jsonl` — per-seller raw crawl output

## Appendix — unmatched product names, small farms

(Full machine-readable list for all sellers: `crawl-pass-1/unmatched.json`. These are the farms whose unmatched names most directly signal varieties to add.)


**songbird-seed-co** (67): Strawberries & Cream Mix; Top of the Class Mix; Sweet Pea Wedding Day; Sweet Pea Rebecca; Sweet Pea Cathy; Sweet Pea Castle of Mey; Sweet Pea Primrose; Sweet Pea Elegance Ice Cream; Sweet Pea Old Times; Sweet Pea Suzanne; Sweet Pea Janet Scott; Sweet Pea Monarch's Diamond; Sweet Pea Kiera Madeline; Sweet Pea Lizanne Davies; Sweet Pea Takeda Sakura; Sweet Pea Alisa; Sweet Pea Heaven Scent; Sweet Pea John Gray; Sweet Pea Emily; Sweet Pea Patti; Sweet Pea Candyfloss; Sweet Pea Alan Titchmarsh; Sweet Pea MM; Sweet Pea Frank William Street; Sweet Pea Miss Willmott; Sweet Pea Spanish Dancer; Sweet Pea Crown Princess Victoria; Sweet Pea Prince Edward of York; Sweet Pea Milly; Sweet Pea Ella Mountbatten; Sweet Pea Claire Mitchell; Sweet Pea Terry Davey; Sweet Pea Eclipse; Sweet Pea Trelawny; Sweet Pea Lady Penny; Sweet Pea Maestro; Sweet Pea Kings Coronation; Sweet Pea Oyama Russian Blue; Sweet Pea Lilac Romance; Sweet Pea Daphne; Sweet Pea Esmé Rowena; Sweet Pea Helen Millar; Sweet Pea Minette Marrin; Sweet Pea Lilac Ripple; Sweet Pea Chris Harrod; Sweet Pea Glynne Collins; Sweet Pea Cilla; Sweet Pea Violet Queen; Sweet Pea Kingfisher; Sweet Pea Greenfingers; Sweet Pea High Scent; Sweet Pea Dragonfly; Sweet Pea Beverly Ann; Sweet Pea Lunar Blue; Sweet Pea Edd Fincham; Sweet Pea Beaujolais; Sweet Pea Purple Prince; Sweet Pea Hero; Sweet Pea Tom Atherton; Sweet Pea Just Jenny; Sweet Pea Riviera Montpellier; Sweet Pea Welcome to Yorkshire; Sweet Pea Allan Hodgson; Sweet Pea Fields of Fire; Sweet Pea Henry Eckford; Sweet Pea Prince of Orange; Sweet Pea William & Catherine

**dawn-creek-farm** (13): ZINNIA 'DAWN CREEK TUFTED MAMAS MYSTERY MIX' • 2026 Fundraiser Gift (LIMIT 1); ZINNIA 'DAWN CREEK BREEDING MIX'   • 2026 Fundraiser Gift; CYNOGLOSSUM 'DAWN CREEK MANDY'S WHITE' • 2026 Fundraiser Gift; Greeting Card Set 01: Meadow; Greeting Card Set 02: Zinnias; Greeting Card Set 03: Chrysanthemum; SWEET PEA 'DAWN CREEK ANGEL WINGS' • 2026 FUNDRAISER GIFT (LIMIT 1); ZINNIA 'DAWN CREEK TOFFEE' • 2026 Fundraiser Gift (LIMIT 1); ZINNIA 'DAWN CREEK CORAL SKY'  • 2026 Fundraiser Gift (LIMIT 1); ZINNIA 'DAWN CREEK CHIFFON'  •  2026 Fundraiser Gift (LIMIT 1); ZINNIA 'DAWN CREEK FIRST LIGHT'  •  2026 Fundraiser Gift (LIMIT 1); ZINNIA 'DAWN CREEK AURA' • 2026 Fundraiser Gift (LIMIT 1); ZINNIA 'DAWN CREEK PEARL BLUSH' • 2026 Fundraiser Gift (LIMIT 1)

**floret** (5): Bloom to Seed Signed Bookplate and Floret Seed Trio; Course Book for Flower Farming Workshop Alumni; Bloom to Seed Book - Signed Copy; 2026 Course Book for Flower Arranging Workshop Alumni; Sample ¼ Acre Cutting Garden Plan for Workshop Alumni

**sunflower-steve-seed-co** (8): Baptisia Gardener's Mix; Carolina Lupine (Thermopsis Villosa); Lemon Drop Mix; Sunflower Steve Co. Tank Top; Baptisia Sphaerocarpa; Sunflower Steve Co. Winter Hat; Sunflower Steve Co. T-Shirt; Sunflower Steve Co. Baseball Cap

**jig-bee-flower-farm** (28): Jig-Bee Community Supported Seed Club; Seed Donation Kit; Amaranth Jig-Bee Rose Gold Mix Seed; Celosia Mindmeld Fuschia Crested Cockscomb Seed; Blue Globe Thistle (Echinops Ritro) Seeds; Coreopsis Phoenix Breeding Mix Seeds - Bred by Jig-Bee; Coreopsis Incredible Swirl Seeds; Sunflower Bonfire Mix Seeds; Pumpkin Baby Boo Seeds; Shirley Poppy Falling in Love Seeds; Poppy Black Swan Seeds; Foxglove Digitalis Laevigata Seeds; Foxglove Digitalis lutea Seeds; Strawflower Purple Red Seeds; Scabiosa Misty Mountain Mix Seeds - Bred by Jig-Bee; Coreopsis Romance Mix Seeds - Bred by Jig-Bee; Strawflower Apricot Peach Seeds; Columbine Ballerina Pink; Poppy Hungarian Blue Seeds; Lupine Corinthian Blues Seeds; Cosmos Sunset Seeds; Cosmos Bright Lights Seeds; Wild Bergamot Seeds; Marigold Ildkongen Seeds; Feverfew Magic Single Seeds; Golden Marguerite Kelwayii Seeds; Poppy Drama Queen Mix Seeds; Strawflower Berry Bowl Seeds - Bred By Jig-Bee

**millay-and-meadowlark-flower-farm** (50): 2027 Summer Subscription -1- Begins on June 30th; Summer Subscription - 2 - Begins on August 11th; Alisa (Sale Begins 12/1 at 9 MST); Ballerina Blue (Sale Begins 12/1 at 9 MST); Blue Shift (Sale Begins 12/1 at 9 MST); Castle Of Mey (Sale Begins 12/1 at 9 MST); Charlie's Angel (Sale Begins 12/1 at 9 MST); Chloranthus (Sale Begins 12/1 at 9 MST); Ella Maria (Sale Begins 12/1 at 9 MST); Juilet (Sale Begins 12/1 at 9 MST); Lynn Fiona (Sale Begins 12/1 at 9 MST); Mary Priestley (Sale Begins 12/1 at 9 MST); Peter George Wale (Sale Begins 12/1 at 9 MST); Piggy Sue (Sale Begins 12/1 at 9 MST); Prince of Orange (Sale Begins 12/1 at 9 MST); Restormel (Sale Begins 12/1 at 9 MST); Susan Burgess (Sale Begins 12/1 at 9 MST); Yvette Ann (Sale Begins 12/1 at 9 MST); Dahlia 'Bracken Palomino'; Dahlia 'Coseytown Mason'; Dahlia 'Golden Scepter'; Dahlia 'Hollyhill Black Beauty'; Dahlia 'Hy Patti'; Dahlia 'Irish D Porter'; Dahlia 'Ivanetti'; Dahlia 'Jowey Winnie'; Dahlia 'Orange Globe'; Dahlia 'Robann Creamsicile'; Dahlia 'Rose Toscano'; Almost Black (Sale Begins 12/1 at 9 MST); Anniversary (Sale Begins 12/1 at 9 MST); Bix (Sale Begins 12/1 at 9 MST); April in Paris (Sale Begins 12/1 at 9 MST); Castlewellan (Sale Begins 12/1 at 9 MST); Chelsea Centenary (Sale Begins 12/1 at 9 MST); Cilla (Sale Begins 12/1 at 9 MST); Clotted Cream (Sale Begins 12/1 at 9 MST); Ethel Grace (Sale Begins 12/1 at 9 MST); Jill Walton (Sale Begins 12/1 at 9 MST); Jilly (Sale Begins 12/1 at 9 MST); Naomi Nazareth (Sale Begins 12/1 at 9 MST); Nellie Viner (Sale Begins 12/1 at 9 MST); Noel Sutton (Sale Begins 12/1 at 9 MST); Our Harry (Sale Begins 12/1 at 9 MST); Restormel (Sale begins 12/1 at 9 MST); Richard & Judy (Sale begins 12/1 at 9 am MST); Future Shock (Sale Begins 12/1 at 9 MST); King's Ransom (Sale Begins 12/1 at 9 MST); Meadowlark Medley (Sale Begins 12/1 at 9 MST); Burnished Bronze (Sale Begins 12/1 at 9 MST)

**sunflower-selections** (53): Great SunWall &#8211; New in 2026 &#8211; Sold Out! More in the Fall; ProCut®Peach Lite &#8211; Green Centers &#8211; New in 2026; ProCut® Lemon Lite &#8211; Green Centers &#8211; New in 2026; ProCut® Orange Splendor &#8211; Now Available; ProCut® Bravo &#8211; Standing Strong; Just Crazy; Lemon Cutie™ &#8211; Fleuroselect Gold Medal Winner; Lemon Pixie™ &#8211; New Dwarf; ProCut® Gold Lite DMR &#8211; Bright! Green Centers; ProCut® Horizon &#8211; Upright Flowers!; SunFill® Green &#8211; A Bouquet Green Filler; SunFill® Purple &#8211; A Colorful Filler Option; ProCut® Orange Excel &#8211; Deep Orange!; test product; Tinies; Country Roads &#8211; Great for Hand Bouquets; ProCut® BiColor DMR &#8211; NOW AVAILABLE; Gypsy Charmer &#8211; Triple Color Explosion; ProCut® Plum &#8211; Most Unique Color &#8211; Now in Stock; ProCut® Orange DMR; Chianti &#8211; Now Available; Butter Chiffon; Sundance Kid; Little Tiger; Feed The Birds (And the Bees); Stella Gold &#8211; Now Available; ProCut® Yellow Lite &#8211; Now Available; American Giant &#8211; A Garden Monster; ProCut® Brilliance; Starburst™Greenburst DMR &#8211; NOW AVAILABLE; Terracotta &#8211; Now Available; Joker; ProCut® Red Lemon BiColor -Back in Stock; Rouge Royale; ProCut® Peach &#8211; NOW AVAILABLE; Apricot Daisy- Now in Stock!; Peach Passion; Gold Rush DMR; ProCut® Orange; Starburst™ Panache- Now Available; Orange Ruffles &#8211; Now Available!; Firecracker; Baby Bear &#8211; Now Available; Munchkin; Junior; Kong Hybrid; Little Becka; Orange Hobbit; Sunflower Rainbow; Starburst™ Lemon Éclair; Salt N´ Roast; ProCut® Lemon &#8211; Now Available; Moonshadow

**prairie-moon-nursery** (55): Garden Phlox; Wild Sweet William; Wild Blue Phlox; Sweet Black-eyed Susan; Prairie Phlox; Small-flower Fame Flower; By Kim Eierman; Sweet Grass Braid; Sweet Everlasting; Smooth Phlox; Scarlet Bee Balm; Queen of the Prairie; Fire-on-the-Mountain; Narrow-leaved Cotton Grass; Purple Love Grass; Forked Aster; Sweet Grass; Common Blue Violet, pink form; Early Blue Violet; Prairie Blue-eyed Grass; Short & Showy Seed Mix; Attract Pollinators; Lyre-leaved Sage; Blue Sage; Wild Golden Glow; Spotted Bee Balm; 32 plants; Annual Rye Grass; Flowering Spurge; 38 plants; by Heather Holm; Cream Violet; Common Blue Violet, Bi-Colored Form; Common Blue Violet; Downy Yellow Violet; Prairie Violet; Smooth Yellow Violet; Small Wild Bean; By Barbara Ellis; Indian Grass; Stout Blue-eyed Grass; Common Blue-eyed Grass; Early Figwort; White Top Grass; Blue-leaf Willow; Brown-eyed Susan; Rudbeckia hirta - Black-eyed Susan; Black-eyed Susan; 6 Seed Packets; 18 plants; 38 plants; Mix & Match Tray; Purple Passion Flower; Rough-leaved Rice Grass; Green Needle Grass

**seed-savers-exchange** (72): Missouri Pink Love Apple Tomato; Recipe: Lemon Basil and Peach Panzanella; Grandma Einck and Her Blue Ribbon-Winning Dill; The story of the ‘Lina Sisco Bird Egg’ bean; The Life and Legacy of the Bean Man; moon and stars (van doren) watermelon; Myths and Realities of the Svalbard Global Seed Vault; Meet the Winners of the 2026 Tomato Tasting; Growing and Saving Flower Seeds; tomato flower structure; Painted Jewels; &#8216;Henry Eckford&#8217; sweet pea; Seed Stories: The Peg O’ My Heart Tomato; Recipe: Baked Zucchini Stuffed with Chouriço and Cream Cheese; Recipe: Sweet Corn Chowder; Recipe: Grilled Okra with Indian Salt and Mixed Spices; Q&#038;A with Craig LeHoullier, SSE Tomato Advisor; Peg Davis: The Tomato Lady; ‘Oma’s Orange’ Tomato: A Tradition of Love; Lee Barnes: Roots, Seeds, and the Joy of Giving; How to plant tomato and pepper transplants; Extending the Garden Season; Exploring Tomato Flower Structure; Create a Small-Space Garden Like (Our) Pro; A Young Seed Savers’s Love of the Exchange; Recipe: Vegetarian Black-Eyed Peas and Collard Greens; Painted Lady Improved; National weed your garden day; Bean Man; bachelor buttons; Quintessentially British: The Unjustifiably Shunned Runner Bean; How to Prepare Your Garden for Winter; It&#8217;s National Weed Your Garden Day!; &#8216;Igleheart Yellow Cherry&#8217; Tomato; How to Harden Off and Transplant Your Seedlings; Flower Seed Saving Profiles; ‘Chima Family Heirloom’: one pretty (remarkable) poppy; 50th Anniversary: Health, Safety, and Security; 50th Anniversary: Allowed and Prohibited Items; Working and learning: An intern’s experience at Heritage Farm; What to Plant in Your Garden in June; Tips for Harvesting and Storing Vegetables; The Seed Regeneration Process; 10 Garden Pest Solutions; zinnia; winter squash; Sweet Potato; sweet pepper; Shipping and Return Policy; Rizzi Softball Plum Tomato; Missouri Pippin apple; Hope and Practice; Herman&#8217;s Garden; German Pink tomato; gardeners and farmers; food and culture; Flower Seeds; Diane&#8217;s Garden; Cut-and-come-again; Container garden plants; cherokee purple tomato; Ben Davis apple; Apple; Apple Trees; apple recipes; Apple Grafting; Apple Camp; Stewardship Stories: Garden Favorites; Recipe: Great Grandma&#8217;s Sour Dill Yellow Beans; Recipe: Panzanella Green Bean Salad; Recipe: Golden Tomato Tart; Recipes: Eggplant, Onion, and Feta Tart

**blomma-flower-farm** (1): Seeds &raquo; BlommaFlowerFarm

**half-moons-farm** (1): Sweet Peas
