# seeds-v2-plant-media — requirements

Owner order (Dustin, 2026-11-16), after seeing the live "Browse by crop" grid: "Each of these
cards need an illustration." Every crop (plant) gets one painterly illustration, shown on its
crop cards and as the header image on its crop page. This extends the variety-media capability
(`.kiro/specs/seeds-v2-media/`, MEDIA-REPORT.md) to plants. The variety mechanism is untouched.

Artwork itself is produced outside this build (93 original illustrations, one per plant, in
`~/workspace/seeds-hues/artwork-crops/`); Hue copies the files into `public/artwork/crops/`
plus thumbnails and inserts the production rows after this build verifies. This build delivers
the data model, read path, rendering, and tests — with the same local-fixture pattern the
variety-media acceptance used.

## R1 — Data model
- Migration `0004_media_plant.sql`: `ALTER TABLE media ADD COLUMN plant_id INTEGER
  REFERENCES plants(id);` + `CREATE INDEX media_plant_idx ON media(plant_id);`
  `lib/db/schema.ts` gains `plantId` on the media table. No other schema change.
- Storage convention (same as variety media): `media.r2_key` stores the public path.
  Plant heroes live at `/artwork/crops/<plant-slug>.webp`; card thumbnails at
  `/artwork/crops/thumbs/<plant-slug>.webp` (Hue generates the thumb files; the app only
  needs the URL convention in R2).
- The importer's full-replace wipe already deletes all `media` rows; plant media behaves the
  same (documented in README next to the variety artwork note). Seed data ships no media.

## R2 — Read path
- Repository: `listMediaForPlant(db, plantId)` and a bulk `listMediaForPlants(db, plantIds)`
  (chunk id lists the way the existing bulk loaders do — D1's 100-parameter cap), rows ordered
  by `id` ascending, same `MediaRow` shape as the variety read.
- Validators: plant media uses the same object shape as variety media plus an optional
  thumbnail: extend `VarietyMediaSchema` into a shared `MediaSchema`
  (`{ url, licence, credit, thumbUrl? }`) — keep the exported names/types working for the
  variety path (rename with re-export, or a second schema; typecheck is the arbiter).
  `thumbUrl` is populated by the service for plant media only, computed from the stored path:
  when `url` starts with `/artwork/crops/`, `thumbUrl` = the same path with `/thumbs`
  inserted (`/artwork/crops/thumbs/<file>`); otherwise `thumbUrl` is absent.
- `CropListItemSchema` gains required `media: Media[]` (default `[]` semantics as with
  varieties: always present, empty when no rows). `CropDetailSchema` inherits it.
  `listCrops` and `getCrop` in the service populate it. `GET /api/v1/crops`,
  `GET /api/v1/crops/{slug}` expose it additively; OpenAPI regenerates from Zod.
- The published snapshot allowlist is unchanged (media stays out, as with varieties).

## R3 — Rendering
- **Crop cards** (home "Browse by crop" grid in `app/page.tsx` and the `/crop` index in
  `app/crop/page.tsx`, plus anywhere else a `CropListItem` card renders): when the crop has
  media, the card shows the thumbnail image — `<img src={thumbUrl ?? url}>`,
  `alt="{commonName} — illustration"`, `width={480}` `height={960}`, `loading="lazy"`,
  inside a fixed-aspect wrapper (`aspect-[4/5]`, `object-cover`, full card width) so the grid
  has no layout shift. When a crop has no media, the card renders exactly as today
  (text/swatch only) — graceful degradation, no placeholder, no empty box.
- **Crop page** (`app/crop/[slug]/page.tsx`): when the crop has media, render a hero figure
  with the full-size image, mirroring the variety hero (alt `"{commonName} — illustration"`,
  `width={1120}` `height={2240}`, credit in a `<figcaption>`). Nothing renders without media.
- **OG image** for the crop page: the illustration when media exists (reuse `mediaOgImage`),
  otherwise the existing generated crop card.
- The `<img>` guardrail (tests/unit/guardrails.test.ts) is updated to allow the new
  component file(s) — extend its allowed-file set and its non-vacuity check; the hotlink bans
  are unchanged. Put card/hero images in component file(s) under `components/` (e.g.
  `components/crop/CropCardImage.tsx` / a shared hero component) so the guardrail's file list
  stays explicit. Do not weaken the guardrail to "any file may use <img>".

## R4 — Accessibility & performance
WCAG 2.2 AA: alt text as specified; card images lazy-load; fixed dimensions/aspect wrappers
prevent CLS; card grids load thumbnails (~480px wide), never the full-size heroes.

## R5 — Tests
- Integration: plant media rows seeded in the throwaway D1 → `getCrop` and `listCrops`
  return them (mapped, `thumbUrl` computed); a crop without rows returns `media: []`;
  variety media behaviour unchanged.
- Contract: `GET /api/v1/crops/{slug}` and `GET /api/v1/crops` include `media`; OpenAPI
  documents it.
- Acceptance: new "Plant media display" section mirroring the variety Media section —
  insert one plant media row for crop `zinnia` via the platform proxy
  (`r2_key = '/artwork/crops/zinnia.webp'`, test licence/credit), revalidate
  `["plant:zinnia", "list:home", "list:plants"]` with the `.dev.vars` token, then assert:
  home page HTML contains an img with src `/artwork/crops/thumbs/zinnia.webp` and alt
  "Zinnia — illustration"; `/crop` index likewise; `/crop/zinnia` contains the hero img
  `/artwork/crops/zinnia.webp` + figcaption; a no-media crop card/page (e.g. `yarrow`)
  contains no `/artwork/crops/` img; API crop detail carries the row. Clean up the row and
  revalidate again. (The binary files themselves land with Hue's publish; this section
  asserts markup + API, and the existing variety Media section already proves asset serving.)
- All pre-existing suites stay green (140 Vitest + full acceptance).

## Out of scope
Artwork production, thumbnail file generation, production rows, deployment (Hue, after this
build). No changes to the variety media path, seed data, or snapshot contents. No new
endpoints or bindings.
