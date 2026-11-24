# Font licenses — seeds directory (slice 1)

All three faces are SIL Open Font License 1.1; the full license text is
committed at [`OFL-1.1.txt`](./OFL-1.1.txt) (copied from
`@fontsource/source-sans-3@5.3.1`'s LICENSE, which carries the OFL-1.1 text).
Binaries are self-hosted under `public/fonts/` — no external font URLs anywhere.
Reproduce with `npm run sync:fonts`.

| File | Family | Role | Source | License |
| --- | --- | --- | --- | --- |
| `public/fonts/fraunces-var.woff2` | Fraunces | Display | `v2/app/fonts/fraunces-var.woff2`, byte-identical ([specimen](https://fonts.google.com/specimen/Fraunces)) | OFL-1.1 |
| `public/fonts/newsreader-var.woff2` | Newsreader | Prose | `v2/app/fonts/newsreader-var.woff2`, byte-identical ([specimen](https://fonts.google.com/specimen/Newsreader)) | OFL-1.1 |
| `public/fonts/newsreader-var-italic.woff2` | Newsreader | Prose italic | `v2/app/fonts/newsreader-var-italic.woff2`, byte-identical ([specimen](https://fonts.google.com/specimen/Newsreader)) | OFL-1.1 |
| `public/fonts/source-sans-3-latin-400-normal.woff2` | Source Sans 3 | UI/tool 400 | `@fontsource/source-sans-3@5.3.1`, latin subset ([specimen](https://fonts.google.com/specimen/Source+Sans+3)) | OFL-1.1 |
| `public/fonts/source-sans-3-latin-600-normal.woff2` | Source Sans 3 | UI/tool 600 | `@fontsource/source-sans-3@5.3.1`, latin subset ([specimen](https://fonts.google.com/specimen/Source+Sans+3)) | OFL-1.1 |
| `public/fonts/source-sans-3-latin-700-normal.woff2` | Source Sans 3 | UI/tool 700 | `@fontsource/source-sans-3@5.3.1`, latin subset ([specimen](https://fonts.google.com/specimen/Source+Sans+3)) | OFL-1.1 |

Notes:

- Fraunces italic (`v2/app/fonts/fraunces-var-italic.woff2`) exists in the repo but
  is unwired in v2 (THEME-REPORT.md divergence 2: no heading uses italics, and
  wiring it would preload it). It stays unwired here for the same reason.
- Source Sans 3 ships latin 400/600/700 only — the weights the tool layer renders
  (body 400, chips/labels/buttons 600, badges 700). No italic: the tool layer has
  no italic use; the browser synthesizes on the rare fallback.
- `v2/app/fonts/fraunces-og.ttf` is OG-image-only (Satori cannot parse woff2) and
  is not a web face; it does not move in this slice.
