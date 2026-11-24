# Slice 3 — Variety routes (Seed Directory SPA conversion)

You are building Slice 3 of 9 in the Seed Directory's conversion to a Vike + React SPA. Slices 0–2 are merged: the `app/` tree, the design-system wiring, the Slice 2 data layer (`app/src/data/` — `api.ts` / `load.ts` / `cache.ts` / `revalidate.ts`), and the extended verify chain are yours to build on. Read first: `spa-conversion-2026-11-23/BUILD-SEQUENCE.md` (Slice 3 row), `spa-conversion-2026-11-23/ROUTE-INVENTORY.md` (variety rows), and Bea's `spa-conversion-2026-11-23/PRERENDER-CONTENT-AUDIT.md` — her audit is the findability contract for this slice: **§1 (global contract), §1.1 (structured-data inventory), §1.2 (the two no-price checks), §3.1 (`/variety/[slug]`), §3.2 (small-farms variant), §7.2 (OG cards), §8.4 (the variety rows of the redirect map), §9 (live-data regions + edge-cache contract)**. Consult the current official Vike docs for on-demand SSR (`+data` hooks, page context, redirects and 404 handling in SSR).

**Why this brief is ordered the way it is:** Slice 2 needed three repairs because two consecutive builds reported success over a surface that did not exist — nothing in the automated chain asserted the deliverables were real. This slice therefore works **tests first**, asserts **exclusivity as well as presence**, and treats its own summary accounting as a deliverable. Follow the order.

## Standing constraints

- Still INERT: nothing deploys; `v2/` stays the live tree, untouched except — if unavoidable — the verify chain (Slice 1/2 pattern). No `.github/workflows/*` edits (stop and report if one seems required). No deploy-config changes.
- Content is a PORT, not a rewrite: the variety page's copy, structure, and builders come from the live `v2/` sources — `v2/app/variety/[slug]/page.tsx`, `v2/app/variety/[slug]/variety-view.tsx`, `v2/app/variety/[slug]/small-farms/page.tsx`, `v2/components/variety/*` (ListingRow, WaitlistBlock, Availability, PacketList, SellerFilterSection, VarietyHeroImage, SmallFarmBadge), and the SEO builders in `v2/lib/seo/`. Port faithfully; do not invent copy. US spelling.
- Prices are NEVER shown anywhere — visible copy, meta, Open Graph, JSON-LD, or any rendered API field. Packet sizes show; prices never do. The prohibited JSON-LD list (§1.1) is binding.
- **Permanent redirects are 301, uniformly** (Bea §8.4's recommendation, matching the program spec). Every permanent redirect this slice ships is 301, one hop. State this pick in your summary.
- Production standard: strict TS, no stubs, no placeholder components. Every deliverable below ships complete or your summary reports what is missing and why, plainly.

## Step 1 — Discriminating tests FIRST

Extend the fake catalog (`app/tests/unit/fake-catalog.ts`) with variety-detail fixtures rich enough to discriminate:

- **(i)** a variety WITH sellers: at least three listings — one from a Small-Farm-badged seller, mixed stock states (at least one `in_stock`, one `sold_out`), packet sizes, real `last_checked_at` dates, a listing note; a series assignment; complete facts.
- **(ii)** a ZERO-SELLER variety (no listings).
- **(iii)** a variety whose listings include NO badged seller (the small-farm empty state).
- **(iv)** a MERGED variety (`merged_into` → fixture (i)'s slug).
- **(v)** facts with unknowns (e.g. no height, no days-to-bloom) so the "Unknown" rendering is exercised.

Then add tests to the app suite that FAIL on the current tree and pass only when the surface is real. Assert exact strings and counts from the fixtures, not mere presence:

- **SSR render, with-sellers:** server-render the variety page through the app's own SSR path against the fake catalog; the raw HTML contains the exact `<title>` pattern with the fixture's real seller count (§3.1 `varietyTitle`), the canonical equal to the fetched URL, the H1, the answer sentence containing the fixture's real seller name(s), every facts label ("Latin name", "Days to bloom", …), exactly one `href="/seller/…"` anchor per listing, each listing's stock word and "Checked {date}", `BreadcrumbList` **and** `ItemList` in JSON-LD, and the OG meta tags with `og:image` ≠ canonical.
- **SSR render, zero-seller:** status 200; the no-seller answer wording; the waitlist form markup present; `ItemList` absent or empty per §1.1; and **no `noindex`** anywhere (decision 27: zero-seller pages stay indexable).
- **Exclusivity (the Slice 2 F6 lesson):** for BOTH samples, occurrence counts — exactly ONE canonical, ONE meta description, ONE `og:url`, ONE `og:image` in the emitted HTML. Presence-only assertions are not acceptable anywhere in this suite.
- **Price guard on rendered HTML:** no prohibited JSON-LD string (§1.1 list) and no price pattern in visible text, meta, or JSON-LD of either sample; packet-size strings present and passing.
- **Small-farms variant:** rendering `?small_farm=true` yields `noindex`, canonical equal to the CLEAN variety URL (no query string), only the badged seller's name, the legend markup, and `aria-current` on the Small farms chip; fixture (iii) yields the small-farm empty-state copy; a garbage `small_farm` value (e.g. `=yes`, repeated) renders the ORDINARY page (200, no `noindex`) — the forgiving parse is deliberate (§3.2), do not tighten it.
- **Statuses & redirects:** unknown slug → 404 (and the body is the 404 page, not the app shell); merged slug → a single 301 to the survivor, with `?small_farm=true` preserved when present; `/varieties/{slug}` → 301 to `/variety/{slug}`; `/variety?v={slug}` → 301 to `/variety/{slug}`; direct request for the internal path `/variety/{slug}/small-farms` → a single 301 to `/variety/{slug}?small_farm=true`, never a 200.
- **OG:** `/og/variety/{fixture-slug}` and `/og/site/default` return 200, `image/png`, 1200×630 (assert the PNG header dimensions); the variety card's text matches the fixture's real name.
- **Invalidation:** render the with-sellers page → mutate the fixture listing's stock state → drive the shipped revalidate handler with the variety tag → re-render: the new stock word and date are present WITHOUT a rebuild. This runs against the built artifact's SSR path, not library code in isolation.

Run the suite now: the new tests MUST be red on the starting tree. **State that red result in your summary** — it is the proof the tests discriminate. Design assertions so the suite would fail if a listing card were dropped, if `noindex` were added to the zero-seller page, if the variant's canonical gained the query string, or if a price string appeared in a listing note (structural sensitivity, in the repair-2/3 pattern).

## Step 2 — The routes, wired through the machinery

1. **Data layer:** extend `CatalogApi` (`app/src/data/api.ts`) with the variety-detail read — the same JSON the live `GET /api/v1/varieties/[slug]` (+ its listings) returns today (the architecture brief's "one backend" rule: SSR consumes the service layer server-side; do not invent a second data shape). Include the merged lookup (status / `merged_into`) and everything §3.1 renders. Wire the reads through `load.ts`'s shared cache, and register the variety page + its small-farms variant in the revalidate fan-out (`revalidate.ts` `pathsForTag` already names the taxonomy — the variety page, variant, its seller/crop/series/state pages, `/`, the list pages, and the affected sitemap segments purge together, §9). USE the existing machinery; wire it, don't rewrite it.
2. **`/variety/[slug]` — on-demand SSR** (Vike SSR page, NOT prerendered; 818 URLs), rendering the complete §3.1 contract in the FIRST HTML response:
   - `<title>` / meta description from the ported builders (`varietyTitle` / `varietyDescription`); canonical `https://seeds.hues.flowers/variety/{slug}`; OG + Twitter `summary_large_image`; `og:image` = the variety's illustration (`mediaOgImage`, 1120×2240) when media exists, else `/og/variety/{slug}`.
   - Breadcrumbs (Home → crop → series when present → variety) as real anchors + `BreadcrumbList` JSON-LD.
   - H1 + crop sub-line; eyebrow (crop common + Latin); the **answer sentence** (`data-testid="answer"`) immediately under the H1.
   - Hero image when media exists: real `<img>`, alt = "{variety} {crop}", width/height set.
   - Facts list COMPLETE: Crop (link), Latin name, Series (link when present, else "None"), Hue/color family, Season, Sowing method, Pollination, Height, Days to bloom — unknown facts render the word "Unknown", never omitted, never invented.
   - Description prose (seller names already scrubbed in the data; breeder names stay).
   - "Where to buy" section: "{N} shops · {M} in stock" summary line; the honesty line (stock as last seen; prices at the seller's shop); filter chips (All sellers / Small farms only) as real `<a href>` links; then **every listing card in full** — seller name linking to `/seller/{slug}`, Small Farm badge when flagged, location, stock-state word + dot, "Checked {friendly date}" or "Not yet checked", packet sizes, listing notes, "Report a problem" link (`/report?type=correct&seller=…&variety=…`), outbound "Visit shop" through `/go/{listing_id}`. SSR sort: in-stock first, sold-out last, stable (§3.1, measured).
   - Sibling strip: up to 6 other varieties of the same crop as cards with real links.
   - JSON-LD: `BreadcrumbList` + sellers `ItemList` (deduplicated by seller slug; omitted/empty when zero sellers).
   - Cache headers per §9: `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`, keyed on the canonical URL (the variant keys separately).
   - No "Loading…"/skeleton placeholder in any server response for this template, ever (§1 item 2).
3. **Zero-seller rendering:** the same template's zero-seller form — no-sellers artwork/state, the honest no-seller copy, and the **waitlist block** ported from `v2/components/variety/WaitlistBlock.tsx`: server-rendered form with exactly v2's pre-join fields and behavior (the floor form must be in the SSR HTML, as the live page's is). Account-aware interactive join states are Slice 6 scope — do not invent them; render the block faithfully and say so in the summary. The page stays indexable and in its sitemap cohort (Slice 2 machinery — do not break it).
4. **Small-farms variant:** `?small_farm=true` per §3.2 — same page narrowed to badged sellers (empty state from `smallFarmEmptyVariety` copy when none qualify), answer sentence and facts remain the FULL-set facts, "Small farms only" chip carries `aria-current`, `SmallFarmLegend` renders, `noindex, follow` + canonical to the clean URL, own cache entry. The internal path `/variety/[slug]/small-farms` never serves a 200 — it 301s to the public URL.
5. **Statuses & redirects (all 301, one hop):** unknown or malformed slug (loader rejects anything not matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`) → **true 404** with the app's 404 page and a 404 status — never the app shell with a 200. Merged slug → 301 to `/variety/{surviving-slug}` (preserving `?small_farm=true`). `/varieties/{slug}` → 301 `/variety/{slug}`. `/variety?v={slug}` → 301 `/variety/{slug}`.
6. **OG route:** port the v2 generator (`v2/app/og/[kind]/[slug]/route.tsx`, `v2/components/og/OgCardImage.tsx`, `v2/lib/seo/og-card.ts` — fonts bundled exactly as v2 bundles them; a fallback font is a silent change to the share surface) to serve `/og/[kind]/[slug]` for kinds `variety`, `seller`, `crop`, `site` (`site/default` = the fallback card). 1200×630 PNG. Malformed slug → 404, no card.

## Step 3 — Demonstrations (state each result in your summary)

- **Raw-HTML drive:** fetch/render the with-sellers and zero-seller samples with no JavaScript and assert the §3.1 Quinn-check list against the fixtures' real data (title with real count, answer sentence with real names / no-seller wording, facts labels, waitlist markup on zero-seller, JSON-LD types, OG tags, and the global absences: no `noindex` on either sample, no prohibited JSON-LD string, no price pattern, no loading placeholder).
- **Cache-invalidation proof on the built artifact:** change a sampled listing's stock state in the data source → revalidate → re-fetch the variety page AND its small-farms variant without cache-busting parameters: the new state and date are present. If the change only appears after the s-maxage window, the invalidation path is broken — fix it, don't report around it.
- **Freshness spot-check:** the rendered stock word + checked date equal the data source's current values at render time.

## Your summary must state (all of it — the accounting is a deliverable; omissions are findings)

- The Step-1 red result (tests failing on the starting tree) and the final green result, with test counts.
- The route inventory shipped, mapped to the deliverables above (variety page, variant, internal-path redirect, legacy redirects, OG kinds).
- Per-template head-exclusivity counts (canonical / description / og:url / og:image occurrences) for the with-sellers, zero-seller, and variant renders.
- The 301 pick, stated as the uniform permanent-redirect code.
- The invalidation demonstration and its result; the freshness spot-check result.
- OG verification per kind (status, content type, dimensions) — variety and site at minimum, all four kinds if shipped.
- The sample fixtures used, by slug and kind.
- Anything missing and why — plainly.
