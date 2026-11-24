# Slice 2 — Static set + home (Seed Directory SPA conversion)

You are building Slice 2 of 9 in the Seed Directory's conversion to a Vike + React SPA. Slice 1 (app skeleton + design-system wiring) is merged; build on its `app/` tree, its design-system wiring, and its verify chain. Read first: `spa-conversion-2026-11-23/BUILD-SEQUENCE.md` (Slice 2 row), `spa-conversion-2026-11-23/ROUTE-INVENTORY.md`, and Bea's `spa-conversion-2026-11-23/PRERENDER-CONTENT-AUDIT.md` — her audit is the findability contract for this slice (esp. §3 segmented sitemap, §5 statuses/redirects, §8.2). Consult the current official Vike docs for prerender configuration.

## Standing constraints

- Still INERT: nothing deploys; `v2/` stays the live tree, untouched except — if unavoidable — the verify chain (Slice 1 pattern). No `.github/workflows/*` edits (stop and report if one seems required). No deploy-config changes.
- Copy is a PORT, not a rewrite: the static pages' text comes from the live `v2/` pages verbatim except where a ruling below says otherwise. Do not invent new marketing copy. US spelling.
- Prices are never shown anywhere, including structured data — the Slice 1 JSON-LD guard applies to every payload this slice emits.
- Production standard: strict TS, no stubs. Every route below ships complete or the slice reports what's missing and why.

## Deliverables

1. **Prerendered static set:** `/about`, `/about/data`, `/about/bot`, `/api-docs`, `/privacy`, `/terms` — prerendered at build with COMPLETE primary content in the first HTML (Bea's rule: server-rendered means complete, never a metadata shell). Content ported from the live equivalents in `v2/`.
2. **`/crop` index** — prerendered, BUT it carries live counts (variety counts per crop). Per Bea's audit, its prerender must regenerate on data-change invalidation: wire the same revalidation mechanism the app will use for data-driven pages (build the invalidation hook now, driven by the data layer the later slices use; if the data layer doesn't exist yet, build the minimal read path against the existing API/D1 shape the architecture brief specifies — do not hard-code counts into the HTML as static text without the invalidation path).
3. **Home (`/`)** — prerendered shell + request-time regions per the architecture brief: the shell (hero, motif, navigation regions) prerenders; regions that depend on live data render at request time. The C3 vine-and-pods motif is the homepage divider (same R2 asset the live site uses — reference it, never hotlink a foreign copy; the asset already lives on images.seeds.hues.flowers). Home still reads "We don't sell seed." — that line is settled copy, port it exactly.
4. **`/llms.txt`** — retained as hygiene, ported as-is.
5. **`/robots.txt`** — posture preserved VERBATIM from the live site (open to search + AI crawlers per the 5.1 ruling) plus the plan's parameter disallows named in Bea's audit. Diff against live must be exactly the named additions, nothing else.
6. **Segmented sitemap machinery** — `/sitemap.xml` becomes the index; segments by type per Bea §8.2 (expected total ≈1,097 URLs at current catalog size; pagination URLs OUT; lastmod = real `updated_at` only, never fabricated). The machinery generates from the same data layer as (2); segment files for route types not yet built (variety/seller/series/state) may generate from the data layer now — the URLs must match the live site's URL set exactly, and Slice 8 will diff them URL-by-URL.

## Gate emphasis (Quinn + Bea raw-HTML checks)

- For EVERY template in this slice: fetch the prerendered/SSR HTML with JS disabled (raw HTML) and verify complete primary content, correct title/meta/canonical, and JSON-LD passing the no-price guard.
- `/crop` invalidation proof: change a count in the data source → the page reflects it without a full rebuild (or per the mechanism you built — demonstrate it).
- robots.txt diff vs live = only the named parameter disallows.
- Sitemap: URL set matches live (count + a sampled diff per segment); removed-seller URLs absent; zero-seller variety URLs present in their own segment.

## Your summary must state

- Which data-layer/read path you built for (2)/(3)/(6) and how invalidation works.
- Any live-copy deviation you had to make and why (expected: none).
- The sitemap URL count your machinery produces vs the live count, per segment.
