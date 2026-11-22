# Tranche 2 — System Foundation: Design Specification

**Seat:** Mina, UI Design (author). Standing collaborators applied throughout: Iris (color theory — feeling only; every feeling call below is hers in substance), Ada (accessibility — WCAG 2.2 AA floor; her prescribed values are binding minimums and are stated exactly), Thea (typography — type values are hers; this spec touches type only inside the badge and chip components it owns).
**Date:** 2026-11-21 · **Status:** Design spec only. No code, no build. Written so a pipeline build brief can be lifted from it verbatim.
**Authorization:** Dustin approved all five tranches of the full-audit fix backlog on 2026-11-21; Tranche 1 is fully shipped; Tranche 2 builds next, in order, Quinn-gated, deep effort.
**Scope:** Item 2.1 token consolidation (audit F-01, F-02) · Item 2.2 badge family unification (F-07, IRIS-C-05) · Item 2.3 chip split (F-13, F-24 chip half). Source findings: `full-audit-2026-11-21/AUDIT.md` §6 Tranche 2 and §5, `full-audit-2026-11-21/sections/mina-ui.md`, `sections/iris-color.md`, `sections/ada-accessibility.md` + `sections/ada-addendum.md`, and Batch A of `ui-audit-2026-11-20/AUDIT.md` §4.5/§5 (Quinn-gated PASS WITH NOTES, 2026-11-20). Code truth: `origin/main` via `git show` only — the working tree sits on a stale branch and was never read. Baseline includes Tranche 1.3 as shipped (PR #22): badge border alphas at Ada's prescribed values and `--color-line-strong: #91825C` are already live on `origin/main` and are the floor this spec builds on, not work it re-specifies.

**House standards binding this spec:** US spelling throughout. Prices are never shown anywhere — nothing in this tranche touches price display, and no token, badge, or chip specified here may ever carry a price. Illustrations are always shown whole — no token or component here crops or stretches artwork; the artwork rail's 8px inner radius is preserved exactly. Phone-first for public surfaces, iPad-first for admin, every surface a PWA. No visible forms are designed here; the admin Sheet remains the only editing surface and only its shadow token changes name, not its behavior.

---

## 0. The one rule that governs all of Tranche 2

**Consolidation is value-preserving.** The full audit found zero palette drift (§5: "the palette itself passed with zero token drift; do not disturb it"), and every color value on `origin/main` today is either exact or within 3.5 Delta E of its token by design. Tranche 2 therefore *names* the values the site already renders; it does not improve, snap, warm, or round them. The rendered site must not change except for the five prescribed changes registered in §5 of this spec (all inside Item 2.2/2.3). Any other rendered difference after the build is a defect, and §6 gives Quinn the equality checks that prove it.

Three consequences of that rule, stated now because they decide arguments later:

1. **Off-scale values become tokens at their exact values.** The 3px, 5px, 7px, and 9px spacing values in the Quiet Ledger card and the Small Farm badge are tokenized as 3px, 5px, 7px, and 9px. Snapping them to the 4/8 scale would be a design change wearing a consolidation's clothes; it is not authorized by this tranche and is recorded as Pushback P-5 (§7).
2. **Stock Tailwind shadows are tokenized verbatim.** The admin Sheet's `shadow-xl` and the header menu's `shadow-lg` become named tokens whose values are the exact strings Tailwind renders today. Inventing warmer sheet shadows would change the rendered admin; that is a polish decision for a later tranche, recorded as Pushback P-3 (§7).
3. **Frozen RGB in the listing shadows stays frozen.** The Quiet Ledger shadows and stem rule are written in `rgb(151 134 95 / …)` — the RGB of the *old* line-strong `#97865F`. Tranche 1.3 moved the line-strong token to `#91825C` (RGB 145, 130, 92) and correctly did not touch the shadows. These shadow tokens are therefore defined with the literal 151/134/95 values and must **never** be re-derived from, aliased to, or "helpfully" updated to the current line-strong token. The token file marks them `frozen: do not re-derive` (§2.1.2).

---

## 1. How to read this spec / how the brief lifts from it

- §2, §3, §4 are the build: token tables with exact values, per-component change lists with file paths, and behavioral contracts. Class names, token names, and file paths in these sections are normative — the brief copies them unchanged.
- §5 is the **rendered-change register**: the complete, closed list of rendered differences the build is allowed to produce. If it is not in §5, it must not render differently.
- §6 is the **acceptance checklist** Quinn executes. Every check is written to be runnable: a grep with its expected count, a computed-style comparison, or a contrast recomputation with its expected unrounded value.
- §7 is **pushback** — places where a finding's literal fix would hurt the work, with reasoning, for Hue to carry to Dustin. Nothing in §7 is silently deviated from in §§2–4; where a pushback changes what §§2–4 specify, the section says so and points here.
- §8 is **what was left undecided, and why.** Short on purpose: everything else in this document is decided.
- Contrast method everywhere: WCAG relative luminance (linearize sRGB, weight 0.2126 / 0.7152 / 0.0722, (L1 + 0.05) / (L2 + 0.05)); alpha blends computed channel by channel against the badge's own ground, channels rounded to integers as a browser renders them. The unrounded value decides pass/fail. Floors: 4.5:1 normal text, 3:1 non-text (component boundaries, meaningful graphics, focus), per WCAG 2.2 AA criteria 1.4.3 and 1.4.11. All ratios in this spec were recomputed from `origin/main` hex values for this spec, not copied from the audits, except where a value is explicitly credited to Ada's shipped Tranche 1.3 computation (those were spot-verified and agree within 0.01).

---

## 2. Item 2.1 — Token consolidation (F-01, F-02)

### 2.1.0 What exists, what is missing (baseline, `origin/main` post-Tranche 1)

`v2/app/globals.css` `@theme` today defines: 20 color tokens (complete, correct, untouched by this item), 3 font tokens plus mono, **one** radius token (`--radius-card: 18px`), **one** shadow token (`--shadow-card`), and two motion tokens (`--duration-filter-item: 220ms`, `--ease-filter-settle` — keep both, unchanged). There is no spacing scale beyond Tailwind's base, no radius scale, no shadow scale, no breakpoint names, and no token file anywhere in the repo.

The audit counted **431 lines containing arbitrary bracket values** across components + app (audit method: lines matching a bracketed value in class strings). That number mixes four different things, and this item dispositions each category separately — see the disposition table in §2.1.5. A literal "zero arbitrary values" outcome is neither possible nor desirable (grid templates and viewport-relative layout are legitimately arbitrary); the honest target, and the one §6 tests, is: **zero arbitrary values in the radius, shadow, spacing, breakpoint, and badge/chip color-literal families outside the named allowlist in §2.1.5.**

Measured baseline for the families this item owns (recounted for this spec from `origin/main`, components + app):

| Family | Baseline | Where |
|---|---|---|
| `rounded-[…]` lines | 62 lines | `rounded-[18px]` ×23, `rounded-[12px]` ×20, `rounded-[10px]` ×14, `rounded-[14px]` ×3, `rounded-[8px]` ×1, `rounded-[3px]` ×1 |
| Stock radius utilities spelling token values | `rounded-lg` (8px) ×23 uses, `rounded-xl` (12px) ×13 uses, `rounded-sm` (4px) in TrendBars | Same values, second spellings (F-03) |
| `shadow-[…]` lines | 4 lines | ListingRow ×3 treatments, Skeleton ×1 (copies ListingRow) |
| Stock shadow utilities | `shadow-xl` ×2 (Sheet, seller sort menu), `shadow-lg` ×1 (HeaderMenu), `shadow` ×1 (FilterStrip chevrons) | F-02; AD1's `--shadow-sheet` never created |
| Spacing arbitrary lines | 7 lines | ListingRow `pt-[18px]`, `mt-[3px]`, `mt-[9px]`, `px-[18px]`; SmallFarmBadge `gap-[5px]`, `py-[2px]`, `pl-[7px]`; variety-view `mt-[5px]` |
| `min-h-[44px]` lines | 39 lines | The `.tap` value (44px) re-typed as a literal across admin and public components |
| Breakpoint arbitrary occurrences | `min-[744px]` ×207, `min-[1181px]` ×3, `min-[1024px]` ×4 | Admin dialect (F-24); the 1024px uses equal Tailwind `lg` exactly |
| Hex literals in components | `border-[#e9dfc2]` ×2 (ListingRow, Skeleton), `bg-[#dfe9d6]` ×1 (ListingRow), Swatch hatch `#f0e5cb` / `#fffdf6` in an inline style (Swatch.tsx) | F-01, Iris §8 table |
| Type arbitrary lines | `text-[15px]` ×81, `text-[17px]` ×38, `text-[13px]` ×26, `text-[28px]` ×22, plus leading/tracking literals | **Not owned by 2.1** — Thea's scale; dispositioned in §2.1.5, with the badge/chip exceptions owned by §§3–4 |

### 2.1.1 The token file — location, format, and sync rule

**Deliverable:** one token file at **`v2/design-tokens/tokens.json`**, written in the Design Tokens Community Group format (2025.10): an object with a `$value` is a token, other objects are groups, `$type` declares the kind, `$description` documents role and usage, aliases reference other tokens with `{group.token}` syntax.

**Sync rule (normative):** `tokens.json` is the source of truth for every token in §§2–4. The `@theme` block in `v2/app/globals.css` is generated from it (or hand-kept in exact sync — the tooling choice is the one undecided item, §8.1), and the build ships a test that parses both and fails if any token name or value differs between them. A token that exists in only one of the two files is a build failure. Color tokens already in `@theme` are transcribed into `tokens.json` at their current values, unchanged — transcription only, so the file is complete; this spec does not re-table them because §5 of the full audit already records them as passing and undisturbed.

**Naming rule (per the UI playbook):** system tokens are named by role, never by value (`radius.control`, never `radius.12`). Component tokens reference system tokens. Raw values live only at the reference layer of the file. CSS variable names below are the Tailwind v4 `@theme` keys that generate the utilities named in the right-hand column; the builder uses exactly these names.

### 2.1.2 Radius scale — exact tokens

The underlying scale already in the rendered site is coherent (F-03); this table names it. Every value is the value rendered today. Two spellings of one value collapse to one utility; no value is created, dropped, or rounded.

| DTCG token | CSS variable (`@theme`) | Value | Utility | Role — where it is used, and only there | Replaces (rendered today as) |
|---|---|---|---|---|---|
| `radius.card` | `--radius-card` | `18px` | `rounded-card` | Cards, art frames, sheets (all corners), page alert cards, listing cards, AdminShell rail | Already exists; `rounded-[18px]` ×23, `.card` / `.art-frame` CSS |
| `radius.search` | `--radius-search` | `14px` | `rounded-search` | SearchBox input and autocomplete panel only. A one-component language, kept as its own step on purpose: 14px is what the search control renders today, and snapping it to 12px or 18px would be a visible change no finding asks for | `rounded-[14px]` ×3 (SearchBox ×2, search loading skeleton ×1) |
| `radius.control` | `--radius-control` | `12px` | `rounded-control` | Buttons (`.btn` already 12px in CSS), menus and dropdown panels, admin master-list rows, choice-group cards, error summary boxes, Protection notice block (§3) | `rounded-[12px]` ×20, `rounded-xl` ×13 (HeaderMenu, AdminShell rail links, PaginationSkeleton, home/search result sheets, seller skeleton bar) |
| `radius.field` | `--radius-field` | `10px` | `rounded-field` | Form fields (`.field` already 10px in CSS), small notice/status boxes, TrendBars track | `rounded-[10px]` ×14 (ReportForm longhand fields, admin sign-in notices, status banners, duplicate sticky label) |
| `radius.inner` | `--radius-inner` | `8px` | `rounded-inner` | Inner image frames (VarietyCardImage, CropCardImage, ListingArtwork rail), skeleton blocks (`.skeleton` already 8px in CSS), code blocks | `rounded-lg` ×23, `rounded-[8px]` ×1 |
| `radius.bar` | `--radius-bar` | `4px` | `rounded-bar` | TrendBars bars; the `:focus-visible` ring's corner rounding in `globals.css` (already 4px there) | `rounded-sm` in TrendBars |
| `radius.marker` | `--radius-marker` | `3px` | `rounded-marker` | Duplicate-review shape markers only (the rounded-square listing marker in review detail). 3px and 4px are different rendered values and stay different tokens | `rounded-[3px]` ×1 |
| `radius.full` | `--radius-full` | `999px` | `rounded-full` (existing utility name kept) | Chips, badges, pills, dots, `.btn-pill` | Already the rendered value everywhere; tokenized for file completeness |
| `radius.packet-inner` | `--radius-packet-inner` | `13px` | (CSS only, no utility) | `.packet::after` keyline frame inset radius in `globals.css` (18px card radius minus the 5px inset). Already centralized in CSS; tokenized so the derivation is recorded, value unchanged | `border-radius: 13px` literal in `globals.css` |

Sheet top corners: the Sheet's phone form is `rounded-t-[18px]` — it maps to `rounded-t-card` (same `--radius-card` token, top corners only). No separate token.

**Explicit non-changes:** `.btn` (12px), `.field` (10px), `.skeleton` (8px), `.card` / `.art-frame` (18px) already hold their values in `globals.css`; the build points those CSS rules at the variables above (`border-radius: var(--radius-control)` etc.) with identical computed values.

### 2.1.3 Shadow scale — exact tokens

Six rendered treatments plus two already-centralized CSS treatments. All values are the rendered values today, character for character in computed terms. Tailwind stock values are given as Tailwind v4 renders them; the acceptance check (§6, check 2.1-C) compares **computed** `box-shadow`, so if the installed Tailwind version's stock string differs in serialization, the computed value is what must match.

| DTCG token | CSS variable (`@theme`) | Value (exact) | Utility | Role | Replaces |
|---|---|---|---|---|---|
| `shadow.card` | `--shadow-card` | `0 1px 2px rgb(90 70 20 / 0.08), 0 1px 1px rgb(90 70 20 / 0.05)` | `shadow-card` | Standard cards, SearchBox autocomplete panel, AccountPanel alerts list. Already exists; unchanged | — |
| `shadow.listing-raised` | `--shadow-listing-raised` | `0 6px 20px rgb(151 134 95 / 0.14)` | `shadow-listing-raised` | Quiet Ledger card, in stock. **`frozen: do not re-derive`** — 151/134/95 is the retired line-strong RGB, kept deliberately (§0.3) | `shadow-[0_6px_20px_rgba(151,134,95,0.14)]` in ListingRow and Skeleton |
| `shadow.listing-flat` | `--shadow-listing-flat` | `0 2px 8px rgb(151 134 95 / 0.08)` | `shadow-listing-flat` | Quiet Ledger card, sold out. Same frozen-RGB rule | `shadow-[0_2px_8px_rgba(151,134,95,0.08)]` in ListingRow |
| `shadow.visit-pill` | `--shadow-visit-pill` | `inset 0 -1px 0 rgb(46 107 79 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.5)` | `shadow-visit-pill` | Visit shop pill, in stock only (sold out renders `shadow-none`, unchanged). 46/107/79 is leaf-600's RGB at 35% — recorded as a literal value, not an alias, so a future leaf-600 change cannot silently move it | `shadow-[inset_0_-1px_0_rgba(46,107,79,0.35),inset_0_1px_0_rgba(255,255,255,0.5)]` in ListingRow |
| `shadow.sheet` | `--shadow-sheet` | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` | `shadow-sheet` | Admin Sheet (bottom-sheet and centered forms) and the admin seller sort menu. **This token is AD1**, the pre-build blocker from the 2026-11-20 joint recommendation, finally issued — with the value the Sheet already renders (`shadow-xl`), per §0.2 | `shadow-xl` ×2 (Sheet.tsx, seller-list.tsx sort menu) |
| `shadow.menu` | `--shadow-menu` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` | `shadow-menu` | HeaderMenu panel (the one public overlay) | `shadow-lg` ×1 (HeaderMenu.tsx) |
| `shadow.strip-button` | `--shadow-strip-button` | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` | `shadow-strip-button` | FilterStrip chevron buttons | Bare `shadow` utility in FilterStrip.tsx |
| `shadow.button-inset` | `--shadow-button-inset` | `inset 0 -1px 0 rgb(0 0 0 / 0.35)` | (CSS only) | `.btn-primary` and `.btn-danger` letterpress edge, already centralized in `globals.css`; tokenized for completeness, value unchanged | Literal in two `globals.css` rules |
| `shadow.card-image` | `--shadow-card-image` | `0 2px 0 var(--color-leaf-50)` | (CSS only) | `.card-image` sage line. Tokenized as rendered and marked **`legacy — removal is Tranche 4 item C8's decision, not this tranche's`**. Tranche 2 names it; it does not strike it | Literal in one `globals.css` rule |

**Elevation ladder, for the record (no new levels created):** flat content (listing-flat, card-image line) → resting cards (`shadow-card`) → raised listing card (`shadow-listing-raised`) → menus (`shadow-menu`) → sheets/dialogs (`shadow-sheet`). Five steps, all pre-existing. Nothing in this tranche adds a sixth.

### 2.1.4 Spacing, target size, and breakpoints — exact tokens

**The system scale needs no new values.** Tailwind's spacing steps derive from the 4px base (`--spacing: 0.25rem`) and every on-scale utility in the codebase (`gap-2`, `p-4`, `mt-1`, the admin `p-4` stepping to `p-5` at the admin breakpoint, and the rest) already consumes it. `tokens.json` transcribes the steps the product actually uses — 0, 4, 8, 12, 16, 20, 24, 32, 40, 48px as `space.0` through the used range — as documentation of the scale, with no CSS change. What this item adds is tokens for the values that today exist **only** as arbitrary literals:

| DTCG token | CSS variable (`@theme`) | Value | Utility generated | Used by (complete list) |
|---|---|---|---|---|
| `space.listing-top` | `--spacing-listing-top` | `18px` | `pt-listing-top` | ListingRow card top padding; ListingSheetSkeleton card top padding |
| `space.visit-inline` | `--spacing-visit-inline` | `18px` | `px-visit-inline` | ListingRow Visit shop pill inline padding |
| `space.listing-subline` | `--spacing-listing-subline` | `3px` | `mt-listing-subline` | ListingRow location line top margin |
| `space.listing-status` | `--spacing-listing-status` | `9px` | `mt-listing-status` | ListingRow status line top margin |
| `space.caption-offset` | `--spacing-caption-offset` | `5px` | `mt-caption-offset` | variety-view hero caption top margin (`mt-[5px]`) |
| `size.target` | `--size-target` | `44px` | `min-h-target`, `min-w-target` | Every `min-h-[44px]` literal (39 lines: admin field minimums, chip helpers' redundant minimums until §4 removes them, sheet close, list rows). Where the element is a standalone interactive block, the builder may instead apply the existing `.tap` class — same computed value; the choice per file is recorded in the build's change list, and §6 checks the computed value, not the mechanism |
| `breakpoint.admin` | `--breakpoint-admin` | `744px` | variant `admin:` | All 207 `min-[744px]:` occurrences (admin shell, sheets, lists, pages, loading files) |
| `breakpoint.admin-wide` | `--breakpoint-admin-wide` | `1181px` | variant `admin-wide:` | All 3 `min-[1181px]:` occurrences (AdminShell rail width, admin home max-width) |

The 4 `min-[1024px]:` occurrences (review detail-duplicate ×2, StatsSnapshot ×1, admin home ×1) map to Tailwind's existing `lg:` variant (1024px exactly). Same value, named variant, no new token.

Badge-internal spacing (`gap-[5px]`, `py-[2px]`, `pl-[7px]`, mark `size-[13px]`) is **not** tokenized here — it belongs to the badge component and is tokenized as component tokens in §3.3, so the badge owns its own optical values in one place.

**Admin density, recorded as tokens (AD2 discharged for the values in this tranche's scope):** the admin card padding pattern `p-4` (16px) stepping to `p-5` (20px) at `admin:` is already on-scale and needs no new token; `tokens.json` records it as the component token `component.card.padding.admin: { default: {space.16}, admin: {space.20} }` so the density decision exists in the file, not only in copy-pasted classes (F-24). The public card padding stays as each component renders it today — no padding value changes anywhere in this item.

### 2.1.5 How the arbitrary values are killed — pattern table and allowlist

**Replacement table (normative).** The builder applies these mappings mechanically; any occurrence that fits no row stops the build and comes back to this seat rather than being improvised.

| Arbitrary pattern (today) | Replacement | Notes |
|---|---|---|
| `rounded-[18px]`, `rounded-t-[18px]` | `rounded-card`, `rounded-t-card` | Includes Skeleton, ImportedRatingPanel, AccountPanel alerts list, admin alert cards, home "How this directory works" panel |
| `rounded-[14px]` | `rounded-search` | SearchBox input + panel; search loading skeleton |
| `rounded-[12px]`, `rounded-xl` | `rounded-control` | Includes `.btn` CSS, HeaderMenu, AdminShell rail links, PaginationSkeleton bars, result sheets |
| `rounded-[10px]` | `rounded-field` | Includes `.field` CSS, ReportForm longhand fields (class migration only — ReportForm's duplication of `.field` is F-22, a Tranche 3 concern; here only its radius literal is tokenized), TrendBars track |
| `rounded-lg`, `rounded-[8px]` | `rounded-inner` | Image frames, skeleton bars, code blocks, skip link, guide panels |
| `rounded-sm` (TrendBars bars) | `rounded-bar` | — |
| `rounded-[3px]` | `rounded-marker` | Review duplicate markers |
| `shadow-[0_6px_20px…]`, `shadow-[0_2px_8px…]`, pill inset `shadow-[inset…]` | `shadow-listing-raised`, `shadow-listing-flat`, `shadow-visit-pill` | ListingRow + Skeleton only |
| `shadow-xl` | `shadow-sheet` | Sheet + seller sort menu |
| `shadow-lg` | `shadow-menu` | HeaderMenu |
| `shadow` (bare, FilterStrip) | `shadow-strip-button` | — |
| `pt-[18px]` / `px-[18px]` / `mt-[3px]` / `mt-[9px]` / `mt-[5px]` | `pt-listing-top` / `px-visit-inline` / `mt-listing-subline` / `mt-listing-status` / `mt-caption-offset` | §2.1.4 |
| `min-h-[44px]` | `min-h-target` or `.tap` | §2.1.4; §4 removes the redundant ones on chips entirely |
| `min-[744px]:` / `min-[1181px]:` / `min-[1024px]:` (in admin) | `admin:` / `admin-wide:` / `lg:` | Variant prefix only; every utility after the colon is unchanged |
| `border-[#e9dfc2]` | `border-listing` — new color token `--color-listing: #E9DFC2` (reference name `color.listing-border`), transcribed into `tokens.json` and `@theme` | Promoted, **not** snapped to `line` `#E0D5B8` (Delta E 3.5 apart — a visible difference, and §0 forbids it). Iris §8 records this value as a near-line that is not line; the token name records that it is the listing card's own hairline |
| `bg-[#dfe9d6]` | `bg-visit` — new color token `--color-visit: #DFE9D6` (`color.visit-fill`) | Promoted, **not** snapped to `leaf-50` `#E3EAD8` (Delta E 1.3 — perceptually near-identical, definitionally different; the 2026-11-20 recommendation §5.1 ruled promotion, and §0 confirms it). Leaf text on it measures 8.46:1 (passes 4.5:1), recorded here so the token carries its pair |
| Swatch hatch literals `#f0e5cb`, `#fffdf6` (inline style, Swatch.tsx) | The existing tokens they copy: `var(--color-paper-deep)`, `var(--color-surface)` in the gradient string | Values identical (Delta E 0); no new token |
| `border-[1.5px]` (Visit pill) + `border-[rgba(151,134,95,0.45)]` (Skeleton stem rule) | `--border-visit: 1.5px` consumed as `border-(--border-visit)` or a `.visit-pill` CSS rule in `globals.css`; stem rule color becomes token `--color-stem-rule: rgb(151 134 95 / 0.45)` (`color.stem-rule`, frozen-RGB rule applies), consumed by both `globals.css` `.listing-stem-rule` and Skeleton | These two are widths/colors, not radius/shadow/spacing, but they are the same F-01 literals in the same two components; leaving them would leave the flagship card half-consolidated. This is the only scope extension in 2.1 and it is bounded to ListingRow + Skeleton + their `globals.css` rules |

**Lint ban (Batch A4, discharged here):** the build adds a repository test (the project's existing test pattern, as Tranche 1.3's test did) that walks `v2/app`, `v2/components`, and `v2/lib` and fails on: `rounded-[`, `shadow-[`, `shadow-xl`, `shadow-lg`, a bare `shadow` utility on FilterStrip, `min-[744px]`, `min-[1181px]`, `border-[#`, `bg-[#`, and any `#e9dfc2` / `#dfe9d6` literal outside `tokens.json` and the `@theme` block. The test file itself and this spec are the only permitted holders of the banned strings as text.

**Allowlist — arbitrary values that remain, each named with its reason.** These stay arbitrary after Tranche 2, by decision, and the lint test carries them as an explicit per-pattern exemption list (not a blanket pass):

| Pattern | Reason it remains |
|---|---|
| `grid-cols-[…]` templates (incl. `md:grid-cols-[380px_minmax(0,1fr)]`, admin `[360px_minmax(0,1fr)]` / `[340px_minmax(0,1fr)]` list grids, `[1fr_320px]` account/farm grids) | Page layout, one template per page, no cross-page reuse to consolidate. Tokenizing a value used once, in one grid, adds indirection without removing drift risk. The breakpoint *variants* around them are tokenized (§2.1.4); the templates are not |
| `max-w-[…]` content measures (`280px` theme art, `300px`/`320px` state plate steps, `380px` hero, `420px`, `560px` Sheet — see note, `1080px`/`1280px` admin content) | Single-surface layout decisions, each tied to its artwork or content column. Note: the Sheet's `560px` is recorded in `tokens.json` as `component.sheet.max-width` documentation, but its class may remain `min-[744px]:max-w-[560px]` → `admin:max-w-[560px]` after the variant rename; the value is documented, the utility stays literal. Accepted inconsistency, recorded deliberately: a max-width that appears once is documentation, not a utility |
| Viewport-relative values: `max-h-[92dvh]`, `max-h-[40dvh]`, `h-[calc(100dvh-10rem)]`, `max-h-[calc(100dvh-3rem)]`, `h-[60vh]`, `h-[40rem]`/`h-[30rem]` chart/map heights | Functions of the viewport, not scale steps. A static token cannot express them |
| `aspect-[1/2]` | The plate proportion (Elena's handling rule: plates shown whole at 1:2). Idiomatic as an aspect utility; the proportion itself is specified in the art direction, not the token file |
| `text-[…]`, `leading-[…]`, `tracking-[…]`, `decoration-[…]`, `underline-offset-[…]` — the type literals | **Thea's scale, not Mina's.** F-04 records a de facto scale (15px admin sans, 17px serif prose echo, 28px admin headings) that only Thea may formalize. Tokenizing type inside a radius/shadow/spacing item would smuggle a type decision past its owner. Exceptions: the badge and chip components own their internal type as component tokens (§§3–4), because there the type is part of the component being unified. Everything else waits for Thea's pass and is counted as remaining-by-design, not as a 2.1 failure. See Pushback P-1 (§7) |
| `size-[3px]` (tab-bar petal dot), `align-[1px]` (status dot), `w-18` (artwork rail — already a dynamic spacing utility, not arbitrary) | Single-component optical values with no second consumer. The dot's reserved space is part of the tab bar's pass record and must not be disturbed |
| Property arbitraries (`[-webkit-overflow-scrolling:touch]`, `[scrollbar-width:none]`, `[&::-webkit-scrollbar]:hidden`) | CSS property settings, not design values |

**Out of this item, explicitly:** the OG route's ~18 hand-copied hexes and `global-error.tsx`'s 3 (F-06 / Batch A5) are **not** in Tranche 2 as approved — §6 of the full audit assigns Tranche 2 only items 2.1–2.3, and A5 is not among them. They are exact today (Iris §8, Delta E 0) and remain a staleness trap for a later tranche; this spec does not touch them and §6 does not test them. Email template near-miss values (Iris §8) are likewise untouched.

### 2.1.6 Per-file change list — Item 2.1

| File | Change |
|---|---|
| `v2/design-tokens/tokens.json` | **New.** Full DTCG file: transcribed color/font/motion tokens (unchanged values) + all tokens in §§2.1.2–2.1.4, §2.1.5 color promotions, and §§3–4 component tokens |
| `v2/app/globals.css` | `@theme`: add every CSS variable in §§2.1.2–2.1.4 + `--color-listing`, `--color-visit`, `--color-stem-rule`. Component layer: `.card`, `.art-frame`, `.btn`, `.field`, `.skeleton`, `.packet::after`, `:focus-visible`, `.listing-stem-rule`, `.card-image`, `.btn-primary`, `.btn-danger` rules point at the variables (identical computed values). `.chip` rules are replaced by §4's split — the two items land together in this file and must be sequenced 2.1 first, then 2.3's edit, in one build |
| `v2/components/variety/ListingRow.tsx` | `rounded-[18px]` → `rounded-card`; `border-[#e9dfc2]` → `border-listing`; shadows → `shadow-listing-raised` / `shadow-listing-flat`; `pt-[18px]` → `pt-listing-top`; `mt-[3px]` → `mt-listing-subline`; `mt-[9px]` → `mt-listing-status`; pill `bg-[#dfe9d6]` → `bg-visit`, `px-[18px]` → `px-visit-inline`, inset shadow → `shadow-visit-pill`, `border-[1.5px]` → the §2.1.5 border token mechanism. Status tone classes change under §3, not here |
| `v2/components/ui/Skeleton.tsx` | ListingSheetSkeleton: same ListingRow mappings (border, shadow, top padding, stem-rule color token). HeroArtSkeleton `rounded-[18px]` → `rounded-card`; PaginationSkeleton `rounded-xl` → `rounded-control`; VarietyCard/CropCard skeleton image bars `rounded-lg` → `rounded-inner` |
| `v2/components/ui/Swatch.tsx` | Hatch gradient literals → `var(--color-paper-deep)` / `var(--color-surface)` |
| `v2/components/search/SearchBox.tsx` | Input + panel `rounded-[14px]` → `rounded-search`; panel already `shadow-card` (no change); row `rounded-lg` → `rounded-inner` |
| `v2/components/admin/Sheet.tsx` | `shadow-xl` → `shadow-sheet`; `rounded-t-[18px]` → `rounded-t-card`; `min-[744px]:` → `admin:` (all occurrences in file); `rounded-[18px]` → `rounded-card`; `max-w-[560px]` stays literal (§2.1.5 note); close button `min-h-[44px] min-w-[44px]` → `min-h-target min-w-target` or `.tap` |
| `v2/components/admin/AdminShell.tsx` | `min-[744px]:` → `admin:`, `min-[1181px]:` → `admin-wide:`; rail `rounded-[18px]` → `rounded-card`; rail links `rounded-xl` → `rounded-control`; rail widths `w-[216px]` / `w-[232px]` stay literal (allowlist: single-component layout) |
| `v2/components/layout/HeaderMenu.tsx` | Panel `rounded-xl` → `rounded-control`; `shadow-lg` → `shadow-menu` |
| `v2/components/ui/FilterStrip.tsx` | Chevron `shadow` → `shadow-strip-button`. **Nothing else in this file changes in Tranche 2** — its padding, chevron size, and scroll-padding are Ada A3 / Tranche 3 B1 territory, still open after this tranche, and must not be folded in |
| `v2/components/seller/ImportedRatingPanel.tsx` | `rounded-[18px]` → `rounded-card` |
| `v2/components/admin/TrendBars.tsx` | Track `rounded-[10px]` → `rounded-field`; bars `rounded-sm` → `rounded-bar` |
| All remaining files with `rounded-[…]` / `rounded-xl` / `rounded-lg` / `shadow-xl` / `min-[744px]:` / `min-[1181px]:` / `min-h-[44px]` occurrences (admin pages and `_components` under `v2/app/admin/**`, `v2/app/page.tsx`, `v2/app/search/**`, `v2/app/seller/**`, `v2/app/crop/**`, `v2/components/account/AccountPanel.tsx`, `v2/components/report/ReportForm.tsx`, `v2/components/crop/**`) | Mechanical application of the §2.1.5 replacement table only. No other class, structure, or content change in any of these files under this item |
| `v2/tests/unit/` (new test file, builder names it for the tranche) | Token sync test (§2.1.1) + arbitrary-value lint test (§2.1.5). Both must fail on pre-build `origin/main` and pass after — non-vacuity is an acceptance check (§6) |

---

---

## 3. Item 2.2 — Badge family unification (F-07, IRIS-C-05)

### 3.1 The family, defined

Before this item the product has five badge-shaped things with no shared component (F-07): the availability pill, the Quiet Ledger dot + word, the Small Farm badge, the Protection block, and the admin RoleChip (plus the waitlist status pills inside AccountPanel, which duplicate the availability pill's classes by hand). This item makes them **one family**: one base construction in `globals.css`, one border rule, one token set, with tone variants for meaning. The joint recommendation's settled line governs (§4.1.2 of the 2026-11-20 audit): *one badge form, three meanings kept* — availability (a product state), Small Farm (seller identity), and Protection (a trust claim) become tones of one system; the meanings are **not** flattened into one another.

**What "one family" means concretely (normative):**

- One base class **`.badge`** in `globals.css` `@layer components`: `display: inline-flex; align-items: center; border: 1px solid; border-radius: var(--radius-full); font-family: var(--font-sans);` plus the tone classes in §3.2 that set ground, text, and border from tokens. Every badge below is `.badge` + one tone class (+ a size/variant modifier where tabled). Hand-duplicated pill class strings (AccountPanel's three copies, ListingRow has none — it is the dot presentation, §3.4) are deleted and replaced.
- **One border rule (Ada's floor, binding):** every badge border must compute to **at least 3:1 against its own ground, unrounded**, under WCAG 1.4.11. The shipped Tranche 1.3 alphas in §3.2 are the floor values — no badge in this family may ship a weaker border, and any future tone must ship its computation with it. Full-strength borders satisfy the rule wherever their ratio is computed and recorded (§3.2, Protection row).
- **What does not unify:** letter case and weight. Availability and waitlist pills are uppercase bold; Small Farm is sentence-case semibold with its mark; Protection is a stacked notice (§3.5). Forcing one case across the family would erase the exact distinctions a returning shopper uses to tell a *state* from an *identity* — Iris's meaning discipline and Ada's cognitive-clarity rule both argue against it. The family resemblance is carried by shape (full radius for single-line badges), the 1px token border, the tint-ground construction, and the shared token file — not by identical typography. See Pushback P-2 (§7).

**Sizes:** single-line badges have exactly two heights, both already rendered today: the standard pill (Availability/waitlist construction: `px-2 py-0.5`, text 12px — computed height ~22px) and Small Farm's two named sizes (standard ~20px chip / large ~28px chip). No new size is created. The Protection notice (§3.5) is the family's one non-pill geometry.

### 3.2 Variant → tokens table (complete family)

Grounds, text, and borders below are the values rendered on `origin/main` today **except** the Protection row and the ListingRow in-stock row, which are the prescribed changes (also registered in §5). Border ratios are against the badge's own ground, computed per §1's method. Text ratios are against the badge's own ground; floor 4.5:1 for all badge text (all badge text is normal size).

| # | Variant (component · surface) | Ground token → value | Text token → value (ratio) | Border token → value (ratio vs own ground) | Case / weight / mark |
|---|---|---|---|---|---|
| 1a | Availability — In stock (`Availability.tsx` · home restocked rail) | `leaf-50` → `#E3EAD8` | `leaf` → `#1E4634` (8.60:1 ✓) | `leaf` at 60% → blend `#6D8876` (**3.13:1 ✓** — Ada, shipped 1.3) | Uppercase, bold, 12px, tracking 0.06em |
| 1b | Availability — Sold out | `petal-50` → `#F7E8EC` | `petal` → `#8E2A52` (6.80:1 ✓) | `petal` at 65% → blend `#B36C88` (**3.27:1 ✓** — Ada, shipped 1.3) | Same |
| 1c | Availability — Preorder | `surface` → `#FFFDF6` | `leaf-600` → `#2E6B4F` (6.19:1 ✓) | `leaf-600` at 70% (**3.23:1 ✓** — Ada, shipped 1.3) | Same |
| 1d | Availability — Shop closed | `surface` → `#FFFDF6` | `muted` → `#6A5F4C` (6.15:1 ✓) | `muted` at 70% (**3.18:1 ✓** — Ada, shipped 1.3) | Same |
| 1e | Availability — Unknown | `warn-50` → `#F7EDD3` | `warn` → `#8A5E08` (4.89:1 ✓) | `warn` at 75% (**3.08:1 ✓** — Ada, shipped 1.3) | Same |
| 2a | Waitlist — Found (`AccountPanel.tsx` StatusLine · account alerts list) | Same as 1a | Same as 1a, label "Found" | Same as 1a (**3.13:1 ✓**) | Same as availability |
| 2b | Waitlist — Waiting · active | Same as 1c | Same as 1c, label "Waiting · active" | Same as 1c (**3.23:1 ✓**) | Same |
| 2c | Waitlist — Held | Same as 1e | Same as 1e, label "Held" | Same as 1e (**3.08:1 ✓**) | Same |
| 3a | Small farm — standard (`SmallFarmBadge.tsx` · listing rows, seller cards, legends) | `leaf-50` → `#E3EAD8` | `leaf` → `#1E4634` (8.60:1 ✓) | `leaf` at 60% (**3.13:1 ✓** — the badge's own pre-existing fix, now the family floor's proof) | Sentence case, semibold, tracking 0.01em, pod-and-sprout mark (§3.3) |
| 3b | Small farm — large (seller page header) | Same as 3a | Same as 3a | Same as 3a | Same mark, large size (§3.3) |
| 4 | **Protection — notice (NEW DRESS, §3.5)** (`ProtectionBadge.tsx` · variety page, under the facts card) | **`paper-deep` → `#F0E5CB`** | **Label `ink` → `#2E2A23` (11.40:1 ✓); note `ink-soft` → `#4A4438` (7.71:1 ✓)** | **`ink-soft` → `#4A4438` at full strength (7.71:1 vs own ground ✓; 8.58:1 vs the paper page ground ✓)** | Sentence case; label semibold 14px, note regular 14px; seal icon (§3.5). **No petal anywhere in this component after the build** |
| 5 | Admin role — Admin (`RoleChip.tsx`, migrated to chip-tag in §4 — its *tone* is specified here, its *component* there) | `leaf-50` → `#E3EAD8` | `leaf` → `#1E4634` (8.60:1 ✓) | `line-strong` → `#91825C` (the `.chip` border it inherits today; **3.07:1 vs leaf-50 ✓**, recomputed for this spec) | Sentence case (role word), semibold |
| 5b | Admin role — Reviewer (and any non-admin role) | `surface` → `#FFFDF6` | `ink` → `#2E2A23` (14.02:1 ✓) | `line-strong` → `#91825C` (**3.72:1 vs surface ✓**) | Sentence case, regular weight |
| 6 | Listing status line — all five states (`ListingRow.tsx` STATUS_TONE · variety and seller listing cards) — **not a pill; the family's listing-context presentation of rows 1a–1e** | None (the card is the ground: `surface`, or `paper` when sold out) | See §3.4 table (all ✓) | No border; the 8px dot is the graphic element (all dots ✓ vs both card grounds, §3.4) | Sentence case word, semibold 13px, dot + word + checked date |

**Explicitly not in the family:**

- **Admin review-count pill** (`AdminShell.tsx`, rail + tab variants: leaf fill, white numerals, 10.60:1 ✓). It is a count indicator inside a navigation link, not a status badge; its dress does **not** change in this tranche. Iris's note IRIS-C-03 (leaf fill reads as "go/good" for a waiting-for-attention count) is recorded and deferred with reasoning in Pushback P-4 (§7).
- **"Not yet rated"** (`RatingDisplay.tsx`): plain text with an outline star, no ground, no border. Not a badge; untouched.
- **Imported rating stars** (IRIS-C-07, ochre moonlighting as rating gold): a real meaning finding, but it belongs to the rating panel, not the badge family, and no sanctioned rating gold exists in the palette. Untouched by this tranche; the finding stays open for Iris, it is not silently absorbed here.

### 3.3 Small Farm badge — component tokens (discharges its §2.1.4 deferral)

The badge's optical values move from arbitrary classes in `SmallFarmBadge.tsx` into component tokens in `tokens.json` (`component.badge.small-farm.*`) and CSS variables consumed by the component. **Every value is the rendered value today.**

| Token | Value | Today |
|---|---|---|
| `component.badge.small-farm.standard.padding` | block 2px, inline-start 7px, inline-end 8px (`pr-2`) | `py-[2px] pl-[7px] pr-2` |
| `component.badge.small-farm.standard.gap` | `5px` | `gap-[5px]` |
| `component.badge.small-farm.standard.font-size / line-height` | `12px / 14px` | `text-xs leading-[14px]` |
| `component.badge.small-farm.standard.mark-size` | `13px` | `size-[13px]` |
| `component.badge.small-farm.large.padding` | block 4px (`py-1`), inline-start 8px (`pl-2`), inline-end 10px (`pr-2.5`) | Already on-scale utilities; recorded, no class change needed beyond token documentation |
| `component.badge.small-farm.large.gap` | `6px` (`gap-1.5`) | On-scale; recorded |
| `component.badge.small-farm.large.font-size / line-height` | `13px / 18px` | `text-[13px] leading-[18px]` — the 13px/18px pair becomes the badge's named large size; it does not enter Thea's general scale |
| `component.badge.small-farm.large.mark-size` | `16px` (`size-4`) | On-scale; recorded |

Behavior unchanged in every respect: non-interactive `<span>`, text never wraps (`whitespace-nowrap`, `shrink-0`), rendered only when the seller's Small Farm flag is true, no negative or placeholder state, mark in `currentColor` (leaf) and `aria-hidden`. The legend component (`SmallFarmLegend`) is unchanged except that it consumes the same badge.

**IRIS-C-06 disposition (In stock and Small Farm share leaf on leaf-50):** kept, deliberately. The two badges are separated by mark (pod-and-sprout vs none), case (sentence vs uppercase), and placement (seller name row vs home rail / account list — they do not share a screen region today, per Iris's own evidence). Recoloring Small Farm would spend a new hue the palette does not have and break a learned identity for a collision Iris herself grades potential rather than daily. The system rule recorded in `tokens.json` with both tones: *no future placement may put an availability pill and the Small Farm badge in the same row or card header.* If a future surface needs them adjacent, that surface comes back to Iris + Mina first.

### 3.4 Listing status line — the IRIS-C-02 fix (prescribed rendered change)

The pill and the line currently disagree (IRIS-C-02): In stock is `leaf` in the pill but `leaf-600` in the line, and Preorder is carefully separated in the pill (different step, different ground) then collapsed into In stock in the line (identical dot and word color). One status, one color step, both renderings:

| State | Dot (after) | Word (after) | Change? | Word ratio (surface / paper) | Dot ratio (surface / paper) |
|---|---|---|---|---|---|
| In stock | `bg-leaf` | `text-leaf` | **Yes — was `leaf-600` for both** | 10.42:1 / 9.42:1 ✓ | 10.42:1 / 9.42:1 ✓ |
| Preorder | `bg-leaf-600` | `text-leaf-600` | No (now distinct from In stock, as the pill already had it) | 6.19:1 / 5.60:1 ✓ | 6.19:1 / 5.60:1 ✓ |
| Sold out | `bg-petal` | `text-petal` | No | 7.93:1 / 7.17:1 ✓ | Same ✓ |
| Shop closed | `bg-muted` | `text-muted` | No | 6.15:1 / 5.56:1 ✓ | Same ✓ |
| Unknown | `bg-warn` | `text-warn` | No | 5.60:1 / 5.06:1 ✓ | Same ✓ |

Ada's addendum A-3 already ruled the underlying accessibility question (the word is the carrier, the dot is `aria-hidden` decoration, so no 1.4.1 failure exists either way; every dot also clears 3:1 as a graphic on both grounds, before and after). This change is therefore a *meaning-discipline* fix from Iris's seat, not a floor fix — and it is the better for being labeled honestly. Its full rendered extent: on listing cards for in-stock listings only, the 8px dot and the status word darken from leaf-600 `#2E6B4F` to leaf `#1E4634`. Nothing else on the card changes. Registered as change R-2 in §5.

### 3.5 Protection badge — its own dress (IRIS-C-05, fully specified)

**The finding:** Protection renders today as petal heading text on petal-50 with a full-strength petal border in a rounded-rectangle block (`rounded-lg`, 8px) — the identical tone pairing as the Sold out pill — for a legal meaning ("US Plant Variety Protection" / "US utility patent" / "Plant Breeders' Rights" plus a sourced note), on the same variety page whose listing cards use petal to mean "you cannot buy this." Petal carries five jobs in total (Iris §5); this item removes its second *status* job. IRIS-C-05 diagnoses the collision but prescribes no replacement dress, so the dress below is new design work by this seat: Iris's feeling call executed within Ada's floor, with every pair computed.

**Feeling call (Iris, in substance):** legal protection should read the way a catalog's archival annotation reads — permanent, formal, and quiet — not the way a flower accent reads. The dress therefore leaves the flower-accent register entirely and borrows the catalog's *paper-and-ink* register: the recessed paper-deep ground the product already uses for "record" surfaces (footer, tab wash, admin rail), full-strength warm ink for the border and label, and no saturated hue at all. In the palette's dimensional terms: value stays in the light key (paper-deep L* 91), chroma drops to the quietest in the badge family (paper-deep C* 14, ink C* 5), and temperature stays warm. It is built to read as *a stamp in the ledger*, which is exactly what a protection claim is. No new hue is introduced; the chroma budget is untouched; petal is freed to mean unavailable (its decorative jobs — tab jewel, motif berry — are accent work, not status, and stay; see Ada §13's standing note, which this change narrows but does not close).

**The dress (normative, complete):**

| Part | Specification |
|---|---|
| Component / API | `ProtectionBadge({ protection, note })` and `showsProtection(...)` in `v2/components/variety/ProtectionBadge.tsx` — props, label map (`pvp_us`, `utility_patent_us`, `pbr`), and the render gate (only a positive, sourced claim renders; `unknown` / `none_stated` render nothing; the site never claims a variety is "not protected") are **unchanged** |
| Element | A stacked notice block (currently `<p>` with two `<span>`s; the build may move to `<div>` with the same content if the icon row needs it — content, order, and wording identical). Non-interactive. No link, no button, no tooltip |
| Class construction | `badge-notice` — a new variant class in `globals.css` built from the family tokens below, **not** the `.badge` pill base (a two-line notice cannot be a pill; the family resemblance is tokens and border rule, §3.1). Tailwind utilities in the component must resolve to the same values if the builder implements it as utilities instead — §6 checks computed values, not the mechanism |
| Ground | `paper-deep` `#F0E5CB` — token `component.badge.protection.background: {color.paper-deep}` |
| Border | 1px solid `ink-soft` `#4A4438` at full strength — token `component.badge.protection.border: {color.ink-soft}`. **7.71:1** against its own ground (floor 3:1 ✓), **8.58:1** against the paper page ground it sits on ✓. A real border, so it survives forced-colors mode (Ada's rule: never let state live in a shadow — this component has no shadow, before or after) |
| Radius | `var(--radius-control)` — **12px**. Changed from today's 8px (`rounded-lg`): the notice takes the family's control radius, the radius buttons, menus, and choice cards already speak, so the block reads as a formal notice in the system's shape language rather than as an inner image frame (8px is the inner-image radius, §2.1.2 — the wrong association for a legal notice). Registered as part of change R-1 in §5 |
| Padding | Inline 12px (`px-3`), block 8px (`py-2`) — unchanged from today |
| Label text | The protection label (e.g. "US Plant Variety Protection"): `ink` `#2E2A23` on paper-deep = **11.40:1** ✓ (floor 4.5:1; also clears the 7:1 headroom Ada's seat aims for on this older-gardener audience). Sans, 14px (`text-sm`), semibold, sentence case — the label strings are unchanged, including the curly apostrophe in "Plant Breeders' Rights" |
| Note text | The sourced note, unchanged wording: `ink-soft` `#4A4438` on paper-deep = **7.71:1** ✓. Sans, 14px, regular weight. (Today the note is `muted` on petal-50; the new pairing is both darker and warmer — a legibility improvement that comes free with the re-dress, recorded here so nobody mistakes it for a separate change) |
| Icon | **New glyph, specified here, drawn at build:** a seal/shield mark — an outline shield containing a check — drawn to the interface icon family's rules (24px grid, 20px live area, stroke 1.8, `currentColor`, no fill except the check's stroke). Rendered at **16px**, in `ink` (inherits the label's color), `aria-hidden="true"`, `focusable="false"`, inline before the label with a 6px gap (`gap-1.5`), aligned to the label's first line; the note sits below the label row, full width. The icon is a redundant channel — the label text carries the meaning alone (WCAG 1.4.1 ✓) — and as a graphic it measures 11.40:1 against the ground (floor 3:1 ✓). It lives in `v2/components/layout/icons.tsx` with the family, named `ProtectionIcon`. If the drawn glyph fails Quinn's visual check against the family hand, the fallback is to ship the notice **without** an icon rather than with a borrowed glyph (no star, no petal mark, no emoji) — the dress passes every floor without it; the icon is finish, not function |
| Placement | Unchanged: variety page only, directly under the facts card, full content width of its column. No other surface gains this component in this tranche |

**What this retires:** `border-petal`, `bg-petal-50`, `text-petal`, and `rounded-lg` all leave `ProtectionBadge.tsx`. After the build, a grep for `petal` in that file returns zero (§6, check 2.2-D). Petal's remaining status job is Sold out alone.

### 3.6 Per-file change list — Item 2.2

| File | Change |
|---|---|
| `v2/app/globals.css` | Add `.badge` base + tone classes for rows 1a–1e/2a–2c/3a–3b (values from §3.2, consuming §2 tokens) + `.badge-notice` (§3.5). The availability tone alphas already in components move into these classes at the **same** alphas — Tranche 1.3's values do not change by a point |
| `v2/design-tokens/tokens.json` | Add `component.badge.*` tokens: the §3.2 tones, §3.3 Small Farm sizes, §3.5 Protection tokens |
| `v2/components/variety/Availability.tsx` | `TONE` map's hand-written pill classes replaced by `.badge` + tone class. Label map, element, and all other classes unchanged. Header comment updated to name the family rule and point at the token file (its current per-tone ratio text stays true — the values do not change) |
| `v2/components/account/AccountPanel.tsx` | StatusLine's three hand-duplicated pill spans replaced by the same `.badge` + tone classes (Found → in-stock tone, Waiting · active → preorder tone, Held → unknown tone). Labels and surrounding markup unchanged |
| `v2/components/seller/SmallFarmBadge.tsx` | Base class rebuilt on `.badge` + its tone; `SIZE` table's arbitrary values replaced by the §3.3 component tokens. Mark SVG, label source, legend component, and all behavior unchanged |
| `v2/components/variety/ProtectionBadge.tsx` | Full re-dress per §3.5: ground, border, label color, note color, radius, icon row. Props, labels, gate logic unchanged |
| `v2/components/layout/icons.tsx` | Add `ProtectionIcon` per §3.5 (24px grid, stroke 1.8, `currentColor`) |
| `v2/components/variety/ListingRow.tsx` | `STATUS_TONE`: `in_stock` dot/word `leaf-600` → `leaf` (§3.4). No other status changes; §2.1's class migrations in the same file are separate hunks |
| `v2/components/admin/AdminShell.tsx` | **No change under this item** (review-count pill deferred, §3.2). Listed so the absence is a decision, not an oversight |
| Tests (`v2/tests/unit/`, tranche test file) | Badge assertions per §6: tone classes present, old petal classes absent from ProtectionBadge, STATUS_TONE in-stock mapping, border-alpha floor strings present in `globals.css` |

---

---

## 4. Item 2.3 — Chip split: filter chips vs tag chips (F-13, F-24 chip half)

### 4.1 The defect, in one paragraph

`.chip` today is one class at `min-height: 2rem` (32px). Interactive uses add `.tap` (44px) by hand — BrowseFilters, StateFilter, admin chip groups, SellerFilterSection — while inert uses render the bare 32px chip: variety-page Tags, RoleChip, the listing-detail status span's opposite number, account-list role labels. A tag and a filter are therefore distinguishable only by whether a second class happens to be present, and an element that looks tappable and is not is a broken promise (joint recommendation §4.1.4: *tags stop wearing the filter costume* — behavior honesty, not sizing). Admin makes it worse in miniature: the identical helper `function chipClass(active) { return "chip tap flex min-h-[44px] items-center …" }` is re-declared in at least four admin files, plus a fifth inline copy in SellerFilterSection — same intention, five declarations (F-11, F-24).

### 4.2 The two components (normative)

Bare **`.chip` is retired.** After this build, no element in the product carries a bare `chip` class, and the lint test (§6) fails if one appears. Two classes replace it, both defined in `globals.css` `@layer components` from the token file (`component.chip.filter.*`, `component.chip.tag.*`). Shared DNA (why they still read as relatives): full radius (`var(--radius-full)`), 1px `line-strong` border at rest, `surface` ground, `ink` text, sans, 14px / line-height 1.5. Everything that differs is in the contract table — the differences are the design.

| Property | `.chip-filter` — interactive | `.chip-tag` — inert |
|---|---|---|
| Element | `<a>` (navigation filters) or `<button>` (in-place toggles) only. Never a `<span>`, never a `<div>` | `<span>` only. Never an `<a>`, never a `<button>`, no `tabIndex`, no click handler |
| Minimum height | **44px** (the house target; the class carries it — `.tap` is no longer added to chips, and existing `chip tap` pairs collapse to `chip-filter`), **and 44px minimum width alongside it — 44px in both dimensions**, as the pre-split pair rendered (F-1 cure: the width the first 2.3 build dropped is part of the class contract) | **32px** (`min-height: 2rem` — today's bare `.chip` height, preserved exactly) |
| Padding | Block 2px, inline 12px (today's `.chip` padding; height comes from the 44px minimum, as today) | Block 2px, inline 12px — identical padding; height is the distinguisher |
| Resting state | Border `line-strong` `#91825C` on `surface` (3.72:1 ✓ boundary), ground `surface`, text `ink` (14.02:1 ✓) | Identical values. Resting, the two are twins — the split declares itself through size, response, and selected dress, not through a resting costume change. Deliberate: a tag must not look *broken* next to a filter; it must look *finished* |
| Hover | Border `leaf-600`, ground `leaf-50`, text stays `ink` (today's `a.chip:hover` / `button.chip:hover` values, moved onto the class). Fine-pointer only in effect, as today | **No hover state.** No `:hover` rule exists for `.chip-tag`. The cursor stays `default` |
| Selected / current | `[aria-current="true"]` or `[aria-pressed="true"]`: border `leaf` (full strength), ground `leaf-50`, text `leaf` (8.60:1 ✓), **font-weight 600 carried by the CSS rule itself** — components stop adding ad hoc `font-semibold` for the selected state (every current call site already pairs the two; folding it in makes the state systematic and identical everywhere, including the crop rows that today re-implement it with utilities). Border stays 1px in both states, so the control keeps its size and place (the in-place visual standard: only state styling changes) | **No selected state exists.** A tag is never current, pressed, or active; the class defines no such rule and no tag may carry `aria-current` / `aria-pressed` |
| Focus | The global `:focus-visible` treatment, unchanged: 3px solid `focus` `#7A3E10` + 2px offset (7.39:1 on paper ✓, Ada's recorded pass). The chip adds nothing and clips nothing: no `overflow: hidden` on either class. (The FilterStrip container that *does* clip the ring is Ada A3 — Tranche 3, out of scope here; this split neither fixes nor worsens it, and §6 does not claim it) | Never focusable. No focus rule |
| Disabled | No disabled filter chip exists in the product and none is designed here. Rule for the future, recorded so it is not improvised: a disabled filter is removed from the group or rendered as a tag with an adjacent reason — never as a greyed filter chip, because a greyed chip still promises interaction | n/a |
| Cursor | `pointer` (links have it natively; `<button>` chips get it from the class, preserving today's `button.chip { cursor: pointer }` rule) | `default` |
| Transition | Background and border color, 160ms ease-out (today's `.chip` transition) | None |
| Forced-colors | Borders are real borders and the selected state also carries weight + `aria-current`/`aria-pressed`, so state survives with grounds stripped (Ada's survival rule) | Border survives as a system border; no state to lose |
| Motion | None of its own. The filter cascade (`--duration-filter-item`, listing rows only) is untouched | None |

### 4.3 Behavioral contract — filter chips

1. **Semantics are exclusive.** A navigation filter is a link with `aria-current="true"` on the active option and no `aria-current` on the others. An in-place toggle is a `<button>` with `aria-pressed`, inside a labelled group, and never carries `aria-current`. The SellerFilterSection hydration swap (links before hydration → toggle buttons after, via `useSyncExternalStore`, identical server/hydration markup) is preserved exactly — only its class string changes. No element ever carries both attributes.
2. **One value per group is current.** Single-select groups (Season, Sowing method, Life cycle, Hue, Sellers, State, admin classification/state/time-range/signal/crop groups) keep exactly one `aria-current="true"` / one pressed toggle at all times, including "All". This is today's behavior everywhere; the split must not regress it.
3. **State renders instantly and the frame holds.** On activation the selected dress (above) applies in the same frame as the tap; surrounding controls do not move (1px border in both states, fixed 44px height); on in-place surfaces only the result region updates (the shipped B9 standard). The semibold selected weight can change a chip's text width by a pixel or two inside a scrolling strip — today's accepted behavior, recorded so Quinn does not file it as new shift; chips in strips are content-width by design.
4. **Hue chips keep their second channel.** The 14px swatch dot stays `aria-hidden` decoration beside the text label on every Hue filter chip (Ada §13 pass). The crop-detail rows gain the filter *class* in this item but **not** the dots — dots arrive with Tranche 3.1's rebuild of those rows onto BrowseFilters; adding them here would mix tranches (see §4.5, crop row).
5. **`aria-current` value unifies to `"true"` on filter chips.** The crop-detail rows use `aria-current="page"` today where every other filter surface uses `"true"`. A filter selection is not a page; the rows migrate to `"true"` with their class. This is a semantics correction with a screen-reader announcement difference ("current" rather than "current page") and no visual difference. Registered as change R-5 in §5 so it is not mistaken for drift.

### 4.4 Removable-chip affordance (the applied-filter case)

Two filter chips in the product today are not group options at all — they are **applied-filter removers**: the admin listing list's deep-link chips ("Seller: {name}", "Variety: {name}"), each a single link whose whole job is removal, already carrying the accessible name `Remove the seller filter, Seller: {name}` / `Remove the variety filter, Variety: {name}`. Visually they are indistinguishable from group chips, so a sighted admin cannot tell a remover from an option. Contract:

- A removable filter chip is a `.chip-filter` with the modifier **`.chip-removable`**: same geometry and states, plus a trailing **× glyph** — the family's close mark, drawn (not the text character the Sheet uses): 14px, stroke 1.8, `currentColor`, `aria-hidden="true"`, 6px after the label. The whole chip remains one hit target (≥44px); the glyph is never a separate button and never separately focusable.
- Its accessible name must start with "Remove" and name the filter and its value (today's two names already comply and do not change).
- Group option chips never carry the glyph. Tranche 3.1's future applied-filter chips and Clear All work inherits this modifier — specified now so that work does not invent a second remover dress.
- The Sheet's typographic `×` close button (F-26) is **not** changed by this item; unifying dialog chrome is a different component's work. The chip glyph is specified as a drawn icon for chips only, and the inconsistency is recorded rather than silently spread.

This glyph is new rendered content on exactly two chips. Registered as change R-3 in §5.

### 4.5 Per-surface migration table (complete census)

Every current `.chip` / `chipClass` use on `origin/main`, its destination class, and what else changes with it. Files not listed here contain no chip use and must not gain one in this build.

**Public surfaces:**

| File / use | → Class | Notes |
|---|---|---|
| `v2/components/ui/BrowseFilters.tsx` — all group chips (Season, Method, Life cycle, Hue, Sellers) | `chip-filter` | Drop the paired `tap` and the ad hoc selected `font-semibold` (CSS now carries it, §4.2). `aria-current="true"` unchanged. SwatchDot unchanged |
| `v2/components/seller/StateFilter.tsx` — "All states" + state chips (counted cloud) | `chip-filter` | The cloud layout (wrapped, counted, with StateShape) is the sanctioned named exception (Batch B2) and stays exactly as laid out — only the chip class changes. Drop `tap` + ad hoc `font-semibold` |
| `v2/components/variety/SellerFilterSection.tsx` — All sellers / Small farms only (links, then toggle buttons) | `chip-filter` | Local `chipClass` helper deleted; class string comes from the shared CSS. Hydration contract §4.3.1 preserved. Drop `tap` + `font-semibold` |
| `v2/app/crop/[slug]/page.tsx` — hand-rolled Sellers / Hue / Series rows | `chip-filter` | Class migration **only**. The rows stay hand-rolled wrap rows in this tranche (their rebuild onto BrowseFilters with model parity is Tranche 3.1); their inline re-implemented active utilities (`border-leaf bg-leaf-50`) are deleted because the class now carries the selected dress — computed selected values must equal today's (border leaf, ground leaf-50, semibold). `aria-current="page"` → `"true"` (§4.3.5, change R-5). No swatch dots added here (§4.3.4) |
| `v2/components/crop/GuideTabs.tsx` — pre-hydration chip links | `chip-filter` | These are navigation to guide panels (they become the APG tab bar after hydration — that post-hydration form is not a chip and is untouched). Drop `tap` |
| `v2/app/search/page.tsx` — three shortcut chips (Crops / Varieties / Sellers links) | `chip-filter` | Plain navigation links in chip form; no selected state on this surface. Drop `tap` |
| `v2/app/variety/[slug]/variety-view.tsx` — Tags (`<span className="chip">`) | `chip-tag` | **The canonical tag use.** No other change: same labels (`titleCaseTag`), same wrap layout, same facts-card placement |

**Admin surfaces — the same token set, consumed (F-24, this item's half):**

Admin consumes the identical `globals.css` classes and `tokens.json` tokens. There is no admin chip dialect after this build: no `chipClass` helper survives anywhere (the lint test greps for it), and admin density does not fork the chip — a chip is 44px/32px in admin exactly as in public, because admin hands are the same hands. What changes per admin component:

| File / use | → Class | What changes for this component |
|---|---|---|
| `v2/app/admin/(protected)/sellers/_components/seller-list.tsx` — classification + listing-state chip groups | `chip-filter` | Local `chipClass` deleted. Selected weight now from CSS. Links + `aria-current="true"` unchanged |
| `v2/app/admin/(protected)/listings/_components/listing-list.tsx` — state chip group | `chip-filter` | Local `chipClass` deleted (its extra `flex min-h-[44px]` is now redundant — the class carries the height; keep `flex items-center` layout utilities only if computed layout requires them, values unchanged) |
| `v2/app/admin/(protected)/listings/_components/listing-list.tsx` — deep-link remover chips ×2 | `chip-filter chip-removable` | Gain the §4.4 × glyph. Accessible names unchanged |
| `v2/app/admin/(protected)/varieties/_components/variety-list.tsx` — crop chip group | `chip-filter` | Local `chipClass` deleted |
| `v2/app/admin/(protected)/statistics/_components/time-range-control.tsx` — time-range + signal groups | `chip-filter` | Local `chipClass` deleted (one helper serves both groups today; both migrate) |
| `v2/app/admin/(protected)/review/_components/queue-nav.tsx` — queue navigation chips | `chip-filter` | Was `chip tap` + ad hoc `font-semibold` when current; both absorbed by the class. Count badges inside these chips are content, untouched |
| `v2/app/admin/(protected)/review/_components/queue-list.tsx` — queue chip uses via its `chipClass` | `chip-filter` | Local helper deleted, same migration |
| `v2/components/admin/RoleChip.tsx` — role label | `chip-tag` (+ tone from §3.2 rows 5/5b) | RoleChip is inert text and was always a tag wearing filter sizing by accident. Admin tone keeps `bg-leaf-50 font-semibold text-leaf`; reviewer stays plain. Height becomes 32px (tag height) — RoleChip today is a bare `.chip` at 32px already, so **no rendered height change**; the migration is semantic honesty plus token consumption |
| `v2/app/admin/(protected)/listings/_components/listing-detail.tsx` — listing status span (`chip` at `min-h-[44px]`) | `chip-tag` | A status readout, not a control. Migrating it drops its height from 44px to the 32px tag height. **This is a rendered change** — registered as part of change R-4 in §5 with its reason (a 44px inert chip is precisely the F-13 costume defect; the status word's text, ground, and border do not change). If Hue prefers zero admin layout movement in this tranche, the fallback is to keep this one span at 44px via `min-h-target` for one tranche — Mina's recommendation is to take the 32px now, while the component is being touched anyway, rather than schedule a second touch |
| `v2/app/admin/(protected)/accounts/_components/account-list.tsx` — Admin / Reviewer / Farm owner labels ×3 (`chip` + `min-h-[32px]` + `text-[13px]` overrides) | `chip-tag` | The `min-h-[32px]` override is deleted (the class *is* 32px). The `text-[13px]` override is deleted: tag text is the component's 14px. **Rendered micro-change** (label text 13px → 14px), registered in R-4 with its reason: 13px is an unnamed step (F-04), the tag component has one size, and 14px is the more legible value for an admin scanning roles. Padding overrides (`px-2.5 py-1`) collapse to the tag's standard padding — computed padding today is 10px/4px vs the tag's 12px/2px; the chip's total height stays 32px by its minimum, its width grows by ~4px. Recorded here in full so Quinn measures it as *expected*, not as drift |

**Not chips, do not migrate:** SmallFarmBadge (§3 owns it — it is a badge, not a chip, despite the word "chip" in its internal size-table keys; the builder renames nothing there beyond §3.3's token move), the review-count pill (§3.2), pagination (button dialect since the unrecorded F-19 change; untouched), and the `.btn-pill` header CTA (a button; untouched).

### 4.6 Per-file change list — Item 2.3 (files not already listed in §§2–3)

| File | Change |
|---|---|
| `v2/app/globals.css` | `.chip`, `a.chip:hover`, `button.chip:hover`, `.chip[aria-current…]` / `[aria-pressed…]`, and `button.chip` rules deleted; `.chip-filter`, `.chip-tag`, `.chip-removable` rules added per §§4.2/4.4 (`.tap` itself stays — other controls use it) |
| `v2/design-tokens/tokens.json` | Add `component.chip.filter.*` and `component.chip.tag.*` (geometry, grounds, border, selected tone, removable glyph size) |
| `v2/components/layout/icons.tsx` | Add the removable-chip × glyph (14px, stroke 1.8, `currentColor`) alongside §3.5's ProtectionIcon — one icons-file touch for the whole tranche |
| Every file in §4.5's tables | Exactly the class migration tabled there; no structure, label, href, or handler changes except crop rows' `aria-current` value (§4.3.5) |
| Tests (tranche test file) | Chip assertions per §6: no bare `chip` class, no surviving `chipClass` helper, `chip-tag` never on `<a>`/`<button>`, removable chips carry the glyph + "Remove…" names |

---

## 5. Rendered-change register — the complete list of allowed rendered differences

The build is correct on rendering if and only if a before/after comparison (§6) shows **these five changes and no others**:

| ID | Change | Where | Extent |
|---|---|---|---|
| R-1 | Protection badge re-dress (§3.5) | Variety pages carrying a protection claim | Ground petal-50 → paper-deep; border petal full → ink-soft full; label petal → ink; note muted → ink-soft; radius 8px → 12px; 16px seal icon appears before the label. Wording, placement, and render gate identical |
| R-2 | Listing In stock dot + word darken (§3.4) | Listing cards (variety + seller contexts), in-stock listings only | Dot and status word leaf-600 `#2E6B4F` → leaf `#1E4634`. No other state, no other element |
| R-3 | Removable chips gain × glyph (§4.4) | Admin listing list, deep-link remover chips (2 chips) | A 14px × appears after the label. Chip size, colors, link target, accessible name identical |
| R-4 | Two admin inert chips take true tag geometry (§4.5) | Admin listing detail status span; admin account-list role labels | Status span height 44px → 32px. Role label text 13px → 14px, padding 10px/4px → 12px/2px (height holds at 32px, width +~4px). Text content and colors identical |
| R-5 | Crop filter `aria-current` value (§4.3.5) | Crop detail filter rows | `"page"` → `"true"`. **No visual difference**; screen-reader announcement wording differs. Listed here so the semantics diff is expected, not discovered |

Everything else — every card, badge, chip, sheet, menu, skeleton, and page — must render with computed values identical to pre-build `origin/main`. In particular: no spacing value moves (§0.1), no shadow warms (§0.2), no badge alpha moves (§3.1), and Tranche 1.3's shipped values are byte-identical after this build.

---

## 6. Acceptance checks — for Quinn's gate (all executable)

Run in a fresh scratch worktree per the standing gate approval, against the build branch and against pre-build `origin/main` for every before/after comparison. A check that cannot be executed is reported as unchecked, never rounded up.

**Item 2.1 — token consolidation**

- **2.1-A (token sync):** the build's sync test passes on the branch and **fails** when run against pre-build code with the new `tokens.json` removed (non-vacuity, both directions recorded, per the Tranche 1.3 gate's owed-proof lesson).
- **2.1-B (lint counts):** grep over `v2/app` + `v2/components` + `v2/lib` on the branch returns **zero** for each of: `rounded-[`, `shadow-[`, `shadow-xl`, `shadow-lg`, `min-[744px]`, `min-[1181px]`, `border-[#`, `bg-[#`. The strings `#e9dfc2` and `#dfe9d6` appear only in `tokens.json` and `globals.css`'s `@theme`. Allowlist patterns (§2.1.5) are exempt by pattern, and Quinn spot-checks three allowlisted files to confirm the exemption is the tabled reason, not new drift.
- **2.1-C (rendered-value equality — the core check):** for each selector below, computed `border-radius` and `box-shadow` measured in a real browser build (local production build is acceptable evidence where Cloudflare blocks production, labeled as such) are **identical** before and after, at 390px, 820px (iPad), and 1280px: `.card`, ListingRow in-stock card, ListingRow sold-out card, ListingRow Visit pill (in stock), Sheet panel (phone bottom-sheet form and ≥744px centered form), HeaderMenu panel, SearchBox input, SearchBox autocomplete panel, FilterStrip chevron, TrendBars track and one bar, ListingSheetSkeleton card. Any inequality outside §5 is a FAIL.
- **2.1-D (spacing equality):** computed `padding-top` of the ListingRow card is 18px before and after; `margin-top` of its location line 3px, status line 9px; Visit pill computed inline padding 18px. Breakpoint behavior: admin shell shows the rail at 744px and the wide rail at 1181px, before and after, with no width at which both navs or neither nav renders.
- **2.1-E (frozen RGB):** `tokens.json` and the built CSS contain `151 134 95` (or its rgba serialization) for `shadow.listing-raised`, `shadow.listing-flat`, and `color.stem-rule`, and do **not** express those tokens as aliases of `color.line-strong`.

**Item 2.2 — badge family**

- **2.2-A (contrast recomputation):** Quinn recomputes, unrounded, from the built CSS values: all five availability border blends vs their own grounds (expected 3.13 / 3.27 / 3.23 / 3.18 / 3.08, floor 3:1); Protection label 11.40:1, note 7.71:1, border 7.71:1 vs own ground (floors 4.5 / 4.5 / 3); RoleChip borders 3.07:1 (admin tone) and 3.72:1 (plain). Any value below its floor, or any availability alpha differing from §3.2, is a FAIL.
- **2.2-B (rendered badges):** home restocked rail, one variety page with each listing state, one variety page with a protection claim, one seller page header (large Small Farm), and the account alerts list are rendered before/after; the only differences are R-1 and R-2 (§5). The protection notice is additionally checked at 200% text resize (nothing clips — it is a growing block, no fixed height) and in forced-colors mode (border and text survive; ground may be remapped by the OS — pass condition is legibility of label + note + border presence, judged in the rendered view).
- **2.2-C (petal discipline):** grep returns zero `petal` occurrences in `ProtectionBadge.tsx`; the variety page's remaining petal uses are the sold-out line/pill, tab jewel, and motif — no new petal job appears anywhere in the diff.
- **2.2-D (icon check):** `ProtectionIcon` renders at 16px, stroke visually consistent with the family at Quinn's visual pass (24px grid discipline, no fill blob, no emoji character); it is `aria-hidden` in the accessibility tree and the label text alone names the notice to a screen reader.
- **2.2-E (gate logic):** a variety with `protection` unset/`unknown` and one with a claim but no note render **no** Protection component, before and after (the `showsProtection` gate is untested by eye alone — render both fixtures).

**Item 2.3 — chip split**

- **2.3-A (census):** grep returns zero bare `chip` classes (every occurrence is `chip-filter`, `chip-tag`, or `chip-removable` as the second class), zero `chipClass` function declarations, and zero `chip tap` pairs. `chip-tag` appears only on `<span>` elements (source check per §4.5 file list); `chip-filter` appears only on `<a>` / `<button>`.
- **2.3-B (geometry):** computed minimum height of a BrowseFilters chip, a StateFilter chip, an admin seller-list chip, and the SellerFilterSection toggles is 44px; of a variety-page Tag, RoleChip, listing-detail status span, and account-list role label is 32px — at phone and iPad widths.
- **2.3-C (states, usability pass — drive it as a user):** on `/variety`, tap/keyboard through two filter groups: the selected chip shows leaf border + leaf-50 ground + leaf semibold text in the same frame as activation, focus stays on the activated chip, the result count announces once (existing live regions, unchanged), and no chip changes height between states. Hover a tag on a variety page: nothing happens — no ground, border, or cursor change. On the variety page, toggle Small farms only after hydration: semantics are `aria-pressed` buttons, state dress identical to the link form's.
- **2.3-D (removers):** the two admin remover chips render the × glyph, measure ≥44px, and announce "Remove the seller filter, Seller: …" / "Remove the variety filter, Variety: …"; activating each removes exactly that filter. No group chip anywhere renders the glyph.
- **2.3-E (crop rows):** crop detail filter rows carry `chip-filter` with `aria-current="true"` (not `"page"`) on the active option in each row, and their computed selected dress equals BrowseFilters' selected dress (border leaf, ground leaf-50, weight 600).
- **2.3-F (scope guard):** the build diff touches FilterStrip.tsx only in its shadow class (§2.1.6) — padding, chevron size, and scroll behavior are byte-identical, confirming Ada A3 was not folded in; BrowseFilters' group model, facet order, labels, and result ordering are unchanged (Batch A's behavior-silent guard).

**Whole-tranche**

- **T-A:** full verify suite passes on the branch; every new test in the tranche file is run against pre-build code and shown to fail there (non-vacuity, both directions, per check 2.1-A's pattern).
- **T-B:** rendered-change audit: a before/after rendered comparison across the §6 surfaces shows exactly §5's R-1 through R-5 and nothing else. Any sixth difference is a FAIL until it is either reverted or brought back to Dustin as an amendment to §5.
- **T-C:** no price appears on any rendered surface in the comparison set (standing rule spot-check — nothing in this tranche should touch price rendering, and the gate confirms it did not).

---

## 7. Pushback — for Hue to carry to Dustin

Specialists are expected to push back; these are mine, with reasoning, each already reflected in the sections above (nothing here is a silent deviation — each names what the spec does instead and why).

- **P-1 — "Kill the 431 arbitrary-value lines" cannot be taken literally, and §§2–4 do not pretend to.** Roughly a third of those lines are type literals (`text-[15px]` ×81 and family) owned by Thea, and much of the rest is single-use page layout (grid templates, content measures, viewport-relative heights) where a token adds indirection without removing drift. Forcing all 431 to zero inside Tranche 2 would smuggle a type-scale decision past Thea and a dozen layout decisions past Nadia, and would break the value-preserving rule in the attempt. What this spec does instead: every one of the 431 is dispositioned — tokenized (§§2–4), allowlisted with a named reason (§2.1.5), or explicitly assigned to its owner's future pass (type). If Dustin wants the type literals killed in this tranche anyway, that is his call to make knowingly, with Thea briefed — it should not happen as a side effect of a token build.
- **P-2 — Badge unification should not flatten case and weight.** A maximal reading of "one badge family" would set every badge in one case at one weight. That would destroy the state-vs-identity distinction (uppercase availability vs sentence-case Small Farm) that lets a returning shopper parse a card without reading every word — the exact cognitive economy Ada's consistency rules protect. The spec unifies construction, border rule, shape language, and tokens, and deliberately keeps the voices distinct (§3.1). If Dustin prefers literal uniformity, he can rule it — but he should rule it seeing this cost stated.
- **P-3 — The Sheet shadow is tokenized as the cold Tailwind value, not warmed.** `shadow-xl` is a neutral black shadow in a warm-paper product, and a warm umber sheet shadow (in the listing shadows' family) would feel more like this site. But inventing it inside a value-preserving consolidation would change the rendered admin under a "no change" banner — the failure mode this whole tranche exists to end. AD1 asked for a named token with values; this spec names it with the honest values (§2.1.3). A warm-shadow polish pass is a legitimate future item, decided in the open, with before/after renders for Dustin — recommended as a small Tranche 5 polish candidate, not smuggled into Tranche 2.
- **P-4 — The review-count pill keeps its leaf dress (against the grain of IRIS-C-03).** Iris notes, correctly, that a waiting-for-attention count in primary-action green reads as "go/good" at a glance. The obvious swap — ochre, the attention color — would import a worse reading: ochre in this product means *error, held, and unknown* (§3, Iris C-04's house position), so a queue count in ochre would read as a failure count in the admin's own chrome, on every screen, permanently. The count is also `aria-hidden` with its total folded into the link's accessible name, so no meaning rides on the color. Mina's call: the note is recorded, the dress stays, and the question reopens only if a third option (for example an ink-filled count pill) is ever designed as admin chrome work. Flagged here so Dustin hears the disagreement rather than discovering one side of it later.
- **P-5 — Off-scale spacing is tokenized, not snapped.** The 3px/5px/7px/9px values offend the 4/8 scale, and a tidier spec would round them to it. Each rounding is a visible change to the flagship card or the badge (an 18px top padding becoming 16px or 20px moves every listing card on the site), none of it asked for by any finding — F-01's complaint is that the values are *unnamed*, not that they are *wrong*. The spec names them exactly (§§2.1.4, 3.3). If Dustin ever wants the card re-spaced on-scale, that is a small design item with renders — it is not consolidation.

No other finding's prescribed fix is deviated from. Where this spec extends a finding, it says so in place (the §2.1.5 border-width/stem-color extension, bounded to two components; the §4.4 removable glyph, which the chip finding implies but does not draw).

---

## 8. Left undecided — and why (complete list)

1. **Token generation tooling.** Whether `@theme` is generated from `tokens.json` by Style Dictionary, by a small project script, or kept in hand-sync under the §2.1.1 sync test is an engineering choice with no design consequence — every name and value is fixed by this spec either way. Left to the pipeline builder; the sync test, not the tool, is the contract.
2. **The Protection glyph's final path data.** §3.5 fixes the glyph's subject (shield + check), grid, stroke, size, color, and placement, and its fallback (ship without an icon). The drawn path itself is build work, judged at Quinn's gate against the family hand (check 2.2-D) — a design spec that dictated path coordinates would be pretending to a precision the gate, not the document, should verify.
3. **Whether the listing-detail status span drops to 32px now (R-4).** Mina recommends yes, with reasoning in §4.5, and the spec is written that way. It is the one rendered change in the tranche whose value is judgment rather than floor or finding, so it is flagged here as the cheapest item for Dustin to strike without disturbing anything else — striking it means one line in §4.5 (keep `min-h-target` on that span) and one row fewer in §5.
4. **Nothing else.** In particular: no color value, alpha, radius, shadow, spacing value, breakpoint, label, or placement in §§2–4 awaits a decision. The open items that neighbor this tranche — Ada A3 (FilterStrip clipping), the field-state set (Tranche 3.3), Thea's type scale, the OG token read (Batch A5), IRIS-C-07's rating gold — are other tranches' or other seats' work, named in place so their absence here reads as sequencing, not oversight.

---

*— Mina, UI Design. Collaborators' rulings applied: Iris (feeling and meaning — §§3.4, 3.5, P-4), Ada (floor values — §§3.1, 3.2, 4.2; all ratios computed, none rounded into a pass), Thea (type ownership respected — §2.1.5, P-1). Evidence: `origin/main` via `git show` (globals.css, ListingRow, Skeleton, Availability, SmallFarmBadge, ProtectionBadge, RoleChip, AccountPanel, BrowseFilters, FilterStrip, StateFilter, SellerFilterSection, SearchBox, Sheet, AdminShell, HeaderMenu, TrendBars, and the admin chip consumers), full-audit sections for Mina/Iris/Ada, and the 2026-11-20 joint recommendation Batch A. No code was written or changed by this spec.*
