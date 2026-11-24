# QUINN GATE — SPA Slice 2 REPAIR 2 (re-gate), PR #74

**Gate:** Quinn Assurance, independent build gate — FULL EXECUTION GATE
**Date:** 2026-11-24
**Subject:** PR #74, `github.com/dustinboling/seeds-hues`, branch
`muse/45431402089`, head `7d84e8385007d6218f7bc7276e67422c30995ace`
**Supersedes:** PR #73 (gate record `QUINN-GATE-spa-slice-2-repair.md`,
FAIL: F1/F2 Blocker, F5 Major, F4 Minor; F3 cured) and PR #72
(`QUINN-GATE-spa-slice-2.md`)
**Brief:** `muse-tasks/spa-slice-2-repair-2.md` (on main)
**Governing:** Bea's `PRERENDER-CONTENT-AUDIT.md` (§3/§5/§8.2/§8.3/§9),
`ROUTE-INVENTORY.md`, `BUILD-SEQUENCE.md`
**Gate worktrees:** `~/workspace/seeds-hues-quinn-slice2r2-wt` at PR #74
head and `~/workspace/seeds-hues-quinn-slice2r2-pr73-wt` at PR #73 head
(`82ca2ba`); all gate mutations restored, scratch tests deleted, both
worktrees tracked-clean at record time
**Evaluator structure:** single evaluator (Quinn). No cold second rater
was commissioned; usability remarks are single-evaluator and flagged.

## VERDICT: FAIL — narrow return

Every return condition from the PR #73 gate is cured, and each cure is
proven below by my own execution: the surface exists (F1), the
invalidation machinery is wired and demonstrated (F2), og separation
holds on every template (F3), robots is byte-exact (F4), and the test
suite now discriminates — all four mutations that sailed through
PR #73 fail it, and the new tests are red on PR #73's tree (F5).
One new Major found by this gate (F6) blocks the pass: the two nested
`/about/*` templates each emit **two complete, conflicting head
blocks**, so their canonical, description, and og:url are all
ambiguous in the emitted HTML. That is a defect in this slice's core
contract (Bea's head/canonical discipline) on 2 of 8 templates, and
the builder's tests cannot see it because they assert presence, never
exclusivity. Return is scoped to F6 (plus the Minor summary item,
F7); nothing else needs re-proving beyond regression at re-gate.

Four axes, kept separate per standing rule:

- **Severity:** 1 Major (F6, new), 1 Minor (F7). F1 (Blocker), F2
  (Blocker), F5 (Major), F4 (Minor) **cured and closed**; F3 remains
  closed. No Blockers on this head.
- **Evidence:** directly observed and measured throughout — my own
  clean-state reproductions of both verify chains, my own counts and
  byte diffs on the built artifact, four mutation break-proofs, an
  executed starting-red run on PR #73's tree, my own invalidation
  exercise with independent values, a live run of the lastmod script,
  and live-site fetches dated 2026-11-24. CI is corroboration, never
  the evidence.
- **Coverage:** full execution coverage — see the ledger. The one
  boundary is the standing one: no live-browser session in this seat,
  and no HTTP-mounted revalidate endpoint exists in an inert static
  build (see F2's closure note for exactly what was exercised instead).
- **Verdict conditions:** FAIL is unconditional on this head. Return
  conditions are F6's and F7's, consolidated at the end. The re-gate
  on the return is a delta gate (rebuild + head-exclusivity proof on
  all templates + full app suite + one mutation spot-check), not a
  full re-run of this record.

## Findings

### F1 — BLOCKER (PR #72/#73) — CURED AND CLOSED — The surface exists

Evidence (directly observed, executed):

- `app/pages/` at PR #74 head carries real routes for `/about/data`,
  `/about/bot`, `/api-docs`, `/privacy`, `/terms`, `/crop`, and a
  rebuilt home `/`, alongside the existing `/about` — each with
  `+Page`, `+Head`, `+config`, and `+route` files, and `+data` hooks
  on `/crop`, home, and `/api-docs` that call the data layer's
  loaders (`loadCropIndexData`, `loadHomeData`, `loadApiDocsData`).
- My clean build (`npm run build`, exit 0, PWA proof passed) emits
  into `dist/client`: all 8 HTML templates, `robots.txt`, `llms.txt`,
  `sitemap.xml` (index over exactly 7 segments) and all seven segment
  files — inventoried and read by me, not listed from the PR body.
- Raw HTML (emitted files; JS-disabled equivalent) per template:
  complete primary content present on every template; titles and
  canonicals correct on all 8 (subject to F6's duplication on two);
  `/crop` carries the live count line, breadcrumb, and ItemList
  JSON-LD; `/api-docs` renders the live OpenAPI endpoint inventory.
- Home `/`: the Slice-1 proof content is gone (no "Color tokens" /
  "Font stacks"); the emitted HTML contains **"We don't sell seed."**
  exactly (straight apostrophe, as the brief quotes it), the C3 motif
  via `HomeMotifDivider` on
  `images.seeds.hues.flowers/…/theme/divider-home.webp`, a working
  search form (`role="search"`, `action="/search"`), and the coverage
  line rendered from live data — at my build: *"818 varieties
  cataloged across 124 crops · 557 with a seller · 83 sellers · 1495
  listings · updated Nov 24, 2026."* JSON-LD: WebSite (with
  SearchAction) + Organization, both parsed by me; **no `"price"`
  string anywhere in the home HTML** — the no-price guard holds in
  the artifact, not only in its unit tests.
- Copy port spot-diff (mine): fragment-level comparison of
  `/privacy` and `/terms` against their `v2/` sources shows no copy
  divergence — the only differing fragments are code, metadata
  plumbing, and the pages' own header comments (including the terms
  page's disclosed US-spelling normalization). The surface test's
  marker assertions cover the remaining static pages against live
  data (see F5 closure).

### F2 — BLOCKER (PR #72/#73) — CURED AND CLOSED — Invalidation is wired and demonstrated on the built path

Evidence (directly observed, executed):

- Wiring, three real call sites (the brief's permitted shapes):
  (a) `+data` hooks invoke `load.ts`/`cache.ts` from the request/data
  path on `/crop`, home, `/api-docs`; (b) a new server module
  `app/src/server/revalidate-handler.ts` wraps
  `handleRevalidateRequest` as an HTTP-shaped handler (bearer auth,
  tag fan-out, purge callback); (c) the build plugin
  `app/scripts/vite-plugin-machine-files.ts` calls the single
  generation path `app/src/server/machine-files.ts`
  (`generateMachineFiles`) to emit the machine files into
  `dist/client` — the same function the revalidate regeneration path
  calls, so build output and regenerated output cannot disagree.
- `gen:sitemap-lastmod` is real: present in `app/package.json`, and
  **run by me** against the live API — exit 0,
  `kept=901 refreshed=0 droppedSeries=33 catalog_seq=4748` (the
  written file was restored after the run). No dangling references:
  both prior citations now name a script that exists.
- **My own invalidation exercise** (scratch test, my values, run and
  deleted): fake catalog crop count 10 → source changed to 42 and a
  new listed variety added → warm cache still served 10 (staleness
  shown first) → `handleRevalidateHttpRequest` with the variety tag
  → `/crop`'s loader returned **42** and the regenerated listed
  segment contained the new variety URL — no build between the write
  and the reads. The builder's committed `invalidation-loop.test.ts`
  proves the same loop with its values (10→11) and asserts the
  handler's fan-out (`/crop`, `/`, the listed segment) and auth
  rejection; both passed in my chain runs.
- Boundary, stated plainly: the inert build mounts no live HTTP
  endpoint — the handler's own header records the production Worker
  mount as the Slice 9 cutover contract, and the brief for this
  repair expressly permitted the handler shape. What this gate
  exercised is the exact handler + loaders + generation function
  that produced the built artifact in `dist/client`, which is the
  strongest exercise an un-deployed static slice admits. Library-only
  proof is not what closed F2; the +data wiring and the build-plugin
  generation path are in the product and were executed end to end.

### F3 — MAJOR (PR #72) — REMAINS CLOSED — og:image separation holds on every template

- Emitted HTML, all 8 templates (my greps on the built artifact):
  `og:image = https://seeds.hues.flowers/og/site/default`,
  `og:url` = the page's own canonical, `twitter:image` agrees — on
  every template, including home and `/crop`, which did not exist
  when F3 was cured. (On `/about/data` and `/about/bot` the correct
  tags appear — twice; the duplication is F6, not an F3 relapse: in
  neither instance does og:image carry a canonical.)
- The committed `og-separation.test.ts` pins the separation at unit
  and render level, and mutation M2 below proves it bites.

### F4 — MINOR (PR #72/#73) — CURED AND CLOSED — Robots byte parity, measured today

- My byte diff: the built `dist/client/robots.txt` vs the live file
  fetched by me 2026-11-24 (~16:44 UTC, 309 bytes) differs by
  **exactly Bea's three parameter disallows**
  (`/*?*sort=*`, `/*?*limit=*`, `/*?*session=*`) inserted after the
  carried set — nothing else. `cmp` against the builder's committed
  fixture `app/tests/fixtures/robots-expected.txt`: identical.
- Recorded discrepancy, for the record's honesty: the PR #73 gate
  described the then-live file as blank-line-separated between
  entries. The live file as fetched today carries no per-entry blank
  lines (entries contiguous; one blank line before `Host:`), and the
  renderer — unchanged since PR #72 — matches that format exactly.
  Substance agreed at both gates (carried set + precisely the three
  additions, patterns that cannot swallow `?page=`); the byte
  question is judged on today's fetch, taken twice with the same
  result. If the live format changed between gates, the current
  state is parity either way.

### F5 — MAJOR (PR #73) — CURED AND CLOSED — The suite now discriminates

Evidence (all executed by me; each mutation applied to PR #74 head,
targeted tests run, mutation restored, worktree verified clean):

1. **Route deletion** — `app/pages/terms/` removed →
   `slice2-surface.test.ts` **FAILED** (2 failed / 23 passed; the
   build no longer emits the route and the assertions say so).
2. **F3 reintroduced** — `SeoHead.tsx` og:image reverted to
   `tags.og.url` → `og-separation.test.ts` **FAILED** (1 failed).
3. **Pagination in a sitemap segment** — `"/variety?page=2"` added to
   `HUB_PATHS` → `sitemap-rules.test.ts` **FAILED** (1 failed).
4. **Robots disallow deleted** — `"/*?*session=*"` removed from
   `PARAMETER_DISALLOWS` → `robots.test.ts` + `machine-files.test.ts`
   **FAILED** (3 failed across the two files).

All four defects that passed PR #73's suite at 81/81 are now caught.
(The first M4 attempt's sed did not match and changed nothing; I
re-applied the mutation with an exact edit, verified the mutated
line, and only then counted the result.)

**Starting-red, executed** (not judged from construction): the six
new test files + fixture were copied onto PR #73's head in the second
scratch worktree and run — **23 failed / 11 passed, 3 files failed /
3 passed**. The surface test fails across routes, machine files, and
head contract; `machine-files` and `invalidation-loop` fail outright
(their `src/server/` modules do not exist on that tree). The three
passes are the expected ones: `og-separation` (F3 was already cured),
`sitemap-rules` (the library rules were already sound — Quinn
execution-verified them at the PR #73 gate), and `robots` (the
renderer already matched the live format; see F4). The brief's
requirement — tests red on the starting tree for the surface that
didn't exist — is proven for exactly the tests that define the
surface. The builder's PR body, however, nowhere states this red
result (see F7).

**Sitemap counts, verified by me on the built artifact** (grep counts
of `<url>` per segment in `dist/client`):

| Segment | Generated (mine) | Bea baseline (PR #73 record) |
|---|---|---|
| varieties-listed | 557 | 556 |
| varieties-zero-seller | 261 | 262 |
| sellers | 83 | 83 |
| crops | 124 | 124 |
| series | 33 | 33 |
| states | 32 | 31 |
| hubs | 11 | 11 |
| **Total** | **1,101** | **1,097** |

The deltas are live-catalog drift, not generation error: variety
total is unchanged at 818 (one variety gained a seller, moving
zero→listed), and one additional state appears. Decisively, the
surface test asserts — against live data at run time — that the
generated slug sets **equal the live sitemap's slug sets per type**
(varieties, sellers, crops, series, states), after first asserting
the live sitemap and the live API snapshot agree; that test passed
in both of my full chain runs and in my standalone build. Pagination
URLs: none in any segment (my grep). Removed seller: absent (my
grep; the test also asserts every emitted seller slug resolves in
the live snapshot). Lastmod: emitted only where the committed
cache's seq verifies against the live snapshot (test + the gen
script's real run, F2); crops/states/hubs carry none.

### F6 — MAJOR — NEW — /about/data and /about/bot emit two conflicting head blocks

Evidence (directly observed in the built artifact):

- Head-element counts per built template (mine): home, `/about`,
  `/api-docs`, `/privacy`, `/terms`, `/crop` each carry exactly
  1 canonical, 1 description, 1 og:image, 1 og:url. **`/about/data`
  and `/about/bot` each carry 2 canonicals, 2 descriptions,
  2 og:image, 2 og:url, 2 twitter:title** — their own head block
  followed by the parent `/about` page's complete head block
  (canonical `https://seeds.hues.flowers/about`, the /about
  description, og:url `/about`).
- Cause, visible in the sources: Vike accumulates `+Head` down the
  route tree — `app/pages/about/+Head.tsx` renders on the nested
  routes as well as on `/about`, and each nested route's own
  `+Head.tsx` adds its block instead of replacing the parent's.
  (The `<title>` happens to survive single — the duplication hits
  canonical/meta/og, not the title element.)
- Live v2 comparison: `https://seeds.hues.flowers/about/data` emits
  exactly one canonical (its own). The port target is unambiguous.
- Why it is Major, not Minor: the canonical is the load-bearing
  signal of Bea's head discipline ("canonical tags that agree").
  Two canonicals with different hrefs on one page leave the page's
  canonicalization to the crawler's discretion — the likeliest
  outcomes are the hint being disregarded entirely or `/about`
  being honored, either of which misrepresents two policy pages
  this directory specifically maintains for crawlers and data
  users (`/about/bot` is the crawler's own reference page). The
  defect sits in the emitted HTML of 2 of the slice's 8 templates.
- Why the builder's suite cannot see it: the surface test's head
  contract asserts presence with first-match reads
  (`expect(html).toContain(canonical)`, a `meta()` helper returning
  the first match — which is the child's own block, rendered first).
  No assertion counts occurrences. This is the pesticide paradox in
  its exact form: the new tests are strong where they look, and
  this is where they don't. The return must add the exclusivity
  assertion, not only the fix.

**Return condition:** each of `/about/data` and `/about/bot` emits
exactly one head block — one canonical (its own), one description,
one og:url, one og:image — with the other six templates unchanged;
and the surface test gains occurrence-count assertions (exactly one
canonical/description/og:url per template) that fail on the current
head and pass on the fixed one (demonstrated at re-gate by mutation:
re-adding a second block must fail the suite).

### F7 — MINOR — The PR body's summary still omits the brief's required accounting

The repair-2 brief requires the summary to state the Step-1 red
result, the route inventory against deliverables 1–6, the
invalidation demonstration and result, per-segment sitemap counts
(generated vs live), the robots byte-diff result, and anything
missing. PR #74's body (workflow-generated) states none of these —
it carries the verify summary (126 tests) and the file list only.
Every one of those facts is true and is proven in this record by my
own execution, so this is graded Minor, not a return on its own; but
the obligation was the brief's, twice breached now in spirit (PR #73
graded it inside F1), and the return PR for F6 must carry the five
statements for its delta.

**Return condition:** the F6 return PR's body states its head-count
evidence per template, the new exclusivity test's red/green results,
and — for completeness of this slice's record — the repair-2 items
above (route inventory, invalidation result, per-segment counts,
robots byte-diff), which this gate record supplies in the meantime.

## What passed (evidence, all reproduced by me)

**Verify chains — both green, from clean state.**
- App chain (fresh `npm ci` after wiping `node_modules` + `dist`):
  lint ✓, typecheck ✓ (both tsconfigs), **126/126 tests, 14 files**
  — exit 0. The suite's own build test rebuilt the app inside the
  run, so this green covers a from-scratch build.
- v2/ extended chain with `app/node_modules` and `app/dist` removed
  first: `npm ci` in v2, `npm run verify` (v2 lint + typecheck +
  tests) then `verify:spa` re-running the app chain green —
  **exit 0** end to end.
- **CI:** PR #74's Verify run **45440363591** finished
  **completed / SUCCESS** (2026-11-24 16:54Z, coordinator-relayed
  after its approval hold was released). Scope label as before: CI
  verifies `v2/` including `verify:spa`. This time the green is
  meaningful for Slice 2 as well, because F5's cure means the chain
  now contains tests that assert the slice exists — subject to F6's
  named blind spot.

**Inertness + scope discipline.** PR #74 vs its base: 55 files,
**all under `app/`** (verified against the PR's file list);
`v2/` untouched, zero `.github/workflows/*` changes, no deploy
config. Nothing deploys; the surface remains inert until cutover.

## Usability pass (single-evaluator; declared boundary)

No live-browser access in this seat; the surface is inert and never
deployed. Desk pass over the built HTML, goal taken: "land on the
directory, learn what it is, and follow the directory's own
references."

- Home now performs the goal: a first-time visitor gets the H1, the
  plain-language lede, the exact "We don't sell seed." statement, a
  visible search form, and live coverage numbers — the Slice-1 proof
  page's token swatches are gone.
- `/crop` answers its question at a glance (crop names with live
  variety counts, breadcrumb, ItemList markup); the static set reads
  in a sensible headed order with working cross-references to each
  other. The PR #73 gate's thirteen dead-end header/footer targets
  are reduced to the routes owned by later slices (`/variety`,
  `/seller`, `/search`, account flows) — expected at Slice 2, not a
  finding.
- F6 has no visible symptom for a human reader; it is a
  machine-facing defect and is graded as one.
- Remainder unchecked, named: real-browser rendering at phone
  viewport, focus behaviour, and hydration behaviour of the new
  templates — none affects this verdict, which rests on F6's emitted
  HTML.

## Coverage ledger

- **Population:** the full PR #74 diff vs base (55 files) and vs
  PR #73 (55 files); both verify chains; the built artifact (all 8
  HTML templates, all 9 machine files, dist inventory); the data
  machinery's wiring (pages' `+data` hooks, server modules, build
  plugin); the six new test files + fixture; the live robots.txt,
  live sitemap.xml, live API snapshot, and live /about/data head
  (fetched 2026-11-24); the v2 copy sources for two pages; CI run
  45440363591.
- **Structured sample checked:** all of the above — every template's
  raw HTML read for content/head/JSON-LD; every segment counted by
  me; robots byte-diffed by me; home's JSON-LD parsed; copy
  spot-diffed in full for `/privacy` and `/terms` (fragment level)
  with marker-level coverage of the rest via the executed surface
  test.
- **Adversarial additions:** four mutation break-proofs (F5 closure);
  the starting-red execution on PR #73's tree; the stale-cache step
  inside my invalidation exercise (the old count was served before
  the purge, so the flip is the handler's work, not luck); the
  head-occurrence counts that produced F6 — an adversarial read of
  my own green results.
- **Exclusions, with reasons:** live-browser session — no browser
  access in this seat (declared in the usability pass); HTTP-level
  exercise of the revalidate endpoint — no server exists in an
  inert static build (the handler + loaders + generator were
  executed directly; the Worker mount is Slice 9's recorded
  contract); per-URL diff of all 1,101 generated sitemap URLs
  against live — performed at slug-set level per type by the
  executed surface test in both chain runs, rather than by my own
  1,101-line diff.
- **Evaluator structure:** single evaluator; no second rater
  commissioned for this gate.
- **Residual risk:** this coverage cannot see defects in templates
  or states this slice does not own (variety/seller/search surfaces
  are later slices), nor hydration-only behaviour of the new pages
  in a real browser. Within the slice, the known-unseen class is
  now named by F6 itself: properties the tests assert by presence
  but never by exclusivity — the return's new assertions should be
  read as the start of that class's checklist, not its end.

## Consolidated return conditions (all required for a PASS)

1. **F6:** `/about/data` and `/about/bot` emit exactly one head
   block each (single canonical/description/og:url/og:image, their
   own values); all other templates unchanged.
2. **F6's test cure:** the surface test asserts occurrence counts
   (exactly one canonical, description, and og:url per template),
   demonstrably failing on the current head.
3. **F7:** the return PR body carries the brief's summary statements
   (head-count evidence, the exclusivity test's red/green, and the
   repair-2 accounting items listed in F7).

The re-gate on the return is a delta gate: clean app verify, the
built artifact's head counts on all 8 templates, one mutation
re-adding a duplicate head block (must fail), and regression of the
four F5 mutations. F1–F5 do not reopen unless the delta touches
their ground.

— Quinn Assurance, 2026-11-24
