# Quinn Gate — PR #83 "Preview deploy — Worker entry for the converted app"

- **Repo / PR:** dustinboling/seeds-hues, PR #83, branch `muse/45677884530`, head `f5cdb86`
- **Brief:** `muse-tasks/spa-preview-deploy.md`
- **Gate date:** 2026-11-25
- **Evaluator structure:** single evaluator (Quinn Assurance). No cold second rater commissioned for this infrastructure gate; severity ratings are single-evaluator and should be read with the evaluator effect in mind.
- **CI state taken as given:** Verify run 45689500734 and Lighthouse run 45689500859 both SUCCESS (per the gate assignment).

## Verdict: PASS WITH NOTES

No Blocker, Critical, or Major findings. One Minor defect (F-1, shield gap on a double-fault path), accepted as a note for the preview and flagged for the cutover checklist. The deployed-preview drive is still owed (see Coverage) — it belongs to the coordinator's post-deploy verification and Dustin's visual pass, and this verdict does not cover it.

## Verify counts reproduced by Quinn (not maker-claimed)

| Check | Result |
|---|---|
| `cd app && npm ci && npm run verify` (lint + typecheck + tests) | **exit 0 — 70 test files / 1445 tests passed**, exactly matching the CI workflow gate's reported counts |
| Root verify — `cd v2 && npm run verify` (v2 lint + typecheck + test, chained `verify:spa` = app ci + app verify) | **exit 0** — chain completed; chained app leg again 70 files / 1445 tests |
| `cd app && npm run build:worker` | **exit 0** — emits `dist-worker/client/` (populated: index.html, assets, machine files) and `dist-worker/worker/index.js` (93.00 kB) plus the SW build into the worker client dir |
| `deploy:preview` | Present in `app/package.json` (`wrangler deploy -c wrangler.preview.jsonc`); **not run** by builder or by this gate, per the brief |

This closes builder deviation 3: the full verifies the builder's session skipped are now run and green under independent execution.

## Deliverable checks

**1. Worker entry (`app/server/worker.ts` + `app/server/worker-handler.ts`) — present, as specified.**
Route parity against `app/server/serve.ts` was checked class by class in both sources: POST `/internal/revalidate` (incl. not-configured answer when the secret is unset, matching the brief's preview behavior), SSR floor POSTs `/report` + `/add-your-farm`, GET `/go/[id]` (numeric-id gate, status mapping, utm rename on relay), admin POST actions (sign-in request/verify/sign-out, review/decide, four section actions — same pattern and dispatch order as serve.ts), the admin GET gate (sign-in / code / no-access / waitlist-404 / protected), `/api/v1/*` and `/api/internal/admin/*` relays, `/healthz`, `/api/track`, `/api/client-errors`, `/og/[kind]/[slug]`, Static Assets with fall-through to Vike `renderPage`, and the per-isolate edge mock with the same keying rules (shared `edge-cache.ts`). Node mechanics translated as briefed: ASSETS binding for static reads, manual gzip dropped, `cf-connecting-ip` for socket IP, ONE catalog client + data cache + edge map per isolate. **The unsubscribe/describe path is NOT mounted** — the string appears only in an explanatory comment; no route answers it.

**2. Variety-status mount (`app/src/server/variety-status.ts`) — present, as specified.**
SELECT-only by construction: the mount's `VarietyStatusDb` interface exposes only prepare/bind/first (no run/batch/exec exists on the surface), both statements are single-row SELECTs with bound parameters, and a diff-wide grep found no D1 write call anywhere in the Worker entry. Contract matches the app + stub pin (`app/tests/stub/api-server.ts`): always `{status, merged_into}`; active row → active; `merged` row resolves to the survivor's slug, with the survivor required to be live (active, not soft-deleted) — the stub's merged map only ever contains valid targets, so this is the same contract with the database's failure modes handled; soft-deleted and absent slugs → unknown; draft/discontinued/unrecognized → unknown. D1 error → fail-closed 500 JSON from the handler (never a degraded "unknown" that would 404 a merged slug instead of redirecting it). Unit tests cover active / merged / absent target / deleted-or-retired target / no target id / soft-deleted / absent / non-public, plus a SELECT-only-and-bound-parameter assertion.

**3. Preview config (`app/wrangler.preview.jsonc`) — field-by-field match.**
Name `seeds-hues-preview` ✓; `workers_dev: true` ✓; no `routes`, no custom domains ✓; Static Assets binding `ASSETS` over `dist-worker/client` ✓; `main` = `dist-worker/worker/index.js` ✓; D1 binding `DB` → database_name `seeds-hues`, **database_id `dcc6098e-e48c-4906-ac79-72cc77e04042` — exact** ✓; vars `SEEDS_API_BASE=https://seeds.hues.flowers/api/v1` ✓, `SEEDS_TURNSTILE_SITE_KEY=0x4AAAAAAGE35WdI5cJcSOVu` — **verified character-for-character against `v2/wrangler.jsonc`'s `TURNSTILE_SITE_KEY`** ✓ (public site key, not a secret), `SEEDS_PREVIEW=1` ✓; `SEEDS_REVALIDATE_SECRET` absent ✓; no secrets anywhere in the diff (sweep found only the env-var name references and a test-fixture string) ✓; `wrangler` added as devDependency ✓; `deploy:preview` script added ✓ and not run ✓.

**4. Preview SEO shield — correct, behind the flag only.**
All responses are built through one responder (`respond` → `edged`) which forces `X-Robots-Tag: noindex, nofollow` over the merged route-class header set when `preview` is set, and the `/robots.txt` intercept (disallow-all body) sits before the Static Assets fall-through. The shared header module `app/src/server/headers.ts` is **not in the diff** — flag-off behavior is production-shaped by construction. The tests genuinely discriminate: the shield block asserts the header on HTML/JSON/asset/redirect/beacon/404 responses with the flag on, the disallow-all robots body with the flag on vs the production bytes with it off, and — with the flag off — production header values preserved exactly (`/healthz` keeps `noindex` only, a page keeps no robots tag, `/go/1` keeps its own `noindex, nofollow` pair, a custom asset Cache-Control survives). One gap: F-1 below.

**Additive build path — confirmed.** `vite.worker.config.ts` is a separate config; `build`, `build:server`, `serve` scripts unchanged. `scripts/build-sw.mjs` gained an env-var retarget that defaults to the previous path/wording behavior when unset. `serve.ts` itself was refactored — the edge-cache helpers and the admin false-positive scrub were extracted verbatim into `src/server/edge-cache.ts` / `src/server/admin-scrub.ts` and serve.ts now imports them (see Notes). The full suite passing unchanged is the behavioral evidence.

**House rules in the diff — clean.** Strict TypeScript with zero `any` in added TS (grep-verified; the two boundary casts in `worker.ts` are `as unknown as` adaptations at the ASSETS Fetcher seam, documented in place); no price content (only the pre-existing no-price scrub comment mentions the word); US spelling (no British forms in added lines); no placeholder stubs or TODO/FIXME in the new surface.

**Diff census — matches the PR body exactly:** 21 files, all under `app/`, +3684/−147. No `v2/` file touched; no production config touched.

## Findings

### F-1 — Minor — Shield does not cover the double-fault fallback response
- **Object:** `app/server/worker-handler.ts`, final catch fallback (`new Response("Internal Server Error", …)`, ~line 687).
- **Evidence:** directly observed in source. Every other response in the entry flows through the single shielded responder; this one bare `Response` is constructed outside it and carries no `X-Robots-Tag`.
- **Expected vs actual:** the brief requires *every* response under `SEEDS_PREVIEW` to carry the shield header. This path is reachable only when request handling has already thrown AND building the app's own 500 page inside the catastrophic catch throws again — a double fault. In that narrow case the preview would serve one unshielded plain-text 500.
- **Standard violated:** brief deliverable 4 ("every response the Worker serves"). Impact is bounded (preview-only, transient error path, noindex impact negligible for a 500), so Minor, not Major. Recorded so the cutover inherits the fix-or-accept decision explicitly rather than by silence.

### Notes (not defects)
- **N-1 — serve.ts refactor.** The brief said existing build/serve *behavior* stays unchanged; the builder also moved two helper blocks out of serve.ts into shared modules so the Worker composes the same code instead of a copy. Behavior is pinned by the unchanged, fully green suite (1445 tests incl. the parity crawl). Judged within the brief's intent — one shared implementation is the safer cutover foundation than a duplicated one — but recorded here because the diff touches serve.ts itself, which a reader of the PR body alone would not expect.
- **N-2 — `account_id` present in `wrangler.preview.jsonc`.** Not mentioned in the brief, not prohibited by it, and not a secret (it is an account identifier, also implied by any deploy). No action.
- **N-3 — `/api/track` records nothing in the preview entry** (always-204 wire contract preserved; the comment in the handler states the production Worker writes to the click service as Slice 9 mount behavior). Within the brief, which scopes the preview to the listed mounts; flagged so nobody reads preview beacon silence as a regression.

## Judgment on the builder's declared deviations

1. **/og relays production's rendered cards — ACCEPTED.** The mount contract claim was verified at the source: the relay's allowed kinds (`site`, `variety`, `seller`, `crop`) and slug regex are identical to `buildOgCard`'s own gate in `app/src/og/card.ts` (same regex, character for character), non-matching requests 404 without a fetch, non-200/non-image upstreams 404, and cache headers pass through. For a *visual* preview this is arguably the more truthful choice — Dustin sees the exact cards production serves today. The port's own renderer stays in-tree and unit-pinned (`app/src/og/render-edge.ts`, `app/tests/unit/og-edge.test.ts`). **Cutover condition:** Slice 9 must make an explicit, recorded choice between the relay and the edge renderer — the relay must not become the production behavior by inertia.
2. **`run_worker_first: true` + `not_found_handling: "none"` — ACCEPTED.** Without worker-first, matching asset responses bypass the entry entirely and neither the shield nor the robots intercept can apply to them — the deviation is what makes deliverable 4 true for assets. The handler's fall-through is correct: asset 404 → Vike render; the unit tests cover asset serving and fall-through under both flag states. Cost is a Worker invocation per asset request, acceptable for a preview; no evidence it threatens the cutover's budgets, and it is the architecture brief's own Static Assets shape.
3. **Builder ran only partial verifies in-session — CLOSED by this gate.** Quinn independently ran the full app verify and the root v2-chained verify from a clean `npm ci`; both exit 0 and the counts reproduce CI exactly (70 files / 1445 tests). The deviation leaves no residue.

## Coverage ledger

- **Population:** the four brief deliverables, the out-of-scope exclusions, the full app + v2 verify suites, the worker build output, and the deployed preview's live behavior.
- **Checked (structured):** wrangler config field-by-field incl. exact D1 id and Turnstile value against `v2/wrangler.jsonc`; full read of `worker-handler.ts`, `worker.ts`, `variety-status.ts`, `vite.worker.config.ts`; route-parity comparison of serve.ts vs worker-handler.ts mount by mount; stub contract comparison; diff-wide greps for D1 writes, `any`, secrets, prices, placeholder markers; shield + variety-status test discrimination read line by line; both verifies and `build:worker` executed locally with counts recorded above.
- **Checked (adversarial addition):** response-construction census (every `new Response` in the entry) — this is what surfaced F-1; OG relay gate compared against `buildOgCard`'s own validation rather than the builder's description of it.
- **Exclusions / boundaries:** the deployed preview does not exist yet (the brief forbids the builder deploying, and this gate deploys nothing), so **no live-browser drive of the preview URL was possible and none is claimed**. The human-interaction pass — loading the preview as Dustin will, on his phone, checking that pages render, assets carry the shield header live, and `/robots.txt` disallows — is owed by the coordinator's post-deploy verification before Dustin's visual pass is treated as covered. Suite-green plus browser-unrun is reported as exactly that, per the gate rule; it is a coverage boundary with a named owner (coordinator), not a defect in this PR, whose acceptance unit is the undeployed build.
- **Residual risk:** workerd-only behavior that neither the unit tests (Node doubles) nor the local build can exhibit — ASSETS binding semantics under `run_worker_first`, per-isolate state under real isolate churn, and the OG relay against the live production origin — remains unproven until the coordinator's deployed check. That is the class of defect this coverage could still miss, and it is precisely what the post-deploy verification exists to catch.

**Gate record written by Quinn Assurance, 2026-11-25. Nothing merged, nothing deployed by this gate.**
