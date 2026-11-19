# Spot Painting Slot Spec — Seed Directory (seeds.hues.flowers)
### Nadia, UX/UI design specialist · 2026-11-19 · SLOT SPEC ONLY — nothing painted, no code changed, nothing deployed

Companion to: Elena's art elevation consult, `art-elevation-2026-11-18.md`,
proposals 1 (Add Your Farm) and 3 (account page). This document fixes the
exact slots those two paintings must be composed for, so Elena paints for
the real layout — not for the consult's approximate sizes.

**The two paintings**

1. **Farm-gate still life** — bucket of cut flowers + a small stack of the
   farm's own seed packets on a gate-side table, morning light. No signage
   lettering. Slot on `/add-your-farm`.
2. **Seed-packet organiser** — open seed-packet organiser / garden journal
   with blank labels, a pencil resting across it. No lettering of any kind.
   Slot on `/account`.

Both share ONE slot system (defined once in §3) so the two pages feel like
the same catalogue. Elena composes both to the same ratio and size.

---

## 1. Audit first — what the live surface actually does

Verified 2026-11-19 against: the live pages (fetched today), production
HTML via curl, the v2 codebase (`~/workspace/seeds-hues/v2/`), and the
actual asset files measured with PIL. Not from memory.

**The two target pages today**

- Both are a single left-aligned article, `max-w-3xl` (768px), inside
  `.container-page` (max 1152px, 16px inline padding each side at mobile
  widths). Neither page carries any artwork at all — Elena's audit point 1
  is confirmed in code: no `ThemeArt`, no motif, nothing.
- `/add-your-farm` (`app/add-your-farm/page.tsx`): H1 → intro paragraph
  (`mt-3 text-lg`) → signed-in/out note (`mt-2`) → `AddYourFarmForm`
  (`mt-6`, itself `max-w-2xl`). The form is a client component with two
  states: the form, and on success a replacement card
  (`data-testid="farm-thanks"`, `role="status"`). The success state swaps
  ONLY the form — the page head (H1 + intro) stays mounted.
- `/account` (`app/account/page.tsx`): two completely different renders.
  Signed-out: H1 → optional deleted-account banner (`?deleted=1`) → intro
  (`mt-3 text-lg`) → create/sign-in split (`mt-8 grid grid-cols-1 gap-10
  md:grid-cols-2`). Sub-states (create → email code step, sign-in errors)
  swap inside the split's columns. Signed-in: the article is replaced
  wholesale by `AccountPanel` ("Hello, {first}", Alerts, settings cards) —
  different H1, no intro, no split.

**How existing spots are placed, sized, framed, served (the pattern to follow)**

| Asset | Intrinsic (measured) | Where | Rendered placement |
|---|---|---|---|
| `farms-basket.webp` | **1400×933 (3:2 landscape)** | `/seller` | After H1, `art-frame mt-4 h-auto w-full max-w-3xl`, `priority` |
| `about-data.webp` | **1400×933 (3:2 landscape)** | `/about`, `/about/data` | After H1, `art-frame mt-4 h-auto w-full`, `priority` |
| `hero` | 960×640 / 1600×1067 (3:2) | `/` | Right column of a 2-col head grid on md+, stacked above H1 on mobile, `art-frame h-auto w-full`, `priority` |
| `empty-no-sellers.webp` | 880×1000 (portrait, 0.88) | variety, zero sellers | Centred, fixed height: `art-frame mx-auto mt-4 h-[220px] w-auto` → displays ≈194px wide |
| `empty-search.webp` | 880×1089 (portrait, 0.81) | search, zero results | Same fixed-height pattern → displays ≈178px wide |
| `offline-path.webp` | 880×1373 (portrait, 0.64) | `/offline`, 404 | Centred, `art-frame mx-auto mb-4 h-[260px] w-auto` → displays ≈167px wide |

- **Frame (`.art-frame`, `app/globals.css`):** `1px solid var(--color-line)`
  (#E0D5B8), `border-radius: 18px` (`--radius-card`), `background:
  var(--color-paper)`, `overflow: hidden`, **no shadow**. The "deckle" is
  not a CSS effect — per THEME-ART-DIRECTION §3 it is painted into the
  artwork itself (painted to the edge of its cream ground, which blends
  into the page paper) plus this hairline + radius. There is no other frame
  treatment anywhere on the site; do not invent one.
- **Ground:** paintings sit directly on the page paper ground —
  `--color-paper: #F8F1E1` with the tiled paper-grain layer behind page
  content. Cards stay flat `--color-surface` (#FFFDF6) and never carry a
  painting. A cream-ground painting placed inside a surface card would
  show as a patch.
- **Alt text:** every theme spot is decorative — `ThemeArt` hardcodes
  `alt=""`, fixed `width`/`height` attributes reserve the box before load
  (no layout shift), `loading` is eager only when `priority` is set.

**Serving pattern — record this exactly, bench (changed by the 2026-11-18
R2 migration; the local files are NOT what renders)**

1. Stored path is canonical: `/theme/<name>.webp`.
2. The full-quality original lives in **R2 bucket `seeds-hues-images`** at
   key `theme/<name>.webp` (identity mapping for all existing theme art),
   served from our own zone `images.seeds.hues.flowers`. A copy also sits
   in `public/theme/` in the repo (all existing spots have one), but
   `public/` is not the rendering path for theme paintings — CSS references
   only `paper-grain.webp` and `divider-stem.svg` directly.
3. `lib/images-data.ts` (`IMAGE_KEYS`, GENERATED — regenerate with
   `npm run images:data`, never hand-edit) maps the stored path to the R2
   key.
4. Rendering goes ONLY through `components/ui/ThemeArt.tsx` →
   `lib/images.ts` `imageUrl()`, producing
   `https://images.seeds.hues.flowers/cdn-cgi/image/width=<w>,quality=80,format=auto,fit=scale-down/theme/<name>.webp`.
   `fit=scale-down` ONLY — shown whole, never cropped, never stretched,
   never upscaled past the original. Never a raw `<img src="/theme/…">`,
   never `next/image`, never a hotlink (house rule).

**⚠ Discrepancy flagged — the consult's size line does not match the live site**

Elena's proposals 1 and 3 say "portrait spot … (~480–720px display width,
WebP, painted at 2×)". Measured against the live code, no existing spot
works that way:

- The two head spots (`farms-basket`, `about-data`) are **landscape 3:2**,
  display at full article width (343px at a 375px viewport, up to 768px on
  desktop), and their 1400px intrinsic width is ≈1.8× the maximum display
  width — roughly 2×, but of a landscape banner, not a portrait.
- The existing **portrait** spots are 880px wide intrinsically but display
  small and height-capped (≈167–194px wide) in empty/offline states —
  ≈3.4–4.9× oversampling, not 2×.

So "portrait at 480–720 display, painted 2×" cannot be copied from any
existing slot: a portrait shown at full article width would be 429px tall
on a 375px phone and 960px tall on desktop, burying both forms. §3 below
is a new head-slot sized from the real layout maths, using the existing
portrait asset width (880px) so the new files sit in the same family. Hue:
this supersedes the consult's parenthetical size line; the subjects,
orientation (portrait), ground, and jobs from proposals 1 and 3 are
unchanged.

---

## 2. Layout maths the slot is built from (measured, not guessed)

- Viewport 375px → container content 343px → article 343px.
  Viewport 390px → article 358px. Viewport 320px → article 288px.
- Desktop: article caps at 768px regardless of viewport (1024px and
  1280px viewports both give a 768px article).
- A full-width portrait in this article is therefore unusable (see §1).
  The slot instead reuses the home hero's one proven pattern for a
  portrait-ish image at a page head: **stacked on mobile, beside the
  heading text in a two-column head grid on desktop** (home hero:
  `md:grid md:grid-cols-2 md:items-center md:gap-8`).

---

## 3. THE SLOT SYSTEM — both paintings, identical spec

**Orientation / aspect ratio: portrait 4:5 exactly (width : height = 0.80).**
Composition must fit 4:5. The painting is shown whole at this ratio —
nothing is cropped, so anything Elena paints at another ratio will
letterbox against the paper ground or force a layout change. 4:5 is
grounded in the closest existing portrait spot, `empty-search`
(880×1089 ≈ 0.81), rounded to a clean ratio Elena can compose to.

**Painted dimensions (what Elena produces): 880 × 1100 px**, WebP,
painted on the **#F8F1E1** paper ground, painted to the edge of the ground
(no white margin, no painted border or frame inside the image, no text —
packet labels and organiser labels blank, no gate signage).
880px is the established portrait-spot asset width (`empty-*`,
`offline-path` are all 880 wide). Against the display sizes below that is
2.75× at the largest display width — deliberately above the 2× floor, so
the file is never the soft one in the family. Do not paint larger: no
display on the site will ever request more, and file weight is budgeted.

**Display sizes (CSS px, the box the bench must render — verify both axes
in the DOM after build):**

| Viewport | Display width | Display height | Layout |
|---|---|---|---|
| Mobile 320px | 280px (shrinks with article below 312px viewport: `w-full` under the cap) | 350px (auto from ratio) | Centred, stacked in the head, below the intro text |
| Mobile 375px | **280px** | **350px** | Centred, stacked |
| Mobile 390px | 280px | 350px | Centred, stacked |
| Desktop ≥768px (md) | **320px** | **400px** | Right column of the head grid, beside H1 + intro |

**Placement (both pages, same construction):**

- The spot lives in the **page head in `page.tsx`** — never inside the
  form components (see state coverage, §4–§5).
- Desktop (md+): wrap H1 + intro (+ the signed-in/out note on
  `/add-your-farm`; + the deleted-account banner on `/account` if present)
  in the left cell of a grid, spot in the right cell:
  `md:grid md:grid-cols-[1fr_320px] md:gap-8 md:items-center`. Text column
  resolves to 416px at the 768px article cap — still a comfortable measure
  for the `text-lg` intro.
- Mobile (<md): single column in reading order — H1, intro, note/banner,
  then the spot centred. The spot never sits above the H1 (the heading and
  intro carry the information scent; art follows it — the offline page's
  art-before-H1 pattern belongs to a dead-end page, not a form page).
- Suggested `ThemeArt` className (bench may adjust mechanics, not sizes):
  `art-frame mx-auto mt-4 h-auto w-full max-w-[280px] md:mt-0 md:max-w-none`
  rendered inside the 320px grid cell on desktop (`w-full` = 320px there).
- **Frame:** `.art-frame` exactly as defined — 1px `--color-line` hairline,
  18px radius, paper background, no shadow. Nothing else.
- **Spacing / clearance:** mobile `mt-4` (16px) above the spot; no added
  bottom margin — the following block already supplies it (farm form
  `mt-6` = 24px; account split `mt-8` = 32px). Desktop grid gap 32px
  horizontally. No caption (captions were removed sitewide — settled),
  no MotifDivider between spot and form (motif rationing is settled),
  no text overlaid on the painting, ever.
- **Ground:** the painting sits on the page paper ground, outside every
  card and fieldset. Not inside the form, not inside a `.card`.
- **Loading:** add both to the `ART` table in `ThemeArt.tsx` as
  `{ width: 880, height: 1100, wide: null }` so the 4:5 box is reserved
  before load (zero CLS). Render with `priority` — both are head spots
  above the fold, matching `farms-basket` / `about-data` precedent.
- **Asset names (proposed, following existing kebab theme naming):**
  - Farm-gate: stored path `/theme/farm-gate.webp`, `ThemeArt` name
    `"farm-gate"`.
  - Organiser: stored path `/theme/account-organizer.webp`, `ThemeArt`
    name `"account-organizer"` (en-US spelling for the file/key; the
    consult's "organiser" is the same object).

**Composition guidance for Elena (from the slot, not art direction):**

- Centre-weighted still life; keep every important element inside the
  central ~80% of the canvas — the 18px corner radius and hairline frame
  sit at the edges, and nothing critical should kiss them.
- Detail must survive downscale to 280px wide: no fine detail whose loss
  changes the read (tiny packet print would — another reason labels stay
  blank).
- Farm-gate: a **bucket**, not a basket (house vocabulary steer for
  depicted vessels prefers a water-holding vessel; Elena's proposal 1
  already specifies a bucket — hold that line).

**Accepted trade-off, stated openly (mobile):** a 350px-tall spot pushes
the first form field below the fold on a 375px phone. Accepted because:
the intro precedes the art, the form follows it with no intervening
ornament, and the seller/about pages already place a head painting before
their content on mobile. The page's one job is unchanged and reachable in
one scroll. QA should still screenshot 390px and confirm it (§7).

---

## 4. Slot A — `/add-your-farm` (farm-gate still life)

- **Exact placement:** in `app/add-your-farm/page.tsx`, inside the existing
  `<article className="max-w-3xl">`, in the head grid defined in §3. Left
  cell: the existing H1 (`#farm-title`), intro paragraph, and the
  signed-in/out note paragraph, in their current order. Right cell
  (desktop) / below the note (mobile): the painting. The
  `AddYourFarmForm` follows the head unchanged.
- **State coverage:**
  - *Signed-out and signed-in arrivals:* same slot, same size — only the
    note text differs. No variant art.
  - *Form state:* shown.
  - *Success state* (`farm-thanks` card replaces the form): **shown, and
    it persists automatically** because the slot is in the page head,
    outside `AddYourFarmForm`. Do not add a second copy inside the success
    card, and do not hide it on success — the head is identical before and
    after sending, which reads as continuity, not a leftover.
  - *Error state* (form-level `role="alert"` under the submit button):
    unaffected; spot stays in the head.

## 5. Slot B — `/account` (seed-packet organiser)

- **Exact placement:** in `app/account/page.tsx`, **signed-out render
  only**, in the head grid defined in §3. Left cell: H1 (`#account-title`),
  the deleted-account banner when `?deleted=1` is present (keep it in the
  text column, full text-column width, in its current position after the
  H1), and the intro paragraph. Right cell (desktop) / below the intro
  (mobile): the painting. The create/sign-in split
  (`mt-8 grid … md:grid-cols-2`) follows the head unchanged — the painting
  is **above the split on mobile and beside the heading block on desktop**,
  which covers both halves of the consult's "above or beside".
  It is never inside either form column: a 280–320px painting inside a
  ~368px desktop column (or a 343px mobile column) would crush the forms.
- **State coverage:**
  - *Signed-out (create/sign-in split):* shown. Sub-states — create form →
    email code step, sign-in errors, Turnstile — swap inside the columns
    below the head; the slot persists through all of them.
  - *Deleted-account landing* (`?deleted=1`): shown, same slot.
  - *Signed-in (`AccountPanel`):* **NOT shown — and no space reserved for
    it.** The consult's job for this painting is to soften
    creating/signing in; once signed in, that job is done, the panel is a
    working instrument (alerts, settings), and a 350–400px painting would
    push Alerts — the panel's primary content — down on every visit.
    The signed-in article renders exactly as today. If Dustin later wants
    warmth on the signed-in view, that is a new ask, not part of this slot.

---

## 6. Accessibility — for Ada (WCAG 2.2 AA floor is hers; flags, not rulings)

- **Alt text: decorative, `alt=""`** — which `ThemeArt` already hardcodes.
  Both paintings are pure invitation/mood; everything they suggest is
  already said by the adjacent heading and intro. A meaningful alt would
  duplicate that text for screen-reader users. No `role`, no title, no
  caption, not focusable, not in the tab order.
- **Contrast:** no UI text touches or overlays the paintings, and no
  information is carried by the images, so there is no new text/background
  pairing to measure. Adjacent text keeps its existing audited pairs on
  paper (ink 12.7:1, leaf 9.4:1, muted 5.6:1 per `globals.css` tokens).
- **Flags for Ada to check at build:**
  1. The `.art-frame` hairline (`--color-line` #E0D5B8 on paper) is below
     3:1 — already the accepted treatment for all existing spots on the
     basis that the frame is a decorative edge and the image is
     non-essential. Confirm the same classification covers these two slots
     (nothing about either painting is essential content).
  2. Reflow: at 320px wide and at 200% text, the spot must scale with the
     article (`w-full` under its cap) with no horizontal scroll and no
     overlap — spec'd that way in §3, needs her verification on the build.
  3. Forced-colors mode: existing theme paintings have no special
     forced-colors handling (only the grain layer and packet keyline are
     suppressed). Confirm parity is acceptable for the new spots.
  4. Focus visibility: the paintings are non-interactive; confirm the head
     grid change does not alter the existing focus order (H1 → intro links
     → first form field) on either page.

---

## 7. Bench checklist (when the paintings exist — not this pass)

1. Upload each original to R2 `seeds-hues-images` at `theme/farm-gate.webp`
   / `theme/account-organizer.webp`; place the repo copy in
   `public/theme/`; regenerate `lib/images-data.ts` (`npm run images:data`).
2. Add both entries to `ART` in `components/ui/ThemeArt.tsx`
   (`width: 880, height: 1100, wide: null`); render via `ThemeArt` with
   `priority` and the §3 className. No other rendering route.
3. Build the head grid per §3 in the two `page.tsx` files only. No changes
   to `AddYourFarmForm`, `CreateAccountForm`, `SignInForm`, or
   `AccountPanel`.
4. Verify on the live deploy (not just local): measure the rendered
   `<img>` rect in the DOM on **both axes** — expect 280×350 at 375/390px
   viewports and 320×400 at desktop — on both pages and, for
   `/add-your-farm`, in the success state too. Screenshot 390px and
   desktop for Dustin before calling it shipped, per the visual-change
   rule. Confirm zero layout shift (reserved 4:5 box) and that the served
   URL is the `images.seeds.hues.flowers/cdn-cgi/image/…fit=scale-down`
   form.
5. House rules re-checked: paintings whole, never cropped or stretched ✓
   (spec'd); no seller counts introduced anywhere ✓; no text baked into
   artwork ✓ (Elena's brief); mobile reads as an app surface (single
   column, centred plate, form one scroll away) and desktop as a proper
   website (two-column head, 416px text measure) ✓.

---

## 8. Verification performed for this spec

- Live `/add-your-farm` and `/account` fetched today (2026-11-19) — page
  structure and copy match the code quoted above.
- Production HTML for `/seller`, `/about`, `/` read via curl — rendered
  `ThemeArt` `<img>` tags confirm the R2 transformation URLs, `alt=""`,
  width/height attributes, and classes quoted in §1.
- Asset dimensions measured from the actual files in `public/theme/`
  (PIL): `farms-basket.webp` 1400×933, `about-data.webp` 1400×933,
  portrait spots 880 wide (1000 / 1089 / 1373 tall).
- Display maths computed from `globals.css` (`.container-page`,
  `--color-paper`, `.art-frame`) and the pages' Tailwind classes.
- **Not done (bench must do it, §7.4):** no live-browser viewport rendering
  was available to this pass, so the new slots' display sizes are specified
  from code maths and existing-spot precedent, not from screenshots of a
  built slot. No dimensions in this spec are guessed — every number traces
  to a measured file, a CSS value, or arithmetic shown in §2 — but the
  built result still needs the DOM-rect check before it is called verified.

*Prepared by Nadia, UX/UI design specialist. Paper only — no artwork
generated, no site files touched.*
