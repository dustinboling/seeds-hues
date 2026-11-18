# THEME-REPORT — seeds-v2-theme ("The Illustrated Seed Catalogue")

Date: 2026-11-16. Design authority: `~/workspace/seeds-hues/THEME-ART-DIRECTION.md`. Binding rules:
`~/workspace/seeds-hues/SPEC-CANONICAL.md`. Task list: `.kiro/specs/seeds-v2-theme/tasks.md`, where all
14 tasks are checked.

This delta changes the presentation layer only. Data, routes, the API, page copy, indexability,
JSON-LD and the service worker are unchanged. Everything was verified locally. Nothing was
deployed, no remote Cloudflare resource or production data was touched, no dependency was
added, and nothing was fetched from outside localhost. `scripts/gen-icons.ts` was not run.

## Result

| Finish-line item | Status |
|---|---|
| `npm run verify` (ESLint + `tsc --noEmit` + Vitest) | **Green.** ESLint has 0 problems. 8 files, **143/143 tests** pass. Log: `tmp/theme-verify.log` |
| Fresh local `npm run db:setup:local` | **Green.** 93 plants / 619 varieties / 6 sellers / 17 listings, 619 indexable, catalog version 1 published to local D1/R2 (`Resource location: local`). Log: `tmp/theme-dbsetup.log` |
| `npm run cf:build` | **Green.** Log: `tmp/theme-cfbuild.log` |
| OpenNext preview | **Running** on `http://localhost:8787` (`npm run cf:preview`, log `tmp/theme-preview.log`). The previous preview from the plant-media delta was stopped first. |
| `npm run acceptance -- --base http://localhost:8787` | **Green: 107/107.** Report: `tmp/acceptance-theme.md`, log: `tmp/acceptance-theme.log` |

## Files changed

The baseline was snapshotted before any edit (the directory is not a git repo), and this list
comes from `diff -rq` against that snapshot.

| File | Change |
|---|---|
| `app/fonts.ts` (new) | `next/font/local` setup. Fraunces upright (weight `400 700`, preloaded) becomes `--font-fraunces`. Newsreader upright + italic (weight `400 600`, not preloaded) becomes `--font-newsreader`. Both use `display: swap`, a metric-adjusted fallback, and serif fallbacks. |
| `app/layout.tsx` | Adds the two font variable classes on `<html>`. The skip link gets `font-sans`. |
| `app/globals.css` | All palette values updated and the three new tokens added (`paper-deep`, `ink-soft`, `sage`). Font tokens: `display` = Fraunces, `serif` = Newsreader, `sans` = the system stack (unchanged). `radius-card` is 18px and `shadow-card` uses warm `rgb(90 70 20 / …)`. Body text is Newsreader at 1.0625rem/1.6. h1–h3 are Fraunces with `font-optical-sizing: auto`. Form controls, `.btn`, `.chip`, `.eyebrow` and badges use sans. New: `body::before` paper grain (hidden in forced-colors mode), `.card-hover`, `.card-image`, `.divider-stem`, `.divider-stem-mini`, `.art-frame`, a divider before each `.prose-plain h2`, and `.chip[aria-current]` as the active chip. The skeleton shimmer is now a flat paper-deep pulse. Buttons are 12px radius with a 1px letterpress bottom edge. The reduced-motion rule is kept. |
| `components/ui/ThemeArt.tsx` (new) | One `<picture><img>` component that draws from a fixed table of `/theme/*.webp` files. `alt=""`, width/height attributes set. `priority` makes it eager with `fetchpriority="high"`. The hero has a `<source media="(min-width: 641px)">` for the 1600w file, so screens up to 640px get the 960w file. |
| `components/layout/SiteHeader.tsx` | Wordmark lockup: "Seed Finder" in Fraunces 600 at 1.25rem, with the existing "seeds.hues.flowers" beneath it on mobile and inline after a small stem motif on md+. Paper ground, `line` hairline, sans nav. The drawn FlowerMark is removed (the art direction calls for a typographic lockup). Link targets are unchanged. |
| `components/layout/icons.tsx` | Unused `FlowerMark` (old palette) removed. |
| `components/layout/TabBar.tsx` | `bg-paper-deep/92` + backdrop blur, `line-strong` top rule, `ink-soft` icons and labels, active tab `leaf` with a 3px petal dot above the label. Every tab reserves the dot's space, so nothing shifts. Labels are sans 600 caption. Tabs, order, links and safe-area padding are unchanged. |
| `components/layout/SiteFooter.tsx` | Divider stem centred above the footer, `paper-deep` ground, `ink-soft` text, a small "Seed Finder" wordmark. |
| `app/page.tsx` | Hero art (LCP image) sits above the headline on mobile and right of it on md+ (2-column grid). Divider stem under the hero. Crop cards get `card-hover`, a Fraunces name and sans counts. The coverage line is Fraunces. "How this directory works" sits on a sage-tint wash. Headline, search box, coverage line and links are unchanged. |
| `app/variety/[slug]/page.tsx` | Zero-seller block gets `empty-no-sellers` art. Listings are one surface sheet divided by hairlines (previously a 2-column card grid). |
| `app/seller/[slug]/page.tsx` | Same listing-sheet change. |
| `app/search/page.tsx` | Zero-results state gets `empty-search` art. |
| `app/about/page.tsx`, `app/about/data/page.tsx` | `about-data` banner under the h1. |
| `app/seller/page.tsx` | `farms-basket` banner under the h1. |
| `app/not-found.tsx`, `app/offline/page.tsx` | `offline-path` spot above the heading. |
| `app/crop/page.tsx` | Crop index cards get `card-hover`. The Latin name is muted. |
| `app/og/[kind]/[slug]/route.tsx` | Restyled (see "Art placements"). Text, dimensions and per-kind behaviour are unchanged. |
| `app/global-error.tsx` | Inline colours moved to the new palette. |
| `components/variety/Availability.tsx` | Badge tones follow the art direction: In stock = leaf on sage-tint, Sold out = petal on petal-tint, Unknown = ochre on ochre-tint, Preorder = leaf-600 on surface, Shop closed = muted on surface. Each has a 40% border in its text colour. Sans 700, uppercase, +0.06em. Labels are unchanged. |
| `components/ui/RatingDisplay.tsx` | A small outline star (inline SVG, `currentColor`, `aria-hidden`) before "Not yet rated", in sans `ink-soft`. The text is unchanged and there is still no score. |
| `components/variety/ListingRow.tsx` | No card box. Seller/variety name in Fraunces 500. "Last checked" and source line in muted sans caption ("Last checked" kept semibold `ink-soft`). Report link in sans. Content and `/go/` link are unchanged. |
| `components/variety/VarietyCard.tsx`, `components/seller/SellerCard.tsx` | `card-hover`. Variety name weight 500. Last-checked line in sans. |
| `components/crop/CropCardImage.tsx` | `card-image` class (sage-tint hairline under the image). The `aspect-[4/5]` wrapper and `<img>` are unchanged. |
| `components/search/SearchBox.tsx` | 14px radius, magnifier icon in leaf (decorative), card-weight shadow on the suggestion list. Behaviour is unchanged. |
| `components/report/ReportForm.tsx` | Inputs use `line-strong` borders (the old `line` was below 3:1) and a 10px radius. Labels are sans 600 small. |
| `components/ui/Swatch.tsx` | The no-colour hatch uses warm paper tones instead of grey. |
| `lib/config.ts` | `THEME_COLOR` = `#1E4634`, `BACKGROUND_COLOR` = `#F8F1E1`. The manifest picks both up (verified at `/manifest.webmanifest`, and `<meta name="theme-color" content="#1E4634">` is on every page). |
| `public/icons/icon.svg` | New glyph: 12 petal-colour ellipses with a thin paper stroke, an ochre centre and a marigold eye, on a paper tile. The PNG icons were not touched. |
| `public/_headers` | `/theme/*` gets `Cache-Control: public, max-age=604800` (same as `/icons/`; not immutable, because the filenames are not hashed). |
| `public/theme/about-data.webp`, `farms-basket.webp` | File mode set from 600 to 660 to match the other theme files. Contents untouched. |
| `tests/unit/guardrails.test.ts` | See "Tests updated". |
| `scripts/acceptance.ts` | See "Tests updated". |
| `.kiro/specs/seeds-v2-theme/tasks.md` | All boxes checked. |
| `public/sw.js` | Regenerated by `scripts/build-sw.mjs` on `cf:build`. Only the version stamp differs, and the template is unchanged. |

## Art placements, page by page

| Page | Asset | Treatment |
|---|---|---|
| `/` | `hero-cutting-garden-960.webp` (≤640px) / `-1600.webp` (>640px) | Above the headline on mobile, right column on md+. `art-frame`, eager, `fetchpriority="high"`. This is the measured LCP element. |
| `/` | `divider-stem.svg` | Under the hero (CSS background). |
| `/variety/{slug}` with no listings | `empty-no-sellers.webp` | Centred, 220px tall, framed, lazy, above the existing "No sellers yet" paragraph. |
| `/search?q=` with zero results | `empty-search.webp` | Same treatment, above the existing zero-results text. |
| `/about`, `/about/data` | `about-data.webp` | Full-width framed banner under the h1, priority (it is the LCP element on `/about`). |
| `/seller` (all pages of the index) | `farms-basket.webp` | Framed banner under the h1, max-w-3xl, priority. |
| 404 (`app/not-found.tsx`) and `/offline` | `offline-path.webp` | Centred 260px spot above the heading. |
| Every page | `paper-grain.webp` | Fixed `body::before` tile at opacity 0.5 under all content. Cards, sheets and inputs stay flat. |
| Every page | `divider-stem.svg` | Centred above the footer, plus a cropped mini stem in the header lockup on md+. |
| `/about`, `/about/data`, `/about/bot`, `/terms`, `/privacy` (`.prose-plain`) | `divider-stem.svg` | Before every h2, which puts it between prose sections. |
| `/og/{kind}/{slug}` | Drawn shapes | Paper `#F8F1E1` ground with a hairline edge, ink title, leaf-deep accent rule under the title, the stem-and-leaves divider as inline SVG paths (same geometry as the asset), and petal footer mark. Still 1200×630 PNG (acceptance-checked). |
| PWA | `icon.svg` | New glyph. PNG set as staged. |

## Tests updated

Two test files changed. No content or behaviour assertion was removed or loosened in intent.

1. **`tests/unit/guardrails.test.ts`, "no hotlinked images, no remote image config"**
   - **Why:** the test allow-lists the only files that may render `<img>`, and the theme needs one more: `components/ui/ThemeArt.tsx`. Previous deltas updated this test the same way when they added images.
   - **Change:** added `ThemeArt.tsx` to `IMG_FILES`, with its required `src={art.src}` pattern. The existing one-`<img>`/one-`src=` per file check now covers it.
   - **New assertion:** every path in ThemeArt's table matches `^/theme/[a-z0-9-]+\.webp$`, so the "own assets only, never a hotlink" rule now covers theme art.
   - The test title now mentions `/theme/`.
2. **`scripts/acceptance.ts`, check "`/` and `/crop` card shows the thumbnail …"**
   - **Why:** its sub-assertion "exactly one img on the page" would count the decorative home hero.
   - **Change:** it now counts `<img>` elements whose `src` is not under `/theme/`. Its purpose (the grid renders exactly one crop thumbnail when one crop has media) is unchanged. Every other assertion in the check is as before.

No test asserted the old token colours, theme-color, background colour, font stacks or icon bytes, so nothing else needed changing.

## Verification details

- **Contrast.** I computed every pair myself, and all of the art direction's ratios held:
  - ink on paper 12.68, muted on paper 5.56, muted on surface 6.15
  - link on paper 7.02, white on leaf 10.60
  - petal on petal-tint 6.80, warn on warn-tint 4.89, leaf on sage-tint 8.60
  - line-strong on paper 3.17 and on surface 3.50
  - focus on paper 7.39
  - New pairs this theme introduces: ink-soft on paper-deep 7.71, muted on paper-deep 5.00, link on paper-deep 6.31, ink-soft and leaf on the 92% tab-bar ground 7.79 and 8.55.
  - Grain worst case: assuming a darkest grain pixel at 6.5% black (13% tile alpha × 0.5 opacity), muted text over it is still 4.81:1.
- **Browser check.** Headless Chromium (the copy already in `~/.cache/ms-playwright`; nothing downloaded) at 390×844 DPR 3 against the preview:
  - `/`: LCP is the hero, and the 960w file is chosen at DPR 3. 324 ms locally, CLS 0.00005.
  - `/variety/sweet-pea-kings-ransom`: LCP 164 ms, CLS 0.
  - `/about`: LCP is the banner. 176 ms, CLS 0.0003.
  - Local timings are not a mid-range-phone measurement.
- **Fonts.** Only `fraunces_var-s.p.*.woff2` (67 KB) is preloaded, through a `Link: rel=preload` header and the RSC hint. Newsreader (132 KB) and its italic (147 KB) load on use. All are served from `/_next/static/media/`.
- **JavaScript.** I compared all client chunks of this build against a `next build` of the pre-theme snapshot:
  - Total change: **+213 bytes gzip**, from the search icon and tab dot.
  - A variety page loads **183 KB gzip / 158 KB brotli** of JS. That is over the 150 KB budget, but it was already over before this theme. The framework chunks that make up about 171 KB of it are byte-identical to the baseline. Not caused by this delta; flagged for follow-up.

## Divergences and fallbacks

1. **OG title font.** The title is not Fraunces. Satori (next/og) cannot parse WOFF2, and the repo only has WOFF2 Fraunces files. The card keeps the bundled default font, and `fontWeight: 700` still renders regular because only the regular face is bundled (that was already true before). Using Fraunces would need a TTF/WOFF file staged in the repo. Art direction §4's "variety illustration at right when one exists" was also not added. Varieties and crops with media already use the illustration itself as `og:image`, and the task said to keep per-page behaviour identical.
2. **Fraunces italic is not wired.** `app/fonts/fraunces-var-italic.woff2` is unused. With `next/font`, adding it to the preloaded family would preload it too, and no heading uses italics. Scientific names use Newsreader italic as specified.
3. **Header tagline omitted.** The art direction's desktop tagline ("every flower seed, every small farm") would be new copy, which the hard constraints rule out. The lockup puts the existing "seeds.hues.flowers" in that slot.
4. **Wordmark text.** The header now shows "Seed Finder" (the existing `APP_SHORT_NAME`) above "seeds.hues.flowers", and the footer shows a small "Seed Finder". This is the lockup tasks 3 and 5 asked for. No other copy changed.
5. **No header divider on the home page.** Placing it would have meant a pathname-aware (client) header. Per art direction §3, the stem sits under the home hero instead.
6. **Paper grain is 32.6 KB, not ≤ 20 KB.** It was used as staged, since I could not regenerate art.
7. **Washes have no torn edge.** No shared torn-edge mask asset was staged, so the "How this directory works" wash is a flat sage-tint band with the 18px card radius, inside the page container rather than full-bleed.
8. **Heading sizes.** Pages keep their existing Tailwind size utilities. For example, h1 is `text-3xl` = 1.875rem, against 2.0rem in the art direction's scale. I changed only family, weight, optical sizing, line height and tracking, to avoid editing every page.
9. **Offline art needs the network.** The service worker could not be changed, and it does not precache `/theme/`. With no connection, the `/offline` page's `offline-path` image shows only if the browser HTTP cache already has it. Otherwise a blank 260px framed box appears, because `alt=""` shows no broken-image icon. Fix (not done, because it changes the SW): add `/theme/offline-path.webp` to `PRECACHE` in `scripts/sw.template.js`.
10. **Mobile hero pushes the search box down.** At 390×844 the search box now starts about 600px down, which is still above the fold. The art direction asks for the hero above the headline on mobile, and the spec's home order puts the search box first. I followed the art direction.
11. **Listing rows.** These changed from a 2-column card grid to one surface sheet with hairline dividers (art direction §5, "not boxes"), so md+ shows one column.
12. **Preorder and Shop closed badges.** The art direction does not cover them. I gave them distinct, quieter tones (leaf-600 on surface, muted on surface) so they don't collide with Sold out's petal.
13. **Tab-bar top rule.** It is line-strong on the paper-deep wash, which is 2.88:1. That is decorative: tabs are identified by their labels and icons, not the rule.
14. **Existing grammar bug, left alone.** The OG card shows "1 small farm list it" for n = 1. That was already there and is copy, so it was not touched.

## Addendum — OG Fraunces

**Outcome: not shipped. Satori throws on `app/fonts/fraunces-var.ttf`, so `app/og/[kind]/[slug]/route.tsx` was reverted and is byte-identical to the state described above.** The OG title is still in next/og's bundled Geist Regular. `fontWeight: 700` renders as regular (400) because only that face is bundled. Divergence 1 still stands, with a new cause.

- **Why it fails.** The TTF is a real TrueType file (`00 01 00 00`, 113,616 bytes) with `fvar`/`gvar`/`avar`/`HVAR`/`STAT` tables. Its axes are `wght` 100–900 and `opsz` 9–144, and the default instance is wght 900, opsz 9 (`usWeightClass` 900). Satori always parses fonts with its bundled opentype.js in `lowMemory` mode. On this file that parser crashes in `parseFvarAxis`: `TypeError: Cannot read properties of undefined (reading '256')`, because the `name` lookup it passes to the `fvar` parser is undefined. I reproduced this with next/og's own `ImageResponse` (`fonts: [Geist 400, Fraunces 600 or 700]`). The edge build that runs on Workers contains the identical parser code (`index.edge.js` line 11890). The error comes from Satori's font parsing, so requesting a different weight cannot avoid it. Even without the crash, Satori ignores variable axes and would have drawn the default instance, Fraunces at wght 900, opsz 9, whatever weight was requested.
- **Loading the file was a second, separate blocker on Workers.** The route never loaded its own font. next/og loads Geist internally, and OpenNext rewrites that load into a wrangler `.bin` Data-module import. So there was no existing pattern to reuse. I tried two approaches, and neither works within "no other files changed":
  - `readFile(new URL("…/fraunces-var.ttf", import.meta.url))`. Turbopack emits the file to `.next/server/assets/`, but the OpenNext preview returned HTTP 500 on `/og/site/home` because workerd has no filesystem for that path.
  - `import … with { turbopackModuleType: "bytes" }`. The Next 16.4.6 Turbopack build fails with "Unknown module type". The `with { type: "bytes" }` route needs `experimental.turbopackImportTypeBytes` in `next.config.ts`, and the `.bin` route needs a renamed copy of the font. Both would change other files.
  
  Passing `fonts` to `ImageResponse` also replaces the built-in Geist. Geist would then have to be bundled a second time to keep the eyebrow, subtitle and footer unchanged.
- **What would make it work.** Stage a **static** Fraunces instance (TTF/OTF/WOFF without `fvar`, e.g. wght 700 at a display opsz). Then pick one way to bundle it on Workers: enable `experimental.turbopackImportTypeBytes` and use `import … with { type: "bytes" }` for both Fraunces and Geist, or add a `.bin` copy and use OpenNext's Data-module path.
- **Verification (after the revert).** `npm run verify` is green: ESLint clean, `tsc` clean, 143/143 tests (`tmp/theme-og-verify.log`). `npm run cf:build` is green (`tmp/theme-og-cfbuild.log`). The OpenNext preview was restarted on `http://localhost:8787` (`tmp/theme-og-preview.log`). Each of these returned HTTP 200 `image/png` at 1200×630:
  - `/og/variety/zinnia-queen-lime-blush` (the acceptance media variety)
  - `/og/variety/sweet-pea-albutt-blue` (no media)
  - `/og/variety/sweet-pea-kings-ransom`
  - `/og/crop/zinnia` (media crop)
  - `/og/crop/yarrow` (no media)
  - `/og/seller/floret`
  - `/og/site/home` (home card)
  
  The local `media` table is empty outside the acceptance run, and the card never reads media, so the "with media" variety and crop render the same text-only card. `npm run acceptance -- --base http://localhost:8787` passed 107/107 (`tmp/acceptance-theme-og.md`, `tmp/acceptance-theme-og.log`). Nothing was deployed and nothing remote was touched.

## Addendum 2 — OG Fraunces static

**Outcome: shipped locally (not deployed).** The OG card title now renders in the staged static Fraunces instance `app/fonts/fraunces-og.ttf` (wght 700, opsz 100). The eyebrow, subtitle and footer are still next/og's Geist Regular, pixel for pixel. Divergence 1 is resolved for the title.

- **What changed.**
  - `next.config.ts`: added `experimental: { turbopackImportTypeBytes: true }`. The cf:build log lists it under "Experiments".
  - `app/og/[kind]/[slug]/route.tsx`: imports two fonts with `with { type: "bytes" }`. One is `@/app/fonts/fraunces-og.ttf`. The other is `next/dist/compiled/@vercel/og/Geist-Regular.ttf`, the exact file next/og's edge build loads as its default font (`index.edge.js`, `fallbackFont`, registered as `geist`, weight 400). Both go to `ImageResponse` as `fonts`, with Geist listed first, so Geist stays Satori's default and fallback face. The card root sets `fontFamily: "geist"` and the title sets `fontFamily: "Fraunces"`. Only Geist 400 is registered, so the footer's `fontWeight: 700` still resolves to regular, exactly as before. Each import gets a `@ts-expect-error`, because TypeScript has no module declaration for `.ttf` bytes imports and adding a `.d.ts` was out of scope. The bytes are copied into an `ArrayBuffer` once at module scope to satisfy `FontOptions`. Text, colours, sizes, layout and per-kind logic are unchanged. No dependencies were added and no other files changed.
- **Caveat.** The Geist import uses Next's internal `dist/compiled` path. If a future Next upgrade moves that file, the build fails loudly. It cannot silently fall back to another face.
- **How Fraunces 700 was confirmed.** Pre-change cards were captured from the previous (reverted) build on the same local preview (`tmp/og-static/before/`). Post-change cards were captured for the same slugs (`tmp/og-static/after/`). All are 1200×630.
  - **Pixel diff.** For six of the seven cards, every changed pixel is inside the title band, e.g. rows 243–312 for `crop/yarrow` and rows 238–334 for `variety/sweet-pea-kings-ransom`. The swatch, eyebrow, accent rule, subtitle, divider and footer are byte-identical in those cards.
  - **Glyph metrics.** The measured ink width of each title matches the advance widths in `fraunces-og.ttf` at 92 px, within 3 px, and does not match Geist's:

    | Title | Rendered | Fraunces advances | Geist advances | Before (Geist) |
    |---|---|---|---|---|
    | "Yarrow seeds" | 503 px | 506 | 566 | 559 px |
    | "Zinnia seeds" | 457 px | 459 | 517 | 507 px |

    The file reports `usWeightClass` 700 and has no `fvar` table, and 700 is the only Fraunces face registered.
  - **Visual check.** The site/home card shows Fraunces bold, including its "fl" ligature.
- **One visible consequence: line wrapping.** Fraunces 700 is narrower than Geist, so the 33-character site/home title ("Find where to buy any flower seed", 72 px) now fits on one line instead of two. The layout rules have not changed. The title block is shorter, so `justifyContent: space-between` places the accent rule and subtitle 38 px higher. The subtitle pixels are identical to before at that offset (zero difference). The eyebrow area (rows 0–205) and everything from row 440 down are byte-identical. None of the other sampled titles wrap differently.
- **Verification.**
  - `npm run verify` is green: ESLint, `tsc`, and 143/143 tests (`tmp/og-static-verify.log`).
  - `npm run cf:build` is green (`tmp/og-static-cfbuild.log`).
  - The OpenNext preview was restarted on `http://localhost:8787` (`tmp/og-static-preview.log`). Each of these returned HTTP 200 `image/png` at 1200×630, both before and after the acceptance run:
    - `/og/variety/zinnia-queen-lime-blush` (media variety)
    - `/og/variety/sweet-pea-albutt-blue` (no media)
    - `/og/variety/sweet-pea-kings-ransom`
    - `/og/crop/zinnia` (media crop)
    - `/og/crop/yarrow` (no media)
    - `/og/seller/floret`
    - `/og/site/home`
  - `npm run acceptance -- --base http://localhost:8787` passed 107/107 (`tmp/acceptance-og-static.md`, `tmp/acceptance-og-static.log`). The first attempt passed 106/107. The final rate-limit burst (160 GETs, which must hit 429 within a 120/min window) was never limited, most likely because the burst crossed a window boundary. That check does not touch the OG route. After waiting a minute, the full rerun passed. Nothing was deployed and nothing remote was touched.
