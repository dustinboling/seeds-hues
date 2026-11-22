# Item 5.3 — Desktop header: retire the hamburger at the takeover tier

Source: `backlog-2026-11-21/header-5.3/MINA-PASS.md` (Mina's visual pass, commissioned before this build per Dustin's ruling). **That document is normative in full** — this brief lifts its decisions; where they differ, the pass governs. Dustin's ruling (2026-11-21): Nadia's Q8 recommendation adopted — at desktop widths the header retires the hamburger and carries every destination directly; the account icon stays; the phone header is unchanged.

## The build (per MINA-PASS §§1–5)

- **Takeover tier is `lg` (1024px)**, the site's existing breakpoint token — not `md`. Mina's width proof (pass §6) shows the full destination set cannot fit at 768px; do not substitute another value. **Escape hatch, exactly as specced:** if your *rendered* measurement at 768px (real production data, real fonts) shows the full §2 set fitting with ≥24px slack and zero wordmark truncation, the takeover may move to `md` by changing exactly the two tier classes named in pass §5. State the rendered measurement either way in the PR body.
- **Visible nav gains one link: Add Your Farm** (`/add-your-farm`), appended last after Crops · Varieties · Sellers · Search, as a plain nav link in the identical existing class treatment (pass §3). The item itself carries `hidden lg:block` so the 768–1023px band keeps today's exact four-link nav beside the still-present hamburger. No pill/button treatment.
- **Current-page state moves into the visible nav** (pass §3): the current section's link renders `font-semibold text-leaf` + `aria-current="page"`, using HeaderMenu's existing prefix-match rule (`pathname === href || pathname.startsWith(href + "/")`). State never carried by color alone. Without this the build deletes the desktop header's only location signal — a regression.
- **The hamburger retires by CSS only:** `lg:hidden` on HeaderMenu's outermost wrapper (pass §5). The component stays mounted and fully functional below the tier. No JS viewport unmounting, no `visibility`/opacity/off-screen substitutes. Phone header and menu byte-for-byte unchanged in behavior.
- **Account icon unchanged** (pass §4): far right, last element, same treatment, `aria-label="Your account"`, `data-testid="header-account"`.
- **Correct the stale `SiteHeader.tsx` header comment** that claims Add Your Farm lives in the footer (pass §2.3 — it does not; `SiteFooter.tsx` has no such link).
- **Fit at 1024px is verified rendered, not assumed** (pass §6): full set visible, no hamburger, no wordmark truncation, ≥24px slack — or apply the pass §6 levers **in order** (1: nav padding `px-3` → `px-2` at the takeover tier only; 2: byline suppressed at the takeover tier) and state which lever, if any, was applied. Never: truncate the wordmark by design, reduce nav type, drop/abbreviate a destination, or invent a breakpoint. The header row stays `flex-nowrap`; the nav never wraps.

## Proof (the gate will re-run all of it; pass §8 is the checklist)

- **Widths rendered:** 1024 (full set, no hamburger, no truncation, slack measured), 1280, 1440; 1023 and 768 (header structurally identical to today — four links, account icon, hamburger present and working); 390 and 360 (phone header unchanged).
- **Current state:** on `/variety/<slug>`, `/crop/<slug>`, `/seller/<slug>`, `/search`, `/add-your-farm`, `/` — exactly one correct item (or none on `/`) carries the treatment.
- **Keyboard walk at 1024px:** tab order per pass §7 (logo → wordmark → five links → account icon), focus always visible, no menu stop; screen-reader landmark check: exactly one header navigation at desktop. At 390px the menu's full behavior set (open, Escape-return, outside-close, route-close) re-verified unchanged.
- **200% zoom** at desktop width (falls back through tiers) and **forced-colors** rendering of the current state.
- **No-orphan spot check:** from a desktop viewport, reach all seven pass §2.5 destinations using only header + footer.
- Tests referencing `header-menu-button` / `header-menu` at desktop widths: revisit their viewport assumptions (pass §8.6) — that is part of this build, not a side effect. Non-vacuity: any new/changed test must FAIL on current main and PASS on your branch where it asserts new behavior; state both runs in the PR body.

## Discipline (standing, from prior tranche lessons)

- No scratch or fixture files anywhere in the tree. ESLint per file group as you go; strict narrowing in tests; expected values DERIVED from source, never hardcoded counts that drift.
- The full `npm run verify` is the literal last act before finishing, and it is green.
- The PR body carries the standard accounting: files changed, verify counts (files/tests, branch vs merge-base), the rendered-measurement results (incl. the 768px escape-hatch measurement and any §6 lever applied), and the non-vacuity statement. The rendered-change register may claim only what is literally true: at ≥1024px the hamburger is display-removed, Add Your Farm joins the visible nav, and the nav gains the current-page treatment; below 1024px nothing changes.
- US spelling. No prices anywhere. Nothing outside this item's scope. The admin header (`AdminShell`) is out of scope.
