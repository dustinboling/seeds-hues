# Structured-data inventory — Seed Directory SPA (Slice 8)

Every template's as-built JSON-LD types, diffed against Bea's measured
inventory (PRERENDER-CONTENT-AUDIT.md §1.1, filed under
spa-conversion-2026-11-23/).
As-built values verified two ways: emitted HTML over the wire
(`tests/build/slice8-hardening.test.ts` — every template's top-level
`@type` set) and the live site (recorded 2026-11-25).

Diff result: EXACT MATCH

Unruled diffs: 0

| Template | Bea §1.1 | As built | Diff |
| home | WebSite, Organization | WebSite, Organization | Ruled addition only: logo + sameAs keys on Organization (§11 item 2, verified URLs) |
| variety-browse | BreadcrumbList, ItemList | BreadcrumbList, ItemList | — |
| variety-detail | BreadcrumbList, ItemList | BreadcrumbList, ItemList | — (zero-seller pages emit the empty sellers ItemList, live-exact) |
| seller-index | BreadcrumbList, ItemList | BreadcrumbList, ItemList | — |
| seller-shop | BreadcrumbList, ItemList, Organization | BreadcrumbList, ItemList, Organization | — |
| crop-index | BreadcrumbList, ItemList | BreadcrumbList, ItemList | — |
| crop-hub | BreadcrumbList, ItemList | BreadcrumbList, ItemList | — |
| series-hub | BreadcrumbList, ItemList | BreadcrumbList, ItemList | — |
| state-hub | BreadcrumbList, ItemList | BreadcrumbList, ItemList | — |
| static-informational | BreadcrumbList where a trail exists; no new types | none | — (no template in this class carries a trail: verified live + as-built on /about, /about/data, /about/bot, /api-docs, /privacy, /terms, /add-your-farm, /report, /search, /account, /unsubscribe, /offline) |

Notes:

- Cross-page ItemList position continuity (page N starts at (N−1)×24+1)
  and per-page `numberOfItems` are covered by the Slices 4–5 suites and
  re-proven on the parity dataset's page-2 rows; the inventory pins the
  type sets, the suites pin the contents.
- The prohibited list (`Product`, `Offer`, `AggregateOffer`,
  `AggregateRating`, `Review`, `FAQPage`, `price`, `lowPrice`, `offers`,
  `aggregateRating`, `review`, `priceValidUntil`) appears in no as-built
  cell above; the code guard (`assertNoProhibitedJsonLd`) plus the
  inventory suite enforce this on every run.
- PostalAddress appears nested inside the seller-shop Organization only
  when the D1 location parses as "City, ST" (GeoSeed rule honored:
  single location source, no invented addresses).
