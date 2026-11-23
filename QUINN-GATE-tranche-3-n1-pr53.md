# Quinn Gate — N1 repair (Tranche 3), PR #53 — restore the /search page-view search_events log

**Verdict: PASS** — all four confirmation claims proven by my own execution; no findings. One informational observation (no severity, no action owed) is recorded under Claim 1.

**Target:** PR #53, head `3451247` — branch `muse/45154953803`, base `origin/main` `a95a4a1`. Delta audited: exactly 3 files, +99/−5 — `v2/app/search/page.tsx` (+4/−2 incl. comment), `v2/lib/services/catalog.ts` (+8/−3 incl. comment), new `v2/tests/contract/search-page-logging.test.ts` (+88). Brief: `muse-tasks/tranche-3-n1-search-logging-repair.md`. Baseline: `QUINN-GATE-tranche-3-1b1-pr51.md` (N1, Major, analytics-only, accepted as this follow-up).

Four axes, kept separate: **Severity** (no defects found) · **Evidence** (directly observed — my own `npm ci` + full verify with captured exit code, the pin test run in isolation on both trees, a six-case ad-hoc probe I wrote and ran against a real test D1 and then deleted, git-history recovery of the pre-completion shape, and line-by-line diff audits; nothing rests on the PR body's say-so) · **Coverage** (ledger at the end) · **Verdict** (this line).

---

## Claim 1 — Exactly one `web/search-page` row per /search server render, same fields as pre-completion — PASS

**Recovered pre-completion shape (from git history, not the PR body):** at `fbf625e` (the tree before PR #51's completion `a6adefd`), `v2/app/search/page.tsx` called `catalog.search(q, { …, logClient: "web/search-page" })`. That write goes through the shared `logSearch(query, resultCount, client)` helper, which inserts via `insertSearchEvent`: `at` = current ISO timestamp, `query_normalized` = `foldText(query).slice(0, 100)`, `result_count` = the search total (0 on the under-minimum-length branch, which also logs when the query is non-empty), `client` = the tag sliced to 60, and `clicked_variety_id` never set → NULL. Table shape (`v2/migrations/0002_delta.sql`): `id, at, query_normalized, result_count, clicked_variety_id, client`.

**Field-by-field comparison, PR head vs pre-completion:**

| Field | Pre-completion (`catalog.search`) | PR #53 (`catalog.browseSearch`) | Match |
|---|---|---|---|
| `at` | `new Date().toISOString()` via `logSearch` | same `logSearch` — **byte-identical function** (diffed `fbf625e` vs head: identical) | ✓ |
| `query_normalized` | `foldText(query).slice(0, 100)` | same helper, same normalisation (`normaliseQuery` upstream in both) | ✓ |
| `result_count` | search total; 0 on short-query branch | browse payload total (`main.total`); 0 on the same short-query branch | ✓ fields — see observation |
| `clicked_variety_id` | NULL (never set) | NULL (never set) | ✓ |
| `client` | `"web/search-page"` | `"web/search-page"` (only the page passes it; grep census below) | ✓ |

**Observation (informational, no severity, no action):** the *counting source* behind `result_count` changed with 3.1b-1 itself, not with this PR — pre-completion's total was `vr.matchCount + crops + series + sellers` from `catalog.search`; the restored row carries `browseSearch`'s payload total, i.e. **the exact number the shipped page renders** ("51 results"). The field set, tag, null-click, and short-query-0 behavior are identical; the value is now consistent with what the shopper sees, which is the faithful restoration under the shipped surface. I record it so nobody later mistakes the value source for part of this repair.

**Execution evidence:**
- Pin test in isolation on the PR head: `npx vitest run tests/contract/search-page-logging.test.ts` → **2/2 passed** — one render of `SearchPage({ q: "zinnia" })` moved the `search_events` count by exactly +1 and the latest row equalled `{ query_normalized: "zinnia", result_count: <browse total>, clicked_variety_id: null, client: "web/search-page" }`.
- My own ad-hoc probe (six cases, real test D1, deleted after the run): **two renders → exactly two rows** (one per render, no dedup, no double-write); the silent (no-`logClient`) probe call returned total **51** for `zinnia` (groups: crops 1, series 0, varieties 50, sellers 0) and both written rows carried `result_count: 51`; an empty-q render and a whitespace-only-q render wrote **none** (matching pre-completion, where no `q` meant no service call); a one-character query (`"z"`) wrote **exactly one row with `result_count: 0`** — the pre-completion short-query shape, preserved through the new branch in `browseSearch`.

## Claim 2 — In-place refinements write none; SearchBox autocomplete logging untouched — PASS

- The browse route is the only other `browseSearch` caller: `v2/app/api/browse/search/route.ts:40` calls `browseSearch(q, { filters })` — no `logClient` (file is not in the PR delta; read directly). Grep census over `v2/app`, `v2/lib`, `v2/components`: `logClient: "web/search-page"` occurs **only** at `v2/app/search/page.tsx:39`.
- Pin test, second case: `GET /api/browse/search?q=zinnia&life_cycle=perennial` → **200, count unchanged**.
- My probe, same direction at the payload level: the route returned **200 with `total` identical to the silent service call** for the same filters, and the row count did not move.
- Autocomplete: `SearchBox.tsx` and the `/api/search` handler (`v2/lib/api/handlers.ts:274`, which passes the `X-Client: web-autocomplete/1` tag through to `catalog.search`) are **both outside the delta** (empty diff). Probe confirmation by execution: `catalog.search("zinnia", { logClient: "web-autocomplete/1" })` still writes a `web-autocomplete/1` row; across the whole probe the only client tags present in `search_events` were `web/search-page` and `web-autocomplete/1` — **no new event kinds**.

## Claim 3 — The pin test is non-vacuous — PASS (proven both directions myself)

- **On the PR head `3451247`:** the pin file passes — 2/2 in isolation (above) and inside the full verify (§Verify).
- **On current main `a95a4a1`:** I created a second scratch worktree at `a95a4a1`, copied in **only** the new test file (worktree status: the single untracked test file, nothing else), ran `npm ci` and just that file → **exit 1: 1 failed / 1 passed**. The failure is exactly the N1 defect: `AssertionError: expected +0 to be 1` at the row-count assertion after one `SearchPage` render — zero rows written on main. The refinement case passes on main too, as it should (silence was never broken there). The scratch worktree was removed afterwards; the PR worktree is clean.

## Claim 4 — /search's shipped behavior otherwise unchanged vs the PR #51 baseline — PASS

What covers this, precisely:

- **The page's rendered tree cannot differ:** diffing `v2/app/search/page.tsx` against `origin/main` shows changes on exactly two lines — the expanded comment and the single service call gaining `logClient: "web/search-page"`. Every JSX line is byte-identical.
- **The payload cannot differ:** in `catalog.ts` the only behavioral additions are two `await logSearch(...)` side-effect calls (normal branch and short-query branch); the payload construction and `parse(...)` return are untouched, and `logSearch` swallows its own errors (`Logging must never break search`), so even a logging failure cannot alter or break the render.
- **Numbers match the PR #51 gate record to the digit:** my probe's `zinnia` total is **51** (PR #51: "51 results for "zinnia"") and the `life_cycle=perennial` filtered total is **0** (PR #51: that combination "genuinely yields 0 — API-confirmed", rendered as the designed zero state). The filtered page render wrote one row carrying that same 0.
- **The full suite** (§Verify) is green, including the surfaces' contract and census tests (`browse-crops-search`, `browse`, `api`, the tranche-3-1b1 census) that pin the payload contract and the in-place machinery.
- **Not run, named rather than rounded up:** no fresh browser drive of /search was performed in this gate. The delta touches no client code, no component, and no JSX — the interactive surface gated by drive at PR #51 is byte-identical — and the one changed behavior is a server-side persistence side effect, which a browser cannot observe except through the readback I performed (entered → persisted → readback, the full chain for this change). A browser pass remains available to the coordinator's post-merge live verification, as with every gate.

## Fences — PASS

- Diff census: `git diff origin/main...HEAD --stat` = the 3 claimed files, +99/−5, nothing else. No other surface's logging changed (grep census, Claim 2). No new event kinds (probe tag census, Claim 2). No price anywhere: the string `price` does not appear in the diff (the one hit in `catalog.ts` is the pre-existing header comment "no price ever leaves this layer", untouched context).

## Verify reproduction — PASS

In the pre-materialized worktree (`3451247`), `npm ci` (exit 0) then `npm run verify` run to a captured exit code: **VERIFY_EXIT=0 — lint, typecheck, and 72 test files / 1,194 tests, all passing**, with **no timeouts** in this run. The delta vs the PR #51 gate's counts (71 files / 1,192 tests) is exactly the new pin file (+1 file / +2 tests). My ad-hoc probe file was deleted before this run, so the counts are the PR's own.

## Usability pass

**Evaluator structure: single evaluator (Quinn); no cold second rater commissioned** — this gate's verdict rests on persistence facts and readbacks, not rated impressions. **No interactive flow changed:** the delta contains no client component, no JSX, and no control; the flows driven and passed at the PR #51 gate (search, filter toggles, zero state, Clear All) run on byte-identical surface code. The changed behavior — one analytics row per server render — has no shopper-facing surface to drive; its user is the admin Statistics reader, and for that reader the chain was proven end to end (render → row persisted with the rendered total → readback). Boundary: production Statistics readback after merge is the coordinator's live check, not performed here (pre-merge gate).

## Coverage ledger

- **Population:** the brief's four work lines and fences — one row per render with the pre-completion shape, refinement silence, comment/code agreement (the stale "Never logs" premise is replaced by the accurate `logClient` wording in both files — read in the diff), the pin and its non-vacuity, surface/payload invariance vs PR #51, diff confinement, no-new-events, no-price.
- **Checked:** full verify with captured exit 0 (72/1,194); pin in isolation on both trees (pass on head, fail on main at the exact assertion); six-case probe against a real test D1 (repeat renders, empty/whitespace q, short query, filtered render + route parity, autocomplete path, tag census); git-history recovery of the pre-completion page and its logging helper, with `logSearch` diffed byte-for-byte; caller census for `browseSearch` and `logClient` across app/lib/components; page JSX diff vs main; price scan of the diff.
- **Partial:** `at`-timestamp correctness is covered by the shared helper's byte-identity and the NOT-NULL insert succeeding, not by an explicit timestamp assertion in my probe (the pin asserts the four content fields; the row's existence proves `at` was written). Filtered-render coverage used the life-cycle group; other filter groups share the same single call site and code path.
- **Exclusions:** production deployment and live Statistics (post-merge, coordinator's); a fresh browser drive of /search (reasoned under Claim 4, not silently skipped); other surfaces' logging beyond the grep census and the unchanged-diff fact.
- **Residual risk:** the evidence is service/server-component level against the project's real test D1 and real catalog data — high fidelity for a persistence side effect, short of a deployed-server drive. A defect that only manifests in the deployed Worker's D1 binding (rather than the service layer) would escape this gate and be caught only by the post-merge live check.

**Gate record filed by Quinn Assurance, 2026-11-23. Verdict: PASS — N1 is closed; merge may proceed.**
