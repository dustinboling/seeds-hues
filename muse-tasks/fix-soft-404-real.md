# Task: Fix soft-404 on seller and crop pages — the REAL fix (streaming root cause)

You are working in the `seeds-hues` repository (the Seed Directory,
seeds.hues.flowers). This prompt is self-contained — do not assume any
other context.

## Orientation

- The live app is the **Next.js app in `v2/`** (Next 16, React 19,
  deployed with @opennextjs/cloudflare). Run all commands from `v2/`.
- The repository root also contains an `app/` directory — that is a
  **legacy static site**. Ignore it completely; do not read it for
  patterns and do not change anything in it.
- The repo's verification is, from `v2/`:

  ```
  npm run verify
  ```

  That runs lint + typecheck + the vitest suite (`v2/tests/`).
  Dependencies are already installed (`npm ci` was run in `v2/`
  before you started).
- This branch already contains the regression tests from the earlier
  PR #2 (commit "Muse: fix-soft-404.md": `v2/tests/unit/route-not-found.test.ts`
  plus one case in `v2/tests/integration/data.test.ts`). They are part
  of this change and must land with your fix — see "Tests" below.

## Problem — and the established root cause (do not re-litigate it)

- A non-existent seller slug — `/seller/<bad-slug>` — renders the
  seller "not found" page with **HTTP 200** instead of 404.
- A non-existent crop slug — `/crop/<bad-slug>` — renders the crop
  "not found" page with **HTTP 200** instead of 404.
- Non-existent variety and state slugs already return a correct 404.

A prior attempt (PR #2) added only the tests now on this branch and
changed **zero lines of route code**; the defect is still live. The
root cause has since been established and verified against production:

> `v2/app/seller/[slug]/loading.tsx` and `v2/app/crop/[slug]/loading.tsx`
> exist (segment loading skeletons). On these `force-dynamic` routes,
> the shell — layout + skeleton — streams out with HTTP 200 **before**
> the page's async catalog load throws `notFound()`, so the status can
> never become 404; the not-found UI streams into a 200 response.
> Smoking gun from production: the bad-seller 200 body contains the
> skeleton markup ("Loading seller…") ahead of the "Seller not found"
> content. `app/state/[slug]/` has **no** `loading.tsx` and 404s
> correctly; variety escapes only because it is ISR (its 404 is decided
> before streaming). The page components themselves already call
> `notFound()` correctly — the bug is purely that the segment
> `loading.tsx` flushes the shell first.

## Design ruling — B: rework, do not remove (verbatim, binding)

Two design specialists ruled on the skeleton tradeoff. Their rulings
and conditions are binding on this build:

**Nadia (UX — interaction semantics):**

> "Ship B: hoist the seller/crop existence check so it resolves before
> any shell streams, return a true 404 for unknown slugs, and demote
> the existing skeletons to inner Suspense fallbacks around the slower
> below-the-check sections only. B is acceptable only if exactly one
> sr-only `role="status"` polite 'Loading…' line is announced for the
> whole page — never duplicated by nested boundaries — and the
> pre-stream check adds no perceptible delay to first paint; if either
> condition cannot be verified, ship A instead."

**Mina (UI design):**

> "Hoist the seller/crop existence check so the 404 decision is made
> before any shell streams, and demote the existing tuned skeletons to
> inner Suspense fallbacks around only the below-the-check sections
> that actually stream late. Condition for acceptance: the demoted
> fallbacks must together reserve the original skeleton geometry with
> no layout shift on resolve, and the page must carry exactly one
> sr-only polite `role="status"` loading announcement in total —
> visual skeleton tree `aria-hidden`, no duplicated announcements from
> nested boundaries; if either fails verification on a throttled
> connection, B does not ship."

Option A (the fallback if B's conditions cannot be met): delete the
two segment `loading.tsx` files so seller/crop match the state route
exactly. If you ship A, say so plainly in your summary and state which
of B's conditions you could not meet.

## Implementation shape (expected pattern; equivalents allowed if every condition above is verified)

For each of `/seller/[slug]` and `/crop/[slug]`:

1. Remove the segment `loading.tsx` so nothing flushes before the
   page component runs.
2. Restructure the page component into an outer component + an inner
   content component:
   - The **outer** component awaits the existence check FIRST — the
     same cached catalog lookup the page already performs (seller:
     `load(slug)`; crop: parse filters — invalid filter params already
     `notFound()` — plus the crop lookup) — and calls `notFound()`
     when the entity does not exist. Nothing may be returned or
     streamed before this resolves. Keep the check light: it must add
     no perceptible delay to first paint (the lookups are single
     indexed catalog queries, already `cache()`-shared with
     `generateMetadata`).
   - The **inner** content component performs the full render from the
     loaded data and is wrapped in a `Suspense` boundary whose
     fallback is the page's existing skeleton tree — the same
     components (`LoadingShell`, bars, section skeletons) with the
     same geometry as today's `loading.tsx`, so the fallback reserves
     the original layout with no shift on resolve.
3. Exactly **one** `LoadingShell` (one sr-only `role="status"`
   announcement) per page in total; the visual skeleton tree stays
   `aria-hidden`. Do not nest additional `LoadingShell`s inside
   sections.
4. `generateMetadata` behaviour is unchanged (bad slug → "not found"
   title + `robots: { index: false }`).

## Tests

- The PR #2 regression tests on this branch
  (`v2/tests/unit/route-not-found.test.ts`, plus the added case in
  `v2/tests/integration/data.test.ts`) must pass and land with this
  fix. Their assertions may not be weakened: unknown seller/crop slugs
  must still be asserted to throw the 404 digest through the real page
  components, valid slugs must still be asserted to render, and the
  route-config pins must still guard the mechanism at equal strength.
- If the page restructure changes *how* the tests must render the page
  (e.g. awaiting the outer component), you may adapt the rendering
  mechanics and update source pins to the new mechanism — but every
  assertion's strength must survive, and your summary must say exactly
  what you adapted and why.

## Acceptance bar — real HTTP proof (component tests are NOT sufficient)

A green unit suite is what let the previous no-op "fix" through. This
defect is an HTTP status on a streamed response; it is proven only
over real HTTP.

1. `npm run verify` passes in full in `v2/`.
2. Build the production bundle and serve it locally:
   `npm run cf:build`, then serve with `npm run cf:preview`
   (port 8787). If the local D1 is empty, seed it first with
   `npm run db:setup:local`.
3. Run the acceptance suite against the local build:

   ```
   npm run acceptance -- --base http://localhost:8787 --skip-rate-limit --report tmp/acceptance-soft404.md
   ```

   Paste the report's full pass/fail counts and the not-found/status
   lines into your final summary. The suite asserts
   `GET /seller/does-not-exist → 404` and `GET /crop/does-not-exist → 404`;
   those must pass.
4. Also run these curl status checks against the local preview and
   paste the results verbatim:
   - `/seller/definitely-not-a-real-seller-xyz` → **404**
   - `/crop/definitely-not-a-real-crop-xyz` → **404**
   - `/seller/geoseed` → **200**
   - `/crop/dahlia` → **200**
   - `/variety/definitely-not-a-real-variety-xyz` → **404**
   - `/state/definitely-not-a-real-state-xyz` → **404**
   And confirm the bad-seller 404 body contains **no** skeleton markup
   (no "Loading seller…").
5. If the sandbox genuinely cannot serve the preview, say so
   explicitly in your summary and provide the strongest evidence you
   can instead — never claim HTTP results you did not observe.
6. If acceptance shows failures unrelated to this change, list them
   and state why each is pre-existing/unrelated; do not fix unrelated
   things.

## Scope

- Only what is needed for the above: the seller and crop `[slug]`
  routes, their skeleton placement, and the tests named above.
- Do **not** redesign or rewrite the not-found pages themselves — the
  bug is the status code, not their content.
- Do not touch the variety or state routes.
- No unrelated changes: no refactors, no formatting sweeps, no
  dependency changes, nothing in the legacy root `app/`.
- Do not weaken, skip, or delete any other existing tests.

## Done means

1. `npm run verify` passes in full in `v2/`.
2. The real-HTTP evidence in the Acceptance bar section is in your
   final summary (acceptance output + the six curl statuses + the
   no-skeleton-markup confirmation), or an explicit statement of what
   the sandbox prevented.
3. Your final summary states: which option shipped (B, or A with the
   unmet condition named), how the single-announcement and
   no-layout-shift conditions hold, what you changed file-by-file,
   and any test adaptations per the Tests section.
