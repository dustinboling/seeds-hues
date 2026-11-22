# Admin seller-location endpoint — one small route in the established pattern

Authorized by Dustin, 2026-11-22, verbatim: "Build the small location endpoint so the team can apply them." The seller location/contact sweep (~/workspace/seeds-hues/seller-contacts-2026-11-22/REPORT.md) verified five location corrections against the sellers' own published facts, but no sanctioned API route exists for a seller's location — the admin UI is the only path. This build adds the route. Applying the five corrections is a separate, later step by the coordinator — **this build changes no production data.**

## The route

Add ONE route to `v2/lib/api/ingest-admin-routes.ts`, mirroring the shipped `sellers/:id/description` route exactly (same file, same shape, same funnel):

- `POST sellers/:id/location`, `scope: "admin"`, `bucket: null`, `idempotent: true`.
- Same seller-ref validation as the description route (the numeric-id-or-slug regex; an unmatched ref is a 404 Problem "seller not found").
- Body: a new `SellerLocationBodySchema` beside `SellerDescriptionBodySchema`, wherever that schema lives — `{ location: string }`, required, non-blank after trimming, with a sane length cap in the description schema's discipline. Reject missing, non-string, blank, and over-length values as 400 Problems in the house style. No other body fields are accepted.
- Handler: `services.admin.sellerUpdate(ref, { location: <trimmed value>, region: <derived> })` — the same sellerUpdate funnel as the admin UI and the description route, so the changed-field list, audit trail, and revalidation match a UI edit exactly. Return `{ data, revalidate }` as the sibling routes do; the response data is the read-back of the updated seller.

## Region derivation (the one real design point — read carefully)

`region` is an independent sellers column (it drives the state filter, the state pages, and the StateShape icon) and `sellerUpdate` treats it as its own field. A location-only write would leave a corrected seller filed under its old state. Therefore the route derives `region` from the submitted location and includes it in the same sellerUpdate call:

- If the location ends with a US state — as a trailing `, XX` USPS code, a trailing `, <full state name>`, or the whole value is exactly a state code or state name — region is that state's USPS code.
- If no US state can be determined from the value, the call still succeeds on location alone and region is left unchanged (pass only `{ location }`) — do not invent a region.
- Cover the derivation with a small pure helper and unit tests: "Mount Vernon, WA" → WA; "Poteet, TX" → TX; "Nashville, TN" → TN; "Alburgh, VT" → VT; "Independence, OR" → OR; "Vermont" → VT; "Willamette Valley, OR" → OR; a value naming no state (e.g. "United States") → no region change.

## Tests (the gate will re-run and mutation-prove them)

In the same test style/files as the description route's tests:

1. **Auth:** no key → refused; the ingest-scope key → refused; a malformed key → refused; the admin-scope key → succeeds. (Scope enforcement must come from the route table's `scope: "admin"`, exactly as the sibling routes — prove it by test, not by inspection.)
2. **Validation:** missing body field, non-string, blank/whitespace-only, and over-length locations → 400; unknown seller ref → 404; a well-formed call on a real (test) seller → 200.
3. **Single-purpose proof:** capture a seller's full record before and after a location call; the ONLY differing fields are `location`, `region` (when derivable), and the mechanical audit/sequence fields sellerUpdate itself touches. Name, homepage, contactEmail, description, badge, status — byte-identical.
4. **Idempotency:** the same call twice leaves the record in the same state as once.
5. **Region derivation:** the helper cases above, plus an end-to-end case where a seller filed under the wrong state (location "Salt Lake City, UT", region UT) ends with location "Mount Vernon, WA" and region WA after one call.
6. **Non-vacuity:** the new tests FAIL on the pre-build code (the route does not exist) and PASS on your branch — state both runs in the PR body.

## Out of scope — do not touch

- No production data changes (the five corrections are applied by the coordinator after the gate).
- No other routes, no schema/migration (the columns exist), no admin UI changes, no OpenAPI surface beyond whatever the description route itself registers (mirror its footprint exactly — if it registers none, register none).
- Seller fields other than location/region: the route must be incapable of changing them (the handler passes exactly the two keys above).

## Discipline (standing, from prior tranche lessons)

- No scratch or fixture files anywhere in the tree. ESLint per file group as you go; strict narrowing in tests; expected values derived, never hardcoded counts that drift.
- Finish discipline: run the full `npm run verify` once, as the last act. If verify fails, fix only failures in files this task touched, re-run verify once more, and finish. If a failure sits in files this task did not touch, do not chase it — finish with the PR body reporting the failure verbatim and the files it sits in. Do not iterate beyond two verify runs.
- The PR body carries the standard accounting: files changed, verify counts (files/tests, branch vs merge-base), the proof results, and the non-vacuity statement. The rendered-change confirmation may claim only what is literally true (this build renders nothing new — say so).
- US spelling. No prices anywhere. Nothing outside this item's scope.
