# Floret Library Names Import — Report (2026-11-16)

Import of the 565 Floret Library seed variety names (`~/workspace/seeds-hues/floret-library-names.json`,
extracted 2026-11-16, robots-permitted) into the production catalog, per Dustin's direction.
Additive: every pre-existing plant, variety, seller, listing, price-history and event row is
byte-identical after the import (the transfer replaced catalog tables with a superset built by
the project's own importer from the merged `seed-data/catalog.json`; ops/event tables untouched).

## Counts

| | |
|---|---|
| Source names | 565 (92 crops) |
| Matched existing varieties (not duplicated) | 14 — 12 by the project's `normalizeName`, 2 hand-reviewed (below) |
| New varieties created | 551 |
| New plants created | 74 (18 source crops reused an existing plant) |
| Final production totals | **93 plants / 619 varieties / 6 sellers / 17 listings** |
| Catalog version | 1 → **2** (`catalog_seq` 118 → 736) |
| Worker version | `65f0ac61-7482-40e3-877c-690499e56621` |

## How

- Merge script `scripts/import-floret-names.ts` (idempotent; dry-run by default, `--write` to
  append) merged the names into `seed-data/catalog.json`. Existing rows untouched; appends only.
- Variety display name = Library title minus its leading crop words (so the variety page reads
  e.g. "Albutt Blue" under Sweet Pea); accents preserved (`Crème Brûlée`). Bare crop titles
  (11) stay whole. Dahlia seed varieties use the existing `dahlia-seed-` slug prefix.
  0 slug collisions, 0 duplicates within crop.
- Crop → plant aliases where Floret's crop name differs from the catalog's: Bachelor's Button →
  Cornflower, Black-eyed Susan → Rudbeckia, Globe Amaranth → Gomphrena, Love-in-a-mist → Nigella.
- Provenance: three new `sources` rows (one per Floret collection page, exact URL,
  checked 2026-11-16, kind "catalog"): `src-floret-library`, `src-floret-library-p2`,
  `src-floret-library-p3`. Each new variety's `source_id` points at its extraction page.
  (The codebase has no `field_sources` table; `sources` + `varieties.source_id` is the machinery.)
- New varieties carry NO facts (all NULL/unknown per the explicit-unknowns rule), no listings,
  no notes → all 551 are `noindex, follow` and out of the sitemap by the canonical rule.
  Indexable count unchanged at 17.

## The Latin-name decision (schema change)

New crops have no sourced scientific name, and inventing one was not an option, but
`plants.latin_name` was `NOT NULL` in the DB schema, the importer schema, and the API
validators. Resolved by making Latin genuinely nullable end-to-end:

- Migration `migrations/0003_plants_latin_nullable.sql` (table rebuild in 0002's pattern).
- `lib/db/schema.ts`, `lib/catalog/input.ts`, `lib/validators/index.ts` (PlantRef + SyncCrop)
  → `latin_name` nullable.
- Every render path now omits the Latin segment when null (crop/variety/series pages, cards,
  OG images, llms.txt, search subtitles, FTS rebuild coalesce). Variety facts show UNKNOWN.
  This is why the Worker was redeployed as part of this import.

## Scale bugs found and fixed (the bigger catalog exposed them)

D1 caps a statement at 100 bound parameters; three sites bound unbounded id lists:

1. `lib/repositories/sync.ts` `namesFor` — chunked to 100 ids (was: sync changes at limit 1000
   threw `too many SQL variables`).
2. `lib/repositories/fts.ts` `searchVarieties` — the merged match set now honors the documented
   cap across tiers (tiers fill in priority order).
3. `lib/repositories/catalog-read.ts` `listVarietySummaryRows` — ids sets > 50 are fetched in
   chunks of 50 and merged with a comparator mirroring the SQL sort. (`/search?q=sweet+pea`
   returned 500 before this fix; an earlier `sql.raw` approach was reverted — the project's
   guardrail tests confine raw SQL to the FTS module, and the fix respects that.)

## Judgment calls (stated plainly)

- Manual matches (2): "Snapdragon Madame Butterfly Mix" → existing `snapdragon-madame-butterfly-mix`
  (existing name carries an "(F1)" qualifier normalization keeps); "Sweet Pea Castlewellan" →
  existing `sweet-pea-castle-wellan` (spacing only).
- NOT matched: "Sweet Pea Alison Valentini" vs existing "Alison" — the added surname word makes
  it a plausibly distinct cultivar, so it was created as its own variety.
- Production's `src-ingest-api` source row (created on demand by the ingest API, referenced by
  nothing) was wiped by the transfer and will be recreated on the next ingest call.
- Transfer used `PRAGMA defer_foreign_keys` so production's `catalog_publish` row and one
  deploy-era click-event row kept their references while catalog tables were replaced;
  click_events count unchanged (1), proving ops data was not touched.

## Verification

- Local: ESLint + tsc clean, **Vitest 137/137**, **acceptance 92/92** against a local preview.
- Backup before any production change: `seed-data/catalog.pre-floret-import.json` +
  `tmp/prod-backup-pre-floret-import.sql` (full production dump, 278 INSERTs).
- Production after publish: `/api/v1/catalog/version` = 2, seq 736;
  `/api/v1/sync/snapshot` = 93 crops / 619 varieties / 6 sellers / 17 listings, zero price fields;
  spot-checks — `/variety/sweet-pea-albutt-blue` (200, noindex/follow, absent from sitemap),
  `/variety/amaranth-coral-fountain` (200, new crop), `/crop/amaranth` (200, no Latin rendered,
  no visible "null" text on any checked page), `/variety/sweet-pea-kings-ransom` (200,
  index/follow — legacy indexable pages unchanged), sitemap holds exactly the 17 indexable
  variety URLs (152 total), `/search?q=sweet+pea` = 200 live, seller pages 200.
- Full acceptance was run locally, not against production (it mints keys and posts test
  reports); production was verified with the targeted checks above.

## Addendum — Amazon-model ruling (Dustin, 2026-11-16, after this import)

The ruling (every variety gets a public permanent page; farms may request a listing,
approval-gated; zero-seller varieties stay up in a "currently unavailable / no sellers yet"
state) was NOT applied to this import — the 551 new varieties entered under the current
decision-8 rule (noindex, out of sitemap). Two observations for the later delta:

1. **How a zero-seller page presents today** (verified live on `/variety/sweet-pea-albutt-blue`):
   the page is already public and permanent (HTTP 200, linked from its crop page and search);
   only its search-engine posture is closed (`noindex, follow`, absent from the sitemap). Title:
   "Albutt Blue Sweet Pea Seeds — Where to Buy (No Farm Listing Yet)". Answer line: "No small
   farm found selling Albutt Blue yet." The Where-to-buy block reads "No small farm found
   selling this yet. Browse all small-farm sellers or other sweet pea varieties. Know a farm
   that sells it? Tell us." (a report link), and the About paragraph ends "No seller in this
   directory lists it yet." Facts render as explicit unknowns (Colour family / Pollination /
   Height / Days to bloom "Unknown", Rating "Not yet rated").
2. **Indexable + unavailable state: code change, not data-only.** `indexable` is a stored
   column (so today's rows *could* be flipped by UPDATE + republish), but it is re-derived by
   `isIndexable()` in `lib/catalog/assertions.ts` on every import and every ingest publish —
   a data-only flip would be silently reverted by the next write. The durable change is that
   one rule function (plus its tests/assertions), after which a republish applies it. The
   unavailable state needs no schema change: the variety template already branches on zero
   listings, so formalizing the "currently unavailable / no sellers yet" wording is a small
   template edit. (The farm listing-*request* flow itself does not exist yet — new code.)
