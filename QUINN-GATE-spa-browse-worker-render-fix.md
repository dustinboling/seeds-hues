# Quinn Gate — PR #87: SPA browse/search Worker render crashes (cross-request promise chain)

- **Gate object:** PR #87, github.com/dustinboling/seeds-hues, branch `muse/45814847248`, head `1b04f49`, base `origin/main` `da8a5f6`. Bench run 45814847248.
- **Evaluator structure:** single evaluator (Quinn). No second rater commissioned for this gate; severity ratings are single-evaluator per the playbook's evaluator-effect rule.
- **Method:** every builder claim treated as unverified and reproduced in Quinn's own scratch worktrees (`wt/head`, `wt/base` under this folder). Diff inspected directly.

## VERDICT: PASS WITH NOTES

The fix is correct and complete for the defect it targets. Every check this environment could execute supports it; no evidence indicts it. Two gate-script legs (the all-200 fresh-isolate sequence on head, and the Playwright acceptance drive) could not be executed to completion **in this VM**, for a proven environmental reason documented in Leg 4 — a bare workerd fetch with no app code at all stalls >120 s here. Those legs remain **owed on the redeployed preview** (Hue's acceptance drive, which is also the brief's own return condition 2 for cutover). They are a coverage state, not a defect in this PR, and they block **cutover**, not this merge. No code repair is indicated; if the coordinator requires the full local drive before merge anyway, the return condition is a re-run in an environment whose workerd can reach the production API (the bench runner, or the deployed preview) — not a change to this diff.

---

## Leg 1 — Suite: PASS (directly observed)

`cd app && npm run verify` reproduced on the PR head in Quinn's worktree (lint + typecheck + vitest):

- **Test Files 74 passed (74); Tests 1,474 passed (1,474)** — matches the builder's claim exactly.
- New file `tests/unit/catalog-pacing.test.ts`: 7/7 green inside the suite.
- **No existing test weakened:** the diff touches exactly two files (`app/src/data/api.ts` +31/−9, new `app/tests/unit/catalog-pacing.test.ts` +220). No existing test file is modified at all.

## Leg 2 — Starting-red: PASS (directly observed)

Head test file run against the BASE tree's `api.ts` (base confirmed to still carry `let chain: Promise<void>` at api.ts:755):

- Case (c) — "a later call is not gated on any promise from an earlier completed call" — **RED on base: `AssertionError: expected 1 to be 2`**, character-for-character the builder's claimed output. Green on head. The test discriminates.
- Full base run: 2 failed / 5 passed. The second red is case (a) `paceMs: 0` — on the chain client the second fetch is gated on the chain's timer-backed trailing sleep even at pace 0, so it also fails on base for the same root cause. The (a) spacing and (b) 429 tests pass on **both** trees, confirming the pacing/429 contract is preserved by the fix rather than rewritten.

## Leg 3 — Grep sweep (independently re-derived): PASS with one note

Population: all `Promise`/`.then`/memoization/queue hits across `app/src`, `app/server`, `app/pages` on the head tree, plus every module-level mutable binding. The overwhelming majority are function return types and within-call `.then` continuations (created and awaited inside one call) — not stored state. Every hit that stores anything across calls:

| # | Location | What is stored | Disposition |
|---|----------|---------------|-------------|
| 1 | `app/src/data/api.ts` (the fix) | `nextSlotMs: number` | **FIXED.** Plain number; each `getRaw` reserves its slot synchronously and awaits only a `sleep()` created in its own call. No promise outlives its request. |
| 2 | `app/server/worker.ts` `isolateShared()` | `IsolateShared { api, cache, edge: Map }` | CLEARED — holds values (client, cache, Map of rendered entries), no promises. This is the fixed client from row 1. |
| 3 | `app/src/data/load.ts` `sharedApi/sharedCache` | client + cache singletons (Node/prerender fallback) | CLEARED — same objects as row 2; values, not promises. |
| 4 | `app/src/data/cache.ts` `createDataCache` | `Map<key, {value, fetchedAt, paths}>` | CLEARED — stores resolved values only; `get()` awaits its loader inside the caller's own request; there is no in-flight promise memoization. Untouched by the diff. |
| 5 | `app/src/server/edge-cache.ts` | edge entry Map | CLEARED — contains no Promise usage at all; stores rendered values. The F2 `.pageContext.json` bypass is intact (worker-handler.ts:625, serve.ts:611) and untouched by the diff. |
| 6 | `app/src/data/api.ts` `counts()` | `.then` chains on three `getRaw` calls | CLEARED — created and consumed by `Promise.all` inside the same call. |
| 7 | `app/src/og/render-edge.ts:40` `enginesInit: Promise<void> \| null` | module-level WASM-engine init promise | **NOTE (Minor, pre-existing, out of this diff's scope).** This is formally a stored cross-request promise. It is cleared *for this gate* because the Worker entry never calls it — `app/server/worker.ts`'s `renderOg` serves OG cards by relay fetch and its own comment records the edge renderer cannot initialize in workerd — so it cannot poison any browse/search render. Flagged for the coordinator's backlog: if the edge OG renderer is ever wired into the Worker, this promise must get the same treatment (or a dropped-settlement guard) first. |
| 8 | `app/src/components/ui/Turnstile.tsx:27` `loader: Promise<void> \| null` | script-load promise | CLEARED — browser-only (guards on `window`), lives and dies with the page; never exists in a Worker isolate. |
| 9 | `app/src/components/browse/InPlaceNav.tsx` | in-flight navigation guard (id counter) | CLEARED — client-side router state in the browser; the stored value is a navigation id, not a promise awaited across Worker requests. |

No other cross-request promise state found. The builder's claim ("only the api.ts chain was live") is consistent with this independent sweep, with row 7's nuance added.

## Leg 4 — workerd regression: PASS on mechanism (A/B discrimination reproduced); head all-200 sequence NOT executable in this VM (environmental, proven)

Both trees built with `npm run build:worker` and served fresh via `wrangler dev -c wrangler.preview.jsonc` on separate ports/isolates. Identical script: `GET /` → `GET /search?q=<unique token>` → `GET /variety?color_family=white`.

**BASE (defect reproduced):**
- `GET /` → 200 (0.17 s)
- `GET /search?q=<token>` → 500 at 30.2 s (data-hook timeout — the chain's first poisoning)
- `GET /variety?color_family=white` → **500 in 0.22 s (fast)**
- `GET /crop/snapdragon` (another fresh read) → **500 in 0.07 s (fast)**
- Wrangler log contains the defect signature verbatim, ×2: *"Error: This promise was created by a request that has since ended, so it can never settle. With the handle_cross_request_promise_resolution compatibility flag…"*

**HEAD (no poisoning under identical conditions):**
- `GET /` → 200
- Search and variety legs → 500 at ~30 s each — every one a Vike **data-hook timeout**, never a fast failure, across ~8 fresh-read attempts on two separate fresh isolates.
- **Zero** "can never settle" errors in either head isolate's log (base: 2).
- On head isolate #1, after the first (timed-out) search attempt's reads completed in the background, the identical search URL re-served **200 in 35 ms** — head's reads finish and the isolate stays healthy; a poisoned isolate fast-fails instead, as base demonstrates.

**Why head's legs time out here (control experiment):** a minimal throwaway Worker whose entire code is one `fetch("https://seeds.hues.flowers/api/v1/varieties?limit=1")` — no catalog client, no pacing, no chain — was served by the same wrangler on this VM; the fetch **never returned in 120 s** (three attempts). The same walk from Node takes 8.7 s total (831 items, 9 pages, measured). Conclusion: workerd egress from this VM to the production API stalls independently of the code under test; Vike's 30 s hook timeout fires before fresh reads complete. This is the same VM class of limitation the brief records for the deployed preview (ERR_TUNNEL_CONNECTION_FAILED). The builder's all-200 post-fix sequence was produced on the bench runner; it is consistent with everything observed here but is **maker-claimed, not Quinn-verified**, and is owed again on the redeployed preview.

## Leg 5 — Browser drive: NOT RUN — environment-blocked (coverage gap, named)

The acceptance drive runs against the locally served head Worker. Because fresh SSR reads cannot complete within the 30 s hook timeout in this VM's workerd (Leg 4 control), the drive's pages cannot load here at all; no crash, error boundary, or wrong count was observed — the surface itself is unreachable from this environment. Per the playbook, this is declared **unchecked, not passed**. The owed pass, verbatim from the gate script, on the redeployed preview (or any host whose workerd can reach the API):

- /variety 831 → tap White → **125 in place** (window marker survives; pressed chip + applied row) → Clear All → 831 in place
- /search?q=zinnia → ~51 results → White filter → 2
- /crop/snapdragon 71 → White → "5 varieties match" → Clear All → 71
- Back-navigation from filtered /variety to unfiltered /variety — no error boundary

This is the brief's existing return condition 2; it gates preview acceptance/cutover.

## Scope confirmations (directly observed from the diff)

- Diff is exactly `app/src/data/api.ts` (+31/−9) and new `app/tests/unit/catalog-pacing.test.ts` (+220). **Nothing else.**
- `v2/`, workflows, `app/src/data/cache.ts`, and the edge mock (`edge-cache.ts` + the `.pageContext.json` bypass) are untouched.
- Facet-count semantics untouched — no browse/count code in the diff; the filtered crop view's White chip reading "71 varieties" is the recorded production-matching behavior and was not "fixed."
- The 429 path in `getRaw` (Retry-After backoff, max retries, error mapping) is byte-identical outside the pacing replacement, and is pinned green on both trees by the (b) tests.

## Findings

| # | Severity | Evidence | Finding |
|---|----------|----------|---------|
| F1 | Note (coverage) | Measured (Leg 4 control) | Legs 4-head-sequence and 5 are unexecuted in this VM due to workerd egress stall; owed on the redeployed preview before cutover. Not a defect in the PR. |
| F2 | Minor | Directly observed (code read) | `render-edge.ts` `enginesInit` is a pre-existing stored cross-request promise, currently unreachable from the Worker entry (OG is relay-served). Backlog item if the edge OG renderer is ever wired in. Not in this diff; does not gate this merge. |

## Coverage ledger

- **Population:** the two-file diff; the full verify suite; the pacing contract's three cases; all stored-promise candidates in `app/src`+`app/server`+`app/pages`; workerd behavior of both trees under the scripted sequence; the browser acceptance script.
- **Checked:** suite (full), starting-red (exact), sweep (full population, table above), workerd A/B (full script on base; head run with the environmental limit proven by control), diff scope (full).
- **Excluded:** the Playwright drive and head's all-200 workerd sequence — environment-blocked, reason proven, remainder owned by Hue's redeployed-preview acceptance drive.
- **Residual risk:** a defect that only manifests in a real browser against a *completing* Worker build (e.g. a client-side regression in the in-place filter path) would not be caught by anything run here. The diff touches no client/render code, which bounds that risk, but the owed drive is the only proof for it and must not be skipped at cutover.
