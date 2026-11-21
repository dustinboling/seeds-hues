# Task: Seed Directory admin section — Slice C (listings + varieties + accounts, incl. variety-remove)

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
- D1 migrations live in `v2/migrations/` following the existing
  numbered sequence (the latest is `0014_seller_notes.sql`). Your
  migration is **0015** (see resolution 4 — it is the ONLY schema
  change in this slice).
- The design spec of record is `admin-design/SPEC.md` in the repo
  root (Nadia's spec, Quinn-gated PASS WITH NOTES + delta re-gate
  PASS, amendments RA-1–RA-3 applied). Slice C implements **§7 E1/E2**
  (Listings), **§7 F1–F3** (Varieties and crops), **§7 G1/G2**
  (Accounts), plus the parts of §5, §8.4, §10, §11, and §13.4 the
  sections touch, plus the **variety-remove path** (an approved
  scope addition recorded in `ADMIN-SECTION.md`, "Scope addition —
  VARIETY-REMOVE path"; the gate-cleared spec covers varieties as
  view/edit only, so the remove path follows §10.1 + the addition's
  rules as written out in this brief). Read the spec sections named
  below before building each piece; where this brief and the spec
  differ, this brief wins (it records Hue's resolutions of the
  spec's open points) — and say so in the PR body.

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
     actually created. No dangling imports.
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
     computed inside a component's render.
3. Full-tree `npx eslint .` green AND full `npm run verify` green,
   both in-session, are the finish line.

## What Slices 0, A, and B already shipped (build on it — do not rebuild)

- **Slice 0 (PR #14, live):** the `users.role` field + `role_audit`
  (repository read/write in `lib/repositories/admin-auth.ts`:
  the audit insert + `roleAuditFor`); the admin session layer
  (email + 6-digit code, `admin_sessions`, `sf_admin_session`
  cookie, ~7-day sessions, distinct from visitor sessions); the
  iPad-first `AdminShell` (rail ≥744px, desktop at ≥1181px, phone
  tab bar; **reviewers never receive Accounts in their nav**);
  the dashboard home frame; the sign-in flow (A1–A5). Components
  in `components/admin/`: `AdminShell`, `BusyForm`,
  `ConfirmDialog`, `NoAccess`, `QueueCard`, `RoleChip`,
  `SectionFrame`, `Sheet`, `StatsSnapshot`. The Listings,
  Varieties, and Accounts sections today are frames:
  `app/admin/(protected)/listings/page.tsx`,
  `.../varieties/page.tsx`, `.../accounts/page.tsx` render
  "…arrives in a later build slice." — Slice C replaces all three
  frames with the real sections. (The Accounts frame already
  renders `NoAccess` for reviewers; keep that behavior.)
- **Slice A (PR #15, live):** the `/admin/review` workspace;
  `MasterDetail` and `StatusBanner` components (in
  `app/admin/(protected)/review/_components/` — promote/reuse
  them rather than forking); duplicate decisions writing
  `variety_aliases` rows with provenance (`source =
  'duplicate_decision'`, `decision_item_id`, `decided_by_name`,
  `created_at` — migration 0013); the write-transport pattern:
  admin-session-authorized route handlers with origin checks
  calling service-layer effects, role enforced **server-side**.
- **Slice B (PR #16, live):** the Sellers section (D1–D5) —
  the pattern this slice follows for service shape and transport:
  `lib/admin/seller-service.ts` (`createAdminSellerService`,
  validation errors as typed `ServiceError`s, `needAdmin` before
  any effect) driven through `app/admin/sellers/actions/route.ts`
  (session-authorized, origin-checked). D2's Listings summary
  deep-links to `/admin/listings?seller={slug}` — that link is
  live in production today and lands on your E1.
- **The listing machinery already exists — reuse it.** Repository
  layer `lib/repositories/admin.ts`: `removeListing` (the proven
  single-winner atomic retire: guarded status flip + `gone`
  event carrying `reason` + seq bump + `recomputeIndexable`,
  idempotent `alreadyRemoved` result) — exposed today on the
  key-based admin API as `POST /api/v1/admin/listings/:id/remove`
  through `lib/services/admin.ts` and
  `app/api/v1/admin/[...path]/route.ts`. `listing_events` is the
  E2 history source (events: `first_seen`, `restocked`,
  `sold_out`, `gone`; `reason` column from migration 0011).
  `liveListingCountForSeller` is the precedent for a shared
  live-count function.
- **The accounts machinery already exists — reuse it.**
  `lib/repositories/accounts.ts`: `setFarmOwner` (writes
  `users.is_farm_owner`/`seller_id` + the `farm_owner_audit`
  trail atomically) and `farmOwnerAuditFor`.
  `lib/repositories/waitlist.ts` / `waitlist_entries` holds
  per-user and per-variety waitlist membership.
- **Public visibility of a variety** is
  `lib/repositories/catalog-read.ts`'s `activeVariety`:
  `status = 'active' AND deleted_at IS NULL`. Every public read
  (variety page, search, sitemap, snapshot) flows from these
  predicates — the variety-remove path works through them, never
  around them.

## Hue's resolutions of open points (binding; note them in the PR body)

1. **Variety-remove semantics — soft removal, no cascade.**
   Removing a variety sets `varieties.deleted_at` (+
   `updated_at`, `updated_seq` via the catalog's seq
   conventions) in one single-winner guarded write, exactly the
   shape of `removeListing` (guarded on `deleted_at IS NULL`;
   a second remove reports `already_removed` and writes
   nothing). `status` is NOT changed. **Nothing else is touched**:
   the variety's listings (any status), aliases, variety tags,
   and waitlist rows all stay in the record, untouched — removal
   is for empty/phantom records, not a cascade delete. The
   variety leaves the public site because `activeVariety`
   excludes it, and it leaves the admin F1/F2 lists for the same
   reason (admin catalog reads in this slice filter
   `deleted_at IS NULL` too). Reversal is Hue-from-the-record
   (clearing `deleted_at` by hand), and the confirm copy says
   exactly that (§10.1 honesty pattern).
2. **Variety-remove lives in BOTH surfaces over one effect.**
   The effect sits in the repository/service layer like every
   other admin effect. It is driven by (a) the F2 danger zone
   (admin session, Admin role only) and (b) the key-based admin
   API as **`POST /api/v1/admin/varieties/:id/remove`**, wired
   exactly like the listing-remove endpoint (the scope addition
   in `ADMIN-SECTION.md` frames the gap as a missing endpoint,
   and Hue works through the API). API result semantics mirror
   listing-remove: unknown id → 404; already removed →
   `already_removed: true` with nothing written; live listings
   present → a refusal (409) whose payload names the count
   (`live_listings`); success → the variety id/slug + the public
   paths to revalidate, following `removeListing`'s return
   conventions.
3. **"Live listing" — one definition, one function.** A live
   listing is `status IN ('active', 'published')` (the schema's
   `VISIBLE_LISTING_STATUS`) AND `deleted_at IS NULL`. Add a
   shared repository count (e.g. `liveListingCountForVariety`,
   beside `liveListingCountForSeller`) and use it for the F2
   block line, the F2 confirm, AND the server-side guard — the
   number Dustin reads is the number the guard enforces. The
   server re-checks at write time regardless of what the UI
   showed (race-safe, like `removeListing`).
4. **Listing restore is new — and migration 0015 exists for it.**
   E2's Restore has no existing effect. Build `restoreListing`
   in `lib/repositories/admin.ts` mirroring `removeListing`'s
   single-winner atomicity: only a `status = 'removed'` listing
   can be restored (anything else is a no-op result naming why,
   e.g. `not_removed`); the flip sets `status = 'published'`,
   writes a **`restored`** event, bumps seq, and recomputes
   indexable. `listing_events.event` has a DB CHECK over
   `LISTING_EVENT`, so migration **0015** rebuilds
   `listing_events` losslessly (the migration-0013 pattern:
   every existing row copied verbatim — id, listing_id, event,
   at, reason) with `'restored'` added to the enum/CHECK, and
   adds a **nullable `actor` text column**. `LISTING_EVENT` in
   `lib/db/schema.ts` gains `'restored'`; `listingEvents` gains
   `actor`. This is the slice's ONLY schema change.
   `removeListing` gains an **optional** actor parameter
   (existing callers unchanged, actor stored NULL); the E2
   retire handler and Slice A's report-retire path
   (`retireListingFromReport`, which already has a Decider)
   pass the actor name so the history trail is honest from
   every door. E2 history renders events in plain words:
   `first_seen` → "Published", `sold_out` → "Marked sold out",
   `restocked` → "Back in stock", `gone` → "Retired",
   `restored` → "Restored" — plus "· by {actor}" when actor is
   present and "— reason: {reason}" on `gone` events that
   carry one.
5. **E1 status words and chips.** Chips: **All** (default) /
   **Active** / **Sold out** / **Retired**. A listing's status
   word: `removed` → "Retired"; publicly visible +
   availability `sold_out` → "Sold out"; publicly visible →
   "Active"; otherwise the status in plain words (`gone` →
   "Gone", `stale` → "Stale", `pending` → "Pending",
   `unverified` → "Unverified", `inactive` → "Inactive",
   `rejected` → "Rejected"). Chip filters: Active = visible
   AND availability ≠ `sold_out`; Sold out = visible AND
   availability = `sold_out`; Retired = `status = 'removed'`.
   Row title = `titleRaw`, falling back to the variety's name
   when null. "Checked {date}" reads `lastCheckedAt` as a
   friendly date (resolution 14's timezone); null →
   "Not checked yet".
6. **E1 deep-link filters.** E1 accepts `?seller={slug}` (D2's
   live deep link) and `?variety={slug}` (F2's link,
   resolution 10), each rendered as a removable chip
   ("Seller: {name} ×" / "Variety: {name} ×") above the list,
   per spec E1. Both may combine with search + status chips.
7. **E2 packet sizes — labels and seed counts, never prices.**
   Spec E2 says "packet sizes as captured"; the directory's
   standing rule is that captured prices are never shown, and
   this slice keeps that rule unbroken on every surface,
   admin included: render each packet size's label and seed
   count from `listing_packet_sizes`; do NOT render
   `price_cents` anywhere.
8. **E2 retire reason.** The §10.1 confirm carries the reason
   select (Wrong variety / Not seed / Dead link / Duplicate
   listing / Other) + an optional note field, per spec E2. The
   stored `reason` is the chosen label, with the note appended
   as "{label} — {note}" when one is given. Retire drives the
   existing `removeListing` effect (with the actor,
   resolution 4) — never fork retire logic into the UI layer.
   The confirm's consequence copy names the variety: "This
   listing will come off '{variety}'s page. The seller's other
   listings stay."
9. **F1 counts and alias matching.** A row's "{n} sellers" =
   distinct sellers with ≥1 live listing (resolution 3's
   definition) on the variety; "{n} other names" = its alias
   count. Search matches variety names AND aliases; when a
   variety matches only through an alias, the row shows
   "Matched another name: '{alias}'" (spec F1). Crop chips are
   the crops (the `plants` table), single-select, the site's
   FilterStrip pattern — the strip never wraps.
10. **F2 composition.** "View public page" renders only when
    the variety is publicly visible (the Slice B resolution-5
    pattern). The Listings summary counts the variety's
    listings by resolution 5's status words and links to
    `/admin/listings?variety={slug}`. The Waitlist count reads
    `waitlist_entries` for the variety and links to
    `/admin/statistics` (spec F2 — the Slice D frame is the
    landing spot until Slice D builds the real section).
11. **Alias management (F2).** A manually added alias is
    written with `kind = 'synonym'` and the provenance columns
    (`source`, `decision_item_id`, `decided_by_name`) NULL;
    `name_normalized` comes from `lib/names.ts`'s
    `normalizeName`; the write follows the catalog's seq
    conventions for the variety (Slice A's decision-alias
    writes are the precedent). Add refusals — plain errors in
    the sheet, no write: blank name; a name already an alias of
    this variety (normalized comparison); a name equal to the
    variety's own name (normalized). **RA-1 is enforced in the
    service layer, not just the rendering**: removing an alias
    whose `source = 'duplicate_decision'` is refused with no
    state change no matter how the request arrives; the UI
    renders no remove control for such aliases (Absent for
    both roles, §11). A decision alias is labeled "Added from
    a duplicate decision · {friendly date} · by
    {decidedByName}"; other aliases are labeled "another name
    for this variety". The manual-remove §10.1 confirm names
    the full consequence: "This name will stop finding this
    variety in search, and the scout may propose this variety
    again under it."
12. **G2 role changes — server-side guardrails.** Every role
    change writes through the existing `role_audit` repository
    path. The service refuses, with a plain explanation and no
    state change: (a) an actor changing **their own** role
    (matches the spec's absent self-controls — defense in
    depth); (b) demoting the **last remaining admin** ("the
    system must never lock Dustin out of his own site"). The
    Grant Admin §10.1 confirm (UI) names the consequence:
    "{Name} will be able to edit and remove sellers and give
    other people roles." The three radio cards carry the
    spec's verbatim copy (§7 G2 — quote it exactly). The
    panel's history line reads the audit back: "{Role} since
    {friendly date} · set by {actor}".
13. **G1/G2 account facts.** Shown name = `displayName`, else
    `name`, else the email. G1 search matches name,
    displayName, and email. Flag chips are words: **Admin** /
    **Reviewer** / **Farm owner**. G2 shows the account's
    waitlist count (`waitlist_entries` per user) and its
    status in words ("Active" / "Banned") — display only; no
    ban/unban or delete UI exists in the spec and none is
    built. The farm-owner panel reuses
    `setFarmOwner`/`farmOwnerAuditFor` unchanged in effect;
    the seller picker is a search field + result list (never
    a typed slug); the revoke confirm carries the legacy
    wording: "Revoking keeps the account and its waiting
    lists." The farm-owner audit history lists beneath the
    panel.
14. **Admin date-times render in the farm's timezone**
    (carrying Quinn's Slice B gate note M1). Stored instants
    are correct but `formatAdminDateTime`
    (`lib/admin-auth.ts`) currently reads the stored ISO in
    UTC, so an afternoon action displays as evening and after
    4 PM PT shows the next day's date. Fix it to render in
    **America/Los_Angeles** via `Intl.DateTimeFormat` with an
    explicit `timeZone` (deterministic across server and
    client — the reason the current implementation reads the
    raw string), and update its existing tests to pin Pacific
    outputs, including a post-4 PM PT case that stays on the
    same calendar day. All new date/time rendering in this
    slice (E1 checked dates, E2 history, F2 alias dates, G1
    joined dates, G2 audit lines) uses the same zone. Dates
    stay friendly, never ISO, everywhere in admin.
15. **Legacy `/admin/waitlist` is NOT retired in this slice.**
    The slicing plan retires it in the final slice (Slice D),
    because its totals and most-waited jobs land in Statistics
    (H). Do not touch the legacy page or
    `lib/admin-session.ts`.

## The screens

Follow the established shapes: master–detail on iPad/desktop,
list on phone (promote Slice A's `MasterDetail`); windowed
lists (≤50 + Show more, exact totals — the Slice A C1 / Slice B
D1 pattern); a single search field at the head of each list and
filter chips are controls, not forms (§10.3 exceptions); every
create/edit lives in a Sheet or inside a ConfirmDialog opened
by a labeled button (**no open forms**); outcomes announced
via `role="status"`; counts in words with tabular figures.

### E1 — Listing list (spec §7 E1)
Search (product title, variety name, or seller name) + chips
per resolution 5 + the deep-link chips of resolution 6. Rows:
product title (Card head), variety name, seller name, status
word + "checked {date}". Count line ("1,813 listings",
filtered counts update in words). No results / loading /
error — the standard patterns.

### E2 — Listing detail (spec §7 E2, flow §8.4)
Product title (Section head); the outbound product URL as a
link (new tab); seller (link to D2) and variety (link to F2);
status word; packet sizes per resolution 7; **History** — the
listing's event trail in plain words (resolution 4). Admin
only (absent for Reviewer): **Retire listing** → §10.1 confirm
with the reason select inside it (resolution 8); a retired
listing's detail shows the caution banner + **Restore
listing** button. Retired listings stay findable in admin
under the Retired filter forever (§8.4).

### F1 — Variety list (spec §7 F1)
Search per resolution 9 + crop chips. Rows: variety name
(Card head), crop, "{n} sellers · {n} other names". Count
line. No results — "No varieties match '{query}'." + **Clear
search** button (the D1 pattern).

### F2 — Variety detail (spec §7 F2)
Name (Display) + crop/series/botanical line + "View public
page" (resolution 10); Listings summary + Waitlist count
(resolution 10); **Other names** — the alias list per
resolution 11: Admin-only **Add another name** button → small
sheet (one field + the consequence line "This name will find
this variety in search."); a remove control per manual alias
→ §10.1 confirm; decision aliases labeled, never removable.
**Danger zone (Admin only): Remove variety** — when the
variety has live listings, the zone shows the block in words
naming the count ("This variety has {n} live listings. Retire
them before removing the variety.") + a link to its listings
in E1, and no confirm is offered; at zero, the **Remove
variety** button → §10.1 confirm naming the consequences
(its public page comes off the site; the name stops resolving
in search; its listings, other names, and waitlist entries
stay in the record untouched; "This can be undone by Hue from
the record, not from this screen."). Reviewer: fully
read-only render — no add/remove controls, no danger zone.

### F3 — Crops (spec §7 F3)
A segmented head on the Varieties section: **Varieties |
Crops**. The crops list is orientation only: crop name,
variety count (active, non-removed varieties of the crop),
seller count (distinct sellers with ≥1 live listing across
the crop's varieties); tapping a crop filters F1 to it. No
crop editing.

### G1 — Account list (spec §7 G1; Admin only)
Search (name or email — resolution 13). Rows: name (Card
head), email, "Joined {friendly date}", flag chips where
true. Count line. No results — "No accounts match
'{query}'." + **Clear search**. The list shows no browsing,
order, or message data — there is none to show (§7 G1
privacy note).

### G2 — Account detail (spec §7 G2; Admin only)
Name, email, phone (as given at signup), joined date,
waitlist count, account status. Two panels, each action
behind its own button: **Role** (current role as a word —
"Visitor — no admin access" / "Reviewer" / "Admin";
**Change role** → role sheet with the spec's three verbatim
radio cards; Grant Admin takes the §10.1 confirm;
guardrails per resolution 12; audit history line) and
**Farm owner** (current state in words; **Set as farm
owner** → sheet with the seller picker → confirm; **Remove
farm-owner status** → confirm with the legacy wording;
audit history beneath). *Self-view*: viewing your own
account, the role controls are absent and a line explains
why ("You can't change your own role.").

## Role enforcement (spec §5 + §11 — server-side, tested)

Rendering follows §5: **Act = absent**, **View = read-only
render**. Every write handler authorizes independently (the
Slice A/B pattern: admin-session-authorized route handlers
with origin checks — follow `app/admin/sellers/actions/
route.ts`'s placement and shape for the new sections'
transports; service layer in `lib/admin/` following
`createAdminSellerService`'s shape, `needAdmin` before any
effect):

- **Admin only:** E2 retire + restore; F2 alias add + manual
  alias remove; F2 variety remove; ALL of G (role changes,
  farm-owner set/remove). A reviewer request to any of these
  is refused (403, no state change, no partial effect) even
  with a hand-crafted request.
- **Both roles:** read E1/E2, F1/F2/F3 (read-only render for
  Reviewer). Reviewers never receive Accounts data — the
  page-level `NoAccess` stands and the G handlers refuse
  reviewers too.
- Every write stamps its actor from the session (listing
  event actor, role audit actor, farm-owner audit actor).
  Nothing in admin ever shows a raw API message or an HTTP
  status (§10.2).

## Standing constraints (all binding)

- **React traps**: the pre-flight checklist above — no
  setState in effect bodies, refs only in effects/handlers,
  children as JSX children never a prop, no impure calls
  during render.
- **R4 guardrail scope is unchanged**: the `isAdminTree`
  exclusion stays exactly as ruled (`app/admin/**`,
  `lib/admin/**`, top-level `lib/admin-*.ts(x)`, R4 check
  only). Do not widen it, do not rename admin vocabulary to
  dodge it, and add no prohibited tokens to public code. New
  admin UI code lives under `app/admin/`; new admin library
  code under `lib/admin/` or `lib/admin-*.ts` so it stays
  inside the ruled tree. (The API-side variety-remove service
  wiring follows the existing key-API pattern in
  `lib/services/admin.ts` / `lib/repositories/admin.ts` —
  that is catalog machinery, not admin UI vocabulary; keep
  its shape identical to `removeListing`'s.)
- **No open forms** (spec §10.3): every create/edit lives in
  a Sheet or ConfirmDialog opened by a labeled button; list
  search fields and filter chips are the stated exceptions;
  the retire reason lives inside its confirm, never on the
  page.
- **Dates are friendly, never ISO**, anywhere in admin, in
  America/Los_Angeles (resolution 14). Counts use tabular
  figures. No state by color alone. US spelling in all copy.
  Targets ≥ 44×44px.
- **No public changes** (spec §13.7): no public page, public
  API shape, or badge behavior changes. The only public-side
  effects are the admin actions' intended data effects (a
  retired listing leaves its variety's page, a restored one
  returns, a removed variety's page 404s).
- **Components**: build on Slice 0's (`Sheet`,
  `ConfirmDialog`, `BusyForm`), Slice A's (`MasterDetail`,
  `StatusBanner`), and the site layer (`.btn`, `.card`,
  `.chip`, `Pagination`, `SmallFarmBadge`, FilterStrip,
  friendly-date formatting). The `danger` token (#8F1D12) is
  used ONLY for the verb button inside destructive confirms.
- **Accessibility floor** (spec §12): focus trapped in
  sheets/dialogs with return-to-opener; the safe action takes
  initial focus in destructive confirms; outcomes announced
  via `role="status"`; master–detail selection uses
  `aria-current`; targets ≥44px; reduced-motion collapses
  transitions via the site's global rule.

## Tests (required — the gate checks these exist and pass)

- **Variety-remove guardrail — the centerpiece.** Against
  the real repository/service/read paths (never by merely
  asserting a flag): (a) a variety with a live listing —
  the API remove is refused with the count named and the
  admin-session remove is refused, with **zero state
  change** (`deleted_at` still null, seq unchanged, the
  variety still on every public surface); (b) after that
  listing is retired (through the real `removeListing`),
  the remove succeeds; (c) a second remove reports
  `already_removed` and writes nothing; (d) an unknown id
  404s; (e) after removal the variety is absent from each
  real public payload path — the variety-by-slug read
  (its page 404s), public search by its name AND by one of
  its aliases, the sitemap payload, and the catalog
  snapshot payload — each surface first proven to contain
  the variety BEFORE removal (non-vacuous in both
  directions, the Slice B centerpiece pattern); (f) the
  variety's listing rows, alias rows, and waitlist rows
  are byte-for-byte untouched in the record (no cascade);
  (g) a reviewer-session request to the F2 remove handler
  is refused with no state change.
- **Retire / restore round trip**: the E2 retire writes a
  `gone` event carrying actor + the resolution-8 reason
  string and the listing leaves its variety's public page;
  restore writes a `restored` event with actor and the
  listing returns to the public page; restoring a
  non-removed listing is a no-op naming why; a concurrent
  double-restore has a single winner (mirror
  `removeListing`'s concurrency test if one exists); the
  history trail renders all five event kinds in plain
  words, with actor and reason where present.
- **Migration 0015 is lossless**: seeded `listing_events`
  rows survive the rebuild verbatim (count + per-row id,
  listing_id, event, at, reason; actor NULL); `restored`
  is accepted after the migration; the pre-migration event
  values remain accepted.
- **E1**: search matches title, variety, and seller;
  chips filter per resolution 5; the seller and variety
  deep-link chips filter and are removable; counts are
  exact; status words follow resolution 5's mapping,
  including a sold-out visible listing and a `gone` one.
- **Aliases (RA-1)**: a manual add appears on F2, finds
  the variety in F1 search labeled as an alias match, and
  bumps the variety's seq; removing a manual alias works;
  removing a `duplicate_decision` alias is refused **at
  the service layer** with no state change, and F2 renders
  no remove control for it while rendering its provenance
  label; the add refusals (blank / duplicate / own name)
  write nothing.
- **Accounts**: a role change writes `role_audit` and the
  G2 history line reads it back; demoting the last admin
  is refused server-side with no state change; a self
  role change is refused server-side; grant-admin lands
  as admin; reviewer requests to role-change and
  farm-owner writes are refused (403, no state change);
  farm-owner grant/revoke writes `farm_owner_audit`
  through the existing repository and binds the picked
  seller's id; a reviewer receives no Accounts data from
  the G handlers.
- **`formatAdminDateTime` renders Pacific**: pinned cases
  — a stored instant at 2:14 PM PT displays "2:14 PM"; an
  instant after 4 PM PT displays the same calendar day
  (the UTC bug would show the next day).
- The Slice 0 + A + B suites keep passing untouched in
  spirit — if an earlier test must change because a frame
  page it asserted is now a real section, update it to
  assert the section behavior and say so in the PR body.

## Out of scope (do not build)

- **Statistics section (Slice D)** and Cloudflare Web
  Analytics wiring; **retiring legacy `/admin/waitlist`**
  (Slice D, resolution 15).
- **Applying any production data change in the build** —
  in particular do NOT remove variety 208 ("Marshmallow")
  or any other record in code, seeds, fixtures, or the
  migration. The build ships the path; the first use
  happens after ship, through the shipped API, outside
  this run.
- Seller type TAGS (separate, not-yet-briefed build); any
  Sellers-section changes beyond what E/F/G link to.
- Crop editing (F3 is browse-only, §15.4).
- Variety create/edit UI (not designed — varieties arrive
  via ingest, the scout, and review; F2 is view + aliases
  + remove only). No slug/name editing of varieties.
- Account ban/unban, account deletion, any password
  anything. No changes to visitor sign-in or sessions.
- Alias editing (remove + re-add is the path); notes
  edit/delete.
- Eligibility, classification, or badge changes anywhere.

## Finish line

- Full `npm run verify` green in-session (your own loop,
  §"How you work"), full-tree `npx eslint .` green.
- The PR body states: what was built per screen (E1, E2,
  F1, F2, F3, G1, G2) + the variety-remove path (both
  surfaces); migration 0015's contents and its
  losslessness evidence; Hue's resolutions you relied on
  (especially 1, 2, 3, 4, 11, 12, 15); the
  variety-remove guardrail test's shape; any earlier test
  you had to update and why; test count. (The workflow's
  auto PR title/body are a known wart — write the real
  summary in the PR body regardless.)
