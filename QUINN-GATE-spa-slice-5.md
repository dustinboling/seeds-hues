# QUINN GATE — SPA Slice 5: Seller shops + hubs (Seed Directory SPA conversion)

- **Subject:** PR #78, github.com/dustinboling/seeds-hues — "Slice 5 — Seller shops + hubs", branch `muse/45527259274`, head `d2d6e88`
- **Reviewer:** Quinn Assurance (independent; did not make this work). Single-evaluator gate (see Coverage ledger).
- **Worktree:** `~/workspace/seeds-hues-gate-s5-wt` at the PR head, as supplied. No fetch/checkout/worktree/clone run; all work on disk inside that worktree.
- **Contract, in order:** (1) build brief `muse-tasks/spa-slice-5-shops-hubs.md`; (2) Bea's prerender-content audit `spa-conversion-2026-11-23/PRERENDER-CONTENT-AUDIT.md` §1, §1.1, §1.2, §1.3, §3.3–§3.6, §4.1; (3) gate records `QUINN-GATE-spa-slice-3.md` and `QUINN-GATE-spa-slice-4.md`, including the Slice 4 §6(c) carry this slice must discharge. All read before testing.
- **Date:** 2026-11-24 (America/Los_Angeles)

## VERDICT: PASS WITH NOTES

No Blocker, Critical, or Major defect found. Every emphasis item in the gate brief was exercised: the verify chain reproduced clean twice (42 files / 560 tests, exit 0), my own independent built-artifact drive passed 16/16 with expectations computed by hand from the fixture definitions — using different filter combinations, a different search proof, and a different invalidation mutation than the builder's — and all four of my mutation spot-proofs were noticed by the shipped suite. The Slice 4 carry is **discharged** (§3). The notes are Minor/Trivial: the recurring unfiled starting-red (N1), two documented OG readings to confirm with Bea (N2), and the recurring inventory-artifact note (N3). One gate-process disclosure (§1) concerns my own mid-gate test run, not the product. Severity, evidence, coverage, and verdict are kept on separate axes throughout.

---

## 1. Verify chains (executed by me)

| Chain | Result | Evidence |
|---|---|---|
| app `npm ci` | exit 0 | directly observed |
| app `npm run verify` (lint + typecheck + test) — first run | **exit 0 — 42 test files, 560 tests, all passed** | directly observed |
| Slice 5 HTTP suite within it | `tests/build/slice5-shops-hubs.test.ts` — 52 tests passed (count observed under mutation runs) | directly observed |
| Final confirmation `npm run verify` after all mutations restored and my gate suite deleted | **exit 0 — 42 files / 560 tests**; `git status` clean, tree byte-identical to the PR head | directly observed |

**Gate-process disclosure (evidence hygiene, not a product finding).** One mid-gate standalone `npm run test` of mine raced the still-running background verify — both runs build into the same `dist/` — and printed an anomalous summary (37 files / 575 tests). That figure is discarded: the two clean, sequential, non-concurrent verify runs agree exactly at 42 files / 560 tests, exit 0, and the final confirmation run above is the governing figure. No other gate step ran concurrently with anything.

Builder accounting checks:
- **Final green — CONFIRMED as reproduced: 42 files / 560 tests.** Against Slice 4's gate-confirmed 441 / 33, this slice adds 119 tests across 9 files (the 52-test HTTP suite; shop/crop unit suites; the shop and crop in-place DOM suites).
- **Fixture counts — CONFIRMED against `tests/unit/shop-catalog.ts`:** Blue Ridge 30 listings (24 + 6 across two pages), Prairie 12, Two Roads 3 (multi-location), Faraway 2, Quiet Hollow 0, Shuttered removed-only; sunflower 30 varieties (24 + 6); sunbeam 8 (all with sellers), moonshadow 3 (zero with sellers); states OR 2 / KS 1 / TX 1 / VT 1, California absent.
- **Step-1 starting-red — NOT FILED anywhere in the tree** (searched: no builder summary, commit messages carry no accounting). Ruled on as N1 (§7), same pattern as Slice 4's N1.

## 2. My independent raw-HTML drive of the built artifact

I wrote my own contract suite (16 tests: my own harness copy, my own counting/grep/price code, expectations hand-computed from the fixture definitions), built the app against the test stub (`SEEDS_API_BASE`), served it through the shipped harness, fetched with plain HTTP (no JavaScript), then deleted the suite. **Result: 16/16 passed.** Three of my initial assertions failed and all three were defects in my own tests, corrected and re-run green — recorded here because the corrections are themselves evidence about the product's deliberate behaviors:

- `?color_family=not-a-color` returns 200, not 404: the value is *pattern-clean* (lowercase + hyphens) but outside the hue vocabulary, and the port deliberately stays forgiving there (the shipped suite proves the same with `mauve`); the strict 404 fires on pattern failures (`PINK!`, `pink,PINK`) and on `has_sellers` values other than exactly `true`/`false` — all three of which I re-asserted and observed 404. The strict parse is preserved exactly where Bea §3.4 puts it.
- `/series/sunbeam` declares `og:image` = `/og/crop/sunflower`, not a series-kind card: an explicit in-code m-2 ruling (`pages/series/@slug/head.ts`) — series pages share their crop's generated card rather than re-shipping portrait artwork or inventing a new card kind. Ruled on in §6(a).
- A blanket "no `/go/` anywhere on the shop page" assertion was wrong: listing outbound links legitimately route through `/go/{id}` (the §3.1 pattern); the brief's rule is that the seller's *homepage* link is direct, and it is (`href="https://blueridgeseeds.example.com"`, asserted).

### Shop drive (§3.3 + the SHOP design) — all pass
- **Page 1:** 200 with §9 headers (`public, s-maxage=3600, stale-while-revalidate=86400`); title "Blue Ridge Seeds — Flower Seed Seller | seeds.hues.flowers"; meta description ends at a sentence boundary (the m-5 mid-word clip is structurally absent); 24 cards; **grouped-order proof in the rendered DOM: "Zelda Star" (orderable, Z) renders before "Amber Waves" (non-orderable, A)** — grouping beats alphabet, Name A–Z is the sole key within groups; cards carry Latin names (`Lathyrus odoratus`, `Cosmos bipinnatus` both present); contact block renders the fixture's public CS phone `(503) 555-0114` and email `help@blueridgeseeds.example.com`; `Organization` JSON-LD carries the real name and a `PostalAddress` matching Portland, OR.
- **Latin-name card rule:** present on shop cards and on crop-hub cards (`Helianthus annuus`); absence renders *no line, never a placeholder* — proven two ways: my rendered-HTML grep finds no placeholder text, and the card component's `LatinLine` returns `null` when `latinName` is null (code read, `src/components/variety/VarietyCard.tsx`).
- **Page 2 / bounds:** self-canonical to `?page=2`; ItemList positions 25–30 with exactly the six expected names, disjoint from page 1; `?page=1` → single **301** to the clean shop URL; `?page=3` → true 404; zero-listing seller with `?page=2` → 404.
- **Tools and thresholds:** at T=30 the shop renders search (`id="shop-search"`), filter legends with **Crop first**, and the grouped sort; `?crop=sweet-pea` narrows to that crop only (Zelda Star, a cosmos, gone); `?q=zelda` narrows to exactly Zelda Star; `?q=prairie` returns zero cards (Prairie Rose lives in another shop — search is shop-scoped); `?sort=name` puts Amber Waves first (pure A–Z crosses the grouped boundary). At T=12 (Prairie) filters render without search; at T=3 (Two Roads) neither renders. Prairie's imported rating renders as a visible panel ("Rated 4.7 out of 5") and the string `4.7` appears in **no** JSON-LD block.
- **Multi-location (Two Roads):** both locations render with kind labels, the physical address (`4810 Springdale Rd`) before the mailing address (`PO Box 1408`), primary marked; exactly one shop page — `/seller/two-roads-farm/austin` is a true 404.
- **Graceful absences:** Faraway ("Online only") emits an `Organization` with **no `address` key at all**; Quiet Hollow (zero listings) is 200, indexable, zero cards.

### Status discrimination — three distinct answers, all observed
| Request | Result |
|---|---|
| `/seller/shuttered-seed-co` (removed) | **410**, noindex Gone page linking to `/seller` |
| `/seller/no-such-seller-zzz`, `/seller/Bad_Slug` | **404** (the real 404 page, never a 200 shell) |
| `/seller/quiet-hollow-farm` (live, zero listings) | **200**, indexable |

410 ≠ 404 ≠ 200-empty, exactly as §3.3 requires.

### Hubs — all pass
- **Crop (sunflower):** title carries "30 Varieties, 25 With Sellers"; ItemList 24 on page 1; page 2 self-canonical, positions 25–30, the six expected names; `?page=1` → 301; `?page=3` → 404. Filters with *my own* combinations: `?series=sunbeam` → 8 items; `?color_family=pink` → 5 items; `?has_sellers=true` → 200, `noindex`, canonical exactly the clean crop URL. `og:image` = `/og/crop/sunflower`, and the generator serves it: 200, PNG, **1200×630 read from the PNG header** — a generated card, never the portrait artwork.
- **Series:** sunbeam — 200, ItemList of all 8, crop link anchor `href="/crop/sunflower"`; moonshadow (zero with sellers) — 200, **no `noindex` anywhere**, ItemList of 3; unknown series → 404.
- **State:** Oregon — **absolute** title "Seed sellers in Oregon — Seed Directory" (no site suffix), ItemList of 2, anchors to both seller shops, "Add Your Farm" → `/add-your-farm?state=OR`; Kansas — 200, ItemList of 1; **California (real state, no visible seller) → true 404**, `not-a-state` → 404; `?page=1` → 301.
- **Legacy crop rows:** `/plants/sunflower` and `/categories/sunflower` each answer a single **301** to `/crop/sunflower`, landing on a 200 hub.

### Head exclusivity (my own counts — Slice 2 F6 lesson applied as exclusivity, not presence)
On shop pages 1 and 2, the multi-location shop, crop page 1, the filtered crop view, the series hub, and the state hub: **canonical 1, meta description 1, og:url 1, og:image 1, title 1 — every template, every count exactly one.** No duplicate-head recurrence.

### Price guard — BOTH halves (§1.2)
1. **Code guard:** `assertNoProhibitedJsonLd` with the full §1.1 list runs at render and is exercised in verify (`jsonld-guard.test.ts`, 18 tests, green; `price-guard.test.ts` proves the rendered-HTML checker's sensitivity).
2. **My own rendered-HTML check** (independent implementation): every parsed JSON-LD block on every sampled template scanned for the prohibited types/keys (`Product`, `Offer`, `AggregateOffer`, `AggregateRating`, `Review`, `FAQPage`, `price`, `lowPrice`, `offers`, `aggregateRating`, `priceValidUntil`) and visible text scanned for `$`-amounts — **zero violations** on shop pages 1–2, the multi-location shop, the empty shop, Prairie (imported-rating panel present, rating absent from structured data), crop pages and filtered view, both series, and the state hub. Packet sizes ("25 seeds", "1 g", "100 seeds") present and correctly not flagged.

### Structured-data inventory diff (§1.1, new templates)
Shop: exactly `BreadcrumbList` + `Organization` + `ItemList` (page-window items, continuous positions). Crop detail, series, state: exactly `BreadcrumbList` + `ItemList`. **Exact match to §1.1's rows — nothing added, nothing missing, nothing prohibited.** Note N3 on the standalone inventory artifact.

## 3. Slice 4 carry — DISCHARGED

Re-tested end-to-end at this gate, by the shipped suite and by my own fetches with manual redirect handling:

| Chain | Result |
|---|---|
| `/sellers/blue-ridge-seeds` | single **301** (not 308), `Location: /seller/blue-ridge-seeds` → followed → **200** shop |
| `/seller?s=blue-ridge-seeds` | single **301**, same Location → followed → **200** shop |

The Slice 4 §6(c) carry is discharged in full.

## 4. Cache-invalidation freshness (my own proof, different write than the builder's)

Warmed `/seller/prairie-seed-house` and `/variety/sweet-pea-kings-ransom`; mutated the *shared* Prairie listing row (id 2) `lastCheckedAt` → 2026-11-23 in the stub; confirmed **stale** state served first on both pages; POSTed `seller:prairie-seed-house` to `/internal/revalidate` (200); re-fetched both **without cache-busting**: the Prairie shop serves "Checked Nov 23" and the variety page serves "Nov 23, 2026". **One seller-tag revalidate fans out across templates — Bea's fan-out concern does not materialize.** The builder's own proof (Blue Ridge listing 1 sells out; the shop's grouped order re-flows it to page 2 and the variety page reflects it) also passes in the shipped suite.

## 5. Mutation spot-proofs (suite sensitivity — each applied, run, restored byte-identical)

| # | Mutation | Outcome |
|---|---|---|
| M1 | Removed seller resolves as 404 (`shop-route.ts`: the gone split removed) | **NOTICED** — 2 tests failed (410 + discrimination checks) |
| M2 | `parseLocation` invents a `PostalAddress` for an unparseable location | **NOTICED** — 3 tests failed (Faraway absence checks, HTTP + builders) |
| M3 | Crop strict parse disabled (`cropDetailParamsValid` → always true) | **NOTICED** — 3 tests failed (malformed-filter 404 checks, HTTP + unit) |
| M4 | Grouped sort collapsed (`isOrderable` → always true; pure A–Z) | **NOTICED** — 9 tests failed (grouped-order proofs, HTTP + unit) |

All four mutations were caught. Tree restored after each (backups byte-copied back; final `git status` clean and final full verify green, §1).

## 6. Rulings

**(a) Series and state OG cards — ACCEPTABLE, note for Bea (N2).** The brief's Step-1 OG line requires crop, series, and state pages to declare "a generated 1200×630 card (`/og/crop/{slug}` etc.)". The build declares: crop → its own generated card; series → its crop's generated card (explicit in-code m-2 ruling in `pages/series/@slug/head.ts`); state → the generated site card (`/og/site/default`, served 200 at 1200×630). The load-bearing requirement — the m-2 defect class, portrait artwork declared as a landscape OG image — is met on all three: every hub declares a generated 1200×630 card and none declares portrait artwork, and the Slice 3 generator has exactly four kinds (variety/seller/crop/site), so no series/state kind exists to declare. **Disposition: conformant with the contract's substance; the "etc." reading is the coordinator's/Bea's to confirm.** If a per-series or per-state card kind is wanted, it is a future-slice addition, not a repair to this one.

**(b) Crop filter strictness boundary — CONFORMANT.** Pattern-failing `color_family` values and non-`true`/`false` `has_sellers` values 404 (§3.4's strict parse, preserved — my §2 drive); pattern-clean values outside the vocabulary are ignored forgivingly, and an unknown `series` slug filters honestly to an empty 200. This matches the v2-derived behavior the shipped suite documents and the audit's letter (the audit names pattern failure, not vocabulary membership). No defect.

## 7. Usability drive (shopper goals)

Evaluator structure: single evaluator (Quinn); Nielsen 0–4 for usability items. Modes: JS-disabled raw HTML (full fidelity, §2) for the SSR floor, plus the shipped jsdom DOM suites for the hydrated in-place layer (`tests/dom/shop-inplace.test.tsx`, 3 tests; `tests/dom/crop-inplace.test.tsx`, 2 tests — read as suites within the green verify; component fidelity: real components, real loaders, real fixture data; the Vike router and real CSS painting are the unproven links, as at Slices 3–4).

**Flow 1 — "Find a shop that sells what I grow, and see what they stock."** From the state hub, Oregon's two shops are one tap each; the Blue Ridge shop's first screen answers the shopper's questions in order: who (H1 + type eyebrow), where (location line + state plate), what (24-card grid with variety name, Latin name, stock word, checked date, packet sizes), and how to reach them (contact block with the public CS phone/email; homepage link direct). The grouped order puts everything orderable today ahead of everything else, A–Z within each group, so the shopper never has to decode why a Z-named in-stock variety sits above an A-named sold-out one — the sort control names the behavior ("In stock first"). **No finding.**

**Flow 2 — "Narrow this shop to the crop I want."** The filter legends lead with Crop (the group a seed shopper reaches for first); the crop view narrows server-side from the URL alone, so the filtered shop is shareable and works with no JavaScript; search narrows to this shop's varieties only, and a query for another shop's variety returns an honest empty state rather than leaking across shops. Threshold behavior is honest: a 3-listing shop shows no tools it doesn't need; a 12-listing shop gets filters without a search box. **No finding.**

**Flow 3 — "This seller is gone / doesn't exist / has nothing yet."** The three states are three different, comprehensible answers: the removed seller's 410 page says so and links onward to `/seller`; an unknown slug gets the real 404 page with search and hub links; the zero-listing shop is a real, indexable shop that says "No listings for this seller yet." instead of pretending not to exist. No dead ends. **No finding.**

**Flow 4 — "Browse a crop, then a series, then a state."** Crop hub counts in the title match the grid (30 varieties, 25 with sellers); series pages render their full grid unpaginated as the port specifies, with the crop one tap back; the state hub's intro count matches its ItemList and cards, and its "Add Your Farm" link carries the state prefill. A state with no sellers is a plain 404 rather than an empty page pretending to be a hub. **No finding.**

**Findings summary:** 0 usability findings at Nielsen ≥ 1. Boundaries in §8.

## 8. Findings (all notes; nothing returns to the maker)

- **N1 — Minor (accounting / evidence, recurring).** The Step-1 starting-red statement is not filed anywhere in the tree — the brief names it a deliverable ("state the red result in your summary"), and neither the commit messages nor any summary file in the tree carries it (the same omission as Slice 4's N1). Evidence: tree search — directly observed absence. The property the red exists to prove (tests that discriminate) is independently established at this gate by §5's four mutations and by my own contract-first suite. **Carry, program-level:** file the red in the build summary even when a run is cancelled or repaired (a WIP-branch test-count snapshot per repair round makes it reconstructable).
- **N2 — Trivial (spec reading for Bea/coordinator, not a build defect).** Series pages declare their crop's generated OG card and state pages the generated site card, per explicit in-code rulings; the brief's "(/og/crop/{slug} etc.)" admits both readings. The anti-portrait requirement is met everywhere (§6(a)). Confirm the reading so Slice 6+ doesn't re-litigate it.
- **N3 — Trivial (program artifact, recurring since Slice 3).** No standalone `structured-data-inventory.md` exists in the tree. The §1.2 diff was performed at this gate from emitted HTML and is recorded in §2, which serves as the diffable record for these templates.

**Code review (diff read in context):** 78 files under `app/` (+7,713/−53 against the Slice 4 merge), plus coordinator log lines in two program files and the brief itself — `v2/` untouched, no workflow files, no deploy config. Design sound: the data layer extends `CatalogApi` with the shop/hub reads over the same public API shape (one backend); the removed-seller split consumes the existing live `/api/internal/seller-status/{slug}` precedent and answers 410 *before* render; `redirects.ts` was extended, not forked, for the crop legacy rows; new pages are registered in the revalidate fan-out (proven behaviorally in §4). The `/crop` index (§4.4) also landed in this slice's repair rounds — extra surface beyond the brief's Step-2 list, covered by the green suite; noted as observed scope, not a finding. No strictness weakening observed in the files read (route resolvers, JSON-LD builders, shop/crop filter libraries, head builders).

## 9. Coverage ledger

- **Population:** the Slice 5 surface — `/seller/[slug]` (30/12/3/2/0-listing bands, multi-location, unparseable location, imported rating, removed, unknown, malformed, paginated, filtered, searched, sorted), `/crop/[slug]` (paginated, hue/series/has-sellers filtered, strict vs forgiving parse boundary, sort-only), `/series/[slug]` (with-sellers, zero-with-sellers, unknown, paging ignored), `/state/[slug]` (plural, singular, sellerless-real-state, nonsense), the legacy crop redirects, the Slice 4 carry chains, head exclusivity, the price guard (both halves), §9 cache headers + seller-tag invalidation fan-out, OG declarations and serving.
- **Structured sample:** all of the above, exercised by the shipped suite (560 tests), my independent HTTP suite (16 tests, hand-computed expectations, different filter/search/invalidation choices), and 4 reviewer mutations — every stratum exercised at least twice by independent code.
- **Adversarial additions:** pattern-failing filter values (`PINK!`, comma-injected uppercase); a search query belonging to a *different* shop; a per-location URL probe (`/seller/two-roads-farm/austin`); uppercase/malformed slugs on seller, series, and state; stale-before-purge reads in the invalidation proof; invented-address, dropped-410, dropped-strict-parse, and collapsed-grouping mutations.
- **Exclusions, with reasons:** a real-browser (Chromium) drive of the hydrated shop/crop layer — no live-browser session is available to this gate; hydrated behavior is proven at jsdom level by the shipped DOM suites (green in verify). The production Worker's edge cache (the harness's edge mock is the proven layer, as at prior slices). Live production data (tree inert; fixture catalog via the stub — fidelity is stub-level for data, real for code path, rendering, headers, redirects, and cache machinery). OG card *text* beyond the declared URL and PNG dimensions (builder-level card tests cover copy; no OCR at this gate, as at Slice 3). The builder's Step-1 red (N1). The v2 verify chain was not re-run at this gate — this slice's diff does not touch `v2/` (verified by diff scope, §8), and Slice 4's gate confirmed v2 green on the identical tree.
- **Evaluator structure:** single evaluator (Quinn), no second rater commissioned for this gate; there are no usability findings to rate (all flows clean), so no severity disagreements exist to surface.
- **Residual risk:** defects that appear only against production-shaped data (83 real sellers — e.g. very long names or descriptions in shop titles/OG cards, location strings with shapes beyond the two fixture forms, states with >24 sellers forcing state pagination, which no fixture exercises), only in a real browser's router/paint path, or only in the production Worker's edge behavior could still escape this coverage. State pagination past page 1 is the one untested-by-fixture branch I name explicitly: the code path is the shared §4.1 machinery proven on shop and crop pages, but no fixture state reaches it. The day-0 preview-deploy crawl in Bea §10 remains the control for that class.

## 10. Return conditions

Nothing returns to the maker. The slice may proceed to merge on this verdict, with the Slice 4 carry recorded as discharged (§3) and N1–N3 tracked as notes. Carries for Slice 6: the N1 filing discipline (program-level), the N2 OG reading confirmation (Bea/coordinator), and N3's inventory artifact (program-level, recurring).

— Quinn Assurance, 2026-11-24
