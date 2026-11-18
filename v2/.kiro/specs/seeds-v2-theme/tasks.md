# Theme delta — tasks (design authority: ~/workspace/seeds-hues/THEME-ART-DIRECTION.md)

Presentation layer ONLY. No data, routes, API, copy, indexability, JSON-LD or
content changes. Prices stay hidden; "Not yet rated" stays; provenance lines stay.

Assets already staged (do not fetch or generate art):
- Fonts: `app/fonts/fraunces-var.woff2`, `fraunces-var-italic.woff2`,
  `newsreader-var.woff2`, `newsreader-var-italic.woff2` (variable, latin).
- Art: `public/theme/` — hero-cutting-garden-1600.webp, hero-cutting-garden-960.webp,
  empty-no-sellers.webp, empty-search.webp, about-data.webp, farms-basket.webp,
  offline-path.webp, paper-grain.webp, divider-stem.svg.
- Icons: `public/icons/*.png` ALREADY replaced with the new zinnia set.
  Do NOT run scripts/gen-icons.ts (it would overwrite them).

## Tasks
1. [x] Fonts: wire Fraunces + Newsreader via `next/font/local` (variable weight
   ranges 400–700 / 400–600, display swap; preload Fraunces only). Expose as
   Tailwind font tokens: display = Fraunces, serif (body) = Newsreader,
   sans = existing system stack.
2. [x] Tokens: update `app/globals.css` @theme to the art-direction palette
   (keep existing token NAMES; new values: paper #F8F1E1, surface #FFFDF6,
   ink #2E2A23, muted #6A5F4C, line #E0D5B8, line-strong #97865F,
   leaf #1E4634, leaf-600 #2E6B4F, leaf-50 #E3EAD8, link #1F5C3D,
   petal #8E2A52, petal-50 #F7E8EC, warn #8A5E08, warn-50 #F7EDD3,
   focus #7A3E10; ADD paper-deep #F0E5CB, ink-soft #4A4438, sage #7D9B76).
   radius-card → 18px; shadow-card warmed to rgb(90 70 20 / .08).
   Body font → Newsreader; h1–h3 → Fraunces with font-optical-sizing.
   .btn and .chip get the sans stack (tool layer). Skeleton shimmer → flat
   paper-deep pulse. Paper-grain overlay: body::before fixed layer with
   /theme/paper-grain.webp tiled, opacity .5 (tile alpha is already ≤13%),
   pointer-events none, z-index below content, hidden in forced-colors mode.
3. [x] Header: wordmark lockup — "Seed Finder" in Fraunces 600 (replacing/augmenting
   the current site-name text without changing link targets), divider-stem under
   the header on the home page only if clean; header bottom hairline = line colour.
4. [x] TabBar: paper-deep translucent ground (backdrop-blur), line-strong top rule,
   active item leaf-deep + a 3px petal dot above the label; labels sans 600.
   Do not change tabs, order, links or safe-area behaviour.
5. [x] Footer: paper-deep ground, divider-stem.svg centred above the footer
   content, ink-soft text.
6. [x] Home hero: place the hero art (responsive: 960w ≤ 640px, 1600w above;
   width/height attrs to prevent CLS; fetchpriority high — it is the LCP
   candidate; alt ""). On mobile it sits above the headline; on md+ it sits
   right of the headline column (grid). Keep headline, search box, coverage
   line and all links exactly as they are.
7. [x] Empty states: zero-seller block on variety pages gets
   /theme/empty-no-sellers.webp (max-h ~ 220px, centred, alt "");
   search zero-results state gets /theme/empty-search.webp (same treatment).
   Only where those states already render — no new copy, no new states.
8. [x] About pages: /about (and /about/data if it is a separate route) header
   gets /theme/about-data.webp as a wide banner (rounded-18 frame, alt "").
   Seller index (/seller) header gets /theme/farms-basket.webp the same way.
9. [x] 404 (app/not-found.tsx) and offline (app/offline) get
   /theme/offline-path.webp as a centred spot (max-h ~ 260px, alt "").
10. [x] OG route (app/og): restyle the generated card to the theme — paper
    ground #F8F1E1, Fraunces title in ink, leaf-deep accent rule, divider
    motif drawn with shapes (no external assets beyond what the route already
    loads; if the route uses next/og with font loading, reuse the local
    Fraunces woff2). Keep image dimensions and per-page behaviour identical.
11. [x] Config: lib/config.ts THEME_COLOR → #1E4634, BACKGROUND_COLOR → #F8F1E1.
    Manifest picks these up automatically — verify. Replace public/icons/icon.svg
    with a minimal theme glyph (petal #8E2A52 petals + ochre centre on paper)
    drawn as simple SVG shapes.
12. [x] Components pass: cards (crop/variety/seller) radius + warmed shadow via
    tokens (should fall out of task 2 — verify, don't fork styles); badges in
    components/variety/Availability.tsx and RatingDisplay keep semantics, pick
    up token colours; "Not yet rated" gets a small outline-star glyph (inline
    SVG, currentColor) before the text — text itself unchanged.
13. [x] Tests: `npm run verify` green. Update ONLY tests that assert old styling
    values (colours, theme-color, background, icon bytes/hash, font stacks) —
    list every such test in the report. Content/behaviour tests untouched.
14. [x] `npm run cf:build` green; local OpenNext preview on localhost;
    `npm run acceptance` green against it. Write THEME-REPORT.md: files changed,
    tests updated (each named), divergences, and the exact list of pages where
    art was placed.

Hard stops: NO deployment, NO remote Cloudflare calls, NO production data,
NO new dependencies, NO external fetches. Local verification only.
