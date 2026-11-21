# Tranche 1.3 — Ada's three accessibility fixes (badge borders, line-strong token, home live region)

## Why

The full audit of 2026-11-21 (AUDIT.md §6, Tranche 1.3) confirmed that three fixes prescribed by
Ada (accessibility specialist) on 2026-11-19 are STILL unshipped on main. Her computed passing
values are on file in `full-audit-2026-11-21/sections/ada-accessibility.md` §§2–4 and are
reproduced below verbatim — apply them exactly; do not substitute your own values. Two of the
three are WCAG 1.4.11 non-text-contrast floor failures (a standing legal requirement for this
site), not polish.

## Fix 1 — Status-badge border alphas (WCAG 1.4.11)

The status badges' borders sit at 40% alpha and measure 1.73–2.05:1 against their own tint
grounds, under the 3:1 floor. Apply Ada's prescribed per-tone alphas — the nearest passing
value for each tone, never a different color:

`v2/components/variety/Availability.tsx` (the `TONE` map):
- `in_stock`: `border-leaf/40` → `border-leaf/60` (3.13:1 on sage-tint)
- `sold_out`: `border-petal/40` → `border-petal/65` (3.27:1 on petal-tint)
- `preorder`: `border-leaf-600/40` → `border-leaf-600/70` (3.23:1 on surface)
- `shop_closed`: `border-muted/40` → `border-muted/70` (3.18:1 on surface)
- `unknown`: `border-warn/40` → `border-warn/75` (warn is the ochre tone, #8A5E08 on
  ochre-tint #F7EDD3; 3.08:1)

The component's header comment currently states the 40% figure as the theme rule — update it
to state the per-tone passing alphas and why (WCAG 1.4.11, 3:1 against each badge's own
ground), citing Ada's 2026-11-19 prescription.

`v2/components/account/AccountPanel.tsx` (the `StatusLine` badges — same tones, same values):
- Found: `border-leaf/40` → `border-leaf/60`
- Waiting · active: `border-leaf-600/40` → `border-leaf-600/70`
- Held: `border-warn/40` → `border-warn/75`

Completeness check: grep the app for any other status-badge border at `/40` on these five
tones (`border-leaf/40`, `border-petal/40`, `border-leaf-600/40`, `border-muted/40`,
`border-warn/40`). Fix every status/availability badge occurrence to the same table. If you
find a `/40` border on these tones that is NOT a status badge, leave it and name it in your
finish summary. Do not change badge text colors, tint grounds, sizes, or any other styling.
(`SmallFarmBadge` already ships leaf at 60% and `ProtectionBadge` a full-strength border —
both pass; do not touch them.)

## Fix 2 — `line-strong` token → #91825C (WCAG 1.4.11)

`v2/app/globals.css` `@theme` defines `--color-line-strong: #97865f`. On paper-deep
(#F0E5CB) it measures 2.85:1 — under the floor — and paper-deep is the ground of both the
mobile TabBar's top rule and the admin bottom bar's top rule, the only separation between
those fixed bars and scrolling content. The token is also the `.field` input border, `.chip`
border and `.btn-secondary` border color.

Change the token value to **`#91825C`** (Ada's prescribed value: 3.02:1 on paper-deep, and
passing on paper and surface per her computation). Update the token's comment so it states
the truth for all three grounds — if you state a ratio for paper or surface, compute it
yourself from the hex values; do not copy a number you have not computed. Change nothing else
in globals.css.

## Fix 3 — Home filter-result count live region (WCAG 4.1.3)

`v2/app/page.tsx` renders the home filter-result count as
`<p className="mt-3 text-muted" data-testid="filter-result">` with no live region. Every
other filtered surface on the site carries `aria-live="polite"` + `aria-atomic="true"`
(/variety, /crop/[slug], /search, the in-place variety filter, admin lists); home is the
only one without. Add exactly `aria-live="polite"` and `aria-atomic="true"` to that element.
No other change to the element, its text, or its styling.

## Tests

- Find any existing tests that pin the old values (the `/40` classes, `#97865f`, or the home
  count markup) and update them to the new values.
- Add assertions that would FAIL on the old code and PASS on the new: the five Availability
  tones carry the prescribed border alphas; the AccountPanel status badges carry theirs; the
  `line-strong` token is #91825C; the home filter-result element carries
  `aria-live="polite"` and `aria-atomic="true"`. A test that passes on both old and new code
  is vacuous and does not count — check each new/updated assertion against the pre-change
  code (e.g. via `git stash`) and say so in your finish summary.

## Constraints

- These three fixes only. No other visual, layout, or copy changes; no refactoring.
- US spelling in anything you touch, comments included.
- Prices are never shown — nothing here touches prices.
- Standing code constraints: no `setState` in effect bodies; React children passed as JSX
  children, never via a `children` prop object; do not rename copy or identifiers to dodge
  the R4 guardrail scanner.

## Verify before you finish

You can run commands. In `v2/`, run `npm run verify` yourself; if anything fails, fix it and
re-run until the full gate is green. Do not finish with a failing or unrun gate — the
workflow runs the same gate after you and opens no PR unless it passes.

Finish-line summary for the PR (the workflow's placeholder title/body get hand-corrected to
this): "Tranche 1.3: Ada's three accessibility fixes — status-badge border alphas to the
prescribed passing values, line-strong token #91825C, home filter-count live region."
