# Seed Finder — Theme Art Direction
### "The Illustrated Seed Catalogue" · v1 · 2026-11-16

The site is a modern seed catalogue printed like a vintage botanical plate book.
Every surface grows out of the approved artwork (artwork-pilot/, artwork-crops/):
delicate botanical watercolor on warm cream paper, fine inked detail, soft sage
greens, muted floral colour. The UI never competes with the art — it is the paper
the art is printed on.

**Hard constraints (from SPEC-CANONICAL.md — unchanged by this theme):**
no prices anywhere; "Not yet rated" stays; every listing keeps source + check date;
WCAG 2.2 AA; mobile-first at 390 pt; LCP < 2.5 s, ≤150 KB JS on a variety page;
presentation layer only — no data, routing, API, indexability or content changes.

---

## 1. Palette

Sampled from the approved pilot artwork (paper ground measured at #F8F1E1–#F9F2E4
across all six plates) and deepened for text contrast. Every text/background pair
below was computed and meets WCAG AA (≥4.5:1 body text, ≥3:1 large text & UI
boundaries). Decorative-only colours are marked and must never carry text.

| Token | Hex | Role | Contrast evidence |
|---|---|---|---|
| `--color-paper` | `#F8F1E1` | Page ground — the plate paper | — |
| `--color-paper-deep` | `#F0E5CB` | Recessed bands, footer ground, tab-bar wash | decorative |
| `--color-surface` | `#FFFDF6` | Cards, sheets, inputs — a fresh leaf of paper | — |
| `--color-ink` | `#2E2A23` | Body text, headings | 12.7:1 on paper · 14.0:1 on surface |
| `--color-ink-soft` | `#4A4438` | Secondary headings, strong captions | 8.6:1 on paper |
| `--color-muted` | `#6A5F4C` | Captions, metadata, provenance lines | 5.6:1 on paper · 6.2:1 on surface |
| `--color-leaf-deep` | `#1E4634` | Primary buttons, active tab, key headings | 9.4:1 on paper · white on it 10.6:1 |
| `--color-leaf` | `#2E6B4F` | Hover/secondary green, icons | white on it 6.3:1 |
| `--color-link` | `#1F5C3D` | Inline links | 7.0:1 on paper · 7.8:1 on surface |
| `--color-sage-tint` | `#E3EAD8` | "In stock" badge ground, chip hover, washes | leaf-deep on it 8.6:1 |
| `--color-sage` | `#7D9B76` | Decorative foliage, swatch mid-tones | decorative only |
| `--color-petal` | `#8E2A52` | Accent: ratings line, sold-out text, links of emphasis | 7.2:1 on paper |
| `--color-petal-tint` | `#F7E8EC` | "Sold out" badge ground | petal on it 6.8:1 |
| `--color-ochre` | `#8A5E08` | Warning/"see seller" text | 5.1:1 on paper |
| `--color-ochre-tint` | `#F7EDD3` | Warning badge ground | ochre on it 4.9:1 |
| `--color-line` | `#E0D5B8` | Hairlines, card borders (decorative edge) | decorative |
| `--color-line-strong` | `#97865F` | Input borders, chip borders, tab-bar top rule | 3.2:1 on paper · 3.5:1 on surface |
| `--color-focus` | `#7A3E10` | Focus-visible outline (warm umber, unmistakable on cream) | 7.4:1 on paper |

**Usage rules**
- Ground is always paper or surface; never white (#FFFFFF appears only as text on leaf-deep/petal).
- Green is the working colour (actions, links, active states). Petal is the flower
  colour — accents, badges, the rating line — never a button fill except the
  seller "Visit shop" emphasis if already petal (keep existing semantics).
- Floral brights (sweet-pea violet `#8B7FB8`, marigold `#D9A441`, blush `#D89AAE`,
  cornflower `#7C8FC7`) live **inside illustrations and colour swatches only**.
- Washes (sage-tint / paper-deep at full bleed) separate major home sections —
  no grey bands anywhere.

## 2. Typography

Two self-hosted variable fonts (latin subset, woff2, in `app/fonts/`, loaded via
`next/font/local`, `font-display: swap`; files already in the repo — do not fetch
external fonts):

- **Fraunces** (`fraunces-var.woff2`, `fraunces-var-italic.woff2`) — display serif.
  Soft, old-style, faintly wonky: the voice of the plate captions. Used for h1–h3,
  variety & crop names, the wordmark, prices-of-attention text (coverage line),
  pull quotes. Weights 400–700, `font-optical-sizing: auto`. Preload this one only.
- **Newsreader** (`newsreader-var.woff2`, `newsreader-var-italic.woff2`) — text serif.
  Bookish and highly legible at 16–18 px. Used for body copy, listing rows,
  descriptions, prose pages. Weights 400–600.
- **System sans** (`system-ui` stack, unchanged) — the tool layer only: tab-bar
  labels, chip text, badge text, form labels, buttons, metadata timestamps.
  The contrast is deliberate: serif is the printed world, sans is the instrument.

**Scale (rem, mobile-first):** display 2.5/1.1 · h1 2.0/1.15 · h2 1.5/1.2 ·
h3 1.1875/1.3 · body 1.0625/1.6 · small 0.875/1.5 · caption 0.75/1.45.
Variety names on cards: Fraunces 500. Scientific names: Newsreader italic, muted.
Letter-spacing: headings −0.01em; eyebrows +0.09em uppercase sans 700.

## 3. Surface & texture language

- **Paper grain:** one tiny repeating noise texture (`/theme/paper-grain.webp`,
  ≤ 20 KB, generated with the theme set) tiled at 3–4 % opacity over the body
  ground via a fixed pseudo-layer. It must not reduce text contrast (it sits
  under content, over the flat paper colour) and is disabled under
  `prefers-reduced-motion`? No — it's static; instead it is removed in
  forced-colors mode and never placed behind small text blocks on cards
  (cards stay flat surface colour).
- **Deckle edge:** hero and spot illustrations sit in frames with a soft
  watercolor-bled edge — achieved by the artwork itself (painted to the edge of
  its cream ground, which blends into the page paper) plus a 1 px line-colour
  inner border and a large soft radius (18 px). No drop shadows heavier than
  the existing card shadow; the world is flat paper, not glass.
- **Botanical line-work:** a single hand-drawn style divider — a thin stem with
  two leaves (`/theme/divider-stem.svg`, stroke ink-soft at 55 %) — used under
  the home hero, above the footer, and between prose sections. One motif,
  reused; never a library of ornaments.
- **Washes:** section bands use flat sage-tint / paper-deep with a torn-edge
  SVG mask top and bottom (one shared mask asset). Keep bands behind headings
  and card grids only, never behind listing rows.

## 4. Illustration system

All art is original watercolor in the pilot discipline: botanical accuracy of
form and colour, cream paper ground (#F8F1E1 family), fine inked detail, no text
inside any image, no people, no photography. **Any art depicting a real variety
must be verified against a reference photo of that variety before acceptance**
(the pilot rule — colour/form check, recorded in SOURCES.md). Decorative scenes
(hero, empty states) are verified for palette/style match against the pilot.

| Placement | Asset | Spec |
|---|---|---|
| Home hero | `artwork-theme/hero-cutting-garden.webp` | Wide 3:2 landscape cutting-garden scene: rows of zinnias, cosmos, sweet peas on a trellis, sunflowers at the back, a gardener's path — palette-disciplined. Right-weighted composition so headline text can sit left on desktop; on mobile it stacks above the headline. |
| No sellers yet (zero-seller variety) | `artwork-theme/empty-no-sellers.webp` | Portrait spot: a single stem in an empty seed tray / an unopened seed packet leaning on a plant label — hopeful, not sad. |
| Search zero results | `artwork-theme/empty-search.webp` | Portrait spot: a magnifying glass resting beside pressed flowers and a blank label. |
| About / data page | `artwork-theme/about-data.webp` | Landscape spot: an open seed ledger with pressed specimens and a hand lens. |
| Seller / farms section | `artwork-theme/farms-basket.webp` | Landscape spot: a market basket of cut flowers with seed packets, farm-gate feel. |
| 404 / offline | `artwork-theme/offline-path.webp` | Portrait spot: a garden path that wanders off the page edge, one signpost with no writing. |
| Footer flourish | divider-stem.svg (see §3) | Reused motif, not a new painting. |
| PWA icon | `artwork-theme/icon-source.webp` → regenerated icon set | A single bold zinnia head in petal/ochre on paper, drawn chunky enough to read at 48 px; maskable-safe (subject inside 80 % circle). Splash: paper ground + icon + wordmark. |
| OG card template | painted frame, code-composited | 1200×630: paper ground, grain, divider stem, Fraunces title, variety illustration at right when one exists (existing variety/crop media), else the hero crop. Generated by the existing OG route — restyle, don't rebuild. |
| Wordmark | Typographic lockup (no drawn logo) | "Seed Finder" in Fraunces 600 with a small divider-stem SVG between "Seed" and the tagline; header uses it at 1.25 rem. Tagline (header only, desktop): "every flower seed, every small farm". |

**Making more art (standing rules):** one subject per plate; cream ground always;
saturation capped at the pilot's (nothing neon, nothing greyscale); stems/leaves
in the sage→leaf range; verify real varieties against references; record every
asset in artwork-theme/SOURCES.md with prompt + verification note.

## 5. Components

- **Cards (crop, variety, seller):** surface ground, 1 px line border, radius
  18 px, existing soft shadow warmed (`rgb(90 70 20 / 0.08)`). Image area keeps
  its current rect; a hairline sage-tint band under the image. Titles Fraunces.
  Hover (pointer-fine only): border → line-strong, translateY(−1px), 160 ms.
- **Buttons:** primary = leaf-deep fill, white sans 600, radius 12 px, a 1 px
  darker bottom edge (letterpress feel). Secondary = surface fill, leaf-deep
  text, line-strong border. Focus ring = focus colour, 3 px, offset 2 px.
- **Chips:** pill, surface fill, line-strong border, sans small; active chip =
  sage-tint fill + leaf-deep text + leaf-deep border.
- **Search box:** large, surface fill, line-strong border, radius 14 px,
  magnifier icon in leaf; on the home hero it sits on paper with the hero art
  above/beside — never in a grey well.
- **Listing rows:** Newsreader body; seller name Fraunces 500; provenance and
  "Last checked" lines in muted sans caption; rows separated by line hairlines,
  not boxes. The outbound button stays primary.
- **Badges:** sans 700 caption, uppercase +0.06em, radius 999 px, 1 px border of
  the text colour at 40 %: In stock = leaf-deep on sage-tint · Sold out = petal
  on petal-tint · Unknown/see seller = ochre on ochre-tint. "Not yet rated" =
  ink-soft text with a small outline star, on surface — quiet, never a score.
- **Tab bar (Home / Crops / Search / Farms):** paper-deep ground with a
  line-strong top rule and backdrop blur at 92 % paper; icons in ink-soft;
  active item leaf-deep with a 3 px petal dot above the label (the one jewel
  in the chrome). Labels sans 600 caption size. Safe-area padding unchanged.
- **Header:** paper ground, wordmark left, hairline bottom border in line;
  on scroll it may gain the paper-deep wash — no shadow.
- **Breadcrumbs / pagination / forms:** inherit tokens; inputs surface fill,
  line-strong borders, radius 10 px; labels sans 600 small.
- **Footer:** paper-deep ground, divider stem centred above it, ink-soft text,
  wordmark small; links link-green.

## 6. Motion

App-like and restrained: 160–220 ms ease-out on hover/press states, card image
crossfade on load (opacity 0→1 once decoded), page content fade-in ≤ 120 ms.
No parallax, no entrance choreography, no looping animation (the skeleton
shimmer is replaced with a flat paper-deep pulse). Everything honoured under
`prefers-reduced-motion: reduce` (existing global rule stays and wins).

## 7. What does NOT change

Data, routes, API, copy (except none), indexability, JSON-LD semantics, the
media/artwork already live (93 crops + 6 varieties), prices hidden, ratings
state, provenance lines, the service worker's behaviour, and every test that
asserts content or behaviour. Tests asserting the old token values/colours may
be updated to the new tokens — each such change listed in the build report.
