# Browse client-navigation filter fix — HELD BRIEF (not yet dispatched)

**Status: PREPARED, NOT DISPATCHED.** Written by the eighth conversion
coordinator 2026-11-25 from Quinn's gate record on PR #84
(`QUINN-GATE-spa-preview-visual-fix.md`). Dispatch is Hue's sequencing
call. This defect is a **hard blocker for preview acceptance and for
Slice 9 cutover** per Quinn's return condition 2: the preview must not
be represented as finished, and cutover must not proceed, until the
filter flow is fixed and re-driven in a real browser.

## The defect (Quinn gate F2 — Critical, pre-existing, Slice 4-era)

In a real browser, tapping a browse filter chip does not filter.
Evidence chain from Quinn's human-interaction drive (phone 390×844,
touch context, app served by its own Node serve — the program's
standing harness):

- Entered: on `/variety`, tapped the Hue group's **White** chip.
- Constructed/transmitted: URL became `/variety?color_family=white`
  with no full reload (a window marker survived); the app issued
  `GET /variety/index.pageContext.json?color_family=white`.
- Received: that request returned **200 with `"total": 831`** — the
  unfiltered catalog (verified by direct fetch of the same URL). The
  first broken link is the pageContext response itself.
- Rendered (after 12s settle): count line still "831 varieties,
  alphabetical. Page 1 of 35", the Hue group's pressed chip still
  **All**, no applied-filters row, first card unchanged. The failure is
  silent; the URL claims a filter the page does not show.
- Control: full-page SSR of the identical URL is **correct** — title
  "White — flower seed varieties", filtered set (125 total; 24 items
  on page 1 in JSON-LD), matching production's response to the same
  URL. The defect is specific to the client-navigation data path.

Not caused by PR #84: its diff touches CSS imports, class names, and
one class rename; browse logic, the `+data.ts` hook (which reads
`pageContext.urlParsed.searchOriginal`), and the serve layer are
Slice 4-era code, untouched. Prior slice gates proved this flow at
jsdom + HTTP fidelity only — the jsdom suite constructs data directly
and cannot see this class of defect (the C3 carry from Slice 6).

**Fidelity boundary:** proven in the app's Node serve
(`server/serve.ts`). The deployed Worker preview was not re-driven;
the data hook is shared code but the serve's edge-cache layer is
serve-specific, so which layer drops the query is unproven — the
Worker path must be driven explicitly at the gate, not inferred.

## Scope when dispatched

- Diagnose which layer drops the query on client navigation (data
  hook's URL parsing under Vike client routing, the pageContext
  endpoint's request handling, or the serve/Worker cache key ignoring
  the query string) and fix it at that layer. All browse surfaces that
  share the in-place machinery are in scope: `/variety`, `/search`,
  crop detail, shop browse — Quinn's drive proved `/variety`; the
  others share the path and must be driven at the gate.
- Tests first: a discriminating test at the highest fidelity the suite
  supports for this path (a request-level test that issues the
  pageContext request WITH a filter query against the real handler and
  asserts filtered totals — red on the starting tree), stated
  starting-red in the PR summary. Keep all suites green.
- Acceptance is a **real-browser drive at Quinn's gate**, not the
  suite: on the fixed build, a filter tap narrows the results, moves
  the pressed state, and shows the applied-filter row, with the
  pageContext response carrying the filtered totals — driven on the
  Node serve AND on the deployed Worker preview after redeploy.
