# SWAP.md — replacing the mirror with the registry packages

Slice 1 took the §2 fallback path: `@hues/tokens@1.0.0` and `@hues/fonts@1.0.0`
both 404 on GitHub Packages (`npm package does not exist under owner "hues"`,
probed 2026-11-24, no `GITHUB_TOKEN` in the run environment), and nothing in the
repo vendors or forks them. This directory is the single mirror point. When the
packages publish, make exactly these changes — nothing else in `app/` touches
design-system provenance.

## 1. Declare the dependencies

- `app/package.json`: add `@hues/tokens` + `@hues/fonts` (pinned versions).
- Add `app/.npmrc` with `@hues:registry=https://npm.pkg.github.com` (scoped to
  this tree; the run's `GITHUB_TOKEN` authenticates). CI needs the token too —
  that install step is a workflow change and routes through the gated path.

## 2. Tokens: mirror JSON → package

Delete:

- `src/design-system/tokens/tokens.ref.json`
- `src/design-system/tokens/tokens.sys.json`
- `src/design-system/tokens/theme.seeds.json`
- `src/design-system/tokens/tokens.comp.json`

Rewrite `src/design-system/tokens.ts` to re-export the package:

```ts
export { /* ref/sys/theme/comp accessors */ } from "@hues/tokens";
export { themeSeeds } from "@hues/tokens/theme.seeds";
```

Keep, and re-verify (do not delete):

- `src/design-system/token-mapping.json` — the seeds-names → @hues-names port
  record stays valid; re-run `tests/unit/token-mapping.test.ts` with the
  package's real `theme.seeds` values as the oracle. Every `provisional: true`
  sys name in the mirror must be confirmed or renamed to the package's name.
- `src/design-system/contrast-table.ts` + `CONTRAST.md` — re-generate against
  the package values; Iris + Ada re-verify the pairs.
- `src/design-system/tokens.css` — re-generate (`npm run gen:tokens-css` reads
  through `tokens.ts`, so it follows the swap automatically once the module
  points at the package).

## 3. Fonts: mirror mechanics → package

- `public/fonts/*`: delete the six woff2 files (the package serves its own);
  remove `@fontsource/source-sans-3` from `devDependencies` and delete
  `scripts/sync-fonts.mjs`.
- Rewrite `src/design-system/fonts.ts` (`FONT_FACES`, `preloadFaces`,
  `FONT_STACKS`) as a thin adapter over `@hues/fonts` loaders for the same
  three families (Source Sans 3 + Fraunces + Newsreader); keep the exported
  names so `pages/+Head.tsx` and `shell.css` need no import changes.
- Keep `src/design-system/fonts.css` shape (one `@font-face` per wired file) but
  re-point `url()`s at the package's emitted files; `tests/unit/fonts.test.ts`
  then asserts package bytes instead of committed bytes.
- Keep `font-licenses.md` + `OFL-1.1.txt` (licenses stay recorded locally even
  when bytes come from the package).

## 4. Shell mechanics: app-local equivalents → @hues/ui

- `src/components/RouteAnnouncer.tsx` (focus-on-route-change + live-region
  announcement) → the `@hues/ui` focus-management / route-announcement
  primitives. Keep the component's exported name as an adapter so
  `pages/+Layout.tsx` needs no import change; `tests/dom/shell.test.tsx`
  ("route changes") then drives the package mechanics.
- `src/components/TabBarPlaceholder.tsx` is NOT part of the swap — the D1 tab
  bar builds post-cutover as a seeds component on shared tokens.

## 5. After the swap

- Delete this file's fallback notice (keep the file as the provenance record).
- Re-run the full `verify` (lint + typecheck + tests incl. the build test) and
  confirm `CONTRAST.md` regenerates byte-identical or with re-verified deltas.
