# V2 — Kiro Full-Catalog Plan (distilled 2026-11-15)

Source: Kiro CLI consultation, model **claude-sonnet-4.5** (explicit `--model` flag; highest available on the current Builder ID login), ~10½ min run, exit 0.
Raw output: `hidden_files/kiro-v2-fullcatalog-raw.txt` (86 KB). Prompt: `hidden_files/kiro-fullcatalog-prompt.txt`.

**Brief confirmation:** Kiro read and listed all 9 documents — KIRO-MASTER-BRIEF.md, PROJECT-BRIEF.md, V2-KIRO-SUGGESTIONS.md, V2-DEPLOYMENT-PHASED.md, V2-DESIGN-PWA-API.md, V2-BUILD-SPEC.md, V2-AMENDMENT-LOCALFIRST-API.md, V2-KIRO-LOCALFIRST.md, V2-SCOPE-FULL-CATALOG.md — and correctly flagged the two open items (Johnny's ruling; local-first changes) as NOT settled.
⚠️ VERIFY / GAP: Kiro's read of `~/workspace/seed-sourcing/sourcing-list.md` was **denied** (file sits outside the seeds-hues workspace trust boundary). Everything it says about the Nov 2026 Aggregator's size (its 300–500 variety estimate) comes from the brief documents, not the file itself. Hue should supply the aggregator data inside the workspace (or exact counts) before Task 10b is scoped for real.

---

## a) Master variety universe — enumeration

**Sources, in priority order:**
- Tier 1 breeders/wholesale: Ball (FloraPlant/Seed), Syngenta Flowers, Sakata, Takii, Benary, PanAmerican Seed, Jelitto (perennials), GeoSeed (in hand).
- Tier 2: Johnny's, Harris Seeds, Fred C. Gloeckner, Van Zanten.
- Tier 3 reference: RHS Plant Finder, USDA PLANTS, Seed Savers Exchange (heirlooms).
- Tier 4: the Nov 2026 Seed List Aggregator data (GeoSeed, Johnny's, Silver Falls, Everwilde, Ball, Onings) — the foundation dataset.

**Taxonomy:** genus → species → series → variety/colour. Species layer = existing `plants` table. Key rulings:
- **Mixes are varieties** (one row). **Named single colours within a series are NOT separate variety rows** unless they carry distinct price/SKU/availability — otherwise they live in listing notes. (Ball Mammoth: 9 colours at one series price = 1 variety + the mix.) Exception: breeder-coded specialty singles ARE varieties.
- **New table `variety_aliases`** (breeder_code | trade_name | common_synonym | obsolete_name), FTS-indexed. Trade designations (™) stored as the breeder gives them, plain form aliased for search.
- **Dedup:** exact Latin + series match = same variety; fuzzy series + same species + overlapping colour → confidence-scored → **human review, never auto-merge**.
- **Completeness test:** a genus is "complete" when 2 consecutive Tier-1 sources add no new series (expect 2–4 passes/genus). Annual re-enumeration against new catalogs; `catalog_year` per variety; `status = discontinued` when all breeders drop it (page kept, marked unavailable).

**Realistic size (Kiro estimates, ⚠️ VERIFY against actual enumeration):**
- 30 representative cut-flower genera total **~1,600–2,800 varieties** (midpoint ~2,000–2,200). Biggest: Sweet Pea 200–350, Zinnia 150–250, Lisianthus 100–180 ⚠️ (heavily plug-based commercially — seed-series count may be overstated; cross-check Sakata/Takii seed vs plug lines), Snapdragon 120–180, Sunflower 80–150, Dianthus 80–120.
- Wider universe incl. minor cuts, specialty breeders, heirlooms, international: 3,000–5,000. **Practical full-catalog target: 3,000–4,000 varieties.** 10,000+ only with every obscure synonym — diminishing returns.

**Order of attack:**
1. Digitise the aggregator data (est. 200–400 varieties with listings) + top 5 genera (Sweet Pea, Zinnia, Sunflower, Snapdragon, Dianthus ≈ 1,000 varieties, and the hardest matching problems — sweet pea synonym chaos, zinnia colour explosion).
2. Remaining major annuals (+800–1,200 → ~1,800–2,200).
3. Perennials & specialists (+600–1,000 → ~2,500–3,200).
4. Long tail & international (+500–1,500 → 3,000–4,500).

## b) Vendor discovery pipeline

**Per seller type:**
- **Wholesale distributors:** prefer official exports/feeds via Hues' legitimate buyer accounts (e.g. Ball WebTrack CSV); otherwise respectful manual download + parse. Never circumvent auth. Quarterly refresh.
- **Shopify shops:** `GET /products.json` (public, structured — no HTML scraping needed), 1 req/2 s sustained. **WooCommerce:** public REST API where exposed, else HTML fallback respecting robots.txt. Monthly refresh; seller marked `inactive` after 3 months all-sold-out/404.
- **Etsy/eBay:** official APIs only, strict quality filter (Etsy: ≥50 sales, ≥4.8 rating, verifiable sourcing; human review mandatory — the category is full of fake-seed scams). **Skip Amazon** except known-legit official storefronts. Weekly refresh.
- **Breeder-direct:** small custom scrapes or ask for a CSV; annual refresh.
- **International:** deferred to the long-tail phase; flag currency/shipping/phytosanitary clearly.

**Scraping discipline (non-negotiable):** robots.txt is law; honest UA `HuesSeedFinderBot/1.0` with a public `/about/bot` page + opt-out honoured within 48 h and a permanent blocklist; generic HTML at 1 req/5–10 s per domain; never spoof a browser UA.

**Discovery over time:** quarterly search sweeps (Google Custom Search), ASTA/ASCFG/organic-seed directories (annual refresh), later a user "submit a seller" form feeding the review queue.

**Architecture (on the settled Cloudflare stack):** Cron coordinator → Cloudflare Queues → scraper Workers (per-domain rate-limit state in KV) writing `scrape_results` → matcher Worker → listings + review queue + targeted revalidation. Kiro cost estimate at ~200 sellers monthly: **~$0/mo incremental** ⚠️ VERIFY pricing. First pressure point is `scrape_results` bloat → 90-day TTL on raw scrapes. Dedicated scraper service only if ≥25% of sellers need browser rendering (Kiro estimates <5% do).

## c) Matching

- **Normalisation:** strip packet sizes/prices/qualifiers (organic, F1, heirloom), extract Latin binomial (validated against a known species list), parse series, extract colour words, detect mix vs single.
- **Confidence scoring (0–1):** Latin exact +0.4 (fuzzy +0.3, genus-only +0.1); series exact +0.4 (fuzzy ≥0.85 trigram +0.3, partial +0.2); colour match/mix +0.2, **colour conflict −0.3**; trusted-seller bonus +0.1.
- **Auto-attach only if ALL hold:** confidence ≥0.85, exactly one candidate, no colour conflict, trusted seller (≥50 prior matches at ≥95% approval, or Tier-1 wholesale), product active. 0.60–0.84, ambiguity, new sellers (first 10 products), colour conflicts → **review queue**. <0.30 or non-seed → reject/log unmatched.
- **Review queue UI** (`/admin/match-queue`): candidate picker, Approve / Create New Variety / Reject, bulk approve for trusted sellers, weekly review SLA; hire a part-time curator if backlog >200.
- **NEVER auto-match (hard rules):** (1) never auto-create a master variety from a scrape — scrapes attach to the master list, they never grow it unsupervised; (2) never auto-decide mix vs single when ambiguous (confidence capped at 0.59); (3) never auto-match across species boundaries; (4) never auto-match a discontinued variety without explicit restock evidence; (5) never below 0.60 or with a colour-conflict penalty.

## d) Data model + ingestion changes

New/changed vs V2-BUILD-SPEC §3.1 (all in the raw output with SQL):
- `listings` += `source_url`, `import_batch_id`, `match_confidence`, `last_scraped_at`, `freshness_status` (fresh|stale|dead).
- `varieties` += `added_by_batch_id`, `source_catalog`, `catalog_year`.
- `listing_packet_sizes` += `last_verified_at`.
- New tables: `variety_aliases`, `import_batches` (pending|committed|rolled_back, with counts), `scrape_results`, `match_queue`, `price_history`.
- FTS must index alias names too (trigger-maintained).

**Zero-vendor pages: publish them.** Full variety info, "We haven't found any sellers carrying this variety yet" + related varieties that do have sellers; JSON-LD `Product` with **zero Offers** (valid); included in sitemap at priority 0.4 (vs 0.7 with sellers); no noindex. Rationale: SEO land-grab, completeness/trust signal, future seller-submission funnel. Suppress only draft varieties, and discontinued + zero-vendor after 12 months (noindex).

**Freshness UI:** fresh = price as-is with "Verified {date}"; stale (past cadence + grace) = price shown muted with "may have changed" caveat; dead (404/delisted/inactive seller) = hidden by default under "Previously available from", excluded from JSON-LD Offers and seller counts, never deleted. >180 days: caveat; >365 days: hide price entirely.

**Price history: store it, don't show it yet.** Insert on change or every 90 days; keep 3 years. Uses: scrape-error detection (10× jump → review), Phase 2 "price range over 12 months", Phase 3 seller value signals, dispute audit trail.

**Import batches:** every bulk import runs inside a batch; rollback = surgical delete of that batch's listings/packets/varieties + FTS rebuild + revalidation. Manual entries get NULL batch so they can never be batch-rolled-back. Admin: `/admin/batches` + token-protected rollback endpoint with confirmation.

## e) Scale check (10k–50k varieties, hundreds of sellers, 100k+ listings)

Scenario modelled: 20k varieties / 500 sellers / 80k listings / 320k packet rows ≈ 150–200 MB DB.

- **D1 size:** 10 GB cap hits only at ~500k varieties (or sooner via scrape-table bloat → TTL). Not the bottleneck.
- **Reads:** D1 co-located 1–5 ms/query; variety page ~10–30 ms DB time. ISR + CDN absorb viral spikes (5M reads/day free ≈ 15–30k page views/day uncached). Postgres/Hyperdrive adds ~12–20 ms/query ⚠️ VERIFY but plans complex joins better.
- **Writes:** D1 free 100k/day is comfortable for the directory; the real migration trigger remains marketplace write patterns/ACID, per the phased plan — not variety count.
- **Sitemap:** 50k-URL file limit at ~45k varieties; `generateSitemaps()` sharding already designed in the spec — just activate.
- **ISR/KV:** weekly full-catalog revalidation at 20k pages exceeds KV free writes → ~$1.50/mo paid; on-demand-only revalidation keeps it cheap. Cost issue, not capability.
- **BREAKS FIRST — client in-memory search:** ~5,000 varieties / ~1 MB cached JSON crosses 200 ms on budget phones. → Adopt **SQLite WASM + OPFS at ~1,000 varieties / 2 MB** per the local-first thresholds; at ~100k varieties use the prebuilt `.sqlite` snapshot for cold start. Server FTS5 stays fine to ~50k varieties (>200 ms beyond); Postgres FTS to ~100k.
- **Dedicated search (Typesense ~$15–30/mo ⚠️):** evaluate at ~5,000 varieties IF faceted filtering (seller × region × bloom time × colour) becomes a real requirement — not on variety count alone.
- **Images:** no photos in v2. At scale, R2 self-hosting is cheap (20k varieties × 3 photos × 200 KB ≈ 12 GB ≈ $0.18/mo storage, free egress ⚠️ VERIFY); image *processing* is the real cost (Cloudflare Images ~$5/mo per 100k variants ⚠️).

**Net:** the settled Workers + D1 architecture holds for the full realistic catalog (3–4k varieties) with room to spare. Break order: client search (→WASM) → KV revalidation cost → D1 writes (marketplace) → sitemap limit (shard) → D1 size (distant).

## f) Sequencing vs the 34-task spec

**MUST change in the spec BEFORE the build:**
1. Task 4/5 addenda: all §d schema additions + new tables; Task 6: FTS indexes aliases.
2. **NEW Task 10b — digitise the Nov 2026 Aggregator (est. 300–500 varieties, ~1,500–2,500 listings ⚠️ counts unverified — see gap note) BEFORE the web UI tasks.** Acceptance extends Task 11 validation to those totals, orphan joins = 0, FTS "Champagne Bubbles" returns both GeoSeed and Ball listings.
3. **NEW Task 17b — Match Review Queue UI** (`/admin/match-queue`) and **Task 17c — Import Batch admin + rollback**.
4. Task 21 addendum: zero-vendor variety template. Task 13: API listings carry `freshness_status`, dead excluded unless `?include_inactive=true`. Task 14: search covers aliases. Task 30: zero-Offer JSON-LD validates.
5. Spec grows 34 → **36 tasks**, ~5 weeks (Kiro estimate ⚠️).

**Kiro's strongest opinion:** enumeration digitisation (Task 10b) happens **before** UI build, not after launch — the 22-variety starter cannot stress-test synonyms, mix-vs-single, zero-vendor pages, or multi-seller ranges, and schema mistakes found after 17 pages are built are expensive. Adds ~3–5 days, de-risks everything downstream.

**Post-launch workstreams (do NOT block website deploy):**
- 1A (≤1 mo): scraper pipeline — Shopify first, matcher at the 0.85 threshold, quarterly wholesale scripts. 2–3 wks eng + 1 wk testing.
- 1B (2–3 mo): first 1,000 varieties (top-5 genera); WASM adopted here.
- 1C (3–6 mo): attach listings at scale (50 Shopify + 20 Woo + 10 filtered Etsy) → 2,000–5,000 listings.
- Phase 2 (6–12 mo): remaining annuals → ~2,000 varieties; Woo/eBay scrapers; Typesense evaluated.
- Phase 3 (9–18 mo): perennials/specialists → ~3,000; Postgres migration only if marketplace triggers hit; first international sellers.
- Phase 4 (yr 2+): long tail → 3,500–4,500; annual catalog refresh automated; user submissions open.

## g) Risks / legal

- **Scraping exposure by type:** Shopify `/products.json` and official APIs = very low risk. Wholesale portals via Hues' own buyer account = low if manual/respectful; systematic price publication could draw a ToS objection — mitigation is attribution + instant removal + negotiate a data partnership. Generic HTML = moderate; *hiQ v. LinkedIn* supports scraping public data, robots.txt + conservative rates + honest UA + opt-out are the shield. Never scrape paywalled content.
- **Descriptions:** breeder/seller copy is copyrighted — **write original descriptions** (synthesise facts across catalogs + RHS/USDA). Kiro cost estimate ⚠️: $5–10/variety hired out = $15–30k over 2 years for 3,000 varieties; alternatives: crowd-source from growers with credit, or ship minimal factual descriptions.
- **Photos:** never lift seller/breeder photos (copyright + the no-hotlink rule). Ladder: none in v2 → CC/public-domain (thin) → original photography (~$10–20/variety ⚠️) → seller uploads under licence (needs DMCA process) → breeder partnerships with written permission (best long-term).
- **Trademarks:** directory use of series/variety names is textbook **nominative fair use**; keep ™/® as breeders print them, don't use breeder logos beyond small seller icons, add an independence disclaimer (Kiro recommends yes).
- **PVP/patents:** listing a protected variety infringes nothing (no propagation/sale). Kiro recommends a `pvp_status` badge field as a grower value-add; secondary-liability questions only arise at marketplace phase → seller ToS must require PVP compliance + takedown process.
- **Pre-launch legal review** of /about/bot, ToS/privacy, disclaimer, and one sample listing: Kiro estimates $500–1,500 ⚠️ (or pro-bono IP clinic).

## Decisions Kiro puts to Dustin

1. **Johnny's listings** — still open (include the sourced catalog in v2 or not).
2. **Kiro's local-first changes** — still open (accept no-WASM-in-v2 + WASM at ~1k varieties, per §e, or override).
3. **Wholesale objection policy** — remove immediately on objection (Kiro recommends) vs negotiate first.
4. **Scraping stance** — opt-out by default with a responsive /about/bot (Kiro recommends, Google model) vs opt-in only.
5. **Photo strategy** — none until Phase 2 (current plan) vs original photography sooner vs breeder partnerships now.
6. **Description budget** — hire a writer vs crowd-source vs minimal factual descriptions.
7. **Trademark disclaimer** — add (Kiro recommends yes).
8. **PVP badges** — add the field (Kiro recommends yes).

⚠️ VERIFY count: Kiro flagged 32 items across §a–g; the load-bearing ones are the aggregator's true variety/listing counts (unreadable to Kiro — see gap note), Lisianthus seed-vs-plug counts, Cloudflare/D1/Queues/KV and Typesense pricing, Hyperdrive latency, and OPFS-in-WKWebView (carried over from the local-first consultation).
