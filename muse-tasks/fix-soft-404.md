# Task: Fix soft-404 on seller and crop pages

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

## Problem

Found in a production acceptance run on 2026-11-20:

- A non-existent seller slug — `/seller/<bad-slug>` — renders the
  seller "not found" page with **HTTP 200** instead of 404.
- A non-existent crop slug — `/crop/<bad-slug>` — renders the crop
  "not found" page with **HTTP 200** instead of 404.
- A non-existent variety slug (`/variety/<bad-slug>`) and a
  non-existent state slug (`/state/<bad-slug>`) already return a
  **correct HTTP 404**.

The relevant routes are:

- `v2/app/seller/[slug]/page.tsx`
- `v2/app/crop/[slug]/page.tsx`
- `v2/app/variety/[slug]/page.tsx` (working — returns a real 404)
- `v2/app/state/[slug]/page.tsx` (working — returns a real 404)

## Approach

1. First inspect how the **variety and state routes** produce a real
   404, and how the seller and crop routes differ. Follow the
   codebase's own working approach where possible.
2. Known stack pattern, as background: on OpenNext/Cloudflare, an
   SSG dynamic-segment route can serve a prerendered page instead of
   a real 404 even when the page component calls `notFound()`. The
   pattern known to work live in this stack is
   `export const dynamic = 'force-dynamic'` on the route plus
   `notFound()` for unknown params. **Verify this against what the
   variety/state routes actually do rather than assuming it** — if
   the working routes use a different mechanism, prefer theirs, and
   say in your summary which mechanism you found and used.

## Scope

- Only what is needed so that unknown seller and crop slugs return a
  true HTTP 404, while **every valid seller and crop page keeps
  working unchanged**.
- Do **not** redesign or rewrite the not-found pages themselves —
  the bug is the status code, not their content.
- No unrelated changes: no refactors, no formatting sweeps, no
  dependency changes, nothing in the legacy root `app/`.
- Do not weaken, skip, or delete existing tests.

## Done means

1. `npm run verify` passes in full in `v2/`.
2. There is a test or other concrete in-repo evidence covering the
   bad-slug behaviour for **both** seller and crop — add tests under
   `v2/tests/` if the suite's existing patterns allow it (look at
   how the suite already tests routes/data before inventing a new
   style).
3. Your final summary explains how the 404 behaviour was confirmed
   (what you inspected, what you changed, and what evidence shows
   unknown slugs now 404 while valid slugs still render).
