# Tranche 3.5 — Variety pagination bounds → true 404s

Source: `backlog-2026-11-21/tranche-3/SPEC.md` §6 (this brief lifts that section; the SPEC's §6.2 is normative). Quinn's design gate on the Tranche 3 spec explicitly cleared this item to build on the current spec — it touches no defective section.

## The defect (verified live, 2026-11-22)

| URL | Status today | Expected |
|---|---|---|
| `/variety?page=99` | **200** (loading skeleton shell) | 404 |
| `/variety?page=35` | **200** (catalog is 34 pages) | 404 |
| `/seller?page=99` | 404 ✓ | 404 |
| `/crop/zinnia?page=99` | 404 ✓ | 404 |
| `/state/oregon?page=99` | 404 ✓ | 404 |

Root cause, from code: `app/variety/page.tsx` calls `assertPageInRange(page, total)` — the guard exists — but the segment's `app/variety/loading.tsx` streams a 200 shell before the guard's `notFound()` can resolve. This is the same mechanism PR #11 fixed on the seller/crop/state routes. `/variety` is the last paginated route still carrying the defect.

## The build (either sanctioned pattern; the observable behavior is what matters)

(a) Remove the segment `loading.tsx` and carry the skeleton as an inner Suspense fallback (the crop-index pattern), or (b) hoist the bounds decision ahead of the shell (the PR #11 pattern). Under either:

- In-range pages render exactly as today — skeleton behavior on genuine loads is unchanged in content.
- Out-of-range pages answer a **true 404** with the standard not-found page; the 404 is not indexable and not self-canonical.
- The bound is the **filtered** total: `/variety?season=cool&page=99` 404s against the filtered page count, not the full catalog's.
- Scope is `/variety` only. The other paginated routes already behave; they are proof-only — if your change alters any of them, that is a defect, not a side effect. Admin lists are cursor/sheet-based and out of scope.

## Proof (the gate will re-run all of it)

- Every paginated route probed: `/variety`, `/seller`, `/crop/[slug]`, `/seller/[slug]`, `/state/[slug]` — each at its last page (200), last page + 1 (404), and an absurd page (404). Filtered variants of `/variety` probed the same way.
- The defect is a streamed-status behavior, so the tests must prove the response **status through the real render/streaming path** — a test that asserts on strings or on the guard function alone cannot fail on the current code and does not count. Non-vacuity is part of done: the new tests FAIL on current main and PASS on your branch; state both runs in the PR body.

## Discipline (standing, from prior tranche lessons)

- No scratch or fixture files anywhere in the tree. ESLint per file group as you go; strict narrowing in tests; expected values in tests DERIVED from source, never hardcoded counts that drift.
- The full `npm run verify` is the literal last act before finishing, and it is green.
- The PR body carries the standard accounting: files changed, verify counts (files/tests, branch vs merge-base), the proof-matrix results, and the non-vacuity statement. The rendered-change confirmation may claim only what is literally true: the single behavior change is out-of-range `/variety` pages answering 404 instead of a streamed 200 shell.
- US spelling. No prices anywhere. Nothing outside this item's scope.
