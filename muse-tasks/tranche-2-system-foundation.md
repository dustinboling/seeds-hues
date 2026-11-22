# Tranche 2 — System foundation: token consolidation, badge family, chip split

## Source of truth
Design spec: `backlog-2026-11-21/tranche-2/SPEC.md` (Mina, UI design specialist, with Iris color / Ada accessibility / Thea typography standards; Quinn-gated joint recommendation Batch A is its basis). **Implement the spec exactly.** It carries the token tables with exact values, the per-component change lists with file paths, and the acceptance checks. Where this brief and the spec differ, the spec wins — flag the conflict in your PR body rather than choosing silently.

## Governing rule — value-preserving consolidation
The full audit found **zero palette drift**: the rendered site is correct; its values are just unnamed and scattered. This build NAMES rendered values; it does not improve them. The ONLY permitted rendered changes are the five registered in SPEC §5 (R-1–R-5). **Any other rendered difference is a defect**, and the Quinn gate will fail the PR on a sixth difference.

Traps the spec calls out — treat as binding:
- The listing shadows' RGB (151,134,95) is the RETIRED line-strong value, frozen in the spec: **do not re-derive** them from the current `#91825C` line-strong token.
- `#E9DFC2` and `#DFE9D6` are promoted to tokens (`--color-listing`, `--color-visit`), never snapped to `line`/`leaf-50`.
- The Sheet shadow tokenizes at the exact value the Sheet already renders; do not warm it.
- SPEC §7 dispositions all 431 arbitrary-value lines (tokenize / allowlist-with-reason / Thea's type literals). Follow those dispositions line class by line class; do not invent a different split, and do not force allowlisted values into tokens.

## Scope
1. **2.1 Tokens** — new DTCG source of truth at `v2/design-tokens/tokens.json`, synced to `@theme`; radius/shadow/spacing scales at the spec's exact rendered values; breakpoint names (`admin:` 744px, `admin-wide:` 1181px); the pattern→replacement migration per SPEC §2–§3 including the named allowlist; the lint test the spec requires.
2. **2.2 Badge family** — one `.badge` family on Ada's shipped border floor (values stated exactly in the spec — they are Tranche 1.3's shipped values, the floor, not a starting point); the full variant→tokens table (availability, waitlist, Small Farm incl. its component tokens, RoleChip tones, listing line); the IRIS-C-02 ListingRow dot/word fix; **Protection's new dress** exactly as specified (paper-deep ground, full-strength ink-soft border, ink label, radius 12px, new 16px shield-check icon in `icons.tsx`, stroke 1.8, aria-hidden) including the spec's ship-without-icon fallback if the glyph cannot be drawn to standard.
3. **2.3 Chip split** — bare `.chip` retired; `.chip-filter` (44px, `<a>`/`aria-current` or `<button>`/`aria-pressed` exclusively, selected dress folded into the CSS so all five duplicated `chipClass` helpers are deleted) vs `.chip-tag` (32px, `<span>` only, no interactive states); `.chip-removable` modifier with the drawn 14px × glyph; the spec's complete per-surface migration census for public + admin; crop rows migrate class-only (the strip rebuild is Tranche 3.1 — do not rebuild it) with `aria-current="page"` → `"true"`.

## Required tests (Quinn gate conditions)
- The token **sync test**: tokens.json vs `@theme` — must fail if either side drifts.
- **Non-vacuity**: the new tests (sync, lint, badge/chip contracts) must FAIL on the pre-build code and pass on yours. A test that passes on both proves nothing and will be treated as missing.
- **Computed-value equality**: per SPEC §6, computed border-radius / box-shadow / spacing equality at 390 / 820 / 1280px on the spec's named surfaces, before vs after — equality evidence belongs in the PR body.
- Contrast recomputations for the badge family with the spec's expected values; forced-colors + 200% checks for the Protection badge.
- All existing tests remain, unweakened, and green. If an existing test pins a pre-consolidation implementation detail (a class string, an arbitrary value), update the pin to the tokenized equivalent and say so in the PR body — never weaken an assertion to pass.

## Done criteria
- `npm run verify` green on your final branch.
- PR body carries: the SPEC §6 grep counts with their expected zeros; the computed-equality evidence; the list of updated test pins (if any); explicit confirmation that the only rendered changes are R-1–R-5.
- Scope discipline: Tranche 2 surfaces only. No Tranche 3 flow changes (no filter behavior, no strip rebuild), no data/seed changes, no prices anywhere, US spelling in all copy and comments.

## Re-dispatch note (2026-11-21, coordinator)
Run 44983535271 collapsed mid-build: its only tree change was a scratch file, `v2/t2-fixture.tmp.tsx`, which then failed the gate's lint — no part of the change set landed. On this run: do not leave scratch or fixture files anywhere in the tree; build any temporary fixture outside the repo or delete it before finishing. The final tree must contain only the intended Tranche 2 change set, and `npm run verify` must pass on exactly that tree.
