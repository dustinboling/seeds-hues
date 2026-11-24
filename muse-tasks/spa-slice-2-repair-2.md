# Slice 2 REPAIR 2 — Build the surface, tests first (Seed Directory SPA conversion)

You are the second repair of Slice 2. PR #72 failed Quinn's gate (two Blockers); PR #73, the first repair, fixed ONLY the og:image defect and nothing else, and filed none of the required summary — Quinn's re-gate record `QUINN-GATE-spa-slice-2-repair.md` on main is the authority; read it, plus `QUINN-GATE-spa-slice-2.md` and the original brief `muse-tasks/spa-slice-2-static-home.md`. Your run starts from PR #73's branch (the og:image cure is a keeper — do not redo it). This PR supersedes PRs #72 and #73.

**Why the last two builds failed, in one sentence:** the surface doesn't exist and no test notices — so work in the order below, tests first, so the verify gate itself goes red until the surface is real.

## Standing constraints (unchanged)

- INERT: nothing deploys; `v2/` untouched except the verify chain if unavoidable. No `.github/workflows/*` edits. No deploy-config changes.
- Copy is a PORT from live `v2/`, verbatim but for disclosed US-spelling normalization. No invented copy. Prices NOWHERE, including structured data.
- The existing machinery in `app/src/data/` is sound (Quinn executed it in isolation: the §9 fan-out, auth, and the full revalidation loop all work at library level). USE it — wire it, don't rewrite it.

## Step 1 — Discriminating tests FIRST (the F5 cure)

Add tests to the app suite that FAIL on the current tree and pass only when the surface exists:

- A route-existence/render test: for each of `/about`, `/about/data`, `/about/bot`, `/api-docs`, `/privacy`, `/terms`, `/crop`, `/` (home), assert the built output contains that route's complete primary content markers (from the ported copy) — a test that would have failed on both prior PRs.
- Sitemap tests: generated segments exist; pagination URLs absent; zero-seller cohort in its own segment; removed-seller URLs absent; lastmod real-or-omitted.
- Robots test: rendered output byte-compared against the expected file (live substance + Bea's three parameter disallows, blank-line format preserved).
- og test: `og:image` ≠ canonical, equals the image URL (this one passes already — it pins F3's cure).
- Run the suite now: the new tests MUST be red on the starting tree. State that red result in your summary — it is the proof the tests discriminate.

## Step 2 — The routes, wired through the machinery (the F1 + F2 cures)

Build real pages/routes in `app/pages/` (Vike conventions, current official docs) for every deliverable, rendering through `app/src/data/`:

- `/about/data`, `/about/bot`, `/api-docs`, `/privacy`, `/terms` — prerendered, complete content ported from live `v2/`.
- `/crop` — prerendered, live variety counts from the data layer.
- Home `/` — REPLACES the Slice-1 proof page: prerendered shell + request-time regions per the architecture brief; C3 vine-and-pods motif via `HomeMotifDivider` (same R2 asset, images.seeds.hues.flowers); reads **"We don't sell seed."** exactly; the coverage line and JSON-LD the live home carries.
- `/llms.txt`, `/robots.txt` — served (robots with byte parity, Step 3).
- Sitemaps — `/sitemap.xml` index + segments GENERATED from the data layer for all route types (variety/seller/series/state segments generate from data now; URLs match the live set).
- **Wire invalidation end to end:** invoke `revalidate`/`load`/`cache` from the real request/data path (+data hook, handler, or serve entry — state your choice). Make lastmod generation real: either a working `gen:sitemap-lastmod` script in `app/package.json`, or remove BOTH references (`lastmod.ts`, `types.ts`) and generate lastmod in the sitemap path. No dangling references.
- **Demonstrate:** change a variety count in the data source → `/crop` and the affected sitemap segment reflect it without a full rebuild (per the mechanism as built). State the demonstration and its result in your summary.

## Step 3 — Robots byte parity (the F4 cure)

The renderer must reproduce the live file's blank-line format: byte-diff vs live = exactly Bea's three parameter disallows (`sort`/`limit`/`session`) and nothing else. If byte parity is genuinely impossible, state why in the summary (silence will be read as parity achieved).

## Your summary must state (all of it — omissions are findings)

- The Step-1 red result (tests failing on the starting tree) and the final green result.
- The route inventory shipped, mapped to the brief's deliverables 1–6.
- The invalidation demonstration and its result.
- Per-segment sitemap counts: generated vs live, differences explained.
- The robots byte-diff result.
- Anything missing and why — plainly.
