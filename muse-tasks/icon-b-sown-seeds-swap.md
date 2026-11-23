# Icon update — "Three Seeds & a Sprout" (Option B) swap

## What this build does

Replace the site's icon artwork with Elena's Option B masters and regenerate the
full icon set. Dustin picked **B — "Three Seeds & a Sprout"** (2026-11-22 18:41 PT)
from the gated redo set (design gate record: `icon-redo-2026-11-22/QA-GATE-v2.md` —
B rated FIT, the only option whose 16 px tile *is* seeds with no intermediary).

Construction is governed by Mina's SPEC (`icon-redo-2026-11-22/SPEC.md`): the new
artwork is **two full-tile 1024×1024 masters** — a TOUCH cut and a FAVICON cut,
each a complete painting on the paper ground — *not* the old single transparent
mark. The generator therefore changes shape: it consumes the two full-tile
paintings instead of compositing one transparent mark onto paper.

1. Copy the staged masters into the brand folder, byte for byte, verifying
   SHA-256 before going further (stop if either mismatches):
   - `muse-tasks/assets/sown-seeds-touch-master.png` →
     `v2/public/brand/sown-seeds-touch.png`
     SHA-256 `8a99fd1927514b10e3375aa19781ecf19cbb09f3cd6d1ebb59c28039a288df0b`
   - `muse-tasks/assets/sown-seeds-favicon-master.png` →
     `v2/public/brand/sown-seeds-favicon.png`
     SHA-256 `9c9bcc861b2e5d03eac7e8d0b23cdd2db903fa6a18927b734f6a936fd7ceed6a`
2. Rework `v2/scripts/gen-icons.py` to the two-cut model (`gen-icons.ts` still
   just runs the .py; its header comment may be updated to name the new sources —
   no behavior change there):
   - **TOUCH master** (already a full paper tile) → direct Lanczos downscales of
     the whole tile: `v2/public/icons/hues-icon-192.png` (192),
     `v2/public/icons/hues-icon-512.png` (512),
     `v2/public/icons/hues-apple-touch-icon.png` (180). Fully opaque RGB.
   - **Maskable:** `v2/public/icons/hues-icon-maskable-512.png` — the TOUCH tile
     fitted onto a full-bleed paper (`#F8F1E1`) canvas at a reduced fraction
     (builder's choice; the old generator's 0.62 is the precedent) such that the
     **measured subject radius on the output file is ≤ 0.40 × tile width**
     (SPEC §4 P4 — for the two-cut set the requirement is the measured radius,
     not the fraction). Subject = pixels differing from `#F8F1E1` by ΔRGB-sum
     > 60 (the SPEC §3.4 tolerance); radius = the maximum distance from the tile
     centre of any subject pixel, divided by the tile width.
   - **FAVICON master** → a 64 px render of the whole tile →
     `v2/public/favicon.ico` (16/32/48 frames in one ICO) and
     `v2/public/icons/hues-icon.svg` (the SVG wrapping the 64 px PNG, same
     construction as today).
   - Output filenames and sizes are frozen (SPEC §1) — exactly these six files.
3. Delete the superseded source `v2/public/brand/poppy-pod-mark.png` (its only
   consumers were the generator scripts) and delete the two staging files under
   `muse-tasks/assets/` (staging only; the masters' permanent home is the brand
   folder).
4. Run `npm run icons` in `v2/` to produce the six outputs. They must be the
   generator's own output from the committed brand masters: re-running the
   generator from those sources must reproduce the shipped files byte-for-byte.
5. Run `npm run verify` in `v2/` before finishing; it must pass in full.

**Expected diff — exactly these paths; if anything else appears, stop and
re-check:** the two new brand masters, the deleted `poppy-pod-mark.png`,
`v2/scripts/gen-icons.py` (edited; `gen-icons.ts` comment at most), the six
regenerated icon files, and the two staging-file deletions.

## Hard limits

- NO changes to `v2/app/manifest.ts`, `v2/app/layout.tsx`, `v2/lib/config.ts`,
  `v2/scripts/sw.template.js`, or any other file. Icon URLs, sizes, and
  references stay exactly as they are — only the artwork inside the files
  changes.
- Do not hand-edit the generated PNGs, ICO, or SVG.
- The masters are full-tile paintings: do NOT extract the subject, knock out
  the ground, or recompose the artwork — the tile is part of the icon (SPEC
  P1; the mark ships only on its paper tile, never bare). The only composition
  permitted is the maskable fit onto paper.
- No scratch or temporary files in the tree (they fail the gate lint).

## Acceptance the build gate will measure (build to them)

- **P4 ship check (deferred from the design gate expressly to here):** subject
  radius measured on the built `hues-icon-maskable-512.png` ≤ 0.40, and the
  mark re-viewed at that fit.
- All six files: square, fully opaque, frozen sizes, and **all four corners
  exactly `#F8F1E1`** (SPEC P2).
- Actual-size renders judged at the gate: 16/32 px from the FAVICON cut and
  180 px from the TOUCH cut, on light and dark grounds.
- Regeneration reproducibility: the gate re-runs `npm run icons` from the
  committed sources and compares bytes.
- State the measured P4 radius and the corner check results in the PR body.

## Why

Dustin rejected the PR #43 mark on sight ("Nobody would see that and think
seeds"). The redo ran under his corrected ownership — Mina specs, Elena creates
— in gouache, the site's painted medium. Quinn's design gate rated B FIT; A was
FIT WITH NOTES; C was UNFIT. Dustin picked B on 2026-11-22.

## PR body hygiene

Provenance (this brief + Dustin's pick + the design gate record), Build
accounting (workflow verify summary + diff census), the measured P4 radius and
corner results, and the Gate record section, per the pipeline template.
