# Task: Seed Directory admin section — Slice A (review queues)

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
  numbered sequence (the latest is `0012_admin_roles.sql`). Your
  migration is **0013**.
- The design spec of record is `admin-design/SPEC.md` in the repo
  root (Nadia's spec, Quinn-gated PASS WITH NOTES + delta re-gate
  PASS, amendments RA-1–RA-3 applied). Slice A implements **§7 C0–C5**
  (Review index + the four queue workspaces) plus the parts of §7 B
  (home) and §10 that the queues touch. Read the spec sections named
  below before building each piece; where this brief and the spec
  differ, this brief wins (it records Hue's resolutions of the
  spec's open points) — and say so in the PR body.

## How you work — the loop (read this first)

The pipeline now lets you execute shell commands. Use that:

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

## What Slice 0 already shipped (build on it — do not rebuild)

Slice 0 (PR #14, live) delivered: the `users.role` field +
`role_audit`; the admin session layer (email + 6-digit code,
`admin_sessions`, `sf_admin_session` cookie, ~7-day sessions,
distinct from visitor sessions); the iPad-first `AdminShell`
(rail ≥744px, desktop at ≥1181px, phone tab bar); the dashboard
home frame with real queue counts (`lib/services/admin-auth.ts`
`queueCards()`); the sign-in flow (A1–A5); and frame pages for the
sections. Its components are yours to reuse:
`components/admin/` — `AdminShell`, `BusyForm`, `ConfirmDialog`,
`QueueCard`, `RoleChip`, `SectionFrame`, `Sheet`. The Review
section today is a frame: `app/admin/(protected)/review/page.tsx`
renders "The review queues arrive in a later build slice." Slice A
replaces that frame with the real workspace.

## The decision machinery already exists — reuse it

`lib/services/admin.ts` (`createAdminService`) already implements
every decision **effect**, exercised today through the key-based
admin API (`app/api/v1/admin/[...path]/route.ts`):

- `approve(id, body)` — per type: `listing_match` publishes the
  listing onto its variety (`publishProposal`: seller must be
  approved, domain not blocked, variety active; waitlist notify;
  extracted name recorded as a `seller_alias`); `new_variety`
  creates the variety (`admin.createVariety`) + publishes;
  `seller_candidate` creates the seller with
  `eligibility: "candidate"` (`admin.createCandidateSeller`);
  `seller_correction` applies structured fields
  (`admin.applySellerCorrection`; `body.fields` overrides
  `proposal.fields`) and closes the linked report resolved;
  `removal` runs the seller-removal flow.
- `reject(id)` — resolves the item `rejected`; closes a linked
  report as dismissed.
- `merge(id, body)` — merges varieties + publishes (API-only; the
  Slice A UI does not expose re-pointing — see Out of scope).
- `removeListing(id, body)` — the shipped listing-retire effect.
- Repository layer: `lib/repositories/admin.ts` (`insertReviewItem`,
  `listReviewItems`, `reviewItemById`, `resolveReviewItem`,
  `addAlias`, `mergeVarieties`, …). Catalog writes bump
  `catalog_seq` and return public paths to revalidate; the route
  layer revalidates them (follow the `[...path]` route's pattern).

The Slice A UI drives **these same effects** through the admin
session. Extend the service/repository signatures where this brief
requires new recorded data (decider, provenance) — never fork the
catalog-write logic into the UI layer.

Data reality (production, 2026-11-21 — design for these volumes):
985 pending `listing_match`, 169 pending `new_variety`, 0 pending
`seller_candidate` (59 approved historically), 4 pending
`seller_correction` (all four are free-form probe reports with no
structured fields), 0 `removal` items ever, 1 pending
`farm_submissions` row, and 6 scout POSSIBLE-DUPLICATE holds that
exist only in `crawl-daily/VARIETY-PROPOSALS.md` (outside `v2/` —
fields per hold: held name, crop, seller + product URL, evidence
quote, hold reason naming the candidate existing variety).

## Build

### 1. Migration 0013 — decider trail, hold type, alias provenance

- `review_items`: add nullable columns `decided_by_user_id`
  (INTEGER, no FK — the trail outlives the account, the
  `farm_submissions.user_id` precedent), `decided_by_name` (TEXT),
  `verified_by_name` (TEXT), `verified_at` (TEXT),
  `seen_by_name` (TEXT), `seen_at` (TEXT). Additive ALTERs.
- New review type **`duplicate_hold`**: `REVIEW_ITEM_TYPE` gains
  `"duplicate_hold"`, which means the `review_items_type_chk`
  CHECK constraint changes — rebuild the table (create the new
  table with the extended check + the new columns, copy every row
  with an explicit column list preserving ids and all values,
  drop, rename, recreate the two indexes:
  `review_items_status_type_idx`, `review_items_group_idx`). The
  rebuild must be lossless — a test proves row count and a sample
  of full rows are identical across it on a seeded database.
- `variety_aliases`: add nullable provenance columns `source`
  (TEXT), `decision_item_id` (INTEGER), `decided_by_name` (TEXT),
  `created_at` (TEXT). Additive ALTERs; existing rows stay NULL
  (= legacy/manual). Only duplicate decisions write
  `source = 'duplicate_decision'`.
- Mirror all of it in the Drizzle schema (`lib/db/schema.ts`).
- Privacy: `review_items` is already a private table (keep it out
  of snapshot/sync/public API — the existing tests assert this).
  `variety_aliases` rows ARE public-facing (search matches them);
  the provenance columns must never be selected into any public
  response, snapshot, sitemap, or search payload. Add a test that
  a public variety/search payload carries no provenance or
  decider fields.

### 2. Decider threading

- `resolveReviewItem` and the service's `approve` / `reject` /
  `merge` accept an optional decider `{ userId, name }`; when
  present, resolving an item stamps `decided_by_user_id` +
  `decided_by_name` + `resolved_at` together. The key-based API
  path passes no decider and behaves exactly as before.
- Farm submissions: UI decisions stamp the existing `reviewed_by`
  (decider name) + `reviewed_at` — the columns already exist.

### 3. The queue workspace (spec §7 C0 + C1) — `/admin/review`

Replace the frame page with the workspace:

- **Queues, fixed order** (decision urgency, spec C0): Duplicate
  varieties · Seller candidates · Queued listings · Reports. The
  queue switcher (iPad/desktop: the list column's header; phone:
  the C0 index surface) shows each queue's live waiting count.
  The Review nav badge total (Slice 0's `totalWaiting`) now
  includes duplicate holds.
- **Master–detail** per spec §4: iPad/desktop list column
  (340–360px, independently scrolling, search-free — queues are
  processed, not searched) + detail pane; phone degrades to
  list → detail with in-place advance ("next item replaces the
  detail content"). Deciding an item advances the pane to the
  next waiting item; the pane header shows "3 of 8" progress.
- **Lists are oldest-first** (the queue is a fairness device) and
  **windowed**: an initial window (your choice of size, ≤ 50)
  plus an in-place "Show more" that appends the next window —
  production has ~1,000 pending items in one queue; never render
  or ship the whole queue at once. Counts are always exact
  (from the same grouped stats the home cards use). List rows:
  item name in Card-head weight, one line of key facts, age in
  friendly words ("3 days"), source/confidence line where the
  payload carries it.
- **Decided segment**: a "Decided" toggle at the list head
  switches the column to decision history for that queue —
  item, outcome in plain words, decider name, friendly time —
  read-only, paginated (the site's `Pagination` component).
- **Deep links**: every item is addressable by a stable URL that
  lands on that item in its queue after sign-in (Slice 0's
  return-path flow already preserves destinations). If the item
  was decided meanwhile, land on its queue with the A5 status
  wording: "That one was already decided by {name}."
- **Feedback** (spec §10.4): every decision resolves to a
  `role="status"` line in the pane naming the outcome in the
  consequence panel's own words; the item leaves the waiting
  list; counts and the nav badge update. **No Undo in Slice A**
  (Hue's resolution of spec §15.10: none of these decisions is a
  pure state change — approvals publish/create, duplicate
  decisions merge; the status line simply omits Undo, as the
  spec permits). All-clear state per queue: stem divider,
  "Nothing waiting in {queue}.", link to the next non-empty
  queue. Loading = skeletons under the site's delayed-reveal
  rule; errors = the §10.2 pattern per pane with Retry.
- **Decision transport**: submissions go through
  admin-session-authorized route handlers (the Slice 0 sign-in
  routes are the pattern — including their origin checks) or
  server actions, whichever fits the codebase's existing shape;
  they call the service-layer effects, stamp the decider from
  the session, revalidate the public paths the service returns,
  and enforce role **server-side** (§6 below) — a hidden button
  is never the enforcement.

### 4. Seller candidates (spec §7 C2)

- One queue, two source-labeled streams folded together
  (spec §15.6): hunt `seller_candidate` review items and pending
  `farm_submissions`, interleaved oldest-first, each row and
  detail labeled with its source ("Found by the hunt" /
  "Add Your Farm submission").
- **Detail — hunt candidate**: name, source line, the proposal's
  fields (name, website, domain) presented as the record that
  approval will create.
- **Detail — farm submission**: the legacy page's proven
  **Submitted | Suggested** comparison (submitted values beside
  `suggested_fields`, each suggested value labeled "(suggested)")
  + the evidence panel (`draft_summary` / `draft_evidence`) on
  the leaf-50 ground labeled **"Draft summary — never published
  automatically"**. Links to the farm's site open in a new tab.
- **Decision bar (both roles)**: **Approve** (primary) /
  **Decline** (secondary → sheet with an optional reason field
  inside the sheet — never an open form; the reason is kept on
  the record). The consequence line above the bar is role-aware,
  verbatim per spec Finding 2 —
  Admin: "Approving creates this seller. They aren't listed
  publicly until you finish their details and Small Farm
  classification in Sellers."
  Reviewer: "Approving creates this seller. They aren't listed
  publicly until an admin finishes their details and Small Farm
  classification in Sellers."
- **Approve effects**: hunt item → service `approve`
  (creates the seller, `eligibility: "candidate"`). Farm
  submission → create the candidate seller from the submission
  (name = farm name, homepage = website, domain from the
  website; reuse `createCandidateSeller`), link
  `farm_submissions.seller_id`, mark the submission approved
  with `reviewed_by`/`reviewed_at` = decider. The system
  proposes the slug (the legacy raw slug field is gone).
  **Candidate state (§15.13, binding)**: a candidate seller is
  not publicly listed — no public page, absent from directory
  and search — until Slice B completes its details +
  classification. The existing `eligibility: "candidate"` is
  the mechanism (publishing already refuses non-approved
  sellers); verify this holds for seller pages/search and test
  it. Success line: "Seller created — finish their details in
  Sellers" + a deep link to the Sellers section.
- **Out of Slice A scope here**: farm-owner flagging semantics
  do not change (the legacy page keeps that job until Slice C's
  G2); a farm approval in this queue does not set or revoke
  `is_farm_owner`.

### 5. Queued listings (spec §7 C3)

- Covers `listing_match` + `new_variety` items (the home card
  already groups them as "Queued listings").
- **Detail**: two stacked fact blocks with a visible "matched
  to" connector — **The listing** (seller name + `SmallFarmBadge`
  if classified, product title as listed, product URL as an
  outbound link in a new tab, packet sizes if captured) and
  **The variety** (name, crop, series, current seller count,
  links to its public page). For `new_variety`, the variety
  block shows the variety that approving will create (extracted
  name + crop). **Why the machine matched it** line, in plain
  words from `proposal.match` (method, confidence, candidates) —
  crop agreement is always stated explicitly (it is the
  directory's known failure class).
- **Decision bar (both roles)**: `listing_match` → **Publish
  listing** (primary; service `approve`) / **Reject**
  (secondary → sheet, optional reason: wrong variety / not
  seed / dead link / other; the reason is kept on the record).
  `new_variety` → **Add the variety** (primary; service
  `approve` creates the variety + publishes) / **Reject** (same
  sheet). Consequence line for publish: "Publishing puts this
  listing on {variety}'s public page, linking to the seller's
  product page."

### 6. Duplicate varieties + the scout-holds feed (spec §7 C4, §13.5, §15.3)

**The feed.** Holds arrive as `duplicate_hold` review items.
Payload (JSON in `proposal`):

```json
{
  "held_name": "Chantilly Pink",
  "crop": "snapdragon",
  "seller_id": 12, "seller_slug": "geoseed",
  "listing": { "productUrl": "…", "titleRaw": "…", "availability": "in_stock", "checkedAt": "…" },
  "candidate": { "variety_id": 123, "name": "Chantilly Light Pink", "slug": "…" },
  "evidence_quote": "…",
  "hold_reason": "…",
  "source": "scout"
}
```

- A creation path on the key-based admin API (extend the
  `[...path]` surface + service): authenticated like the other
  admin writes, validates the payload (candidate variety must
  exist and be active; seller must exist), and is **idempotent**
  on (normalized held name + candidate variety id): re-submitting
  a hold that is already pending returns the existing item
  instead of creating a duplicate. Document the endpoint +
  payload in the PR body — after deploy, the coordinator will
  submit the six existing holds from
  `crawl-daily/VARIETY-PROPOSALS.md` through it, and the scout
  job will target it from then on.
- `group_key`: the normalized held name (the ingest service's
  existing convention).

**The C4 view.** Two `ComparePanel`s — **held variety first,
existing variety second; the order never swaps** — side by side
on iPad landscape/desktop, stacked on phone/iPad portrait with
the sticky mini-summary ("Comparing: 'Chantilly Pink' ↔
'Chantilly Light Pink'"). Each panel: name (Section head),
crop + series line, botanical name where the catalog carries
it, who sells it (seller names + listing evidence: product
titles + outbound links), and for the existing variety: seller
count, current alternate names, link to its public page. The
**comparison strip** states neutral computed verdicts with
icons ("Same crop: Snapdragons" / "Names differ by one word" /
"Sold by 2 of the same sellers") — facts computed from the
record; the design takes no side.

**Decisions (both roles — binding).** Two **equal-weight
secondary buttons** — deliberately neither is primary:
**"It's a duplicate"** and **"Not a duplicate"**. Tapping either
opens its consequence inline (an expanding panel in the pane,
not a modal — the comparison stays visible):

- Duplicate: "'{held}' will be kept as another name for
  '{existing}'. It will still turn up in search, its listings
  move to that variety, and the scout won't propose it again."
  + **Confirm: mark as duplicate** (primary weight now) + Back.
  On confirm: publish the hold's listing onto the candidate
  variety with `publishProposal`'s guards and effects (seller
  approved, domain not blocked, variety active; match method
  "human", confidence 1; waitlist notify); add the held name
  as an alias on the candidate variety (kind `synonym`,
  `name_normalized` via `lib/names` `normalizeName` — this is
  what public search matches and what the scout's duplicate
  check matches, so the name is never re-proposed) **with
  provenance**: `source = 'duplicate_decision'`,
  `decision_item_id` = this item, `decided_by_name`,
  `created_at`. If that alias already exists on the variety,
  do not duplicate it (the PK forbids it) — fill provenance
  if absent. Resolve the item `merged` + decider.
- Not a duplicate: "'{held}' will be added as its own variety,
  with its listings. It gets its own public page." +
  **Confirm: add the variety** + Back. On confirm: create the
  variety from held name + crop (existing `createVariety`),
  publish the hold's listing onto it, resolve `approved` +
  decider.
- **Skip for now** (text link under the pair): stamps
  `seen_by_name` / `seen_at`, leaves the item pending, advances
  to the next hold. Skipping is recorded as seen, never as
  decided.
- Success wording mirrors the consequence panel ("Kept as
  another name for '{existing}'"), then advance. Edge: if the
  candidate variety was merged/renamed meanwhile, reload the
  pane with a status line and the fresh state — never a dead
  end.

**RA-1 (binding)**: an alias created by a duplicate decision
carries its provenance permanently; nothing in Slice A may
remove or edit aliases (the F2 management UI is Slice C, where
decision-created aliases render non-removable — your
provenance columns are what makes that enforceable).

**Home card**: `queueCards()`' duplicates card stops being a
hard-coded zero — count + oldest come from pending
`duplicate_hold` items; `totalWaiting` includes them.

### 7. Reports (spec §7 C5, as amended by RA-3)

Covers `seller_correction` + `removal` items. **Detail**:
report type as the pane title ("Seller correction", "Removal
request", …), the reporter's words in full, what it concerns
(seller/variety/listing card with links), and — when the
proposal carries structured fields — the **Reported |
Currently shown** comparison (suggested field values beside
the seller record's current values).

Actions:

- **Dismiss** (both roles): service `reject` (closes the
  linked report dismissed) + decider; optional reason in its
  sheet, as C2/C3.
- **Structured seller correction → Apply the correction**
  (both roles, identical — Dustin's ruling, RA-3): service
  `approve` applies the fields immediately; there is no
  verify-then-wait state. The decider stamp is the audit
  record ("applied on approval by {name}" — Recent decisions
  and the Decided segment render it that way).
- **Removal request (seller target) → Apply removal is
  Admin-only**: the service `approve` removal flow, behind
  the §10.1 destructive confirm (danger-token verb button,
  consequence naming the seller + listing count). Reviewer:
  the action is **absent**, and the handler refuses it
  server-side regardless (§8).
- **Listing problem identifying a specific listing → Retire
  the listing is Admin-only**: §10.1 confirm **with the
  reason select inside it** (Wrong variety / Not seed / Dead
  link / Duplicate listing / Other + optional note) →
  existing `removeListing` effect → the report resolves with
  decider. If the report names no specific listing, this
  action is absent (nothing to route to).
- **Confirm report** (Reviewer, on any report whose remedy
  they cannot apply — removal requests, listing problems,
  free-form corrections): stamps `verified_by_name` /
  `verified_at`, leaves the item **pending**, and the item
  thereafter shows "Verified by {name} — waiting for an
  admin" in its row and detail. Admins don't get this action
  (they can act). Free-form corrections (no structured
  fields — the current production shape) offer Admins
  Dismiss only, plus Confirm report is Reviewer-only as
  above; an admin who wants the correction applied edits the
  seller from the record (Slice B) — the report view links
  to the seller's public page and says so plainly.
- **Variety-target removal reports**: no apply action for
  either role in Slice A (variety removal is Slice C's path);
  Dismiss + Confirm report only, with the line that variety
  removals are handled from the variety's record.

### 8. Role enforcement (spec §5 + §11 — server-side, tested)

Rendering follows §5: **Act = absent** (a control the role can
never use is not rendered), **View = read-only render**. On top
of rendering, every decision handler authorizes independently:

- Both roles may: approve/decline seller candidates, publish/
  reject queued listings, decide duplicates (both outcomes +
  skip), dismiss reports, confirm reports, apply structured
  seller corrections.
- Admin only: apply a removal, retire a listing from a report.
  A reviewer request to either is refused (403, no state
  change, no partial effect) even with a hand-crafted request.
- Every decision stamps its decider; a decision attempted on
  an already-decided item resolves through the A5 wording,
  never a raw error (§10.2: no API messages or HTTP codes in
  the UI).

### 9. Home — Recent decisions in plain words (Slice 0 note N3)

With the decider recorded, home's Recent decisions rows read
as spec §7 B requires: "{Name} approved {item}" / "{Name}
marked '{held}' a duplicate of '{existing}'" / "{Name} applied
a correction to {seller}" + friendly time — the item label
derived from the proposal (seller name / variety name /
report target), never bare log-speak ("Approved seller
candidate #12") when a label exists. Role-change rows keep
their current wording.

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
- **No open forms** (spec §10.3): reasons live inside their
  sheets/confirms; decision bars are the pane's work surface
  (the spec's stated exception); a search field exists nowhere
  in the queues (they are processed, not searched).
- **Dates are friendly, never ISO**, anywhere in admin
  (spec §2.9). Counts use tabular figures. No state by color
  alone. US spelling in all copy. Targets ≥ 44×44px.
- **No public changes** (spec §13.7): no public page, public
  API shape, or badge behavior changes. The only public-side
  effects are the decisions' intended data effects (a listing
  publishes, a variety is created, an alias becomes
  searchable, a seller is removed).
- **Components**: build on Slice 0's (`Sheet`, `ConfirmDialog`,
  `BusyForm`, `QueueCard`, `RoleChip`) and the site layer
  (`.btn`, `.card`, `.chip`, `Pagination`, `SmallFarmBadge`,
  friendly-date formatting). New components per spec §9 as
  needed (`MasterDetail`, `DecisionBar`, `ComparePanel` +
  `ComparisonStrip`, `ConsequencePanel`, `StatusBanner`) with
  the same token discipline. The `danger` token (#8F1D12) is
  used ONLY for the verb button inside destructive confirms.
- **Accessibility floor** (spec §12): focus trapped in
  sheets/dialogs with return-to-opener; safe action takes
  initial focus in destructive confirms; decision outcomes
  announced via `role="status"`; master–detail selection uses
  `aria-current`; targets ≥44px; reduced-motion collapses
  transitions via the site's global rule.

## Tests (required — the gate checks these exist and pass)

- Migration 0013 losslessness: seeded `review_items` rows
  (all five existing types, mixed statuses) survive the rebuild
  with identical ids/values; new columns default NULL.
- Decider stamping: UI-path approve/reject stamps decider id +
  name + resolved_at together; API-path resolution leaves the
  decider NULL and otherwise behaves identically.
- Duplicate decision — duplicate outcome: alias exists on the
  candidate variety with `name_normalized` correct,
  provenance `source='duplicate_decision'` + decision item id
  + decider; the hold's listing is published on the candidate
  variety; item status `merged`; the alias is findable through
  the public search repository (the FTS alias match).
- Duplicate decision — not-a-duplicate outcome: variety
  created from held name + crop, listing published on it,
  item `approved`.
- Duplicate feed endpoint: creates a pending `duplicate_hold`;
  re-submitting the same (held name, candidate) returns the
  existing item (no second row); invalid candidate/seller
  refused.
- Reviewer powers: a reviewer session CAN approve a seller
  candidate, publish a listing, decide a duplicate both ways,
  apply a structured seller correction (fields actually change
  on the seller record), dismiss and confirm a report.
- Reviewer limits at the handler: a reviewer removal-approve
  and a reviewer retire-from-report are refused with no state
  change.
- Structured correction by a reviewer applies immediately
  (RA-3) and the item's decider is the reviewer.
- Confirm report: stamps verified_by/at, item stays pending,
  verified line renders.
- Candidate state: an approved candidate seller has no public
  page and does not appear in public search/directory queries.
- Home counts: duplicates card equals the real pending
  `duplicate_hold` count (seed holds → card reads that number,
  oldest age correct); `totalWaiting` includes them.
- Windowed list: the queue list query returns at most the
  window size with exact total counts, oldest-first, stable
  across windows (no item repeated or skipped).
- Public payloads: no decider/provenance fields in public
  variety/search/snapshot payloads.
- The Slice 0 suite keeps passing untouched in spirit — if a
  Slice 0 test must change because the frame page it asserted
  is now the real workspace, update it to assert the workspace
  behavior and say so in the PR body.

## Out of scope (do not build)

- Sellers section screens (Slice B: D1–D5 incl. edit sheets,
  classification, notes).
- Listings / Varieties / Accounts management screens (Slice C:
  E1/E2, F1–F3, G1/G2) — including F2 alternate-name management
  and the variety-remove path.
- Statistics section (Slice D) and Web Analytics wiring.
- Retiring legacy `/admin/waitlist`.
- Undo for decisions (omitted deliberately — see §3).
- Re-pointing a `listing_match` to a different variety from
  the UI (the service `merge` stays API-only for Hue).
- Farm-owner flag changes from the review queue.
- The scout job's own instructions (its submission change is
  an ops follow-up once the feed endpoint exists).

## Finish line

- Full `npm run verify` green in-session (your own loop, §"How
  you work"), full-tree `npx eslint .` green.
- The PR body states: what was built per queue; the feed
  endpoint + payload documentation; any Slice 0 test you had
  to update and why; the migration's contents; test count.
  (The workflow's auto PR title/body are a known wart — write
  the real summary in the PR body regardless.)
