# Seed Directory SPA conversion — Prerender-content audit

**From:** Bea Discovery (SEO/GEO)
**To:** Hue (project lead), for the Seed Directory SPA build and Quinn Assurance's gate
**Date:** 2026-11-23
**Scope:** `seeds.hues.flowers` only — what every public route template's
server-rendered HTML must contain after the Vike + React + TypeScript
conversion, how indexability, status codes, redirects, sitemaps, and
live-data freshness carry over, and the exact raw-HTML checks Quinn runs
per template at the gate.
**Inputs read:** this seat's playbook; this seat's SPA validation
(`seo-validation-bea.md`, especially §1.5 the per-route contract, §3 the
seeds rules, §5 the measurement plan); the Phase-1 architecture plan §2.2
(seeds) including its 2026-11-23 addenda; the current build's source at
`seeds-hues/v2/app` and `v2/lib` (sitemap, robots, metadata, JSON-LD,
paging, middleware, `next.config.ts` redirects — all read 2026-11-23);
this seat's 2026-11-22 seeds audit (`seo-audit-2026-11-22/AUDIT.md`).

**Evidence grades:** STRONG = primary-source documentation or the
property's own records / source read directly; MODERATE = measured but
limited, or documented mechanics with observed-behavior support;
WEAK-CONTENDED = labeled as such and never load-bearing. Data labels:
*measured* (production D1 counts supplied for this audit, or source read),
*reported* (named source), *inferred* (reasoned from documented behavior),
*no data found*.

---

## Verdict, up front

**The conversion is safe for findability if — and only if — the port
treats "server-rendered" as "complete primary content in the first HTML
response," template by template, exactly as specified below.** The plan's
rendering split is correct and is adopted without change: slug routes
render **on-demand SSR + edge cache** (`prerender: false`, rendered by the
Worker at request time, invalidated on data change); the static set is
prerendered. Build-time prerendering of 1,000+ growing slug pages is the
wrong tool — for freshness and build cost, not for SEO: a crawler cannot
tell an on-demand SSR response from a prerendered one, and must never be
able to tell either from a shell. **STRONG** (Google Search Central
JavaScript SEO basics; validation §1.1, §1.6).

Three port-specific dangers dominate, in consequence order:

1. **Shell drift.** A Vike starter that prerenders chrome + metadata and
   hydrates the body would pass a casual look and fail every crawler that
   does not execute JavaScript — which, at MODERATE grade (documented
   absence + consistent log observation), includes the AI retrieval
   crawlers. The per-template content contracts and Quinn's raw-HTML
   checks in this audit are the mitigation. They are gate items, not
   guidance.
2. **Cache dishonesty.** Stock state and last-checked dates are the
   directory's product claim. The live site already caches stock-bearing
   HTML far harder than its own spec proposed (audit finding m-4:
   `s-maxage` ≈ 22.7 h with 30-day stale-while-revalidate, *measured*
   2026-11-22). The plan's edge cache (`s-maxage=3600`,
   stale-while-revalidate 86,400, invalidate on write) is an improvement
   **only if the invalidation path actually fires on every data change** —
   ingest, admin edits, crawl/scout writes, and stock-check results.
   §9 names the regions and the invalidation contract.
3. **Silent rule loss in the port.** Five behaviors the current build gets
   right are easy to lose in a rewrite and invisible until Google reports
   them weeks later: zero-seller varieties staying indexable (decision
   27), filtered views canonicalizing to the clean route with `noindex`,
   removed sellers answering **410** (not 404, not a soft redirect),
   merged varieties answering a permanent redirect to the surviving slug,
   and the price-free JSON-LD guard. Each is specified per template below
   and each has a gate check.

**New risks found in this pass** (detailed in §12): the `?page=1`
one-hop redirect the plan requires **does not exist in the current
build** — it must be built, not carried; the current permanent redirects
are **308**, the plan and validation say **301** — the port must pick one
code at the edge and apply it uniformly; the seller page's paginated
listings and the crop page's paginated varieties mean a "template" is
really a family of paginated URLs whose ItemList positions must stay
continuous across pages; and the `/variety/[slug]/small-farms` internal
path must never become a second public address in the new router.

Nothing in this audit blocks the conversion. The one carried dependency —
Search Console read access for this seat — is recorded in §10 and does
not block the audit or the build; it blocks only the baseline.

---

## 0. Counts, method, and reconciliation

### 0.1 Live production counts (the audit's denominators)

Supplied for this audit from production D1, 2026-11-23 (*measured*):

| Set | Count | Note |
|---|---|---|
| Active varieties | 818 | 556 with ≥ 1 published listing; 262 zero-seller |
| Live sellers / shops | 83 | Approved sellers only in sitemap |
| Crops (plants) | 124 | |
| Series | 33 | |
| Published listings | 1,492 | |
| State pages in sitemap | 31 | States with ≥ 1 visible seller |
| Distinct seller regions in D1 | 32 | One region has no *visible* seller — see §0.2 |

Growth since this seat's 2026-11-22 audit snapshot (812 varieties, 83
sellers, 124 crops, 32 series, 1,489 listings, 1,128 sitemap URLs,
*measured* then): +6 varieties, +1 series, +3 listings. The zero-seller
count is unchanged at 262 — the six new varieties arrived with listings.
No discrepancy; the directory grew by one day's scout/hunt work.

### 0.2 The 31-vs-32 state gap is expected, not a defect

`listSellerStates()` returns only states with ≥ 1 **visible** seller, and
only those resolve at `/state/[slug]` and enter the sitemap (source:
`v2/app/state/[slug]/page.tsx`, `v2/app/sitemap.ts` — *measured*). D1
holds 32 distinct seller regions; the 32nd region's sellers are not
visible (inactive, pending, or all listings unpublished). The port must
preserve exactly this rule: **a state page exists iff it has a visible
seller.** A state slug for a real US state with no visible seller is a
true 404 (§6.10), and it must appear in no sitemap. If the 32nd region
gains a visible seller, its page and sitemap entry appear automatically
from the same query — no template change.

### 0.3 Method

Every content contract below was derived from the current template's
source — its `generateMetadata` / `pageMetadata` call, its JSON-LD
builders (`v2/lib/seo/jsonld.ts`), its heading and link structure, and
its `notFound()` / redirect paths — not from the rendered site alone.
Where source and the 2026-11-22 live audit agree, the item is graded
STRONG (*measured*). Where this audit specifies something the current
build does **not** do (the `?page=1` redirect; segmented sitemaps;
Organization `sameAs`/logo), it is labeled a **port requirement**, never
described as carried behavior.

### 0.4 Rendering split (plan §2.2, adopted verbatim)

| Class | Templates | Rendering |
|---|---|---|
| On-demand SSR + edge cache | `/variety`, `/seller` (paged browse), `/variety/[slug]`, `/variety/[slug]/small-farms` (public URL `?small_farm=true`), `/seller/[slug]`, `/crop/[slug]`, `/series/[slug]`, `/state/[slug]`, `/search` (noindex), `/report`, `/add-your-farm`, `/account`, `/unsubscribe`, sitemap files, `/llms.txt` | `prerender: false`; Worker renders complete HTML at request time; edge-cached per §9 |
| Prerendered (static set) | `/`, `/crop`, `/about`, `/about/data`, `/about/bot`, `/api-docs`, `/privacy`, `/terms`, `/offline` | Build-time prerender. **Caution:** `/` and `/crop` carry live counts (see §9) — prerendered does not mean frozen; they regenerate on the same data-change invalidation as the SSR set, or render on-demand. A build-time snapshot of the home coverage line is a stale fact on day two. |
| Route handlers, never pages | `/go/[id]`, `/og/[kind]/[slug]`, `/api/*`, `/admin/login`, `/admin/waitlist/action` | Status/redirect/image/JSON responses; no HTML contract; indexability rules in §7 |

The plan lists `/` in the static set. This audit accepts that **only**
with the regeneration condition above; the home page's coverage line,
recent-activity strip, and crop grid are data, and §1.6 of the validation
(live-data regions are server-rendered, not snapshot-prerendered)
governs them. If the build cannot invalidate `/` on data change, `/`
moves to the on-demand class. That is a build decision with an SEO
constraint, recorded here so it is made deliberately.

---

## 1. The global contract (applies to every template in §2–§7)

This is validation §1.5 specialized to seeds. Every item is a gate item.

1. **Head, in the HTML, never JS-injected:** unique `<title>` (root
   template `%s | seeds.hues.flowers` unless the template specifies an
   absolute title — home, state pages), meta description, self-referencing
   canonical, Open Graph + Twitter card (`summary_large_image`), robots
   meta exactly as the template's indexability row states. The client
   router must never rewrite the canonical. **STRONG** (Google: canonical
   in HTML is the best way; JS must not change it).
2. **Complete primary content in the first response:** headings in order,
   body text, and internal links as real `<a href>` anchors. No
   click-handler-only navigation anywhere — link discovery and link
   equity depend on it for Google and explicitly for Bing. No
   "Loading…", skeleton, or spinner placeholder in server HTML for any
   region listed in a template's contract. The current build's
   `loading.tsx` files (crop, seller, search, variety detail) are a
   client-navigation affordance only; they must never be what a cold
   request returns.
3. **Images:** every content image a real `<img>` with descriptive `alt`,
   width/height set (CLS), hero/LCP image eager + preloadable, never
   CSS-only or canvas. Artwork is self-hosted (media CDN /
   `images.seeds.hues.flowers`); no hotlinks.
4. **Breakpoint content parity:** mobile and desktop component sets carry
   the same substance. Under mobile-first indexing the thinner version
   *is* the indexed version. **STRONG** (Google mobile-first indexing
   documentation).
5. **JSON-LD mirrors the visible page**, word for fact, and carries
   forward today's inventory (§1.1). Nothing is added that the page does
   not show; nothing shown as a structured fact contradicts the page
   (the GeoSeed lesson, §11).
6. **The price rule, absolute:** no price in visible copy, in meta, in
   Open Graph, in JSON-LD, in `llms.txt`, or in any API response field a
   template renders — ever. Packet sizes show; prices never do. Two
   independent gate checks (§1.2).
7. **Status discipline:** 200 for real routes; true 404 for unknown
   slugs and out-of-range pages; 410 for removed sellers and removed
   sellers' `/go/` links; permanent redirect (one hop) for every moved
   URL in §8. The SPA fallback must distinguish known routes from unknown
   ones — an unknown path must never return the app shell with a 200
   (soft 404, the characteristic SPA defect; Google's JavaScript SEO
   documentation names it). **STRONG.**
8. **Performance:** LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th
   percentile on the phone rendering (field data). SSR protects LCP;
   hydration weight is the INP risk; per-template `performance-budget.json`
   + Lighthouse CI per the plan. CWV is reported as experience quality
   with a small documented ranking consideration, never as a ranking
   promise.

### 1.1 Structured-data inventory — carry forward exactly (source: `v2/lib/seo/jsonld.ts`, *measured*)

| Template | JSON-LD in server HTML |
|---|---|
| Every templated page with a trail | `BreadcrumbList` (Home → hub → page; variety trail includes crop and, when present, series) |
| `/` (home) | `WebSite` (name, url, description, publisher Organization "Hues Floral Park" → `https://hues.flowers`, `potentialAction: SearchAction` targeting `/search?q={query}`) + site `Organization` (Hues Floral Park) — plus the port additions in §11 |
| `/variety` (each page) | `BreadcrumbList` + `ItemList` ("Flower seed varieties"; one `ListItem` per card on that page, `position` continuous across pages: page *N* starts at `(N−1)×24+1`) |
| `/variety/[slug]` | `BreadcrumbList` + `ItemList` of sellers ("Where to buy {variety} seed"; deduplicated by seller slug; empty list / omitted when zero sellers — see §3.3) |
| `/seller` (each page) | `BreadcrumbList` + `ItemList` of sellers on that page (positions continuous as above) |
| `/seller/[slug]` (each page of its listings) | `BreadcrumbList` + seller `Organization` (name, homepage `url` when present, description when present, `PostalAddress` parsed from the location field only when it matches "City, ST" — never invent an address) + `ItemList` of the varieties on that page (positions continuous) |
| `/crop` | `BreadcrumbList` + `ItemList` ("Flower seed crops", all 124) |
| `/crop/[slug]` (each page) | `BreadcrumbList` + `ItemList` ("{crop} varieties", that page's varieties, positions continuous) |
| `/series/[slug]` | `BreadcrumbList` + `ItemList` ("{series} series varieties", all varieties in the series) |
| `/state/[slug]` (each page) | `BreadcrumbList` + `ItemList` ("Seed sellers in {state}", that page's sellers, positions continuous) |
| Static/informational (`/about*`, `/api-docs`, `/privacy`, `/terms`, `/add-your-farm`) | `BreadcrumbList` where the template has a trail today; no new types invented in the port |

Page size is 24 (`PAGE_SIZE`, *measured*). ItemList `numberOfItems` is
the count **on that page** in the current builders; positions carry the
cross-page continuity. The port must not "fix" this into a full-catalog
ItemList on page 1 — markup mirrors the visible page.

**Prohibited, anywhere, in any template** (the guard's list, owned by
this seat; extended only with this seat's sign-off): `@type` or key —
`Product`, `Offer`, `AggregateOffer`, `AggregateRating`, `Review`,
`FAQPage`, `price`, `lowPrice`, `offers`, `aggregateRating`, `review`,
`priceValidUntil`. Source: `PROHIBITED_JSONLD` in `v2/lib/seo/jsonld.ts`
(*measured*). No rating markup while unrated: "Not yet rated" is a state,
not a number, and imported ratings render as visible panels, never as
`AggregateRating`.

### 1.2 The no-price guard is two checks, both at the gate

1. **Code guard (ported):** `assertNoProhibitedJsonLd` (or its exact
   equivalent) runs in the new build's `verify` suite against every
   JSON-LD object every template builder can emit — the plan makes this
   port new and binding (plan §2.2 addendum, Data #1.2). A build that
   emits a prohibited type or key fails `verify`, before Quinn sees it.
2. **Template-level rendered-HTML check (Quinn):** on the sampled pages
   in §2–§6, Quinn greps the raw HTML for the prohibited strings and for
   price patterns (`$` followed by a number, "price" as a field label)
   in visible text, meta, and JSON-LD. Packet-size strings ("25 seeds",
   "1 g") are expected and are not prices. One hit anywhere fails the
   gate for the whole property, not just that template — a price leak is
   a template-system defect until proven otherwise.

The structured-data inventory itself ships as a diffable artifact
(`structured-data-inventory.md` per the plan, Data #1.1): Quinn diffs the
new build's emitted types/keys per template against §1.1 at the gate.

### 1.3 Facet and parameter policy (plan §2.2 addendum, Data #1.5 — binding)

- Filter state (season, sowing method, life cycle, color family / hue,
  small-farm, crop-page color/series/has-sellers, seller-index state)
  lives in query parameters for shareability but **every filtered view is
  `noindex, follow` with canonical to the clean unfiltered route** —
  exactly as the current build does (*measured* in `variety/page.tsx`,
  `crop/[slug]/page.tsx`, `seller/page.tsx`, variety detail small-farms).
  The router must not introduce crawlable facet URLs.
- Sort, page-size, and session parameters: disallowed in `robots.txt`
  (plan addendum) and never in any sitemap. The current build has no sort
  parameter (Name A–Z is the standing sort); if the SPA adds one
  client-side, it stays out of canonicals and sitemaps by this rule.
- Only a filter combination this seat promotes to a landing page (with
  demonstrated demand, from Console data) ever gets a self-canonical and
  a sitemap entry. None is promoted at conversion time.
- In-place filtering (no full-page reload) is the standing UX behavior;
  it is a progressive enhancement over the server-rendered clean route,
  never a replacement for it. A crawler following the clean URL gets the
  complete unfiltered page; a crawler following a filtered URL gets a
  complete filtered page that tells it, via canonical + `noindex`, not
   to index it. Both responses are full HTML.


---

## 2. How to read §3–§7 (the per-template contracts)

Each template gets four blocks, matching the task's items 1–4:

- **SSR content** — the complete primary content that must be in the
  server-rendered HTML (task item 1).
- **Indexability** — today and after conversion (task item 2).
- **Quinn check** — the exact raw-HTML, JavaScript-disabled gate check
  (task item 3). Uniform method unless stated otherwise: Quinn (or her
  script) fetches the **preview deploy's** URL with a plain HTTP GET —
  `curl` or equivalent, no JavaScript execution, a search-crawler user
  agent and a browser user agent in two passes — and asserts on the raw
  response body and status line. "Must contain" strings are checked
  against the sampled record's real data (the sample slugs are fixed at
  gate time from production D1 and printed in the gate packet; this audit
  names the *kind* of sample, never an invented slug). Every check also
  includes the global absences: no `Loading…` / skeleton placeholder
  text, no prohibited JSON-LD string (§1.2), no price pattern.
- **404s & redirects** — true-404 behavior and one-hop permanent
  redirects specific to the template (task item 4). The consolidated
  redirect map is §8.

Sample selection at the gate (plan §2.2 / validation §5.3, binding):
one variety **with** sellers, one **zero-seller** variety, one seller,
one crop hub — plus, per this audit, one series, one state, page 2 of
`/variety`, and one paginated seller page, because pagination and the
zero-seller cohort are where this port can silently fail.

---

## 3. Catalog detail templates (on-demand SSR + edge cache)

### 3.1 `/variety/[slug]` — variety detail (818 URLs)

**SSR content.** All of the following, from `variety-view.tsx`
(*measured*):

- `<title>`: "{Variety} {Crop} Seeds — Where to Buy ({N Seller[s] |
  No Seller Listing Yet})" (`varietyTitle`); meta description built from
  the answer sentence + variety + crop (common + Latin) + description
  (`varietyDescription`, clipped to a complete sentence boundary).
- Canonical: `https://seeds.hues.flowers/variety/{slug}`. OG image: the
  variety's own illustration (`mediaOgImage`, 1120×2240) when media
  exists, else the generated `/og/variety/{slug}` card (1200×630).
- Breadcrumbs (Home → crop → series when present → variety) as real
  anchors + `BreadcrumbList` JSON-LD.
- H1: variety name + "{crop} seeds" sub-line. Eyebrow: crop common name
  + Latin name. The **answer sentence** (`data-testid="answer"` — e.g.
  "As of {date}, {N} seller[s] list[s] {variety}: {names}" / the
  no-seller form) as visible text immediately under the H1. This sentence
  is the page's GEO substance: real facts, plainly stated, at the top.
- Hero image (`VarietyHeroImage`) when media exists: real `<img>`, alt =
  "{variety} {crop}".
- Facts list, complete: Crop (link to `/crop/{slug}`), Latin name,
  Series (link when present, else "None"), Hue/color family, Season,
  Sowing method, Pollination, Height, Days to bloom — unknown facts
  rendered as the word "Unknown", never omitted, never invented.
- Description prose (the variety's own description; seller names scrubbed
  from variety prose per standing rule — breeder names stay).
- "Where to buy {variety} {crop} seeds" H2 section: the
  "{N} shops · {M} in stock" summary line; the honesty line (stock is as
  last seen; prices are shown at the seller's shop — the current wording
  states the no-price posture in place); the seller-filter chips (All
  sellers / Small farms only) as real `<a href>` links; then **every
  listing card in full**: seller name as a link to `/seller/{slug}`,
  Small Farm badge when the seller's flag is true, seller location,
  stock-state word + colored dot (`in_stock` / `sold_out` / `preorder` /
  `shop_closed` / `unknown`), "Checked {friendly date}" or "Not yet
  checked", packet sizes, listing notes, "Report a problem" link
  (`/report?type=correct&seller=…&variety=…`), and the outbound "Visit
  shop" link through `/go/{listing_id}`. Sort order in SSR: in-stock
  first, then the existing order, sold-out last (stable sort,
  *measured*).
- Zero-seller form of the same section: the no-sellers artwork/state, the
  honest no-seller copy, and the **waitlist block** (join-the-list form)
  — a zero-seller page without its waitlist function has lost its
  purpose-test substance.
- Sibling varieties strip: up to 6 other varieties of the same crop, as
  cards with real links to their `/variety/{slug}` pages.
- JSON-LD: `BreadcrumbList` + sellers `ItemList` (§1.1).

**Indexability.** Today: indexable, in sitemap, **including all 262
zero-seller pages** — Dustin's decision 27 (2026-11-22), superseding the
old spec rule; the page's `indexable` flag is true for every active
variety (*measured*). After conversion: **identical.** No `noindex`, no
canonical-away, no thinning of zero-seller pages. Retired varieties
(status merged/discontinued/draft) are not in this set: merged → §3.1
redirects; others → 404.

**Quinn check.** Two samples (with-sellers, zero-seller). For each:
status 200; raw HTML contains the exact `<title>` pattern with the
sample's real seller count, the canonical link equal to the fetched URL,
the H1 variety name, the answer sentence containing the sample's real
seller name(s) (with-sellers) or the no-seller wording (zero-seller),
at least one `href="/seller/` anchor per listing (with-sellers) or the
waitlist form markup (zero-seller), the facts labels ("Latin name",
"Days to bloom"), `BreadcrumbList` and — with-sellers only — `ItemList`
in JSON-LD, and the OG meta tags. Must be absent: `noindex`, any
prohibited JSON-LD string, any price pattern, any loading placeholder.
The with-sellers sample's stock word and checked date in raw HTML must
match D1's current values for that listing at fetch time (freshness
spot-check, §9).

**404s & redirects.** Unknown slug (well-formed but not in D1, or
malformed — the loader rejects anything not matching
`^[a-z0-9]+(?:-[a-z0-9]+)*$`) → **true 404** with the §7.4 404 page.
Merged variety (status `merged`, `merged_into_id` set) → **permanent
redirect, one hop, to `/variety/{surviving-slug}`** (preserving
`?small_farm=true` when present) — the current build does this via
`permanentRedirect` from `mergedVarietyTarget()` (*measured*); the task
brief's "slug_redirects rows" are this mechanism: there is no separate
redirect table in the current schema, and the port must implement the
same lookup (merged slug → survivor) at the edge/router, sourced from
D1, not a hand-maintained list. Plural legacy `/varieties/{slug}` →
permanent redirect to `/variety/{slug}` (§8). Legacy `?v={slug}` on
`/variety` → permanent redirect to `/variety/{slug}` (§8).

### 3.2 `/variety/[slug]/small-farms` — public URL `/variety/[slug]?small_farm=true`

This is **not a second page**; it is the variety page narrowed to
Small-farm-badged sellers, with its own cache entry. Current mechanics
(*measured*, `middleware.ts` + `small-farms/page.tsx`): the public URL
keeps `?small_farm=true`; middleware rewrites it to the internal path
`/variety/{slug}/small-farms`; a direct outside request for the internal
path is 308-redirected to the public URL.

**SSR content.** Identical to §3.1 except: the listing set is narrowed
to badged sellers only (with the small-farm empty state —
`smallFarmEmptyVariety` copy — when none qualify), the "Small farms
only" chip carries `aria-current`, and the legend (`SmallFarmLegend`)
renders. Everything else — H1, answer sentence (full-set facts; the
narrowing is a view, not a different fact base), facts, description,
siblings — is the parent page's.

**Indexability.** Today and after: **`noindex, follow`, canonical to the
unfiltered `/variety/{slug}`** (*measured* in `varietyMetadata`). Never
in any sitemap. The port must reproduce this exactly: if the new router
gives the variant a self-canonical or drops the `noindex`, it has
created a duplicate page set of up to 818 near-duplicates — a gate fail.

**Quinn check.** Fetch the public URL `…/variety/{sample}?small_farm=true`:
status 200; raw HTML contains `noindex`, canonical equal to the clean
variety URL (no query string), the variety H1, and only badged sellers'
names. Fetch the internal path `/variety/{sample}/small-farms` directly:
must be a single permanent redirect to the public `?small_farm=true`
URL — never a 200. Absences as global.

**404s & redirects.** Unknown slug → true 404 (same loader). Merged slug
→ permanent redirect to the survivor **with** `?small_farm=true`
preserved (*measured*). Any `small_farm` value other than exactly one
`true` (absent, `false`, garbage, repeated) is **off**: the request is
the ordinary variety page, not a 404 and not the variant (*measured* —
the forgiving parse is deliberate; do not "tighten" it in the port).

### 3.3 `/seller/[slug]` — seller / shop page (83 URLs, paginated listings)

The seller page is now the seller's **shop page** in presentation
(standing ruling): a product grid of its varieties, not a bare listing
table. The SEO contract is unchanged by the presentation; what follows is
the content the shop presentation must still carry in SSR.

**SSR content.** From `seller/[slug]/page.tsx` (*measured*), as
amended by the shop design (grid cards carry the variety's Latin name):

- `<title>`: "{Seller} — Flower Seed Seller" + " — page N" suffix on
  page N > 1; meta description: "{Seller} in {location}: {N} flower seed
  varieties listed, each with its stock state and the date it was last
  checked. {description}" — composed to a **complete sentence** within
  length (2026-11-22 audit finding m-5: the current template can clip
  mid-word; the port composes, it does not copy the clip).
- Canonical: the page's own URL (`/seller/{slug}` on page 1,
  `/seller/{slug}?page=N` on page N — self-referencing per page, §4.1's
  pagination rule). OG: generated `/og/seller/{slug}` card (1200×630).
- Breadcrumbs (Home → Sellers → seller) + three JSON-LD blocks:
  `BreadcrumbList`, seller `Organization` (with `PostalAddress` only
  from a parseable location — §1.1), `ItemList` of **that page's**
  varieties with continuous positions.
- H1: seller name. Eyebrow: seller type label. Location line (all of the
  seller's locations, each labeled physical / warehouse / mailing where
  the data carries multiple — shop-design SPEC-LOCATIONS; a seller has
  one shop page however many locations it has). State plate / state
  artwork where one exists for the seller's state (real `<img>` + alt;
  no substitute plate when none exists). Seller-type tags (open-ended
  tags, no single primary — "Small farm" is one tag among them, with the
  badge where flagged). Description prose. Homepage link (outbound,
  direct to the seller's own site — never through a portal). Rating
  display as a visible state ("Not yet rated" or the imported-rating
  panel) — never as structured data.
- The shop grid / listing set for that page (24 per page): each card a
  real link to `/variety/{slug}`, variety name, **Latin name on the
  card**, crop common name, stock-state word, "Checked {date}" /
  "Not yet checked", packet sizes — the same listing facts as §3.1's
  cards, headed from the variety side. In-stock first ordering inside
  the page set as today.
- Pagination nav (§4.1): real `<a href>` prev/next + page links.
- Footer facts: variety count, last-checked summary where the template
  shows it.

**Indexability.** Today: indexable, in sitemap (page 1 URL only in the
sitemap's seller entries; its `?page=N` URLs are crawlable via anchors —
see §8.2 on sitemap scope). After: identical. A seller with zero visible
listings still resolves (200) on page 1 — its shop is empty, its page is
real — and stays indexable; only a **removed** seller leaves the index
(410, below).

**Quinn check.** Sample seller (choose one with > 24 listings so page 2
exists). Page 1: status 200; raw HTML contains H1 seller name, the
`Organization` JSON-LD with the seller's real name (and, where the
sample's location parses, the matching `PostalAddress` — city/state must
equal D1, which is also the GeoSeed-class check: schema must not
contradict the page or D1), `ItemList` with 24 entries, at least one
`href="/variety/` anchor, a stock word + checked date matching D1.
Page 2 (`?page=2`): status 200, self-canonical to itself, `ItemList`
positions starting at 25, different variety names from page 1. Global
absences apply — on a shop page the price grep matters most: grid cards
show packet sizes, never prices.

**404s & redirects.** Unknown/malformed slug → **true 404**. Page past
the end → **true 404** (`assertPageInRange`; a zero-listing seller with
`?page=2` → 404). **Removed seller (eligibility `removed_by_request` /
listing policy `removed`) → 410 Gone**, served before the page renders
(current: middleware via `/api/internal/seller-status/{slug}`,
*measured*) with a `noindex` Gone page linking to `/seller`. The port
must keep 410 distinct from 404: 410 tells Google to drop the page
promptly; collapsing removed sellers into 404s (or worse, 200s) is a
gate fail. Plural legacy `/sellers/{slug}` and `?s={slug}` → permanent
redirects (§8).

### 3.4 `/crop/[slug]` — crop hub (124 URLs, paginated varieties)

**SSR content.** From `crop/[slug]/page.tsx` (*measured*):

- `<title>`: "{Crop} Seeds ({Latin}) — {N} Varieties, {M} With Sellers"
  + page suffix; description with counts and "Last updated {date}" when
  a trustworthy date exists. Canonical self-referencing per page
  (unfiltered form). OG: crop illustration (`mediaOgImage`) when media
  exists — **with the 2026-11-22 audit m-2 caveat carried as a port
  item**: the portrait 1120×2240 artwork declared as the OG image crops
  badly in landscape unfurls; the port gives crop (and series/state)
  pages generated 1200×630 cards like variety/seller, or explicitly
  re-rules otherwise — it does not silently re-ship the portrait OG.
- Breadcrumbs (Home → Crops → crop) + `BreadcrumbList`; `ItemList` of
  that page's varieties, positions continuous.
- H1: "{Crop} seeds" + Latin name line. Crop facts block as rendered
  today (life cycle / hardiness facts where the template shows them).
  Hero/pod artwork as a real `<img>` + alt where present.
- Filter chips (color family, series, has-sellers) as real links;
  the variety grid for that page: cards linking to `/variety/{slug}`
  with variety name, Latin name on the card (standing shop-grid rule
  applies to variety cards directory-wide), seller count / stock
  summary as the card design carries them.
- Pagination nav with real anchors.

**Indexability.** Unfiltered pages: indexable, in sitemap (page 1),
self-canonical per page. **Filtered views (`?color_family=`, `?series=`,
`?has_sellers=`): `noindex, follow`, canonical to the unfiltered crop
page** (*measured*). After conversion: identical. Thin-hub caution
(audit M-3): 67 of 124 crops held ≤ 3 varieties in November — they stay
indexable (they carry real facts and grow with the catalog) and are
monitored as a cohort via the segmented sitemap (§8.2); the port must
not noindex them by a count threshold invented during the build.

**Quinn check.** Sample crop with > 24 varieties. Page 1 raw HTML:
status 200, H1 crop name, Latin name string, `ItemList` present, ≥ 1
`href="/variety/` anchor, counts in title matching D1. Filtered fetch
(`?has_sellers=true`): status 200, `noindex` present, canonical equal
to the clean crop URL. Page 2: self-canonical, positions from 25.
Global absences.

**404s & redirects.** Unknown/malformed slug → true 404. Out-of-range
page → true 404 (zero-variety crop with `?page=2` → 404). Malformed
filter values: `color_family` failing its pattern or `has_sellers` not
`true`/`false` → true 404 (*measured* — this template 404s bad filter
values, unlike the browse pages' forgiving parse; preserve the
difference, it is deliberate per template). Plural legacy
`/plants/{slug}`, `/categories/{slug}` → permanent redirects (§8).

### 3.5 `/series/[slug]` — series hub (33 URLs)

**SSR content.** From `series/[slug]/page.tsx` (*measured*): title
"{Series} {Crop} Series — {N} Varieties, {M} With Sellers"; description
with counts + Latin; canonical self; breadcrumbs (Home → crop → series)
+ `BreadcrumbList`; H1 "{Series}" + "{crop} series" sub-line; facts
card (Crop as a link to `/crop/{slug}`, Varieties count, With-sellers
count); the full variety grid (all varieties in the series, cards
linking to `/variety/{slug}`); `ItemList` of all of them. OG: port item
per §3.4's m-2 note (generated 1200×630 card).

**Indexability.** Indexable, in sitemap — **including series with zero
varieties-with-sellers** (audit M-3 sampled one: "7 Varieties, 0 With
Sellers", indexable). After: identical, monitored as part of the series
cohort file. A series page's substance is its variety set + facts; the
port adds nothing and removes nothing.

**Quinn check.** Sample series raw HTML: status 200, H1 series name,
crop link anchor, `ItemList` count equal to D1's variety count for the
series, ≥ 1 `href="/variety/` anchor (or, for a single-variety series,
exactly that one). Global absences.

**404s & redirects.** Unknown/malformed slug → true 404. No pagination
on this template today (full grid); if the SPA paginates it, §4.1's
rules apply in full and this audit must be amended — flag, do not
assume.

### 3.6 `/state/[slug]` — state hub (31 URLs, paginated sellers)

**SSR content.** From `state/[slug]/page.tsx` (*measured*): **absolute**
title "Seed sellers in {State} — Seed Directory" + page suffix;
description from seller count; canonical self-referencing per page;
breadcrumbs (Home → Sellers → state) + `BreadcrumbList`; state scene
artwork as a real `<img>` (1200-wide CDN transform, scene alt text,
eager/high-priority) where a scene exists, state plate where one exists
— either, both, or neither, with no substitutes; H1 "Seed sellers in
{State}"; intro line with the real seller count (+ "Page N of M" when
paginated); "Add Your Farm" link to `/add-your-farm?state={code}`;
seller cards for that page (24/page) linking to `/seller/{slug}` with
location + counts as the card carries them; `ItemList` of that page's
sellers, positions continuous; pagination anchors. State icon/shape
wherever the design names a state (standing rule) — presentation layer,
but the SSR must include it, not hydrate it in.

**Indexability.** Indexable, in sitemap — only states with ≥ 1 visible
seller exist at all (§0.2). After: identical.

**Quinn check.** Sample state raw HTML: status 200, H1 state name,
absolute title, `ItemList` present, ≥ 1 `href="/seller/` anchor, seller
count in intro matching D1. Negative fetch: `/state/texas` (or any real
state with no visible seller at gate time — confirm from D1) must be a
true 404, and `/state/not-a-state` likewise. Global absences.

**404s & redirects.** Any slug not in the visible-seller state set →
true 404, including real states with no sellers (*measured*).
Out-of-range page → true 404.


---

## 4. Browse / index templates (paged lists)

### 4.1 The pagination rule (applies to `/variety`, `/seller`, and every paginated detail template above)

Source: `v2/lib/paging.ts`, `v2/app/sitemap.ts`, plan §2.2 addendum
(Data #1.6) — *measured* except where labeled a port requirement.

- Page size 24. Page 1 lives at the clean route (`/variety`); page N > 1
  at `?page=N`. Every page is **self-canonical** (page 2 canonicalizes to
  itself, not to page 1) and indexable when unfiltered.
- Pages are linked with **real `<a href>` pagination anchors** (prev,
  next, numbered) in SSR. Client-side paging / load-more / in-place
  filtering are progressive enhancements layered on these URLs, never
  replacements for them.
- **`?page=1` → one-hop permanent redirect to the clean route.** ⚠️
  **Port requirement — this does not exist today.** Today `?page=1`
  renders page 1 with a clean canonical (a duplicate reachable URL with
  a correct canonical — tolerated, not ideal). The plan (Data #1.6)
  requires the redirect; the port builds it at the edge/router for
  `/variety`, `/seller`, `/seller/[slug]`, `/crop/[slug]`,
  `/state/[slug]`. Quinn tests it explicitly (§4.2).
- **Out-of-range page → true 404.** Non-integer, zero, negative, or
  past-the-end `?page=` values all 404 (`parsePage` + `assertPageInRange`,
  *measured*; the November pagination fix verified this live). No empty
  200 page, no clamp-to-last-page redirect.
- Filtered + paginated: the filtered rule (§1.3) wins — canonical to the
  clean unfiltered route (page 1), `noindex` — exactly as today's
  `generateMetadata` composes them.

### 4.2 `/variety` — variety browse (35 pages at current counts: ⌈818/24⌉)

**SSR content.** From `variety/page.tsx` (*measured*): title "All flower
seed varieties" + page suffix (filtered form: "{filter labels} — flower
seed varieties"); description (alphabetical, seller counts, last-checked
posture); breadcrumbs + `BreadcrumbList`; `ItemList` of that page's 24
varieties with continuous positions; H1 "Flower seed varieties"; results
count line ("{818} varieties · Page N of 35", `aria-live` region in the
hydrated app, plain text in SSR); filter controls (season, method, life
cycle, hue, small-farm) rendered as real links/forms whose targets are
the parameterized URLs of §1.3; the variety grid — cards linking to
`/variety/{slug}` with name, crop, Latin name on the card, seller-count /
stock summary; pagination anchors.

**Indexability.** Unfiltered pages: indexable, self-canonical. Filtered
views: `noindex, follow`, canonical `/variety` (*measured*). Sitemap:
page 1 (`/variety`) is the hub entry; whether `?page=2…35` stay in the
sitemap is settled in §8.2 (recommendation: out — crawlable via anchors,
not sitemap-listed). After conversion the indexability is identical
under either sitemap decision.

**Quinn check.** Page 1: status 200, H1, `ItemList` with 24 entries,
first variety name matching D1's alphabetical first page, pagination
anchor `href="/variety?page=2"` present. Page 2: status 200,
self-canonical `…/variety?page=2`, positions from 25, no name overlap
with page 1's ItemList. **`?page=1`: must be one permanent redirect to
`/variety`** (the new-behavior check). `?page=99` (past the end at gate
counts): true 404. Filtered fetch (`?color_family=pink`): 200,
`noindex`, canonical `/variety`. Global absences.

**404s & redirects.** Out-of-range/malformed `?page=` → true 404.
Legacy `?v={slug}` → permanent redirect to `/variety/{slug}`
(*measured*). Plural `/varieties` → permanent redirect to `/variety`
(§8).

### 4.3 `/seller` — seller index (4 pages at current counts: ⌈83/24⌉)

**SSR content.** From `seller/page.tsx` (*measured*): title "Flower seed
sellers" + page suffix (state-filtered form: "Seed sellers in {State}");
description (US farms and seed companies of every size…); breadcrumbs +
`BreadcrumbList`; `ItemList` of that page's sellers, positions
continuous; H1 "Flower seed sellers"; farms artwork (real `<img>` +
alt); state filter (links/select targeting `?state={code}` views);
Small Farm legend; seller cards linking to `/seller/{slug}` (name,
location with state icon, type tags/badge, variety count); pagination
anchors.

**Indexability.** Unfiltered: indexable, self-canonical per page.
**State-filtered view (`?state=OR`): `noindex, follow`, canonical
`/seller`** (*measured*) — `/state/{slug}` is the indexable page for
that state, and the port must not let the filtered index view compete
with it. After: identical.

**Quinn check.** Page 1: status 200, H1, `ItemList` 24 entries,
`href="/seller/` anchors, `href="/seller?page=2"` anchor. `?page=1` →
permanent redirect to `/seller`. `?page=99` → true 404. `?state=OR`
(use a state with sellers at gate time): 200, `noindex`, canonical
`/seller`. Global absences.

**404s & redirects.** As §4.1. Legacy `?s={slug}` → permanent redirect
to `/seller/{slug}`. Plural `/sellers` → `/seller` (§8).

### 4.4 `/crop` — crop index (1 page, all 124 crops; prerendered class with §0.4's regeneration condition)

**SSR content.** From `crop/page.tsx` and `page.tsx` home usage
(*measured*): title "Flower seed crops"; description; breadcrumbs +
`BreadcrumbList`; `ItemList` ("Flower seed crops", all 124, linking to
`/crop/{slug}`); H1 "Crops"; count line ("124 crops in the directory,
alphabetical"); filter controls (season, method — parameterized,
§1.3 handling: the crop index's filtered views follow the same
canonical-to-clean pattern in the hydrated app; the clean route is the
canonical); the full crop grid: card per crop with crop artwork
(`CropCardImage`, real `<img>` + alt = crop name), H2/link to
`/crop/{slug}`, variety counts.

**Indexability.** Indexable, in the sitemap (hub file, §8.2),
self-canonical. After: identical.

**Quinn check.** Raw HTML: status 200, H1 "Crops", `ItemList` present
with 124 entries at current counts (assert ≥ 100 and equal to D1's crop
count at gate time — never hard-code 124 into the test), 124
`href="/crop/` anchors (one per crop). Global absences.

**404s & redirects.** The index itself has no slug to 404. Plural legacy
`/plants`, `/categories` → permanent redirects to `/crop` (§8).

### 4.5 `/` — home (prerendered class with §0.4's regeneration condition)

**SSR content.** From `app/page.tsx` (*measured*):

- Title (absolute, no template suffix): "seeds.hues.flowers — Find Where
  to Buy Any Flower Seed"; description = the site description (search a
  hard-to-find variety, see US sellers, stock as last seen, checked date,
  direct link). Canonical `https://seeds.hues.flowers/`. OG: site card.
  (2026-11-22 audit m-8 noted the domain-first title; it is the shipped
  form and the port carries it — retitling is Wren's lane with this
  seat's spec, not a port decision.)
- JSON-LD: `WebSite` + `SearchAction` and site `Organization` (§1.1,
  §11 for the port additions). No `BreadcrumbList` (no trail).
- Hero: artwork (real `<img>`, priority/LCP, alt), eyebrow ("Hard-to-find
  flower seed · stock as last seen · direct links"), H1 "Find where to
  buy any flower seed", the explanatory paragraph (search by any name it
  goes by; stock state as last seen; checked date; direct link),
  **search box** (form targeting `/search?q=…` — functional without
  JavaScript as a GET form; the hydrated autocomplete enhances it).
- **Coverage line** (`data-testid="coverage-line"`): "{818} varieties
  cataloged across {124} crops · {556} with a seller · {83} sellers ·
  {1,492} listings" + last-updated date — live data, §9.
- Browse-by-crop section (H2 + grid of crop cards linking to
  `/crop/{slug}`, artwork + counts) and the "Browse by crop" /
  `/crop` link; recent-activity section (H2; up to 6 recent listing
  events — Newly listed / Restocked / Sold out / Gone — each naming the
  variety (link) and seller (link) with its date) — live data, §9;
  "How it works / about the data" section (H2) with the directory's
  honesty facts and a link to `/about/data`; the "We don't sell seed"
  posture stated in copy exactly as today (public copy says the
  directory sells nothing; no hint of any future Hues seed sales —
  standing rule).
- Site header/footer navigation as real anchors (Varieties, Sellers,
  Crops, About, Add Your Farm, Account, Report) — the header/footer are
  part of every template's SSR, and their links are the crawl skeleton;
  a header that hydrates its links in fails every template at once.

**Indexability.** Indexable, sitemap hub entry, self-canonical. Filter
parameters on `/` (`?season=`, `?method=` — the home crop grid accepts
them today): the port keeps them non-canonical — canonical stays `/`,
and no parameterized home URL enters a sitemap. (Today's home metadata
is static and does not emit `noindex` for these; the canonical alone
carries the signal. The port must not regress this into self-canonical
parameterized homes; adding `noindex` to parameterized homes is
acceptable but not required — flag the choice in the build notes so the
gate tests the built behavior, not an assumed one.)

**Quinn check.** Raw HTML: status 200, absolute title exact, H1 exact,
coverage line present with counts equal to D1 at fetch time, `WebSite`
JSON-LD with `SearchAction` present, `Organization` present, ≥ 20
`href="/crop/` anchors, search form with `action`/`method` that works
without JS (or an anchor fallback to `/search`). Global absences —
including no price pattern anywhere in the recent-activity strip.

**404s & redirects.** None template-specific; host-level redirects in
§8 (singular host, http→https, www) apply here as everywhere.

### 4.6 `/search` — search results (utility, SSR)

**SSR content.** From `search/page.tsx` (*measured*): title "Search
flower seeds" or "Search: {q}"; description; **canonical `/search`
regardless of `?q=`**; H1/intro with search guidance ("Try a crop…, a
variety…, or a Latin name…; names a variety is also sold under match
too"); the search box with the query filled; results rendered
server-side for the given `?q=`: grouped sections (Crops, Series,
Varieties, Sellers) with real links to the matching detail pages, or
the zero-results state (artwork + "Nothing matches…" + link to
`/report?type=correct`); browse shortcut chips (`/crop`, `/variety`,
`/seller`) on the empty-query form. Filter parameters on results follow
§1.3 (they do not change the canonical).

**Indexability.** **`noindex, follow` on every search URL, today and
after** (*measured*). Never in any sitemap. The `SearchAction` target in
the home `WebSite` JSON-LD points here — that is correct and stays:
the action target being `noindex` is normal.

**Quinn check.** Fetch `/search?q=sweet+pea` (a query with known results
at gate time): status 200, `noindex` present, canonical exactly
`https://seeds.hues.flowers/search`, raw HTML contains at least one
result anchor (`href="/variety/` or `/crop/` or `/seller/`) — proving
results are server-rendered, not client-fetched. Fetch `/search` bare:
200, search form present, `noindex` present. Global absences.

**404s & redirects.** None: an empty result set is a 200 with the
zero-results state, never a 404. Over-long `?q=` is truncated (100
chars, *measured*), not an error.

---

## 5. Static and informational templates (prerendered)

All five content pages below are indexable today and after, in the
sitemap's hub/static file (§8.2), self-canonical, with unique title +
description from `pageMetadata` (*measured* per template). Their SSR
contract is deliberately plain: **the full prose of the page in HTML** —
these pages are pure content; a client-rendered prose page is a shell
by definition. Each carries the site header/footer anchors (§4.5) and,
where it has one today, its theme artwork as a real `<img>` + alt.

| Template | Title (today) | SSR content that must be present (beyond full prose) | Quinn check (in addition to global) |
|---|---|---|---|
| `/about` | "About the directory" | H1 + full about prose: what the directory is, who operates it (Hues Floral Park), the "We don't sell seed" statement, links to `/about/data`, `/about/bot`, `/add-your-farm` | 200; H1 text present; ≥ 1 anchor to `/about/data`; no `noindex` |
| `/about/data` | "About the data" | Full data-policy prose: sources, stock-state meanings, last-checked practice, packet sizes shown / prices never shown, correction + removal routes (link to `/report`), crawler link to `/about/bot` | 200; the words "price" appear only inside the never-shown policy statement (the §1.2 price grep is pattern-based — `$`-amounts and price fields — not a ban on the word in policy prose; Quinn verifies by reading the hit, not by failing on the word) |
| `/about/bot` | "Our crawler (HuesSeedFinderBot)" | Bot identity string `HuesSeedFinderBot/1.0 (+https://seeds.hues.flowers/about/bot)`, robots.txt compliance, rate limits, opt-out instructions | 200; bot UA string present verbatim in raw HTML |
| `/api-docs` | "Public API (v1)" | Full API documentation prose + endpoint inventory as rendered today; link to `/api/v1/openapi.json` | 200; `openapi.json` anchor present; no `noindex` (the docs page is indexable; the API responses themselves carry `X-Robots-Tag: noindex`, §7.3) |
| `/privacy` | "Privacy" | Full privacy prose, verbatim substance | 200; H1 present |
| `/terms` | "Terms of use" | Full terms prose, verbatim substance | 200; H1 present |

**404s & redirects (all of §5):** none template-specific. These are
exact-path routes; any other `/about/*` path → true 404.

### 5.1 `/add-your-farm` — seller submission (SSR, indexable)

**SSR content** (*measured*): title "Add Your Farm"; description (free,
reviewed by hand, never pay-for-placement); H1 "Add Your Farm"; intro
prose (US farms and seed companies of any size welcome; free; reviewed
by a person); farm-gate artwork (real `<img>` + alt); the submission
form rendered in HTML (fields present without JS; Turnstile widget
mount point + site key — Turnstile stays on form surfaces with
server-side Siteverify + rate limits per the plan); the state select
options (all US states) in HTML; `?state={code}` prefill reflected in
SSR when present.

**Indexability.** Indexable today (no `noindex` in its metadata,
*measured*) and after; in the hub/static sitemap file. It is a real
landing page for seller-discovery queries ("list your seed company"),
not a utility form — do not noindex it in the port.

**Quinn check.** 200; H1 present; form field names present in raw HTML;
no `noindex`. Global absences.

**404s & redirects.** None. An invalid `?state=` is ignored (falls back
to no prefill, *measured*), not a 404.

### 5.2 `/report` — correct / claim / remove (SSR, noindex)

**SSR content** (*measured*): title "Report a problem, claim or remove
a seller"; H1 "Correct, claim or remove"; intro prose (one form;
removals honored within 48 hours; link to `/about/data`); the form in
HTML with `?type=` / `?seller=` / `?variety=` prefill reflected
(type coerced to `correct` unless `claim`/`remove`; slugs validated by
the legacy-slug pattern — invalid values ignored, not errors);
Turnstile mount point.

**Indexability.** **`noindex, follow` today and after** (*measured*).
Never in a sitemap. Robots: crawlable (it must stay crawlable for the
`noindex` to be seen — do not add it to robots disallows).

**Quinn check.** 200; `noindex` present; H1 present; form present.
Global absences.

**404s & redirects.** None — bad parameters degrade to the default form.

---

## 6. Account and utility templates (SSR shell is correct here — content is per-user or per-token)

These routes are **not indexable content** (validation §1.6). For them
the prerender contract inverts: SSR must render the page's *frame* (H1,
explanatory prose, form) completely, must carry the correct `noindex`,
and must never render another user's data or a token's target into
crawlable HTML. They stay out of every sitemap.

### 6.1 `/account`

**SSR content:** title "Your account"; H1; signed-out frame in full
(sign-in + create-account forms in HTML, Turnstile mount, account
organizer artwork + alt) — the signed-in panel is per-user and renders
only with a session; a crawler (no session) always gets the signed-out
frame. **Indexability:** `noindex, follow` (*measured*) **and**
disallowed in `robots.txt` (`/account`) today and after — the belt and
the suspenders both stay. **Quinn check:** fetch without cookies: 200,
`noindex` present, sign-in form present, no user data strings; fetch
`robots.txt` and confirm `/account` in disallows. **404s/redirects:**
none; session states are 200s.

### 6.2 `/unsubscribe`

**SSR content:** title "Unsubscribe"; H1 "Unsubscribe"; without a valid
token, the invalid-link prose + link to `/account`; with a valid token,
the scope description (per-variety or all) + the one-click confirm
button — a GET never changes anything (mail-scanner safety, *measured*
design). **Indexability:** `noindex, nofollow` (*measured*) + robots
disallow (`/unsubscribe`) today and after. **Quinn check:** bare fetch:
200, `noindex` present, invalid-link prose present. **404s:** none —
an invalid token is a 200 with the invalid-link state, by design.

### 6.3 `/offline`

**SSR content (prerendered, precached by the service worker):** title
"You're offline"; H1 "You're offline"; the offline prose; artwork;
anchors to `/`, `/variety`, `/seller`. **Indexability:** `noindex,
follow` with a self-canonical (*measured*) today and after; never in a
sitemap. **Quinn check:** 200, `noindex` present, H1 present. The
service-worker fallback wiring (navigations that fail → `/offline`) is
verified in the browser pass, not the raw-HTML pass.

### 6.4 The 404 page itself (`not-found`)

**SSR content** (*measured*): "404" eyebrow; H1 "We couldn't find that
page"; the may-be-old/removed prose; search box; anchors to `/variety`,
`/seller`, `/`; offline-path artwork. **Status contract:** this body is
served with a **real HTTP 404** for every unknown path — the single most
important SPA-fallback behavior in the port (global contract §1.7).
**Quinn check:** fetch three unknown paths (`/variety/definitely-not-a-variety`,
`/no-such-page`, `/crop/not-a-crop`): each returns status **404** (not
200, not a redirect) with the H1 above in the body. A 200 here fails the
gate for the whole property regardless of any other result.

### 6.5 `/admin…` (`/admin/login`, `/admin/waitlist`, actions)

Not pages for crawlers: login is a route handler; the waitlist admin is
session-gated. **Indexability:** disallowed in `robots.txt` (`/admin`)
+ the public `/api/` admin paths disallowed (§7.3); never in a sitemap;
unauthenticated requests redirect to login or 404 per the current
behavior — the port preserves whatever the current build does and adds
`X-Robots-Tag: noindex` where a response is HTML. **Quinn check:**
`robots.txt` contains the `/admin` disallow; an unauthenticated fetch
of `/admin/waitlist` does not return admin data with a 200. No content
contract beyond that — admin is verified as a user surface by Quinn's
usability pass, not by this audit.


---

## 7. Non-page routes (handlers — no HTML contract, strict indexability contract)

### 7.1 `/go/[id]` — outbound click redirect

**Behavior (carry exactly, *measured*):** numeric listing ID only
(non-numeric → 404). Logs the click; **302** to the seller's product
page (or homepage) preserving any existing query string, with
`Referrer-Policy: origin`. Unknown/unpublished listing → **404**.
Removed seller → **410**. Always `Cache-Control: no-store` +
`X-Robots-Tag: noindex, nofollow`; disallowed in `robots.txt` (`/go/`).
This 302 is deliberate (a click redirect, not a moved page) — it is the
one non-permanent redirect in the system and the port must not
"correct" it to 301. **Known stale fact to fix in the port (audit
m-3):** the outbound UTM still reads `utm_source=seedfinder`, the
product's retired name. The port ships `utm_source` with the current
product name (Seed Directory) — a one-string fix, called out here so it
is in the port's diff, not rediscovered in sellers' analytics.
**Quinn check:** known ID → 302 + `no-store` + `X-Robots-Tag`; unknown
ID → 404; `robots.txt` disallow present.

### 7.2 `/og/[kind]/[slug]` — generated share cards

**Behavior:** 1200×630 PNG via image generation (kinds: `variety`,
`seller`, `crop`, `site`; `site/default` is the fallback card).
Malformed slug → no card (404 path in the handler). These URLs are
referenced from `og:image` meta only; they are not linked, not in any
sitemap, and need no indexability signal beyond their image content
type. **Port requirements:** the generator must work in the new Worker
(fonts bundled — the current build bundles its TTFs for exactly this
reason; a port that renders cards with a fallback font has changed the
share surface silently); crop/series/state templates get generated
cards per §3.4's m-2 item. **Quinn check:** GET one card per kind:
200, `image/png`, 1200×630 (read the PNG header); the variety/seller
samples' card text matches the sample's real name.

### 7.3 `/api/*` — public API + internal paths

Public `/api/v1/*` stays **crawlable in `robots.txt` with
`X-Robots-Tag: noindex` on every response** (*measured*: `next.config.ts`
header rule + route helpers) — the port reproduces both halves (allow
the crawl, noindex the responses). Disallowed in robots, exactly as
today: `/api/v1/ingest/`, `/api/v1/admin/`, `/api/internal/`,
`/api/v1/internal/`, `/api/v1/account`. API responses carry no prices
in any public field (the price rule applies to data, not just pages —
a public API field carrying a price would leak it to every consumer
including answer engines; the catalog's price history table is internal
and must stay unreachable from public routes). ETag/304 + cache headers
on idempotent public GETs carry per the plan (Data #2.2).
**Quinn check:** one public GET carries `X-Robots-Tag: noindex`; one
disallowed path is refused/404 without data; response JSON grep finds
no `price` key in a public variety/seller payload (internal fields
named otherwise are Priya's data call — the check is for the prohibited
key in public output).

### 7.4 `/llms.txt`, `sitemap.xml`, `robots.txt` — the machine files

- **`/llms.txt`** (SSR route, DB-generated at request time, *measured*):
  carries the site summary, live counts, seller policy, data model, key
  pages, the full crop list with counts, the seller list with locations,
  API links, and the trademark disclaimer. Port: regenerate from the
  same data on the same route; counts must be live at serve time (it is
  cached `max-age=3600` + SWR today — acceptable for a hygiene file).
  Filed as **hygiene, not visibility work** (graded record: AI engines
  request it at negligible rates; the largest citation study found no
  effect). Quinn check: 200, `text/markdown`, counts match D1, no price
  strings, "No prices are shown" posture intact.
- **`robots.txt`:** §8.3 gives the exact carried content + the plan's
  additions. Quinn diffs it (any difference not in §8.3 is a stop).
- **`sitemap.xml`:** becomes the sitemap **index** under segmentation
  (§8.2); the URL `/sitemap.xml` itself must keep resolving (it is the
  URL declared in `robots.txt` and the one already submitted/known).

---

## 8. Sitemap parity and the consolidated redirect map (task items 4–5)

### 8.1 Recount of the current sitemap from its code

Source: `v2/app/sitemap.ts` (*measured*). The generator emits, in order:
`/`; `/crop`; paged `/variety` (⌈varieties/24⌉ URLs: clean + `?page=2…`);
paged `/seller` (⌈sellers/24⌉); `/about`, `/about/data`, `/about/bot`,
`/api-docs`, `/terms`, `/privacy`; every `/crop/{slug}`; every
`/series/{slug}` with `lastModified`; every `/variety/{slug}` with
`lastModified`; every `/seller/{slug}` with `lastModified`; every
`/state/{slug}` for visible-seller states. No `priority`, no
`changefreq` anywhere (house rule, already honored).

At the 2026-11-22 counts this produced **1,128 URLs** (this seat's audit
parsed the live file: 812 variety + 124 crop + 83 seller + 32 series +
31 state detail URLs, hubs, and **36 pagination URLs** — *measured*).
At today's counts (818 / 83 / 124 / 33 / 31; variety pages ⌈818/24⌉ = 35,
seller pages ⌈83/24⌉ = 4) the **same code produces 1,136 URLs**:

`1 (/) + 1 (/crop) + 35 (variety paged) + 4 (seller paged) + 6 (static)
+ 124 (crops) + 33 (series) + 818 (varieties) + 83 (sellers) + 31 (states)
= 1,136` (*inferred* by arithmetic from the generator + today's D1
counts; the live file was not re-fetched for this audit — Quinn's day-0
crawl recounts it against the staged build).

`lastmod` coverage today: detail URLs for varieties, sellers, and series
carry it (927 of 1,128 in November); hubs, pagination, crops, states,
and static pages carry none, because the generator has no trustworthy
date for them. That asymmetry is correct behavior, not a bug: an absent
`lastmod` is honest; a build-time-stamped one is a lie Google learns to
ignore.

### 8.2 The segmented sitemap the port ships (plan §2.2 + audit Technique 1)

The plan adopts the segmented by-type sitemap the current code's own
comment anticipates ("switch to chunks before 50,000 URLs") — adopted
now, at ~1,100 URLs, because the reason is not the file-size limit; it
is **cohort readability**: Search Console reports indexation per sitemap
file, and this directory's governing question (are the 262 zero-seller
pages being indexed at the same rate as listed pages?) is only
answerable if the cohorts live in different files. **STRONG** mechanics
(Google sitemap documentation); the cohort-reading practice
MODERATE-STRONG.

| File (under the `/sitemap.xml` index) | Contents | `lastmod` |
|---|---|---|
| `sitemap-varieties-listed.xml` | The 556 `/variety/{slug}` with ≥ 1 published listing | Real `updated_at` per record |
| `sitemap-varieties-zero-seller.xml` | The 262 `/variety/{slug}` with no published listing — **its own file by design** (decision-27 measurement commitment) | Real `updated_at` per record |
| `sitemap-sellers.xml` | 83 `/seller/{slug}` | Real `updated_at` |
| `sitemap-crops.xml` | 124 `/crop/{slug}` | Omit unless a trustworthy per-crop date exists in D1 (today: none in the generator — omit, do not stamp) |
| `sitemap-series.xml` | 33 `/series/{slug}` | Real `updated_at` |
| `sitemap-states.xml` | 31 `/state/{slug}` (visible-seller states only) | Omit (no per-state date exists) |
| `sitemap-hubs.xml` | `/`, `/crop`, `/variety`, `/seller`, `/about`, `/about/data`, `/about/bot`, `/api-docs`, `/terms`, `/privacy`, `/add-your-farm` | Omit (hubs change with every data write; any date would be a build stamp in disguise) |

Rules, all binding:

1. **Only canonical, indexable URLs.** No filtered URL, no `noindex`
   URL (`/search`, `/report`, `/account`, `/unsubscribe`, `/offline`,
   small-farms variants), no `/go/`, no `/og/`, no `/api/`, no admin.
2. **Pagination URLs come out of the sitemaps.** The November file's 36
   `?page=N` URLs (39 at today's counts) are removed: paginated pages
   stay crawlable and indexable via their anchors (§4.1) — sitemap
   inclusion is a discovery hint the hubs' own links already provide,
   and removing them keeps every sitemap file a clean cohort (audit
   finding m-1). Expected segmented total: **1,097 URLs**
   (1,136 − 39 pagination). If the build instead keeps pagination in a
   `sitemap-hubs.xml`, that is a deviation from this audit to be ruled
   on explicitly — not a silent choice — because it re-mixes the
   cohorts this segmentation exists to separate.
3. **`lastmod` = the record's real `updated_at` from D1, or omitted.**
   Build-time stamping is prohibited (plan §2.2). Sitemap files
   themselves are generated at request time (SSR route, cached) and
   invalidated on the same data-change path as the pages (§9) — a
   sitemap that lags a data write advertises stale `lastmod`s.
4. **No `priority`, no `changefreq`** — carried rule.
5. The index + files are submitted/resubmitted at cutover (§10), and
   `robots.txt` keeps declaring `https://seeds.hues.flowers/sitemap.xml`.

### 8.3 `robots.txt` — carried verbatim + plan additions

Carried (*measured*, `v2/app/robots.ts`): one `*` group, `Allow: /`,
disallowing `/go/`, `/admin`, `/api/v1/ingest/`, `/api/v1/admin/`,
`/api/internal/`, `/api/v1/internal/`, `/api/v1/account`, `/account`,
`/unsubscribe`; `Sitemap:` and `Host:` declared. **Posture preserved:
open to search and AI crawlers** (Dustin's 5.1 ruling) — no per-agent
blocks are added in the port, for Googlebot, Bingbot, OAI-SearchBot,
GPTBot, PerplexityBot, Claude crawlers, or anyone else; the zone-level
training-crawler Content-Signal (a Cloudflare setting outside the app)
is confirmed untouched at cutover, as in validation §1.3.

Plan additions (Data #1.5): disallow sort / page-size / session
parameter patterns so parameterized utility URLs stay out of the crawl
budget. The exact patterns are a build-time line item; the constraint
from this seat is that they must not match any URL in §8.2's sitemaps
or any canonical in §3–§5 (a disallow that swallows `?page=` wholesale
would also block the paginated canonicals' crawling — parameter
disallows must name the sort/size/session keys specifically).

**Quinn check (robots):** byte-diff the new `robots.txt` against the
old file + the §8.3 additions list. Any other difference is a stop
(validation §5.3).

### 8.4 Consolidated redirect map — one hop, permanent, at the edge

All redirects below are **unconditional** (no user-agent condition —
seeds has no /m split to retire, and none is introduced) and land on
their final canonical in **exactly one hop**. ⚠️ **Code question the
build must settle on day one:** the current build's permanent redirects
are **308** (Next.js `permanent: true` / `permanentRedirect`), while the
validation and the plan say **301**. Google treats 308 as a permanent
redirect equivalent to 301 for indexing purposes (**STRONG**, Google
redirect documentation), so either code is safe — but the port must
**pick one and apply it uniformly at the edge**, and Quinn's day-0 crawl
asserts the picked code. This audit's recommendation: **301**, to match
the program-wide spec language and the hues.flowers map; if the build
keeps 308 for router-native redirects, the gate packet must state so
explicitly so nobody "fixes" half of them later. Mixed 301/308 across
rows of this table is the only failing outcome.

| From | To | Source / status |
|---|---|---|
| `http://seeds.hues.flowers/*`, `https://www.seeds.hues.flowers/*` (if resolving today) | `https://seeds.hues.flowers/*` (same path) | Host canonicalization at the edge; verify live at day 0, preserve whatever resolves today |
| `seed.hues.flowers/*` (singular) | `https://seeds.hues.flowers/*` (same path) | *Measured* live 2026-11-22 (301); must survive the port — it is an edge/zone rule, easy to lose in a Worker redeploy |
| `/variety/{merged-slug}` | `/variety/{surviving-slug}` (+ `?small_farm=true` preserved) | D1 merged lookup (§3.1); data-driven, grows with dedupe work |
| `/varieties`, `/varieties/{slug}` | `/variety`, `/variety/{slug}` | *Measured* (`next.config.ts`) |
| `/sellers`, `/sellers/{slug}` | `/seller`, `/seller/{slug}` | *Measured* |
| `/plants`, `/plants/{slug}`; `/categories`, `/categories/{slug}` | `/crop`, `/crop/{slug}` | *Measured* |
| `/variety?v={slug}`; `/seller?s={slug}` | `/variety/{slug}`; `/seller/{slug}` | *Measured* (v1 query URLs) |
| `/variety/{slug}/small-farms` (direct outside request) | `/variety/{slug}?small_farm=true` | *Measured* (middleware); internal path never serves a 200 |
| `?page=1` on `/variety`, `/seller`, `/seller/{slug}`, `/crop/{slug}`, `/state/{slug}` | The clean route (same path, no query) | **Port requirement** (§4.1) — does not exist today |
| Trailing slash on any canonical (`/variety/{slug}/`, `/crop/`, …) | The slash-free canonical | *Measured* live 2026-11-22 (308 then); port preserves: exactly one trailing-slash form resolves, the other redirects in one hop. Root `/` excepted. Case variants (`/Variety/…`) → the lowercase canonical or a true 404 — today wrong-case paths 404 (*measured*); either behavior is acceptable, a 200 duplicate is not. The port picks one and Quinn tests it. |

**Explicitly not redirects:** unknown slugs → 404 (never redirected to
a hub — that would be a soft-404 pattern); removed sellers → 410;
`/go/{id}` → 302 (§7.1). No redirect in this table may target another
redirect (no chains through legacy paths).

**Quinn check (redirects, day 0):** crawl every row of this table
against the preview deploy: assert status (the picked permanent code,
or 302/410/404 where specified), assert `Location` equals the final
canonical exactly, assert following it yields 200 (or the specified
terminal status) with no second redirect.

---

## 9. Live-data regions — what must never be a build-time snapshot (task item 6)

Freshness is this directory's product claim ("stock as last seen, the
date we checked"). Every region below is a **request-time fact**: it is
rendered by the on-demand SSR path, or — where its template sits in the
prerendered class — regenerated on data-change invalidation. None of
them may be baked at build time, and none may be client-only (invisible
to crawlers = invisible to answer engines).

| Region | Where it appears | Fact it carries | Staleness failure looks like |
|---|---|---|---|
| Stock state (availability word + dot) per listing | Variety listing cards; seller shop cards | `in_stock` / `sold_out` / `preorder` / `shop_closed` / `unknown` from D1 | A sold-out variety quoted as in stock by a snippet or an AI answer |
| Last-checked date per listing ("Checked {date}" / "Not yet checked") | Same cards | `listings.last_checked_at` | The page claims a fresher check than happened — a fabricated fact |
| Answer sentence + seller counts | Variety H1 block; titles/descriptions; crop/series counts; home coverage line | Counts derived from published listings at render time | Title says "2 Sellers", body lists 1 (or the reverse) |
| Home coverage line + recent-activity strip | `/` | Catalog counts + latest listing events | Day-two home page advertising yesterday's catalog |
| Seller variety counts, state seller counts, crop variety/with-seller counts | Cards, hubs, titles, `llms.txt`, sitemaps' membership | Same derived counts | Hub counts disagreeing with the pages they link to |
| Stock-check results (CSN — "Check stock now") | Listing cards, when that feature ships | The reuse-until-crawl stock verdict + its timestamp | See the CSN note below |
| Waitlist availability state | Zero-seller variety pages | Whether the waitlist is open for that variety | Minor, but per-user-adjacent — render server-side, cache per variety |

**CSN note (status, stated plainly):** the "Check stock now" build is
**frozen under Dustin's 2026-11-23 stop order** (all non-conversion
Seeds work halted; the CSN build's gated design and brief are preserved,
production was never touched). Its final form was already unsettled
beyond the cache ruling (24-hour cache, retry model, in-place
re-ordering, Turnstile off in v1 behind a flag; Dustin later questioned
whether the link is needed at all in reuse-until-crawl mode). Therefore:
**the conversion neither builds CSN nor designs its templates around
it.** What this audit fixes for whenever CSN resumes is only the
freshness contract: a stock-check verdict is a request-time fact with
its own timestamp; it must render server-side beside the listing it
describes (never as a build-time snapshot, never client-only), and a
completed check must invalidate that variety's and seller's cached
pages like any other data change. No CSN placeholder, button, or
"coming soon" region ships in the converted templates.

**Edge-cache contract (plan §2.2, made testable):**

- SSR HTML: `Cache-Control: public, s-maxage=3600,
  stale-while-revalidate=86400`, cache key = canonical URL (the
  small-farms variant keys separately, as today — §3.2).
- **Invalidation on data change is the contract's load-bearing half.**
  Every write path — ingest API, admin edits, crawl/scout publishes,
  dedupe merges, seller removals, stock updates — must purge or
  revalidate: the affected variety page **and its small-farms variant**,
  its seller page(s), its crop page, its series page, its state page,
  `/`, `/variety`, `/seller`, `/crop`, and the affected sitemap files.
  The current build's tag/path map (`lib/api/revalidate.ts`:
  `pathsForTag` + `withVariantPaths`, *measured*) is the specification
  of "affected" — the port implements the same fan-out against the new
  cache (the plan leaves the mechanism — `POST /internal/revalidate`
  with a shared secret, or cache-key versioning — to the build, fixed
  after reading the ingest code; the fan-out itself is not optional).
- The November live cache (`s-maxage` ≈ 22.7 h, SWR 30 days, audit m-4)
  is **not** carried: the plan's 1 h / 24 h values replace it. A
  sold-out change may still ride inside the 1 h window + SWR — that is
  the accepted trade, stated honestly: the "last checked" date on the
  card is what keeps the page truthful inside the window, which is why
  the date must always render (§3.1) and must always be the real one.
- **Quinn freshness check (gate + day 0):** on the preview deploy, pick
  one sampled listing, change its stock state through the admin/ingest
  path (test data only), and re-fetch the variety and seller pages
  without cache-busting parameters: the new state and date must be
  present. If the change only appears after the s-maxage window, the
  invalidation path is broken and the gate fails — this check is the
  difference between an edge cache and an aging snapshot.

---

## 10. Pre-cutover Search Console baseline — carried dependency (task item 7)

**Status (*measured* from the program record):** the Google Search
Console **Domain property for hues.flowers exists** — Dustin created
and verified it 2026-11-22; a Domain property covers `hues.flowers` and
every subdomain, including `seeds.hues.flowers`, so no separate seeds
property is needed. **This seat's read access is still unarranged**
(Dustin's in-console grant is the remaining step). Recorded here as a
**carried dependency**: it does not block this audit, the build, or
Quinn's gate (which runs on raw-HTML and crawl evidence); it blocks
only the baseline below, and therefore the day-28 comparison for
whichever cutover happens first. The old stack stays deployable until
each property's day-28 sign-off (validation §5.3), so a baseline
captured late-but-before-cutover still protects the conversion; a
baseline never captured leaves a post-cutover drop undetectable in the
property's own records (validation risk 10).

**§5.2 baseline checklist — capture for seeds the day access lands**
(all figures *measured* from Console, windows printed beside them):

- [ ] Performance, 28-day and 90-day windows: clicks, impressions, CTR,
      average position — total, per page for the §8.2 hub set, and
      per-family rollups (variety-listed / variety-zero-seller / seller /
      crop / series / state); top 50 queries.
- [ ] Generative AI performance report (AI Overviews / AI Mode), if
      present in the property: capture it; if absent, record the absence
      (frontier item, validation §7).
- [ ] Page Indexing snapshot: indexed count + every non-indexed reason
      with counts — "Crawled — currently not indexed" and "Discovered —
      currently not indexed" **read separately for the listed and
      zero-seller cohorts** (possible only after the segmented sitemaps
      of §8.2 are submitted — submit them on the *current* stack as soon
      as they exist if they land before the port; the segmentation is
      stack-independent). Until Console access lands, this seat's
      2026-11-22 audit snapshot (1,128 URLs; cohort counts) stands as
      the secondary baseline.
- [ ] Core Web Vitals field data (Console report, mobile) for seeds.
- [ ] AI answer panel: the standing fixed panel of visitor-true
      questions (variety where-to-buy ×5, crop seeds-for-sale ×3,
      seller-discovery ×3, entity ×2 — the set from audit Technique 8)
      run on ChatGPT, Perplexity, and Google AI, recording mention,
      citation, and factual accuracy; panel, engines, and date printed
      on the reading.
- [ ] Confirm both current sitemaps (`hues.flowers` and seeds) are
      submitted in the property; submit the seeds segmented set when it
      exists (§8.2).

**Cutover checks for seeds (validation §5.3, specialized):** day 0
pre-switch — full crawl of the §8.2 sitemap list against the preview
deploy (every canonical 200; every §8.4 row one hop; unknown paths true
404; robots diff clean; per-template raw-HTML checks in §3–§7 pass).
Day 0 post-switch — resubmit sitemap index in Console; URL Inspection
spot-checks: one variety with sellers, one zero-seller variety, one
seller, one crop hub (confirm Google renders the SSR content). Days
1–7: daily Page Indexing + crawl-stats watch; day-7 performance is an
alarm check only (Google's guidance: judge changes in weeks). Day 28:
full comparison against the baseline above. **Rollback trigger (agreed
in advance):** indexed-page drop > 10% unexplained by this map, or any
§8.2 canonical falling out of the index → same-day investigation.

---

## 11. Land-in-the-port items (from the 2026-11-22 audit) + the GeoSeed rule

These ship **inside** the conversion because the port is rebuilding the
exact surfaces they touch (validation §3 rule 7: do not re-ship open
audit findings in the new build). None expands the conversion's scope
beyond its templates.

1. **Segmented sitemap** — §8.2. (Audit Technique 1 / finding M-2.)
2. **Organization `sameAs` + logo** — the home `Organization` block
   (Hues Floral Park) gains: `logo` (the site's icon/logo URL on our own
   host), and `sameAs` listing the park's real, verified profile URLs
   (hues.flowers itself + any social/profile URLs Hue confirms as real
   at build time — **no URL is invented for this list**; an unverified
   profile is omitted, not guessed). The directory's own entity stays
   distinct: `WebSite.publisher` → the park Organization, as today.
   A Wikidata item for Hues Floral Park remains legitimate hygiene
   *if* supported by real independent references (audit Technique 4) —
   it is **not** a port deliverable; it is listed here so the port's
   `sameAs` can include it if it exists by build time. Grade: mechanism
   MODERATE-STRONG; sold as accuracy hygiene, never as a ranking lever.
   (Audit finding M-4.)
3. **Crop/series/state OG cards at 1200×630** — §3.4. (Audit m-2.)
4. **`utm_source` rename on `/go/`** — §7.1. (Audit m-3.)
5. **Seller meta descriptions composed to complete sentences** — §3.3.
   (Audit m-5.)
6. **Edge-cache lifetimes reconciled to the plan's values** — §9.
   (Audit m-4.)

**The GeoSeed rule (audit Critical C-1):** GeoSeed's seller page
contradicts itself — "Clinton, SC" in its location field (feeding the
meta description and the `Organization` `PostalAddress`) vs. "Greenwood,
South Carolina" in its description prose. **Greenwood is correct.** The
fix is a **data fix, still owed via Dustin's one admin edit** (no API
path exists), plus the approved 83-seller location sweep (visible +
meta + schema, catalog seat). The conversion's obligations are only
these, and they are gate items: (a) templates render location **from
the single D1 location field** into visible text, meta, and schema
alike — the port must not introduce a second location source that could
freeze today's contradiction into the new templates; (b) Quinn's
§3.3 seller check compares visible location, meta description, and
`PostalAddress` against each other and against D1 for the sampled
seller — a three-way mismatch on any seller fails that template; (c)
if Dustin's edit lands before cutover, the corrected value flows
through the SSR + invalidation path with no template change — Quinn
re-fetches `/seller/geoseed` at day 0 and confirms all three surfaces
read Greenwood.

---

## 12. Risks (ordered by consequence; items 1–3 are new or sharpened in this pass)

1. **The `?page=1` redirect is new code wearing a carry-over costume.**
   Every other redirect in §8.4 exists today; this one does not.
   Port briefs that list it among "preserved redirects" will ship
   without it and nobody will notice — a duplicate page-1 URL is a
   small, silent canonical leak across five templates. Mitigation:
   §4.2/§4.3 name it as a build item and Quinn tests it explicitly.
2. **301/308 split-brain.** The current stack says 308, the program
   spec says 301, and a Vike/Worker edge layer may well emit a third
   behavior (a router redirect with 302 defaults is the classic SPA
   starter failure — a "temporary" signal on permanent moves). Any one
   permanent code, uniformly applied, is safe; a mixture invites a
   future cleanup that breaks half the map. §8.4 settles the choice at
   the gate packet, before cutover.
3. **Invalidation fan-out quietly narrowing.** The current revalidation
   map fans a variety change out to its seller/crop/series/state/hub/
   sitemap surfaces *and* its small-farms variant. A port that
   invalidates "the page that changed" only will pass every static
   check and fail in production within one scout publish — pages
   disagreeing with each other about the same listing's stock. §9's
   freshness check (change → re-fetch *other* templates) is designed
   to catch exactly this.
4. **Shell drift** (validation risk 1, restated for seeds): the slug
   templates are the whole catalog; a body-less SSR response on
   `/variety/[slug]` alone blanks 818 pages to AI crawlers. The
   per-template Quinn checks are the mitigation; they must run on the
   **preview deploy**, never a local build (plan gate rule).
5. **SPA fallback soft 404s** (validation risk 2): §6.4's three-URL
   404 check is the mitigation. Special seeds case: `/state/{real state
   with no sellers}` and out-of-range `?page=` are the two 404s a
   helpful router is most tempted to "fix" into 200s or redirects.
6. **Zero-seller cohort erosion by a thousand cuts:** a sitemap
   generator that filters on `listings > 0`, an ItemList that drops
   empty pages, a "helpful" `noindex` on thin pages — each plausible
   in a fresh build, each a violation of decision 27. The segmented
   zero-seller sitemap file (§8.2) makes the cohort's membership
   countable at the gate: the file must contain exactly D1's
   zero-seller count on gate day.
7. **Breakpoint content divergence:** the shop-grid seller page and the
   card grids are the most likely places for a mobile component set to
   drop facts (Latin names, checked dates) the desktop set shows.
   Under mobile-first indexing the dropped facts are dropped from the
   index. Quinn's raw-HTML checks run against the mobile rendering's
   HTML as well as the desktop's where the build serves different
   markup per breakpoint (the unified app should serve one markup —
   if it does, one pass suffices; the gate packet states which).
8. **Price leakage through a new surface:** the likeliest vector is not
   a template but a ported helper — an API payload, an OG card, or a
   JSON-LD builder "completed" with an Offer. §1.2's two checks +
   §7.3's API grep are the mitigation. The prohibited list is owned by
   this seat; a build that needs an exception asks, it does not edit
   the list.
9. **No baseline** (validation risk 10): §10. Entirely within the
   house's control; the only risk on this list that costs five minutes
   to retire.

---

## 13. Frontier list (this pass's open edge — the next pass's brief)

- **F-1. Whether the SPA's client router preserves anchor semantics
  everywhere.** This audit specifies real `<a href>` in SSR; whether
  hydration ever replaces an anchor with a click-handler div in the
  new component library is knowable only from the built design-system
  components. *Status: reopens at the design-system gate; Quinn's
  browser pass (drive the real product, follow links with JS enabled
  and disabled) is the instrument.*
- **F-2. IndexNow for seeds.** Carried from the validation frontier:
  Bing documents the protocol; benefit at this scale is contended.
  *Status: WEAK-CONTENDED; evaluate only if the post-cutover
  crawl-stats baseline shows discovery lag it would plausibly close.*
- **F-3. Generative AI reporting presence in the Domain property.**
  Knowable the day §10's access lands. *Status: blocked on access.*
- **F-4. Zero-seller substance census.** The 262 were sampled, not
  measured as a cohort (description presence/length, facts
  completeness) — audit frontier F-C, still open. The conversion does
  not change the pages' substance; the census remains the evidence
  base for the pre-committed response if the cohort's not-indexed
  share runs materially worse than the listed cohort's. *Status:
  next measurement pass, from the production snapshot.*
- **F-5. Seller-tag landing pages.** The frozen seller-tags design will
  create kind-of-seller hubs ("small farm" and the other tags) after
  the conversion. Their titles/descriptions should be specified
  against seller-discovery phrases at design time (audit Track N).
  *Status: deferred by the stop order; reopens when that design
  resumes — its templates will need an amendment to this audit before
  they ship.*
- **F-6. Wishlist routes.** Julie's commissioned multi-list wishlist
  builds only after the SPA cutover (Dustin's sequencing ruling). Its
  routes (per-user lists: `noindex` + robots handling; any public list
  surface: a new template class) are not specified here because the
  feature is not designed yet. *Status: reopens at wishlist design;
  no wishlist code or route ships in the conversion.*
- **F-7. AI-crawler rendering, settled first-party.** Carried from the
  validation frontier: a canary page (content reachable only via
  JavaScript) on the new stack would settle the MODERATE non-rendering
  claim with the house's own logs. *Status: proposed experiment,
  awaiting the new stack; never on a production template.*

---

## Sources consulted for this audit (2026-11-23)

- This seat's playbook and training research
  (`~/workspace/team/seo/seo-geo-research-2026-11-22.md`) — graded
  claims applied throughout.
- This seat's SPA validation (`seo-validation-bea.md`, 2026-11-22) —
  §1.5 contract, §3 seeds rules, §5 measurement plan.
- Phase-1 architecture plan §2.2 (seeds) + 2026-11-23 addenda
  (`wwwhues/docs/spa-redevelopment/architecture-plan.md`).
- This seat's seeds audit + rulings (`seo-audit-2026-11-22/AUDIT.md`,
  `RULINGS.md`) — decision 27, Techniques 1–10, findings C-1, M-1–M-5,
  m-1–m-8.
- Current build source, read 2026-11-23 (*measured*): `v2/app/sitemap.ts`,
  `v2/app/robots.ts`, `v2/app/layout.tsx`, `v2/lib/seo/jsonld.ts`,
  `v2/lib/seo/metadata.ts`, `v2/lib/paging.ts`, `v2/lib/config.ts`,
  `v2/lib/api/revalidate.ts`, `v2/lib/legacy.ts`, `v2/middleware.ts`,
  `v2/next.config.ts`; templates `app/page.tsx`, `app/variety/page.tsx`,
  `app/variety/[slug]/page.tsx` + `variety-view.tsx` + `small-farms/page.tsx`,
  `app/seller/page.tsx`, `app/seller/[slug]/page.tsx`, `app/crop/page.tsx`,
  `app/crop/[slug]/page.tsx`, `app/series/[slug]/page.tsx`,
  `app/state/[slug]/page.tsx`, `app/search/page.tsx`, `app/about/*`,
  `app/api-docs`, `app/privacy`, `app/terms`, `app/report`,
  `app/add-your-farm`, `app/account`, `app/offline`, `app/unsubscribe`,
  `app/not-found.tsx`, `app/go/[id]/route.ts`, `app/og/[kind]/[slug]/route.tsx`,
  `app/llms.txt/route.ts`; `components/variety/ListingRow.tsx`.
- Production counts for 2026-11-23, supplied with the commission
  (*measured* from production D1).

*End of audit. Filed at
`~/workspace/seeds-hues/spa-conversion-2026-11-23/PRERENDER-CONTENT-AUDIT.md`.
No other file was edited by this pass.*
