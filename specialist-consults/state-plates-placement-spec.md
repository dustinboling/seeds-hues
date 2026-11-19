# State-Flower Plates — Placement Spec

**Author:** Nadia, UX/UI design specialist · **Date:** 2026-11-19 · **Status:** Design spec for the Claude Code bench — implement exactly; no production code in this document beyond class/markup patterns quoted from the live codebase.
**Piece:** Elena's art-elevation consult (2026-11-18), proposal 2, approved by Dustin — put the 16 finished state-flower plates to work in two new places, no new painting:
(a) `/seller/{slug}` — the plate for the seller's own state, beside the farm summary;
(b) `/state/{slug}` — that state's own plate, identifying the state and its farm list.

**Playbook note:** Profession's best practice applied first (Nielsen heuristics, Gestalt grouping, Jakob's Law, WCAG 2.2 AA), Dustin's house standards on top. One conflict flagged in §7 — it is resolved in favour of the house rule, as required.

---

## 0. Audit of the current surfaces (before designing)

**Seller page** (`v2/app/seller/[slug]/page.tsx`, 175 lines). One job: *is this the right farm, and what does it sell?* The `<header>` is a single text column: eyebrow (seller type) → `<h1>` name → a `<dl>` (Location / Varieties listed / Rating, `grid-cols-1 sm:grid-cols-3`) → "Visit …" CTA → optional disclosure line. The seller's state is already resolved in real data — `const state = s.country === "US" ? stateByCode(s.region) : null;` — and already rendered as a `StateShape` icon + state-name link to `/state/{slug}` inside the Location cell. Then: About section, imported-rating panel, listings. **What is missing:** any visual identity. The page is text-only from top to listings; the state connection is carried by a 22 px outline icon alone. The plate's job here is *identify + place*: make the seller's state felt, and reinforce the state link that already exists.

**State page** (`v2/app/state/[slug]/page.tsx`, 124 lines). One job: *which farms are in this state?* Structure: `<header>` containing (1) the hero `<figure data-testid="state-hero">` — the landscape scene painting (`/theme/state-scenes/{slug}.webp` via `STATE_SCENES` in `lib/data/state-scenes.ts`, rendered with `imageUrl(…, { width: 1200 })`, `className="card … max-h-[30rem] sm:max-h-[40rem]"`, eager / `fetchPriority="high"` — it is the page's LCP), then (2) a text block (`mt-6`): `<h1>` "Seed farms in {State}", intro paragraph (`data-state-intro`), "Add Your Farm" CTA. Then the farm list: `<ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-state-sellers>` of `SellerCard`s, then `Pagination`. **What is missing:** the hero scene *contains* the state flower in its foreground, but at landscape scale, inside a silhouette, it does not read as "this is the official flower." The plate's job here is *identify*: a legible, portrait-scale statement of the state's flower tied to the state name and its farms.

**The plates.** `~/workspace/seeds-hues/artwork-states/<state-slug>.webp`, 1600×1600 square flower portraits, painted to their cream edge like the site's theme illustrations. Stored path `/artwork/states/<slug>.webp`; all 16 are already mapped in `lib/images-data.ts` (lines 538–553, `.webp` → `.png` master) and serve through `lib/images.ts` (`imageUrl` / `imageSrcSet`, R2 + transformations, `fit=scale-down` only). No page uses them yet.

**The 16 states** (from `artwork-states/MANIFEST.json` and `images-data.ts` — note the brief's state list omitted Washington in prose, but WA is in both sources and is the 16th plate; this spec covers it): California, Colorado, Connecticut, Georgia, Iowa, Maine, Minnesota, Montana, Nevada, New York, Oregon, Utah, Vermont, Virginia, **Washington**, Wisconsin.

---

## 1. Shared decisions (both pages)

### 1.1 One shared component, one pattern
Build **one** presentational component and use it on both pages, e.g. `components/seller/StatePlate.tsx` (sibling to the existing `StateShape.tsx`), with props `{ slug: string; alt: string; eager?: boolean }`. Rationale — Consistency heuristic + Jakob's Law: the same object (a state's plate, beside that state's identifying text) must look and behave identically wherever it appears. Two hand-rolled copies will drift.

The component renders nothing itself when there is no plate — the *pages* decide (§2.3, §3.3); the component assumes a valid slug + alt.

### 1.2 Data: a plate table mirroring `STATE_SCENES`
Create `lib/data/state-plates.ts` in the exact pattern of `lib/data/state-scenes.ts`: a `Record<string, { alt: string }>` (or slug → alt string) keyed by **state slug**, containing **only the 16 painted states**, with the alt strings from §5. A state not in the table has no plate — that absence is the single source of truth for §2.3/§3.3. Do not derive plate existence from `STATE_SCENES` (different asset, different coverage logic) and do not hard-code slug lists in the page files.

Stored path is constructed as `` `/artwork/states/${slug}.webp` `` — the same template pattern the state page already uses for `/theme/state-scenes/${st.slug}.webp`.

### 1.3 Frame treatment — reuse `.art-frame`, invent nothing
The plates are painted to their cream edge, exactly the case `app/globals.css` defines `.art-frame` for:

> `.art-frame` — "Theme illustrations: painted to their cream edge, hairline frame, soft radius, no shadow." `display:block; border: 1px solid var(--color-line); border-radius: var(--radius-card)` (18 px); `background: var(--color-paper); overflow: hidden.`

This is the same class the variety page already puts on standalone paintings (`ThemeArt … className="art-frame …"` in `app/variety/[slug]/page.tsx`). Apply `art-frame` **to the `<img>` itself** (as the state hero applies `card` to its `<img>`), inside a plain `<figure>` with no `<figcaption>` (§1.5).

Do **not** use `.card` for the plates: `.card` (surface background + `--shadow-card`) is the treatment for the *padded, contain-fit* heroes (`VarietyHeroImage`, state hero) where the frame is a sheet the painting sits on. The plates need no padding sheet — they are finished square paintings edge-to-edge — and a shadow would make the same kind of object read differently from the site's other edge-to-edge paintings. Do **not** add `object-cover`, `object-contain`, or any aspect-ratio crop utility: the source is already 1:1 and the pipeline is `fit=scale-down` only (house rule: paintings always shown whole, never cropped).

### 1.4 Image request, attributes, loading
- `src`: `imageUrl(path, { width: 640 })` — the consult's ~640 px WebP. Display is ≤ 320 CSS px (§2.2/§3.2), so 640 covers 2× DPR with no second request; a `srcset` is unnecessary weight here (unlike the 1:2 variety hero, which genuinely serves two display sizes).
- Attributes on every plate `<img>`: `width={1600} height={1600}` (the real pixel size — reserves the 1:1 box before the file arrives, zero layout shift, the same no-CLS pattern as `VarietyHeroImage` and the state hero), `decoding="async"`, plain `<img>` (never `next/image` — sizing is the CDN's job everywhere on this site).
- Add `data-state-plate={CODE}` (USPS code, e.g. `OR`) on the `<figure>` for test/verification parity with the existing `data-state-hero-art`, `data-seller-state`, and `data-state-sellers` hooks.
- **Not a link.** The plate is identification, not navigation. On the seller page the state is already linked (the `StateShape` chip in the Location cell); on the state page the user is already there. Wrapping the plate in a second link would duplicate a target, add a focus stop with no new destination, and invite the misclick the chip already serves. No `onClick`, no hover state, no `card-hover`.

### 1.5 No caption, no label — house rule, no exception requested
No `<figcaption>`, no "Plate No.", no flower name, no state name printed under or over the plate, on either page. Captions under paintings were removed sitewide at Dustin's direction; I am **not** requesting an exception. The identification is carried by (a) adjacency — the plate sits inside the same header block as the state name / seller name (Gestalt: common region + proximity), and (b) the alt text (§5) for non-visual users. A visible flower name would also duplicate content: on the seller page the state name is already text in the Location cell; on the state page it is the `<h1>`.

### 1.6 Alt text — informative, not decorative
Unlike `ThemeArt` (decorative, `alt=""`), these plates do a job — *identify the state's official flower* — that a screen-reader user otherwise misses entirely, since no visible text names the flower. They therefore carry real alt text (§5), following the pattern of the state scenes' alts ("California landscape with golden poppies") but stating the official relationship. Final ruling is Ada's; this is the proposal she checks.

---

## 2. Seller page — `/seller/{slug}`

### 2.1 Exact placement
Inside the existing `<header>`, as its **second element in DOM order**, after a new wrapper around the existing header content:

1. Wrap everything the header currently renders (eyebrow → `<h1>` → `<dl>` → CTA `<p>` → disclosure `<p>`) in `<div className="min-w-0 flex-1">…</div>` — unchanged inside, in unchanged order.
2. The plate `<figure>` follows that div, still inside `<header>`, rendered only under §2.3.
3. `<header>` gains the row layout (§2.2). Nothing else on the page moves: About, `ImportedRatingPanel`, listings, claim line are untouched and stay after the header in current order.

**DOM order is deliberate:** seller name → location/state link → facts → CTA first, plate second. The page's job is the farm; the plate is supporting identification and must not precede the `<h1>` in reading order or push the "Visit …" CTA down the tab/reading sequence. Visual order on desktop matches DOM order left-to-right (text left, plate right) so sighted and non-sighted sequences agree — no `order-*` utilities, no visual/DOM divergence.

**Side: right (inline-end).** The summary text is the primary column and keeps the start edge where reading begins; the plate anchors the end of the header block, balanced against the `<dl>`'s three facts — the same text-left / painting-right resting the variety and crop headers use (header text block, painting following).

### 2.2 Sizes and layout per breakpoint
Content column is `.container-page` (max 72 rem, 1 rem inline padding): at 390 px the content box is 358 px wide.

| Breakpoint | Header layout | Plate display size | Notes |
|---|---|---|---|
| Base, < 640 px (phone, primary) | Stacked: text block full width, then plate **centred** below it | **280 × 280 px** | `figure` classes: `mx-auto mt-6 w-[280px] shrink-0` |
| `sm` ≥ 640 px | Side by side: `sm:flex sm:items-start sm:gap-8` on `<header>`; plate at the right of the summary | **300 × 300 px** | figure: `sm:mx-0 sm:mt-1 sm:w-[300px]` (`mt-1` optically aligns the frame top with the eyebrow line) |
| `lg` ≥ 1024 px | Same row, wider gap holds | **320 × 320 px** | figure adds `lg:w-[320px]` |

All sizes sit inside the consult's 280–360 px band. 280 px on phone is the floor of that band on purpose: it leaves the seller name, all three facts and the CTA in the first screenful above it, and a square 280 px painting still reads clearly at arm's length; going to 358 px full-bleed would make a supporting identifier the largest object on the page and push the listings — the page's payoff — a full screen down. On desktop 320 px balances a ~700 px text column without rivalling the `<h1>`.

`<img>` classes: `art-frame h-auto w-full` (width from the figure, height from the 1:1 attributes). Loading: `loading="eager"` with **no** `fetchPriority` (or `fetchPriority="low"`): the plate is in the first viewport beside the summary, so lazy-loading it would pop a 280 px hole late; but the seller page has no hero image and its LCP is the `<h1>` text, so the plate must not be promoted to high priority either.

### 2.3 Behaviour — no plate / no state (render nothing)
Render the plate **only if both** hold: `state` (the existing `stateByCode(s.region)` result for a US seller) is non-null, **and** `state.slug` is a key of the §1.2 plate table.

- Seller in a US state with **no plate** (e.g. a Texas or Ohio seller — 34 states have no painting): no figure, no placeholder, no reserved space, no substitute painting, no generic filler. The header renders as a plain single column exactly as today (the flex row simply has one child). Never show another state's plate.
- Seller with **no region on file** — currently **David's Garden Seeds** and **Seedtime**, whose `state` resolves null and who render no state chip today: nothing changes; no plate, no extra gap. Do not infer a state from the seller's name, location string, or homepage.
- Non-US seller (`state` is null by construction): no plate.

There is no error state to design: absence is silent by design, and the page is complete without the painting (Aesthetic & Minimalist heuristic — the plate is enhancement, never load-bearing content).

---

## 3. State page — `/state/{slug}`

### 3.1 The treatment decision — plate in the header, beside the intro; NOT floated beside the card grid
**Decision: rest the identification in the header.** The plate goes in the header's text block — beside the `<h1>`, intro paragraph and "Add Your Farm" CTA, immediately above the farm list — in the same text-left / plate-right row pattern as the seller page. It does **not** go inside or alongside the `<ul data-state-sellers>` grid.

Justification, against the consult's stated job (*identify — tie the state and its farms to its official flower*):

1. **Identification happens at the name, not mid-list.** The tie is between *this state* (the `<h1>`) and *its flower*. Placing the plate in the header puts flower, state name, farm count and CTA in one Gestalt group (common region, proximity) at the moment the user confirms "I'm in the right state." By the time a user is scanning farm cards, the job has changed to *compare farms* — a 300 px painting there answers a question they are no longer asking.
2. **A floated column beside the grid breaks the grid.** The list is `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` of equal `SellerCard`s. Carving a plate column out of it either drops the desktop list to 2 columns (less scannable, inconsistent with every other card grid on the site — Jakob's Law), or leaves a sticky/empty rail running beside a paginated list whose height changes per page — a long tail of blank paper under a square plate on page 1 of a 1-farm state, and a layout that reflows between pages. The header placement is the same height on every page of every state.
3. **It does not compete with the hero — it complements it.** The hero scene (landscape, silhouette, flower small in the foreground) says *place*; the plate (single flower, portrait scale, legible) says *emblem*. Two different statements, two different scales, in sequence — not a duplication. Putting the plate down beside the list instead would separate it from the state name by the full hero + intro and weaken exactly the tie it exists to make.
4. **Consistency across the two new placements.** Seller page: plate beside the identifying summary. State page: plate beside the identifying header. One pattern, learned once, recognised everywhere (Consistency heuristic; Serial Position — the plate is part of how a state is *introduced* on this site).
5. **Mobile order stays honest.** In the header, the phone order is: hero → name/intro/CTA → plate → farms. The user meets the farms one short scroll after the CTA; a beside-the-list plate on mobile would either precede the first farm card (delaying the list's first item — the thing the page exists for) or interleave into the grid as a fake card.

### 3.2 Exact placement and sizes
Inside `<header>`, the existing text block `<div className="mt-6 min-w-0">` (holding `<h1>`, `data-state-intro` paragraph, CTA paragraph) becomes the flex row:

1. Wrap the `<h1>` + intro + CTA in `<div className="min-w-0 flex-1">…</div>` (contents unchanged, order unchanged).
2. The plate `<figure>` follows it, inside that same `mt-6` container, rendered only under §3.3.
3. The hero `<figure data-testid="state-hero">` above is **untouched** — same asset, same `width: 1200` request, same eager/high-priority loading. The plate must never become the page's LCP candidate.

| Breakpoint | Layout | Plate display size | Notes |
|---|---|---|---|
| Base, < 640 px | Stacked: intro text block, then plate **centred** below the CTA | **280 × 280 px** | figure: `mx-auto mt-6 w-[280px] shrink-0` |
| `sm` ≥ 640 px | Row: container gains `sm:flex sm:items-start sm:gap-8`; plate right of the intro | **300 × 300 px** | figure: `sm:mx-0 sm:mt-1 sm:w-[300px]` |
| `lg` ≥ 1024 px | Same row | **320 × 320 px** | figure adds `lg:w-[320px]` |

Identical sizes to the seller page (§2.2) — one component, one size ladder. `<img>`: `art-frame h-auto w-full`, `width={1600} height={1600}`, `decoding="async"`, `data-state-plate={st.code}` on the figure.

Loading: **`loading="lazy"`, no `fetchPriority`** — the deliberate difference from the seller page. This page already has an eager, high-priority hero; the plate sits below it and must not compete for the first paint. Its 1:1 box is reserved by the width/height attributes, so lazy loading causes no shift when it arrives.

### 3.3 Behaviour — state with a page but no plate
Only states with ≥ 1 visible seller resolve at all (existing rule, unchanged). Of those, any state **not** in the §1.2 plate table (e.g. Texas, Ohio, Pennsylvania, if/when they have sellers) renders the header exactly as today: hero (if a scene exists — scenes and plates are independent tables; do not couple them), intro, CTA, list. No figure, no placeholder, no reserved space, no substitute. All 16 painted states have pages today, so at launch every painted plate appears; the no-plate path is for the other states as sellers are added.

Pagination: the plate lives in the header, outside the paginated region — it renders identically on page 1 and page N, and `Pagination` behaviour is untouched.

---

## 4. Accessibility notes for Ada's pass (WCAG 2.2 AA)

- **Alt text** (§5) is the only text alternative; the plates are informative (identification), so `alt=""` would fail the job for non-visual users. No visible caption exists to duplicate, so the alt does not repeat visible text (the state name in the alt's tail is the relationship, not a repetition of the heading).
- **No interactive element** is added: no new focus stops, no tab-order change, focus visibility unaffected. DOM order = visual order on both pages (§2.1), so reading order is coherent at 320 px reflow and 200 % text resize — the flex rows stack before they can squeeze (base layout is single-column; the row only exists ≥ 640 px where both columns fit).
- **No text sits on the paintings** and no information is carried by colour alone — the plate is redundant with the adjacent state name for sighted users and named by alt for non-sighted users.
- **Motion:** none. No animation, hover, or transition is added.
- Maine flag for Ada: Maine's official floral emblem is the white pine cone and tassel — not a flower. The §5 alt follows the house pattern ("…, Maine's state flower") for consistency with the MANIFEST's own filing of it as the state flower; if Ada prefers literal accuracy ("Maine's state floral emblem"), that one string is hers to amend without touching the pattern elsewhere.

## 5. Alt-text pattern and the 16 strings

**Pattern:** `{Flower common name}, {State}'s state flower` — common name in its short form from `artwork-states/MANIFEST.json` (parenthetical synonyms dropped, as in the brief's example), sentence case, no scientific name (the directory's public surfaces use common names; the Latin would serve no identification purpose here and lengthens the announcement).

| State (slug) | Alt text |
|---|---|
| California (`california`) | `Golden poppy, California's state flower` |
| Colorado (`colorado`) | `White and lavender columbine, Colorado's state flower` |
| Connecticut (`connecticut`) | `Mountain laurel, Connecticut's state flower` |
| Georgia (`georgia`) | `Cherokee rose, Georgia's state flower` |
| Iowa (`iowa`) | `Wild rose, Iowa's state flower` |
| Maine (`maine`) | `White pine cone and tassel, Maine's state flower` |
| Minnesota (`minnesota`) | `Pink and white lady's slipper, Minnesota's state flower` |
| Montana (`montana`) | `Bitterroot, Montana's state flower` |
| Nevada (`nevada`) | `Sagebrush, Nevada's state flower` |
| New York (`new-york`) | `Rose, New York's state flower` |
| Oregon (`oregon`) | `Oregon grape, Oregon's state flower` |
| Utah (`utah`) | `Sego lily, Utah's state flower` |
| Vermont (`vermont`) | `Red clover, Vermont's state flower` |
| Virginia (`virginia`) | `American dogwood, Virginia's state flower` |
| Washington (`washington`) | `Coast rhododendron, Washington's state flower` |
| Wisconsin (`wisconsin`) | `Wood violet, Wisconsin's state flower` |

## 6. What the bench must NOT do

1. **No cropping, ever** — no `object-cover`, no aspect-ratio utility that clips, no `fit=cover`/`crop` transformation. `imageUrl` is `fit=scale-down` only; keep it that way. Paintings shown whole (house rule).
2. **No caption or label** — no `<figcaption>`, no "Plate No.", no flower/state name printed under, over, or beside the plate as a caption (§1.5). No exception has been requested or granted.
3. **No substitute or filler** — a seller/state without a plate gets *nothing*: not another state's plate, not the state scene, not a crop/variety painting, not a placeholder box or skeleton left in the layout.
4. **No inferred states** — plate selection comes only from `stateByCode(s.region)` (seller) / the page's own state (state page) intersected with the §1.2 table. Never parse the location string, seller name, or homepage to guess a state (David's Garden Seeds and Seedtime stay plateless until their region is on file).
5. **No link, no interactivity** on the plate or its figure (§1.4).
6. **Do not touch the state hero** — asset, `STATE_SCENES`, 1200 px request, `card` class, eager/high-priority loading all stay. Do not reuse the scene as the plate or the plate as the scene.
7. **Do not hotlink or hand-build image URLs** — every plate goes through `imageUrl()` from `lib/images.ts` at width 640, stored path `/artwork/states/{slug}.webp`. No `next/image`, no new image files, no w-variants.
8. **Do not add the plate anywhere else** — not in `SellerCard`, not in the `/seller` index, not in search results, not as an og:image. This spec covers exactly two placements.
9. **Do not reorder existing content** — on both pages the only structural change is the wrapper div + figure inside the existing header; headings, the state chip link, CTA, About, ratings, listings, pagination and the claim line keep their current order and markup.
10. **No new frame styling** — no new CSS class, no inline shadow/border experiments. `.art-frame` as-is (§1.3); if it does not fit, stop and return to Nadia rather than inventing a variant.

## 7. Flags

- **House rule vs. best practice (house wins):** NN/g practice would normally pair an unfamiliar botanical painting with a visible identifying label, and several plates (sagebrush, bitterroot, white pine cone and tassel) are not flowers a visitor will name on sight. Dustin's standing rule — no captions under paintings, removed sitewide — overrides this. The identification gap is mitigated, not eliminated, by adjacency to the state name and by the §5 alt text. Flagged, not silently defaulted, per the brief; no exception requested.
- **Brief discrepancy (resolved from ground truth):** the brief's prose list of painted states names 15 and omits Washington while calling the set 16; `MANIFEST.json` and `lib/images-data.ts` both contain Washington (`coast rhododendron`). This spec treats the set as the 16 in §0/§5.
- **Verification owed at handoff (not part of this spec):** rendered-size check at 390 px and desktop on both pages (DOM-measured, both axes), one no-plate seller (David's Garden Seeds or Seedtime), one no-plate state page if one resolves, and Ada's accessibility pass on §4/§5 before this reaches Dustin.

---

## Ada — Accessibility Ruling

**Reviewer:** Ada, accessibility specialist · **Date:** 2026-11-19 · **Scope:** §§1–7 of this spec, checked against `artwork-states/MANIFEST.json` (common names + authoritative sources) and WCAG 2.2 AA, criterion by criterion.
**Verdict: PASS WITH AMENDMENTS** — the placement, framing, loading and reading-order design pass the floor as specified; two of the 16 alt strings in §5 are amended below (one factual, one source-fidelity). The amended strings in §A.2 are the final strings — the bench builds from this section, not from the §5 table, where they differ. Nothing in this ruling claims certification: this is an engineering review of a spec, and the live checks in §A.5 remain owed at handoff.

### A.1 Alt text — the principle (§1.6, §5)

- **Informative, not decorative — CONFIRMED.** The plates do a job no visible text does: no caption exists (house rule, §1.5) and no visible text anywhere on either page names the flower, so the flower's identity is information available to sighted users from the painting that non-visual users would otherwise miss entirely. Criterion **1.1.1 Non-text Content (A)** therefore requires a real text alternative; `alt=""` / `role="presentation"` / `aria-hidden` on these images would be a floor failure. Nadia's ruling in §1.6 is correct, and the distinction from `ThemeArt` (decorative, `alt=""`) is the right one.
- **Pattern — CONFIRMED WITH ONE EXCEPTION.** `{Flower common name}, {State}'s state flower` is the right shape: flower name first (the new information), state relationship second (the context that makes it an identification, not just a plant name). No "painting of" / "image of" prefix — correct: assistive technology already announces the element as a graphic, so a type prefix is pure verbosity. No scientific name — correct: it serves no identification purpose for this audience and lengthens every announcement. All final strings are 26–57 characters — concise, single-breath announcements.
- **Redundancy with adjacent visible text — RULED NOT A FAILURE, on both pages.** On `/seller/{slug}` the state name already appears in the Location chip, and on `/state/{slug}` the `<h1>` names the state — but the alt's state name is not a repetition of the heading, it is the *relationship*: heard in reading order after the header text, "…, Oregon's state flower" is what tells a screen-reader user this painting is the emblem of the state just named, rather than decoration or a product photo. Stripping the state from the alt on the state page (the only place redundancy was arguable) would also break the one-component / one-alt-per-slug design (§1.1–1.2) and make the same object announce differently in different places, against consistent identification (**3.2.4, AA**). The duplication is two or three words inside a short string; the flower name — the actual content — appears nowhere else on either page. Pattern stands on both pages, unchanged.
- **Maine — AMENDED (factual, non-negotiable).** Maine has no state flower. Maine Revised Statutes, Title 1 §211 (the MANIFEST's own cited source) designates the white pine cone and tassel as the state's **floral emblem** — and the painting shows a conifer cone, not a flower, so a sighted user can self-correct while a screen-reader user given "Maine's state flower" cannot. An alt text that states a falsehood fails the purpose of 1.1.1 (an alternative that serves the *equivalent* purpose must not misinform). Maine's string uses "state floral emblem"; the pattern elsewhere is untouched. This also fixes §4's Maine note and §7's framing: the MANIFEST *files* the plate under `flower_common_name` as a data convenience, but that filing does not make the cone a flower, and the public-facing alt follows the statute, not the filing.

### A.2 The 16 final alt strings (verbatim — bench copies from here)

Changes from §5: **2** (Maine, Minnesota). The other 14 are confirmed exactly as Nadia wrote them — each checked against the MANIFEST common name with its parenthetical synonym dropped, per the §5 pattern.

| State (slug) | Final alt text | Ruling |
|---|---|---|
| California (`california`) | `Golden poppy, California's state flower` | Confirmed — MANIFEST: "Golden poppy (California poppy)"; short form correct. |
| Colorado (`colorado`) | `White and lavender columbine, Colorado's state flower` | Confirmed — MANIFEST: "White and lavender columbine (Colorado blue columbine)"; short form correct. |
| Connecticut (`connecticut`) | `Mountain laurel, Connecticut's state flower` | Confirmed — matches MANIFEST exactly. |
| Georgia (`georgia`) | `Cherokee rose, Georgia's state flower` | Confirmed — matches MANIFEST exactly. |
| Iowa (`iowa`) | `Wild rose, Iowa's state flower` | Confirmed — MANIFEST: "Wild rose (wild prairie rose)"; the legislature designated "wild rose" with no species, so the short form is also the legally accurate one. |
| Maine (`maine`) | `White pine cone and tassel, Maine's state floral emblem` | **AMENDED** — one-line justification: 1 M.R.S. §211 designates a floral emblem, not a state flower, and the subject is a cone, not a flower (§A.1). |
| Minnesota (`minnesota`) | `Pink and white lady slipper, Minnesota's state flower` | **AMENDED** — one-line justification: Nadia's "lady's slipper" adds an apostrophe that is not in the MANIFEST's authoritative common name "Pink and white lady slipper (showy lady's slipper)"; the data table (§1.2) must reproduce its source verbatim, not silently normalise it. |
| Montana (`montana`) | `Bitterroot, Montana's state flower` | Confirmed — matches MANIFEST exactly. |
| Nevada (`nevada`) | `Sagebrush, Nevada's state flower` | Confirmed — matches MANIFEST exactly. |
| New York (`new-york`) | `Rose, New York's state flower` | Confirmed — MANIFEST names it simply "Rose" (*Rosa* spp.; the statute specifies no species), so the generic name is accurate, not vague. |
| Oregon (`oregon`) | `Oregon grape, Oregon's state flower` | Confirmed — matches MANIFEST exactly; the doubled "Oregon" is the plant's actual name plus the state, unavoidable and unambiguous in speech. |
| Utah (`utah`) | `Sego lily, Utah's state flower` | Confirmed — matches MANIFEST exactly. |
| Vermont (`vermont`) | `Red clover, Vermont's state flower` | Confirmed — matches MANIFEST exactly. |
| Virginia (`virginia`) | `American dogwood, Virginia's state flower` | Confirmed — matches MANIFEST exactly. |
| Washington (`washington`) | `Coast rhododendron, Washington's state flower` | Confirmed — matches MANIFEST exactly; Washington is the 16th plate (§0) and its string was correctly included. |
| Wisconsin (`wisconsin`) | `Wood violet, Wisconsin's state flower` | Confirmed — matches MANIFEST exactly. |

**Final pattern:** `{MANIFEST common name, short form}, {State}'s state flower` for 15 states; Maine alone reads `…, Maine's state floral emblem`.

### A.3 Placement, reading order, focus, interaction (§§1.4, 2.1, 3.1–3.2)

- **Not a link / not interactive — CONFIRMED, and it is a floor point, not just tidiness.** A plain `<img>` in a plain `<figure>`, no wrapping link, no `onClick`, no hover state: no new focus stop (**2.4.3 Focus Order, A** — nothing added to the order), no keyboard trap or operability question (**2.1.1, A**), no name/role/value obligation (**4.1.2, A**), and no target-size question (**2.5.8, AA** — that criterion governs targets, and this must never become one). It also avoids the seller-page trap Nadia identified: a linked plate would duplicate the Location chip's destination, giving keyboard users two consecutive stops to the same place. Bench must not add `tabIndex`, `role`, a wrapping `<a>`/`<button>`, or a pointer/hover treatment (`card-hover`, `cursor: pointer`) — any of those would falsely imply interactivity to sighted and AT users alike.
- **Reading order — PASS (1.3.1 Info and Relationships, A; 1.3.2 Meaningful Sequence, A).** DOM order = header text first (name / `<h1>`, facts, CTA), plate second, on both pages; visual order matches DOM order at every breakpoint with no `order-*` divergence, and the base layout stacks in that same order. A screen-reader or magnifier user meets the farm/state first and the emblem as supporting identification — the same sequence a sighted user scans. The plate sitting *inside* the same `<header>` as the state name also preserves the relationship programmatically: the alt is encountered in the context that gives it meaning.
- **`<figure>` with no `<figcaption>` — ACCEPTABLE, with one bench rule.** A captionless figure is valid and the house no-caption rule (§1.5) stands — this ruling does not propose reinstating a caption, visible or otherwise. Bench: do **not** add an `aria-label` or `title` to the `<figure>` or a `title` attribute to the `<img>` to "make up for" the missing caption — either would double-announce the same text the alt already carries. The alt on the `<img>` is the single text alternative.
- **Contrast — NO NEW PAIRS, NO FAILURE.** No text sits on, over, or under the paintings, so **1.4.3 Contrast (Minimum)** and **1.4.5 Images of Text** are not engaged, and no word is baked into the artwork. No information is carried by colour alone (**1.4.1 Use of Color, A**): for sighted users the plate is redundant with the adjacent state name, for non-visual users the alt carries the identification in words. The `.art-frame` hairline (`1px solid var(--color-line)`) is decorative edging on a non-interactive graphic, not a user-interface component boundary and not the means of identifying anything, so **1.4.11 Non-text Contrast (AA)** imposes no 3:1 requirement on it — the painting's content is identified by its alt, not by its frame. No ratio is claimed for the frame in this ruling because none is required; unmeasured is not being passed off as passed.
- **Motion / flashing — PASS.** None added (**2.2.2**, **2.3.1** not engaged).

### A.4 Loading and layout stability (§§1.4, 2.2, 3.2)

- **Seller `loading="eager"` / state `loading="lazy"` — CONFIRMED from the accessibility side.** The `loading` attribute changes fetch timing only; the `alt` attribute is in the server-rendered DOM either way, so the text alternative exists for AT whether or not the image bytes have arrived (1.1.1 is satisfied by the attribute, not the download). The choices are also the right way round for low-vision and magnification users: on the seller page the plate is in the first viewport beside the summary, and eager loading avoids a 280 px painting popping in late inside a magnified viewport; on the state page the plate sits below an eager, high-priority hero and must not compete with it — lazy is correct there, and the reserved box (below) means its late arrival moves nothing.
- **One ambiguity the bench must not inherit:** §2.2 says `loading="eager"` with "no `fetchPriority` (or `fetchPriority="low"`)". Pick one: **`loading="eager"` and `fetchPriority` omitted** on the seller page. Eager-plus-low is a contradictory signal whose handling differs by browser; omitting the attribute is the deterministic version of Nadia's intent (in the first paint, never promoted over the `<h1>` LCP).
- **Fixed `width={1600} height={1600}` + `h-auto w-full` — CONFIRMED.** The attributes reserve the true 1:1 box before the file arrives (the browser derives the aspect ratio from them), so there is no layout shift on either page, lazy or eager. Layout shift is not itself a WCAG criterion, but its victims are this audience: a magnifier user reading at a panned offset, or a user with attention or motor difficulties tracking content that jumps, loses their place when a 280–320 px square arrives unreserved. The reservation is the fix, and it is already in the spec.
- **Reflow — PASS (1.4.10 Reflow, AA).** At a 320 CSS px viewport the content box is 288 px (320 − 2 × 1 rem container padding) and the centred plate is 280 px — it fits with no horizontal scrolling. At 400% zoom the effective viewport is likewise ~320 CSS px, so the base stacked layout (not the ≥640 px flex row) is what a zoomed user gets; the row can never squeeze text against the plate because the row only exists at widths where both columns genuinely fit, and the text wrapper's `min-w-0 flex-1` prevents flex overflow at `sm`. **1.4.4 Resize Text** and **1.4.12 Text Spacing** are unaffected: the change adds no text container, no fixed text height, and no text of its own.
- **Forced-colors mode:** nothing in the placement depends on a background colour, shadow, or colour-carried state — the frame is a real border, the content is a painting (true-colour artwork, not interface meaning), and there is no state to lose. No `forced-color-adjust` exemption is needed or permitted for this component.

### A.5 Bench-facing requirements (binding for the floor)

1. Alt strings come from the §A.2 table **verbatim** — including Maine's "state floral emblem" and Minnesota's apostrophe-free "lady slipper" — stored once in the §1.2 plate table; never generated, never the filename, never empty.
2. The plate `<img>` carries no `title`, the `<figure>` carries no `aria-label`, and neither element gets `role`, `tabIndex`, a link/button wrapper, or a hover/pointer treatment (§A.3).
3. Seller page: `loading="eager"`, `fetchPriority` **omitted**. State page: `loading="lazy"`, no `fetchPriority`. Both: `width={1600} height={1600}`, `decoding="async"`, `.art-frame` as specified — unchanged from §§1.4/2.2/3.2 except the pinned `fetchPriority` choice in item 3's seller clause.
4. No `<figcaption>` and no visible label is added — the house rule stands and this ruling requests no exception (§1.5, §7 flag noted and accepted: the sighted-user identification gap Nadia flags is a UX/house matter, mitigated by adjacency, and is **not** a WCAG failure, because 1.1.1's obligation — an equivalent text alternative — is fully met by the alt; I flag it, I do not redesign it).
5. **Verification owed at handoff (still Nadia's §7 list, plus AT):** rendered-size check at 390 px and desktop on both pages; one no-plate seller; and an assistive-technology pass on the *built* pages — screen reader (NVDA/VoiceOver) confirming each plate announces exactly its §A.2 string once, in header order, with no figure/title double-announcement; keyboard pass confirming no new tab stop; 320 px reflow and 400% zoom check. Until those run on the live build, the honest status is "spec passes WCAG 2.2 AA review; built pages not yet AT-verified" — not "compliant," and never "certified."

---

## Quinn — QA Gate

**Reviewer:** Quinn, quality assurance specialist (independent gate) · **Date:** 2026-11-19 · **Scope:** the Claude Code bench's uncommitted implementation in `~/workspace/seeds-hues/v2/` — `lib/data/state-plates.ts`, `components/seller/StatePlate.tsx`, header changes in `app/seller/[slug]/page.tsx` and `app/state/[slug]/page.tsx`, `tests/unit/state-plates.test.ts`, the `tests/unit/guardrails.test.ts` update, and the `scripts/acceptance.ts` change — judged against this spec (§§1–6, §A.2, §A.5) and `artwork-states/MANIFEST.json`. The bench's report was treated as claims, not evidence; every check below was run independently on the code, the test suite, and a locally built + served copy of the real app.

### Verdict: PASS WITH NOTES

No defects found. One declared deviation ruled acceptable (Note 1), two minor limitations in the new acceptance check recorded (Note 2), and one case that could not be exercised against served HTML locally, covered by component-level tests and owed live (Note 3 + the post-deploy list). Nothing returns to the bench.

### Check 1 — Mapping correctness (all 16 entries): PASS

Programmatic extraction of `STATE_PLATES` compared character-for-character against §A.2 and cross-checked against the MANIFEST: 16 entries, key set identical to the MANIFEST key set (no missing, no extra), every `path` is `/artwork/states/{slug}.webp` with the path slug equal to the key, every `alt` byte-identical to its §A.2 string, and every flower-name part identical to the MANIFEST common name with its parenthetical synonym dropped. The two amended strings are correct: Maine reads `White pine cone and tassel, Maine's state floral emblem`; Minnesota reads `Pink and white lady slipper, Minnesota's state flower` — "lady slipper" with no apostrophe.

### Check 2 — Gating logic: PASS

Seller page: `state` comes only from the pre-existing resolution (`s.country === "US" ? stateByCode(s.region) : null`), `plate = state ? statePlateFor(state.slug) : null`, and the figure renders only when both are non-null. `statePlateFor` uses `Object.hasOwn`, so prototype keys (`constructor`, `__proto__`, `toString`), empty, null, and case-mismatched inputs all return null. State page: the plate derives only from the page's own `st.slug`. No code path reads the seller's name, location string, or homepage. Exercised through the real page components in the bench's tests (which I re-ran, Check 4): all 16 painted-state sellers receive their own state's plate and alt; a Texas seller keeps its state chip but gets no plate and no substitute; a region-null seller gets no figure and an otherwise unchanged header; a non-US seller with region `OR` gets no plate; a seller named/located "Oregon" with no region on file gets no plate. Served HTML from the local build confirms one plate figure on an Oregon seller page and one on `/state/oregon`, each its own state's.

### Check 3 — Spec compliance sweep (§6 must-NOT list, §A.5 items 1–4): PASS

In the actual code: no `object-cover` / `object-contain` / aspect-ratio utility anywhere in the new or changed files (the only `fit` is `imageUrl`'s `scale-down`); no `<figcaption>`, caption, or visible label; absence renders `null` — no placeholder, filler, or substitute; no inferred states (Check 2); no link, button, `onClick`, hover, `card-hover`, `cursor: pointer`, `role`, `tabIndex`, `title`, or `aria-label` on the plate or figure; the state hero is untouched in the diff and in served HTML (scene asset, `width: 1200` request, `card` class, `loading="eager"`, `fetchPriority="high"`, original scene alt); every plate goes through `imageUrl(plate.path, { width: 640 })` from `lib/images` — plain `<img>`, no `next/image`, no new image files, no srcset; `StatePlate` / `STATE_PLATES` are referenced only by the two specced pages — not in `SellerCard`, the seller index, search, or any og:image; no existing content reordered (Check 6); no new CSS — `.art-frame` as-is on the `<img>`. §A.5.3 pinned exactly as Ada ruled: seller `loading="eager"` with `fetchPriority` omitted, state `loading="lazy"` with none; both carry `width={1600} height={1600}` and `decoding="async"`. Figure classes match §§2.2/3.2 exactly (`mx-auto mt-6 w-[280px] shrink-0 sm:mx-0 sm:mt-1 sm:w-[300px] lg:w-[320px]`), and `data-state-plate={CODE}` sits on the `<figure>`.

### Check 4 — Independent verification: PASS

- `npm run verify`, run by me: exit 0 — lint and typecheck clean, **361/361 tests passed** (21 files). `tests/unit/state-plates.test.ts` run on its own: **15/15 passed**.
- Local preview, built the way production is built (`npm run cf:build`, then `opennextjs-cloudflare preview` on localhost:8787 against the local D1 — the pattern `scripts/acceptance.ts` targets). Served HTML inspected:
  - Oregon seller (`wild-west-seed`): exactly one plate figure; src is the 640-wide `fit=scale-down` transformation of `artwork/states/oregon.png`; alt `Oregon grape, Oregon's state flower`; `loading="eager"`; header DOM order h1 → state chip → "Visit …" CTA → plate; About still after the header.
  - `/state/oregon`: exactly one plate figure, `loading="lazy"`, same alt; DOM order hero → h1 → intro → CTA → plate → farm grid; hero verified untouched (above).
  - Raw-HTML occurrence counts above one are Next.js flight-payload duplicates and (seller page) the single preload link of Note 1 — not additional DOM elements; the DOM figure count is exactly one per page.
- Rendered size, measured with headless Chromium (`getBoundingClientRect`, both axes) on the local build: **280×280 px at 390 px and at 320 px viewport, 300×300 at 768 px, 320×320 at 1280 px** — figure and img identical and square on both pages, no horizontal overflow at 320 px (Ada's §A.4 reflow point confirmed empirically, not just from classes).

### Check 5 — The acceptance.ts change: PASS (see Note 2)

The replaced line forbade any `artwork/states/oregon.` on `/state/oregon` — a guard against the masked `StateShape` art variant returning. The replacement is equivalent-or-stronger: it pins the plate figure's presence, its 640-wide src, the §A.2 alt, lazy loading with no fetchPriority, and the absence of caption/link/title/aria-label inside the figure; pins its position (after the Add Your Farm CTA, before the farm grid); and asserts exactly one `artwork/states/` occurrence on the whole page — a returning masked variant (an 800-wide SVG `<image href>`) would break both the count and the src pin. The new cross-seller check is sound: it recomputes each seller's expectation from the production API with the same rule the pages use (US + `stateByCode(region)` + plate-table membership), asserts exactly one figure with matching code, src, alt, and eager/no-fetchPriority for plated sellers, asserts zero figures and zero `artwork/states/` strings for all others, and asserts the plate count of every crawled state page against the table.

### Check 6 — No collateral damage: PASS

Diff review of both page files: imports, one wrapper `<div className="min-w-0 flex-1">` around the existing header content (strings, markup, and order inside unchanged), the header/row classes from the spec, and the conditional figure — nothing else. The guardrails change is justified and narrow: one exact-regex allowlist entry for the new component's `<img>` src pattern (without it the guardrail suite would correctly flag the new image), plus assertions that every plate path is the specced stored path and exists in `IMAGE_KEYS`. Working tree contains only the bench's files for this change.

### Note 1 — Preload deviation: RULED ACCEPTABLE (not a gate failure)

Declared by the bench and confirmed in the served HTML of the real build: React 19 emits exactly one `<link rel="preload" href="…width=640…/artwork/states/oregon.png" as="image"/>` for the non-lazy seller plate, and none for the lazy state plate. The link carries **no `fetchpriority` attribute** — default priority, never promoted — and the only `fetchpriority` on the seller page belongs to a script preload, not the plate. §A.5.3's substance is fully met: `fetchPriority` is omitted on the `<img>`, the plate is not promoted over the `<h1>` LCP, and no contradictory eager-plus-low signal exists. The preload is the framework's standard hoisting for an eager image (the existing state hero behaves the same way), and the only suppression route — `fetchPriority="low"` — is the one Ada expressly forbade. The bench disclosed the deviation and pinned the behaviour in tests (preload present exactly once, no fetchpriority; lazy → no preload). Accepted as-is; production confirmation is item 3 of the post-deploy list.

### Note 2 — Minor limitations in the new acceptance check (non-blocking)

(a) The cross-seller check enumerates sellers with `limit=100`, inheriting the suite's existing convention (neighbouring checks do the same); if visible sellers ever exceed 100 it would silently under-check rather than fail. (b) Its fetchPriority assertion scopes to the figure markup, not the head preload link; the preload's default priority is pinned by the unit tests and was verified by me in served HTML (Note 1). Neither weakens any check that existed before this change.

### Note 3 — Not verifiable locally (owed live, not passed silently)

The local D1 seed contains no live no-region seller: its only region-less rows are `removed_by_request` throwaway test sellers, which answer 410 from middleware by design, and David's Garden Seeds / Seedtime are not in the local seed. The no-region case is therefore verified at component level (real page component, region-null seller → no figure, header otherwise unchanged) and must be confirmed against production data after deploy (item 2 below). Ada's §A.5.5 assistive-technology pass (screen-reader announcement, keyboard) also remains owed on the live build — this gate verified geometry, order, and attributes, and claims nothing about AT behaviour.

### Must be verified live after deploy

1. Run `scripts/acceptance.ts` against production — it now includes the Oregon plate pins and the cross-seller / cross-state plate check.
2. `/seller/davids-garden-seeds` and `/seller/seedtime` (no region on file): no plate figure and no `artwork/states/` in the served HTML.
3. One painted-state seller in production: exactly one plate, `loading="eager"`, §A.2 alt, and exactly one preload link for the plate carrying no `fetchpriority` (Note 1 confirmation).
4. `/state/oregon` in production: plate `loading="lazy"`; hero still 1200-wide, eager, `fetchPriority="high"`.
5. A no-plate state page if one resolves in production (e.g. Texas, if it has sellers): header exactly as before, no figure, no substitute.
6. Rendered-size spot check on production at ~390 px (local measurements in Check 4 were taken on the identical build, but the live page is the test).
7. Ada's AT pass from §A.5.5 on the live pages: each plate announces its §A.2 string exactly once, in header order, with no figure/title double-announcement; keyboard pass confirms no new tab stop; 400% zoom check.

---

## Quinn — Live Spot-Gate

**Reviewer:** Quinn, quality assurance specialist (independent gate) · **Date:** 2026-11-19 · **Scope:** the deployed change on production `https://seeds.hues.flowers` only (coordinator reports Worker version `febcca45-84bf-4894-a11c-a6f41d9018f0`, plus a secret-rotation version of the same code). Method per prior batch gates: this VM's headless browser cannot render production (Cloudflare distrusts it), so served-HTML and HTTP evidence is the standard. Every result below is from my own fetches, not the coordinator's report; where I relied on the coordinator's full sweep, that is stated.

### Verdict: PASS WITH NOTES

All spot checks passed exactly as specified. The notes are the two items carried in from the pre-deploy gate that this gate cannot close — Ada's AT pass (Note A) and production rendered-size measurement (Note B) — plus the acceptance-score ruling (§4 below). No defects found; nothing returns to the bench.

### 1. Served-HTML spot checks (mine, production)

- **`/seller/floret` (Washington seller) — PASS.** HTTP 200. Exactly one plate `<figure data-state-plate="WA">` and exactly one plate `<img>`: src the `width=640, fit=scale-down` transform of `artwork/states/washington.png`, alt exactly `Coast rhododendron, Washington's state flower`, `loading="eager"`, no `fetchPriority`, `width="1600" height="1600"`, `decoding="async"`, class `art-frame h-auto w-full`; figure classes match §2.2 exactly. Exactly one preload `<link>` for the plate, carrying **no** `fetchpriority` attribute — pre-deploy Note 1 confirmed live.
- **`/seller/select-seeds` (Connecticut seller) — PASS.** HTTP 200. Exactly one figure (`data-state-plate="CT"`) / one img: `connecticut.png` at width 640, alt exactly `Mountain laurel, Connecticut's state flower`, `loading="eager"`, otherwise identical attributes/classes to Floret; one preload link, no `fetchpriority`.
- **Extra cross-check, `/seller/johnnys-selected-seeds` (Maine) — PASS.** Exactly one plate img, alt exactly Ada's amended string `White pine cone and tassel, Maine's state floral emblem` — the §A.2 amendment is live, not the §5 original.
- **`/state/oregon` — PASS.** HTTP 200. Exactly one plate figure (`data-state-plate="OR"`) / one img: `oregon.png` at width 640, alt exactly `Oregon grape, Oregon's state flower`, **`loading="lazy"`**, no preload link. **Hero intact:** `<figure data-testid="state-hero">` with the scene img unchanged — `theme/state-scenes/oregon.png` at `width=1200`, `loading="eager"`, `fetchPriority="high"`, `card` class, original scene alt.
- **`/seller/davids-garden-seeds` and `/seller/seedtime` (no region on file) — PASS.** Both HTTP 200, zero plate figures, zero `data-state-plate`, zero `artwork/states/` anywhere in the served HTML. This closes pre-deploy Note 3 / must-verify-live item 2, which could not be exercised locally.
- Raw-HTML `data-state-plate` counts read 2 on plated pages: one DOM figure + the Next.js flight-payload duplicate identified in the pre-deploy gate. DOM figure count and plate `<img>` count are exactly one per page — the count that matters.

### 2. Plate image URLs — PASS

The live transform URLs for Washington, Connecticut, and Oregon each return **HTTP 200 with an image content type** (`image/jpeg`, the `format=auto` negotiation of the 640-wide transform; ~84 KB / ~75 KB / ~85 KB downloaded). The plates serve from the project's own image host (`images.seeds.hues.flowers`) — no hotlinking.

### 3. Neighbours intact — PASS

`/variety/zinnia-alpenglow` returns 200 with its normal title/H1 and zero `data-state-plate` / zero `artwork/states/` — no plate leaked onto variety pages. The sellers index `/seller` returns 200 with zero plate references — §6 item 8 (no plate in the index) holds live.

### 4. Acceptance score ruling — failures NOT attributable to this change

Production suite at **97/127** is consistent with the documented local-D1-assumption failure class (prior production runs 95/123, 97/126: pass count stable while the denominator grows as checks are added, including this change's new plate checks — which pass independently in §1 above and in the coordinator's 27-seller / 16-state sweep, whose Maine-alt and no-region claims my spot checks corroborate). The two tail failures specifically:

- **Phase 3 drain 401:** `scripts/acceptance.ts` mints its ingest/admin keys against the **local** D1 unless keys are supplied (script header; "minted against local D1 unless supplied"). A locally minted admin key is not a production credential, so the drain check (authenticated call expecting 200) fails with 401 against production for credential-scope reasons. This change touched no auth, no drain endpoint, and no Phase 3 code — the pre-deploy diff was the plate table, one component, two page headers, and tests.
- **Rate-limit burst check:** chronic and pre-existing, not sporadic. The 2026-11-16 production acceptance run on file (`v2/tmp/acceptance-prod.md`) fails the same checks the same way — burst `>120 req/min → 429` "never limited" and reports rate-limit "never limited" — three days before the plate change existed. No rate-limit code is in this diff.

Neither failure sits on a surface this change touched, and every check that does sit on this change's surface passes live. The score is not a reason to hold or roll back the plates. The chronic rate-limit class remains an open item for the project on its own track — recorded here so it is not normalised into silence, but it is not this gate's defect.

### Note A — Ada's AT pass remains owed (explicitly NOT covered by this gate)

Ada's §A.5.5 assistive-technology pass on the built pages — screen reader (NVDA/VoiceOver) confirming each plate announces its §A.2 string exactly once, in header order, with no figure/title double-announcement; keyboard pass confirming no new tab stop; 400% zoom check — **remains owed and is not covered by this spot-gate.** This gate verified served HTML, attributes, geometry-by-spec, and HTTP behaviour only, and claims nothing about AT behaviour. Until §A.5.5 runs, the honest status remains "spec passes WCAG 2.2 AA review; built pages not yet AT-verified" — not "compliant," never "certified."

### Note B — Coverage limits of this gate

Production rendered-size measurement (must-verify-live item 6) could not be repeated here: the VM's headless browser cannot render production. It rests on the pre-deploy gate's DOM measurements (280×280 / 300×300 / 320×320, both axes, on the identical build) plus this gate's confirmation that production serves the exact figure/img classes and 1600×1600 attributes those measurements were taken on. The full 27-seller / 16-state sweep is the coordinator's run; I independently spot-checked six pages across four states plus the Maine cross-check, both no-region sellers, one state page, one variety page, and the sellers index, with zero disagreements.
