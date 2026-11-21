# Task: Seed Directory admin section — Slice D (statistics + legacy /admin/waitlist retirement) — the FINAL admin slice

You are working in the `seeds-hues` repository (the Seed Directory,
seeds.hues.flowers). This prompt is self-contained — do not assume any
other context.

## Orientation

- The live app is the **Next.js app in `v2/`** (Next 16, React 19,
  Tailwind 4, Drizzle + D1, deployed with @opennextjs/cloudflare). Run
  all commands from `v2/`. Note `v2/AGENTS.md`: this Next version has
  breaking changes vs. training data — read the relevant guide in
  `node_modules/next/dist/docs/` before touching framework APIs.
- The repository root also contains an `app/` directory — a **legacy
  static site**. Ignore it completely.
- Verification, from `v2/`:

  ```
  npm run verify
  ```

  (lint + typecheck + vitest, in that order; the lint step is
  `eslint .` — the FULL tree, tests included). Dependencies are
  already installed (`npm ci` was run in `v2/` before you started).
  **All of it must pass.** Add tests for the new behavior (see
  "Tests" below).
- **There is NO migration in this slice.** Statistics is a
  presentation build over tables that already exist (spec §1, §13.4),
  and the retirement deletes code. If you conclude a schema change is
  needed, you have misread the data layer — re-read "Data sources"
  below instead of writing a migration.
- The design spec of record is `admin-design/SPEC.md` in the repo
  root (Nadia's spec, Quinn-gated PASS WITH NOTES + delta re-gate
  PASS, amendments RA-1–RA-3 applied). Slice D implements **§7 H**
  (Statistics), the §7 B stat-snapshot wiring, the §6 navigation
  addition, plus the parts of §5, §10, §11, §12, §13.3, and §15.5 the
  work touches. Read the spec sections named below before building
  each piece; where this brief and the spec differ, this brief wins
  (it records Hue's resolutions of the spec's open points) — and say
  so in the PR body.

## How you work — the loop (read this first)

The pipeline lets you execute shell commands. Use that:

1. **Run the FULL `npm run verify` yourself before ending your
   turn.** On ANY failure, fix the cause and re-run the FULL verify
   from the top. Repeat until it is completely green (lint +
   typecheck + all tests). Ending your turn with a failing or
   never-run verify is a failed run regardless of anything else.
2. **Pre-flight checklist** — the traps that killed earlier runs of
   this project; check each BEFORE your first verify run:
   - Every relative import in your code resolves to a file you
     actually created. No dangling imports. (This slice DELETES
     files — sweep for imports of anything you delete, in app code
     AND tests, before the first verify.)
   - Children are passed as JSX children, never as a `children`
     prop — in tests as much as components (use trailing
     `createElement` arguments in test helpers).
   - No `setState` in effect bodies. Browser-only state goes
     through `useSyncExternalStore` — the proven pattern is in
     `SellerFilterSection.tsx` and Slice 0's sign-in.
   - Refs only inside effects and event handlers — never read or
     written during render.
   - No impure calls during render (`Date.now()`, `Math.random()`,
     …). "Now" arrives as server-computed data or a prop, never
     computed inside a component's render. (Statistics is nothing
     but dates — compute every boundary in the service/read layer
     and pass plain data down.)
3. Full-tree `npx eslint .` green AND full `npm run verify` green,
   both in-session, are the finish line.

## What Slices 0, A, B, and C already shipped (build on it — do not rebuild)

- **Slice 0 (PR #14, live):** roles + admin sessions (email + code,
  ~7-day, `sf_admin_session` cookie); the iPad-first `AdminShell`;
  the dashboard home frame; the sign-in flow. The nav model is
  `ADMIN_SECTIONS` + `navFor` in `lib/admin-auth.ts` — it has **no
  Statistics entry** (Slice 0 gate note N4: "phone tab bar has 4
  tabs until Statistics lands in Slice D"), and the home stats band
  is `components/admin/StatsSnapshot.tsx`, a composed **no-data
  frame** that renders four labeled cards with honest captions and
  no numbers (Slice 0 gate note N5: "real wiring is Slice D"). This
  slice closes both notes.
- **Slice A (PR #15, live):** the `/admin/review` workspace (four
  queues; seller candidates includes Add Your Farm submissions).
  Review URLs are built by `reviewHref` (`?queue={QueueKey}`; the
  seller-candidates key lives in `lib/admin/review-queues.ts`).
- **Slice B (PR #16, live):** the Sellers section + the
  service/transport patterns (`lib/admin/*-service.ts`,
  session-authorized route handlers under `app/admin/<section>/`).
- **Slice C (PR #17, live):** Listings, Varieties (F2's Waitlist
  count already links to `/admin/statistics` — your page is its
  landing spot), Accounts. Admin date-times render in
  America/Los_Angeles (Slice C resolution 14). Per-section
  components live in `app/admin/(protected)/<section>/_components/`
  with pure URL builders in `_components/urls.ts`; windowed lists
  use a `show` param (F1 pattern).
- **The demand machinery already exists — reuse it.**
  `lib/repositories/events.ts` holds the event tables' reads and
  writes: `demandStats` (the key-API demand lists — top clicked,
  top sold-out, zero-result searches, zero-seller views; bots
  excluded) is the precedent for aggregation shape, not the H read
  model itself. `lib/services/farms.ts`'s `demandView(limit)` (over
  `lib/repositories/waitlist.ts`'s `waitlistDemand`) is the
  most-waited ranking — the admin home's "Most wanted" band already
  renders its top 5, and §7 H promotes it unchanged. The public
  site already records everything H needs: variety page views land
  in `variety_view_counts` (via `components/variety/ViewBeacon.tsx`
  → `/api/track`), outbound clicks land in `click_events` (via
  `/go/{listing_id}`), searches land in `search_events` (via
  `lib/services/catalog.ts`). This slice reads; it does not add
  capture.

## Hue's resolutions of open points (binding; note them in the PR body)

1. **Navigation (closes Slice 0 note N4).** `ADMIN_SECTIONS` gains
   `{ key: "statistics", label: "Statistics", href:
   "/admin/statistics", adminOnly: false }` **between Varieties and
   Accounts** (spec §6 rail order); `AdminSectionKey` gains
   `"statistics"`. The phone tab bar becomes five tabs — Home,
   Review, Sellers, **Stats**, More (spec §6's phone-tab column):
   the tab renders the short label "Stats" (add an optional short
   label to the nav item or special-case it in the shell, following
   the shell's existing review-badge special-casing), and the tab
   grid goes from 4 to 5 columns. The phone **More page does NOT
   gain Statistics** (it holds Listings, Varieties, Accounts,
   identity, sign out — spec §6). Statistics is visible to **both
   roles** (§11: Live / Live, identical content).
2. **The page.** New route `app/admin/(protected)/statistics/`
   (`page.tsx` + `loading.tsx` following the sibling sections'
   pattern; `export const dynamic = "force-dynamic"` like the home
   page). Server-rendered; all data shaping happens in a read model
   at `lib/admin/statistics.ts` over new repository reads (extend
   `lib/repositories/events.ts` for views/clicks/searches; the
   waitlist repository for signup series; the accounts repository
   for signup series) — pages and components receive plain,
   fully-computed data (numbers, deltas, movement, sentences,
   thin-data flags), never raw rows to interpret.
3. **Ranges.** `?range=7d|30d|12w`, default `7d`; anything else
   falls back to `7d`. All day boundaries are **UTC calendar days**
   — the event tables' own bucketing (`variety_view_counts.date`,
   `substr(at,1,10)` for the event streams) — so the numbers and
   the words always describe the same days. Current period = today
   (UTC) plus the preceding n−1 days (7, 30, or 84); previous
   period = the equal-length span immediately before it. The
   header band (NOT sticky — gate Finding 7) carries the segmented
   control (links following the admin chip/segmented patterns,
   `aria-current` on the active range) with the range restated in
   words beside it ("Nov 14 – Nov 20, 2026", friendly dates), and
   **every card caption restates the range** ("Last 7 days · Nov 14
   – Nov 20, 2026" shape — recognition over recall, §7 H).
4. **Signals.** `?signal=views|clicks|waitlist|searches`, default
   `views`; anything else falls back to `views`. The signal
   switcher is a segmented control (Views · Clicks to sellers ·
   Waitlist · Searches) driving the popularity centerpiece. The
   range and signal params compose (changing one preserves the
   other), and `?show=25` widens the ranking (resolution 11).
5. **Sources — exact, one per number (no blending, ever).**
   - **Views:** `variety_view_counts.views` summed over the
     period's UTC dates, per variety.
   - **Clicks to sellers:** `click_events` rows with
     `is_bot = false` in the period. **Not** `daily_stats` — that
     table is a nightly rollup and can lag a day; `demandStats`
     already sets the direct-from-`click_events` precedent. (A
     test proves the source: a `daily_stats` row that disagrees
     with `click_events` changes nothing.)
   - **Waitlist signups (site card):** `waitlist_entries.created_at`
     in the period.
   - **New accounts (site card):** `users.created_at` in the
     period. All accounts count — the card says "New accounts",
     not "New visitors".
   - **Waitlist ranking:** `demandView`/`waitlistDemand`,
     **unchanged in meaning** (resolution 12).
   - **Searches:** `search_events` in the period (resolution 13).
   - **Visitors:** **no live source in this slice** (resolution 6).
6. **Visitors ships in its designed no-data state — honestly
   labeled.** Spec §15.5 designs exactly this outcome ("if Web
   Analytics is not wired at build time, that one card ships dark
   with its designed empty state while the other three site stats
   are fully live"), and Hue's pre-brief verification established
   why wiring is not completable inside this build: (a) Cloudflare
   Web Analytics is not enabled for the site (no WA site/beacon
   exists — enabling it is a dashboard act, not code); (b) the only
   analytics the zone exposes today is zone-wide `httpRequests1d
   Groups` for **all of hues.flowers** — presenting zone totals as
   Seed Directory visitors would misattribute another site's
   traffic, which this directory never does; (c) no analytics-read
   credential exists for the Worker to call with. Therefore: the
   Visitors card renders on both H and the home snapshot with the
   pinned line — H: "Visitor counts come from Cloudflare Web
   Analytics. It isn't connected to the directory yet, so there
   are no visitor numbers to show." Home (shorter): "Not connected
   yet — visitor counts come from Cloudflare Web Analytics." **Do
   not build a speculative analytics client, do not add a beacon,
   and do not render any number for Visitors.** The other three
   site cards are fully live.
7. **Deltas.** Delta = current period vs previous equal period,
   rendered as arrow + percent + word ("▲ 12% up" / "▼ 5% down" —
   never color alone; up = leaf, down = ink-soft, per §7 B).
   Percent = `round((cur − prev) / prev × 100)`. Edge cases,
   pinned: prev = 0 and cur > 0 → the delta reads **"New"** (no
   percent, no infinity); cur = prev (including both 0) → **"No
   change"**; cur = 0 and prev > 0 → "▼ 100% down".
8. **Movement (Views and Clicks rankings).** Aggregate the FULL
   ranking for both periods (not just the shown slice), rank every
   variety with a value, then compare: movement = previous rank −
   current rank, rendered "▲ 2" / "▼ 1" / "—" for no move (arrows
   + numbers, ink-soft for down, leaf for up — never color alone).
   A variety with **no value in the previous period** reads
   **"New"**. Movement exists only where both periods are fully
   covered by data (resolution 9).
9. **Thin data — the honesty rule.** Per signal, `dataSince` = the
   UTC date of that signal's earliest record (views: earliest
   `variety_view_counts.date`; clicks: earliest `click_events.at`
   date; searches: earliest `search_events.at` date; accounts:
   earliest `users.created_at` date; waitlist signups: earliest
   `waitlist_entries.created_at` date). If the previous period
   starts before `dataSince`, that signal's **deltas and movement
   are suppressed** — totals still render — and the affected cards
   and tables carry the line: "Only {n} days of data so far —
   comparisons start after the first full period." ({n} = days
   from `dataSince` through today, inclusive.) If the current
   period also starts before `dataSince`, trend bars begin at
   `dataSince` and the card caption adds "Data begins {friendly
   date}." The directory is young (data starts mid-November 2026),
   so the 12-week range will exercise this path for months — it is
   a normal state, not an error state.
10. **Trend charts (`TrendBars`, spec §9 — new shared component in
    `components/admin/`).** Daily bars for 7d/30d; for 12w, twelve
    weekly bars (consecutive 7-day buckets ending today, oldest
    first). Leaf bars on a leaf-50 track (the §7 B/H treatment).
    Every chart ships with (a) a one-sentence summary in plain
    words — peak form: "{Label} peaked on {Weekday, Mon D}, with
    {n}." (for weekly buckets: "{Label} peaked in the week of {Mon
    D}, with {n}.") — and (b) a **visually-hidden data table**;
    the chart is never the only carrier of its numbers. A period
    whose total is 0 but whose signal has history renders the bars
    at zero with the summary "{Label}: none in this period." A
    signal with no data at all renders its card's composed
    no-data line instead of a chart (e.g. Searches before the
    first search: "No searches recorded yet.").
11. **Ranking tables (`RankingTable` pattern, §7 H).** Columns:
    rank (tabular), variety name (link to its F2 detail —
    `/admin/varieties?variety={slug}`, the Slice C deep link)
    with a public-page link beside it (`/variety/{slug}`, new
    tab), crop name, the signal value (tabular, right-aligned),
    and movement (Views/Clicks only, resolution 8). Top 10 by
    default; a **Show top 25** control widens in place via
    `?show=25` (the house window pattern from F1/C1 — no separate
    page). Rows for removed varieties (`deleted_at` set) never
    appear in any ranking — aggregate over admin-visible varieties
    only, the same `deleted_at IS NULL` discipline as F1.
12. **Waitlist ranking — current, not period-bound.** The Waitlist
    signal renders the `demandView` ranking exactly as the legacy
    page and the home band present it: rank, variety (F2 link +
    public link), crop, **waiters** (tabular), **verified
    waiters**, **seller count**. It has **no movement column and
    does not change with the range**; its caption says so in
    words: "The current waiting list — it doesn't change with the
    date range." Top 10 + Show top 25 like the others
    (`demandView(25)`). Empty state: the existing line, "No one
    is waiting on a variety yet."
13. **Searches — two tables (spec §7 H), no movement.**
    **Top searches:** term as typed-normalized
    (`query_normalized`), search count in the period, and —
    where clicks followed — "usually finds {variety}": the modal
    (most frequent) non-null `clicked_variety_id` among the
    term's in-period events, rendered as the variety's name
    linking to F2. Omit the clause when no click followed, and
    omit it when that variety has been removed (no F2 to land
    on). **Searches with no results:** term + count over
    in-period events with `result_count = 0`, in its own card
    carrying the line "People looked for these and found
    nothing." Empty no-results table: "No fruitless searches in
    this period — every search found something." Empty top
    table: "No searches recorded in this period."
14. **Clicks sold-out share.** The Clicks ranking card carries
    the caption, when in-period non-bot clicks > 0: "{p}% of
    clicks were on sold-out listings" — p = round(100 × clicks
    with `availability_at_click = 'sold_out'` / all non-bot
    clicks in period). Demand the directory can't yet serve,
    named (§7 H).
15. **Home snapshot wired (closes Slice 0 note N5).**
    `StatsSnapshot` becomes data-driven with the **7-day** window
    fixed (spec §7 B): each live card renders label, Stat number
    (tabular), delta vs the previous 7 days (resolution 7 + the
    thin-data rule of resolution 9), and a 7-bar mini trend
    (`TrendBars` at snapshot scale, with its visually-hidden table
    and the one-line summary in the card's accessible name). The
    whole card is the tap target: **Clicks to sellers** →
    `/admin/statistics?signal=clicks`; **Waitlist signups** →
    `/admin/statistics?signal=waitlist`; **New accounts** and
    **Visitors** → `/admin/statistics`. The Visitors card keeps
    resolution 6's not-connected state (no number, no link
    promise of numbers — it still links to Statistics, where the
    full line lives). The Slice 0 test that asserts the composed
    no-data frame must be updated to assert the wired behavior —
    name it in the PR body.
16. **Legacy retirement (spec §13.3) — removal, not redirect.**
    The new section is live (queues in Review since Slice A,
    farm-owner flag in Accounts since Slice C, totals and
    most-waited in Home/Statistics in this slice), so the legacy
    surface comes off entirely — "do not leave two admin
    surfaces":
    - Delete `app/admin/waitlist/page.tsx` and
      `app/admin/waitlist/action/route.ts` (the whole
      `app/admin/waitlist/` directory).
    - Delete `app/admin/login/route.ts` — it exists only to
      serve the legacy page's key-paste sign-in/out.
    - Delete `lib/admin-session.ts` (the 8-hour `sf_admin`
      key-paste gate) — its only consumers are the three files
      above plus one test (below).
    - After deletion, `/admin/waitlist`, `/admin/waitlist/action`,
      and `/admin/login` return **404** like any unknown path.
    - **Update the references that would otherwise dangle:**
      (a) `lib/services/messages.ts` — the farm-submission
      notification email (HTML + text) links to
      `${site}/admin/waitlist` ("Open the review queue"); repoint
      it to the new queue: `${site}/admin/review?queue=sellers`
      (confirm the seller-candidates `QueueKey` in
      `lib/admin/review-queues.ts` and use `reviewHref`'s param
      shape); (b) the comment in
      `app/admin/(protected)/layout.tsx` that describes the legacy
      page as living outside the group, untouched — it no longer
      does; (c) the `demandView` doc comment in
      `lib/services/farms.ts` that names `/admin/waitlist` as its
      consumer — its consumers are now the admin home, Statistics,
      and the key API.
    - **Update the one test:** `tests/unit/admin-foundation.test.ts`
      imports `ADMIN_COOKIE` from `lib/admin-session` to assert
      the admin session cookie differs from the legacy one. Keep
      the isolation property pinned against the literal legacy
      name (`"sf_admin"`) instead of the deleted module, and say
      so in the PR body.
    - **NOT retired:** the key-based API endpoint
      `GET /api/v1/admin/waitlist` (it serves `demandView` to
      Hue's tooling; it is not the browser page and not the
      key-paste gate) and `demandView` itself. Existing API tests
      covering it keep passing untouched.
17. **Dates in words.** Range words and captions use friendly
    dates (the admin `formatAdminDate` family), never ISO. Any
    date-time rendered in this slice follows Slice C resolution
    14 (America/Los_Angeles); H is expected to need dates only.

## The screens

Follow the established shapes: the section opens inside
`AdminShell` with `section="statistics"`; iPad/desktop is a
two-column grid of cards under the header band, phone one column
in the same order (§7 H); per-card loading skeletons via the new
`loading.tsx`; per-card error behavior follows §10.2 (one card's
failure never blanks the section — the page is server-rendered, so
shape the read model so a failed signal degrades to that card's
error/no-data state, never a thrown page).

### H — Statistics (spec §7 H)

- **Header band:** Display heading "Statistics"; the
  `TimeRangeControl` segmented control (7 days · 30 days · 12
  weeks) with the range in words beside it. Not sticky.
- **Site stat cards** (in order): **Visitors** (resolution 6
  state), **New accounts**, **Waitlist signups**, **Clicks to
  sellers** — each live card: Stat number (tabular), delta
  (resolution 7/9), `TrendBars` chart + sentence summary +
  visually-hidden table (resolution 10), caption restating the
  range (resolution 3).
- **Variety popularity:** the signal segmented control (Views ·
  Clicks to sellers · Waitlist · Searches) and the selected
  signal's table(s) per resolutions 11–14. On desktop (≥1181px)
  Views and Clicks MAY sit side by side when the Views signal is
  selected — the spec permits it; the switcher still governs
  phone/iPad. (If you take the option, the Clicks table is the
  same read-model output as the Clicks signal's — one source,
  two placements; if you don't, say so in the PR body. Simplicity
  is an acceptable reason.)
- **States:** thin data (resolution 9 lines), zero-in-period
  (resolution 10/13 lines), loading skeletons matching the grid,
  per-card error (§10.2). Zero is a designed state, never a blank
  card.

### B (home) — snapshot wiring

Per resolution 15. Nothing else on the home page changes: queue
cards, Most wanted, and Recent decisions render exactly as today.

## Role enforcement (spec §5 + §11)

Statistics renders **identically for Admin and Reviewer** (§11:
Live / Live) — it is a read-only section: no writes, no actions
route, no role branches in the read model. The `(protected)`
layout's existing session + role gate covers the route; a
signed-out request follows the established sign-in redirect with
return path, and no statistics data appears in any signed-out
response. The retirement removes an auth surface (the key-paste
gate); it must not weaken any other: the new admin session layer
is untouched, and the key-based API keeps its own auth exactly as
is.

## Standing constraints (all binding)

- **React traps**: the pre-flight checklist above — no setState
  in effect bodies, refs only in effects/handlers, children as
  JSX children never a prop, no impure calls during render.
- **R4 guardrail scope is unchanged**: the `isAdminTree` exclusion
  stays exactly as ruled (`app/admin/**`, `lib/admin/**`,
  top-level `lib/admin-*.ts(x)`, R4 check only). New admin UI code
  lives under `app/admin/`; new admin library code under
  `lib/admin/` or `lib/admin-*.ts` so it stays inside the ruled
  tree. Repository reads live in `lib/repositories/` (existing
  machinery, as Slices A–C did). Do not widen the exclusion, and
  add no prohibited tokens to public code — note the
  `lib/services/messages.ts` edit is a link change only.
- **No open forms** (spec §10.3): Statistics has no forms at all;
  the range/signal/show controls are links/segmented controls —
  controls, not forms.
- **Numbers are honest or absent.** Every figure on H and the home
  snapshot traces to exactly one named source (resolution 5). No
  invented numbers, no estimates presented as counts, no blending
  of two sources into one figure. Where data cannot support a
  comparison, the design says so in words (resolutions 6, 9)
  instead of rendering a plausible-looking zero or percent.
- **Dates are friendly, never ISO**, anywhere in admin. Counts use
  tabular figures. No state by color alone (deltas and movement
  are arrow + number + word). US spelling in all copy. Targets
  ≥ 44×44px.
- **No public changes** (spec §13.7): no public page, public API
  shape, or badge behavior changes. This slice's only public-side
  footprint is none at all — the retirement is admin-side, and
  the one email template touched is the internal farm-submission
  notification (its link target changes; its wording otherwise
  stands).
- **Components**: build on Slice 0's (`AdminShell`, `Sheet`,
  `ConfirmDialog`), the site layer (`.btn`, `.card`, `.chip`,
  `.skeleton`), and the §9 newcomers this slice creates
  (`TrendBars` in `components/admin/`; the ranking table and
  time-range control in the statistics section's `_components/`
  following the Slice C pattern).
- **Accessibility floor** (spec §12): charts always paired with a
  sentence summary + visually-hidden data table; tables are real
  tables with scoped headers; ranking/stat tables reflow on phone
  with no horizontal scrolling at 320px; focus visible and never
  obscured; reduced-motion collapses transitions via the site's
  global rule.

## Tests (required — the gate checks these exist and pass)

- **Range math**: period boundaries for 7d/30d/12w (current period
  ends today UTC, spans exactly n days; previous period is the
  equal span immediately before); 12w trend bucketing into twelve
  7-day buckets; invalid `range`/`signal` params fall back to the
  defaults; range + signal + show params compose.
- **Sources are the named ones**: on a seeded dataset, each
  ranking and card total equals the hand-computed value from its
  own table — views from `variety_view_counts` (a `click_events`
  row for the same variety changes nothing); clicks exclude
  `is_bot = true` rows AND ignore a contradictory `daily_stats`
  row; waitlist signups count `waitlist_entries.created_at`;
  new accounts count `users.created_at`; searches group by
  `query_normalized`.
- **Deltas and movement**: a known two-period dataset produces
  the exact percents (including ▼ 100% down), the "New" delta
  (prev 0, cur > 0), "No change" (equal periods), exact movement
  values against the FULL previous ranking (a variety ranked
  below the shown slice still yields a true movement figure),
  and "New" for a variety with no previous-period value.
- **Thin data**: a dataset whose earliest record falls inside
  the previous period suppresses that signal's deltas AND
  movement while totals still render, and the thin-data line
  appears with the correct day count; a range starting before
  `dataSince` starts its trend at `dataSince` with the "Data
  begins" caption. Signals thin independently (views can be thin
  while clicks are not).
- **Sold-out share**: exact percent from seeded clicks; the
  caption is absent when in-period clicks are 0.
- **Searches**: top-search counts; "usually finds" names the
  modal clicked variety, is omitted when no click followed, and
  is omitted when that variety is removed; the no-results table
  contains only `result_count = 0` terms; both empty states
  render their pinned lines.
- **Waitlist table**: mirrors `waitlistDemand`'s order and values
  (waiters, verified, seller counts) and is **identical across
  ranges** (range-independence asserted, not assumed).
- **Visitors honesty**: on both H and the home snapshot, the
  Visitors card renders the not-connected line and **no number**
  (assert the absence of any figure in the card) — the Slice 0
  no-invented-numbers property, preserved for this one card while
  the other three go live.
- **Home snapshot wired**: the three live cards render their
  seeded 7-day totals, deltas, and 7-bar trends; the card links
  carry the pinned hrefs (`?signal=clicks`, `?signal=waitlist`,
  plain `/admin/statistics`).
- **Navigation**: `navFor` for both roles includes Statistics
  between Varieties and Accounts; the phone tab set is the five
  pinned tabs with "Stats"; the More page does not list
  Statistics.
- **Retirement**: `/admin/waitlist` and `/admin/login` are not
  routes (the `route-not-found` test pattern); no file in `app/`,
  `lib/`, or `components/` imports `lib/admin-session` (the
  deleted module) — assert by source sweep in the test or by the
  suite's compile; the farm-submission notification email's link
  points at `/admin/review?queue=sellers` (both HTML and text
  bodies); the legacy-cookie isolation assertion survives
  against the literal `"sf_admin"`. The key-API
  `GET /api/v1/admin/waitlist` coverage (existing tests) passes
  untouched.
- Removed varieties appear in **no** ranking (seed a removed
  variety with the period's highest views — it must not appear,
  and the next variety takes rank 1).
- The Slice 0 + A + B + C suites keep passing — the two named
  updates (the StatsSnapshot frame test, the foundation
  legacy-cookie assertion) are the only earlier-test changes
  expected; any other earlier test you must change gets named in
  the PR body with its reason.

## Out of scope (do not build)

- **Connecting Cloudflare Web Analytics** (resolution 6): no
  beacon, no analytics client, no credential handling. The
  Visitors card's no-data state is the deliverable for that card.
- Custom date ranges (§15.5 defers them); per-seller statistics
  pages (§7 H: not designed); any new data capture (the beacons
  and event writes already exist and stay untouched).
- Any change to the review queues, sellers, listings, varieties,
  or accounts sections beyond the F2 → Statistics link target
  already shipped in Slice C.
- The key-based admin API's shape — including its
  `/api/v1/admin/waitlist` demand endpoint, which stays.
- Account/role/session changes of any kind. The legacy
  `sf_admin` cookie simply stops being read; no migration of
  legacy sessions is needed or wanted.

## Finish line

- Full `npm run verify` green in-session (your own loop,
  §"How you work"), full-tree `npx eslint .` green.
- The PR body states: what was built (H per card/table, the home
  snapshot wiring, the navigation addition); how each of the four
  popularity signals and each site stat is sourced (resolution
  5's mapping, in your own confirmation); the Visitors decision
  and its reason (resolution 6); the thin-data rule as
  implemented; the retirement's file list and the references
  updated (resolution 16); the two earlier tests you updated and
  why; test count. (The workflow's auto PR title/body are a known
  wart — write the real summary in the PR body regardless.)
