# Seller description update endpoint (admin key) + publication guard

## Why (full audit 2026-11-21, criticals C1 + C2)

The 2026-11-21 full audit found two criticals in seller `description` text, live on public
seller pages today:

- **C1** — 29 of 84 seller descriptions publish a dollar price in prose, 28 of them inside a
  leftover working note of the form `Anchor: … $4.65 … verified 2026-11-19`. The standing rule
  is absolute: prices are captured but NEVER shown, anywhere, including prose.
- **C2** — 27 sellers publish internal deliberation verbatim as their About copy
  (`Badge: NO — leave OFF pending Hue review`, `Feed: none …`, `Coordinator to verify …`).

Cleaned replacement copy is being prepared. There is currently **no admin-key write path for a
seller's description**: the API-key admin surface (`ADMIN_ROUTES` in
`v2/lib/api/ingest-admin-routes.ts`) is eligibility-only (approve / reject / remove /
small-farm), and the general seller update (`services.admin.sellerUpdate`, Slice B D3) is
reachable only through the signed-in admin UI (`POST /admin/sellers/actions`). This build adds
the smallest key-authenticated description path, and — so the defect class cannot recur — a
server-side publication guard on the one service funnel every description write passes
through.

## What to build

### 1. New admin-key route: `POST /api/v1/admin/sellers/:id/description`

In `v2/lib/api/ingest-admin-routes.ts`, following the sibling `sellers/:id/small-farm` route
exactly (same ref-shape validation and 404 `Problem` on a malformed ref, `scope: "admin"`,
`bucket: null`, `idempotent: true`):

- Body: a strict schema, e.g. `SellerDescriptionBodySchema =
  z.strictObject({ description: z.string().max(2000).nullable() })` — a string sets the
  description, `null` clears it (mirroring `SellerUpdateBodySchema`'s nullable description).
- Handler: `const r = await services.admin.sellerUpdate(ref, { description: b.description })`
  and return `{ data: r.data, revalidate: r.revalidate }` — reuse `sellerUpdate` unchanged so
  the changed-field list and the revalidation set (`/seller/<slug>`, `/seller`,
  `/sitemap.xml`, the seller's variety pages) are identical to a UI edit.
- Register the route anywhere sibling admin routes are registered for docs/tests, if such a
  registry exists; otherwise the route table is the only registration (sibling routes are the
  evidence).

### 2. The publication guard — inside `sellerUpdate` (`v2/lib/services/admin.ts`)

`sellerUpdate` is the single funnel for description writes: its only callers are the session
seller service (admin UI) and — after part 1 — the new key route. Enforce the guard there so
BOTH paths reject flagged text; do not duplicate the check per caller.

- Add an exported pure function `descriptionViolations(text: string): string[]` returning the
  matched violation class names (empty array = clean). Classes:
  - `price` — a currency amount in any form: `$` followed by a digit (optional space),
    `USD` with an amount, a number followed by `dollars`/`bucks`, or `price`/`priced`
    immediately tied to an amount. Amounts are the target; the bare word "dollar" with no
    amount is not a violation.
  - `internal_marker` — working-note scaffolding: a line-leading label `Anchor:`, `Badge:`,
    `Feed:`, or `Note:` (start of text or after a newline, optional leading spaces,
    case-insensitive); the phrases `Hue review` or `coordinator to verify`
    (case-insensitive) anywhere; or a verification stamp `verified YYYY-MM-DD`.
- In `sellerUpdate`, when `body.description` is a non-null string and violations exist, throw
  `AdminError(422, "description_rejected", …)` naming the violation classes (not the submitted
  text) BEFORE any write. Null (clear) and absent (no description change) are never blocked.
- The guard applies to the description field only. No other field's behavior changes.

## Tests (required, non-vacuous)

- Route: POST a clean description for a fixture seller → success; the stored description
  equals the submitted text; `data.changed` includes `description`; the revalidate set
  includes `/seller/<slug>`. POST `null` → description cleared.
- Guard positives — each must be rejected with 422 and leave the stored description
  byte-identical: the audit's C1 shape (`Anchor: Basil 'Cinnamon' — $4.65 packet, verified
  2026-11-19`), a plain-prose price (`Packets are $4.65 each.`), a `Badge: NO — leave OFF
  pending Hue review` text, a `Feed: none — products.json returned 404` text.
- Guard negatives — each must be ACCEPTED: ordinary factual copy; copy containing the word
  "note" mid-sentence (not a line-leading label); copy mentioning dollars with no amount.
- Service level: calling `sellerUpdate` directly with a flagged description throws and writes
  nothing (this is the admin-UI path's protection — same funnel).
- Auth: the route refuses without an admin-scope key exactly as its sibling admin routes do
  (mirror an existing sibling auth test if one exists).
- `npm run verify` fully green.

## Explicitly out of scope

- No UI changes; no other seller fields; the `location` field is NOT touched (the GeoSeed
  Clinton → Greenwood location correction is a separate recorded item, not this build).
- No changes to ingest, seller candidates, or the catalog importer.
- No data changes: this build ships the path and the guard only. Applying the cleaned
  descriptions happens after merge + deploy, through this endpoint.
