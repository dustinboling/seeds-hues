# seeds-v2-media — tasks

Work in order; check boxes as each passes. Spec: requirements.md + design.md in this folder;
canonical spec: ~/workspace/seeds-hues/SPEC-CANONICAL.md.

- [x] 1. Copy the six `.webp` files from `~/workspace/seeds-hues/artwork-pilot/` into `public/artwork/` (byte-identical; verify checksums match).
- [x] 2. Repository: media read for a variety (D2), following the repositories-only-Drizzle rule.
- [x] 3. Validator + service: `VarietyMediaSchema`, `media` on `VarietyDetailSchema`, `getVariety` mapping (D3); fix every other `VarietyDetail` constructor.
- [x] 4. Variety page hero rendering (D4) — media present → figure/img/figcaption; absent → nothing.
- [x] 5. OG image points at the illustration when media exists (D5).
- [x] 6. Guardrail test rewrite (D6) + README updates (D8).
- [x] 7. Integration + contract tests for the media read path (R7).
- [x] 8. Acceptance "Media display" section (D7) with cleanup.
- [x] 9. Finish line: `npm run verify` green; fresh `npm run db:setup:local`; `npm run cf:build` green; OpenNext preview running; `npm run acceptance` green against it; MEDIA-REPORT.md written.
