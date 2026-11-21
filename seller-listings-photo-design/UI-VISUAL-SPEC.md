# Seller listings with product photos — UI visual spec

**Seat:** Mina, UI Design · **Surface:** Seed Directory (seeds.hues.flowers), seller profile page (`/seller/{slug}`), Quiet Ledger listing card in seller context only · **Date:** 2026-11-20
**Governing structure:** Nadia's ruling, `UX-STRUCTURE.md` in this folder — read in full; this spec changes nothing in it. Structure, order, content, fallback tiers, alt text, data shape, and component split (`ListingArtwork` new, slot in `ListingRow`, opt-in skeleton variant) are hers. This document rules only the visual layer she left open: rail treatment, interior rhythm, the `lg` 2-column list, token discipline, and motion.
**Method:** profession best practice first (Material 3 shape/spacing/token discipline, Carbon spacing scale), then Dustin's house standards; house wins. Conflicts are flagged in §7, not silently resolved.
**Code evidence:** `v2/components/variety/ListingRow.tsx`, `VarietyCardImage.tsx`, `VarietyHeroImage.tsx`, `components/crop/CropCardImage.tsx`, `components/ui/Skeleton.tsx`, `app/globals.css` (`@theme` + component layer), `app/seller/[slug]/page.tsx` — all read in full for this pass. My UI audit of 2026-11-20 (`ui-audit-2026-11-20/AUDIT.md`, Finding 1 / §5) is the source for the token inventory in §5.

---

## 0. The ruling in one paragraph

The rail is a **flush plate mount, not a padded thumbnail**: a fixed 1:2 frame (`w-18` = 72 px phone, `sm:w-24` = 96 px) on the existing `paper` token ground, with a 1 px `line`-token hairline and the browse-frame radius (`rounded-lg`, 8 px), the plate shown whole and edge-to-edge inside it (`object-contain`, no padding, no shadow, no sage band). Glyph tiers (pod motif, divider stem) use the *same* frame, centred, with spacing-scale padding so they read as a designed device, not a failed image. The text column, stem rule, and footer keep today's classes and rhythm untouched; the `lg` list is two columns at the system's existing 12 px card gap, equal outer height, footers unpinned. **This build introduces zero new tokens, zero new hex values, and zero pixel values off the existing spacing/radius scales** (§5) — the card's pre-existing hardcoded values do not block a clean rail, so they are left exactly where they are and stay owned by Batch A. The artwork carries **no motion of its own** (§6).

---

## 1. The rail — exact treatment

### 1.1 Frame geometry (all tiers, all availability states)

| Property | Phone (< 640 px) | `sm` and up (≥ 640 px) | Source |
|---|---|---|---|
| Width | 72 px (`w-18`) | 96 px (`w-24`) | Tailwind spacing scale (`--spacing` × 18 / × 24) — no arbitrary value |
| Height | 144 px | 192 px | Derived: `aspect-[1/2]`, the established frame expression (see §5.3) |
| Radius | 8 px (`rounded-lg`) | same | Tailwind radius scale — the browse-frame language of `VarietyCardImage` / `CropCardImage` (both `rounded-lg`) |
| Ground | `bg-paper` (`--color-paper`) | same | Nadia §1.3 / §5; Elena's whole-plate-on-paper handling |
| Border | 1 px solid `border-line` (`--color-line`) | same | `.art-frame` precedent: the system's plate mount is hairline + paper ground |
| Shadow | none | none | Plates sit *in* the card; the card's own shadow is the elevation. No `.card-image` sage line (§1.4) |
| Overflow | `overflow-hidden` | same | Radius clips the plate's painted corners exactly as the grid frames do |
| Alignment | `self-start` (top-aligned to the heading row) | same | Nadia §1.3: art binds to the name it illustrates; the frame never stretches |

Builder classes, frame wrapper (tiers 1–2):

```
aspect-[1/2] w-18 shrink-0 self-start overflow-hidden rounded-lg border border-line bg-paper sm:w-24
```

**Why 8 px and not the card's 18 px:** radius scales with the component (Material shape discipline — small frames take small radii). An 18 px radius on a 72 px frame eats a quarter of the frame's width at each corner and pill-distorts the plate's corners; 8 px is also the radius every other browse frame on the site already uses, so the rail reads as the same frame family at a smaller size. This is a deliberate non-use of `--radius-card`; it is recorded here so Quinn does not flag it as inconsistency (§7, note 3).

**Why a border when the grid frames have none:** the grid frames sit in `.card` mounts and carry the sage line for separation. The rail sits *inside* a card, on `surface` (in-stock) or on `paper` itself (sold-out, §2.3), where ground contrast alone cannot hold the frame's edge in both states. The 1 px `line` hairline is the `.art-frame` mount treatment transplanted — an existing system value, not a new one. The border is decorative (the frame is a non-interactive image container; no text or control boundary depends on it), so the known 1.30:1 `line`-on-paper decorative-edge figure is not an Ada-floor issue — it is the same figure `.art-frame` and `.card` already ship with.

### 1.2 How the plate sits in the rail — flush, tiers 1–2

- **No padding. The image fills the frame**: `block h-full w-full object-contain`, exactly as `VarietyCardImage` and `CropCardImage` render plates. The plates are painted to a cream edge colour-matched to the `paper` token, so `object-contain` on `bg-paper` is seamless by construction — the frame's ground *is* the plate's own margin. Any padding would shrink an already identification-sized image (72 px) and double-frame it (paper inset around a cream edge).
- **Never cropped, never stretched** (Elena, binding): `object-contain` + `fit=scale-down` via `v2/lib/images.ts`, per Nadia §1.3. `object-cover` anywhere in `ListingArtwork` is an automatic gate fail.
- Image request, `sizes`, `loading="lazy"`, `decoding="async"`, and 480×960 attributes are Nadia's §1.3 ruling — unchanged by this spec.
- The `<img>` itself carries **no radius, border, shadow, or class beyond sizing/fit** — all treatment lives on the frame wrapper, so a slow or failed load still shows the correct mount (fixed aspect = zero layout shift, 24 times per page).

### 1.3 Glyph tiers — designed, not broken (tiers 3–4)

Tiers 3–4 keep the **identical frame** (same classes, plus centring) so a listings page never mixes frame dialects — a shopper reads "same mount, device instead of painting," which is the designed-placeholder language Elena ruled in audit item C6. Only the inner treatment differs:

| Tier | Frame addition | Inner element | Treatment |
|---|---|---|---|
| 3 — pod motif | `flex items-center justify-center` | `<img>` of the motif (480×480, via `lib/images`) | `h-full w-full object-contain p-3 opacity-90 sm:p-4` — Nadia's tier, Nadia's alt rule (`alt=""`, `aria-hidden`) |
| 4 — divider stem | `flex items-center justify-center` | `<span class="divider-stem w-full opacity-50">` | The existing `.divider-stem` device, centred; frame's `overflow-hidden` clips the 220 px stem background symmetrically so the two-leaf centre sits mid-frame |

- **Padding is the difference from the grid placeholder, scaled to the rail.** `VarietyCardImage` insets its motif with `p-8` (32 px) at full card width. At rail width that would leave a 8 px glyph. The rail uses `p-3` (12 px) phone / `sm:p-4` (16 px) — the same *proportion* (~17 % inset) on the spacing scale — leaving a ~48 px motif on phone, ~64 px at `sm`+, large enough to read as the pod device, small enough to never impersonate a plate.
- **Opacity values are inherited, not invented:** motif `opacity-90` and stem `opacity-50` are copied verbatim from `VarietyCardImage`'s placeholder rendering. They are the resting treatment in *both* availability states (§2.3) — they are not a dimming state.
- No text, no "no image" label, no dashed border, no icon-font glyph: the placeholder's job is to hold the mount quietly. Anything louder would make unplated varieties look broken instead of unpainted.

### 1.4 What the rail deliberately does not carry

- **No `.card-image` sage line.** That 2 px `leaf-50` shadow-line is a *bottom* band for top-stacked browse images; on a side rail it would draw a green underline floating at the frame's foot inside the card — wrong geometry — and Elena's C8 ruling strikes it from browse frames in any case.
- **No hover, pressed, or focus treatment.** The artwork is not a link and not interactive (Nadia §1.3). No `hover:` class, no scale/zoom, no cursor change. A non-interactive element wearing interaction styling is a false affordance.
- **No swatch, no badge, no status mark on the frame.** Availability lives in the status line, in text, as today (Nadia §5).

---

## 2. Card interior rhythm with the rail present

### 2.1 The grid (seller context only)

```
grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-4
```

- Column 1 is `auto` — its width comes from the rail itself (`w-18` / `sm:w-24`, §1.1), so no grid-template pixel value exists anywhere in the build.
- Gap: `gap-3` (12 px) phone, `sm:gap-4` (16 px) — Nadia's 12/16, both on the spacing scale, both already the system's card-stack values (`gap-3` is the listings stack gap today).
- `items-start`: rail and text column share the card's top padding line; neither stretches the other.
- Text column wrapper: `min-w-0` and nothing else. **Every class inside the text column is byte-identical to today** — heading row, `mt-[3px]` subline, `mt-[9px]` status line, `mt-2` packets/notes block, in today's order (Nadia §1.2). The pre-existing arbitrary values in that column are not retimed by this build (§5.2).
- The `<article>` shell classes are **unchanged** — same `rounded-[18px] border px-4 pb-3 pt-[18px]`, same sold-out conditional. This build's diff inside `ListingRow` is the grid wrapper plus the `ListingArtwork` element, plus the seller-only `h-full` in §3.2. Nothing else.

Resulting text measure (computed, for Quinn's check): phone 390 px → card inner 326 px − rail 72 − gap 12 = **242 px** text column. At 320 px → **172 px** — narrow but sound with `min-w-0` wrapping; this is the width Nadia's 320 px pass (§6.1 of her ruling) must prove. At `lg` (§3): **410 px** — a comfortable ledger measure.

### 2.2 Vertical rhythm and the tall rail

- The rail (144/192 px) is taller than a short listing's text column (~76 px for name + subline + status with no packets/notes). Card height is therefore **driven by the rail** for short listings and by the text for long ones. That is correct ledger behaviour: the mount is a fixed catalogue size, text flows beside it.
- When the text column is shorter, the surface/paper ground shows beneath the text beside the rail's lower half. Do **not** compensate: no vertical centring of the text column, no extra spacing distributed into the text rows, no stretching of the frame. The empty ground is the card's own ground — it reads as the margin of a ledger entry, and any fix would break the heading-to-art top alignment that binds plate to name.
- When notes make the text taller, the frame stays at the top (`self-start`) and card ground shows beneath the *frame*. Same rule, mirrored. The frame never stretches (`aspect-[1/2]` is fixed by width, not by row height).

### 2.3 Stem rule, footer, and sold-out parity

- **Stem rule and footer move below the grid, full card width, classes and CSS untouched** (Nadia §1.2). `.listing-stem-rule` keeps its own margins (16 px above, 4 px below) measured from the *grid's* bottom edge — i.e. from whichever of rail/text is taller — so the rule's distance from the content it closes is constant in both the rail-driven and text-driven cases. The stem's centred patch continues to take the card's ground (`surface`, or `paper` on sold-out via `.listing-card-soldout`) — still correct, because the rule sits on card ground, never on the rail.
- **Footer unchanged**: "Report a problem" left, "Visit shop →" pill right, both 44 px, same flex row. No `margin-top: auto`, no pinning (§3.2).
- **Sold-out parity is total.** The card keeps today's step-down (ground `surface` → `paper`, border to `line`, shadow to the flat treatment, pill to outline-only) and the rail changes **nothing**: same frame classes, same ground, same border, plate at full fidelity (Nadia §1.3), glyph tiers at their resting opacities. On a sold-out card the rail's `paper` ground meets the card's `paper` ground and the frame is held by its `line` hairline and radius alone — the designed consequence of §1.1's border, and the reason the border exists. Do not "fix" the sold-out rail with a different ground: a `surface` rail on a `paper` card would make the *artwork* the brightest element on a demoted card, inverting the demotion.
- **States inventory for this component** (playbook completeness): resting (in-stock), sold-out, four artwork tiers in each, skeleton (§3.3). Hover/focus/pressed/disabled do not exist on this card today and are not added; the card's two links keep the global `:focus-visible` ring, whose position is unaffected by the rail (the variety link is the first element of the text column, never overlapped by the frame).

---

## 3. The `lg` 2-column list

### 3.1 Gutter and grid

Seller page listings `<ul>` (seller page only; the variety page's list is a different component and is untouched):

```
mt-3 flex flex-col gap-3 lg:grid lg:grid-cols-2
```

- **One gap value at every width: `gap-3` (12 px).** At `lg` it serves as both row gap and column gutter. A wider desktop gutter was considered and rejected: 12 px is the gap of every card stack in the system (seller list today, variety filter list, `ListingSheetSkeleton`), the cards are self-contained surface objects that need separation, not air, and a 16/24 px gutter would be a new rhythm with no token precedent. The desktop-ness of the layout comes from the two columns themselves (Nadia §1.2), not from loosened spacing.
- Container math at `lg`: 72 rem container − 2 × 16 px page padding = 1120 px; two columns at 12 px gap → **554 px per card**; text column 410 px (§2.1). Twelve rows for a full 24-listing page.
- `sm`–`lg` (640–1023 px, incl. iPad portrait): single column, 96 px rail — unchanged from Nadia. iPad landscape (≥ 1024 px) takes the 2-column rule with the desktop. The seller page is a public surface: **phone-first** applies (the device standard's iPad-first part is for admin surfaces only, and does not leak here).

### 3.2 Equal height — silhouette yes, interior no

Per Nadia §1.2, implemented exactly:

- `<li>` carries `h-full`; the seller-context `<article>` carries `h-full` (added seller-context only, so the variety-context article class string is byte-identical to today).
- Grid rows stretch to the tallest card in the row. **No `min-height` is set anywhere** — none is needed: the rail already imposes a floor by construction. Minimum card height (short listing, stem + footer included): phone 18 + 144 + 21 + 44 + 12 = **239 px**; `sm`+ 18 + 192 + 21 + 44 + 12 = **287 px**. (21 px = stem rule's 16 px top margin + 1 px rule + 4 px bottom margin, from its existing CSS.) A `min-h-*` utility on top of that would be a second, competing height rule — forbidden in this build.
- **The footer is not pinned.** No flex-column article, no `mt-auto`. In an equal-height row, the shorter card's extra ground pools *beneath its footer*, inside the card's bottom padding zone. Footers in a row will sit at different heights. This is Nadia's ruled "honest ledger look," and visually it is the right call: pinning would tear the stem rule away from the packets block it closes and float it over a gap. Quinn should gate *against* any `mt-auto` appearing in the diff.
- Availability mixing in a row (one in-stock `surface` card, one sold-out `paper` card, equal height) is expected and correct — ground/shadow parity is per-card (§2.3), never normalised across a row.

### 3.3 Pagination rhythm and the skeleton

- **Pagination is visually untouched** (Nadia §5): same component, same `PAGE_SIZE` 24, same position after the list. Its existing top spacing already separates it from the grid; the halved scroll length at `lg` (12 rows vs 24) is the entire desktop effect. No spacing change is made to "compensate" — the count line above the list and the Pagination below it keep their current tokens at every width, so the section's rhythm is phone-identical, only shorter.
- **Seller skeleton mirrors all of it** (Nadia §4.4, opt-in variant only; variety skeleton untouched): the skeleton `<ul>` takes the same `lg:grid lg:grid-cols-2` classes; inside each card, the same grid wrapper holds a rail block — `Bar` with `aspect-[1/2] w-18 rounded-lg sm:w-24` (the `.skeleton` class supplies the `paper-deep` ground and an 8 px radius that agrees with `rounded-lg`) — beside a `min-w-0` column carrying the existing title/subline/status bars at their existing sizes; the existing border-top footer row stays full-width below the grid. A skeleton promising any other shape is a gate fail (it would manufacture exactly the layout shift the fixed rail exists to prevent).

---

## 4. Motion

**Ruling: the artwork stays still. It gets no motion of its own, in any state, ever.**

- The seller page has no in-place filter — listings change by pagination (full navigation). The shipped cascade (filter-update motion spec, PR #10: `listing-item-in` on the `<li>` wrappers of the *variety* page's `SellerFilterSection`) does not exist on this surface, and this build adds no equivalent. First load and page navigation never animate — that spec's §5 principle binds here too.
- **No fade-in on image load.** Twenty-four lazily loaded plates fading in as the network delivers them would be 24 unsynchronised fades in random order — noise, not feedback — and pointless: the fixed-aspect frame already reserves the layout, so nothing is being explained by the motion. Plates appear when they arrive, at full opacity, inside a mount that was already there. No `transition` or `animation` property may appear on the `<img>`, the frame, or the `<article>` as part of this build.
- **No hover motion** (no zoom, lift, or shadow change on the rail or card) — the artwork is non-interactive (§1.4); motion would falsely promise a tap target.
- **If** an in-place list change ever reaches seller listings in a future build, the artwork rides *inside* the card's `<li>` under that build's wrapper treatment (opacity/transform on the wrapper only, per the shipped motion spec's §2 rule that `ListingRow` internals never animate). A nested or delayed artwork animation on top of a wrapper cascade — double motion — is ruled out in advance.
- **Reduced-motion floor:** complied with by construction — this build introduces no animation for the floor to remove. (The skeleton's existing pulse is system behaviour, unchanged; the rail skeleton block inherits it like every other `Bar`.) Forced-colors: the frame border is decorative and may be recoloured by the UA without loss; all information remains in text, per Nadia §1.3.

---

## 5. Token discipline — the audit applied

### 5.1 The problem, restated from my audit

My 2026-11-20 audit's Finding 1: the Quiet Ledger card is the best-designed and least-systematic component on the site. Its shipped values include a border `#e9dfc2` that exists in no token (the `line` token is `#e0d5b8`), a raised shadow `0 6px 20px rgba(151,134,95,0.14)` and a sold-out shadow `0 2px 8px rgba(151,134,95,0.08)` where the system has one `--shadow-card`, a pill fill `#dfe9d6` that exists in no palette (`leaf-50` is `#e3ead8`), two hardcoded pill inset shadows, a stem-rule colour `rgb(151 134 95 / 0.45)` written raw in `globals.css`, spacing at `pt-[18px]`, `mt-[3px]`, `mt-[9px]`, `px-[18px]`, type at `text-[20px]` / `text-[13px]` / `text-[15px]` with `leading-[1.2]`, and `rounded-[18px]` where the `--radius-card` token exists but is used zero times. `ListingSheetSkeleton` duplicates the border/shadow literals, so the drift is already load-bearing. The audit's remedy is Batch A (A1: DTCG token consolidation promoting those literals to named tokens; A4: arbitrary-value lint ban; skeletons consuming component tokens) — **approved as a batch direction, not yet built.**

### 5.2 The decision for this build: tokenize nothing old, invent nothing new

**The card's hardcoded values do not block a clean rail.** Every value the rail, grid, list, and skeleton variant need already exists as a token or a scale step (§5.3). Therefore:

**Tokenized / token-sourced as part of this work — everything this build touches:**

- Every *new* value in this build resolves to an existing token or scale (§5.3 table). That is this build's token work: it adds **zero** entries to the drift inventory, and the new components (`ListingArtwork`, the grid wrapper, the skeleton rail) are written token-first so Batch A's lint ban (A4) will pass over them without edits.
- The skeleton's *new rail block* is token/scale-sourced (§3.3) even though the skeleton's pre-existing card shell is not (below).

**Explicitly left alone — pre-existing literals this build must not touch:**

| Literal (location) | Value | Owner |
|---|---|---|
| In-stock card border (`ListingRow`) | `#e9dfc2` | Batch A1 (promote to named token, with Iris confirming the colour role) |
| Card shadows, raised + sold-out (`ListingRow`, duplicated in `Skeleton`) | `0 6px 20px rgba(151,134,95,0.14)` · `0 2px 8px rgba(151,134,95,0.08)` | Batch A1 (`shadow.card-raised` / `shadow.card-flat` per audit §5) |
| Shop-pill fill + inset shadows (`ListingRow`) | `#dfe9d6` · two `rgba(…)` insets | Batch A1 |
| Stem-rule colour (`globals.css` `.listing-stem-rule`) | `rgb(151 134 95 / 0.45)` | Batch A1 |
| Card padding / internal margins (`ListingRow`) | `pt-[18px]`, `mt-[3px]`, `mt-[9px]`, `px-[18px]` | Batch A1/A4 — retiming these also changes the variety-context card, which Nadia rules byte-for-byte frozen; a token pass that touches both contexts belongs to A1, not to a seller-only build |
| Card type literals (`ListingRow`) | `text-[20px]`, `text-[13px]`, `text-[15px]`, `leading-[1.2]` | Thea's scale formalisation via Batch A |
| Card radius literal (`ListingRow`, `Skeleton`) | `rounded-[18px]` instead of the `--radius-card` token | Batch A4 (mechanical swap, both files together) |
| Skeleton card shell literals (`Skeleton.tsx`) | border/shadow/padding copies of the above | Batch A5-equivalent (audit §5.5: skeletons consume component tokens *after* A1 names them) |

**Forbidden in this build:** opportunistically tokenizing any row of that table inside this diff. Promoting `#e9dfc2` or the shadows requires Iris's role confirmation and changes a *shared* component (both contexts, plus the skeleton) — doing it inside a seller-photo build would smuggle a system change past its own batch and its own gate. If the builder believes a listed literal blocks the rail, they stop and surface it; per §5.1's analysis, none does.

### 5.3 Every value in this build, traced

| Value used | Named source | Kind |
|---|---|---|
| Rail ground `bg-paper` | `--color-paper` (`@theme`) | Existing system token |
| Rail border `border-line` (1 px) | `--color-line` (`@theme`); 1 px = the system's hairline width (`.card`, `.art-frame`) | Existing system token |
| Rail radius `rounded-lg` (8 px) | Tailwind radius scale (`--radius-lg`); matches `VarietyCardImage` / `CropCardImage` frames and `.skeleton`'s 8 px | Existing scale |
| Rail widths `w-18` / `sm:w-24` (72 / 96 px) | Tailwind spacing scale (`--spacing` × 18 / × 24) | Existing scale |
| Grid gaps `gap-3` / `sm:gap-4` (12 / 16 px) | Tailwind spacing scale; `gap-3` is the existing listings-stack gap | Existing scale |
| List gap `gap-3` at all widths incl. `lg` columns | Same | Existing scale |
| Motif padding `p-3` / `sm:p-4` (12 / 16 px) | Tailwind spacing scale | Existing scale |
| Motif / stem opacity `opacity-90` / `opacity-50` | Copied verbatim from `VarietyCardImage` placeholder rendering | Inherited component values |
| Frame aspect `aspect-[1/2]` | The illustration standard's 1:2 — see exception note below | Established frame expression |
| Skeleton rail ground | `.skeleton` class (`--color-paper-deep`) | Existing component class |

**Exception, named deliberately:** `aspect-[1/2]` is an arbitrary-value utility, and it is also how *every* existing frame in the codebase is written (`VarietyCardImage`, `CropCardImage`, `VarietyHeroImage` via class, `HeroArtSkeleton`, `VarietyCardSkeleton`). Consistency with the frame family beats inventing an `aspect-listing` token ahead of Batch A; when A4's lint ban lands, `aspect-[1/2]` belongs on its allowlist beside the 380 px layout column (audit §5.4 already allowlists by pattern). No other arbitrary value — no `-[…px]`, no raw hex, no `rgb(…)` — may appear in this build's diff.

**No new tokens are created by this spec.** Creating a lone component-token layer for the rail (e.g. a `--listing-art-*` family) ahead of A1's DTCG consolidation would itself be drift: a second token mechanism beside the one A1 will establish. When A1 lands, the rail's values are already token/scale references and migrate mechanically. **No new colours, no new type** — concurring with Nadia §5; Iris and Thea are not triggered by this build.

---

## 6. Hierarchy check (squint / grayscale)

- **Squint:** the card's loudest element remains the variety name (Fraunces 600, 20 px, underlined link) — the rail at 72/96 px on a muted paper ground is a thumbnail weight, not a competing focal point; it groups with the heading by top alignment and 12/16 px proximity (Gestalt), and the eye's path name → subline → status is unchanged. On the page, the seller header remains primary (Nadia §1.4); the listings section gains texture, not a new hero.
- **Grayscale:** nothing in the new anatomy carries meaning by colour. Availability is dot + word in text; sold-out is ground + word + pill outline; the artwork is identity, duplicated by the heading text beside it. The design survives grayscale by construction.
- **200 % text resize:** the rail is a fixed-size image mount (text-resize rules do not require image scaling); the text column wraps under `min-w-0` and the card grows vertically. No horizontal scroll is introduced at 320 px / 200 % — builder proves it per §8.

---

## 7. Conflicts flagged

1. **⚠ The stem rule this spec positions may already be ruled out — sequencing conflict for Hue.** Nadia's ruling (governing here) treats the stem rule as a current, kept element, and §2.3 above positions it accordingly — it *is* present in the shipped `ListingRow`. But Elena's motif-rationing pushback P1 (my audit §4.3) — **ruled in Elena's favour by Dustin on 2026-11-20** — removes the stem from the Quiet Ledger card entirely (Batch C, item C7, unheld but not yet built). The two rulings cannot both describe the finished card. **My layout does not depend on the outcome:** the grid, rail, and footer are identical either way; if C7 lands first or in the same release, the footer row simply follows the grid with `mt-4` (spacing scale) in place of the stem rule's 16 px top margin, preserving the §2.3 rhythm exactly. Hue must sequence C7 against this build before the brief is written; the builder must not ship a card that both adds the rail *and* silently re-decides the stem.
2. **Placeholder ground — Nadia vs Elena C6, resolved in Nadia's favour here, divergence recorded.** Elena's designed-placeholder ruling (audit C6) puts the pod device on the `paper-deep` ground. Nadia §2.2 rules tier 3 "exactly as `VarietyCardImage` renders it today," which is `bg-paper`. Nadia's document governs this build, so tiers 3–4 sit on `paper` (§1.3). The cost is small (the device, not the ground, does the work at rail size) and the reconciliation is a one-class change (`bg-paper` → `bg-paper-deep`, tiers 3–4 frames only, no geometry change) if Elena's C6 ground is later applied to placeholders system-wide. Flagged for Hue to route; not silently resolved either way.
3. **Note, not a conflict — `--radius-card` non-use.** §1.1 deliberately gives the rail the 8 px browse-frame radius rather than the 18 px card token. Recorded so the gate reads it as a shape-scale decision, not drift.
4. **Concurrence, recorded — artwork is not a link (Nadia §1.3 / §7.3).** From the visual side I concur and strengthen it: a non-linked plate must carry *no* interaction styling whatsoever (§1.4), which this spec enforces. If user testing ever reverses Nadia's call, the link treatment returns to me for a state design (focus ring geometry around a 1:2 frame inside a card) — it is not a builder improvisation.

---

## 8. Verification required before handoff (builder + Quinn)

Per this seat's checklist — rendered surface, measured, not eyeballed:

1. **DOM-measure the rail rect** at 390 px and at desktop width: 72×144 and 96×192 exactly, on tiers 1–4 and on a sold-out card. A fitted element is verified by its rendered rect.
2. **Screenshots:** real seller page at 390 px, 320 px (longest variety name: no horizontal scroll, no clipped text), iPad portrait 820 px (single column, 96 px rail), desktop ≥ 1024 px (2 columns, equal-height row with one in-stock + one sold-out card, footers ragged as ruled — any `mt-auto` in the diff is a fail).
3. **All eight combinations rendered:** {in-stock, sold-out} × {tier 1, tier 2, tier 3, tier 4} — tier 2 must show the crop plate whole (not the motif), sold-out plates at full fidelity beside the working outline pill.
4. **Variety-context diff:** variety page listings rendered before/after — byte-for-byte identical card (Nadia §6.5); the only shared-file changes are the seller-conditional branches.
5. **Diff audit for token discipline:** grep the build diff for `#[0-9a-fA-F]`, `rgb(`, and `-[` arbitrary values — the only permitted hit is `aspect-[1/2]` (and the structural `grid-cols-[auto_minmax(0,1fr)]`, which carries no measurement). Any literal from the §5.2 table changed in this diff is a fail.
6. **Skeleton parity:** seller loading page at phone and `lg` promises the shipped shape (rail block + 2-column grid); variety loading page unchanged.
7. **Focus walk + 200 % text:** focus order and visible ring exactly as today; no overflow at 200 % / 320 px. Contrast: no new text/background pairings are introduced by this build — confirmed by inspection of §5.3 (every ground under text is a ground text already sits on today).
8. **Live check after deploy**, per house rule — local render is not verification.

**Checked at spec stage:** structure identical to Nadia's ruling (order, content, tiers, alt text untouched — visual layer only) · every value in §5.3 traced to a token/scale/inherited value · all states enumerated (§2.3) · hierarchy squint/grayscale argued (§6) · motion ruled (§4) · artwork handling per Elena (whole, contain, paper ground, self-hosted via `lib/images`).
**Deliberately left unchecked at spec stage:** rendered proof at real viewports (builder + Quinn, §8 above — this seat audited from code, as in the 2026-11-20 audit, because seller-detail with live listings does not render on the local data snapshot); artwork content/tone (Elena's lane); the C7 sequencing decision (§7.1 — Hue's).

— Mina, UI Design, 2026-11-20. Next: Quinn's gate on this spec with Nadia's, then Hue's build brief.
