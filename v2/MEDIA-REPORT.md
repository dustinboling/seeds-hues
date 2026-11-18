# MEDIA-REPORT — seeds-v2-media (variety artwork display)

Date: 2026-11-16. Spec: `.kiro/specs/seeds-v2-media/{requirements,design,tasks}.md` under
`~/workspace/seeds-hues/SPEC-CANONICAL.md`. All 9 tasks in `tasks.md` are checked.

Everything was verified locally only. Nothing was deployed. No remote Cloudflare resource, no
production data and no external site was touched, and no email was sent. Production `media`
rows and the deploy are left to Hue (runbook at the end).

## Result

| Finish-line item | Status |
|---|---|
| `npm run verify` (ESLint + `tsc --noEmit` + Vitest) | **Green**: 8 files, **140 tests** (137 pre-existing + 3 new; the image guardrail was rewritten in place, not added) |
| Fresh local `npm run db:setup:local` | **Green**: 93 plants / 619 varieties / 6 sellers / 17 listings, 619 indexable, `media` 0, snapshot v1 published |
| `npm run cf:build` | **Green**; `.open-next/assets/artwork/` holds the six files, checksums identical to `public/artwork/` |
| OpenNext preview | **Running** on `http://localhost:8787` (`npm run cf:preview`, log `tmp/media-preview.log`) |
| `npm run acceptance -- --base http://localhost:8787` | **Green: 99/99** (92 pre-existing + 7 in the new "Media display" section). Report: `tmp/acceptance-media.md` |

After the acceptance run, the local D1 holds 0 `media` rows and 0 unrevoked API keys.

## What changed

### Files

| File | Change |
|---|---|
| `public/artwork/*.webp` (6 files, new) | Copied byte-identical from `~/workspace/seeds-hues/artwork-pilot/`, filenames unchanged. All six are 1120×2240 (read from the VP8X header). |
| `public/_headers` | New `/artwork/*` block: `Cache-Control: public, max-age=31536000, immutable`, same shape as the `/_next/static/*` block. |
| `lib/repositories/catalog-read.ts` | `MediaRow` + `listMediaForVariety(db, varietyId)`: selects `r2Key, licence, credit` from `media` where `variety_id = ?`, ordered by `id` ascending. Drizzle operators only. |
| `lib/validators/index.ts` | `VarietyMediaSchema` (`url`, `licence`, `credit`, all `z.string().min(1)`, OpenAPI id `VarietyMedia`); required `media: z.array(VarietyMediaSchema)` on `VarietyDetailSchema`; `VarietyMedia` type. |
| `lib/services/catalog.ts` | `getVariety` loads media alongside tags, listings and the summary (same `Promise.all`), then maps `{ url: r2Key, licence, credit }`. No rows gives `[]`. |
| `components/variety/VarietyHeroImage.tsx` (new) | `<figure>` + plain `<img>` (`src` = media url, alt `"{label} — illustration"`, `width=1120 height=2240`, `loading="eager" fetchPriority="high" decoding="async"`, classes `card block h-auto w-full max-w-[380px]`) + `<figcaption>` with the credit in `text-sm text-muted`. |
| `app/variety/[slug]/page.tsx` | Renders the hero for `v.media[0]` between the header (eyebrow, title, answer sentence) and "Where to buy". It renders nothing when there is no media. `generateMetadata` uses `mediaOgImage(...)` when media exists, otherwise the unchanged `ogImage("variety", …)`. |
| `lib/seo/metadata.ts` | Named `OgImage` interface; `ogImage()` returns it; new `mediaOgImage(path, alt)` → `{ url: SITE_URL + path, width: 1120, height: 2240, alt, type: "image/webp" }`; `pageMetadata` takes `og?: OgImage`. No casts. |
| `tests/unit/guardrails.test.ts` | One test rewritten (D6), details below. Every other guardrail is untouched. |
| `tests/unit/seo.test.ts` | The `VarietyDetail` fixture gains `media: []`. This is the only other `VarietyDetail` constructor; no sync shape embeds a variety detail. |
| `tests/integration/data.test.ts` | New "variety media read path" test. |
| `tests/contract/api.test.ts` | Two new tests: the API `media` array, and the OpenAPI field. |
| `scripts/acceptance.ts` | New "Media display" section, plus a `--skip-media` flag. |
| `README.md` | Hard-rule line rewritten per R5; new "Variety artwork" note under Data operations. |
| `.kiro/specs/seeds-v2-media/tasks.md` | All boxes checked. |

### Routes

There are no new routes, endpoints, bindings, buckets or migrations, and seed data is unchanged.

- `/artwork/<file>.webp` is served by the existing ASSETS binding (`image/webp`, immutable cache).
- `/variety/{slug}` shows the hero figure and points the OG/Twitter image at the illustration when the variety has media.
- `GET /api/v1/varieties/{slug}` gains `media: [{url, licence, credit}]`, which is always present (`[]` when there are no rows). This is an additive v1 change.
- `/api/v1/openapi.json` documents `VarietyDetail.media` (required) and the `VarietyMedia` component. It is generated from Zod, so `/api-docs` needed no hand edit.

## Storage convention: `media.r2_key` holds the public path

For own-work artwork served from the app's public assets, `media.r2_key` stores the **public
path**, for example `/artwork/zinnia-queen-lime-blush.webp`. The service passes it through to
`url` unchanged. This follows design D2/D3. The column name is historical and was not migrated.

Why this choice:
- The files ship with the Worker's static assets, so no R2 object and no new route exist to resolve a key against.
- The stored value is exactly what the page and the API return, so there is no key-to-URL mapping to keep in sync.
- Media that really lives in R2 later can use a different `r2_key` shape, with a mapping added in the service at that point.

Consequences that Hue needs to know:
- An artwork file only exists in production after a deploy, because it is part of the Worker's static assets.
- `/artwork/*` is cached immutable for a year. To replace an illustration, ship a new filename and `UPDATE` the row's `r2_key`. Never overwrite a file in place.
- The first row by `media.id` is the hero and the OG image. The API returns all rows.
- `media` stays out of the published snapshot (allowlist unchanged, as before) and out of `/sync`.
- A full catalog re-import wipes `media`. The importer's "media must ship empty" assertion stays, so rows must be re-inserted after any re-import.

## Guardrail rewrite (D6)

The old test was "no hotlinked or raster `<img>` content, no remote image config". It is now
**"no hotlinked images, no remote image config (local /artwork/ illustrations allowed)"**. It
scans every `.tsx`/`.css` file under `app/`, `components/` and `lib/` and asserts:

- No `<img>` has a remote or protocol-relative `src`, whether written as a string, a `{"…"}` expression or a template literal (`<img\b[^>]*\bsrc=\{?\s*["'\`](https?:)?\/\/`).
- No CSS `url()` points at a remote or protocol-relative URL.
- `next.config.ts` has no `remotePatterns`, `domains:` or `images:` config.
- `<img>` appears only in `components/variety/VarietyHeroImage.tsx`, and that file's `src` is `{media.url}`.
- A non-vacuity check confirms the scanner sees that one allowed `<img>`.

The old blanket ban on importing `next/image` is gone. Requirement R5 asks only to forbid
*remote* `next/image` config, and the remote-config check covers that. I checked the regexes
against hotlink samples (`https://`, `http://` in braces, template literal, `//cdn…`, remote
`url()`): all are caught, and `/artwork/…` and `{media.url}` pass.

## Verification, item by item

**Task 1, assets.** I ran `sha256sum` on all six files in `artwork-pilot/` and in `public/artwork/`, and the two lists match exactly. The files are also identical in `.open-next/assets/artwork/` after `cf:build`.

| File | sha256 |
|---|---|
| celosia-flamingo-feather.webp | `ede4c8f7fd5be6fdb32b4f1c703cd9a9627de4a50db360ff0444e508a58f3292` |
| cosmos-cupcakes-blush.webp | `07c0a3ea7dd5ab7f4f9deec9fc5716ade514cba546a35d53bf7f009c8fc98736` |
| dahlia-shooting-stars.webp | `4021ecc31ca7decfb3a93bfa937550ac0fcad44db6b861bcd7fdde48a25b381b` |
| sunflower-procut-white-lite.webp | `d69444dbdc939cfca414d15475a602b4fb7f125b2e7b3df9f087294153051bc2` |
| sweet-pea-charlies-angel.webp | `501dcfc116d9358cbfb8a9d25c3572028845167e8fa71fe66bc61d2357bc914e` |
| zinnia-queen-lime-blush.webp | `51cb04533b814cdd5fdce41b6d524eb0ccac121272374b9ef6da6df874ae28a1` |

**Tasks 2–3, read path.** `tsc --noEmit` is clean. The schema field is required rather than optional, so any `VarietyDetail` built without `media` fails the typecheck.

**Task 7, integration test** (`data.test.ts`, throwaway Miniflare D1):
- Before any insert, `getVariety` returns `media: []` for `zinnia-queen-lime-blush` and for `sweet-pea-albutt-blue`.
- After inserting two rows, it returns both, mapped and in id order. The other variety still returns `[]`.
- The sync snapshot contains no `/artwork/` string.
- After the rows are deleted, it returns `[]` again.

**Task 7, contract tests** (`api.test.ts`):
- `GET /api/v1/varieties/zinnia-queen-lime-blush` returns `[]` before the insert and the mapped row after it. The response passes `VarietyDetailSchema` and deep-equals the service output.
- `sweet-pea-albutt-blue` returns `[]`.
- The OpenAPI `VarietyDetail` has `media` as a property and lists it in `required`.

**Task 8, acceptance "Media display"** against the local preview, all passing:
1. None of the 734 crawled pages has a remote `<img>` or an `/artwork/` hero while `media` is empty.
2. `GET /artwork/zinnia-queen-lime-blush.webp` returns 200 `image/webp`, 376,850 bytes, a WebP header of 1120×2240, and `Cache-Control: public, max-age=31536000, immutable`.
3. The section inserts one `media` row into the **local** D1 through the platform proxy (`scripts/lib/platform.ts`, the same mechanism `create-api-key.ts` uses). It then POSTs `/api/revalidate` with `tags: ["variety:zinnia-queen-lime-blush"]`, using the `.dev.vars` token.
4. The API detail carries the row, and `sweet-pea-albutt-blue` returns `media: []`.
5. The variety page HTML contains:
   - `<img src="/artwork/zinnia-queen-lime-blush.webp">` with alt `Queen Lime Blush Zinnia — illustration`, `width="1120" height="2240"` and `loading="eager"`;
   - a `<figcaption>` carrying the credit;
   - `og:image` set to `https://seeds.hues.flowers/artwork/zinnia-queen-lime-blush.webp`, with `og:image:width` 1120, `og:image:height` 2240 and `og:image:type` `image/webp`;
   - a matching `twitter:image`.

   The fresh render arrived on the **first** fetch after revalidation.
6. The `sweet-pea-albutt-blue` page has no `/artwork/` img and no figcaption, and its `og:image` is still `/og/variety/sweet-pea-albutt-blue`.
7. Cleanup deletes the row (1 row), revalidates again, and confirms both that the page no longer has the hero (first fetch) and that the API returns `media: []`. Cleanup runs in a `finally` block, so it also runs if an earlier media check fails.

The ISR fallback that R7 allows for was not needed. The page-HTML assertion is made directly and was reliable under the local preview.

**R6, accessibility and performance.**
- Alt text names the variety and crop, and the credit is visible text.
- Fixed `width`/`height` attributes together with `h-auto` give the browser the aspect ratio up front, so there is no layout shift.
- The hero loads eagerly with high fetch priority.
- No JavaScript was added: the component is a Server Component with no `"use client"`.
- The hero file is the only added weight, between 231 and 377 KB depending on the variety.

## Divergences and fallbacks, stated plainly

- **Repository signature.** Design D2 writes `listMediaForVariety(varietyId)`. I wrote `listMediaForVariety(db, varietyId)` because every function in `catalog-read.ts` takes `db` first. Its behaviour matches D2.
- **`_headers`.**
  - I added the immutable block because it was a one-block, low-risk addition in the file's existing pattern (D1).
  - The filenames are not content-hashed, so this is only safe if files are never overwritten. README and this report say so.
  - The block does not repeat `X-Content-Type-Options: nosniff`, because the `/*` block already sets it. A first build that repeated it produced a duplicated header in the preview.
- **`url` is not restricted to `/artwork/`.** `VarietyMediaSchema.url` is `z.string().min(1)`, exactly as D3 specifies. The hotlink guardrail scans source code, not data. A production row whose `r2_key` was an `https://…` URL would therefore render as a remote image. The safeguard is the runbook: `r2_key` must be an `/artwork/…` path. Tightening the schema would be a one-line follow-up if wanted. I did not make it because D3 fixes the schema and future R2-keyed media may need a different shape.
- **OG image aspect.** As R4/D5 specify, the share image is the 1120×2240 portrait file. Twitter's `summary_large_image` and Facebook prefer roughly 1.91:1 landscape, so they will crop or letterbox the portrait. The generated 1200×630 card is still used for every variety without media.
- **Service worker.** I did not change it. `/artwork/` files are not precached and take the service worker's default (non-static) path, so an illustration is not guaranteed to show offline. The rest of the page's offline behaviour is unchanged.
- **The Media acceptance section only runs against a local base.** It writes to the local D1, so against a non-`localhost` base (for example production) it skips the row-based checks and runs only the hotlink and asset checks. `--skip-media` skips the row checks locally too.
- **Local environment.**
  - Before the fresh setup, I moved the previous local Wrangler state (not deleted) to `/tmp/seeds-v2-wrangler-state-pre-media-1794861953`.
  - I created `.dev.vars` from `.dev.vars.example` (the documented local setup, gitignored, value `change-me-local-only`). The running preview and the acceptance revalidation use it.
  - Logs are in `tmp/` (`acceptance-media.log`, `acceptance-media.md`, `media-preview.log`).
- **Dahlia slug.** The file is `dahlia-shooting-stars.webp`, but the variety slug is `dahlia-seed-shooting-stars` (the catalog's dahlia-from-seed prefix). This needs no code change because the row stores the path, but the production SQL must use the real slug. The runbook below does.

## Runbook for Hue (production; not run by this build)

1. Deploy the build so `/artwork/*.webp` exists in production (`npm run cf:build`, then the usual deploy). Check `https://seeds.hues.flowers/artwork/zinnia-queen-lime-blush.webp` returns 200 `image/webp`.
2. Insert the six rows against production D1, after backing up as usual. Licence and credit text is the owner's call. The pilot notes (`artwork-pilot/SOURCES.md`) describe these as original illustrations made from reference photos used for colour and form only, two of them Floret Library product photos. Word the licence and credit with that in mind. The placeholders below are not decisions.

   ```sql
   INSERT INTO media (variety_id, r2_key, licence, credit, created_at)
   SELECT v.id, m.path, '<licence>', '<credit line>', strftime('%Y-%m-%dT%H:%M:%fZ','now')
   FROM (SELECT 'sweet-pea-charlies-angel' slug, '/artwork/sweet-pea-charlies-angel.webp' path
         UNION ALL SELECT 'zinnia-queen-lime-blush', '/artwork/zinnia-queen-lime-blush.webp'
         UNION ALL SELECT 'celosia-flamingo-feather', '/artwork/celosia-flamingo-feather.webp'
         UNION ALL SELECT 'cosmos-cupcakes-blush', '/artwork/cosmos-cupcakes-blush.webp'
         UNION ALL SELECT 'sunflower-procut-white-lite', '/artwork/sunflower-procut-white-lite.webp'
         UNION ALL SELECT 'dahlia-seed-shooting-stars', '/artwork/dahlia-shooting-stars.webp') m
   JOIN varieties v ON v.slug = m.slug;
   -- expect 6 rows; check: SELECT v.slug, m.r2_key FROM media m JOIN varieties v ON v.id = m.variety_id;
   ```
3. Revalidate the six variety tags:
   `{"tags":["variety:sweet-pea-charlies-angel","variety:zinnia-queen-lime-blush","variety:celosia-flamingo-feather","variety:cosmos-cupcakes-blush","variety:sunflower-procut-white-lite","variety:dahlia-seed-shooting-stars"]}`.
4. Spot-check each page for the hero, the alt text, the credit and the `og:image`. Each one should also appear in `GET /api/v1/varieties/{slug}`.
5. A snapshot republish is not needed for media, because media is not in the snapshot. Nothing bumps `catalog_seq`. API ETags are content hashes, so the detail ETag changes when its media changes.
