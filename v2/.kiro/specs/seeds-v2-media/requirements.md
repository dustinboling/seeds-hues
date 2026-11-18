# seeds-v2-media — requirements

Owner order (Dustin, 2026-11-16): "Publish and send me links" — the six approved pilot
illustrations must appear on their variety pages on the live site. The app currently cannot
display any image on a variety page: v1/v2 shipped under a "no photos" design rule, and while
the `media` table exists (migration 0000), nothing reads or renders it.

This delta adds the **minimal** media-display capability, in the app's existing patterns.
It does not add uploads, an admin UI, seller media, card thumbnails, or a media API write path.

## R1 — Serving
The six illustration files live in `public/artwork/` (copied from
`~/workspace/seeds-hues/artwork-pilot/`, filenames unchanged) and are served by the existing
ASSETS binding at `https://seeds.hues.flowers/artwork/<file>.webp` with an `image/webp`
content type. No new R2 buckets, routes or bindings.

Files:
- sweet-pea-charlies-angel.webp
- zinnia-queen-lime-blush.webp
- celosia-flamingo-feather.webp
- cosmos-cupcakes-blush.webp
- sunflower-procut-white-lite.webp
- dahlia-shooting-stars.webp

(All 1120×2240, portrait.)

## R2 — Read path
- The catalog repository returns a variety's media rows (ordered by `media.id`).
- The variety detail service output (and therefore `GET /api/v1/varieties/{slug}` and the sync
  shapes that embed a variety detail, if any) gains a `media` array:
  `{ url, licence, credit }`, where `url` is the value stored in `media.r2_key`.
- **Storage convention (documented choice):** for own-work artwork served from the app's
  public assets, `media.r2_key` stores the public path (e.g. `/artwork/zinnia-queen-lime-blush.webp`)
  and the service maps it to `url` unchanged. The column name is historical; no migration.
- Varieties with no media rows return `media: []` — never null, never omitted.
- The catalog snapshot allowlist is unchanged: media stays out of the published snapshot
  (documented divergence, as today).

## R3 — Rendering (variety page)
- When a variety has media, its page renders the first row as a hero figure near the top of
  the page (after the title/breadcrumb block, before or alongside the answer sentence —
  follow the page's existing visual rhythm): a plain `<img>` with
  - `src` = the media url,
  - `alt` = `"{varietyName} {commonName} — illustration"`,
  - `width={1120}` `height={2240}` attributes (prevents CLS),
  - responsive styling consistent with the mobile-first design (full width up to a
    max-width of roughly 380px, height auto),
  - a `<figcaption>` carrying the credit line in small text.
- When a variety has no media, the page renders **no** hero, no placeholder, no empty figure.
- Variety cards / listing grids are out of scope.

## R4 — OG image
In `generateMetadata` for the variety page: when media exists, the OG/Twitter image is the
illustration itself (`{ url: SITE_URL + media url, width: 1120, height: 2240, alt, type:
"image/webp" }`); otherwise the existing generated `/og/variety/{slug}` card, unchanged.

## R5 — Rules and guardrails, updated not deleted
- The house rule changes from "no raster images at all" to: **no seller photos, no hotlinked
  images; the only raster images are own-work illustrations from the `media` table, served
  from this app's own `/artwork/` assets.** Update the README hard-rules line to match.
- `tests/unit/guardrails.test.ts` "no hotlinked or raster <img> content" test is rewritten to
  forbid remote image references (`src="http…`, `url(http…)`, remote `next/image` config)
  while allowing local `/artwork/` `<img>` usage. All other guardrails (prices above all)
  stay exactly as they are.
- The importer assertion "media must ship empty" stays: seed data still ships no media.
  Production media rows are data operations (SQL), outside the importer, as with prices edits.

## R6 — Accessibility & performance
WCAG 2.2 AA: meaningful alt text (R3), credit visible as text, no layout shift (fixed
width/height + aspect-ratio from attributes), hero image loads eager; page weight budget
respected (the webp files are 230–380 KB; no additional JS).

## R7 — Tests
- Integration: seed a media row for an existing variety in the throwaway D1; the variety
  detail service returns it (url/licence/credit mapped); a variety without rows returns `[]`.
- Contract: `GET /api/v1/varieties/{slug}` includes the `media` array in both cases.
- Acceptance: new "Media display" section — insert a media row for
  `zinnia-queen-lime-blush` (via the scripts/lib platform proxy, the same mechanism
  `create-api-key.ts` uses), revalidate that variety's tag if a token is available
  (`.dev.vars`), then assert: the page HTML contains an `<img>` whose src is
  `/artwork/zinnia-queen-lime-blush.webp` and whose alt contains "illustration";
  `GET /artwork/zinnia-queen-lime-blush.webp` returns 200 `image/webp`;
  a no-media variety page contains no `/artwork/` img; the API detail carries the row.
  Clean up the inserted row at the end. If the page-HTML assertion cannot be made reliable
  under the local preview's ISR cache, say so in MEDIA-REPORT.md and cover the rendering by
  the strongest available substitute — do not silently drop it.
- All pre-existing suites stay green (137 Vitest + the full acceptance run).

## Out of scope
Production data changes and deployment (Hue does those after this build, from MEDIA-REPORT.md's
runbook notes). No changes to seed-data/catalog.json. No new endpoints. No schema migration.
