# Index Ruling — Report (2026-11-16)

Owner ruling applied: **every active variety page is Google-indexable** (`index, follow` +
in the sitemap), even with no farms selling it — superseding canonical decision 8 / R5
(≥ 1 listing OR ≥ 150 words of notes). Zero-seller pages stay public in a formalized
"no sellers yet / currently unavailable" state (Amazon model).

## Rule change (code)

- `lib/catalog/assertions.ts` — `isIndexable(status, deletedAt)` now returns true iff the
  variety is `active` and not soft-deleted. Listings/notes no longer play any part.
  `INDEX_MIN_NOTE_WORDS` and `ownNoteWords` removed (dead under the new rule).
- `lib/catalog/importer.ts` — imported varieties (always `active`) get `indexable: true`
  via the rule function; the now-unused listing-count map was removed.
- `lib/repositories/ingest.ts` — `recomputeIndexable()` re-derives from status/deleted_at
  only (same seq-bump-on-change semantics). Seller removal / merges behave as before:
  a variety that loses its only listing stays indexable; merged rows stay non-indexable.
- `app/variety/[slug]/page.tsx` — zero-seller where-to-buy block formalized (see wording
  below); metadata comment updated. `app/sitemap.ts` + README rule text updated.
- Guardrails kept intact: removed sellers still 410, `/search` still `noindex, follow`,
  API responses still `X-Robots-Tag: noindex`, prices still never exported/shown.

## Zero-seller wording (live, variety page where-to-buy block)

> **No sellers yet — currently unavailable.** No small farm in this directory is selling
> this variety right now. Browse [all small-farm sellers](/seller) or other
> [{crop} varieties](/crop/{slug}). Know a farm that sells it? [Tell us](/report?type=correct&variety={slug}).

(The answer line "No small farm found selling {name} yet." and the "(No Farm Listing Yet)"
title suffix are unchanged.)

## Tests

- Updated: `tests/unit/catalog-assertions.test.ts`, `tests/unit/seo.test.ts` (fixture),
  `tests/integration/data.test.ts` (619 indexable / 0 noindex / sitemap 619),
  `tests/integration/ingest-admin.test.ts` (pre-publish + lost-only-listing expectations),
  `scripts/acceptance.ts` (index-rule check, sitemap check, seller-removal check, plus a
  new assertion on the zero-seller wording).
- Local: ESLint + tsc clean, **Vitest 137/137**, **acceptance 92/92** against a local
  preview on a freshly re-imported local DB.

## Production publish

- Backup first: `tmp/prod-backup-pre-index-ruling.sql` (full catalog-table dump).
- Flag flip via generated SQL (`tmp/index-flip.mjs` → `tmp/index-flip.sql`), mirroring
  `recomputeIndexable` semantics (one `catalog_seq` increment per changed row):
  **602 rows flipped; catalog_seq 736 → 1338; indexable 619 / noindex 0.**
- Snapshot v3 built from production rows with the project's own `buildSnapshotFile()`
  (`tmp/build-snapshot-prod.ts`; the Miniflare remote path can't cross the sandbox proxy),
  uploaded to R2 `snapshots/catalog-v3.sqlite` (200,704 bytes; sha256
  `4e4e1a53eb299343dbed1bd379635ffab19dd50deb214ba8f58ef3b0c1c20086` — the file served at
  `/api/v1/catalog/snapshot/3.sqlite` is byte-identical), `catalog_publish` v3 inserted
  (batch 1, published 2026-11-16T20:31:33Z). **Catalog version 2 → 3.**
- Worker redeployed from an isolated staging copy of the OpenNext build (plain
  `wrangler deploy`; the OpenNext R2 cache-population step can't reach R2's S3 endpoint
  from this sandbox): Worker version `90477932-40b0-4584-9741-ff51900c5b74`.
- `REVALIDATE_TOKEN` rotated (old value was never recorded anywhere; new value exists
  only as the Worker secret) and all 619 variety pages revalidated in 4 batches.

## Live verification (https://seeds.hues.flowers)

- `/variety/sweet-pea-albutt-blue` → `index, follow`, new zero-seller wording present,
  present in sitemap. `/variety/amaranth-coral-fountain` → `index, follow`.
- Sitemap: **619 variety URLs** (was 17), 754 total.
- `/variety/sweet-pea-kings-ransom` unchanged: `index, follow`, Songbird listing,
  "In stock", "Last checked 2026-11-15", "Not yet rated".
- `/api/v1/sync/snapshot`: 93 crops / 619 varieties / **6 sellers / 17 listings**,
  all 619 varieties `indexable: true`, **zero price keys**.
- `/api/v1/sync/changes?since=736` streams the 602 flipped varieties as upserts.
- `/search` still `noindex, follow`; no variety data was changed (names/facts/listings
  untouched — only the `indexable` flag and `updated_seq` on the 602 rows).
