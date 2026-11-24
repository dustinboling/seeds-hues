# seeds-hues app (Vike + React SPA) — Slice 3

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

- `pages/` — Vike routes, explicit Route Strings + per-route rendering
  config: `/`, `/about`, `/about/data`, `/about/bot`, `/api-docs`,
  `/privacy`, `/terms`, `/crop` (prerendered; each with `+Page.tsx`,
  `+Head.tsx`, `head.ts`, `+config.ts`, `+route.ts`; data pages add a
  `+data.ts` hook), `/variety/@slug` (on-demand SSR + edge cache, incl. the
  `?small_farm=true` variant; data-driven `+Head`), `+onBeforeRoute.ts`
  (the static 301 map: plural legacy paths, legacy `?v=`, the internal
  small-farms path), `_error/` (404 vs 500).
- `server/` — the Node preview/test server (`serve.ts`, bundled to
  `dist-server/` by `npm run build:server`): static `dist/client`, Vike
  `renderPage` with the shared catalog client + data cache, the
  `/og/[kind]/[slug]` image route, `POST /internal/revalidate`, and an
  in-memory edge mock for variety 200s (the `?small_farm=true` variant
  keys separately). The production Worker mounts the same handlers.
- `src/og/` — the OG card model (`card.ts`), PNG renderer (`render.ts`,
  Satori + resvg), route handler (`serve.ts`), and bundled fonts
  (`fonts/`, byte-identical to v2's per `PROVENANCE.json`).
- `src/variety.css` — the variety template's styles (listing cards, filter
  chips, badges, sibling cards, waitlist floor, 404 page).
- `src/design-system/` — the @hues mirror point: token layers
  (`tokens/*.json`), the seeds→@hues `token-mapping.json`, typed access
  (`tokens.ts`), contrast math + table (`contrast*.ts`, `CONTRAST.md`), fonts
  (`fonts.ts`, `fonts.css`, `font-licenses.md`), generated `tokens.css`, and
  `SWAP.md` (how the mirror swaps for the registry packages).
- `src/components/` — shell: header, footer, tab-bar placeholder, route announcer.
- `src/data/` — catalog read path over the live public API (`api.ts`,
  `load.ts` loaders, `cache.ts`, `revalidate.ts` tag fan-out, `sitemap.ts`,
  `robots.ts`, `llms.ts`, `lastmod.ts` + the committed `sitemap-lastmod.json`).
  Slice 3 adds the variety-detail read (`getVarietyDetail`), the sibling
  walk (`listVarietyListItems`, availability order applied read-side — the
  public sort vocabulary has no availability sort), the merged lookup
  (`mergedVarietyTarget`, via the app-internal variety-status mount), and
  the OG card's minimal seller/crop reads.
- `src/server/` — the single machine-file generator (`machine-files.ts`,
  called by the build plugin and the revalidation regeneration), the
  Worker-ready revalidate handler (`revalidate-handler.ts`, POST
  /internal/revalidate mount contract), the static redirect map
  (`redirects.ts`, pure URL function), and the variety route resolver
  (`variety-route.ts`, the +data decisions).
- `src/lib/` — tested utilities (`jsonld-guard.ts`: the no-price JSON-LD guard).
- `src/sw/` — Workbox `injectManifest` service-worker skeleton (own tsconfig).
- `src/site.ts`, `src/pwa.ts`, `src/shell.css` — site constants, SW registration
  snippet, shell styles (plain CSS over the token mirror; no framework yet).
- `public/` — manifest, self-hosted icon set (byte-identical to `v2/`), fonts.
- `scripts/` — SW build, PWA proof, token/contrast generators, font sync, the
  machine-file build plugin (`vite-plugin-machine-files.ts`), and
  `gen-sitemap-lastmod.mjs` (refreshes `src/data/sitemap-lastmod.json`).
- `tests/` — `unit/` (mapping, contrast, fonts, guard, PWA, sitemap/robots/og
  rules, machine files, invalidation loop, variety builders/routes/components,
  price guard, OG cards/fonts), `dom/` (shell, filter hydration),
  `stub/` (the hermetic catalog API stub + read-time derivation), `build/`
  (gate-covered production build + PWA proof, Slice 2 surface contract,
  Slice 3 variety HTTP contract).

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

Serve the built app over HTTP (SSR, OG images, revalidate; the Slice 3
contract suite drives this entry):

```sh
cd app
npm run build && npm run build:server
PORT=3000 SEEDS_API_BASE=https://seeds.hues.flowers/api/v1 SEEDS_REVALIDATE_SECRET=... npm run serve
```

`SEEDS_API_BASE` points the SSR reads at any catalog API (the contract
suite points it at the hermetic stub); `PORT=0` picks an ephemeral port
and prints the listening URL. The merged-slug lookup reads
`{origin}/api/internal/variety-status/[slug]` on the same deployment
(Slice 9 mounts it from D1; the stub serves it in tests).

Regenerate derived files (each has a freshness test — never hand-edit outputs):

```sh
npm run gen:tokens-css   # tokens/*.json + mapping → src/design-system/tokens.css
npm run gen:contrast     # token mirror → src/design-system/CONTRAST.md
npm run sync:fonts       # v2 bytes + @fontsource → public/fonts/ + OFL-1.1.txt
npm run gen:sitemap-lastmod  # live API → src/data/sitemap-lastmod.json (run when the catalog moves)
```

## Conventions

- Strict TypeScript (`strict` + `noUncheckedIndexedAccess`), zero `any`.
- No placeholder stubs — the single exception is the named `TabBarPlaceholder`
  (structure + slots; the D1 design builds post-cutover).
- WCAG 2.2 AA for the shell; every touched contrast pair is computed from the
  actual token values (`CONTRAST.md`) and cross-checked against the recorded
  ratios before the gate trusts them.
- No external URLs for fonts, images, or scripts — everything is self-hosted.
