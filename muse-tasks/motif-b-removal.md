# Task: Remove Motif B everywhere (Dustin ruling, 2026-11-21)

Dustin ruled on 2026-11-21: **Motif B is retired — remove it from the site entirely.**
Its last two placements are (1) the home hero break and (2) the waitlist success
moment. Remove both. The waitlist success state itself stays; only the motif goes.

## What to do

1. Find every live usage of the Motif B artwork (`/ornaments/motif-divider-b.webp`
   and any component that renders it — search the codebase for `motif` /
   `MotifB` / `motif-divider-b`). The two known placements are the home page
   hero break and the waitlist success moment; if you find any other live
   placement, remove it too and name it in your finish summary.
2. Where a visual break is still structurally needed at a removed placement,
   use the site's standard thin-stem divider (the existing `FooterStem` /
   divider-stem treatment — the site's norm) in its place. Where the motif was
   purely decorative filler, remove it cleanly with no replacement. Do not
   invent a new motif or ornament.
3. Leave the R2 asset and the image-manifest entry in place (asset retirement
   is a separate data operation, out of scope). If removing the placements
   leaves a component or export with no remaining callers, remove that dead
   code; if a component still has other callers, leave it.
4. Update every test that pins the motif's presence (home page, waitlist
   success, image data) to the new truth. Add or adjust assertions that FAIL
   on the old code and PASS on the new (e.g. the served home HTML and the
   waitlist success render contain no `motif-divider-b` reference), and state
   in your finish summary how you proved the new assertions are non-vacuous.

## Constraints

- These placements only. No refactoring, no unrelated changes, no copy
  changes (the waitlist success wording stays exactly as it is).
- Phone and desktop renderings both lose the motif; nothing else about the
  home hero or the waitlist flow changes.
- US spelling in any text you touch. Follow the repo's standing code
  constraints (strict TypeScript, existing component patterns).

## Finish-line summary (use this as the PR title)

"Motif B removal: home hero break + waitlist success moment (thin-stem divider where a break remains)"
