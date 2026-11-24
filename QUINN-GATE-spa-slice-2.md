# QUINN GATE — SPA Slice 2 (Static set + home), PR #72

**Gate:** Quinn Assurance, independent build gate · **Date:** 2026-11-24
**Subject:** PR #72, `github.com/dustinboling/seeds-hues`, branch
`muse/45408786156`, head `a802abe046b2d23c74a4a6207a0e982e9121e525`
**Brief:** `muse-tasks/spa-slice-2-static-home.md` (records commit 98b1b10)
**Governing:** Bea's `PRERENDER-CONTENT-AUDIT.md` (§3/§5/§8.2/§9),
`ROUTE-INVENTORY.md`, `BUILD-SEQUENCE.md` Slice 2 row. Slice 1 gates closed.

## VERDICT: FAIL

Two Blockers. The slice's named deliverables mostly do not exist as
routes in this PR, and the data machinery that does exist is invoked by
nothing. What was built is library code of generally sound design; a
library is not the slice. Return to maker; re-gate on the return.

Four axes, kept separate per standing rule:

- **Severity:** 2 Blocker, 1 Major, 1 Minor, 3 Notes (below).
- **Evidence:** directly observed by file inspection for every finding
  (paths named). Execution-based evidence (verify chains, built HTML,
  invalidation demo) could not be produced — see Coverage; that absence
  is a coverage state, not a defect, and is not priced into severity.
- **Coverage:** partial — declared in the ledger below. The FAIL rests
  on what inspection proves absent, not on the unrun checks.
- **Verdict conditions:** FAIL is unconditional on this head. A return
  must ship the missing routes wired to the machinery, with tests that
  exist, and then receive the full execution gate (verify chains +
  raw-HTML per template + invalidation proof) that this pass still owes.

## Execution-risk block (stated plainly, per the brief)

Materializing the PR branch in the scratch worktree
(`~/workspace/seeds-hues-quinn-slice2-wt`) triggered an execution-risk
refusal on that content: running, building, installing, testing, or
running git/package-manager commands inside it is prohibited. I did not
override it. Therefore NOT run in this gate: the v2/ extended verify
chain, the app verify chain, any build/prerender, raw-HTML fetches of
built output, the /crop invalidation demonstration, and any rendered
usability drive. All are **unchecked**, named here and in the ledger —
none is reported as passed or as failed. Read-only inspection (plain
file viewing) and live-site fetches proceeded.

**CI:** PR #72's Verify run **45419161866** was still
`in_progress` with the Verify job `pending` at last check
(2026-11-24 ~15:05 UTC), after the coordinator's approval. No final
conclusion exists to report; CI is **not green** on this head. The PR
body's "verify passed" summary is the Muse workflow's own pre-PR gate
over the **v2/** suite (8 files / 81 tests) — it is not the app chain
and not this PR's CI.

## Findings

### F1 — BLOCKER — Five of six deliverables have no route at all

Evidence (directly observed): `app/pages/` at PR head contains exactly
`index/` (the Slice-1 proof page — **unchanged by this PR**) and the
new `about/`. The PR's complete file list (48 files, all under `app/`)
contains no page, handler, or route for:

- `/about/data`, `/about/bot`, `/api-docs`, `/privacy`, `/terms`
  (brief deliverable 1 — only `/about` of the six shipped);
- `/crop` index (deliverable 2);
- home `/` (deliverable 3 — the Slice-1 token/font proof page still
  sits at `/`; the C3 motif component exists but no page renders it);
- `/llms.txt` (deliverable 4), `/robots.txt` (deliverable 5),
  `/sitemap.xml` + segments (deliverable 6) — renderer functions exist
  in `app/src/data/` with **no caller** in `pages/`, `scripts/`, or
  `vite.config.ts` (all read).

Standard violated: the brief — "Every route below ships complete or
the slice reports what's missing and why." The PR body reports nothing
missing. Bea's raw-HTML checks cannot run on templates that do not
exist; 7 of the gate's 8 named templates have no HTML to check.

### F2 — BLOCKER — The invalidation mechanism is unwired; the /crop proof is impossible as built

Evidence (directly observed): `app/src/data/revalidate.ts`
(`handleRevalidateRequest`, tag fan-out), `cache.ts`, `load.ts`
(`loadCropIndexData`, `loadHomeData`, `loadMachineData`) are coherent
library code whose fan-out faithfully extends v2's map per Bea §9
(variety/seller tags reach `/crop`, `/`, and the sitemap segments; the
small-farms variant rides the variety entry). But nothing calls any of
it: no `+data` hook, no route handler, no Worker entry, no build
script. `lastmod.ts`'s header names an `npm run gen:sitemap-lastmod`
script that **does not exist** in `app/package.json` (which this PR
does not touch). The committed `sitemap-lastmod.json` (real-looking
API-derived dates, seq-stamped) was therefore produced by a path not
in the tree. A mechanism nothing invokes does not satisfy brief
deliverable 2 ("wire the same revalidation mechanism… build the
invalidation hook now") and cannot be demonstrated: change-a-count →
page-reflects-it has no surface to happen on.

### F3 — MAJOR — `og:image` emits the page's canonical URL, not the image URL

Evidence: `app/src/seo/meta.ts` `pageHead()` builds
`og: { ...image, …, url: canonical }` — overwriting the image's `url`
with the canonical. `app/src/seo/SeoHead.tsx` then renders
`<meta property="og:image" content={tags.og.url} />`. On `/about` that
yields `og:image = https://seeds.hues.flowers/about` alongside
`og:image:width/height` of 1200×630. v2's `pageMetadata` keeps
`openGraph.url` (canonical) and `images[0].url` (the `/og/site/default`
card) separate. Twitter's image in the same component correctly uses
`image.url`, which proves the mix-up rather than a design choice.
Every future template inherits this from the shared component.
(The og:title delta — suffixed title where v2 omits the suffix — is
disclosed in SeoHead's own comment; noted, not graded.)

### F4 — MINOR — robots.txt renderer diverges from the live file's byte format

Evidence: live `robots.txt` fetched 2026-11-24 — the carried disallow
set in `app/src/data/robots.ts` matches it exactly, and the three
additions are precisely Bea's named parameter disallows
(`/*?*sort=*`, `/*?*limit=*`, `/*?*session=*`), correctly specific
(they cannot swallow `?page=`). Substance: PASS. But the live file
separates entries with blank lines and `renderRobotsTxt()` emits
none, so Bea §8.3's byte-diff check ("any other difference is a
stop") fails on format alone — and with no route emitting the file
(F1), the diff is still theoretical. Return must either match the
live byte format or carry Bea's explicit ruling accepting the format
change.

### Notes (not defects)

- **N1 — Claimed tests do not exist.** `sitemap.ts`'s header says its
  rules are "all tested"; `robots.ts`'s header cites "a build test"
  that diffs against live. This PR adds **zero** test files (only
  `tests/dom/shell.test.tsx` was edited, for the Slice-1 shell). The
  app suite's 6 unit files are Slice 1's. Maker-claimed evidence that
  isn't in the tree is reported here as an evidence defect in the
  handoff, graded Note only because F1/F2 already carry the return.
- **N2 — Sitemap design conforms to §8.2 on read.** Seven segments;
  pagination out; zero-seller varieties in their own segment;
  hubs segment matches Bea's table exactly, including the disclosed
  `/
...[truncated 5016 chars]