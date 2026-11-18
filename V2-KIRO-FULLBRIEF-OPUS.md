# Kiro Full-Briefing Review — Opus 5.5 (2026-11-15)

Consultation only — nothing built or modified (pre/post file checksums identical, 29 files).
Model: **claude-opus-5.5** (explicit `--model` flag via the `kiro-pro` wrapper; CLI logged out, API-key auth).
Raw output: `hidden_files/kiro-v2-fullbrief-opus-raw.txt`
Gap: Kiro still could not read `~/workspace/seed-sourcing/` (tool permission denied in non-interactive mode) — Aggregator size remains unverified by any Kiro pass.

## Headline architecture verdict
Stack confirmed unchanged: Next.js 16 App Router / React 19 / TS strict / Tailwind 4 on Cloudflare Workers via OpenNext; D1 + Drizzle behind a repository/service layer; DB (not the app) migrates to Postgres via Hyperdrive at the marketplace trigger. Full catalog doesn't change this — at 4,000 varieties the DB is tens of MB.

## Key conflicts the piecemeal passes missed (17 flagged)
- **X1 — D1 has no interactive transactions.** Spec bans `batch()` and mandates transactions D1 can't do. Fix: allow `db.batch()` inside one repository helper `atomic(ops)`; its Postgres version becomes a transaction.
- **X2 — "Client 100% API-driven" contradicts App Router.** Page navigation is RSC, not `/api/v1`. Redefine: one service layer, `/api/v1` is the canonical contract, interactive features + sync call the API, contract tests enforce parity.
- **X3 — FTS5 trigram** can't do <3-char queries or typo tolerance: prefix-match fallback for q<3, drop the typo-tolerance claim, rely on aliases.
- **X4 — `generateStaticParams`** returns `[]` (or top ~100); everything else ISR on first hit + post-deploy sitemap warm-crawl. Avoids build-time stale local-DB renders.
- **X5 — Pagination everywhere:** crawlable `?page=` URLs; no all-4,000-cards pages.
- **X6 — ISR cache:** prefer OpenNext R2 incremental cache + tag cache over KV (resolve as V16).
- **X7 — D1 export vs FTS5 virtual tables** (new VERIFY V14): export pipeline drops/rebuilds FTS; D1 Time Travel for backups.
- **X8 — Capacitor DOES send Origin** (`capacitor://localhost` iOS, `https://localhost` Android): add to CORS allowlist in Phase 2; never `*`.
- **X9 — JSON-LD surgery:** drop FAQPage (rich results restricted since Aug 2023); `AggregateOffer` + one Offer per listing at lowest verified packet; **no `Product` on zero-vendor pages** (BreadcrumbList only); omit `priceValidUntil`; drop sitemap priorities.
- **X10 — Robots:** allow all incl. AI crawlers; don't disallow `/api/` — use `X-Robots-Tag: noindex` on `/api/*`; `/search?q=` = noindex, follow.
- **X11 — Admin is a separate Worker** (`seeds-admin`) on its own hostname behind Cloudflare Access; public Worker stays GET-only, no auth code.
- **X12 — Catalog version bumps on publish** (daily/manual), not on every write, or clients re-sync constantly during ingestion.
- **X17 — Raw scrapes go to R2**, not D1 (key/hash/time in D1, 90-day lifecycle); D1 holds parsed candidates only.
- **Schema additions:** `sources` table with a hard rule — **no variety row without ≥1 source reference** (HR1 extended to enumeration); `variety_facts` side table with source per fact; `import_batches`, `match_queue`, `price_history`, `catalog_publish`; `media` stub with mandatory licence fields, ships empty; rollback never hard-deletes a published URL (410/draft rules).
- **Ingestion in two tiers sharing one TS package:** pre-launch/wholesale = offline CLI importers run by Hue writing staged batches via the admin API; post-launch = Cron → Queues → fetchers (Shopify `/products.json` → WooCommerce API → polite HTML). **Enumeration and ingestion are separate pipelines — only enumeration with a source creates varieties.**
- **New endpoints ship in Phase 1:** `GET /api/v1/catalog/version` (never cached) and `GET /api/v1/catalog/snapshot/{version}.sqlite` from R2 (allowlisted public tables, immutable).

## (a) Local-first ruling — NEITHER earlier position survives
**No SQLite WASM on the website, and no in-memory client search either. The local replica ships in the Phase 2 native apps as native SQLite fed by the `.sqlite` snapshot.**
- Kiro's own no-WASM plan (SW-cached JSON + in-memory search) dies at full-catalog scale: catalog ≈10–12 MB raw / ~3 MB gz — past its own ~5k-variety/1 MB failure point on budget phones, on day one.
- Hue's WASM-lite loses on traffic profile: Phase 1 visitors land from Google on one page and click out; ~400 KB WASM + multi-MB DB buys nothing, and the buy link needs network anyway. Server FTS5 answers in ms.
- The replica's real home is the store apps: a full offline catalog + instant local search + local favourites is exactly the native value that answers Apple's Guideline 4.2 rejection risk; native SQLite (expo-sqlite / Capacitor plugin) loads the snapshot with no WASM/OPFS/WKWebView risk.
- Kept from Hue's proposal: the WASM-ready discipline built in Phase 1 — versioned publish, snapshot endpoint, soft deletes, allowlist export. Web WASM = optional PWA offline mode later, only if analytics justify it.

## (b) Johnny's ruling — IN
The brief's condition ("no listings until sourced") was met 2026-11-05. Conditions: only the 19 checked crops and only variety-specific listings; packet labels exactly as recorded (no converting production prices into retail packets); product URL only if recorded, else homepage link; loaded via a rollback-able import batch; prices get the freshness caveat (4–6 months old at launch); confirm prices came from the public site, not a logged-in account.

## (c) The six full-catalog items
1. **Wholesale objection:** remove within 48h, no negotiation first. **Bigger catch — login-gated prices:** Ball WebTrack prices come from Hues' authenticated buyer account and the Onings figure is an ASCFG member special; republishing likely breaches account terms and risks the Ball supply relationship. Ruling: `access = login_gated` sources publish the listing as "Carried by Ball Seed" with **"See seller for price"** unless written permission is granted. `sellers.listing_policy` (full | no_prices | removed) gives a middle path on objections.
2. **Scraping:** opt-out honoured within 48h on a permanent blocklist; robots.txt binding; honest UA + `/about/bot` page; never behind a login; Etsy/eBay APIs only, skip Amazon; don't scrape RHS Plant Finder; proactively email top ~50 sellers once listed (backlink/partnership channel).
3. **Photos:** none at launch — swatches + generated OG cards; `media` table with mandatory licence fields ships now; Phase 1.5 written-permission programme (breeders/sellers, self-hosted in R2, credited) + Hues' own photos; CC Wikimedia species photos on plant pages only, never variety pages; no $10–20/variety photography spend yet.
4. **Descriptions:** reject the $15–30k hired-writer plan. **Deterministic template sentences from sourced structured facts** — zero cost, no copyright exposure, cannot hallucinate, no LLM free text. Hand-written editorial only for the top ~200 pages once Search Console shows traffic. **Indexability rule (disagrees with earlier "publish everything"):** a variety page is indexable only with ≥1 active listing OR `content_level ≥ factual` (≥3 sourced facts); otherwise live + linked but `noindex` and out of the sitemap — thousands of thin zero-vendor pages risk Google's scaled-content policy site-wide.
5. **Trademark disclaimer:** yes — footer + `/about`: names/trademarks belong to owners; site independent, not affiliated/endorsed; **plus a conflict-of-interest line** (Hues is a grower that buys from some listed sellers; sellers don't pay for placement); keep ™/® as breeders print them.
6. **"Plant-patent" badges:** wrong term — US plant patents cover asexual propagation, rarely seed varieties. Use a sourced `protection` field (pvp_us | utility_patent_us | pbr | none_stated | unknown) with certificate number + source; badge only when sourced; never claim "not protected." Not launch-blocking.

## Spec surgery — final count: 41 tasks (not 36; Kiro's own earlier math added 3 tasks and called it 36)
- Task 1 gains VERIFY flags **V14–V20** (D1 export/FTS5, D1 transactions vs batch, OpenNext R2 cache, Workers rate-limit binding, Queues/Cron/R2 pricing, Cloudflare Access free tier, D1 bound-parameter limit). V1–V13 still all unresolved — no build has run.
- New tasks: **10b** shared import package + Aggregator (incl. Johnny's) as staged batches, before UI work; **11b** enumeration workstream (the real critical path — curation, needs a named owner); **17d** catalog publish + version + snapshot; **32b** legal/trust pages (`/about`, `/about/bot`, disclaimer, terms, privacy, seller contact); **32c** measurement (Cloudflare Web Analytics, `sendBeacon` outbound-click tracking to Analytics Engine with direct hrefs — no `/go/` redirects, Search Console + Bing verification) — called the biggest omission; **33b** synthetic 10k/20k scale test on a separate preview D1.
- Validation counts become manifest-driven per import batch (X15); the C5 Typesense trigger becomes measured search p95 > 150 ms (X16).
- Sequencing: code can finish against Aggregator data while enumeration continues; **launch is gated on enumeration reaching the day-one target, not on the final code task.**
- Still open: garbled HR5 — seed-grown dahlias exist, so the catalog needs an explicit seed-dahlia rule (owner item 9).

## Owner decision list (Kiro's order, by blocking power)
1. Approve the consolidated architecture + local-first ruling (blocks schema Tasks 4–7, 17d).
2. Put the Aggregator files inside `~/workspace/seeds-hues/` or give exact counts (blocks sizing Task 10b).
3. Login-gated wholesale prices: permission-only publication (Kiro's recommendation) or publish anyway (blocks Task 10, changes spec §6.2).
4. Cut-flower inclusion rule + genus list + the actual day-one number in 1,600–4,000, and whether launch waits for it (blocks enumeration 11b).
5. Johnny's in, scoped to 19 crops + confirm prices were public-site (blocks 10b).
6. Indexability bar for zero-vendor pages (blocks Tasks 21, 31).
7. Descriptions: template text at launch, editorial for top ~200 later (blocks 11b content).
8. Who curates enumeration + match queue, and the weekly time budget (blocks 11b schedule).
9. Seed-dahlia rule: tall cut-flower seed strains in; dwarf/patio/pot out per standing rule (blocks 11b for one genus).
10. Admin as separate Worker behind Cloudflare Access + admin email list (blocks 17b/17c).
11. Objection/opt-out policy: 48h removal, `/about/bot` contact, scraping stance approval (blocks 32b + post-launch scrapers).
12. Measurement: Cloudflare Web Analytics + cookieless beacon click tracking (blocks 32c).
13. Disclaimer/COI wording + optional ~$500–1,500 pre-launch legal review (gates production cutover, not the build).
14. Phase 2 app stack: **Expo/React Native + expo-sqlite (Kiro's recommendation)** vs Capacitor with bundled SPA — never a wrapper pointed at the live site; **start Apple ($99/yr) + Google ($25) enrolment now, in Dustin's name.**
15. Photo strategy (non-blocking). 16. Protection badges (non-blocking).

*Standing owner rule applied throughout: the Kiro API key is consultation-only — Kiro advises; builds happen only on Dustin's separate explicit say-so.*
