# Cross-check — classifications vs the catalog's actual varieties (INTERNAL)

Run 2026-11-18 before any import of `classifications.json`, per the
content handoff. Method: each flagged crop's catalog varieties (from
`v2/seed-data/catalog.json`) were checked against the Floret Library
reference records for those exact varieties (`floret-library-descriptions.json`
— internal reference only; Floret's "Plant type" field plus its prose),
and against the writers' flags in SOURCES.md.

## Content verification (all as handed off)

- `classifications.json` covers exactly the 93 catalog crop slugs — no
  extras, none missing. `echinacea` is absent (no crop page), present
  only in `instructions.json` / `growing.json` (14 keys each: the 13 site
  crops + echinacea).
- `harvest_for_cutting` is absent for exactly breadseed-poppy and
  echinacea in growing.json (present in the other 12). `good_to_know`
  present for 9/14 growing entries. Nothing was filled in.

## MISMATCHES — do not publish as written

- **bee-balm** — classified "Perennial, Zones 4–9" (as Monarda
  didyma/fistulosa). The catalog's varieties are 'Bergamo' and
  'Lambada'; Floret calls both "annual" in prose ("this easy-to-grow
  annual") and in Plant type, with the whorled blooms and bergamot/
  oregano scent of lemon bee balm (M. citriodora types). This is the
  writers' flag #4 flip case. Correct reading: **Annual**.
- **salvia** — classified "Annual" (as S. viridis). The catalog's only
  variety, 'Rose Queen', is described by Floret as a **perennial** that
  "blooms the first year from seed" (Plant type: perennial; 18–24 in;
  grape-purple spikes, rose-pink blooms) — the S. nemorosa/×superba
  type, not painted sage. Correct reading: **Perennial**.
- **clary-sage** — classified "Biennial or short-lived perennial" (as
  S. sclarea). The catalog's only variety, 'Tricolor Mix', is a
  **hardy annual** per Floret (Plant type), with the showy veined
  pink/white/purple bracts of S. viridis (annual clary). Together with
  salvia above, the pair is reversed vs the writers' assumption —
  their flag #8 flip case. Correct reading: **Hardy annual (S. viridis)**.
- **soapwort** — classified "Annual" (as Saponaria vaccaria). The crop
  is split: 'Beauty Pink' is the annual vaccaria type (Floret: hardy
  annual, 60–70 days, succession-sown), but 'Graciella White' is a
  **perennial** — Floret's prose says "Though considered a perennial,
  this tough, vigorous plant will flower the first year if sown early"
  (Plant type: perennial; 90–100 days), the S. officinalis type. A
  single unqualified "Annual" for the crop would be a wrong fact for
  one of its two varieties (writers' flag #2). Needs a ruling: split
  wording or hold.

## Flagged, publish only with the qualification noted

- **ornamental-grass** — classified "Annual — the cutting types are
  grown in a single season" (writers' flag #5 basis: Frosted Explosion,
  Panicum elegans). The catalog's five: Broomcorn Millet (annual),
  Bunny Tails (annual), Frosted Explosion (annual), Feathertop
  (tender perennial, grown as annual — Floret: "technically a
  perennial, it is quite tender"), Quaking Grass (Floret Plant type
  and prose: perennial). The entry is true as a how-grown statement
  for the cutting types but is not the botanical life cycle of every
  variety listed; flag for a wording decision rather than a clean pass.

## Passes — classification consistent with the catalog's varieties

- **silver-lace** — Floret Plant type: tender perennial. Entry:
  "Tender perennial, often grown as an annual", Zones 8–10. Holds
  under either the Tanacetum ptarmiciflorum or Senecio reading
  (writers' flag #3).
- **argentine-forget-me-not** — Floret Plant type: hardy annual.
  Entry: Annual (Omphalodes linifolia reading). Consistent.
- **queen-annes-lace** — both varieties ('Green Mist', 'Queen of
  Africa') are hardy annuals per Floret (the Ammi-type cut crop).
  Entry: Annual. Consistent.
- **chocolate-lace-flower** — 'Dara' is a hardy annual per Floret;
  Annual per Johnny's for the cultivated crop. Entry: Annual.
  Consistent (wild Daucus carota biennial note already documented in
  SOURCES.md).

## Soft notes (outside the mandated flags; not blockers)

- **silene** — both catalog varieties ('Blushing Lanterns', 'Pink')
  are "perennial" in Floret's Plant type; the entry reads "Annual or
  biennial". Worth a second look before publishing, though Floret's
  field is dialect-loose elsewhere (it labels most tender perennials
  "annual" because they are grown that way — which is why the other
  ~20 surface differences in a full sweep, e.g. snapdragon, stock,
  pansy, are the same fact in two dialects, not errors:
  classifications.json states the botanical cycle with a "grown as an
  annual" qualifier).
- **canterbury-bells** — entry "Biennial" is botanically correct for
  Campanula medium; Floret lists its varieties as "annual" (grown-as).
  Not a wrong fact.

## Import status

Nothing was imported or published. No Task D/E brief exists in the
workspace and the app has no plumbing yet for life_cycle / hardiness /
guide content (no schema, API fields, or crop-page tabs). The four
mismatched entries above (bee-balm, salvia, clary-sage, soapwort) must
be corrected or held before any import publishes them; the remaining
entries are cleared by this check within its scope.
