# Design-System Dependency Check — what seeds takes from @hues, what stays seeds' own

**Date:** 2026-11-23 · Packages: `@hues/tokens`, `@hues/fonts`, `@hues/ui` v1.0.0 (built under wwwhues `packages/`, lifting to the `hues-design-system` repo; GitHub Packages budget raised to $10 by Dustin 2026-11-23, clearing the publishing path).

## Takes from @hues

| Package | What seeds takes | How |
| --- | --- | --- |
| `@hues/tokens` | The token **architecture** (ref → sys → theme → comp layers) and the **`theme.seeds.json` directory theme file that already exists in the package** (verified on disk: `packages/tokens/tokens/theme.seeds.json`, alongside theme.park/family/play/celebrate/control) | Seeds' live token values map into the seeds theme layer; comp tokens (button, card, field, tabbar, sheet…) are shared shapes |
| `@hues/fonts` | The font-loading package mechanics (self-hosted woff2, licenses, preload discipline) | Seeds' own faces load through it — see conflicts |
| `@hues/ui` | Shared primitives where seeds has no distinct design of its own: shell/header scaffolding, sheet/dialog mechanics, focus management, route announcements (gap-audit a11y mechanics) | Adopted per-component at build; anything with a seeds-specific gated design (tab bar D1, Quiet Ledger card, shop grid card) stays a seeds component built on shared tokens |

## Stays seeds' own — explicitly NOT restyled

- **The "Illustrated Seed Catalogue" theme**: seeds' live token system (shipped in Tranche 2, `v2/app/globals.css` `@theme`): paper `#f8f1e1`, paper-deep, surface, ink, ink-soft, muted, line/line-strong, leaf `#1e4634`, leaf-600, leaf-50, link, petal, warn, sage (decorative only), focus umber — every text/background pair WCAG-verified in THEME-REPORT.md. These values are the directory's identity; the conversion ports them, it does not re-derive them from the park theme.
- **The gouache artwork system**: all variety/crop plates (1120×2240, shown whole), the C3 vine-and-pods homepage motif, state outline icons, the Three Seeds & a Sprout icon set. Artwork is content on R2; the new app references the same URLs.
- **Seeds component designs already gated**: Quiet Ledger listing card, unified shop-grid card, chip/filter system, field states (PB-A ink-soft filled border, PB-B leaf accent), pending cue, seller badges. These port as seeds components.

## Named conflicts (decisions, not discoveries to improvise at build)

1. **UI sans face.** Program foundation decision 4 (Dustin-approved 2026-11-22): UI sans = **Source Sans 3**, Inter retired. Seeds today: display = Fraunces, serif body = Newsreader, **sans = system-ui stack** (tool layer only). `@hues/fonts` ships Source Sans 3. **Recommendation:** seeds adopts Source Sans 3 for its UI/tool layer (forms, admin, chips, buttons) via `@hues/fonts`, and keeps Fraunces (display) + Newsreader (prose) as its editorial faces — seeds' public prose is already Newsreader, which matches foundation decision 5's serif-body rule in spirit. This is a visible-text change, so it routes through Thea (typography) at build brief time; flagged here so it is decided, not drifted into.
2. **Ground warming.** Foundation decision 3 (Iris): "Seeds ground: warmed a half-step toward the family ground." The plan's theme.seeds.json already encodes the directory layer with the warmed ground. Seeds' live paper is `#f8f1e1`. **Recommendation:** the port takes theme.seeds.json's ground value as the single deliberate color delta of the conversion, with Iris + Ada re-verifying every affected contrast pair before the slice ships (Ada's nearest-passing-value rule if any pair fails). No other color changes ride along.
3. **Token naming collision.** Seeds' Tailwind v4 `@theme` names (`--color-leaf-50`, `--color-ink-soft`…) predate the @hues layer names. The port maps seeds names → @hues ref/sys names in one mechanical pass with a rendered-diff check per template (Quinn gate), rather than renaming ad hoc per component — a silent token miss renders as an unstyled surface, which is exactly the failure the mapping pass exists to catch.
4. **Tab bar geometry.** Foundation decision 6 locks 12px tab-label floor for the park tab bar; seeds' own tab bar (D1 design, gated 2026-11-22) carries its own label spec from Mina. Seeds' gated design governs seeds; no conflict in substance — noted so nobody "harmonizes" the seeds bar to the park's at build.

## Bottom line

Seeds consumes the @hues **system** (token layers, font mechanics, shared primitives, a11y mechanics) and keeps its own **theme, artwork, and gated component designs**. The only deliberate visual deltas in the whole conversion are #1 (UI sans → Source Sans 3) and #2 (ground warmed a half-step) — both pre-approved at program level, both verified pair-by-pair at the gate.
