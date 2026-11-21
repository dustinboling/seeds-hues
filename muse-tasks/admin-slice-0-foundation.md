# Task: Seed Directory admin section — Slice 0 (foundation: roles, admin sign-in, shell)

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

  (lint + typecheck + vitest). Dependencies are already installed
  (`npm ci` was run in `v2/` before you started). **All of it must
  pass.** Add tests for the new behavior (see below).
- D1 migrations live in `v2/` following the existing numbered sequence
  (the latest is 0011). Your migration is next in sequence.

## Source of truth

The design spec is committed in this repo at **`admin-design/SPEC.md`**
(Nadia, UX/UI; passed Quinn's design gate and delta re-gate —
`admin-design/QUINN-GATE.md`, `admin-design/QUINN-DELTA-GATE.md`).
The owner's settled decisions are in **`ADMIN-SECTION.md`** at the repo
root. Where this task file and the spec disagree, the spec wins; where
the spec and ADMIN-SECTION.md disagree, ADMIN-SECTION.md wins.

**Implement only the sections named below.** The rest of the spec is
built by later slices — do not build ahead.

## What exists today (audit summary from the spec, §1)

- Visitor accounts exist (name + email + phone + ZIP, no password).
  The live visitor sign-in is email + phone number; 6-digit codes are
  used only to verify an email/alert number at signup. There is an
  existing code-issuance/verification plumbing for those signup codes —
  find it and reuse its mechanics where the spec's admin flow calls
  for a code.
- One legacy admin surface: `/admin/waitlist`, gated by an API-key
  cookie (`v2/lib/admin-session.ts`, ~8-hour session). **Leave it
  fully working and untouched in this slice** — it retires in a later
  slice once the new section covers its jobs.
- Review queues already exist in the database (`review_items` and
  related tables) with no screen. The dashboard home in this slice
  reads their counts; the decision screens themselves are Slice A.

## Scope — Slice 0 only

### 1. Roles on accounts (spec §5, §6, §11)

- Migration: add a role to the accounts table — `visitor` (default),
  `reviewer`, `admin` — plus whatever audit-trail storage the spec's
  §6 data notes require for role changes, if none exists yet. Read
  the existing schema first and reuse what is there.
- Server-side role resolution for the signed-in account. Role is
  never trusted from the client.
- **First-admin promotion:** do NOT hardcode any email or person in
  code. In your PR description, provide the one-off SQL the operator
  will run against production D1 to promote the owner's existing
  account (matched by email) to `admin`, and note that demoting the
  last admin must be impossible (the guard itself is built with the
  Accounts UI in Slice C; the data layer must not prevent it).

### 2. Admin sign-in (spec §7 A) — email + code, 7-day session

- A dedicated admin sign-in at `/admin/sign-in`: email → 6-digit code
  → admin session. This is deliberately separate from, and stronger
  than, the visitor sign-in (owner's ruling).
- Only accounts whose role is `reviewer` or `admin` may complete
  admin sign-in; a visitor-role account gets the spec's designed
  refusal (no admin access), worded per spec.
- The admin session is a **distinct session** from the visitor
  session (separate cookie/scope): a visitor session alone never
  grants admin access, and an admin session lasts **7 days** per the
  spec. Follow the spec for code expiry, attempt limits, and the
  signed-out/expired states.
- Sign-out for the admin session.
- Every `/admin/*` route (except the sign-in flow itself) is guarded
  server-side: no valid admin session → redirect to `/admin/sign-in`.

### 3. The admin shell (spec §3, §4, §10, §12)

- The shell exactly as spec'd: iPad-first bands (§4 as amended —
  **1180px belongs to the iPad band; desktop starts at 1181px**),
  left rail at ≥744px, phone bottom tab bar below that, master–detail
  is the default pattern for the list sections (built by later
  slices; the shell must support it).
- Navigation per spec §4/§7 B: Dashboard, Review, Sellers, Listings,
  Varieties, Accounts. **Role rendering rule (§11) is binding:
  Act = absent, View = read-only.** For a Reviewer, **Accounts is
  absent from navigation entirely**, and any control outside the
  Reviewer column of the §11 matrix is absent — never rendered
  disabled. (In this slice most sections are frames; the rule still
  applies to the navigation and to anything the home renders.)
- Design tokens per §3.1 **including the new admin-only `danger`
  token** (candidate #8F1D12 as recorded in the spec — define the
  token with that value; a later token pass may adjust it). No new
  palette beyond the spec's tokens.
- Shared patterns from §10 that the shell needs now: the sheet/pop-up
  pattern (no open forms anywhere in admin — creation/editing lives
  behind a button; the sign-in flow, a single search field, and
  filter chips are the spec's only exceptions) and the §10.1 confirm
  pattern (destructive verb button filled with the `danger` token,
  always paired with its verb label). Later slices will reuse these;
  build them as shared components.
- Accessibility is a floor, not a pass (§12): focus management for
  sheets/confirms, focus never obscured, targets sized per spec,
  keyboard walk for the shell.

### 4. Dashboard home frame (spec §7 B)

- The home renders its designed structure: the "Needs a decision"
  queue cards with **real counts from the existing review queues**
  and oldest-item age where the data supports it, including the
  designed "All clear" zero state; the stats snapshot band in its
  composed form (the full statistics wiring is Slice D — where a
  card's data source is not yet wired, render the spec's designed
  no-data state rather than inventing numbers); "Recent Decisions"
  reads the audit trail if role/queue decisions are recorded there,
  otherwise its designed empty state.
- Queue cards link to their section routes (the decision screens
  arrive in Slice A; the link target existing as a shell frame is
  enough for this slice).
- Sections other than Dashboard render the shell with a plain,
  honest interim line that the section arrives in a later build
  slice. Do not invent designed content for them.

## Hard boundaries

- **No queue decision logic** (Slice A), **no seller editing,
  classification, or notes** (Slice B), **no listings/varieties/
  accounts management UI** (Slice C), **no statistics section or
  analytics wiring** (Slice D). Do not build ahead.
- **Public site unchanged:** no public page, public API response, or
  search-index payload may change, and nothing admin-related (roles,
  notes, internal data) may appear in any of them.
- Admin data is served only through admin-authorized endpoints /
  server components behind the admin session guard — never through
  the public API.
- The legacy `/admin/waitlist` page and its API-key session keep
  working exactly as today.
- No copy changes anywhere outside the spec's admin wording.

## Tests to add

- A visitor-role account cannot complete admin sign-in and cannot
  load any `/admin/*` route (redirected to sign-in).
- A reviewer-role and an admin-role account can complete the
  email + code flow; the issued admin session is distinct from any
  visitor session (a visitor session cookie alone does not open
  `/admin`).
- Admin session expiry is 7 days (assert the configured lifetime).
- Navigation rendering by role: Accounts absent for Reviewer
  (rendered-output assertion, not just a config check).

## Deliverable

A pull request against `main` with: the migration, the role/session
layer, the shell, the dashboard home frame, and the tests above —
`npm run verify` fully green. In the PR description: what was built,
the first-admin promotion SQL for the operator, and anything in the
spec's foundation sections you found impossible or contradictory
(flag it plainly; do not improvise around it).
