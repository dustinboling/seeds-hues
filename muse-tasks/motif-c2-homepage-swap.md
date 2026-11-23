# Homepage motif swap — C2 Vine & Pods replaces the stem at the hero→browse break

Authorized by Dustin: he picked direction C (Twine & Tag) on 2026-11-22, then revised it on the same call — the twine becomes a vine bearing seed pods at the dried, ready-to-harvest stage. Elena's rework (love-in-a-puff primary) passed Quinn's DELTA design gate (PASS WITH NOTES, `motif-homepage-2026-11-22/c2-vine-and-pods/QA-GATE-delta.md`); Mina's aspect ◆ values are in `motif-homepage-2026-11-22/c2-vine-and-pods/PLACEMENT-ADDENDUM-C2.md`. Per Dustin's sequencing ruling ("We'll wait"), the stem stays live until this swap ships — removal and replacement land together in this one build.

**Normative sources (read them; they govern where this brief is silent):**
- `motif-homepage-2026-11-22/PLACEMENT-SPEC.md` (Mina) §§1–3 + §5 — component shape, token approach, delivery, THEME amendment draft. Its §2/§3 ◆ values for "C" are SUPERSEDED by the addendum below wherever they differ.
- `motif-homepage-2026-11-22/c2-vine-and-pods/PLACEMENT-ADDENDUM-C2.md` (Mina) — the governing ◆ values for C2 love-in-a-puff.
- `motif-homepage-2026-11-22/c2-vine-and-pods/QA-GATE-delta.md` (Quinn) — gate evidence + build-gate obligations.

## The asset (already on main — do not modify it)

`v2/public/theme/divider-home.webp` — Elena's love-in-a-puff master, 2400×506, alpha-ground (background fully transparent; vine and pods fully opaque; band test 0.000 on both grounds at the delta gate). Do not re-encode, crop, stretch, or otherwise touch the artwork. If anything about the asset looks wrong, stop and report it in the PR body instead of fixing it.

## The change set

1. **New component** `v2/components/ui/HomeMotifDivider.tsx`, modeled on `PodDivider.tsx` per PLACEMENT-SPEC §3: a `<figure aria-hidden="true" className="divider-home mb-8 mt-10">` containing one plain `<img>` (no next/image) with:
   - `src`/`srcSet` from `imageSrcSet("/theme/divider-home.webp", [720, 1080, 1440])` (lib/images route, per spec §2)
   - `sizes="(min-width: 672px) 640px, calc(100vw - 32px)"`
   - `alt=""`, `width={2400}`, `height={506}` (the real aspect — the reserved box is the no-CLS mechanism)
   - lazy loading + async decoding per spec (no priority/preload — the hero keeps LCP)
2. **Tokens/CSS** per PLACEMENT-SPEC §3: `--size-divider-home: 640px` in the `@theme` layer beside `--size-target`; the `.divider-home` class exactly as specced (width `min(100%, var(--size-divider-home))`, img block/100%/auto height, forced-colors rule hiding the img per the file's own precedents); documentation tokens updated: `component.divider-home.aspect-ratio` = **2400/506**, `component.divider-home.asset` = `/theme/divider-home.webp`, spacing stays `{space.40}` above / `{space.32}` below (no new spacing token).
3. **Homepage break only** — `v2/app/page.tsx`: replace `<div aria-hidden="true" className="divider-stem mb-8 mt-10" />` at the hero→"Browse by crop" break with `<HomeMotifDivider />`, and update the adjacent comment to name the new motif per PLACEMENT-SPEC §3.
4. **THEME amendment** — apply the `THEME-ART-DIRECTION.md` §3 amendment drafted in PLACEMENT-SPEC §5, with the motif named **"C2 — Vine & Pods (love-in-a-puff)"** (per Mina's addendum).

## Out of scope — do not touch

- `.divider-stem` and every other stem instance: FooterStem on every page, `.prose-plain h2::before`, `.listing-stem-rule`, `.divider-stem-mini` (header wordmark, homepage crop packet cards, VarietyCard), the no-artwork placeholder fallback, admin pages, the OG template. The class, its CSS, and `divider-stem.svg` stay exactly as they are.
- Everything else on the homepage. The crop packet cards below the break keep their `.divider-stem-mini` rules.
- The sweet pea variant (2400×586) is NOT in this build.

## Tests (the gate will re-run and mutation-prove them)

- Component test: HomeMotifDivider renders the figure with the specced class/spacing, one img with the exact srcSet candidates (720/1080/1440), the exact `sizes` string, `alt=""`, `width` 2400 / `height` 506, lazy/async attributes.
- Page test: the homepage break renders HomeMotifDivider and no longer renders the `.divider-stem` div at the break (the packet cards' `.divider-stem-mini` is a different class and must still render — assert both).
- Token test pinning `--size-divider-home: 640px` alongside the existing token-sync discipline (derive expectations; no hardcoded counts that drift).
- Non-vacuity: the new tests FAIL on the pre-build code and PASS on your branch — state both runs in the PR body.

## Gate obligations this build must be ready for (do not self-certify)

Quinn's build gate will real-render the branch (390px, 1280px, and the owed 320px spot-check), re-run the amended §6 band test on the shipped asset (top/bottom strips + corners over paper AND leaf; side strips motif-masked), and check forced-colors behavior. After merge + deploy, the coordinator proves the size budget on the REAL Cloudflare transformed responses (720w ≤ 40 KB, 1440w ≤ 80 KB, AVIF where served) — the local WebP approximation runs over at 1440w, so if your build can legitimately improve the transformed sizes through the existing lib/images parameters without touching the artwork or the spec, say so in the PR body; never raise the budget silently.

## Discipline (standing, from prior tranche lessons)

- No scratch or fixture files anywhere in the tree. ESLint per file group as you go; strict narrowing in tests.
- Finish discipline: run the full `npm run verify` once, as the last act. If verify fails, fix only failures in files this task touched, re-run verify once more, and finish. If a failure sits in files this task did not touch, do not chase it — finish with the PR body reporting the failure verbatim and the files it sits in. Do not iterate beyond two verify runs.
- The PR body carries the standard accounting: provenance, files changed, verify counts (files/tests, branch vs merge-base), the proof results, and the non-vacuity statement. The rendered-change confirmation may claim only what is literally true.
- US spelling. No prices anywhere. Nothing outside this item's scope.
