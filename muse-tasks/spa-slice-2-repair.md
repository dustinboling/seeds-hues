# Slice 2 REPAIR — Ship the missing routes, wire the machinery (Seed Directory SPA conversion)

You are repairing Slice 2 of the Seed Directory SPA conversion. PR #72 (branch `muse/45408786156`) FAILED Quinn's gate with two BLOCKERs — record: `QUINN-GATE-spa-slice-2.md` on main. Read it first; it is the authority. Your run starts from PR #72's branch: the data-layer machinery Quinn inspected (`app/src/data/` renderers, `revalidate.ts`/`cache.ts`/`load.ts`, the sitemap design, the `/about` page, the robots substance) is sound and STAYS — what is missing is the surface: almost nothing is routed or wired. The repair PR supersedes PR #72.

## Standing constraints (unchanged)

- Everything stays INERT: nothing deploys; `v2/` untouched except the verify chain if unavoidable. No `.github/workflows/*` edits. No deploy-config changes.
- Copy is a PORT from the live `v2/` pages, verbatim except the disclosed US-spelling normalization. No invented copy. Prices NOWHERE, including structured data.
- **Completeness is the point of this repair:** the brief's rule stands — every deliverable ships complete, or your summary states precisely what is missing and why. A summary that reports nothing missing while routes are absent is itself a gate failure (that is how PR #72 failed).

## 1. F1 CURE (Blocker) — build the missing routes, wired to the machinery

Create real pages/routes in `app/pages/` (Vike conventions, per the current official docs) for every Slice 2 deliverable, each rendering through the existing `app/src/data/` machinery — not parallel re-implementations:

- `/about/data`, `/about/bot`, `/api-docs`, `/privacy`, `/terms` — prerendered, complete primary content ported from the live `v2/` equivalents.
- `/crop` index — prerendered with live variety counts from the data layer, regenerated via the invalidation mechanism in item 2.
- Home `/` — prerendered shell + request-time regions per the architecture brief, REPLACING the Slice-1 proof page (which was never a deliverable surface): hero/motif/navigation regions prerender; live-data regions render at request time. The divider is the C3 vine-and-pods motif via the existing `HomeMotifDivider` (same R2 asset on images.seeds.hues.flowers). Home reads **"We don't sell seed."** — exactly, ported from the live home.
- `/llms.txt` — served, ported as-is.
- `/robots.txt` — served by the renderer, with F4's fix (item 3).
- Segmented sitemaps — `/sitemap.xml` index + the segment files, GENERATED from the data layer (not hand-written), covering all route types per Bea §8.2 (variety/seller/series/state segments generate from the data layer now; their URLs must match the live site's set).

## 2. F2 CURE (Blocker) — wire the invalidation mechanism end to end

- Invoke `revalidate.ts`/`cache.ts`/`load.ts` from the real request/data path (a `+data` hook, handler, or build/serve entry — your choice, stated in the summary): a data change must propagate to the affected pages AND sitemap segments per Bea §9's fan-out (incl. the small-farms variant).
- `lastmod.ts` names `npm run gen:sitemap-lastmod` — make that script REAL in `app/package.json` and working, or remove the reference and wire lastmod generation into the actual sitemap path. Either way: no references to scripts that don't exist.
- **Demonstrate it:** your summary states the exact demonstration you ran (change a count in the data source → the /crop page and the affected sitemap segment reflect it without a full rebuild, or per the mechanism as built) and its result.

## 3. F3 + F4 CURES

- **F3 (Major):** `og:image` must emit the IMAGE URL, never the canonical URL. Fix `meta.ts pageHead()` / `SeoHead.tsx` so `og:url` (canonical) and `og:image` (image) stay separate, matching v2's behaviour; the Twitter image field is already correct — align og with it. Every template inherits the fix.
- **F4 (Minor):** the robots renderer must reproduce the live file's blank-line format so the byte-diff against live is exactly Bea's three named parameter-disallow additions (`sort`/`limit`/`session`) and nothing else — or, if byte-parity is impossible for a stated reason, say so plainly in the summary and leave the substance diff exactly as gated.

## 4. Tests — make the claims true

Header comments in the PR #72 code claim sitemap rules are "all tested" and cite a robots build test; neither exists. Add the tests (sitemap segment rules: pagination out, zero-seller cohort separate, lastmod real-or-omitted, removed-seller absent; robots: the diff/substance rules; og:image ≠ canonical) so the claims become true — or correct the comments where a claim shouldn't be made. The full verify chain (v2/ extended + app) must run green from a clean state, and your summary states per-segment sitemap counts (generated vs the live site's counts) as the original brief required.

## Your summary must state

- The route inventory you shipped (every route + its rendering class), mapped against the brief's deliverables 1–6.
- The invalidation demonstration (item 2) and its result.
- Per-segment sitemap counts: yours vs live, with any difference explained.
- The og:image fix and the robots byte-diff result.
- Anything missing and why — plainly. Silence about a gap will be read as the gap not existing.
