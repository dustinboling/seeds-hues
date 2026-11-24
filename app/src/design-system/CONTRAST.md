# Contrast table — Q3 ground delta (`#f8f1e1` → `#f8f6ec`)

Generated from the token mirror (`theme.seeds.json` via `tokens.ts` + `contrast.ts`);
do not edit by hand — run `npm run gen:contrast`. The freshness test
(`tests/unit/contrast.test.ts`) fails if this file differs from the generator output,
and the ratio test cross-checks the generator against THEME-REPORT.md's recorded
ratios before trusting any new-ground number below.

Scope: every text/background pair the ground delta touches (see `contrast-table.ts`
for the coverage rule). WCAG 2.x relative-luminance math.

| Pair | On old ground `#f8f1e1` | On new ground `#f8f6ec` | Floor | Pass |
| --- | --- | --- | --- | --- |
| ink on ground | 12.68 | 13.17 | 4.5 (WCAG 2.2 AA body text (1.4.3)) | yes |
| ink-soft on ground | 8.58 | 8.91 | 4.5 (WCAG 2.2 AA body text (1.4.3)) | yes |
| muted on ground | 6.22 | 6.47 | 4.5 (WCAG 2.2 AA body text (1.4.3)) | yes |
| link on ground | 6.90 | 7.17 | 4.5 (WCAG 2.2 AA body text (1.4.3)) | yes |
| leaf on ground | 9.84 | 10.23 | 4.5 (WCAG 2.2 AA body text (1.4.3)) | yes |
| petal on ground | 7.17 | 7.45 | 4.5 (WCAG 2.2 AA body text (1.4.3)) | yes |
| warn on ground | 4.60 | 4.78 | 4.5 (WCAG 2.2 AA body text (1.4.3)) | yes |
| focus on ground | 7.39 | 7.68 | 4.5 (WCAG 2.2 AA body text (1.4.3)) | yes |
| line-strong on ground | 3.36 | 3.49 | 3.0 (WCAG 2.2 AA UI boundary (1.4.11; Ada's floor)) | yes |
| line on ground (decorative) | 1.30 | 1.35 | — (none — decorative hairline, never carries text) | n/a (decorative) |
| ink-soft on tab-bar wash | 7.79 | 7.79 | 4.5 (WCAG 2.2 AA body text (1.4.3)) | yes |
| leaf on tab-bar wash | 8.94 | 8.94 | 4.5 (WCAG 2.2 AA body text (1.4.3)) | yes |
| muted on grain-darkened ground (worst case) | 5.38 | 5.60 | 4.5 (WCAG 2.2 AA body text (1.4.3)) | yes |

Notes:

- `ink-soft`/`leaf` on tab-bar wash: the tab bar is a named placeholder in slice 1
  (see `TabBarPlaceholder`); the composite is carried so Iris + Ada re-verify the
  exact pair at Quinn's gate.
- Grain worst case follows THEME-REPORT.md's method (darkest grain pixel 6.5% black).
- `line on ground` has no floor: the hairline is decorative and never carries text.
