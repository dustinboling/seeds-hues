# Slice 4 — Browse + search (Seed Directory SPA conversion)

You are building Slice 4 of 9 in the Seed Directory's conversion to a Vike + React SPA. Slices 0–3 are merged: the `app/` tree, the data layer (`app/src/data/`), the revalidate machinery, the variety detail routes (Slice 3, Quinn PASS WITH NOTES, record `QUINN-GATE-spa-slice-3.md`), and the extended verify chain are yours to build on. Read first: `spa-conversion-2026-11-23/BUILD-SEQUENCE.md` (Slice 4 row), `spa-conversion-2026-11-23/ROUTE-INVENTORY.md` (browse/search rows), and Bea's `spa-conversion-2026-11-23/PRERENDER-CONTENT-AUDIT.md` — **§1 (global contract), §1.1 (structured-data inventory), §1.3 (facet and parameter policy — binding), §4.1 (the pagination rule), §4.2 (`/variety`), §4.3 (`/seller`), §4.6 (`/search`), §8.4 (`?page=1` row)**. Consult the current official Vike docs for SSR data hooks and client-side navigation behavior.

**Work tests-first, assert exclusivity as well as presence, and treat your summary accounting as a deliverable** — the Slice 2/3 discipline, unchanged. Slice 3's gate also left this slice a carry (below).

## Standing constraints

- Still INERT: nothing deploys; `v2/` stays the live tree, untouched except — if unavoidable — the verify chain. No `.github/workflows/*` edits (stop and report if one seems required). No deploy-config changes.
- Behavior is a PORT of the live `v2/` browse/search as it stands on main today — including the Tranche 3 behavior set: multi-select Hue (independent toggles, OR within Hue, AND across filter groups, one remover chip per hue), the sort control (Name A–Z default; the availability sort by distinct-seller count), Clear All preserving the shopper's sort, the in-place swap with the pending cue (fading region + leaf hairline + `aria-busy` on the region), and search's autocomplete ranking + did-you-mean + grouped results with truthful totals. Port faithfully; do not invent copy or behavior. US spelling.
- Prices are NEVER shown anywhere — visible copy, meta, OG, JSON-LD, or any rendered API field. Packet sizes show; prices never do.
- Permanent redirects are **301, uniformly, one hop** (the Slice 3 pick stands).
- Production standard: strict TS, no stubs. Every deliverable ships complete or your summary reports what is missing and why, plainly.

## Step 1 — Discriminating tests FIRST

Extend the fake catalog / stub so the browse and search surfaces can discriminate: enough varieties to force at least 3 pages at 24/page (the fixture set may synthesize catalog entries — clearly fixture data, never production claims), at least 2 pages of sellers, varieties spanning at least two hues/seasons/life cycles, a small-farm-only subset, and search fixtures where one query matches across at least three groups (Crops, Varieties, Sellers) and one query matches nothing.

Tests that FAIL on the current tree and pass only when the surface is real (state the red result in your summary):

- **`/variety` page 1 SSR:** status 200; H1; results count line with the fixture total and "Page 1 of N"; `ItemList` with exactly 24 entries, positions 1–24; the first card's name = the fixture's alphabetical first; pagination anchor `href="/variety?page=2"` present as a real anchor.
- **Page 2:** status 200; **self-canonical** `…/variety?page=2` (NOT canonicalized to page 1); `ItemList` positions start at 25; zero name overlap with page 1's ItemList.
- **`?page=1` → a single 301 to `/variety`** (new behavior, Bea §4.1 port requirement). Same for `/seller`.
- **Out-of-range/malformed page** (`?page=99`, `?page=0`, `?page=-1`, `?page=abc`) → **true 404**, no empty 200, no clamp redirect.
- **Filtered view** (e.g. `?color_family=<fixture hue>`): 200, `noindex`, canonical exactly `/variety` (clean, no parameters); multi-hue selection renders the OR-union; combined hue + season renders the AND-intersection (assert fixture names present AND absent accordingly).
- **`/seller` page 1 SSR:** 200; H1; `ItemList` 24 entries; `href="/seller/…"` card anchors; `href="/seller?page=2"` anchor; state-filtered view (`?state=<fixture state>`): 200, `noindex`, canonical `/seller`.
- **`/search`:** with a multi-group query — 200, `noindex`, canonical exactly `https://seeds.hues.flowers/search`, results server-rendered (result anchors to `/variety/`, `/crop/`, `/seller/` present in raw HTML), and EVERY matching group rendered with truthful group counts (the Tranche 3.4 defect — only the Series group under a full-total heading — must be structurally impossible: assert per-group presence and counts, not just one anchor). Zero-results query: 200 with the zero-results state, never a 404. Bare `/search`: 200, search form present, `noindex`.
- **Exclusivity:** exactly one canonical / description / og:url / og:image on each rendered template above (the Slice 2 F6 lesson applies to every new template).
- **Price guard** on every rendered template: no prohibited JSON-LD string (§1.1), no price pattern.
- **Slice 3 carry, end-to-end:** `/varieties` → 301 → `/variety` returns 200; `/variety?v={fixture-slug}` → 301 → the variety page returns 200. (Slice 3 shipped the redirects; this slice builds their landing — prove the whole chain.)

Design assertions so the suite fails if: page 2 canonicalizes to page 1, a filtered view loses its `noindex` or gains a self-canonical, an out-of-range page renders 200, a search group is dropped while the total still counts it, or a pagination URL appears in any sitemap segment (Slice 2 machinery — no regression).

## Step 2 — The routes, wired through the machinery

1. **Data layer:** extend `CatalogApi` with the browse/search reads — the same JSON the live API returns (the "one backend" rule). Paged variety list (with filter parameters), paged seller list (with state parameter), and search. Wire through `load.ts`'s cache with correct purge routing (list tags already exist in `revalidate.ts`'s taxonomy — register the new pages against them).
2. **`/variety` browse — SSR, paged** per §4.2: title/description builders (incl. the filtered forms), breadcrumbs + `BreadcrumbList`, `ItemList` (that page's 24, positions continuous across pages), H1, results count line, filter controls as real links/forms targeting the §1.3 parameterized URLs, the variety grid (cards link to `/variety/{slug}`; name, crop, Latin name on the card, seller-count/stock summary — the ported VarietyCard), real pagination anchors (prev/next/numbered). Unfiltered pages indexable + self-canonical; filtered views `noindex, follow` + canonical `/variety`. `?page=1` → 301; out-of-range → true 404.
3. **In-place behavior (progressive enhancement over the SSR routes):** filter/sort/page changes swap in place without a full-page reload, with the pending cue exactly as the live site behaves today (region fades, leaf hairline across the region's top edge, `aria-busy` on the region while loading, sort preserved by Clear All). The clean URLs remain the crawlable truth; the router introduces NO new crawlable facet URLs (§1.3).
4. **`/seller` index — SSR, paged** per §4.3: title/description (incl. state-filtered form), breadcrumbs + `BreadcrumbList`, `ItemList` continuous positions, H1, farms artwork (real `<img>` + alt), state filter targeting `?state={code}` views, Small Farm legend, seller cards (name → `/seller/{slug}`, location, type tags/badge, variety count — port the live card; the state-outline icon set is a separate frozen item, NOT this slice), pagination anchors. Unfiltered indexable + self-canonical; `?state=` views `noindex, follow` + canonical `/seller`. `?page=1` → 301; out-of-range → true 404; legacy `?s={slug}` → 301 to `/seller/{slug}`; plural `/sellers` → 301 to `/seller` (both already patterned by Slice 3's redirect module — extend it, don't fork it).
5. **`/search` — SSR** per §4.6: title/description; canonical `/search` regardless of `?q=`; `noindex, follow` on every search URL; the search box with the query filled; server-rendered grouped results (Crops, Series, Varieties, Sellers) with real links and truthful per-group counts; zero-results state (artwork + "Nothing matches…" + `/report?type=correct` link); browse shortcut chips on the empty-query form; over-long `?q=` truncated at 100 chars, never an error; did-you-mean + autocomplete behavior ported from the live search (the header SearchBox contract the shell already carries).
6. **Cache headers** per §9 for the SSR list/search responses (public, s-maxage=3600, stale-while-revalidate=86400) keyed on the canonical URL; filtered/search responses keyed so a filtered view can never be served as the clean page (state your keying).

## Step 3 — Demonstrations (state each result in your summary)

- **Raw-HTML drive** of `/variety` pages 1–2, a filtered view, `/seller` page 1 + a state view, and `/search` (multi-group + zero-results + bare) with no JavaScript: the §4 Quinn-check lists against fixture data.
- **In-place drive:** exercise the hydrated browse page as a user — change a filter, change sort, page forward — results swap in place with the pending cue visible during the swap and `aria-busy` set on the region; Clear All preserves the sort.
- **Facet canonical audit:** enumerate every parameterized URL the UI can produce from the fixtures and assert each is `noindex` + canonical-to-clean (or a §1.3-promoted landing — none are promoted at conversion time).

## Your summary must state (all of it — the accounting is a deliverable; omissions are findings)

- The Step-1 red result and the final green result, with test counts.
- The route inventory shipped, mapped to the deliverables (browse, seller index, search, the ?page=1 redirects, the legacy seller redirects, the Slice 3 carry chain).
- Per-template head-exclusivity counts for every new template.
- The facet canonical audit result (how many parameterized URLs enumerated, all conforming or the exceptions).
- The in-place drive result (cue observed, aria-busy, Clear All behavior).
- Fixture counts used (varieties/sellers synthesized, pages forced).
- Anything missing and why — plainly.
