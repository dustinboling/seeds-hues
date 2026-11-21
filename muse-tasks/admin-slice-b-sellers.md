# Task: Seed Directory admin section — Slice B (sellers)

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
  numbered sequence (the latest is `0013_admin_review.sql`). Your
  migration is **0014**.
- The design spec of record is `admin-design/SPEC.md` in the repo
  root (Nadia's spec, Quinn-gated PASS WITH NOTES + delta re-gate
  PASS, amendments RA-1–RA-3 applied). Slice B implements **§7 D1–D5**
  (the Sellers section) plus the parts of §5, §10, §11, and §13.4
  that the section touches. Read the spec sections named below
  before building each piece; where this brief and the spec differ,
  this brief wins (it records Hue's resolutions of the spec's open
  points) — and say so in the PR body.

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
   - No `setState` in effect bodies. Browser-only state (e.g.
     remembered values in `localStorage`) goes through
     `useSyncExternalStore` — the proven pattern is in
     `SellerFilterSection.tsx` and Slice 0's sign-in.
   - Refs only inside effects and event handlers — never read or
     written during render.
   - No impure calls during render (`Date.now()`, `Math.random()`,
     …). "Now" arrives as server-computed data or a prop, never
     computed inside a component's render.
3. Full-tree `npx eslint .` green AND full `npm run verify` green,
   both in-session, are the finish line.

## What Slices 0 and A already shipped (build on it — do not rebuild)

- **Slice 0 (PR #14, live):** the `users.role` field + `role_audit`;
  the admin session layer (email + 6-digit code, `admin_sessions`,
  `sf_admin_session` cookie, ~7-day sessions, distinct from visitor
  sessions); the iPad-first `AdminShell` (rail ≥744px, desktop at
  ≥1181px, phone tab bar); the dashboard home frame with real queue
  counts; the sign-in flow (A1–A5); frame pages for the sections.
  Components in `components/admin/`: `AdminShell`, `BusyForm`,
  `ConfirmDialog`, `QueueCard`, `RoleChip`, `SectionFrame`, `Sheet`.
  The Sellers section today is a frame:
  `app/admin/(protected)/sellers/page.tsx` renders "Seller
  management arrives in a later build slice." Slice B replaces
  that frame with the real section.
- **Slice A (PR #15, live):** the `/admin/review` workspace (four
  queues, duplicate decisions, the scout-holds feed, decider
  stamping); `MasterDetail` and `StatusBanner` components (in
  `app/admin/(protected)/review/_components/` — promote/reuse them
  rather than forking); the write-transport pattern: admin-session-
  authorized route handlers with origin checks
  (`app/admin/review/decide/route.ts`) calling service-layer
  effects, role enforced **server-side**; `adminPageData()` /
  `requireAdmin()` in `lib/admin-current-user.ts` guard every
  protected page.
- **The seller machinery already exists — reuse it.** Repository
  layer `lib/repositories/admin.ts`: `sellerRecordByRef`,
  `liveListingCountForSeller`, `applySellerCorrection` (the
  CORRECTABLE field subset + seq-bump/updatedAt conventions),
  `setSellerSmallFarm` (the classification write — "set only
  through the admin path"), `setSellerEligibility`,
  `removeSeller` (the full removal flow). Service layer
  `lib/services/admin.ts` (`createAdminService`): `sellerBadge`,
  `sellerAction` (approve/reject/remove), and the correction path —
  each already returns the public paths to revalidate; the
  key-based admin API (`app/api/v1/admin/[...path]/route.ts`)
  exercises them today. The Slice B UI drives **these same
  effects** through the admin session. Extend service/repository
  signatures where this brief requires; never fork catalog-write
  logic into the UI layer.
- **The sellers record already carries every D3 field:**
  `name`, `slug`, `type` (enum `SELLER_TYPES`: wholesale / retail /
  specialty), `platform` (enum `SELLER_PLATFORMS`: shopify /
  woocommerce / squarespace / other, nullable), `homepage` (the
  website), `contactEmail` (schema-commented "Private — never in
  any public payload"), `location`, `region`, `country`,
  `shipsTo` (JSON array of region codes, `["unknown"]` when not
  sourced), `description`, `orderingNotes`, `status` (enum:
  active / inactive / pending), `eligibility` (candidate /
  approved / rejected), `isSmallFarm`. There is **no notes store**
  — §13.4's "seller internal-notes store" is created by this slice.

## Hue's resolutions of spec open points (binding; note them in the PR body)

1. **D3 needs a general update path.** `applySellerCorrection`'s
   CORRECTABLE set (name, location, region, homepage, description,
   orderingNotes, shipsTo) is narrower than D3's field set. Add a
   general admin seller-update in the repository/service layer
   covering the full D3 set (adding `type`, `platform`, `country`,
   `contactEmail`), following `applySellerCorrection`'s
   conventions (seq bump, `updatedAt`, returns the changed-field
   list — D2's status line is built from it). `type`/`platform`
   validate against the schema enums. The structured-correction
   path (Slice A) keeps its existing narrower set and behavior.
2. **Deactivate = `status` → `inactive`; Reactivate = `status` →
   `active`.** Before wiring the buttons, confirm how the public
   layer treats an inactive seller; the shipped behavior must be:
   an inactive seller has no public page (not-found), is absent
   from the public directory and search, and its listings leave
   the public variety pages — while nothing is deleted and the
   admin record stays fully visible. If the public layer keys
   visibility off a different field than you expected, use the
   mechanism that actually produces this behavior and say which
   in the PR body. Remove seller = the existing `removeSeller`
   flow, unchanged.
3. **Status words + the Active chip.** A row's status word is
   derived from eligibility + status: **Candidate** (eligibility
   candidate — "not listed publicly"), **Active** (publicly
   listed), **Not active** (everyone else not publicly listed).
   The D1 **Active / Not active** chips filter on public listing
   state (Active = publicly listed; Not active = not listed,
   candidates included). Candidate sellers appear in D1 under
   **All** — the list is the team's working list, not the public
   directory (Slice A's approvals land here to be finished).
4. **Completing a candidate (spec §15.13).** A candidate seller
   becomes publicly listed when an Admin has completed BOTH its
   details and its classification in Sellers. Mechanically: a
   **D4 classification save on a candidate seller also sets
   eligibility → approved** (via the existing
   `setSellerEligibility`), because classification is the last
   of the two named completion steps and C2's success path deep-
   links here to finish. A D3 edit alone never publishes. State
   this in the D4 sheet when the seller is a candidate (a line
   under the radio cards: "Saving the classification lists
   {seller} publicly — their details are finished.").
5. **"View public page"** renders only when the seller is
   publicly listed; for a candidate or not-active seller the
   header shows the status word alone (a link that 404s is a
   defect).
6. **Ships to** is edited as a single text field of comma-
   separated region codes, stored through the existing JSON
   convention (empty → `["unknown"]`). No new widgetry.
7. **D2's Listings section** deep-links to
   `/admin/listings?seller={slug}` ("See all in Listings"). The
   Listings screens are Slice C — build the link exactly as
   spec'd; do not build Listings screens.
8. **Notes author trail:** each note snapshots `author_name` +
   `author_role` at posting time (the Slice A decider-trail
   precedent — the trail outlives the account), alongside the
   author user id (no FK).

## Build

### 1. Migration 0014 — the internal notes store

- New table `seller_notes`: `id` (PK), `seller_id` (INTEGER, FK →
  `sellers.id`), `author_user_id` (INTEGER, no FK),
  `author_name` (TEXT), `author_role` (TEXT), `body` (TEXT),
  `created_at` (TEXT). Index on (`seller_id`, `created_at`).
  Additive only — no existing table is rebuilt, no data changes.
- Mirror it in the Drizzle schema (`lib/db/schema.ts`).
- Privacy registration: `seller_notes` is a private table. It
  must NOT join `SNAPSHOT_ALLOWLIST`
  (`lib/repositories/snapshot-allowlist.ts`) or any other public
  payload path — the notes tests below prove the outcome on the
  real surfaces. Follow the repo's existing private-table
  discipline wherever tables are enumerated for privacy checks.

### 2. Data layer (repository + service)

- **Admin seller list**: search by name (case-insensitive),
  the D1 chip filters (classification: all / small farm / not
  small farm; listing state: all / active / not active per
  resolution 3), sort (name A–Z default; most listings; recently
  updated), each row carrying its live listing count and the
  fields D1 renders. Exact total count for the count line.
  ~84 sellers today — return the full filtered list; no
  windowing needed.
- **Admin seller detail**: the full record (including
  `contactEmail` — admin-side only), live listing count, the
  seller's first listings (enough for D2's read-only block —
  product title, variety name, status, outbound URL), and the
  seller's notes (newest first).
- **updateSeller** per resolution 1, driven through the service
  layer so public revalidation paths come back with the write
  (the `sellerBadge`/`sellerAction` pattern).
- **Classification save**: `setSellerSmallFarm` through the
  service (revalidates the seller page, seller index, sitemap,
  and affected variety pages, as `sellerBadge` already does);
  on a candidate seller it also applies resolution 4; an
  optional classification note (D4's "Why" field) files into
  `seller_notes` authored by the decider.
- **Deactivate / reactivate**: status write through the service
  with the revalidation set resolution 2's behavior requires.
- **Remove**: the existing `removeSeller` flow through the
  service (`sellerAction`'s remove path is the precedent).
- **Notes**: `addSellerNote` (author stamped from the admin
  session: user id, name, role) + list. Notes are served ONLY
  through admin-session-authorized handlers — no public
  repository or payload builder may select from `seller_notes`.

### 3. D1 — Seller list (spec §7 D1)

Replace the frame page with master–detail (reuse Slice A's
`MasterDetail`): list column 360px + D2 in the pane on
iPad/desktop; list screen on phone (tap → detail).

- Search field at the list head (name — a field, not a form).
- Filter chips, two single-select groups: **All / Small farm /
  Not small farm** and **Active / Not active** (resolution 3).
- Sort menu (button → pop-up menu): **Name A–Z** (default),
  **Most listings**, **Recently updated**.
- Rows: seller name (Card head — loudest), `SmallFarmBadge`
  inline when classified (the real component), location line,
  "{n} listings · {status word}". Count line above the rows:
  "{n} sellers" (filtered counts update in words).
- Deep links: every seller is addressable by a stable URL that
  lands on that seller in the detail pane after sign-in (Slice
  0's return-path flow preserves destinations).
- States: *No results* — "No sellers match '{query}'." +
  "Clear search" button. *Loading/error* — the standard §10
  patterns.

### 4. D2 — Seller detail (spec §7 D2)

One screen, both roles — the Reviewer sees the identical layout
with actions absent (§5 rule 2). Sections, in order:

- **Header:** seller name (Display), badge or "Not a small
  farm" text, status word, "View public page" outbound link
  (resolution 5).
- **1. Information** — definition list of the record's public
  facts: website, location, region, country, ships to, contact
  email, seller type, platform, description, ordering notes.
  **Admin** gets an **Edit** button at the section head → D3.
  **Reviewer** sees the list alone.
- **2. Classification** — its own panel: the current
  classification exactly as the public sees it (badge, or the
  words "Not a small farm — no badge is shown"). **Admin
  only:** a **Change** button → D4. Reviewer: panel without
  the button.
- **3. Internal notes** — D5 below. Both roles read and add.
- **4. Listings** — count + the seller's first listings (Quiet
  Ledger anatomy, read-only here) + "See all in Listings"
  (resolution 7).
- **5. Danger zone (Admin only, absent for Reviewer):** at the
  foot, separated by whitespace and a hairline — **Deactivate
  seller** and **Remove seller**, each an outline button
  opening its §10.1 confirm naming the consequence and the
  listing count it affects. The verb button inside each
  confirm is filled with the `danger` token (#8F1D12) and
  paired with its verb label ("Deactivate seller" / "Remove
  seller"). Remove's consequence copy is honest about
  reversibility per §10.1 ("This can be undone by Hue from the
  record, not from this screen.").
- **States:** *Just edited* — returning from D3/D4 shows a
  §10.4 `role="status"` line at the head of the relevant
  section, built from the changed-fields list ("Location
  updated to Greenwood, SC."). *Seller deactivated* — the
  caution banner (warn-50, icon + words) heads the screen for
  both roles: "This seller is deactivated — their page and
  listings are hidden from the public site." with Admin's
  **Reactivate** button in the banner.

### 5. D3 — Edit seller sheet (spec §7 D3)

- Opened ONLY by D2's Edit button — never an open form on D2.
  Form factor: iPad/desktop — large right-side sheet (560px,
  Slice 0's `Sheet`) over the dimmed detail; phone — full-screen
  view. Title "Edit {seller}".
- Fields, grouped: *Identity* — name; slug shown read-only with
  the line "The web address doesn't change, so links keep
  working."; seller type (select, `SELLER_TYPES`); platform
  (select, `SELLER_PLATFORMS` + none). *Contact & links* —
  website, contact email. *Location* — location text, region,
  country, ships to (resolution 6). *About* — description
  (textarea), ordering notes (textarea). Classification is NOT
  in this form (D4 owns it); status is NOT here (Danger zone
  owns it).
- Save bar sticky at the sheet's foot: **Save changes**
  (primary) / **Cancel**. Cancel with unsaved changes asks
  "Discard your changes?" (§10.1 confirm). Validation: inline
  at the field (ochre + icon + words), values always preserved,
  error summary at the sheet head for 2+ errors with links to
  fields. Success: sheet closes, D2 shows the status line, the
  changed values are already rendered (optimistic with honest
  reversal on failure per §10.5 — on failure the sheet reopens
  with values intact and the §10.2 error at its head).

### 6. D4 — Classification sheet (spec §7 D4)

- Opened by D2's Change button (Admin only). Content: the
  question in Dustin's own framing — "Is {seller} a small
  farm, or a larger operation?" — as a two-option radio card
  group: **Small farm** ("Shows the Small farm badge on their
  page and listings, and includes them in the Small farms
  filter.") / **Not a small farm** ("No badge is shown. They're
  listed like any other seller."). The current value is
  pre-selected. Beneath: "This is a judgment call — there's no
  size test. When in doubt, leave the badge off." Optional
  note field ("Why — kept with the internal notes") that files
  into D5 on save. Candidate sellers also get resolution 4's
  line.
- Save: **Save classification** primary in the sheet's foot;
  NO confirm dialog (reversible, non-destructive). Success:
  D2's classification panel and badge update with a status
  line.

### 7. D5 — Internal notes (spec §7 D5)

- The panel on D2. The design makes "never public" unmistakable
  three ways: (1) eyebrow **"INTERNAL NOTES — NEVER SHOWN ON
  THE PUBLIC SITE"** with a lock icon; (2) paper-deep ground
  with a line-strong border — a "back room" surface, distinct
  from every public-style card; (3) the data path in §2 above
  (admin-authorized endpoints only).
- Content: notes newest-first — body text (Newsreader prose
  size), author name + role, friendly timestamp ("Nov 20,
  2026 · 2:14 PM" — server-computed, never an impure call in
  render). Both roles read all notes. **Add note** button at
  the panel head (both roles) → composer sheet (textarea,
  "Add note" primary) — the composer is never an open box on
  the page.
- v1 scope: append-only — no edit, no delete UI (§15.7).
- States: *Empty* — "No notes yet. Notes are only visible
  inside admin — add anything the team should know about this
  seller." *Error posting* — composer keeps the text, §10.2
  pattern.

### 8. Role enforcement (spec §5 + §11 — server-side, tested)

Rendering follows §5: **Act = absent**, **View = read-only
render**. On top of rendering, every write handler authorizes
independently (the Slice A decide-route pattern: admin-session-
authorized route handlers with origin checks, or server actions
if that is the codebase's established shape — match Slice A):

- **Admin only:** D3 edit save, D4 classification save,
  deactivate, reactivate, remove. A reviewer request to any of
  these is refused (403, no state change, no partial effect)
  even with a hand-crafted request.
- **Both roles:** read D1/D2, read notes, add notes.
- Every write stamps its actor from the session (notes author;
  classification note author). Nothing in admin ever shows a
  raw API message or an HTTP status (§10.2).

## Standing constraints (all binding)

- **React traps**: the pre-flight checklist above — no setState
  in effect bodies, refs only in effects/handlers, children as
  JSX children never a prop, no impure calls during render.
- **R4 guardrail scope is unchanged**: the `isAdminTree`
  exclusion stays exactly as ruled (`app/admin/**`,
  `lib/admin/**`, top-level `lib/admin-*.ts(x)`, R4 check
  only). Do not widen it, do not rename admin vocabulary to
  dodge it, and add no prohibited tokens to public code. New
  admin UI code lives under `app/admin/`; new admin library
  code under `lib/admin/` or `lib/admin-*.ts` so it stays
  inside the ruled tree.
- **No open forms** (spec §10.3): every create/edit lives in a
  Sheet or ConfirmDialog opened by a labeled button; the D1
  search field and filter chips are the stated exceptions.
- **Dates are friendly, never ISO**, anywhere in admin (note
  timestamps carry a friendly time as spec'd). Counts use
  tabular figures. No state by color alone. US spelling in all
  copy. Targets ≥ 44×44px.
- **No public changes** (spec §13.7): no public page, public
  API shape, or badge behavior changes. The only public-side
  effects are the admin actions' intended data effects (an
  edit shows, a badge flips, a deactivated seller disappears,
  a completed candidate appears).
- **Components**: build on Slice 0's (`Sheet`, `ConfirmDialog`,
  `BusyForm`) and Slice A's (`MasterDetail`, `StatusBanner`)
  and the site layer (`.btn`, `.card`, `.chip`, `Pagination`,
  `SmallFarmBadge`, friendly-date formatting). New components
  per spec §9 as needed (`ClassificationControl`, `NotesPanel`)
  with the same token discipline. The `danger` token (#8F1D12)
  is used ONLY for the verb button inside destructive confirms.
- **Accessibility floor** (spec §12): focus trapped in
  sheets/dialogs with return-to-opener; safe action takes
  initial focus in destructive confirms; outcomes announced via
  `role="status"`; master–detail selection uses `aria-current`;
  targets ≥44px; reduced-motion collapses transitions via the
  site's global rule; the notes panel's privacy is carried by
  its words and lock icon, not its ground color (forced-colors
  strips grounds).

## Tests (required — the gate checks these exist and pass)

- **Notes never public — the centerpiece (spec §13.4 + design-
  gate Finding 3).** Seed a seller and a note whose body and
  author name carry a unique marker string. Assert the marker
  appears in **none** of these, each exercised through its real
  payload builder / route handler / render path — never by
  merely asserting a config flag or an allowlist's contents:
  (a) the public catalog API's seller payload; (b) the public
  seller page's rendered HTML; (c) the public search results
  for the seller's name; (d) the sitemap payload; (e) the
  catalog snapshot (sync) payload. AND assert the note **is**
  returned by the admin-authorized notes read for the same
  seller (the test is non-vacuous in both directions).
- **Private-table discipline**: the snapshot payload contains
  no `seller_notes` data; `seller_notes` is absent from
  `SNAPSHOT_ALLOWLIST`.
- **Migration 0014**: additive only — seeded sellers, listings,
  and review items are untouched; the notes table starts empty.
- **Edit (D3)**: an admin save changes exactly the submitted
  fields and returns the changed-field list the status line
  renders; type/platform outside the enums are refused;
  `contactEmail` set through D3 never appears in any public
  payload (the centerpiece surfaces are the check).
- **Classification (D4)**: an admin flip changes `isSmallFarm`
  and the badge state the public payload derives; the optional
  Why note lands in `seller_notes` authored by the decider;
  a candidate seller stays unlisted after a D3 save and
  becomes publicly listed after the D4 save (resolution 4).
- **Reviewer limits at the handler**: reviewer requests to
  edit-save, classification-save, deactivate, reactivate, and
  remove are each refused with **no state change**; a reviewer
  CAN read the detail and add a note (the note appears,
  authored with the reviewer's name + role).
- **Deactivate / reactivate / remove**: deactivation flips the
  status and the seller + its listings leave the public
  surfaces (public seller payload/page not-found, absent from
  search, listings off its varieties' public pages);
  reactivation restores them; remove runs the existing removal
  flow's effects.
- **D1 list**: search matches by name; both chip groups filter
  as spec'd (resolution 3's listing-state semantics); counts
  are exact; the three sort orders hold; a candidate seller
  appears with the Candidate status word.
- The Slice 0 + Slice A suites keep passing untouched in
  spirit — if an earlier test must change because the frame
  page it asserted is now the real section, update it to assert
  the section behavior and say so in the PR body.

## Out of scope (do not build)

- **Seller type TAGS.** Dustin decided a multi-tag seller-type
  system on 2026-11-20; that build is NOT briefed yet. Do not
  add a tags table, field, or UI. D3 edits the existing single
  `type` enum field as-is. Classification in this slice is the
  existing `isSmallFarm` flag only.
- **Applying any data correction** — including GeoSeed's
  Clinton → Greenwood, SC address fix. This slice builds the
  UI that makes such corrections possible; it changes NO
  seller data, in code, seeds, fixtures, or the migration.
- Listings / Varieties / Accounts management screens (Slice C:
  E1/E2, F1–F3, G1/G2) — including the variety-remove path.
  D2's "See all in Listings" is a link only.
- Statistics section (Slice D) and Web Analytics wiring.
- Retiring legacy `/admin/waitlist`.
- Notes edit/delete UI (append-only in v1, §15.7).
- A seller create/add UI (not designed; sellers arrive via the
  review queues and ingest).
- Eligibility transitions other than resolution 4's candidate
  completion.

## Finish line

- Full `npm run verify` green in-session (your own loop, §"How
  you work"), full-tree `npx eslint .` green.
- The PR body states: what was built per screen (D1–D5); the
  migration's contents; the notes-privacy test's surfaces,
  enumerated; Hue's resolutions you relied on (especially 2, 3,
  and 4 — including which mechanism actually hides an inactive
  seller, if it differed from expectation); any earlier test
  you had to update and why; test count. (The workflow's auto
  PR title/body are a known wart — write the real summary in
  the PR body regardless.)
