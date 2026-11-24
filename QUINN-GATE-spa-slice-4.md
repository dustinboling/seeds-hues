# QUINN GATE — SPA Slice 4: Browse + search (Seed Directory SPA conversion)

- **Subject:** PR #77, github.com/dustinboling/seeds-hues — "Slice 4 — Browse + search", head `7a59750f`
- **Reviewer:** Quinn Assurance (independent; did not make this work). Single-evaluator gate (see Coverage ledger).
- **Worktree:** `~/workspace/seeds-hues-gate-slice4-wt` at the PR head. No fetch/checkout/worktree/clone run; all work on disk.
- **Contract, in order:** (1) build brief `muse-tasks/spa-slice-4-browse-search.md`; (2) Bea's audit `spa-conversion-2026-11-23/PRERENDER-CONTENT-AUDIT.md` §1, §1.1, §1.2, §1.3, §4.1, §4.2, §4.3, §4.6, §8.4 (?page=1 row), §9; (3) Slice 3 gate record `QUINN-GATE-spa-slice-3.md` carry (b). All read in full.
- **Date:** 2026-11-24 (America/Los_Angeles)

## VERDICT: PASS WITH NOTES

No Blocker, Critical, or Major defect found. Every contract check passed: both verify chains reproduced clean (app 441/33, v2 1576/105), my independent built-artifact drive passed 38/38 with expectations computed by hand from the fixture definitions, my independent in-place drive of the seller surface passed 2/2, and all four mutation spot-proofs were noticed by the suite. The Slice 3 carry (b) is **discharged**. Two rulings were required (§6): the sort-only facet claim is **upheld as conformant**, and the missing Step-1 starting-red statement is ruled a **Minor accounting finding** that does not block, because the discriminating power it was meant to evidence is independently established at this gate. Notes are Minor/Trivial plus the declared browser-fidelity boundary (§8). Severity, evidence, coverage, and verdict are kept on separate axes throughout.

---

## 1. Verify chains (executed by me, clean install)

| Chain | Result | Evidence |
|---|---|---|
| app `npm ci` | exit 0 (588 packages) | directly observed |
| app `npm run verify` (lint + typecheck + test) | **exit 0 — 33 test files, 441 tests, all passed** | directly observed; matches the builder's claimed final green exactly |
| Slice 4 HTTP suite within it | `tests/build/slice4-browse.test.ts` — 78 tests passed | directly observed (also re-run standalone under each mutation, §4) |
| v2 `npm ci` + lint + typecheck + test | **all green — lint exit 0, tsc exit 0, 105 files / 1,576 tests passed** | directly observed |
| Final confirmation `npm run verify` after mutation restore + gate-file removal | exit 0; `git status` clean (tree byte-identical to the PR head) | directly observed |

Builder accounting checks:
- **Final green 441 / 33 — CONFIRMED by my own runs (twice).**
- **Continuation arithmetic reconciles exactly.** Final build-layer files: slice4 78 + slice3 37 + slice2 33 + pwa-build 1 = 149; unit/stub/DOM = 441 − 149 = 292. The continuation claimed arriving to 78/78 HTTP + 277/277 unit/stub/DOM and adding the autocomplete (9) + in-place (6) DOM suites: 277 + 15 = 292. Exact.
- **Head exclusivity "9/9 templates, 45 assertions" — CONFIRMED by construction** (9 URLs × canonical/description/og:url/og:image/title) and independently re-counted on 4 different URLs in my own suite (§2).
- **Facet audit "34 filtered + 3 sort-only" — CONFIRMED** (the shipped audit asserts `FILTERED` length 34; my independent enumeration of 8 further combinations also conforms, §3).
- **Fixture counts — CONFIRMED:** 55 varieties (5 curated + 50 synthesized) → 3 pages; 26 sellers → 2 pages; hues/seasons/life-cycles span as the brief requires; the 7-variety small-farm subset verified live in my drive (§2).
- **Step-1 starting-red — NOT FILED by either build run.** Ruled on in §6(b).

## 2. My independent raw-HTML drive of the built artifact

I wrote my own contract suite (38 tests: my own harness copy, my own counting/grep/price code, expectations computed by hand from `tests/unit/browse-catalog.ts` — pink = 17 synthesized + 5 curated = 22; pink∩warm = 8 + Pink Lady + White Night = 10; Kansas = 8 farms + Prairie Seed House = 9), built the app against the test stub, served it through the shipped harness, fetched with plain HTTP (no JavaScript), then deleted the suite. **Result: 38/38 passed.** (One initial failure was a defect in my own test — I picked a list-only fixture slug for the ?v= landing chain; only the four Slice-3 detail fixtures have detail records, so that detail 404 is fixture truth. Corrected to a with-detail slug and re-run green; the product was correct throughout.)

- **/variety paging:** pages 1–3 tile the catalog 24+24+7, ItemList positions continuous 1–55, zero name overlap, self-canonical on pages 2 and 3, §9 cache headers on every page, page-2 prev/next anchors real.
- **Filtered semantics (my own combos):** pink alone (22, noindex, canonical exactly `/variety`); pink AND warm (intersection of 10 — Testbloom 04/10, Pink Lady, White Night present; Testbloom 01/07, Blue Ribbon, King's Ransom absent — OR-within/AND-across proven); `?small_farm=true` (exactly the 7-variety subset, noindex).
- **/seller:** pages tile 26 (24 + 2 at positions 25–26, page-2 self-canonical); `?state=KS` — 200, noindex, canonical `/seller`, "9 sellers in Kansas.", Prairie present, Blue Ridge absent.
- **/search truthfulness (invariant form):** for `q=testbloom` the heading total (57) equals the sum of rendered group anchors (50 varieties + 1 crop + 1 series + 5 sellers); for a second query (`q=blue`) the same invariant holds multi-group (Blue Ribbon + Blue Ridge Seeds). Zero-results (`q=qqqq`): 200, "Nothing matches", `/report?type=correct` link, noindex, canonical `/search`. §9 headers on search responses.
- **Exclusivity + price + absences on my samples:** exactly one canonical/description/og:url/og:image/title on `/variety?color_family=pink`, `/variety?sort=recent`, `/seller?state=KS`, `/search?q=blue`; my own prohibited-string grep (Bea §1.1 list, applied to parsed JSON-LD and visible text) and `$`-amount grep clean on every sampled template; no loading/skeleton text anywhere sampled.
- **Structured data (§1.1 diff, new templates):** `/variety` and `/seller` each emit exactly `BreadcrumbList` + `ItemList` ("Flower seed varieties" / "Flower seed sellers", page-window items, continuous positions) — exact match to §1.1's rows; nothing added, nothing prohibited. `/search` emits no ItemList (correct — §1.1 lists none for search).

## 3. Status / redirect matrix, facet audit, cache (my own fetches)

**Redirects — all single 301, exact Location:** `/varieties` → `/variety`; `/variety?v=cosmos-pink-lady` → `/variety/cosmos-pink-lady`; `/sellers` → `/seller`; `/sellers/prairie-seed-house` → `/seller/prairie-seed-house`; `/seller?s=prairie-seed-house` → `/seller/prairie-seed-house`; `/variety?page=1` → `/variety`; `/seller?page=1` → `/seller`; `/variety?season=cool&page=1` → `/variety?season=cool` (other params preserved, one hop by construction).

**Slice 3 carry (b) — DISCHARGED.** `/varieties` → 301 → `/variety` returns **200** ("Flower seed varieties"); `/variety?v={slug}` → 301 → the variety page returns **200**. Both chains re-tested end-to-end at this gate, by the shipped suite and by my own fetches.

**True 404s (404 page body, never a 200 shell):** `/variety?page=4`, `/variety?page=` (empty), `/seller?page=3`, `/seller?page=-2`, `/variety?color_family=pink&page=2` (past the filtered end). The shipped suite additionally covers `?page=99/0/-1/abc/2.5` on both indexes.

**Facet canonical audit (independent enumeration):** `/variety?method=trays`, `?life_cycle=perennial`, `?small_farm=true`, `?color_family=pink,white`, `?season=warm&method=direct`, `?season=cool&page=2`, `/seller?state=CA`, `/search?q=pink&season=warm` — every one 200, `noindex, follow`, canonical exactly the clean route with no query string surviving. Combined with the shipped 34-URL audit, no parameterized URL the UI can produce escapes §1.3's filtered rule. Filtered + paginated correctly canonicalizes to the clean page-1 route (the §4.1 composition).

**Sitemap:** `/sitemap-hubs.xml` contains the clean `/variety` and `/seller` hub entries and zero `page=` URLs (shipped suite checks all 8 segments the same way).

**Cache (§9):** data-cache keys embed the full state — variety result keys carry the serialized filter set (season/method/lifeCycle/hue-set/smallFarm/sort) + page; seller keys carry state + page; search keys carry q + filter state — so a filtered view can never be served as the clean page (code read, `src/data/load.ts`). `pathsForTag` fans `list:variety`/`list:seller` and the entity tags out to `/variety`, `/seller`, `/`, and the sitemap segments (§9 fan-out). **My invalidation proof (different write path than the builder's):** warmed `/seller`; renamed Testbloom Farm 01 in the stub; confirmed the stale name served first; POSTed `list:seller` to `/internal/revalidate` (paths include `/seller`; purged keys include `browse:seller:*`); re-fetched without cache-busting — the renamed seller renders. The builder's own proof (variety rename via `list:variety`) also passes in the shipped suite.

**Price guard — BOTH halves (§1.2):** (1) *Code guard:* `assertNoProhibitedJsonLd` with the full §1.1 list runs at render in `JsonLd` and is exercised in verify (`jsonld-guard.test.ts`, 18 tests, green; `price-guard.test.ts` proves the rendered-HTML checker's sensitivity). (2) *Rendered-HTML check:* the shipped suite's guard plus my own independent grep (§2) — zero violations on every sampled template. Packet sizes present and correctly not flagged.

## 4. Mutation spot-proofs (suite sensitivity — each applied, run, restored byte-identical)

| # | Mutation | Outcome |
|---|---|---|
| M1 | Page-2 canonical forced to page 1 (`varietyBrowseHead` path → `/variety`) | **NOTICED** — 1 test failed (the page-2 self-canonical check) |
| M2 | Filtered view loses `noindex` (`noindex: filtered` → `false`) | **NOTICED** — 5 tests failed (filtered-view + facet-audit checks) |
| M3 | Out-of-range range check removed (`resolveVarietyBrowse`) | **NOTICED** — 3 tests failed (HTTP 404 matrix + route unit checks) |
| M4 | Sellers group dropped from search rendering, total unchanged (`SearchBrowse`) | **NOTICED** — 1 test failed (per-group truthful-count check — the Tranche 3.4 guard fires) |

All four mutations were caught. Tree restored after each (backups byte-copied back; final `git status` clean and final full verify green, §1).

## 5. Usability drive (shopper goals)

Evaluator structure: single evaluator (Quinn); Nielsen 0–4 for usability items. Modes: JS-disabled raw HTML (full fidelity, §2–§3) for the SSR floor, plus hydrated drives at jsdom level — the shipped DOM suites (read line-by-line, run green) and **my own independent DOM drive of the /seller surface** (2 tests, my own code, deleted after the gate).

**Flow 1 — "Show me flower varieties, narrow to what I want, turn the page."** SSR floor: every filter chip is a real link carrying its per-option count; the applied row shows one remover per selected hue plus Clear All; the count line states total, filter labels, ordering phrase, and page ("33 varieties · White · Yellow, alphabetical. Page 1 of 2."). Hydrated (shipped drive, verified): filter tap → `aria-busy` on the region immediately, results swap in place on settle with no reload and no scroll loss; sort tap → one navigation, ordering phrase updates; page turn intercepted in place; Clear All drops the filters and **keeps the sort** (`/variety?sort=recent`); rapid taps settle last-wins. **No finding.**

**Flow 2 — the pending cue actually renders (the continuation's found gap, verified three ways).** (a) Code: `.browse-pending` in `src/variety.css` carries a 4px hairline (`::before`, `background: var(--sys-color-accent-strong)`, pulsing) + a wash (`::after`, accent-tint at 60%), with `prefers-reduced-motion` and `forced-colors` handling — real CSS behind the class, not a bare toggle. (b) My DOM drive: on the seller surface the class is absent at rest, absent before 200ms, present past 200ms in flight, cleared synchronously with the swap; `aria-busy` set for the whole flight. (c) Tokens read from disk: `--sys-color-accent-strong: #1B4332`, `--sys-color-accent-tint: #e3ead8` — exactly the builder's disclosed mapping (v2 leaf `#1e4634` → DS leaf-deep; wash identical). The cue is decorative pseudo-elements; assistive tech is served by `aria-busy` + the polite count line, which changes exactly once per commit. **No finding.**

**Flow 3 — "Find sellers in my state."** My own drive: Kansas tap → one in-place navigation to `/seller?state=KS`, count line settles to "9 sellers in Kansas", the single State remover appears, and Clear All correctly does **not** (v2's §2.6.2 bounded exception, also asserted in raw HTML by the shipped suite). State views link onward to the indexable `/state/{slug}` page. **No finding.**

**Flow 4 — "Search for a variety by name."** The bare `/search` form is a plain GET form (works without JS) with guidance copy and browse chips. Hydrated combobox (shipped drive, read + green): pristine on mount (no fetch, focus alone never opens), 2-character minimum, 300ms debounce, top-10 rendered in the API's ranked order, ArrowUp/Down with `aria-activedescendant` + visible active row, Enter follows, Escape closes, mouse hover/click parity, "No suggestions — press Enter to search." notice announced once via the status line, failure row keeps the form submittable. Grouped results read clearly (Crops/Series/Varieties/Sellers headings, truthful total); the zero state is honest, names the query, and offers the `/report?type=correct` route plus a did-you-mean when a near match qualifies. **No finding.**

**Findings summary:** 0 usability findings at Nielsen ≥ 1. Boundaries in §8.

## 6. Rulings

**(a) Sort-only facet claim — UPHELD; the builder's reading conforms to §1.3 and to v2.** Evidence, all directly observed: (i) §1.3's noindex rule enumerates *filter state* — "season, sowing method, life cycle, color family / hue, small-farm, crop-page color/series/has-sellers, seller-index state" — sort is not in the list; sort is governed by §1.3's separate bullet, which requires exactly three things: disallowed in `robots.txt`, never in any sitemap, out of canonicals. The build does all three (robots carries `/*?*sort=*` — verified in the served `robots.txt`, which does **not** swallow `?page=`; canonicals are sort-free including the paginated sort form, `?sort=recent&page=2` → canonical `/variety?page=2`; no sitemap segment carries a sort URL). (ii) The port is v2-faithful in fact, not just in claim: v2's `hasActiveFilters` deliberately excludes sort ("Sort rides the same state but is NOT a filter group" — v2 `lib/browse.ts`), and v2's `generateMetadata` therefore leaves sort-only views indexable with the sort-free `pagePath` canonical. Bea's audit line "the current build has no sort parameter" predates the Tranche 3.4 sort port that the Slice 4 brief explicitly orders carried over; where the audit's summary and the live v2 behavior differ, the brief's "port faithfully" plus §1.3's letter govern. (iii) Sort + filter composes correctly (filtered rule wins: noindex + clean canonical). **Disposition: conformant, no defect.** One observation for Bea, Trivial (N2): an indexable page that robots disallows will in practice not be crawled, so the "indexable" half is nominal — that tension is §1.3's own construction (it orders both halves), and if Bea wants sort views `noindex` as well, an audit amendment is the route; the build must not be faulted for following the binding text.

**(b) Starting-red evidence — Minor accounting finding (N1); does not block.** The brief makes the Step-1 red statement a deliverable ("state the red result in your summary"). The original build's statement was never filed (its run was cancelled at the job timeout mid-verify), and the continuation's summary — which otherwise reconciles exactly (§1) — reports arriving to an already-green inherited suite and does not supply the original red. The only evidence of the red is the coordinator-supplied first-run gate log figure (53 failed tests in `tests/build/slice4-browse.test.ts` at its first gate attempt): consistent with a tests-first build of a 78-test file, but it is a log figure relayed to this gate, not a filed builder statement, and I did not re-run the starting tree (outside my permitted commands). Evidence grade: **coordinator-reported, unverified as filed accounting.** The purpose of the red — proving the tests discriminate — is independently established at this gate by §4's four mutations (each noticed, including the exact failure classes the brief names) and by the continuation's two self-found gaps (pending-cue CSS, autocomplete port) shipping with tests that I verified directly. **Disposition: the slice passes; the program record should note the missing statement so the Slice 5 brief's accounting is filed even if a run is cancelled (a WIP-branch test-count snapshot at each repair round would make the red reconstructable).**

**(c) Seller-detail redirect targets 404 until Slice 5 — ACCEPTABLE WITH CARRY (note).** `/sellers/{slug}` and `/seller?s={slug}` fire single 301s to the §8.4-correct `/seller/{slug}` targets, which 404 until Slice 5 lands the shop pages — the Slice 3 ruling-(b) pattern, disclosed by the builder, and nothing is deployed. **Carry, binding:** Slice 5's gate re-tests both rows end-to-end (301 → 200).

## 7. Findings (all notes; nothing returns to the maker)

- **N1 — Minor (accounting / evidence).** The original build's Step-1 starting-red statement was never filed and the continuation's summary does not supply it (§6(b)). The brief names the summary accounting a deliverable; the omission is real but the underlying property (discriminating tests) is proven at this gate by mutation. Evidence: tree search (no filed statement) + coordinator-relayed gate-log figure — directly observed absence, reported figure.
- **N2 — Trivial (spec observation for Bea, not a build defect).** Sort-only views are meta-indexable while `robots.txt` disallows `?sort=` — §1.3 orders both halves; flagged so Bea can amend deliberately if she wants `noindex` too (§6(a)).
- **N3 — Trivial (program artifact, recurring).** No standalone `structured-data-inventory.md` exists (Slice 3 gate N3, still open program-wide). The §1.2 diff was performed at this gate from emitted HTML and is recorded in §2, which serves as the diffable record for these templates.
- **Carry (from §6(c)):** Slice 5 gate re-tests `/sellers/{slug}` and `/seller?s={slug}` end-to-end (301 → 200) once shop pages land.

**Code review (diff read in context):** 61 files, +7,434/−51, all under `app/` — `v2/` untouched, no workflow files, no tsconfig/eslint/vitest-config changes (no strictness weakening; scan for `any`/`ts-ignore`/`eslint-disable` in new production code clean). Design sound: one backend (loaders consume the public API shape), cache keys embed full filter/page state, `redirects.ts` extended not forked (the brief's instruction), `?page=1` one-hop by construction (the result carries no page param, so the rule cannot refire). Security: revalidate bearer is constant-time compared; redirect targets are slug-pattern-validated (no open redirect); JSON-LD escapes `<`. The PR's two repair rounds + cancellation history left no residue in the tree (final verify green from clean install, twice).

## 8. Coverage ledger

- **Population:** the Slice 4 surface — `/variety` (paged, filtered, sorted, small-farm, empty, garbage-param), `/seller` (paged, state-filtered, unknown/lowercase state), `/search` (multi-group, filtered, zero-results, bare, over-long q), the ?page=1 rows, out-of-range/malformed pages, the legacy seller redirects, the Slice 3 carry chains, head exclusivity, the price guard (both halves), the facet/canonical posture of every UI-producible parameterized URL, the in-place layer (variety + seller + search surfaces), the autocomplete combobox, §9 headers + invalidation, sitemap pagination exclusion, robots additions.
- **Structured sample:** all of the above, exercised by the shipped suite (441 tests), my independent HTTP suite (38 tests, hand-computed expectations, different filter/search/invalidation choices), my independent DOM drive (2 tests, seller surface + CSS-on-disk), and 4 reviewer mutations — every stratum exercised at least twice by independent code.
- **Adversarial additions:** garbage filter/sort/state values; empty `?page=`; filtered page past its end; a second search query checked by invariant (total = sum of group anchors) rather than by fixture; stale-before-purge reads in both invalidation proofs; a dropped search group; a canonicalized page 2.
- **Exclusions, with reasons:** a real-browser (Chromium) drive of the hydrated layer — no live-browser session is available to this gate; hydrated behavior is proven at jsdom level with an injected navigate function (component fidelity: real components, real loaders, real fixture data; the Vike router itself and real CSS painting are the unproven links). The pending cue's *visual* rendering is therefore proven as class-toggle + real CSS rules + token values, not as a screenshot. The production Worker's edge cache (the harness's edge mock caches only `/variety/*` detail paths) — browse invalidation is proven at the data-cache layer, which is §9's load-bearing half; the day-0 preview-deploy crawl remains the control for the Worker layer. Live production data (tree inert; fixture catalog via the stub — fidelity is stub-level for data, real for code path, rendering, headers, redirects, and cache machinery). Seller detail pages themselves (Slice 5; their redirect rows are this slice's, ruled in §6(c)). The original Step-1 red (N1).
- **Evaluator structure:** single evaluator (Quinn), no second rater commissioned for this gate; there are no usability findings to rate (all flows clean), so no severity disagreements exist to surface.
- **Residual risk:** defects that appear only against production-shaped data (818 real varieties — e.g. very long names in browse titles, hues/seasons absent from the fixtures), only in a real browser's router/paint path, or only in the production Worker's edge behavior could still escape this coverage. The day-0 preview-deploy crawl in Bea §10 is the control for that class.

## 9. Return conditions

Nothing returns to the maker. The slice may proceed to merge on this verdict, with the §6(c) carry entered into the program record verbatim and N1–N3 tracked as notes.

— Quinn Assurance, 2026-11-24
