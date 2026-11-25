# Preview visual fix — tab bar port, preflight parity, missing component CSS

Dustin's visual pass on the SPA preview (2026-11-25) failed the build: the
bottom tab bar renders as five empty dashed-border boxes, and a rendered
sweep found the visual layer broken across most templates. Quinn's preview
gate verified statuses and content; nobody had driven the app rendered
against production until now. This brief fixes the visual layer. All work
is in `app/` only. No `v2/` changes, no D1 changes, no copy changes, no
behavior changes beyond what is listed.

Diagnosis (verified by rendered sweep at 390px + 1280px against the merged
tree, screenshots + layout metrics on file with the coordinator):

## Root cause A — the tab bar is the Slice 1 skeleton placeholder

`app/pages/+Layout.tsx` mounts `app/src/components/TabBarPlaceholder.tsx`:
five empty `<li>` slots, no links, no labels, no icons;
`app/src/shell.css` gives each `.tabbar-slot` a `1px dashed` border. It was
a deliberate skeleton ("reserve the footprint; the gated D1 design builds
post-cutover") and no slice ever replaced it with a port of the live bar.
It also renders at desktop widths, where production shows no bottom bar.

## Root cause B — the port dropped Tailwind's preflight resets

There is not one `box-sizing` declaration in any `app/src/**/*.css`, and no
global media rule. v2 gets both from `@import "tailwindcss"` preflight.
Measured consequences at 390px viewport:

- Every page overflows horizontally by +32px (`.site-header-inner` is
  `width:100%` + `padding: 0 1rem` under content-box = 422px; the header's
  hamburger is clipped at the right edge; the home eyebrow's first line
  runs past the viewport edge — the kicker Dustin saw).
- Form pages overflow +42px (input padding/borders under content-box).
- Images render at natural width wherever component CSS doesn't constrain
  them: state plate 1602px (`/state/oregon` scrolls to 1658px), seller
  index theme art 1402px, 404 art 882px, variety card images fixed 480px.

## Root cause C — whole component families have no CSS rules

Cross-check of every `className` in `app/src` + `app/pages` against every
selector in `app/src/**/*.css`: ~150 classes have no rule anywhere. In v2
their layout lives in Tailwind utilities inside the components; the port
renamed them to semantic classes and never wrote the CSS. Rendered proof:

- Browse filters on `/variety`, `/search`, crop detail, shop: raw
  `<fieldset>` boxes with bulleted lists of default browser buttons —
  no chip styling, no single-line swipeable strip (the strip classes
  `filter-strip*` have no rules; `.chip-filter` exists only in
  `variety.css`, which browse index pages don't import).
- Seller shop: facts rows and contact rows run together ("Clinton,
  SCSouth Carolina", "Customer service888-645-2323") — `seller-facts*`,
  `contact-*`, `seller-locations*`, `seller-card*`, `shop-*` unstyled.
- State page: the Add Your Farm note wraps around its button
  (`state-add-farm*` unstyled); series (`series-*`), search results
  (`search-*`), crop view + grower guide (`crop-*`, `guide-*`), imported
  rating panel (`imported-*`), pagination (`pagination*`), applied-filter
  chips (`applied-filters*`, `chip-removable`), offline page
  (`offline-*`), and admin `admin-note-card` / `admin-trend` likewise.

## Fix 1 — Port the CURRENT LIVE tab bar (faithful, not the redesign)

Replace `TabBarPlaceholder` in the shell with a real `TabBar` component
ported from `v2/components/layout/TabBar.tsx` + the five icons from
`v2/components/layout/icons.tsx` (HomeIcon, SeedIcon, BloomIcon, FarmIcon,
SearchIcon — copy the SVG paths exactly). The frozen D1 redesign
(`muse-tasks/tab-bar-d1-build.md`) is NOT this work and stays frozen.

- Tabs, in order: Home `/`, Crops `/crop`, Varieties `/variety`,
  Sellers `/seller`, Search `/search`.
- Active matching exactly as v2: Home only on `/`; Crops on `/crop*` and
  `/series*`; Varieties on `/variety*`; Sellers on `/seller*` and
  `/state*`; Search on `/search*`. Active state: leaf-deep color +
  a 3px petal dot above the label, the dot's space reserved on every tab.
  `aria-current="page"` on the active link; nav `aria-label="Primary"`.
- Geometry/styling exactly as v2 renders today: fixed bottom, full width,
  top border line-strong, paper-deep at 92% + backdrop blur, 64px bar
  height, inner grid max-width 32rem centered, 5 equal columns, each link
  a ≥44px target, icon above label, label in the sans tool layer
  (Source Sans 3) at 0.75rem / 600 weight, ink-soft inactive color,
  safe-area-inset-bottom padding. **Hidden at ≥768px** (v2 is `md:hidden`)
  — production desktop has no bottom bar.
- The current route comes from Vike's page context (the app equivalent of
  v2's `usePathname`); it must be correct in the prerendered HTML per
  route, not only after hydration.
- Delete the placeholder component and its `.tabbar-*` CSS. Record the
  bar's comp values in `app/src/design-system/tokens/tokens.comp.json`
  traced to the v2 rules, per that file's convention (its comment says no
  tabbar roles existed because the bar was a placeholder — that reason is
  gone).
- The shell's existing `scroll-padding-bottom` (5rem) already anticipates
  the bar; verify page content is never hidden behind it at phone width
  and that no bottom padding for the bar remains at ≥768px.

## Fix 2 — Preflight parity

Add the global base rules the port dropped, in the app's base layer
(`app/src/shell.css` top, or a dedicated base section — follow the file's
existing organization):

- `*, *::before, *::after { box-sizing: border-box; }`
- Media: `img, svg, video, canvas { max-width: 100%; }` and
  `img, video { height: auto; }` — match Tailwind preflight's effect on
  this app; do not add preflight rules whose absence is not a measured
  defect here.
- Audit the fallout: components that (accidentally) depended on
  content-box sizing must be corrected to their v2-rendered geometry, not
  left shifted. The verify suite plus the gate's rendered sweep judge
  this; call out any component you had to adjust in the PR summary.

## Fix 3 — Write the missing component CSS

For each unstyled family, take the values from the corresponding v2
component's Tailwind utilities (the port's source of truth) and write the
rules in the CSS file that owns that template today (follow the existing
split: shell.css / templates.css / variety.css / forms.css / admin.css;
if browse styles belong with the browse templates, put them where the
owning pages actually import them — `/variety`, `/search`, `/crop`,
`/seller` index pages currently import neither variety.css nor a browse
sheet, which is part of the bug).

Families (from the cross-check; treat it as a floor, not a ceiling —
rerun the cross-check and account for every remaining unstyled class as
either styled by your change or named in the PR summary as an intentional
state/hook class): browse filters + sort + strip + applied row +
pagination; seller shop (facts, contact block, locations, cards, grid,
shop browse/search/sort); series; state; search page + results; crop view
+ grower guide + guide tabs; imported rating panel; offline page;
`_error` extras (`gone*`); admin note card + statistics trend.

Non-negotiables from the standing design record:

- Filter rows are single-line swipeable strips that never wrap; chips
  carry their counts; the strip's scroll buttons/fades match v2.
- The shop keeps its gated design: grouped sort, contact block under the
  "Visit their website" button, locations area — as rendered by v2 today.
- No visual redesign: where v2 and the app's existing styled CSS agree,
  match v2's rendered output. This is a port-fidelity fix, not a design
  pass.

Also verify (compare rendered against production, fix if the app differs):
the variety-detail header color disc (a Cool Crimson render shows a
diagonal-stripe disc — confirm whether production shows the same for this
variety's swatch data or a solid crimson disc; match production).

## Tests first (discriminating, per the lane's standing lesson)

Write these BEFORE the fix and state their starting-red result in the PR
summary:

1. A shell/tab-bar DOM test: the layout renders a nav labelled "Primary"
   with exactly the five links (href + visible label + an SVG icon each),
   the active link carries `aria-current` on a matching route, and no
   element with `data-placeholder` exists in the shell.
2. A CSS-coverage test: every class token used in `app/src` / `app/pages`
   classNames has a matching selector in the app's CSS, with an explicit
   allowlist in the test for state/hook classes (each allowlist entry
   justified in one line). This test is the recurrence guard for root
   cause C; it must fail on the starting tree.
3. Keep every existing suite green (`npm run verify` in `app/`, and the
   root verify chain).

## Acceptance (Quinn's gate will prove these rendered)

- Rendered at 390×844 and 1280×900, every route (home, /variety list +
  detail incl. a zero-seller page, /crop list + detail, /seller index +
  shop, /search with results, /series, /state, /account, /add-your-farm,
  /report, /about, /admin/sign-in, /admin, 404): zero horizontal overflow
  (scrollWidth == clientWidth), tab bar present with icons + labels at
  phone width and absent at desktop, filters render as styled chip
  strips, no unstyled-family surface remains.
- The PR summary states: the starting-red results of the new tests, the
  components adjusted for box-sizing fallout, and the final unstyled-class
  accounting.
