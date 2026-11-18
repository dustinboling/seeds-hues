# Variety Facts Schema — Proposal

**Status:** Proposal for owner review (Dustin, requested 2026-11-16). Not a build spec — no schema changes have been made.
**Scope:** What factual attributes a variety record on seeds.hues.flowers should carry — height and the like — where each fact realistically comes from, and which ones power browsing.

## How this was grounded

- **Current v2 model**, read from `v2/seed-data/catalog.json`, `v2/lib/catalog/input.ts`, `v2/lib/catalog/assertions.ts`, and `v2/lib/db/schema.ts` (68 varieties, 19 plants, 6 sellers, 17 listings live).
- **Canonical spec** `SPEC-CANONICAL.md` §2 (data model), §3 (API filters), §8 Q4 (color vocabulary).
- **Floret Library variety pages.** The full 565-description capture was still running when this was written, so five variety pages were sampled directly (Celosia, Cosmos, Larkspur, Black-eyed Susan, Bells of Ireland — five different crops and plant types). All five use one rigid template, described below, so the fact *kinds* below are what the Library states; the full capture will confirm coverage counts.

### What a Floret Library variety page actually contains

Every sampled page has the same four parts:

1. **Description** (prose) — color words, flower form (single / semi-double / double), sometimes flower size, habit, fragrance, wedding/event use, occasional warnings.
2. **Details** (structured, six lines on every page) — Plant type, Height (a range, in inches), Site (sun exposure), Days to maturity (a range, in days), Plant spacing (one value, in inches), Pinch ("when *X* to *Y* in tall" or "not necessary").
3. **Seed Sowing & Growing Notes** (prose) — start indoors *X* to *Y* weeks before last frost and/or direct-seed; sometimes a pre-treatment (pre-chilling seed in the freezer for a stated number of days); sometimes germination behavior in words ("slow and erratic"), never as a number.
4. **Harvesting / Vase Life** (prose) — harvest stage, an expected vase life range in days on every sampled page, drying suitability and method where relevant, occasional handling flags (ethylene sensitivity, keep out of the cooler).

That template is good news: the six Details lines plus the vase-life range are machine-extractable across the whole Library with the same evidence-quote rule as everything else.

## Ground rules (apply to every attribute below)

- **Explicit unknowns, always.** A fact we cannot source stays NULL (numbers) or `'unknown'` (enums). Yes/no facts are three-state: yes, no, unknown. No defaults, no "typical for the crop" fill-ins, no values inferred from a photo. (Canonical spec §2; this is the rule the whole catalog already runs on.)
- **Every fact is sourced per field.** Each non-null fact carries a `field_sources` entry pointing at the observation it came from, and the extraction only publishes when the evidence quote is found verbatim in the stored snapshot (spec decisions 17–18).
- **Floret is a names-and-facts reference only** (spec decision 16). Facts and numbers may be taken; published wording is our own.
- **Units:** store metric integers (cm, days) as the spec's DDL does. Floret publishes inches; convert at extraction (in × 2.54, rounded) and keep the original wording in the evidence quote.
- **Ranges are min/max pairs.** A source that states one value sets min = max. A source that states a range fills both.
- **Level:** a fact lives at variety level when it varies by variety or the source states it per variety (Floret states all of its Details per variety, including plant type). Plant (crop) level holds taxonomy and generic crop guidance.

## Proposed attributes

Priority: **Launch** = needed for the Dec 16 launch. **Later** = Phase 1.5 or beyond. "Capture at launch" means the Floret pass should extract it while it is on the page anyway, even if nothing displays it yet.

| # | Field | Meaning | Type + units | Level | Source | In v2 today? | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `color_family` | The one color family a buyer filters by | Controlled vocab, §"Color vocabulary" below; default `'unknown'` | Variety | Floret page (description + name) / seller page | Partial — DB column + API filter exist; not in seed input, `'unknown'` on all 68 | **Launch** |
| 2 | `color_detail` | The color in words, our own wording ("dusty mauve-pink, fading to cream") | Free text, short | Variety | Floret description (facts only) / seller page | No | Later |
| 3 | `color_swatch_hex` | Display swatch | `#RRGGBB` | Variety | Assigned from the sourced color | Yes — `colorSwatch`, filled on 14/68 | Already live |
| 4 | `height_cm_min` / `height_cm_max` | Mature plant height range | Integer cm | Variety | Floret Details / seller page | Partial — v2 has a single `heightCm` (10/68 filled); spec §2 already defines the min/max pair | **Launch** |
| 5 | `stem_length_cm_min` / `stem_length_cm_max` | Usable cut stem length, when a source separates it from plant height | Integer cm | Variety | Seller page (occasionally) | No | Later, record-only |
| 6 | `flower_size_cm_min` / `flower_size_cm_max` | Bloom diameter range | Integer cm (one decimal kept pre-rounding in evidence) | Variety | Floret description prose (inconsistent) | No | Later, record-only |
| 7 | `flower_form` | Bloom shape class | Vocab: `single`, `semi_double`, `double`, `plume`, `spike`, `pompon`, `daisy`, `other`, `unknown` | Variety | Floret description prose | No (stays in prose today) | Later |
| 8 | `fragrance` | Is it scented | Three-state yes/no/unknown | Variety | Floret description / seller page | Partial — ad-hoc `fragrant` tag on 6/68 | Later |
| 9 | `days_to_bloom_min` / `days_to_bloom_max` | Days from sowing to first bloom | Integer days | Variety | Floret "Days to maturity" (see note below) / seller page | Partial — DB columns exist; not in seed input, NULL on all 68 | **Launch** |
| 10 | `bloom_season` | Calendar bloom window | Vocab (multi): `spring`, `early_summer`, `summer`, `late_summer`, `fall` | Variety (crop-level default) | Neither source states it reliably — curated from crop guides / our own notes | No | Later |
| 11 | `vase_life_days_min` / `vase_life_days_max` | Expected vase life range | Integer days | Variety | Floret Harvesting section (present on all 5 samples) | No | **Launch** |
| 12 | `harvest_stage` | When to cut, in a phrase ("buds just cracking") | Free text, short, our own wording | Variety | Floret Harvesting section | No | Later, record-only |
| 13 | `dries_well` | Suitable for dried use | Three-state | Variety | Floret Harvesting section | Partial — ad-hoc `dried-flower` tag on 2/68 | Later |
| 14 | `ethylene_sensitive` | Damaged by ethylene; keep from ripening fruit etc. | Three-state | Variety | Floret Harvesting section (occasional) | No | Later, record-only |
| 15 | `life_cycle` | Plant type: `annual`, `hardy_annual`, `biennial`, `perennial` | Vocab | Variety (species-level in spec §2; Floret states it per variety, and it varies within a crop) | Floret Details ("Plant type") | Partial — approximated by subcategory (`annual` / `annual-climber` / `perennial`), which conflates life cycle with climbing habit | **Launch** |
| 16 | `sun_exposure` | Light requirement | Vocab: `full_sun`, `part_shade`, `full_shade`, `unknown` | Variety | Floret Details ("Site") | No | **Launch** |
| 17 | `spacing_cm` | In-row plant spacing | Integer cm | Variety | Floret Details ("Plant spacing") | No | Later — capture at launch |
| 18 | `sowing_method` | How it is started | Vocab (multi): `transplant`, `direct_sow` | Variety | Floret Sowing Notes / seller page | Partial — ad-hoc `direct-sow` tag on 7/68 | Later — capture at launch |
| 19 | `sowing_lead_weeks_min` / `sowing_lead_weeks_max` | Start indoors this many weeks before last frost | Integer weeks | Variety | Floret Sowing Notes | No | Later, record-only |
| 20 | `germination_days_min` / `germination_days_max` | Days to germinate | Integer days | Variety | Seller page (sometimes); Floret gives words only | No | Later, record-only |
| 21 | `sowing_depth_cm` | Planting depth | Decimal cm | Variety | Seller page (sometimes); Floret never states it | No | Later, record-only |
| 22 | `seed_pretreatment` | What the seed needs before sowing | Vocab (multi): `cold_stratification`, `light_required`, `dark_required`, `soak`, `scarification` | Variety | Floret Sowing Notes (stated when it applies, e.g. pre-chilling) | No | Later, record-only |
| 23 | `pinch_recommended` + `pinch_height_cm_min` / `pinch_height_cm_max` | Pinch or not, and at what height | Three-state + integer cm range | Variety | Floret Details ("Pinch") | No | Later — capture at launch |
| 24 | `pollination` | `open_pollinated`, `f1_hybrid`, `unknown` | Vocab | Variety | Seller page / breeder; **Floret Library never states it** | Partial — DB column + API filter exist; `'unknown'` on all 68 | **Launch** (field + filter; values fill in as sellers are crawled) |
| 25 | `protection` | IP status: `pvp_us`, `utility_patent_us`, `pbr`, `none_stated`, `unknown` (+ `protection_note`) | Vocab + text | Variety | Breeder / seller statements | Yes — field exists, `'unknown'` on all 68 | Already live (record-only until Phase 3) |
| 26 | `kind` | `cultivar`, `series_member`, `mix`, `strain` | Vocab | Variety | Cataloging decision at import | Spec-only — in spec §2 DDL and §3 filter list; absent from v2 | Later |
| 27 | `breeder_name` | Who bred it (never itself a seller fact) | Text / breeder row | Variety | Floret / seller / breeder pages | Spec-only — spec §2 has a breeders table; v2 has none | Later, record-only |
| 28 | `series_name` | Breeder's series the variety belongs to | Text → series hub | Variety | Floret / seller pages | Yes — filled on 7/68 | Already live |
| 29 | `scientific_name` | Botanical name | Text | Plant (species in spec §2) | Floret / reference | Yes — plant-level `latinName`, filled on 19/19 plants | Already live |
| 30 | `description` + `sowing_notes` | Our-own-words prose for the variety (and generic crop guidance at plant level) | Text | Variety + Plant | Written by us from sourced facts | Yes — variety description 46/68, sowing notes 14/68; plant-level both 0/19 | Already live |

**Count: 30 attributes** (counting each min/max pair and the description pair as one attribute each).

## Added 2026-11-16 (evening) — attributes for the assistant, zones, and personalized timing

Directed by Dustin during the Phase 4 design session. These extend the schema; the same ground rules apply (a fact stays empty unless a real source states it; source noted per fact).

| # | Field | Meaning | Type + units | Level | Source | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| 31 | `season_class` | Cool Season Hardy Annual vs Warm Season Tender Annual | Vocab: `cool`, `warm`, NULL | Crop | TGW published collections; Floret Plant type + Sowing notes | **LIVE 2026-11-16** (Phase 2: 48 cool / 33 warm / 12 unclassified) |
| 32 | `sowing_methods` | Direct Sow and/or Start in Plug Trays (multi-value) | Vocab (multi): `direct_sow`, `transplant` | Crop | Floret Sowing & Growing notes | **LIVE 2026-11-16** (Phase 2: 91/93 crops) |
| 33 | `role_use` | The crop's job in an arrangement — powers the assistant's advisory suggestions ("what fillers should I grow?") | Vocab (multi): `focal`, `filler`, `spike_or_line`, `foliage`, `texture`; NULL until sourced | Crop | Floret material where available; otherwise **flagged for Dustin's review before the assistant quotes it** | Phase 4 |
| 34 | `difficulty` | How hard it is to grow well | Vocab: `easy`, `moderate`, `finicky`; NULL until sourced | Crop | A source that states it, **or a Dustin-reviewed rating** — never inferred by the extractor | Phase 4 |
| 35 | `usda_zone_min` / `usda_zone_max` | USDA zone suitability range (half-zone precision where the source gives it) | Zone values (e.g. `3`–`9`, `8b` bounds kept as stated) | Crop, variety-level override where a source states one | Floret, TGW, seller/seed-house data — source noted; unsourced crops queue for review, **no blanket guessing** | Phase 4 |
| 36 | `timing_rules` | Sowing/transplant windows expressed as the sources express them — **offsets from frost dates**: start-indoors window (weeks before last frost), transplant window, direct-sow window (relative to last frost), fall-sow window for hardy annuals (relative to first frost) | Structured offsets (weeks, signed, relative to `last_frost` / `first_frost`) | Crop (variety override where stated) | Floret Sowing notes / TGW / seller guidance — source noted per rule | Phase 4 |

**Display + use notes for the zone/timing attributes:**

- **Zones on annuals — honest copy:** for annuals, zones mainly drive *timing* and fall-planting/overwintering, not survival the way they do for perennials. Page copy must say so rather than implying an annual "won't grow" outside a range.
- **Surfaces for zones:** (1) shown on crop + variety pages with the other facts; (2) a **zone filter** joins the Phase 2 filter family ("grows in my zone"); (3) the account profile's "my zone" (derived from the signup ZIP); (4) the assistant KB — "what zone am I in?" (ZIP/city → zone) and zone-aware timing suggestions.
- **Coverage reporting:** when the fact-schema build runs, report how many crops have sourced zone data vs queued for review (same discipline as the season/method coverage counts).
- **Personalized growing instructions:** a date-computation layer combines a crop's `timing_rules` with the gardener's ZIP frost dates (average last/first frost from the self-hosted NOAA-normals-based dataset) → concrete calendar dates for THAT gardener. Surfaces: a personal block on crop/variety pages for anyone whose ZIP is known ("For your garden (zone 8b · last frost ~Apr 12): start indoors Feb 15–Mar 1 · direct sow from Mar 29 · fall sow by Sep 20"); the assistant quotes the SAME computed dates (one computation service, no divergent answers); a future account "my growing calendar" view across alerted/favourite crops. Anonymous visitors see the generic relative phrasing + the ZIP-box invitation. **Computed dates are averages-based planning dates and are labelled as such — never guarantees.**
- **The ZIP box (site feature):** a small utility with the crop browsing/filters (and offered during account setup, where it fills "my zone"): visitor types a ZIP → learns their USDA zone from a **self-hosted ZIP→zone dataset based on the current USDA Plant Hardiness Zone Map** (half-zones included, e.g. 8b; no external lookup service at runtime). Result offers "See flowers for zone {X}" (applies the zone filter) and, if signed in, "Save as my zone" (or update, if different). Anonymous use is fine. Accessible: proper label; works without JS via the API route if practical. Wherever the zone is shown (ZIP-box result + account profile), a short blurb adds their **average last frost (spring) and average first frost (fall)** dates + implied frost-free season length, from the NOAA-normals-based dataset — presented as averages (typical 50%-probability dates) with a one-line honesty note that actual frosts vary year to year. The assistant KB uses the same two dates for timing advice.

Two semantic notes the owner should see:

- **"Days to maturity" → `days_to_bloom`.** Floret's number is the only timing figure either source gives, and for annual cut flowers maturity and first bloom are effectively the same event. The proposal adopts Floret's range into `days_to_bloom_min/max` as-is. Floret does not state the basis (from sowing vs. from transplant); we record the number without reinterpreting it, and the evidence quote preserves the original wording.
- **v2's height shortcut.** The v2 API currently mirrors the single `heightCm` into both `height_cm.min` and `height_cm.max`. Once Floret ranges land, that shortcut should be replaced by the real pair (spec §2 already defines the columns).

## Color vocabulary — answering spec §8 Q4

Q4 asks for a fixed list of about 12 families, because `color_family` is a filter on every crop page. Proposed: **12 families, plus `mix`, plus `unknown`.**

| Family | Includes |
| --- | --- |
| `white` | White, cream, ivory |
| `blush` | The palest pinks — florists shop blush separately from pink, especially for weddings |
| `pink` | Pink, rose, magenta-pink |
| `peach` | Peach, apricot, coral, salmon |
| `orange` | Orange, tangerine, rust-orange |
| `yellow` | Yellow, gold, primrose |
| `red` | True red, scarlet, crimson |
| `burgundy` | Burgundy, wine, maroon, claret |
| `purple` | Purple, violet, lavender, lilac, mauve, plum |
| `blue` | Blue (rare in flowers; kept because delphinium/larkspur/bachelor's buttons need it) |
| `green` | Green, lime, chartreuse (foliage and bells-type crops) |
| `chocolate` | Brown, bronze, copper, near-black |
| `mix` | Multi-color mixes sold as one variety |
| `unknown` | Not yet sourced — the default, never guessed |

Rules: one primary family per variety (it is a filter, not a description); bicolors and streaked blooms take the dominant family and put the rest in `color_detail`; a named mix takes `mix`. The vocabulary is a fixed list in code, changed only by an owner decision — the same discipline as the seller allowlist.

## What powers browsing vs. what is record-only

**Filters at launch** (spec §3 already promises most of these): crop, series, `color_family`, `pollination`, has-sellers / in-stock (derived from listings, not variety facts), and — new in this proposal — `life_cycle`.

**Filters worth adding in Phase 1.5**, once the Floret facts are populated:

- **Height class** — derived from the height range, never stored: short (under ~45 cm), medium (45–90 cm), tall (over 90 cm). Florists and growers both plan by height.
- **Vase life** — "7+ days" is the professional cut-flower bar; a one-tap facet on the sourced range.
- **Sowing method** — direct-sow varieties are a real grower filter (no greenhouse needed).
- **Fragrance**, **dries well**, **bloom season** — secondary facets for florists and wedding work.

**Record-only** (shown on the variety page as facts, never filters): stem length, flower size, flower form, harvest stage, germination days, sowing depth, seed pre-treatment, pinch detail, ethylene sensitivity, color detail, breeder, protection (until Phase 3, where spec §7 makes `pollination` + `protection` the gate for any Hues-grows-it suggestion).

## How facts interact with the index rule

They mostly don't — and that is deliberate. Canonical indexability (spec decision 8) is: **≥1 published listing OR ≥150 words of our own notes.** Structured facts do not make a zero-seller page indexable, so importing 565 Floret varieties with full facts still leaves them `noindex` until a seller is found or real notes are written. Separately, v2's `content_level` ("factual" at ≥3 sourced facts, counting description, sowing notes, height, ≥2 tags, plant notes — `assertions.ts`) is a display/quality signal; the new structured facts should feed that count, not the index rule. If the owner ever wants fact-rich zero-seller pages indexed, that is a change to decision 8, not to this schema.

## Gaps — where each fact will realistically come from

**Floret states it; sellers usually don't:**

- Vase life range (every sampled Floret page; almost no small-farm shop states one)
- Pinch instruction and height
- Harvest stage
- Plant spacing
- Ethylene sensitivity and cooler/handling notes
- Seed pre-treatment (pre-chilling stated in prose when it applies)

**Sellers state it; Floret doesn't:**

- Pollination (open-pollinated vs F1) — breeder and better seller pages only; expect `unknown` to stay common
- Protection / PVP statements
- Germination rate and seed-lot facts (regulated label data — listing-level, not variety facts)
- Sowing depth and days-to-germination numbers (some sellers)
- Packet sizes and seed counts — already modeled at listing level in v2 (`packetSizes`), correctly not a variety attribute

**Neither states it reliably** (so these stay NULL until a human or a crop guide sources them):

- Calendar bloom season — Floret gives days-to-maturity, sellers give the same; neither gives "blooms July–September," and deriving it is region-dependent guesswork
- Stem length as a clean number separate from height
- Flower size — prose-only at Floret ("as big as the palm of your hand" is not a measurement), absent at most sellers
- Hardiness zones — largely irrelevant for the annuals that dominate the catalog, and rarely stated by either source

**Population reality check on today's 68 varieties:** description 46, sowing notes 14, height 10, color swatch 14, and `color_family` / `pollination` / `days_to_bloom` at their defaults on all 68. The Floret pass is the one realistic source that fills most of the launch fields at catalog scale; seller crawling then fills `pollination` and `protection` variety by variety.

## Recommendation in one paragraph

Adopt the seven launch fields (`color_family` with the 12-family vocabulary above, `height_cm_min/max`, `days_to_bloom_min/max`, `life_cycle`, `sun_exposure`, `vase_life_days_min/max`, `pollination`), and instruct the Floret extraction to also capture the five structured-or-nearly-structured later fields while it is on each page (`spacing_cm`, `sowing_method`, `pinch`, `harvest_stage`, `dries_well`) so nobody has to re-crawl the Library to get them. Everything else waits for seller crawling or Phase 1.5.
