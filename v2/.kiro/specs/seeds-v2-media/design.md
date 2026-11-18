# seeds-v2-media — design

Follows the app's standing architecture: repositories are the only Drizzle importers;
`atomic()` is the only `db.batch()`; Server Components and the API share the service layer;
service output is Zod-validated and the Zod schemas generate the OpenAPI contract.

## D1 — Assets
Copy the six `.webp` files from `~/workspace/seeds-hues/artwork-pilot/` into
`public/artwork/`, byte-identical, filenames unchanged. `public/` is copied into
`.open-next/assets` by `cf:build` and served through the ASSETS binding; no config change.
Check `public/_headers` and add a long-lived immutable cache header for `/artwork/*` only if
the file's existing patterns make that a one-line, low-risk addition; otherwise skip and note it.

## D2 — Repository
In `lib/repositories/catalog-read.ts` (or a sibling `media.ts` repository if that reads
cleaner — same layer, same rules), add:

```ts
listMediaForVariety(varietyId: number): Promise<MediaRow[]>
```

selecting `r2Key, licence, credit` from `media` where `varietyId = ?`, ordered by `id` asc.
If the variety-detail query already loads related rows in bulk, a batched
`listMediaForVarieties(ids)` is acceptable; the detail page needs only the single-variety form.

## D3 — Validator + service
- `lib/validators`: add `VarietyMediaSchema = z.object({ url: z.string().min(1), licence:
  z.string().min(1), credit: z.string().min(1) })` and add `media: z.array(VarietyMediaSchema)`
  to `VarietyDetailSchema`.
- `lib/services/catalog.ts` `getVariety`: after loading the variety row, load its media rows
  and map `{ url: row.r2Key, licence: row.licence, credit: row.credit }`. Varieties without
  rows get `[]`. Every other constructor of a `VarietyDetail` (tests, sync shapes) must be
  updated to supply `media` (default `[]`) so typecheck stays honest — no optional field.
- The OpenAPI document regenerates from Zod; confirm `/api/v1/openapi.json` shows the new
  field and the API docs page needs no hand edit.

## D4 — Page rendering
In `app/variety/[slug]/page.tsx`, after the header block (breadcrumbs + title + swatch row)
and before the listings section, render when `v.media.length > 0`:

```tsx
<figure className="…">
  <img src={m.url} alt={`${label} — illustration`} width={1120} height={2240}
       loading="eager" fetchPriority="high" decoding="async" className="…" />
  <figcaption className="…">{m.credit}</figcaption>
</figure>
```

Use the first media row only. Styling: Tailwind classes in the page's existing idiom;
`w-full max-w-[380px] h-auto rounded-…` or the closest existing pattern — match the design
system, don't invent a new one. A small component in `components/variety/` (e.g.
`VarietyHeroImage.tsx`) is fine if that matches how the page composes sections.

Alt text: `label` is already computed on the page as `"{varietyName} {commonName}"`, so the
alt is `"{label} — illustration"`.

## D5 — OG image
`generateMetadata` already calls `load(slug)`, which now returns media. When
`v.media.length > 0`, pass `pageMetadata` an og object for the illustration:
`{ url: SITE_URL + v.media[0].url, width: 1120, height: 2240, alt: "{label}", type:
"image/webp" }`. `ogImage()`'s return type may need a sibling helper or a widened type —
keep `lib/seo/metadata.ts` tidy and typed; do not cast through `any`.

## D6 — Guardrail rewrite
Rewrite the one guardrail test (R5): scan UI source for remote image references —
`/<img[^>]+src=["']https?:/`, `/url\(\s*["']?https?:/`, and any `next/image` remote config —
expect none. Local `<img src="/artwork/…">` is allowed. Keep the test name recognisable
("no hotlinked images").

## D7 — Acceptance mechanics
The acceptance script already runs Node-side scripts through the platform proxy
(`scripts/lib/platform.ts`). The Media section:
1. Inserts one row: variety = `zinnia-queen-lime-blush` (look its id up through the proxy),
   `r2_key = '/artwork/zinnia-queen-lime-blush.webp'`, licence/credit = short test strings.
2. If `.dev.vars` provides `REVALIDATE_TOKEN`, POSTs `/api/revalidate` for
   `tags: ["variety:zinnia-queen-lime-blush"]` against the preview base. (The preview reads
   `.dev.vars`; `cp .dev.vars.example .dev.vars` is already the documented local setup.)
3. Fetches the variety page and asserts the hero img + alt; fetches the artwork URL and
   asserts 200 + `image/webp`; fetches `sweet-pea-albutt-blue` (no media) and asserts no
   `/artwork/` img; fetches the API detail and asserts the media array.
4. Deletes the row (and revalidates again if it revalidated in step 2).
If step 3's HTML assertion fails purely because of ISR caching under the preview, iterate on
the revalidation path (tag names are `variety:{slug}` per README) — the finish line is a
green run, with any remaining divergence written into MEDIA-REPORT.md, not hidden.

## D8 — Docs
- README: update the "No photos and no hotlinked images" hard-rule line per R5, and add one
  short "Variety artwork" note under Data operations: media rows are added by SQL against
  production D1 (variety_id, r2_key = public path, licence, credit), then revalidate the
  variety tag; a full catalog re-import wipes media (importer assertion) so rows must be
  re-inserted after any re-import.
- MEDIA-REPORT.md in the v2 root: what changed (files), the storage-convention choice,
  verification item by item, divergences.
