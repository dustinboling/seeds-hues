# Task: Variety page layout — third attempt (two known test-code pitfalls, both specified)

You are working in the `seeds-hues` repository (the Seed Directory,
seeds.hues.flowers). This prompt is self-contained.

## The spec

Implement exactly the change specified in
**`muse-tasks/variety-page-sellers-beside-painting.md`** in this
repository — read it first and follow it in full. Summary: in
`v2/app/variety/[slug]/variety-view.tsx`, (1) move the About section
directly beneath the page header, full width, and (2) at the `md`
breakpoint (≥768px) wrap the hero painting and the entire
"Where to buy" section in a two-column grid — painting left at its
current 380px, sellers right; stacked unchanged below 768px; no
grid and no empty column when there is no hero image; the
zero-seller state inside the buy section so it lands in the right
column. No copy changes, no other components touched.

The implementation shape that two previous runs converged on (and
that passed lint + typecheck + 401/402 tests) is:

- About section moved byte-identical to directly beneath `</header>`.
- Wrapper: `<div className={v.media[0] ? "md:grid md:grid-cols-[380px_minmax(0,1fr)] md:items-start md:gap-8" : undefined}>`
  around the hero conditional and the whole buy section; both
  children keep `mt-6`.

## Why the previous runs failed the gate — read carefully

Both failures were in the NEW TEST code added to
`v2/tests/unit/listing-row.test.ts`, never in the implementation:

1. **Run 1** sliced the source as
   `page.slice(page.indexOf(GRID), page.indexOf('aria-labelledby="facts-title"'))`
   and counted `<section` in it: the slice ends inside the facts
   section's opening tag, so the count was 2, not 1. Slice to the
   START of the facts opening TAG instead:
   `page.indexOf('<section aria-labelledby="facts-title"')`.
2. **Run 2** fixed that but wrote order assertions with bare
   indexed access — `expect(positions[i]).toBeGreaterThan(positions[i - 1])`.
   This repo compiles with **`noUncheckedIndexedAccess: true`**
   (see `v2/tsconfig.json`), so `positions[i - 1]` is
   `number | undefined` and `toBeGreaterThan` rejects it
   (TS2345). Read `v2/tsconfig.json` before writing tests, and
   never pass a bare `arr[i]` expression into a typed parameter.

## The test suite to add

Append the suite below to `v2/tests/unit/listing-row.test.ts`
(that file already reads the variety-view source the same way and
already imports `readFileSync` / `join`). Use it as written — it is
run 2's suite with the two indexed-access loops rewritten in
accumulator form. Do not restructure it, and do not weaken any
assertion.

```ts
describe("variety page — sellers beside the painting layout (source)", () => {
  const page = readFileSync(join(process.cwd(), "app/variety/[slug]/variety-view.tsx"), "utf8");
  const GRID = "md:grid md:grid-cols-[380px_minmax(0,1fr)] md:items-start md:gap-8";

  it("reads header → About → painting → Where to buy → facts → sowing → report link → siblings", () => {
    const markers = [
      "</header>",
      'aria-labelledby="about-title"',
      "<VarietyHeroImage",
      'aria-labelledby="buy-title"',
      'aria-labelledby="facts-title"',
      'aria-labelledby="sowing-title"',
      "Report a problem",
      'aria-labelledby="more-title"',
    ];
    const positions = markers.map((m) => page.indexOf(m));
    let prev = -1;
    for (const [i, pos] of positions.entries()) {
      expect(pos, markers[i]).toBeGreaterThan(prev);
      prev = pos;
    }
    // Heading outline stays logical: h1 → About (h2) → Where to buy (h2) → facts → sowing.
    const headings = [
      '<h1 id="variety-title"',
      '<h2 id="about-title"',
      '<h2 id="buy-title"',
      '<h2 id="facts-title"',
      '<h2 id="sowing-title"',
    ];
    const hpos = headings.map((m) => page.indexOf(m));
    let hprev = -1;
    for (const pos of hpos) {
      expect(pos).toBeGreaterThan(hprev);
      hprev = pos;
    }
  });

  it("About sits directly beneath the header, full width above the painting/sellers block", () => {
    const afterHeader = page.slice(
      page.indexOf("</header>") + "</header>".length,
      page.indexOf('<section aria-labelledby="about-title"'),
    );
    expect(afterHeader.trim()).toBe("");
    // The whole About block (both paragraphs and the written-description conditional) moved
    // with the section, ahead of the grid wrapper — not inside either column.
    expect(page.indexOf("Directory summary:")).toBeGreaterThan(page.indexOf('aria-labelledby="about-title"'));
    expect(page.indexOf("Directory summary:")).toBeLessThan(page.indexOf(GRID));
    expect(page).toContain("About {label}");
    // The crop-level guidance box is a different block — it stays in Sowing and growing.
    expect(page.indexOf("Crop-level guidance for")).toBeGreaterThan(page.indexOf('aria-labelledby="sowing-title"'));
  });

  it("wraps hero and buy section in an md-only two-column grid, only when a hero image exists", () => {
    // Exactly one grid wrapper, conditional on the hero image: no image means a plain block
    // (className undefined), so there is never an empty left column.
    expect(page.split(GRID)).toHaveLength(2);
    const wrapper = page.match(/<div className=\{v\.media\[0\] \? "([^"]+)" : undefined\}>/)?.[1] ?? "";
    expect(wrapper.split(" ")).toEqual([
      "md:grid",
      "md:grid-cols-[380px_minmax(0,1fr)]",
      "md:items-start",
      "md:gap-8",
    ]);
    // Both children keep mt-6: aligned tops in the grid, today's stacked rhythm below md.
    expect(page).toContain('<section aria-labelledby="buy-title" className="mt-6">');
    const hero = readFileSync(join(process.cwd(), "components/variety/VarietyHeroImage.tsx"), "utf8");
    expect(hero).toContain('<figure className="mt-6"');
    // Facts and everything after stay full width below the two-column block.
    expect(page.indexOf('aria-labelledby="facts-title"')).toBeGreaterThan(page.indexOf("</div>", page.indexOf(GRID)));
  });

  it("puts the entire buy section — including the zero-seller state — inside the wrapper", () => {
    // The slice ends at the START of the facts section's opening tag, so the counted region
    // covers exactly the wrapper's contents (ending at the aria-labelledby attribute would
    // include the facts tag's own <section).
    const between = page.slice(page.indexOf(GRID), page.indexOf('<section aria-labelledby="facts-title"'));
    expect(between).toContain("<VarietyHeroImage");
    expect(between).toContain('aria-labelledby="buy-title"');
    expect(between.match(/<section/g)).toHaveLength(1);
    // Zero sellers renders in the right column, where the listings would have gone.
    expect(between).toContain("No sellers yet");
    expect(between).toContain("WaitlistBlock");
    // The listing machinery stays inside the moved section, untouched.
    for (const marker of ["SellerFilterChips", "variety-listing-count", "SmallFarmLegend", "<ListingRow", "ResultsScrollClamp"]) {
      expect(between, marker).toContain(marker);
    }
  });
});
```

If the file's existing imports differ from what this suite needs,
adjust the imports minimally. If an assertion in this suite does
not match the implementation you produced, fix the IMPLEMENTATION
to match the spec — never edit the assertion to fit.

## Environment note

Previous runs' in-session shells failed to start commands
(`bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`).
If yours fails the same way, do not burn steps retrying: validate
by close reading and say so in your summary. The workflow runs
`npm run verify` in `v2/` after your run as the real gate, and no
PR is created unless it passes in full (lint + typecheck + tests).

## Done means

- The implementation matches the referenced spec, in
  `variety-view.tsx` only (plus this test suite).
- The workflow gate's `npm run verify` passes in full.
- Your summary states the DOM order, the no-image and zero-seller
  handling, the files changed, and whether you could run verify
  yourself or validated by reading.
