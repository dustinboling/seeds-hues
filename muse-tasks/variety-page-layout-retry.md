# Task: Variety page layout — second attempt (first attempt's test had a slicing bug)

You are working in the `seeds-hues` repository (the Seed Directory,
seeds.hues.flowers). This prompt is self-contained.

## The spec

Implement exactly the change specified in
**`muse-tasks/variety-page-sellers-beside-painting.md`** in this
repository — read it first and follow it in full (orientation, the
two moves, the preserve list, the scope limits). Summary: in
`v2/app/variety/[slug]/variety-view.tsx`, (1) move the About section
directly beneath the page header, full width, and (2) at the `md`
breakpoint (≥768px) wrap the hero painting and the entire
"Where to buy" section in a two-column grid — painting left at its
current 380px, sellers right; stacked unchanged below 768px; no
grid and no empty column when there is no hero image; the
zero-seller state (spot art, "No sellers yet", `WaitlistBlock`)
inside the buy section so it lands in the right column. No copy
changes, no other components touched.

## What happened on the first attempt (run 44839147506)

A previous run implemented this and the workflow's verify gate
reported **401 of 402 tests passing**. The implementation shape it
used was sound and is the shape to reproduce:

- About section moved byte-identical to directly beneath `<header>`.
- Wrapper: `<div className={v.media[0] ? "md:grid md:grid-cols-[380px_minmax(0,1fr)] md:items-start md:gap-8" : undefined}>`
  around the hero conditional and the whole buy section; both
  children keep `mt-6`.
- It extended `v2/tests/unit/listing-row.test.ts` with a
  source-structure suite (the file's existing pattern) pinning the
  DOM marker order, About's position, and the wrapper.

The ONE failing test was a bug in that new test itself, at the
assertion counting `<section` tags inside a source slice:

```ts
const between = page.slice(page.indexOf(GRID), page.indexOf('aria-labelledby="facts-title"'));
expect(between.match(/<section/g)).toHaveLength(1);  // got 2
```

The slice ends at the facts section's `aria-labelledby` ATTRIBUTE,
which sits INSIDE the facts section's opening tag — so the slice
includes the facts section's own `<section` and the count is 2,
not 1. The implementation was not at fault.

## Your job

1. Reproduce the implementation and the test suite as described.
2. Fix that assertion's slice boundary: end the slice at the START
   of the facts section's opening TAG — e.g.
   `page.indexOf('<section aria-labelledby="facts-title"')` — so
   the counted region covers exactly the wrapper's contents (the
   buy section only), or use an equivalent boundary that excludes
   the facts tag itself. Keep every other assertion's intent.
3. Do not weaken, skip, or delete any existing test, and do not
   weaken the new assertions to make them pass — the boundary fix
   above is the whole correction.

## Environment note

On the previous run, the in-session shell sandbox failed to start
commands (`bwrap: loopback: Failed RTM_NEWADDR: Operation not
permitted`), so that run could not execute `npm run verify`
itself. If your shell fails the same way, do not burn steps
retrying: validate by close reading and say so in your summary.
The workflow runs `npm run verify` in `v2/` after your run as the
real gate, and no PR is created unless it passes in full.

## Done means

- The implementation matches the referenced spec.
- `npm run verify` (run by the workflow gate) passes in full —
  including the corrected layout suite.
- Your summary states the DOM order, the no-image and zero-seller
  handling, the files changed, and whether you could run verify
  yourself or validated by reading.
