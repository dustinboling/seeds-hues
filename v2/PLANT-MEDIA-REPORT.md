# PLANT-MEDIA-REPORT — seeds-v2-plant-media (crop artwork display)

Date: 2026-11-16. Spec: `.kiro/specs/seeds-v2-plant-media/{requirements,design,tasks}.md` under
`~/workspace/seeds-hues/SPEC-CANONICAL.md`, following the variety-media delta (MEDIA-REPORT.md).
All 9 tasks in `tasks.md` are checked.

Everything was verified locally only. Nothing was deployed. No remote Cloudflare resource, no
production data and no external site was touched, and no email was sent. Migration 0004 in
production, the artwork files, the production `media` rows and the deploy are left to Hue
(runbook at the end).

## Result

| Finish-line item | Status |
|---|---|
| `npm run verify` (ESLint + `tsc --noEmit` + Vitest) | **Green**: 8 files, **143 tests** (140 pre-existing + 3 new). The image guardrail was updated in place, not added. Log: `tmp/plant-media-verify.log` |
| Fresh local `npm run db:setup:local` | **Green**: migrations 0000–0004 applied from empty; 93 plants / 619 varieties / 6 sellers / 17 listings, 619 indexable, `media` 0, catalog version 1 published. Log: `tmp/plant-media-dbsetup.log` |
| `npm run cf:build` | **Green**. Log: `tmp/plant-media-cfbuild.log` |
| OpenNext preview | **Running** on `http://localhost:8787` (`npm run cf:preview`, log `tmp/plant-media-preview.log`) |
| `npm run acceptance -- --base http://localhost:8787` | **Green: 107/107** (99 pre-existing + 8 in the new "Plant media display" section). Report: `tmp/acceptance-plant-media.md`, log `tmp/acceptance-plant-media.log` |

After the acceptance run, the local D1 holds 0 `media` rows and 0 unrevoked API keys.

## What changed

### Files

| File | Change |
|---|---|
| `migrations/0004_media_plant.sql` (new) | `ALTER TABLE media ADD COLUMN plant_id integer REFERENCES plants(id)` + `CREATE INDEX media_plant_idx ON media(plant_id)`. Additive only; no table rebuild. |
| `migrations/meta/_journal.json` | Entry `idx 4`, tag `0004_media_plant` (same as 0003: journal entry, no drizzle snapshot file). |
| `lib/db/schema.ts` | `plantId: integer("plant_id").references(() => plants.id)` on `media`, plus `media_plant_idx` in its index list. |
| `lib/repositories/catalog-read.ts` | `listMediaForPlant(db, plantId)` (same select and `id` order as the variety read) and `listMediaForPlants(db, plantIds)` → `Map<plantId, MediaRow[]>`, de-duplicated ids queried in chunks of 50 (D1's 100-parameter cap), id order kept within a plant. Drizzle operators only. |
| `lib/validators/index.ts` | `VarietyMediaSchema` generalised to `MediaSchema` (`url`, `licence`, `credit`, optional `thumbUrl`; OpenAPI id `Media`). `VarietyMediaSchema` and the `VarietyMedia` type stay exported as aliases. `CropListItemSchema` gains required `media: z.array(MediaSchema)`; `CropDetailSchema` inherits it. |
| `lib/services/catalog.ts` | New exported `toMedia(row, { thumbs })` (D3). `getVariety` now maps through it with thumbs off, giving identical output. `listCrops` makes one bulk `listMediaForPlants` call for the page of crops. `getCrop` loads `listMediaForPlant` in the same `Promise.all` as its other loads. |
| `lib/api/openapi.ts` | `Media: V.MediaSchema` added to the component registry (see "Divergences"). |
| `components/crop/CropCardImage.tsx` (new) | Props `{ media, commonName }`. Renders nothing without media. Otherwise: `<div class="mb-2 aspect-[4/5] w-full overflow-hidden rounded-lg">` around `<img src={m.thumbUrl ?? m.url} alt="{commonName} — illustration" width=480 height=960 loading="lazy" decoding="async" class="block h-full w-full object-cover">`. Server Component, no JS. |
| `components/variety/VarietyHeroImage.tsx` | Reused for the crop hero (the smaller option in D4). Prop type is now `Media`; new optional `testId` prop (default `"variety-hero"`, so the variety markup is unchanged). |
| `app/page.tsx` | The home "Browse by crop" card renders `<CropCardImage>` above the name. |
| `app/crop/page.tsx` | The `/crop` index card renders `<CropCardImage>` above the heading. |
| `app/crop/[slug]/page.tsx` | Renders `<VarietyHeroImage media={c.media[0]} label={c.commonName} testId="crop-hero">` after the coverage line, before the intro. It renders nothing without media. `generateMetadata` uses `mediaOgImage(c.media[0].url, "<Common> seeds")` when media exists, otherwise the unchanged `ogImage("crop", …)`. |
| `lib/seo/metadata.ts` | Doc comment on `mediaOgImage` only ("variety or crop"). No code change. |
| `tests/unit/guardrails.test.ts` | Allowed-`<img>` set updated (D5), details below. |
| `tests/integration/data.test.ts` | New "plant media read path" test. |
| `tests/contract/api.test.ts` | Two new tests (crop API media; OpenAPI `Media` on `CropListItem`/`CropDetail`/`VarietyDetail`). One regex in the existing variety OpenAPI test widened (see "Divergences"). |
| `scripts/acceptance.ts` | New "Plant media display" section. `revalidateVariety` is now a wrapper over a new `revalidateTags`. `--skip-media` skips the row checks of both media sections. |
| `README.md` | Hard-rule line says "variety and crop illustrations". New "Crop artwork" note under Data operations: paths, the thumbs convention, the `plant_id` row SQL, revalidate tags, and the re-import wipe. |
| `.kiro/specs/seeds-v2-plant-media/tasks.md` | All boxes checked. |
| `public/sw.js` | Regenerated by `scripts/build-sw.mjs` during `cf:build`, as on every build. Not hand-edited. |

### Routes

There are no new routes, endpoints, bindings or buckets. Seed data, the snapshot allowlist and `/sync` are unchanged.

- `/` and `/crop`: a crop card shows its thumbnail when the crop has media. Crops without media render exactly as before.
- `/crop/{slug}` shows the hero figure with a credit caption, and points the OG/Twitter image at the illustration, when the crop has media.
- `GET /api/v1/crops` and `GET /api/v1/crops/{slug}` gain `media: [{url, licence, credit, thumbUrl?}]`. The field is always present (`[]` when there are no rows). This is an additive v1 change.
- `GET /api/v1/varieties/{slug}`: wire output unchanged (variety entries never carry `thumbUrl`).
- `/api/v1/openapi.json`: new `Media` component. `CropListItem.media`, `CropDetail.media` and `VarietyDetail.media` are all required arrays of `$ref: Media`.

## The thumbUrl convention

The stored value is the same as for varieties: `media.r2_key` holds the public path of the full-size
hero, for example `/artwork/crops/zinnia.webp`. The service derives the thumbnail URL from it
(`toMedia` in `lib/services/catalog.ts`). The app never generates or checks image files.

- **Crop media** (`thumbs: true`). If `url` starts with `/artwork/crops/`, then `thumbUrl` is the same path with `thumbs/` inserted after `/artwork/crops/`. For example, `/artwork/crops/zinnia.webp` gives `/artwork/crops/thumbs/zinnia.webp`. Any other `url` gets no `thumbUrl` (the key is absent, not null), and the card falls back to the full-size `url`.
- **Variety media** (`thumbs: false`) never gets a `thumbUrl`, whatever the path.
- **Consequence for publishing:** a crop row only works when both files are deployed under the same filename, `public/artwork/crops/<slug>.webp` (hero) and `public/artwork/crops/thumbs/<slug>.webp` (thumb, ~480 px wide). If the thumb is missing, the card shows a broken image. It does not fall back to the hero.
- **Which row is used:** the first row by `media.id` is the card thumbnail, the crop page hero and the OG image. The API returns all rows.

## Guardrail update (D5)

The test is still called "no hotlinked images, no remote image config (local /artwork/
illustrations allowed)". These parts are unchanged:
- the remote/protocol-relative `<img src>` ban;
- the remote CSS `url()` ban;
- the `next.config.ts` remote-image-config ban.

The allowed-file part is now an explicit map from file to its required `src` expression:

| Allowed file | Required `src` |
|---|---|
| `components/variety/VarietyHeroImage.tsx` | `src={media.url}` |
| `components/crop/CropCardImage.tsx` | `src={m.thumbUrl ?? m.url}` |

It asserts:
- no other `.tsx`/`.css` file under `app/`, `components/` or `lib/` contains `<img`;
- each allowed file contains exactly one `<img` and exactly one `src=`, counted with comments stripped (the files' explanatory comments mention `<img>`);
- the scanner sees an `<img>` in every allowed file (non-vacuity, `toHaveLength(allowed.length)`).

There is no blanket allowance. A third file that uses `<img>` fails the test until it is named in
the map. No other guardrail was touched; the price guardrails are unchanged.

## Verification, item by item

**Task 1, migration.**
- *Upgrade path.* The first `db:setup:local` ran against the existing local state, which already had 0000–0003. Wrangler applied only `0004_media_plant.sql` ("3 commands executed successfully") onto the populated database, the way production will receive it. Log: `tmp/plant-media-dbsetup-upgrade.log`.
- *Fresh setup.* I then moved that state aside (not deleted) to `/tmp/seeds-v2-wrangler-state-pre-plant-media-1794864424` and ran a fresh setup: 0000→0004 all ✅, and import plus publish succeeded.
- *Schema check.* `pragma_table_info('media')` lists `plant_id`, and the indexes are `media_variety_idx`, `media_seller_idx` and `media_plant_idx`.
- *Test suites.* Every throwaway D1 in the suites applies 0000–0004 from empty.

**Tasks 2–3, read path.** `tsc --noEmit` is clean. `media` is required on `CropListItem`, so a crop constructor without it fails the typecheck. The only constructor is `cropListItem()` in the service; no test fixture builds a `CropListItem`.

**Task 7, integration test** (`data.test.ts`, throwaway Miniflare D1):
- Before any insert, all 93 crops from `listCrops` have `media: []`, and so does `getCrop("zinnia")`.
- The test inserts two zinnia rows (`/artwork/crops/zinnia.webp`, and `/artwork/zinnia-alt.webp` outside the crops folder), one row for the alphabetically first crop, and one variety row on `zinnia-queen-lime-blush`.
- `getCrop("zinnia")` returns both rows in id order. The first has `thumbUrl: "/artwork/crops/thumbs/zinnia.webp"`; the second has no `thumbUrl` key.
- `listCrops` returns the same arrays for zinnia (last crop) and for the first crop. With 93 ids, that covers both chunks of the bulk loader (50 + 43). Exactly those two crops have media; `yarrow` has `[]`.
- Variety media is unchanged: `zinnia-queen-lime-blush` returns only its own row, without `thumbUrl`, and `zinnia-dearest-bubblegum` returns `[]`. Plant rows never appear on varieties, and variety rows never appear on crops.
- The sync snapshot contains no `/artwork/` string.
- After cleanup, `getCrop("zinnia").media` is `[]`.

**Task 7, contract tests** (`api.test.ts`):
- `GET /crops/zinnia` and `GET /crops?limit=100` return `[]` before the insert and `[{url, thumbUrl, licence, credit}]` after it.
- The responses pass `CropDetailSchema`/`CropListItemSchema`, and the detail deep-equals the service output.
- `yarrow` returns `[]` in both endpoints.
- In OpenAPI, `CropListItem`, `CropDetail` and `VarietyDetail` each list `media` as a required property of type `array` of `$ref #/components/schemas/Media`. `Media` has properties `credit, licence, thumbUrl, url` and requires exactly `credit, licence, url`.
- The existing "every $ref resolves" test passes.

**Task 8, acceptance "Plant media display"** against the local preview, all passing:
1. While plant media is empty, none of the 734 crawled pages, nor `/`, `/crop` or `/crop/zinnia`, renders an `/artwork/crops/` img, and `GET /api/v1/crops/zinnia` returns `media: []`.
2. The section inserts one row into the **local** D1 through the platform proxy: `plant_id` = zinnia, `variety_id` NULL, `r2_key = '/artwork/crops/zinnia.webp'`, with a test licence and a run-unique credit. It then revalidates `["crop:zinnia","list:home","list:crop"]` with the `.dev.vars` token, which returns 200. (These tags differ from the spec; see "Divergences".)
3. The API crop detail and the crop list carry the row with `thumbUrl` `/artwork/crops/thumbs/zinnia.webp`. Exactly one crop has media, and `yarrow` returns `[]`.
4. `/` and `/crop` each contain, inside the zinnia card:
   - `<img src="/artwork/crops/thumbs/zinnia.webp">` with alt `Zinnia — illustration`, `width="480" height="960"` and `loading="lazy"`;
   - the `aspect-[4/5]` wrapper.

   Each page also meets these conditions:
   - it never references the full-size hero;
   - the yarrow card has no `<img>`;
   - it holds exactly one `<img>` in total.

   Both rendered correctly on the first fetch.
5. `/crop/zinnia` contains:
   - `<img src="/artwork/crops/zinnia.webp">` with alt `Zinnia — illustration`, `width="1120" height="2240"` and `loading="eager"`;
   - the `crop-hero` figure, with a `<figcaption>` carrying the credit;
   - `og:image` set to `https://seeds.hues.flowers/artwork/crops/zinnia.webp`, with width 1120, height 2240 and type `image/webp`;
   - a matching `twitter:image`.

   The fresh render arrived on the first fetch.
6. `/crop/yarrow` has no `/artwork/crops/` img and no figcaption, and its `og:image` is still `/og/crop/yarrow`.
7. Cleanup deletes the row (1 row) and revalidates again. On the first fetch, `/`, `/crop` and `/crop/zinnia` no longer contain the image, and the API returns `media: []`. Cleanup runs in a `finally` block.

The variety "Media display" section (7 checks) and every other pre-existing section still pass.

**R4, accessibility and performance.**
- Card images:
  - alt text `"{commonName} — illustration"`;
  - lazy loading with `decoding="async"`;
  - a fixed `aspect-[4/5]` wrapper, so the grid reserves space before the file arrives;
  - the thumbnail URL, never the hero, in both grids.
- The hero uses the variety pattern unchanged: eager loading, high fetch priority, fixed width/height and the credit as visible text.
- No client JavaScript was added.

## Divergences and fallbacks, stated plainly

- **Revalidate tags.** The spec (R5/D6/D7) says to revalidate `["plant:zinnia", "list:home", "list:plants"]`. The existing internal `/api/revalidate` route only accepts tags matching `(variety|seller|crop|series):<slug>` or `list:(home|variety|seller|crop)`, so `plant:zinnia` and `list:plants` would get a 400.
  - I used the existing taxonomy's equivalents: `crop:zinnia` (paths `/crop/zinnia`, `/crop`, `/sitemap.xml`), `list:home` (`/`) and `list:crop` (`/crop`).
  - I did not widen the route's tag pattern. That would change an internal endpoint, which the spec puts out of scope, and the existing tags already cover every page that shows crop media.
  - The runbook below uses the working tags.
- **Crop artwork dimensions do not all match the fixed 1120×2240.** The spec fixes the hero at `width=1120 height=2240` and the OG image at 1120×2240, and that is what was built. I read the WebP headers of the 94 files in `~/workspace/seeds-hues/artwork-crops/` (read locally, not modified): 55 are 1120×2240, and 39 are other sizes (for example 14 at 1280×1920 and one at 1600×1600).
  - *Page rendering.* The hero uses `h-auto`, so the image still displays at its true ratio once it loads. For those 39 crops, the space reserved before loading is 1:2, so there is a small layout shift when the file arrives.
  - *Share metadata.* `og:image:width`/`height` would state 1120×2240 for those files, which is wrong.
  - *Cards.* Thumbnails are unaffected, because the 4:5 `object-cover` wrapper crops them.
  - *Options.* Before publishing, either resize or pad those 39 heroes to 1120×2240 (no code change), or accept the shift and wrong OG dimensions. A per-row width/height would be a separate follow-up delta.
- **Artwork set vs catalog.** All 93 plant slugs in `seed-data/catalog.json` have a matching `<slug>.webp` in `artwork-crops/`. The folder also holds `black-eyed-susan.webp`, which matches no plant slug, so a join on `plants.slug` will skip it. I found no thumbnail files there, and per spec Hue generates them.
- **OpenAPI component rename.** Sharing one schema between crops and varieties made Zod hoist it into an unresolvable `__shared#/$defs/Media` reference. This broke the existing "every $ref resolves" test. The fix was to register `Media` as a named component.
  - As a result, `VarietyDetail.media` is now `$ref: Media` instead of an inline object. The JSON returned by the API is unchanged.
  - I widened one regex in the existing variety OpenAPI test from `/VarietyMedia|"url"/` to `/\/Media"|VarietyMedia|"url"/` to accept the `$ref`. Its intent (media is documented on `VarietyDetail`) is unchanged, and the new test asserts the exact `$ref` and the `Media` fields.
- **Crop hero component.** I reused `VarietyHeroImage` rather than adding `CropHeroImage`, because D4 says to prefer the smaller option. Despite its name, the component now serves both pages; the crop page passes `testId="crop-hero"`.
- **OG alt text.** I followed the variety page's pattern: the share image alt is the same text as the generated card's (`"Zinnia seeds"`). The on-page `<img>` alt is `"Zinnia — illustration"` as specified.
- **Alt uses the full `commonName`.** Crops named with a slash, such as `"X / Y"`, get the full name in the alt (`"X / Y — illustration"`), as R3 specifies, while the home card's visible label uses the short name. Zinnia is the same either way.
- **Unchanged from the variety delta:**
  - `url` is not restricted to `/artwork/` in the schema (D3 fixes it as `z.string().min(1)`). The runbook is the safeguard: `r2_key` must be an `/artwork/crops/…` path.
  - `/artwork/*` is cached immutable for a year. The existing `_headers` block also covers `/artwork/crops/` and `/artwork/crops/thumbs/`. Never overwrite a file; ship a new name and update `r2_key`. A renamed hero needs a thumb of the same new name.
  - The service worker was not changed, so crop images are not precached for offline use.
- **Acceptance scope.** The binary files are not in the tree, so `/artwork/crops/*` returns 404 locally. The section asserts markup and API only, as R5 specifies. Asset serving is already proven by the variety section's `/artwork/zinnia-queen-lime-blush.webp` check. Against a non-localhost base, the section runs only its read-only first check.
- **Local environment.** The previous local Wrangler state was moved, not deleted, to `/tmp/seeds-v2-wrangler-state-pre-plant-media-1794864424`. `.dev.vars` was already present from the variety delta and was reused. Logs are in `tmp/plant-media-*.log` and `tmp/acceptance-plant-media.{log,md}`. The preview is still running (`wrangler dev` under `npm run cf:preview`, port 8787).

## Runbook for Hue (production; not run by this build)

1. **Back up production D1** as usual before the migration. Per the README, D1 Time Travel is the backup: note a timestamp or bookmark with `wrangler d1 time-travel info seeds-hues`.
2. **Apply migration 0004 remotely** with the README's deploy command, `wrangler d1 migrations apply DB --remote`. Add `--config wrangler.remote.jsonc` if that is the config that holds the real `database_id`. The listed pending migrations must be only `0004_media_plant.sql`. The migration is additive (one `ADD COLUMN` and one index), and existing variety media rows keep `plant_id` NULL. Check with `SELECT name FROM pragma_table_info('media') WHERE name = 'plant_id';`.
3. **Add the artwork files** to the tree, under the same filename for each crop:
   - heroes: `~/workspace/seeds-hues/artwork-crops/<slug>.webp` → `public/artwork/crops/<slug>.webp`;
   - thumbnails (~480 px wide): `public/artwork/crops/thumbs/<slug>.webp`.

   First decide about the 39 heroes that are not 1120×2240 (see "Divergences"). Skip `black-eyed-susan.webp` unless a plant with that slug exists.
4. **Build and deploy** (`npm run cf:build`, then the usual deploy). Spot-check that `https://seeds.hues.flowers/artwork/crops/zinnia.webp` and `/artwork/crops/thumbs/zinnia.webp` return 200 `image/webp` with `immutable`. With the code deployed but no rows yet, every crop renders exactly as today.
5. **Insert one row per crop** whose files are deployed. Licence and credit wording is the owner's call; the placeholders below are not decisions. `artwork-crops/SOURCES-batch*.md` describe the references used.

   ```sql
   INSERT INTO media (plant_id, r2_key, licence, credit, created_at)
   SELECT p.id, '/artwork/crops/' || p.slug || '.webp', '<licence>', '<credit line>', strftime('%Y-%m-%dT%H:%M:%fZ','now')
   FROM plants p
   WHERE p.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM media m WHERE m.plant_id = p.id);
   -- expect 93 rows (one per live plant); check:
   -- SELECT count(*) FROM media WHERE plant_id IS NOT NULL;
   -- SELECT p.slug, m.r2_key FROM media m JOIN plants p ON p.id = m.plant_id ORDER BY p.slug;
   ```
   To publish a subset, add `AND p.slug IN ('zinnia', …)`. Insert only rows whose hero and thumb are both deployed, or the card shows a broken image.
6. **Revalidate** (POST `/api/revalidate` with the production token) using the existing tag names: `{"tags":["list:home","list:crop","crop:<slug>", …]}`, one `crop:<slug>` per crop. The body accepts up to 200 tags, so all 93 fit in one request. Do not use `plant:<slug>` or `list:plants`, which the route rejects with 400.
7. **Spot-check:**
   - the home "Browse by crop" grid and `/crop` show thumbnails, loaded from `/artwork/crops/thumbs/`;
   - `/crop/zinnia` shows the hero, the credit caption and an `og:image` pointing at the illustration;
   - `GET /api/v1/crops/zinnia` returns `media[0].thumbUrl = "/artwork/crops/thumbs/zinnia.webp"`.
8. **No snapshot republish is needed.** Media is not in the snapshot, and nothing bumps `catalog_seq`. API ETags are content hashes, so they change with the media.
9. **Re-import caveat.** A full catalog re-import wipes all `media` rows, crop and variety alike, so re-run step 5 and the variety runbook's insert after any re-import.
