# seeds-v2-plant-media — design

Same architecture rules as the variety-media delta: repositories are the only Drizzle
importers; services shared by pages + API; Zod-validated output; migrations are plain SQL in
`migrations/` applied by wrangler, with `lib/db/schema.ts` kept in step.

## D1 — Migration 0004
```sql
ALTER TABLE media ADD COLUMN plant_id INTEGER REFERENCES plants(id);
CREATE INDEX media_plant_idx ON media(plant_id);
```
Plus `plantId: integer("plant_id").references(() => plants.id)` in the schema's media table
and the index in its index list. Fresh local setups and every test suite apply migrations from
empty, so 0004 must apply cleanly in sequence (0000–0003 exist; 0003 rebuilt plants — media is
untouched by it).

## D2 — Repository
In `lib/repositories/catalog-read.ts`, next to `listMediaForVariety`:
- `listMediaForPlant(db, plantId): Promise<MediaRow[]>` — same select/order, `plantId` filter.
- `listMediaForPlants(db, plantIds): Promise<Map<number, MediaRow[]>>` — chunked at ≤50 ids
  per query like `listVarietySummaryRows`' chunking; group rows by plant id, preserving id
  order within a plant.

## D3 — Validators + service
- Generalize `VarietyMediaSchema` to a shared media schema with optional `thumbUrl`
  (`z.string().min(1).optional()`). Keep `VarietyDetail.media` working (its entries simply
  never set `thumbUrl`). Name it cleanly (e.g. `MediaSchema`/`Media`) and re-export the old
  names if anything imports them.
- `CropListItemSchema` += `media: z.array(MediaSchema)` (required). Every constructor of a
  `CropListItem`/`CropDetail` (service, tests, fixtures) supplies it.
- Service mapping helper `toMedia(row, { thumbs: boolean })`: url = r2Key; when thumbs and
  url starts with `/artwork/crops/`, thumbUrl = url with `/thumbs` inserted after
  `/artwork/crops`. Variety mapping calls it with thumbs off; plant mapping with thumbs on.
- `listCrops`: after loading the page of crops, one bulk `listMediaForPlants` for their ids.
- `getCrop`: `listMediaForPlant` alongside its other loads.

## D4 — Components + pages
- New `components/crop/CropCardImage.tsx`: props `{ media, commonName }`; renders nothing
  when no media; otherwise the fixed-aspect wrapper + lazy `<img>` per R3. Used by both card
  render sites (home grid, /crop index) — if the two sites build their cards inline today,
  extract just the image block, not a whole card refactor.
- Crop page hero: reuse the variety pattern. Either generalize
  `components/variety/VarietyHeroImage.tsx` into a shared component (update imports + the
  guardrail's allowed set) or add `components/crop/CropHeroImage.tsx` with the same markup.
  Prefer whichever is smaller; the guardrail's allowed-file list must name the final files.
- `app/crop/[slug]/page.tsx` `generateMetadata`: media → `mediaOgImage(media[0].url, …)`,
  else the existing `ogImage("crop", …)`.

## D5 — Guardrail update
`tests/unit/guardrails.test.ts`: the allowed-`<img>` file set becomes the final component
file list (variety hero + crop image components); non-vacuity check updated to count all
allowed files. Remote-src bans unchanged.

## D6 — Acceptance mechanics
Mirror the variety Media section (scripts/acceptance.ts, platform proxy + `.dev.vars`
revalidate token). Differences: the row targets a plant (`plant_id` set, `variety_id` NULL);
revalidate tags `["plant:zinnia", "list:home", "list:plants"]`; assertions per R5. The
section skips its row-based checks against non-localhost bases, like the variety section.
Cleanup deletes the row and revalidates, in a `finally`.

## D7 — Docs
- README: extend the "Variety artwork" data-operations note to cover crop artwork
  (paths, thumbs convention, plant_id rows, re-import wipe applies to all media).
- PLANT-MEDIA-REPORT.md in the v2 root: files changed, the thumbUrl convention, verification
  item by item, divergences — and the production runbook for Hue: apply migration 0004
  remotely, deploy, insert one row per plant
  (`r2_key = '/artwork/crops/<slug>.webp'`), revalidate `plant:<slug>` + list tags,
  spot-check the grid.
