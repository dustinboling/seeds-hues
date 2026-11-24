# seeds-hues app (Vike + React SPA) — Slice 1

The Seed Directory's conversion from Next.js to a Vike + React SPA. This tree
holds the new app; the live site is `../v2/` (Next.js).

## Inert until Slice 9

Nothing in `app/` is deployed, routed, or referenced by `v2/` until the Slice 9
cutover. The only cross-tree links are:

- `../v2/package.json`'s `verify` script chains this tree's `verify`, so the
  gate goes red if `app/` breaks.
- Tests read `../v2/app/globals.css` (token source of truth) and
  `../v2/app/fonts/*` (editorial font bytes) as oracles — read-only, test-time.

Do not change deploy configuration (`../v2/wrangler.jsonc`, deploy scripts) for
this tree, and do not import `app/` code from `v2/` (or vice versa) outside the
links above.

## Layout

- `pages/` — Vike filesystem routes (`+config.ts`, `+Layout.tsx`, `+Head.tsx`,
  `index/+Page.tsx` proof route with per-route `prerender: true`, `_error/`).
- `src/design-system/` — the @hues mirror point: token layers
  (`tokens/*.json`), the seeds→@hues `token-mapping.json`, typed access
  (`tokens.ts`), contrast math + table (`contrast*.ts`, `CONTRAST.md`), fonts
  (`fonts.ts`, `fonts.css`, `font-licenses.md`), generated `tokens.css`, and
  `SWAP.md` (how the mirror swaps for the registry packages).
- `src/components/` — shell: header, footer, tab-bar placeholder, route announcer.
- `src/lib/` — tested utilities (`jsonld-guard.ts`: the no-price JSON-LD guard).
- `src/sw/` — Workbox `injectManifest` service-worker skeleton (own tsconfig).
- `src/site.ts`, `src/pwa.ts`, `src/shell.css` — site constants, SW registration
  snippet, shell styles (plain CSS over the token mirror; no framework yet).
- `public/` — manifest, self-hosted icon set (byte-identical to `v2/`), fonts.
- `scripts/` — SW build, PWA proof, token/contrast generators, font sync.
- `tests/` — `unit/` (mapping, contrast, fonts, guard, PWA), `dom/` (shell),
  `build/` (gate-covered production build + PWA proof).

## Run

Requires Node ≥ 22.12. First time (and after `package.json` changes):

```sh
cd app
npm install
```

Verify (lint + typecheck + tests, including the production-build proof):

```sh
cd app
npm run verify
```

Develop / build:

```sh
cd app
npm run dev     # vike dev server
npm run build   # vike build + SW bundle/inject + post-build PWA proof
```

Regenerate derived files (each has a freshness test — never hand-edit outputs):

```sh
npm run gen:tokens-css   # tokens/*.json + mapping → src/design-system/tokens.css
npm run gen:contrast     # token mirror → src/design-system/CONTRAST.md
npm run sync:fonts       # v2 bytes + @fontsource → public/fonts/ + OFL-1.1.txt
```

## Conventions

- Strict TypeScript (`strict` + `noUncheckedIndexedAccess`), zero `any`.
- No placeholder stubs — the single exception is the named `TabBarPlaceholder`
  (structure + slots; the D1 design builds post-cutover).
- WCAG 2.2 AA for the shell; every touched contrast pair is computed from the
  actual token values (`CONTRAST.md`) and cross-checked against the recorded
  ratios before the gate trusts them.
- No external URLs for fonts, images, or scripts — everything is self-hosted.
