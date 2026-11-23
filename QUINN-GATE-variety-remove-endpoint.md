# QUINN GATE — POST /api/v1/admin/varieties/:id/remove (first production use)

- **Gate:** Quinn Assurance, independent review. The coordinator's claim ("the endpoint already shipped with Admin Slice C, 2026-11-21, and matches Dustin's spec exactly") was treated as a claim, not evidence; everything below was read and run independently.
- **Object inspected:** `origin/main` @ `069fb39` — route table `v2/lib/api/ingest-admin-routes.ts`, router `v2/lib/api/write-route.ts`, catch-all `v2/app/api/v1/admin/[...path]/route.ts`, service `v2/lib/services/admin.ts` (`removeVariety`), repository `v2/lib/repositories/admin.ts` (`removeVariety`, `liveListingCountForVariety`), `v2/lib/repositories/atomic.ts`, `v2/lib/services/auth.ts`, public read paths in `v2/lib/repositories/catalog-read.ts` / `fts.ts` / `sync.ts`, `v2/app/sitemap.ts`, tests `v2/tests/integration/admin-slice-c.test.ts`.
- **Evaluator structure:** single evaluator (Quinn). No second rater commissioned for this gate; the endpoint is a non-interactive API write, and the human-interaction/browser pass does not apply (no user-facing flow; production execution itself is the coordinator's step after this verdict and was NOT performed by this gate, per the brief).
- **Evidence fidelity:** implementation read line-by-line at the primary source; tests run against a real Miniflare D1 with the real migration files and the real HTTP route handler invoked in-process (constructed requests, not a live browser — the correct fidelity for a key-auth API endpoint; the one link not exercised is the production Worker's network hop, which is the coordinator's execution step).

## Per-spec-point verdicts

### 1. Admin-scope key auth required (401 without it) — PASS
Route entry declares `scope: "admin"`. `writeRouter` verifies the Bearer token via `services.auth.verify` (SHA-256 hash lookup, revoked/unknown → null → **401** `unauthorized` with `WWW-Authenticate`), then requires `principal.scopes` to include `"admin"`, else **403** `insufficient_scope`. Scopes are exactly `["ingest", "admin"]` (`API_SCOPES`); an ingest-only key's stored scope list cannot contain `admin`, so a lower-scope key is refused. Auth is API-key only — no session path exists in this router. Test (a) proves the 401 through the real HTTP handler with no key.

### 2. SOFT removal, no cascade — PASS
Repository write sets only `deletedAt`, `updatedAt`, `updatedSeq` on the variety row; `status` is not in the SET clause (test (b) asserts status stays `"active"`). No other table is written except the catalog sequence bump. Test (b)/(f) snapshots listings, aliases, tags, waitlist rows and listing-event counts before the remove and asserts **byte-for-byte equality** after (`toEqual` on full `SELECT *` row sets).

### 3. BLOCKED while live listings exist — PASS
"Live" = one shared definition (`liveListingCountForVariety`): status in `VISIBLE_LISTING_STATUS` (`active`, `published`) and `deleted_at IS NULL` — the same number the admin F2 page shows (setup test asserts both agree). Blocked → service throws `AdminError(409, "variety_has_listings", "this variety still has N live listing(s) — retire it/them before removing the variety")`, carrying the count. Refusal happens before any write; test (a) proves zero state change: variety row fields (`deleted_at, updated_at, updated_seq, status, indexable`) and the catalog sequence are identical before/after, and the variety remains on every public surface.

**Race guard — judged sound.** The write is a single D1 batch (`atomic()` → `db.batch()`, one implicit transaction, statements sequential, no interleaving). Inside it, the sequence bump is an `INSERT … SELECT … WHERE removable` and the UPDATE carries the full guard in its own WHERE clause (`deleted_at IS NULL AND NOT EXISTS (live listing)`) — the liveness re-check is inside the guarded statement itself, not a read-then-write gap. The winner is detected via `.returning()`; the loser re-reads and honestly reports `already_removed` or `blocked` with a fresh count. A listing that goes live in a batch committed before the remove is seen by the guard (409); one committed after lands on an already-removed variety, whose listings are publicly invisible anyway (every public listing read requires `activeVariety`). The guard literals `('active','published')` match the schema constant exactly.

### 4. Idempotent — PASS (two layers)
Service level: an already-removed variety returns success `{ variety_id, slug, already_removed: true }` and writes nothing (test (c) proves row stamps and catalog seq unchanged, via service and via HTTP 200). Router level: the route is marked `idempotent: true`, so an `Idempotency-Key` replay returns the stored response verbatim. (Errors are not stored under the key — a 409 is never replayed as a success.)

### 5. Unknown id → 404 — PASS
Repository returns null → service throws `AdminError(404, "variety_not_found", …)`. A non-numeric id 404s even earlier in `intParam`. Test (d) proves 404 + code on both the service and the real HTTP handler.

### 6. Public disappearance + revalidation — PASS
- **Page:** `varietyDetailRow` requires `activeVariety` (status active AND `deleted_at IS NULL`) → returns null → the page 404s. Test (e): `getVariety(slug)` is null after removal.
- **Search:** the FTS query itself filters `v.deleted_at IS NULL AND v.status = 'active'`, and matches are re-filtered through `activeVariety` summaries. Test (e) proves absence by name **and by alias**, with presence proven before removal in test (a) (non-vacuous).
- **Sitemap:** built from `indexableVarietyRows` (`activeVariety` + `indexable = true`); removal also runs `recomputeIndexable`, which flips `indexable` to 0 (test (b) asserts the stored flag). Test (e) runs the real sitemap export and asserts the URL is gone.
- **Catalog snapshot:** the public sync snapshot (`snapshotRows` / `sync.snapshot()`) selects varieties under `activeVariety`; test (e) asserts absence from the service snapshot, the names list, and the raw snapshot JSON.
- **Revalidation:** success returns exactly `["/variety/<slug>", "/crop/<plantSlug>", "/variety", "/sitemap.xml"]` (asserted verbatim in test (b)); the router expands the variety path with its small-farms variant via `withVariantPaths`. Covers variety, crop, directory and sitemap paths as specified.

## Test evidence (run by this gate, scratch worktree of origin/main)

- `tests/integration/admin-slice-c.test.ts` — **33/33 passed** (24.6 s test time), including the full guardrail block: setup + (a) refusal with zero state change, (b) success after a real `removeListing` retire, (f) byte-for-byte no-cascade (asserted inside (b)), (e) public-payload absence, (c) already-removed writes nothing, (d) 404 both surfaces, (g) reviewer-session refusal. The tests are non-vacuous by construction: presence on every public payload is asserted *before* removal (in (a), while blocked) and absence *after* (in (e)), against the real sitemap export, real search service, real snapshot builders and raw SQL — not mocks of them.
- **Full suite: 84 test files, 1,321 tests, all passed** (800 s). Typecheck (`tsc --noEmit`) clean. Lint not re-run (suite + typecheck cover this gate's risk; the endpoint's code is unchanged since Slice C shipped under its own gate).
- Environment note: `npm ci` failed twice in `/tmp` (512 MB tmpfs) and succeeded in a disk-backed worktree; 49 zero-byte `.d.ts` files under `next/dist` are the published package's own empty stubs (identical across two clean installs), not the known VM flake.

## Notes (not defects)

1. **Raw table export retains a tombstone.** `readSnapshotRows` (the allowlist table dump behind `publish-catalog`'s offline SQLite file) keeps the variety row with `deleted_at` set — that is the correct representation of a soft delete in a full export, and every consumer read path filters on it. The public catalog snapshot (spec point 6) excludes the variety outright, as proven above. Flagged only so the distinction is on the record.
2. **No dedicated concurrency test** drives two simultaneous removes or a listing-goes-live racing a remove; the guard's correctness rests on the D1 batch/statement semantics verified by inspection (the sibling restore path does carry a single-winner concurrency test). Coverage gap, Minor — worth adding when the file is next touched, not a blocker for first use.
3. The admin **session** surface (F2 danger zone) drives the same service function and is covered by tests (a)/(g) — one effect, two doors, as designed.

## Coverage ledger

- **Population:** the six spec points × (route, router/auth, service, repository, public read paths, revalidation), plus the existing test suite.
- **Checked:** all of the above, line-by-line at origin/main, plus the full test suite executed locally.
- **Excluded:** the production endpoint itself (expressly reserved to the coordinator after this verdict); the live production D1 state; any browser/human-interaction pass (no interactive flow in scope).
- **Residual risk:** a defect that exists only in the deployed Worker's environment (bindings, production data shapes) and not in code or Miniflare tests could still surface on first use — the coordinator's first production call is the final link of the evidence chain and its result should be read back (variety page 404 + record state) before the removal is reported done.

## VERDICT: VERIFIED — safe for production use

Every spec point conforms, independently verified in code and by executed tests. The coordinator may proceed with the first production call.
