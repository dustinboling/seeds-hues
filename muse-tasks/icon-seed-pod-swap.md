# Icon update — seed-pod mark swap

## What this build does

Replace the icon source mark and regenerate the full icon set. Nothing else changes.

1. Copy `muse-tasks/assets/seed-pod-mark-master.png` over
   `v2/public/brand/poppy-pod-mark.png`, byte for byte. Verify the copy's
   SHA-256 is `119070607fa88bca10f14d51b02157a44ce37aa66178c1a9669dce42e66795d8`
   before going further; stop if it does not match.
2. Run `npm run icons` in `v2/` (runs `scripts/gen-icons.ts`, which runs
   `scripts/gen-icons.py`). This regenerates, from the one source mark:
   - `v2/public/icons/hues-icon-192.png`
   - `v2/public/icons/hues-icon-512.png`
   - `v2/public/icons/hues-icon-maskable-512.png`
   - `v2/public/icons/hues-apple-touch-icon.png`
   - `v2/public/icons/hues-icon.svg`
   - `v2/public/favicon.ico`
3. Delete the staging file `muse-tasks/assets/seed-pod-mark-master.png` from
   the branch (it was staging only; the artwork's permanent home is the brand
   path in step 1).
4. The finished diff is exactly 8 paths: the source-mark swap, the 6
   regenerated icon files, and the staging-file deletion. If your diff shows
   anything else, stop and re-check.

## Hard limits

- NO changes to `v2/app/manifest.ts`, `v2/app/layout.tsx`, `v2/lib/config.ts`,
  the generator scripts (`v2/scripts/gen-icons.ts`, `v2/scripts/gen-icons.py`),
  or any other file. Icon URLs, sizes, and references stay exactly as they
  are — only the artwork inside the files changes.
- Do not hand-edit the generated PNGs, ICO, or SVG; they must be the
  generator's own output from the new source mark.
- No scratch or temporary files in the tree (they fail the gate lint).
- Run `npm run verify` in `v2/` before finishing; it must pass in full.

## Why

The old watercolor pod read as a dahlia at favicon sizes (pale body vanished
against the paper ground, golden rayed crown read as a flower head). The new
mark is a bold-silhouette seed pod (leaf-green body, closed flat marigold
lid, no stem) designed for tiny sizes. It has passed its design gate:
Elena (art direction, maker), Mina (UI legibility check, PASS), Iris (color,
approve as-is), Quinn (independent design gate, PASS WITH NOTES — record at
`icon-update-2026-11-22/QA-GATE-design.md` in the coordinator's work folder;
the regenerated files were proven byte-identical to the gated preview set
when the generator runs on this master).
