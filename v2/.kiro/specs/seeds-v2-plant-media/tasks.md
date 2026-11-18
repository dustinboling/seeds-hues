# seeds-v2-plant-media — tasks

Work in order; check boxes as each passes. Spec: requirements.md + design.md in this folder;
predecessor: .kiro/specs/seeds-v2-media/ + MEDIA-REPORT.md.

- [x] 1. Migration 0004 (media.plant_id + index) and the schema.ts update; fresh local setup applies cleanly.
- [x] 2. Repository: `listMediaForPlant` + chunked `listMediaForPlants` (D2).
- [x] 3. Validators + service: shared media schema with optional `thumbUrl`; `media` on CropListItem/CropDetail; `listCrops` bulk load + `getCrop` load (D3); fix every other constructor.
- [x] 4. Crop card image component + both card render sites (D4); graceful no-media rendering unchanged.
- [x] 5. Crop page hero + OG image from media (D4).
- [x] 6. Guardrail allowed-file update (D5) + README note (D7).
- [x] 7. Integration + contract tests for the plant media read path (R5).
- [x] 8. Acceptance "Plant media display" section with cleanup (D6).
- [x] 9. Finish line: `npm run verify` green; fresh `npm run db:setup:local`; `npm run cf:build` green; OpenNext preview running; `npm run acceptance` green against it; PLANT-MEDIA-REPORT.md written.
