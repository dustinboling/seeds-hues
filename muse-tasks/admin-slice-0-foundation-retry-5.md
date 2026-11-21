# Task: Seed Directory admin section — Slice 0 (foundation) — RETRY 5

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
  below).
- D1 migrations live in `v2/` following the existing numbered sequence
  (the latest is 0011). Your migration is next in sequence.

## Why this is retry 5 — read this first

Five previous runs implemented this slice and **every one failed the
`npm run verify` gate**, so no PR was created any of the five times
and every run's changes were discarded whole. Each run failed on
exactly **one** thing, and each time it was a **different** thing:

- Run 1 — lint: refs during render.
- Retry 1 — lint: setState synchronously within an effect.
- Retry 2 — lint: children passed as a prop, in a test file.
- Retry 3 — lint and typecheck fully green; ONE test failed: the R4
  policy guardrail (a scope collision, since decided — see "The
  retry-4 change" below, carried verbatim; apply it exactly).
- Retry 4 — lint fully green; typecheck failed on ONE error: a
  dangling import of a component the run never created. Because
  typecheck runs before vitest, the test suite never ran, so retry
  4's R4 guardrail change is **unverified** — neither passed nor
  failed, simply unreached.

The pattern across all five runs is the real problem: **each run
ended its turn without its own `npm run verify` ever having passed.**
Naming one more trap is not the fix. Retry 5 changes the loop you
work in — see the next section. It is the core change in this brief.

The five failures, verbatim:

**Run 1 (44840836483) — refs during render:**

```
/v2/components/admin/Sheet.tsx
  27:3  error  Error: Cannot access refs during render
```

Rule: `react-hooks/refs`. The shared `Sheet` component (the
pop-up/sheet pattern) read a ref value during render.

**Retry 1 (44845287119) — setState synchronously within an effect:**

```
/v2/components/admin/AdminSignIn.tsx
  33:17  error  Error: Calling setState synchronously within an effect can trigger cascading renders

  31 |     try {
  32 |       const last = window.localStorage.getItem(LAST_EMAIL_KEY);
> 33 |       if (last) setEmail(last);
     |                 ^^^^^^^^ Avoid calling setState() directly within an effect

  react-hooks/set-state-in-effect
  ✖ 1 problem (1 error, 0 warnings)
```

The admin sign-in's "remembered email" prefill read
`window.localStorage` inside a mount effect and called the state
setter synchronously in the effect body.

**Retry 2 (44869539878) — children passed as a prop, in a TEST file:**

```
/v2/tests/unit/admin-shell.test.ts
  15:5  error  Do not pass children as props. Instead, pass them as additional arguments to React.createElement  react/no-children-prop

  ✖ 2 problems (1 error, 1 warning)
```

Rule: `react/no-children-prop`. A test helper passed `children`
inside a props object. The same run's lint output also carried one
warning in the slice's code —
`@next/next/no-location-assign-relative-destination` (do not use
`window.location.assign()` to navigate to internal Next.js pages).
Warnings do not fail the gate, but do not reproduce it: use
`redirect()` in server/render code or `useRouter().push()` in client
event handlers for internal navigation.

**Retry 3 (44871983483) — lint and typecheck fully green; ONE test
failed, the R4 policy guardrail:**

```
 FAIL  tests/unit/guardrails.test.ts > policy guardrails > no Product / Offer / AggregateRating / FAQPage / Review / priceValidUntil outside the prohibition list (R4)
AssertionError: expected [ …(2) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "app/admin/(protected)/review/page.tsx",
+   "lib/admin-auth.ts",
+ ]

 ❯ tests/unit/guardrails.test.ts:136:7
```

Test files 1 failed | 23 passed; tests 1 failed | 421 passed (422).
The slice's two new files contain the literal `"Review"` — the admin
Review section label — and trip the SEO prohibition scanner. The fix
direction was decided by the project lead; it is specified in full
under "The retry-4 change" below and carried into this brief
unchanged.

**Retry 4 (44874194478) — lint fully green; ONE typecheck error, a
dangling import:**

```
components/admin/AdminShell.tsx(3,30): error TS2307: Cannot find module './AdminSignOut' or its corresponding type declarations.
```

The run's `AdminShell.tsx` imports a `./AdminSignOut` component it
never created — an incomplete implementation, not a lint rule or a
policy collision. The test suite never ran (verify order is lint →
typecheck → vitest), so the R4 change above is still unverified.

## THE CORE CHANGE — the fix-and-rerun loop (read this twice)

This is the requirement that defines retry 5. Everything else in
this brief is the same slice the previous runs attempted; this loop
is what makes this run different.

- **Before you end your turn, run the full `npm run verify` yourself,
  from `v2/`.** Not a subset, not the files you touched — the whole
  thing: lint + typecheck + the full vitest suite.
- **On ANY failure: fix the cause, then re-run the FULL
  `npm run verify` from the top.** Not just the step that failed —
  fixes move errors between steps (retry 3 was lint-green and died
  in tests; retry 4 was lint-green and died in typecheck). A partial
  re-run proves nothing.
- **Repeat until `npm run verify` is completely green** — zero lint
  errors, zero type errors, zero failing tests, across the entire
  tree.
- **Ending your turn with a failing verify, or with a verify you
  never ran, is a failed run — regardless of how good the code looks
  or how much of the slice is built.** The workflow gate after your
  turn runs the same command; if it is red, your changes are
  discarded whole, exactly like the five runs before this one. There
  is no partial credit and no "one error left" exception.
- Per-file checks while you work (`npx eslint <file>`,
  `npx tsc --noEmit` after each edit) are good practice and expected
  — but they are *in addition to* the loop, never a substitute for
  it.
- If your in-session shell is broken (a known sandbox issue) so you
  genuinely cannot execute the loop, say so plainly in your summary
  — do not silently skip it.

## Pre-flight checklist — check ALL of these BEFORE your first verify run

Walk this list against your finished implementation before you run
verify the first time. Every item on it has already killed a run.

1. **No dangling imports (retry 4's failure).** Every relative import
   in every file this slice creates resolves to a file this slice
   actually creates. If a component imports `./AdminSignOut` (or any
   sibling), that file exists, exports what is imported, and is part
   of this slice. Sweep every `import` statement in the slice's
   files — components, app routes, lib, AND tests — and confirm each
   target exists. Do not reference a component, helper, or module
   you have not written.
2. **Children are JSX children, never a prop (retry 2's failure).**
   In JSX: `<Shell>{content}</Shell>` — never `children={...}` and
   never a `children` key in a props object. With
   `React.createElement`, children are the trailing argument(s):
   `createElement(Shell, props, content)` — never
   `createElement(Shell, { ...props, children: content })`. This
   applies to test helpers exactly as much as to components:
   `eslint .` lints `tests/` too.
3. **No setState in any effect body, anywhere in this slice (retry
   1's failure).** State initialises from props / server-provided
   values only. Browser-only external state (localStorage and the
   like) is read through **`useSyncExternalStore`** — server snapshot
   returns the empty/default value, client snapshot returns the
   stored value — so SSR and hydration render identically and the
   value swaps in with no effect and no setState. This pattern is
   already proven in this codebase: see `useHydrated()` in
   `v2/components/variety/SellerFilterSection.tsx`. `setState`
   belongs in event handlers and in event/subscription callbacks
   only — never synchronously in an effect body. An effect may
   subscribe; the callback may set state.
4. **Refs only inside effects and event handlers (run 1's failure).**
   Never during render, never in a value computed for JSX. The
   standard pattern for the `Sheet` component: when the sheet opens,
   an effect captures `document.activeElement` (into a ref) for
   later restoration and moves focus into the sheet; on
   close/unmount, an effect or handler restores focus.
   Initial-focus targets are applied in an effect after mount, not
   read during render.
5. **The R4 guardrail scope (retry 3's failure).** The slice's admin
   files legitimately contain the literal `"Review"`. Do NOT rename
   or contort admin UI copy or code to avoid it. Instead implement
   the scoped admin-tree exclusion in
   `v2/tests/unit/guardrails.test.ts` exactly as specified in "The
   retry-4 change" section below — including both proof cases, and
   keeping `guardrails.test.ts` itself lint-clean and type-clean
   under `noUncheckedIndexedAccess`.
6. **Standing repo traps.** TypeScript runs with
   `noUncheckedIndexedAccess: true`: indexing an array/object yields
   `T | undefined` — guard indexed access (this exact issue failed a
   sibling task's tests with TS2345). Never disable a lint rule, add
   an `eslint-disable` comment, or restructure to hide an access —
   fix the data flow instead. No
   `window.location.assign()` for internal navigation (use
   `redirect()` server-side or `useRouter().push()` in client
   handlers).

**The section that follows is carried verbatim from the retry-4
brief.** Retry 4's run failed at typecheck before the test suite
ran, so this change has never been verified — implement it exactly
as written.

## The retry-4 change — the R4 guardrail gains a scoped admin-tree allowance (DECIDED — apply exactly)

R4's purpose is keeping structured-data tokens out of **public**
pages: only `lib/seo/jsonld.ts` may name them, so no public page,
serializer, or payload can smuggle Product/Offer/Review JSON-LD into
the site's structured data. The admin tree is authenticated and
non-indexed — tokens in admin UI code carry zero SEO risk — while
renaming admin vocabulary to dodge a scanner would keep biting
forever. **The decision: the R4 scan excludes the admin tree, and
nothing else changes.** Apply it precisely:

The current R4 test (`v2/tests/unit/guardrails.test.ts`) is:

```ts
it("no Product / Offer / AggregateRating / FAQPage / Review / priceValidUntil outside the prohibition list (R4)", () => {
    expect(
      offenders(RUNTIME, /AggregateRating|AggregateOffer|FAQPage|priceValidUntil|"Review"|"Product"|"Offer"/, ["lib/seo/jsonld.ts"]),
    ).toEqual([]);
  });
```

Required change, confined to `v2/tests/unit/guardrails.test.ts`
(test code only — **no runtime code changes for this fix**):

1. **Exclude exactly the admin tree from the R4 scan's file list** —
   paths under `app/admin/`, paths under `lib/admin/`, and top-level
   `lib/admin-*.ts` / `lib/admin-*.tsx` files. Implement it as a
   named path predicate (e.g. `isAdminTree`) applied to the file
   list for the R4 check only. Near-misses must NOT be excluded:
   `lib/admin.ts` (no dash suffix) is not admin-tree, and
   `app/administrator/…` is not `app/admin/`.
2. **Nothing else about R4 changes:** the token regex is unchanged,
   the `lib/seo/jsonld.ts` allow-list is unchanged, no public path
   is excluded, and **every other guardrail keeps scanning the full
   runtime tree including the admin files** — only the R4 check gets
   the scoped file list. Do not widen any scan set either:
   `guardrails.test.ts` itself holds the token literals and is not
   part of the R4 scan set today; it must stay out.
3. **Add guardrail test cases proving both halves of the scope:**
   - (a) *Admin tokens no longer trip — and the exclusion is what
     saves them.* Scan the admin files this slice actually creates
     (at minimum `app/admin/(protected)/review/page.tsx` and
     `lib/admin-auth.ts`, which contain `"Review"`): WITH the
     exclusion applied they produce no offenders, and WITHOUT the
     exclusion the same scan DOES return them as offenders (the
     scanner is not vacuous — the token is really there).
   - (b) *Public tokens still trip.* The predicate rejects
     representative public paths (e.g. `app/variety/[slug]/page.tsx`,
     a `components/…` path, `lib/seo/jsonld.ts`, plus the near-miss
     `lib/admin.ts`), and the scanner still flags a token-bearing
     public file when it is not allow-listed (e.g. running the R4
     offenders check over `lib/seo/jsonld.ts` without its allow-list
     entry returns it as an offender).
4. **Do NOT rename or contort admin UI copy or code to avoid the
   word "Review"** (or any other token). The admin section is called
   Review; the code keeps saying so. The fix lives entirely in the
   scanner's scope.
5. Keep `guardrails.test.ts` itself lint-clean and type-clean — it
   is inside the `eslint .` tree and the typecheck, under
   `noUncheckedIndexedAccess`, like everything else.

## The hard finish requirement

The fix-and-rerun loop above IS the finish requirement. Restated as
the gate you must clear:

- After each file you edit, run the targeted check for that file
  (`npx eslint <file>` and/or `npx tsc --noEmit` from `v2/`).
- Walk the pre-flight checklist in full before your first complete
  verify run.
- Then run, from `v2/`, BOTH of these, in full:
  1. `npx eslint .` — the full tree, not just the files you touched.
  2. `npm run verify` — lint + typecheck + vitest, the whole suite.
- **If either is red: fix the defect and re-run the FULL
  `npm run verify` from the top. Repeat until both are fully green
  across the entire tree** — zero errors, zero failing tests. You
  may not end your turn on a red check, and you may not end your
  turn having never run them. A run that ends red is discarded
  whole, exactly like the five runs before this one.
- Fix **every** lint error in the files this slice creates or touches
  (components, app routes, lib, AND tests). If the full-tree pass
  surfaces errors in **unrelated pre-existing files** — files this
  slice did not create or touch — do NOT rewrite unrelated code;
  instead list those errors verbatim in your PR description under a
  "Pre-existing lint errors (not this slice)" heading.
- If your in-session shell is broken (a known sandbox issue), say so
  plainly in your summary — the workflow gate is the deciding check
  either way.

**Scope note for later slices — no work now:** Slice C (listings,
varieties, accounts) will additionally carry a **variety-remove
path**, approved by the owner on 2026-11-20 after a phantom variety
was found in the catalog with no way to remove its record; the
decision and its guardrails are recorded in `ADMIN-SECTION.md`
("Scope addition — VARIETY-REMOVE path"). That is Slice C work — do
NOT build it in this slice, and do not build ahead anywhere else
either. Equally, nothing in Slice 0's data layer should foreclose
it: do not bake in assumptions that catalog records are immortal.

Everything below is the original task, unchanged.

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
- The R4 guardrail scope cases from "The retry-4 change" above:
  (a) admin-tree tokens excluded, proven non-vacuous against the
  slice's real admin files; (b) public-path tokens still trip,
  including the near-miss paths.

## Deliverable

A pull request against `main` with: the migration, the role/session
layer, the shell, the dashboard home frame, the scoped R4 guardrail
change with its proof cases, and the tests above — `npm run verify`
fully green. In the PR description: what was built, the first-admin
promotion SQL for the operator, anything in the spec's foundation
sections you found impossible or contradictory (flag it plainly; do
not improvise around it), and — per the hard finish requirement
above — any pre-existing lint errors in unrelated files, listed
verbatim under "Pre-existing lint errors (not this slice)".
