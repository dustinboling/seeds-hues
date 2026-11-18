# seeds.hues.flowers v2 — Tasks (FINAL spec §8, 35 tasks)

Status legend: `[x]` done and checked locally · `[~]` done with a logged local limitation.
Results are recorded in `BUILD-REPORT.md`.

## A. Setup
- [x] 1. Pin versions (Next 16.4.x latest patch, React 19.3, exact `@opennextjs/cloudflare`); resolve VERIFY flags V1–V20 into `VERIFICATION-LOG.md`, adopting fallbacks.
- [x] 2. Scaffold per design §2 + `wrangler.jsonc` (Worker `seeds-hues`, D1 `DB`, R2 cache + snapshots, custom domain route).
- [x] 3. Tooling: ESLint, Vitest, Playwright, `verify` script.

## B. Database
- [x] 4. Core schema + FINAL §2 additions + migrations.
- [x] 5. Stub tables + rating aggregates (`rating_average` NULL while `rating_count = 0`).
- [x] 6. FTS5 trigram + triggers + `searchVarieties()` with < 3-char prefix fallback.
- [x] 7. Repository/service layer + `atomic()` + Zod output validation + portability guardrail tests.

## C. Data
- [x] 8. `scripts/import-catalog.ts` with all §6 assertions.
- [x] 9. Run import against local D1; validate counts and spot checks.
- [x] 10. `scripts/publish-catalog.ts` (allowlisted snapshot → R2 → `catalog_publish`).

## D. API
- [x] 11. Foundation: envelope, cursor pagination, ETag, CORS, rate limit, X-Robots-Tag.
- [x] 12. Variety + seller endpoints.
- [x] 13. Category, plant, search endpoints.
- [x] 14. Catalog version + snapshot endpoints.
- [x] 15. OpenAPI 3.1 + `/api-docs` + shared types.
- [x] 16. Contract tests incl. service↔API parity.
- [x] 17. `POST /api/revalidate` + `POST /api/track` click beacon.

## E. Web
- [x] 18. Root shell + bottom tab bar.
- [x] 19. UI kit: PriceDisplay, RatingDisplay, swatches, template-description renderer.
- [x] 20. Home + search widget (API autocomplete + no-JS form).
- [x] 21. Variety pages (indexability-aware metadata + JSON-LD).
- [x] 22. Seller / category / plant pages with `?page=` pagination.
- [x] 23. 308 redirects from `?v=` / `?s=`.
- [x] 24. Search page, `/about`, `/about/bot`, `/terms`, `/privacy`, `/offline`, 404 / errors.

## F. PWA
- [x] 25. Manifest + icons.
- [x] 26. Service worker with self-applying updates.
- [~] 27. PWA checks incl. update test (local).

## G. SEO / GEO
- [x] 28. Metadata system.
- [x] 29. OG cards (ImageResponse; static fallback per V13).
- [x] 30. JSON-LD builders + prohibition tests.
- [x] 31. Sitemap (indexable only) / robots / llms.txt.
- [x] 32. Linking + semantics pass.

## H. Delivery
- [~] 33. Accessibility (axe, WCAG 2.2 AA) + performance budget pass.
- [x] 34. README (run / deploy / data ops / snapshot publish / D1 Time Travel).
- [x] 35. Full local acceptance run of FINAL §7 → `BUILD-REPORT.md`.
