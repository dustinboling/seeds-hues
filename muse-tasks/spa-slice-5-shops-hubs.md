# Slice 5 — Seller shops + hubs (Seed Directory SPA conversion)

You are building Slice 5 of 9 in the Seed Directory's conversion to a Vike + React SPA. Slices 0–4 are merged: the `app/` tree, the data layer (`app/src/data/`), the revalidate machinery, variety detail routes (Slice 3), browse + search (Slice 4), and the extended verify chain are yours to build on. Read first: `spa-conversion-2026-11-23/BUILD-SEQUENCE.md` (Slice 5 row), `spa-conversion-2026-11-23/ROUTE-INVENTORY.md` (seller/crop/series/state rows), Bea's `spa-conversion-2026-11-23/PRERENDER-CONTENT-AUDIT.md` — **§1 (global contract), §1.1 (structured-data inventory), §1.2 (price guard, two checks), §1.3 (facet policy), §3.3 (`/seller/[slug]` shop), §3.4 (`/crop/[slug]`), §3.5 (`/series/[slug]`), §3.6 (`/state/[slug]`), §4.1 (pagination rule, incl. the `?page=1` port requirement on detail templates), §8.4, §9** — and the gate records `QUINN-GATE-spa-slice-3.md` / `QUINN-GATE-spa-slice-4.md` for the carries this slice discharges. Consult the current official Vike docs where needed.

**Work tests-first, assert exclusivity as well as presence, state your starting-red result, and treat your summary accounting as a deliverable** — the standing slice discipline. This slice also carries a gate obligation from Slice 4 (below).

## Standing constraints

- Still INERT: nothing deploys; `v2/` stays the live tree, untouched except — if unavoidable — the verify chain. No `.github/workflows/*` edits (stop and report if one seems required). No deploy-config changes.
- Behavior and copy are a PORT of the live `v2/` pages as they stand on main today — including the SHOP presentation (seller page = the seller's shop: product grid, shop search/filters with the crop filter group first, grouped sort — in-stock + preorder first then out-of-stock, Name A–Z the sole key within each group — the tool thresholds 1–8 / 9–24 / 25+, the contact block with the public customer-service phone/email fields, and the locations area for sellers with ≥2 qualifying locations, primary first and marked). Port faithfully; do not invent copy or behavior. US spelling.
- Prices are NEVER shown anywhere — visible copy, meta, OG, JSON-LD, or any rendered API field. Packet sizes show; prices never do. Ratings render as visible state/panels only, never as structured data (§1.1 prohibited list).
- Permanent redirects are **301, uniformly, one hop** (the Slice 3 pick stands).
- The state-outline icon set (item SI) is a separate FROZEN design — do NOT build it in this slice. Port state pages with the artwork/plates v2 renders today, no substitutes.
- Production standard: strict TS, no stubs. Every deliverable ships complete or your summary reports what is missing and why, plainly.

## Step 1 — Discriminating tests FIRST

Extend the fake catalog / stub so the shop and hub surfaces can discriminate:

- **(i)** a seller with **>24 listings** (page 2 exists), mixed stock states, packet sizes, checked dates; a parseable "City, ST" location; a description; seller-type tags incl. Small Farm.
- **(ii)** a **multi-location** seller (primary physical + a mailing location, per the multi-location rule).
- **(iii)** a seller whose location does NOT parse to "City, ST" (no `PostalAddress` may be emitted).
- **(iv)** a **zero-listing** seller (shop resolves 200, indexable).
- **(v)** a **removed** seller (the seller-status source reports removed → 410).
- **(vi)** a crop with **>24 varieties** (page 2), one with a series subset for the crop filter test.
- **(vii)** a series with varieties, and a series with varieties but **zero with sellers**.
- **(viii)** a state with sellers (paginated if the fixture count forces it) — and rely on a real state absent from the fixture set for the no-seller-state 404.

Tests that FAIL on the current tree and pass only when the surface is real (state the red result in your summary):

- **Shop page 1 SSR:** 200; H1 = seller name; title pattern "{Seller} — Flower Seed Seller"; meta description composed to a complete sentence (the m-5 clip must be structurally impossible — assert the description ends at a sentence boundary); `Organization` JSON-LD with the real name AND `PostalAddress` matching the fixture's city/state for (i), and NO `PostalAddress` for (iii); `ItemList` with exactly 24 entries; ≥1 `href="/variety/…"` anchor; a stock word + checked date matching the source; the contact block rendering the fixture's public CS phone/email; homepage link present, direct (not via any portal/`/go/`).
- **Shop page 2:** 200; self-canonical to `?page=2`; `ItemList` positions start at 25; variety names differ from page 1. `?page=1` → single 301 to the clean shop URL. Page past the end → true 404; zero-listing seller (iv) with `?page=2` → 404 while its page 1 is 200.
- **Multi-location (ii):** the locations area renders both locations with their kind labels (physical / mailing), primary first and marked; exactly ONE shop page (no per-location pages).
- **Removed seller (v) → 410**, with the noindex Gone page linking to `/seller` — and 410 asserted DISTINCT from 404 (unknown slug → true 404).
- **Crop hub page 1:** 200; H1; Latin name string; title counts matching the fixture; `ItemList` present; ≥1 `href="/variety/…"` anchor; cards carry the variety's Latin name. **Filtered view** (`?has_sellers=true`): 200, `noindex`, canonical = the clean crop URL. **Malformed filter values** (`color_family` failing its pattern, `has_sellers` not true/false) → **true 404** (this template's strict parse is deliberate — preserve the difference from the browse pages' forgiving parse). Page 2: self-canonical, positions from 25. `?page=1` → 301.
- **Series hub:** 200; H1; crop link anchor; `ItemList` count = the fixture's variety count for the series; the zero-with-sellers series (vii) renders 200 and indexable (no `noindex`).
- **State hub:** 200; **absolute** title "Seed sellers in {State} — Seed Directory"; H1; `ItemList` present; ≥1 `href="/seller/…"` anchor; intro seller count matching the fixture; "Add Your Farm" link to `/add-your-farm?state={code}`. A state absent from the visible-seller set → true 404.
- **OG (the §3.4 m-2 port item):** crop, series, and state pages declare a generated 1200×630 card (`/og/crop/{slug}` etc.) as `og:image` — NOT the portrait artwork; shop pages declare `/og/seller/{slug}`. Assert the declared URLs and that the generator serves them (Slice 3 built all four kinds).
- **Exclusivity** on every new template: exactly one canonical / description / og:url / og:image / title.
- **Price guard** on every rendered template: no prohibited JSON-LD string, no price pattern (grid cards show packet sizes, never prices — the shop grid is where the grep matters most).
- **Slice 4 carry, end-to-end:** `/sellers/{fixture-slug}` → 301 → the shop page returns 200; `/seller?s={fixture-slug}` → 301 → 200.

Design assertions so the suite fails if: a removed seller renders 404 or 200 instead of 410, an `Organization` gains a `PostalAddress` the location doesn't parse to, a crop's malformed filter renders 200, a series with zero sellers-with-sellers gains a `noindex`, or a hub page declares the portrait artwork as its OG image.

## Step 2 — The routes, wired through the machinery

1. **Data layer:** extend `CatalogApi` with the shop/hub reads — the same JSON the live API returns (the "one backend" rule): seller detail (record + paginated listings + contact fields + locations), crop detail (record + paginated varieties + filter facets), series detail, state detail. The removed-seller status consumes the EXISTING live precedent — `GET /api/internal/seller-status/{slug}` (measured in v2; this one exists, unlike Slice 3's variety-status) — wired through the stub in tests the same way. Register all new pages in the revalidate fan-out (`revalidate.ts` taxonomy already names seller/crop/series tags and the list paths).
2. **`/seller/[slug]` — the shop, on-demand SSR, paginated** per §3.3 + the SHOP design as shipped in v2: composed title/description (complete sentence, never the mid-word clip), self-canonical per page, OG = `/og/seller/{slug}`, breadcrumbs + `BreadcrumbList`, `Organization` (PostalAddress only from a parseable location — never invent an address), `ItemList` of that page's varieties with continuous positions; H1, type-label eyebrow, location line (all locations labeled where multiple), state plate/artwork where one exists (no substitutes), type tags (open-ended; Small Farm tag + badge where flagged), description prose, homepage link (direct outbound), rating display as visible state only, the shop grid (cards → `/variety/{slug}` with Latin name, stock word, checked date, packet sizes; in-stock-first grouped ordering as the shop design specifies), shop search/filters/sort at the design's thresholds, the contact block (public CS phone/email with the graceful-absence behavior v2 ships), the locations area (≥2 qualifying locations, primary first and marked), pagination anchors, footer facts. Zero-listing seller: 200, indexable, real empty shop. Removed seller: **410** before render, noindex Gone page linking to `/seller`. Unknown/malformed slug: true 404. `?page=1` → 301; out-of-range → true 404.
3. **`/crop/[slug]` — SSR hub, paginated** per §3.4: title/description with counts (+ trustworthy last-updated date where the data carries one), self-canonical per unfiltered page, OG = generated `/og/crop/{slug}` card (m-2), breadcrumbs + `BreadcrumbList` + `ItemList` (continuous positions), H1 + Latin line, crop facts block as v2 renders it, hero/pod artwork as a real `<img>` where present, filter chips (color family, series, has-sellers) as real links, variety grid (Latin name on cards), pagination anchors. Filtered views `noindex, follow` + canonical to the clean crop page; malformed filter values → true 404 (strict parse, deliberate). Thin hubs stay indexable — no count-threshold noindex. `?page=1` → 301; out-of-range → true 404. Plural legacy `/plants/{slug}`, `/categories/{slug}` → 301 to `/crop/{slug}` (extend Slice 3/4's redirect module, don't fork it).
4. **`/series/[slug]` — SSR hub, full grid (NO pagination** — the port does not paginate this template; §3.5's flag is noted, not assumed) per §3.5: title/description with counts + Latin, canonical self, OG = generated card (m-2), breadcrumbs (Home → crop → series) + `BreadcrumbList` + `ItemList` of ALL the series' varieties, H1 + sub-line, facts card (crop link, counts), full variety grid. Indexable including zero-with-sellers series. Unknown slug → true 404.
5. **`/state/[slug]` — SSR hub, paginated sellers** per §3.6: ABSOLUTE title, description from seller count, self-canonical per page, breadcrumbs + `BreadcrumbList` + `ItemList` (continuous positions), state scene artwork and/or plate as they exist (real `<img>`, no substitutes), H1, intro with the real count (+ "Page N of M" when paginated), "Add Your Farm" link (`/add-your-farm?state={code}`), seller cards → `/seller/{slug}`, pagination anchors. Any slug outside the visible-seller state set → true 404 (including real states with no sellers). `?page=1` → 301; out-of-range → true 404.
6. **Cache headers** per §9 on all SSR responses (public, s-maxage=3600, stale-while-revalidate=86400), keyed on canonical URLs (filtered crop views keyed separately so they can never serve as the clean page).

## Step 3 — Demonstrations (state each result in your summary)

- **Raw-HTML drive** of shop pages 1–2, the multi-location shop, the zero-listing shop, crop pages 1–2 + a filtered view, the series hub (both series fixtures), and the state hub — no JavaScript, the §3 Quinn-check lists against fixture data.
- **410/404 discrimination drive:** removed → 410 with the Gone page; unknown → 404; the two are never the same response.
- **Shop usability evidence:** the shop's own search narrows to the shop's varieties only; the crop filter group leads the filter groups; the grouped sort orders in-stock A–Z above out-of-stock A–Z (assert the rendered order on a mixed fixture).
- **Invalidation spot proof:** change a fixture listing's stock → seller-tag revalidate → the shop page AND the variety page reflect it without a rebuild.

## Your summary must state (all of it — the accounting is a deliverable; omissions are findings)

- The Step-1 red result and the final green result, with test counts.
- The route inventory shipped, mapped to the deliverables (shop, crop, series, state, the legacy crop redirects, the Slice 4 carry chain).
- Per-template head-exclusivity counts for every new template.
- The 410/404 discrimination result; the PostalAddress presence/absence results per fixture.
- OG declarations per hub template (generated card, not portrait) and their serving status.
- Fixture counts used (listings per shop, varieties per crop, series sizes, states).
- Anything missing and why — plainly.
