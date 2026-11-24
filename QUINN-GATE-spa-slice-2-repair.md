# QUINN GATE — SPA Slice 2 REPAIR (re-gate), PR #73

**Gate:** Quinn Assurance, independent build gate — FULL EXECUTION GATE
(this pass; the PR #72 gate was inspection-only under an execution-risk
block, and its return conditions required this one to run fresh)
**Date:** 2026-11-24
**Subject:** PR #73, `github.com/dustinboling/seeds-hues`, branch
`muse/45421226974`, head `82ca2ba77539de2aae337251066835d88f012c60`
**Supersedes:** PR #72, branch `muse/45408786156`, head
`a802abe046b2d23c74a4a6207a0e982e9121e525` (gate record
`QUINN-GATE-spa-slice-2.md`, FAIL: F1/F2 Blocker, F3 Major, F4 Minor)
**Briefs:** `muse-tasks/spa-slice-2-repair.md` (the repair brief) and
`muse-tasks/spa-slice-2-static-home.md` (the original), both on main
**Governing:** Bea's `PRERENDER-CONTENT-AUDIT.md` (§3/§5/§8.2/§8.3/§9),
`ROUTE-INVENTORY.md`, `ARCHITECTURE-BRIEF.md`, `BUILD-SEQUENCE.md`
**Gate worktree:** `~/workspace/seeds-hues-quinn-slice2r-wt` at PR #73
head, detached; all gate mutations restored, scratch test deleted,
worktree tracked-clean at record time
**Evaluator structure:** single evaluator (Quinn). No cold second rater
was commissioned; usability remarks are single-evaluator and flagged.

## VERDICT: FAIL

One of four findings is cured. The repair commit fixes F3 (the
og:image defect) correctly and completely — and does nothing else.
The repair delta against PR #72's head is exactly two files
(`app/src/seo/meta.ts`, `app/src/seo/SeoHead.tsx`, +29/−4). Every route
whose absence made F1 a Blocker is still absent; the invalidation
machinery is still invoked by nothing; the robots renderer is
untouched; the claimed tests still do not exist, and three mutations
that break the og, sitemap, and robots rules all pass the shipped
suite undetected. The slice's deliverables still do not exist as a
surface. Return to maker; re-gate on the return.

Four axes, kept separate per standing rule:

- **Severity:** 2 Blocker (F1, F2 — both uncured), 1 Major (F5, the
  still-false test claims, an explicit repair deliverable), 1 Minor
  (F4 — uncured). F3 (Major in the PR #72 gate) is **cured** and
  closed. Notes below.
- **Evidence:** directly observed and measured throughout — my own
  clean-state verify reproductions, the built artifact's emitted
  HTML, scratch executions of the machinery, three mutation
  break-proofs, live-site fetches dated 2026-11-24. Nothing below
  rests on the maker's summary.
- **Coverage:** full execution coverage of everything that exists to
  execute — see the ledger. The checks that cannot run (raw-HTML on
  nine missing templates, end-to-end invalidation, sitemap counts
  against generated output) cannot run *because the deliverables do
  not exist*; that absence is F1/F2 themselves, not a coverage gap in
  this gate.
- **Verdict conditions:** FAIL is unconditional on this head. Return
  conditions are listed per finding and consolidated at the end.

## The repair delta, stated exactly

`git diff a802abe (PR #72 head) 82ca2ba (PR #73 head)`: two files.

- `app/src/seo/meta.ts` — `pageHead()` restructured: `HeadTags.og` is
  now an explicit object with `url` (canonical) and `image` (share
  image) as separate fields, so the two can never collapse again;
  header comment records the v2 correspondence.
- `app/src/seo/SeoHead.tsx` — one line: `og:image` now renders
  `tags.og.image` instead of `tags.og.url`.

No other file changed. `app/pages/`, `app/src/data/`,
`app/package.json`, and every test file are byte-identical to PR #72.

## Findings

### F1 — BLOCKER — NOT CURED — Five of six deliverables still have no route

Evidence (directly observed, executed):

- `app/pages/` at PR #73 head contains exactly `index/`, `about/`,
  `_error/` — identical to PR #72. There is still no page, handler, or
  route for `/about/data`, `/about/bot`, `/api-docs`, `/privacy`,
  `/terms` (deliverable 1 — only `/about` of six), `/crop`
  (deliverable 2), `/llms.txt`, `/robots.txt`, `/sitemap.xml` +
  segments (deliverables 4–6).
- Home `/` is still the Slice-1 proof page. Its own source comment
  still reads: "Slice-1 proof route… Bea's condition on `/`… binds
  the real home template in Slice 2, not this inert proof page." The
  repair did not replace it. `HomeMotifDivider` (the C3 component)
  still has zero callers anywhere in the tree.
- The build proves it in the artifact: `npm run build` exits 0 and
  pre-renders exactly **3 HTML documents** — `dist/client/index.html`,
  `dist/client/about/index.html`, `dist/client/404.html`. No other
  route exists in the built output to fetch raw HTML from. Bea's
  per-template raw-HTML contract therefore still has exactly one
  Slice-2 template to check (see "What passed" for `/about`).
- The built home's raw HTML contains the proof sections ("Color
  tokens", "Font stacks") and **none** of the home contract: no "We
  don't sell seed." (grep: absent), no C3 motif (no divider asset
  referenced), no coverage line, no search form, no WebSite /
  Organization JSON-LD.
- User-facing shadow: the built `/about` page's header/footer link to
  `/crop`, `/variety`, `/seller`, `/search`, `/report`,
  `/add-your-farm`, `/account`, `/about/data`, `/about/bot`,
  `/api-docs`, `/privacy`, `/terms`, `/llms.txt` — in this build every
  one of those targets is a 404. The one shipped page's own navigation
  dead-ends in thirteen places.
- The repair brief's summary obligations were also not met: the PR
  body states no route inventory, no invalidation demonstration, no
  per-segment sitemap counts, no robots result, and nothing missing —
  while routes are absent. The repair brief names exactly this as
  itself a gate failure ("A summary that reports nothing missing
  while routes are absent is itself a gate failure — that is how
  PR #72 failed"). The PR body's only accounting is the workflow's
  v2-verify summary and "Files changed: 2".

Standard violated: original brief deliverables 1–6; repair brief §1;
Bea's audit §4.4/§4.5/§5/§7.4/§8.2.

**Return condition:** unchanged from the PR #72 gate, restated in the
consolidated list at the end.

### F2 — BLOCKER — NOT CURED — The invalidation mechanism is still invoked by nothing; the named script still does not exist

Evidence (directly observed, executed):

- Caller search over `app/pages/`, `app/scripts/`, `app/vite.config.ts`,
  and all of `app/src/` outside `app/src/data/` itself: **zero**
  imports of `revalidate.ts`, `load.ts`, `cache.ts`, `sitemap.ts`,
  `robots.ts`, or `llms.ts` (only type imports from `data/types`).
  There is no `+data` hook, no route handler, no Worker/server entry
  anywhere in `app/`, and no build script that calls the machinery.
- `npm run gen:sitemap-lastmod` still does not exist in
  `app/package.json` (unchanged by this PR), while **two** files still
  cite it as the generating path: `app/src/data/lastmod.ts` (header)
  and `app/src/data/types.ts` (the `LastmodCache` comment). The repair
  brief required making the script real or removing the reference and
  wiring lastmod generation into the actual sitemap path. Neither
  happened. The committed `sitemap-lastmod.json` still has no
  producing path in the tree.
- **The end-to-end demonstration the brief requires cannot be
  performed on this build** — there is no `/crop` page, no sitemap
  output, and no running surface on which a count change could
  appear. A mechanism that exists but cannot be exercised is F2 not
  cured, per the gate's own terms.
- What I *could* execute, I did — the machinery's logic in isolation,
  via a scratch vitest file (created, run, deleted; 5/5 passed):
  1. `pathsForTag("variety:…")` returns `/crop`, `/`, `/sitemap.xml`,
     both variety segments, and the small-farms variant
     (`/variety/{slug}?small_farm=true`) — Bea §9's fan-out, correct.
  2. `handleRevalidateRequest` enforces its bearer secret
     (wrong secret throws `RevalidateAuthError`) and expands tags to
     the fan-out paths.
  3. The full loop at library level: a fake API serving a crop with
     varietyCount 10 → `loadCropIndexData` returns 10; the source
     changes to 11 → a warm-cache reload still returns 10 (the
     staleness the hook exists to cure); `handleRevalidateRequest`
     with a variety tag, wired to the cache's `invalidatePaths`,
     purges the `crops` entry → the next load returns **11**, no
     rebuild. The designed mechanism works — in a test harness that
     the gate wrote, calling functions that nothing in the product
     calls.
- This sharpens rather than softens the finding: the gap was never
  the machinery's design (the PR #72 gate said the same on read). The
  repair was commissioned to wire it, and the wiring is the part that
  still does not exist.

Standard violated: original brief deliverable 2; repair brief §2;
Bea §9 (invalidation is the edge-cache contract's load-bearing half)
and §8.2 rule 3 (sitemaps invalidated on the same path).

**Return condition:** unchanged — wire the hook into a real
request/data path, make lastmod generation real or unwired references
removed, and demonstrate count-change → `/crop` + affected sitemap
segment on the built artifact.

### F3 — MAJOR (PR #72) — CURED AND CLOSED — og:image now emits the image URL

Evidence (three independent links, all mine):

- Source: `meta.ts pageHead()` now builds
  `og: { url: canonical, image: image.url, … }` as separate fields;
  `SeoHead.tsx` renders `og:image` from `tags.og.image` and `og:url`
  from `tags.og.url`. The type change is structural — `HeadTags.og`
  no longer spreads `OgImage` (whose `url` was the image URL being
  overwritten), so the PR #72 collapse cannot recur through this
  component. Twitter's image field agrees (`image.url`), as in v2.
- Unit level: my scratch test called `pageHead({ path: "/about" })`
  and asserted `og.url === https://seeds.hues.flowers/about`,
  `og.image === https://seeds.hues.flowers/og/site/default`,
  `og.image !== og.url`, `twitter.image === og.image` — passed.
- Emitted HTML (the link that matters): the built
  `dist/client/about/index.html` carries
  `og:url = https://seeds.hues.flowers/about` and
  `og:image = https://seeds.hues.flowers/og/site/default` with
  width/height 1200×630 and `og:image:type image/png` — matching v2's
  `pageMetadata` behaviour (canonical and `images[0].url` separate).
- Scope limit, stated plainly: `/about` is the only template that
  exists, so "several templates" reduces to one. The fix lives in the
  shared `pageHead`/`SeoHead` path every future template inherits,
  which is where the defect lived; the remaining templates' og output
  is unchecked because they do not exist (F1's shadow, not an F3
  residue).

### F4 — MINOR — NOT CURED — robots.txt byte format still diverges; no impossibility stated

Evidence (executed): I rendered the file by calling
`renderRobotsTxt("https://seeds.hues.flowers")` in the scratch suite
and byte-compared against the live file fetched 2026-11-24
(`https://seeds.hues.flowers/robots.txt`, crawled 15:39 UTC).

- **Substance: exact.** The rendered non-blank lines equal, in order,
  the live file's lines plus precisely Bea's three named parameter
  disallows (`/*?*sort=*`, `/*?*limit=*`, `/*?*session=*`) after the
  carried set. Nothing else differs in substance; the patterns cannot
  swallow `?page=`.
- **Bytes: not equal.** The live file separates every entry with a
  blank line (and carries a double blank before `Host:` and a blank
  between `Host:` and `Sitemap:`). The renderer emits no blank lines
  between entries at all — the diff against the Bea-permitted expected
  file (live bytes + the three additions in live format) is **15
  missing blank-line separators**, nothing else.
- `robots.ts` is byte-identical to PR #72 (not in the repair delta),
  and the PR body states no impossibility and no format ruling. The
  repair brief required byte parity **or** a plainly stated
  impossibility with the substance diff exact. Neither was delivered.
  And with no route serving the file (F1), the diff remains
  theoretical in the product, exactly as at the PR #72 gate.

**Return condition:** renderer reproduces the live blank-line format
so the byte-diff is exactly the three additions — or Bea's explicit
recorded ruling accepting the format change rides with the PR.

### F5 — MAJOR — The claimed tests still do not exist, and the suite provably does not discriminate

The PR #72 gate graded this a Note because F1/F2 already carried the
return. The repair brief (§4) then made it an explicit deliverable —
add the tests (sitemap segment rules, robots diff/substance, og
separation) **or correct the comments**. Neither happened:

- `app/tests/` at PR #73 head is identical to PR #72: 8 files, all
  Slice-1-era (the app suite is 81 tests; the repair added **zero**
  test files and zero tests).
- The false claims stand verbatim in shipped code:
  `sitemap.ts`'s header still says its rules are "all binding, **all
  tested**"; `robots.ts`'s header still cites "a build test [that]
  diffs this output against the live file". No such tests exist.
- **Mutation break-proofs** (each applied to the PR head, full shipped
  suite run, then restored; worktree verified clean after each):
  1. *og:* `SeoHead.tsx` reverted to `content={tags.og.url}` — the
     exact F3 defect reintroduced → suite **81/81 PASS**, undetected.
  2. *sitemap:* `"/variety?page=2"` added to `HUB_PATHS` (a pagination
     URL in the sitemap, Bea §8.2 rule 2 violated) → suite **81/81
     PASS**, undetected.
  3. *robots:* the `/*?*session=*` parameter disallow deleted from
     `PARAMETER_DISALLOWS` → suite **81/81 PASS**, undetected.
- Consequence for the pipeline, stated as process evidence: both
  automated gates are green on this head (my reproductions and CI —
  see below) *because no check in either chain asserts that the
  slice's deliverables exist or obey their rules*. A green chain on
  this PR certifies the v2 site and the Slice-1 skeleton; it says
  nothing about Slice 2. This is the second consecutive Slice-2
  dispatch whose handoff reported success over an absent surface —
  a chronic process defect (the gate floor lacks acceptance checks
  for the brief's deliverables), not a sporadic one.

**Return condition:** tests exist for the sitemap rules (pagination
out, zero-seller cohort separate, lastmod real-or-omitted,
removed/non-indexable absent), the robots substance/diff rules, and
og:image ≠ canonical — each demonstrably failing under mutation at
re-gate — or the header claims are corrected to say only what is
true. (Tests are the brief's stated preference and the only cure
that also fixes the process defect.)

## What passed (evidence, all reproduced by me)

**Verify chains — both green, from clean state.**
- App chain (fresh `npm ci`, 564 packages): lint ✓, typecheck ✓
  (app + SW tsconfigs), **81/81 tests, 8 files** — exit 0.
- v2/ extended chain with `app/node_modules` and `app/dist` removed
  first: `npm ci` in v2, then `npm run verify` — v2 lint + typecheck
  + **1,576/1,576 tests, 105 files**, then `verify:spa` (self-installs
  the app tree) → app chain green again — **exit 0** end to end.
- **CI:** PR #73's Verify run **45426776859** finished
  **completed / SUCCESS** (2026-11-24 15:44Z). Scope label, for the
  record: that workflow installs and verifies `v2/`, whose `verify`
  script includes `verify:spa`, so CI did run the app chain — and it
  is green for the reason F5 names (no acceptance checks for this
  slice's deliverables), not because the slice exists. PR #72's CI
  (run 45419161866) also eventually passed (7m52s); the PR #72 gate's
  "still in progress" note is superseded by that final result.

**The one existing template, `/about` — raw-HTML contract passes.**
Built HTML (JS disabled; the emitted file itself): status-equivalent
prerendered document with complete primary content in the first HTML;
`<title>About the directory | seeds.hues.flowers</title>`; description
identical to v2's; canonical `https://seeds.hues.flowers/about`;
`robots: index, follow` (no noindex); H1 "About seeds.hues.flowers"
present; anchors to `/about/data`, `/about/bot`, `/api-docs`,
`/llms.txt`, `/privacy`, `/report` all present (Bea §5's checks for
this template). Copy port verified against `v2/app/about/page.tsx`:
verbatim but for the one disclosed normalization ("honoured" →
"honored", present in the built text as "honored within 48 hours");
the trademark disclaimer and conflict-of-interest constants match
v2's strings exactly. No price string anywhere; no JSON-LD emitted —
which matches v2's `/about`, a template that carries none (the
no-price guard passes; the guard itself remains covered by its
Slice-1 tests, 18 in the suite).

**Machinery design — execution-confirmed in isolation.** Beyond F2's
three proofs: `buildSitemap` on a synthetic snapshot (3 varieties:
listed / zero-seller / non-indexable; 1 US-OR seller; crop; series)
produced correct segmentation — listed and zero-seller in their own
files, non-indexable absent, no `?page=` anywhere, hubs = Bea's 11,
states derived from visible sellers (`/state/oregon`), and lastmod
emitted only where the cached seq matched the live row (a stale-seq
seller date was correctly omitted — real-or-omitted, §8.2 rule 3).
The sitemap *design* conforms to §8.2, as the PR #72 gate found on
read; it is the generation path and the output that do not exist.

**Inertness + scope discipline.** PR #73 vs main: 48 files, **all
under `app/`**; zero changes in `v2/` (beyond none), zero
`.github/workflows/*` changes, no deploy config touched. The repair
delta vs PR #72 is the two SEO files above. Nothing deploys.

## Usability pass (single-evaluator; declared boundary)

This seat has no live-browser access in this session, and the surface
is inert and never deployed; the pass is a desk pass over the built
HTML, and its limits are named rather than rounded up. Goal taken:
"land on the directory and orient / read what it is."

- `/about` as rendered: clear H1, lede, headed sections in a sensible
  order, real anchors for every cross-reference — a first-time reader
  can complete the goal. No confusion findings on this page itself.
- The app as rendered: the goal fails at the shell. Every header and
  footer destination except Home and About is a dead end in this
  build (see F1's thirteen 404 targets). A visitor who taps "Crops"
  — the directory's primary browse path — gets the 404 page. That is
  F1 stated in usability terms; its severity is already carried by
  the Blocker, and I do not double-count it as a separate finding.
- The home route presents token swatches and font stacks — correct
  for a Slice-1 proof, meaningless as a directory home; again F1.
- Remainder unchecked, named: real-browser rendering at phone
  viewport, focus behaviour, and the tab-bar placeholder's empty
  "Primary" landmark (carried from the Slice-1 gate, F5 there) —
  none of it affects this verdict, which rests on F1/F2/F5.

## Coverage ledger

- **Population:** the full PR #73 diff vs main (48 files) and vs
  PR #72 (2 files); both verify chains; the built artifact (all 3
  prerendered documents + dist inventory); every Slice-2 template in
  the brief (10 route classes); the data machinery's five modules;
  the live robots.txt and live sitemap.xml (fetched 2026-11-24);
  the v2 copy sources; CI runs 45426776859 (PR #73) and 45419161866
  (PR #72, final result).
- **Structured sample checked:** all of the above that exists —
  `/about` raw HTML in full; the machinery by direct execution
  (scratch suite, 5 proofs); robots by executed render + byte diff;
  sitemap rules by executed generation on a synthetic fixture;
  og by source, unit call, and emitted HTML (three links of the
  chain compared).
- **Adversarial additions:** three mutation break-proofs (og,
  sitemap, robots — F5); the stale-cache step inside the invalidation
  proof (the mechanism was first shown serving the *old* count, so
  the purge — not luck — is what the final step evidences); the
  clean-state chain reproductions (app deps removed before the v2
  chain).
- **Exclusions, with reasons:** raw-HTML checks for `/about/data`,
  `/about/bot`, `/api-docs`, `/privacy`, `/terms`, `/crop`, home,
  `/llms.txt`, `/robots.txt`, sitemap index + segments — **no output
  exists to check** (F1); per-segment counts and sampled URL diffs
  against generated sitemaps — **no generated output exists**, and
  the builder stated no counts (live baseline stands at Bea's
  §8.1/§8.2 figures: 1,136 live single-file URLs incl. 39 pagination;
  segmented expectation 1,097 = 556 listed / 262 zero-seller / 83
  sellers / 124 crops / 33 series / 31 states / 11 hubs; the live
  file fetched today still shows the §8.1 structure, variety
  pagination `?page=2…35`, seller `?page=2…4`); removed-seller absence
  against live data — uncheckable for the same reason (rule-level
  exclusion of non-indexable rows *was* execution-verified on the
  fixture); end-to-end invalidation on a running surface — no surface
  exists (F2); live-browser session — no browser access in this
  seat, declared in the usability pass.
- **Evaluator structure:** single evaluator; no second rater
  commissioned for this gate.
- **Residual risk:** this coverage cannot see defects inside routes
  that do not exist yet — when they are built, their copy ports,
  JSON-LD payloads, and rendering classes will need the full
  per-template pass this gate still owes them. It also cannot see
  whether the machinery survives real catalog data at full scale
  (my fixture was 17 URLs; the real snapshot is ~1,097) — the return
  gate must run `buildSitemap` against the live API snapshot and
  diff per segment, which requires the generation path F1/F2 demand.

## Consolidated return conditions (all required for a PASS)

1. **Routes (F1):** real pages/routes for `/about/data`,
   `/about/bot`, `/api-docs`, `/privacy`, `/terms`, `/crop`, home
   `/` (replacing the proof page; "We don't sell seed." verbatim; C3
   motif via `HomeMotifDivider` on the images.seeds.hues.flowers
   asset), `/llms.txt`, `/robots.txt`, and the segmented sitemaps —
   each rendering through the existing `app/src/data/` machinery,
   with complete primary content in the first HTML per Bea.
2. **Invalidation (F2):** `revalidate.ts`/`cache.ts`/`load.ts`
   invoked from a real request/data path; `gen:sitemap-lastmod` made
   real or both references removed and lastmod wired into the actual
   sitemap path; a demonstrated count change propagating to `/crop`
   and the affected sitemap segment(s) on the built artifact,
   stated in the PR summary.
3. **Robots (F4):** byte parity with live + the three additions, or
   Bea's recorded ruling accepting the format change.
4. **Tests (F5):** discriminating tests for the sitemap rules, the
   robots rules, and og separation — or the false header claims
   corrected. (Tests preferred; see F5.)
5. **Summary honesty (repair brief):** the return PR states its route
   inventory against deliverables 1–6, the invalidation
   demonstration and result, per-segment sitemap counts (generated
   vs live, differences explained), the robots byte-diff result, and
   anything missing and why.

The re-gate on the return is a full execution gate again: clean
verify chains, raw HTML per template, the invalidation proof run
live on the built artifact, the sitemap generated from the live
snapshot and diffed per segment, and mutation break-proofs on the
new tests.

— Quinn Assurance, 2026-11-24
