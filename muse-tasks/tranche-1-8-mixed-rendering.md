# Tranche 1.8 — Variety color endpoint, Mixed rendering, and swatch policy

## Why (full audit 2026-11-21, IRIS-C-10, IRIS-C-11, Willa §5)

The Tranche 1.8 filing sweep (see
`~/workspace/seeds-hues/backlog-2026-11-21/tranche-1-8/RESULT.md`) verified **112 data
corrections** to variety Hue filings: 39 wrong-family corrections, 72 fills of varieties
filed `unknown`, and 1 swatch clear (Shirley Poppy 'Angels Choir', family White with a
sourced swatch `#FF69B4` — hot pink — that contradicts it; the variety is in fact a mix).
None of them can be applied today:

- There is **no sanctioned write path for `color_family` or `color_swatch` anywhere**.
  The admin-key API (`ADMIN_ROUTES` in `v2/lib/api/ingest-admin-routes.ts`) has no variety
  update route; the admin UI variety service exposes only alias add/remove and variety
  remove, and displays no color fields; ingest's `createVariety` never sets a family;
  `v2/scripts/add-color-data.py` edits only the seed file, and a production re-import
  would silently overwrite live data that has diverged from that file (804 live varieties
  vs 778 in the file). Direct D1 writes are not a sanctioned path.

Two rendering defects ride along (Iris IRIS-C-11 and the swatch half of IRIS-C-10):

- A **Mixed** variety renders as a flat saturated disc on its variety page and OG card
  (`components/ui/Swatch.tsx` renders any sourced hex flat; `app/og/[kind]/[slug]/route.tsx`
  passes `v.colorSwatch` straight through), while the Hue filter draws Mixed as a conic
  gradient (`BrowseFilters`). The 11 sourced swatches on Mixed varieties are single tones
  of their mixes — measured nearest-family spread across eight different families — so
  whichever hex happens to be stored, the flat disc misstates the variety.
- A sourced swatch that **contradicts its filed family** renders anyway (Angels Choir:
  swatch `#FF69B4` measures Delta E 73.4 from the White family representative and 21.0
  from Pink — it is a pink chip on a page that says White).

## What to build

### Part 1 — New admin-key route: `POST /api/v1/admin/varieties/:id/color`

In `v2/lib/api/ingest-admin-routes.ts`, following the sibling `sellers/:id/small-farm`
route exactly (same ref-shape validation and 404 `Problem` on a malformed ref,
`scope: "admin"`, `bucket: null`, `idempotent: true`):

- Body: a strict schema, e.g.
  `VarietyColorBodySchema = z.strictObject({ color_family: z.enum([...COLOR_FAMILIES, "unknown"]).optional(), color_swatch: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional() })`
  with at least one key required. `color_family` sets the family (the vocabulary in
  `v2/lib/validators/index.ts` is the only source; `"unknown"` is accepted so a filing can
  be cleared back to unfiled). `color_swatch` sets the swatch; `null` clears it. An absent
  key leaves that field untouched — partial updates must not clobber the sibling field.
- Handler: funnel through ONE new service function (e.g. `services.admin.varietyColorUpdate`)
  that performs the write, so any future caller (admin UI included) gets identical
  validation, the changed-field list, the catalog sequence bump, and the revalidation set:
  `/variety/<slug>`, `/crop/<crop-slug>`, `/variety`. Return
  `{ data: r.data, revalidate: r.revalidate }` as the sibling routes do.
- No other variety fields are writable through this route. No UI changes in this part.

### Part 2 — Mixed renders as the conic gradient everywhere

- Extract the filter's Mixed conic gradient (today local to `BrowseFilters`: conic stops
  from the pink, orange, yellow, green, blue, purple family representatives) into ONE
  shared definition used by the filter, the variety page, and the OG card, so the three
  can never drift apart.
- `components/ui/Swatch.tsx` (or its callers): when the variety's family is `mix`, render
  the shared conic gradient — never the sourced hex, at any size.
- `app/og/[kind]/[slug]/route.tsx`: same branch — a Mixed variety's OG card draws the
  gradient, not `v.colorSwatch` flat.
- Non-Mixed rendering is otherwise unchanged, subject to Part 3.

### Part 3 — Swatch policy: a sourced swatch renders only if it agrees with its family

One shared resolver (used by the variety page and the OG card) decides what a variety's
color chip shows, in this order:

1. **Family is `mix`** → the conic gradient (Part 2). The sourced hex is never rendered.
2. **Family is `unknown`** → no chip (the current hatched/null state). A swatch with no
   family never renders on its own. (Live case: Breadseed Poppy carries `#9370DB` with no
   family and no seller anywhere stating a flower color; the chip must stop asserting
   medium purple for the species record.)
3. **Family is a single color and a sourced swatch exists** → convert the swatch and
   every family representative in `COLOR_FAMILY_SWATCHES` to CIELAB and compute Delta E
   (CIEDE2000). The swatch renders as-is **only if its nearest family representative is
   the filed family**. If the nearest representative is a different family, the swatch is
   suppressed and the chip renders the **filed family's representative** instead — the
   page must tell one color story, and the filed family is the curated fact. There is no
   distance cap: within-family saturation and depth vary legitimately; the defect being
   fixed is cross-family contradiction, not distance from the centroid.
   - Worked check, Angels Choir as filed at audit time: family White, swatch `#FF69B4`;
     nearest representative is Pink → suppressed to the White representative.
   - Worked check, same hex filed Pink: nearest representative is Pink → renders as-is.
4. **Family is a single color and no swatch exists** → the family representative, as today.

The suppression is a rendering rule only: it does not delete or alter stored data.

## Tests (required, non-vacuous)

- Route: POST `{ color_family: "mix" }` for a fixture variety → success; read-back shows
  the new family and the **unchanged** swatch; `data.changed` includes `color_family`; the
  catalog sequence advanced; the revalidate set includes `/variety/<slug>` and
  `/crop/<crop-slug>`. POST `{ color_swatch: null }` → swatch cleared, family unchanged.
  POST `{ color_swatch: "#FF69B4" }` → stored uppercase-normalized as the codebase's other
  hex writes are.
- Route validation: an out-of-vocabulary family (`"taupe"`) → 4xx and the stored row is
  byte-identical; a malformed swatch (`"FF69B4"`, `"#FFF"`) → 4xx, no write; an empty
  body `{}` → 4xx, no write.
- Auth: the route refuses without an admin-scope key exactly as its sibling admin routes
  do (mirror an existing sibling auth test).
- Mixed rendering: a fixture Mixed variety **with** a sourced swatch renders the conic
  gradient on the variety page and in the OG card's style output, and its stored hex
  appears nowhere as a chip background. The filter's Mixed chip and the variety page's
  chip resolve to the same shared gradient definition (one source, asserted by test or by
  construction).
- Swatch policy: family White + swatch `#FF69B4` → chip is the White representative, not
  `#FF69B4`; family Pink + `#FF69B4` → chip is `#FF69B4`; family unknown + `#9370DB` → no
  chip; family Purple + a near-representative hex → renders as-is; family `mix` + any hex
  → gradient (policy order: mix wins over the nearest-family test).
- `npm run verify` fully green.

## Constraints

- US spelling in all copy, comments, and test names.
- Prices are never shown or recorded in public copy — nothing in this build touches price
  data, and no test fixture may put a price in a public field.
- No data changes ship with this build. The 112 verified corrections in the Tranche 1.8
  RESULT are applied **after** merge + deploy, through the Part 1 endpoint, as a separate
  recorded pass with read-back verification — the same endpoint-first, data-after pattern
  as the seller-description endpoint.
- Do not extend the route to other variety fields, and do not add an admin UI control in
  this build; both are separate decisions.
- The seed file `seed-data/catalog.json` is not a write path and is not updated by this
  build.

## Finish-line summary (PR title)

Add admin-key variety color endpoint; render Mixed as the shared conic gradient and suppress family-contradicting swatches on variety pages and OG cards
