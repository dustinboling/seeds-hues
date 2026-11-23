# Homepage motif swap — forced-colors fix (Item MOTIF, PR #45)

## Provenance

PR #45 (branch muse/45093997673) built the C3 homepage motif swap. Quinn's build gate: **FAIL on one Major** (QA-GATE-build.md in motif-homepage-2026-11-22/c3-vine-and-pods-revised/). Everything else passed and is NOT in scope: geometry exact (640×97.33 desktop / 358×54.44 phone; break 169.33 / 126.44), layout shift 0.00px, scope fence clean (stem gone from the homepage break only; every other stem instance renders unchanged), verify reproduced (64 files / 1091 tests).

## The defect (the ONLY change this brief makes)

Under forced-colors, the motif must not render (decorative contract). It does. Mechanism, from the gate record: the new rule `@media (forced-colors:active){.divider-home img{display:none}}` sits in `@layer components`, while the img's Tailwind `block` class sits in `@layer utilities`, which wins regardless of specificity. In headless Chromium with forced-colors emulation (matchMedia confirmed true), the img's computed display is `block` at full height — while the stylesheet's two pre-existing forced-colors rules (`body::before`, `.packet::after`) hide correctly.

Fix it so the behavior holds: under forced-colors emulation, the motif img computes to `display:none` (or otherwise does not render), with the motif rendering exactly as before outside forced-colors. The mechanism is the builder's choice (align with the working rules' layer/pattern, or remove the redundant utility — the `.divider-home img` rule already sets display:block) — the requirement is behavioral, and the re-gate proves it by emulation, not by reading CSS.

## The test problem (also in scope)

The maker's unit test pins the forced-colors CSS *text* by regex — it passed while the behavior failed. Strengthen the pin as far as the project's test stack allows so this class of failure is caught by the suite (a rendered/computed-style assertion if the stack supports it; if it genuinely cannot, keep the text pin and say so in the PR body — the gate's emulation proof remains the behavioral check either way).

## Scope fence

Nothing else changes: no geometry, no tokens, no other surfaces, no other tests weakened. Full verify green.

## NOT in this brief (coordinator's deploy condition, recorded so it is not lost)

The R2 object for `theme/divider-home.webp` does not exist yet (transforms 404, err 9404; no manifest entry in lib/images-data.ts). The coordinator handles the R2 upload + manifest entry before the motif deploy; the byte proof on the real AVIF transforms happens at live-verify. The builder does not touch the image pipeline.

## Gate

Narrow Quinn re-gate: forced-colors emulation on the rebuild + a geometry spot check. Then merge → R2 upload → deploy → live-verify (incl. the real-transform AVIF byte proof).

## PR body hygiene

Provenance (this brief + the gate record), Build accounting, verify counts, Gate record section.
