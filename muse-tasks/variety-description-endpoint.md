# Variety description endpoint — POST /api/v1/admin/varieties/:id/description

## Provenance

Dustin ruled 2026-11-23: "Scrub seller names from variety prose too" (SPEC-CANONICAL decision 28). The scrub's census + rewrites are done and Quinn-gated (variety-prose-census-2026-11-23/: 12 varieties, rewrites PASS WITH NOTES, originals verified byte-identical to production). What is missing is the sanctioned write path: the admin API has `sellers/:id/description` (Tranche 1.1) and `varieties/:id/remove` + `varieties/:id/color`, but **no way to write a variety's `description`**. This build adds exactly that endpoint, mirroring the existing funnels, so the gated rewrites can be applied through the API with read-back verification (the Tranche 1.1 pattern) instead of any direct database write. This build does NOT apply the rewrites itself — the coordinator applies them through the shipped endpoint afterward.

Base: current `main`.

## The work

1. **Route** in `v2/lib/api/ingest-admin-routes.ts`, beside `varieties/:id/color`:
   - `POST varieties/:id/description`, scope `admin`, `bucket: null`, `idempotent: true`.
   - The `:id` ref accepts a numeric id or a slug, with the same ref validation and 404 shape as the color route ("variety not found").
2. **Body schema** (`VarietyDescriptionBodySchema`, wherever the sibling schemas live): `{ description: string | null }` — a string sets the description; `null` clears it to NULL. Apply the same validation discipline as `SellerDescriptionBodySchema` (length bounds in that schema's spirit; reject non-string/non-null types via the house `parseBody` + `Problem` errors). An empty string is a validation error, not a clear — clearing is `null`'s job, stated explicitly so the two can never be confused.
3. **Service funnel** in `v2/lib/services/admin.ts`, modeled on `varietyColorUpdate` (the ONE funnel, so any future caller — admin UI included — gets identical validation, changed-field list, catalog sequence bump, and revalidation set):
   - Resolve the variety via `ingest.varietyForMatch` exactly as the color funnel does; 404 `variety_not_found` when absent.
   - Write through a data-layer update beside `admin.updateVarietyColor` (e.g. `admin.updateVarietyDescription`) that sets `description`, bumps `updated_seq` / `updated_at` the same way the color write does, and returns the changed-field list (`["description"]` when the value actually changes; an unchanged value writes nothing and reports no change — idempotent in effect, matching the sibling endpoints' behavior).
   - Return `{ data: { variety: slug, id, changed }, revalidate: ["/variety/<slug>", "/crop/<plantSlug>", "/variety"] }` — the same revalidation set as the color funnel.
4. **Tests** (contract layer, mirroring the seller-description and variety-color endpoint tests): admin scope enforced (non-admin key refused); unknown variety → 404; set a description → read-back shows the new value and the changed list names `description`; set the same value again → no change reported; `null` clears to NULL; empty string → validation error; the revalidation set is exactly the color funnel's three paths. Each new test must fail on current main (the route does not exist) — Quinn will verify non-vacuity.

## Fences

- No change to any existing route, funnel, or surface behavior. The seller description endpoint and the variety color endpoint stay byte-identical in behavior.
- No admin UI change. No schema migration (the `description` column exists). No data writes in the build itself.
- No price appears anywhere (whole-programme rule T-C stands as always).
- Keep the change to the smallest set of files that mirrors the sibling funnels faithfully.

## Finish discipline

`npx eslint .` after each file; `npm run verify` after the test file and in full before ending your turn — iterate until it exits 0. Type fixtures with the app's exported types. Leave the tree clean and **leave your work uncommitted** (the workflow's steps handle branching and commits). If the gate goes red, a `muse/wip-<run_id>` branch survives for a repair dispatch.

## PR body hygiene

Provenance (this brief + decision 28), Build accounting (verify summary + diff census), the endpoint contract stated explicitly (method, path, body, changed-list and revalidation semantics), and a Gate record section for Quinn's verdict.
