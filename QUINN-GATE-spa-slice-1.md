# QUINN GATE — SPA Slice 1: App skeleton + design-system wiring (PR #70)

- **PR:** github.com/dustinboling/seeds-hues #70, branch `muse/45352801637`, head `e1d45e6`, diffed against main `56060be`
- **Brief:** `muse-tasks/spa-slice-1-skeleton.md` (main, `03cf366`); governing docs ARCHITECTURE-BRIEF.md, DESIGN-SYSTEM-DEPENDENCY.md, BUILD-SEQUENCE.md (Slice 1), OPEN-QUESTIONS.md (Q1–Q4)
- **Gate worktree:** `~/workspace/seeds-hues-quinn-slice1-wt` at PR head, detached; all mutations during break-proofs restored, worktree clean at record time
- **Evaluator structure:** single evaluator (Quinn). No cold second rater was commissioned for this gate; usability findings below are single-evaluator and flagged as such.
- **Date:** 2026-11-24

## VERDICT: FAIL

One Critical finding on the slice's centre of gravity (the token mapping contradicts the brief's §3 table and the @hues package source on 5 of 7 ruled slots, with the guard test written to enshrine the deviation) and one Major finding (the §6 verify extension fails in CI from a clean checkout). Everything else in scope passed, including all four discrimination proofs. Return conditions are named under each finding; a focused re-gate of the deltas suffices — the rest of this record stands as the evidence for the unchanged parts.

Four axes, kept separate: **Severity** is graded per finding below. **Evidence** is directly observed/measured throughout (my own runs, rendered output, package sources read on disk) except where labeled. **Coverage** is in the ledger at the end. **Verdict** is FAIL, above, resting on F1 + F2 only.

---

## Findings

### F1 — CRITICAL — Token theme overrides 5 of 7 ruled sys slots against brief §3 and the @hues package theme

**Standard violated:** brief §3 (the slice's explicit, checkable mapping table) and §2's mirror-fidelity requirement ("Quinn's gate will verify the mirror against the package sources").

Brief §3 mandates the seeds sys mappings from the design system's `theme.seeds.json`. I verified the package source of truth directly on disk (`~/workspace/wwwhues/packages/tokens/tokens/theme.seeds.json` + `ref.color.json`, @hues/tokens v1.0.0): it resolves exactly the briefed refs — seeds-ground `#f8f6ec`, seeds-link `#1B5E37`, fern `#2D6A4F`, seeds-deep `#1B4332`, seeds-muted `#595959`, gold-ink `#86691f`, ink-soft `#71806c`.

The build's mirror theme (`app/src/design-system/tokens/theme.seeds.json`) instead resolves five slots to the live v2 values, and the rendered output faithfully carries them (verified in `dist/client/index.html` swatches and the built tokens CSS custom properties):

| Slot | Brief §3 / package theme | Built (mirror + rendered) |
| --- | --- | --- |
| sys.color.bg | `#f8f6ec` (seeds-ground) | `#f8f6ec` ✓ |
| sys.color.link | `#1B5E37` (seeds-link) | `#1f5c3d` (live v2 link) |
| sys.color.accent | `#2D6A4F` (fern) | `#2e6b4f` (live leaf-600) |
| sys.color.accent-strong | `#1B4332` (seeds-deep) | `#1e4634` (live leaf) |
| sys.color.text-muted | `#595959` (seeds-muted) | `#6a5f4c` (live muted) |
| sys.color.accent-ink | `#86691f` (gold-ink) | `#8a5e08` (live warn) |
| sys.color.border-field | `#71806c` (ink-soft) | value held `#71806c` but deliberately unreferenced — the comp layer routes fields to other slots; the package theme carries this slot specifically as the adopted field border |

The deviation is documented by the builder as a deliberate interpretation (theme file `$comment`: the six design values are "near-miss design defaults NOT taken"), reasoned from Q3's "single deliberate delta" language. That reading conflicts with the brief's explicit §3 table, which is the governing instruction for this slice; Q3's ruling text decides the *ground* question. The package theme's own header states: "Adoption is a build task (Ada closing E): seeds stays failing until this theme actually lands in its build." Worse for the gate: `app/tests/unit/token-mapping.test.ts` (line ~107, "records the hues ref endpoints the brief quotes (design defaults, not taken)") locks the deviation in as the test oracle, so the guard now discriminates *against* the briefed values.

**Nuance the coordinator must route, not the builder:** the package marks the accent-ink gold role "UNVERIFIED … pending ruling (settles: Iris seat)". If Iris/Dustin rule the as-is port correct, the cure is to amend brief §3 *and* the package `theme.seeds.json` so mirror ≡ source at swap time — not to leave a mirror that silently diverges from both. As the record stands: build ≠ brief ≠ package.

**Severity reasoning:** the token mapping is this slice's stated centre of gravity and its main deliverable; every later slice builds on these tokens. Present-day user harm is bounded by inertness (nothing deployed), which keeps this from being a live-site Blocker — it is nonetheless a Critical non-conformance on the gate's central acceptance criterion, and it blocks the slice.

**Return condition:** the mirror theme resolves the seven ruled slots to the package/brief values (border-field wired as the field border, not held unreferenced), the token-mapping test's oracle asserts the briefed resolution, and CONTRAST.md is regenerated for the landed values — OR a recorded Dustin/Iris ruling amends §3 and the package theme together, with the mirror then matching the amended source exactly.

### F2 — MAJOR — §6 verify extension fails in CI: the chain never installs app/ dependencies

**Standard violated:** brief §6 — the extended gate must actually run the app tree's verify; in the environment that matters (CI) it dies before lint starts.

**Evidence (independently verified, not taken on relay):**
- CI run `45360536525` (via `gh run view` + `--log-failed`): conclusion **failure**. All 105 v2 test files / 1,576 tests PASS, then: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@eslint/js' imported from …/app/eslint.config.mjs`.
- Root cause in `.github/workflows/verify.yml`: the job installs dependencies only in `v2/` (`npm ci`, working-directory v2) and then runs `npm run verify`, whose new `verify:spa` step invokes the app chain assuming `app/node_modules` exists.
- Clean-state reproduction (mine): with `app/node_modules` moved aside, `npm run verify:spa` in `v2/` exits 2 with the identical `ERR_MODULE_NOT_FOUND` for `@eslint/js`. With deps installed, the full extended chain passes locally (exit 0). This is the classic blind spot: the builder's environment had app deps installed, so the extension looked proven.

**Severity reasoning:** Major — an important function of the slice (the CI gate extension) fails in CI on every run; the PR's CI is red and the app chain is never exercised there. A local workaround exists (install app deps first), and the live site is unaffected.

**Cure I would accept (either):** (a) make `verify:spa` self-installing inside this PR's permitted `v2/package.json` scope — e.g. `npm --prefix ../app ci && npm --prefix ../app run verify` — so the chain works identically from any clean checkout, local or CI; or (b) a workflow change adding an app install step, routed through the gated direct-push workflow path (it cannot ride this PR). (a) is preferred: it is inside the §6-permitted file and removes the local/CI divergence that hid the defect.

### F3 — MINOR — Contrast table is accurate but computed against the un-briefed value set (subordinate to F1)

`app/src/design-system/CONTRAST.md`'s math is honest: I recomputed every ground pair independently (WCAG relative-luminance formula) on both grounds and matched the table exactly to 2 d.p. — ink 13.17, ink-soft 8.91, muted 5.78, link 7.30, leaf 9.79, petal 7.45, warn 5.26, focus 7.68, line-strong 3.49 (≥3.0, SC 1.4.11), line 1.35 (decorative, no floor) on the new ground `#f8f6ec`; tab-bar-wash composites follow THEME-REPORT's method (paper-deep at 92% over ground). All pairs pass WCAG 2.2 AA. The gap is only that the table evidences the as-is values; under F1's cure it must be regenerated. For the record, the briefed values also pass on the new ground by my computation — seeds-link 7.17, fern 5.90, seeds-deep 10.23, seeds-muted 6.47, gold-ink 4.78 (all ≥4.5), ink-soft border-field 3.87 (≥3.0) — so contrast is no obstacle to landing them, and no pair needs Ada's nearest-passing-value rule under either value set.

### F4 — NOTE — Legacy v1 static `app/` tree deleted without a brief line

The PR deletes 14 legacy files (`app/index.html`, `app/css/`, `app/js/`, `app/data/*.json`, `app/sellers/`, `app/varieties/`, `app/404.html`). Brief §1 says to scaffold `app/` but never mentions removing the v1 prototype, whose `app/data/*.json` is named in `V2-BUILD-SPEC.md` as the v1 ground-truth migration source. Nothing live references the deleted files (v2 is the deployed tree; the migration already happened), and everything is recoverable from git at `56060be`. Coordinator/Dustin awareness only — not a blocker.

### F5 — NOTE — Tab-bar placeholder exposes an empty labelled landmark

`app/src/components/TabBarPlaceholder.tsx` renders `<nav aria-label="Primary">` whose only children are empty `aria-hidden` slots — an empty "Primary" landmark for assistive technology. Acceptable on an inert, never-deployed proof surface; flagged so the post-cutover D1 tab-bar build does not inherit the pattern.

### F6 — NOTE — Proof route carries the standing site meta description

The prerendered head and manifest carry the site description ("Search a hard-to-find variety, see US sellers who have it — …") ported verbatim from `v2/lib/config.ts`. Body copy complies with §4 (directory name + token/font proofs only, no marketing copy, no "conversion in progress" marker). The meta description is standing site copy, not new marketing copy. Recorded for completeness.

### F7 — NOTE — verify.yml header comment is now stale

`.github/workflows/verify.yml` still says "the root `app/` is a legacy static site". Workflow files are outside this PR's permitted scope; flag for whoever next touches the workflow through the gated path (see F2 cure (b)).

---

## What passed (evidence, all reproduced by me — not the builder's summary)

**Verify chains.**
- App tree, fresh `npm ci` (564 packages): `npm run verify` — lint ✓, typecheck ✓ (app + SW tsconfigs), **80/80 tests, 8 files** ✓.
- Extended root chain: `npm run verify` in `v2/` (with app deps present) — **exit 0** end to end (v2 lint + typecheck + tests, then `verify:spa` → app chain green).
- CI run `45360536525`: final status **completed / failure** — v2 portion fully green (105 files / 1,576 tests); failure isolated to F2.

**Rendered-diff check.** `npm run build` prerenders `/` + `404.html`. Rendered/computed values (proof-page swatches + built tokens CSS) match the mirror exactly, including Q3: `--sys-color-bg: #f8f6ec`, `<meta name="theme-color" content="#f8f6ec">`, manifest `theme_color`/`background_color` `#f8f6ec`. The render is faithful — the deviation in F1 lives in the mirror, not the rendering.

**Break-proofs (each mutation restored; worktree verified clean after each):**
1. *Token mapping discriminates:* changed mirror `sys.color.link` `#1f5c3d` → `#000000` → **2 token-mapping tests failed**; restored. (Note F1: the test discriminates, but against the wrong oracle for the theme layer.)
2. *JSON-LD guard discriminates:* scratch tests (created, run, deleted) — a `Product`/`Offer` payload with a nested `price` is rejected; a bare `price` key deep inside a clean-looking `ItemList` graph is rejected; a clean `WebSite` payload is accepted. The guard (`app/src/lib/jsonld-guard.ts`) covers Bea's full prohibited list plus v2's shipped extensions, recursively, keys and `@type`s, and is wired into the app test suite that the §6 chain runs.
3. *PWA assertion discriminates:* removed `dist/client/sw.js` → `node scripts/assert-pwa.mjs` exits 1 ("sw.js was not emitted"); restored → passes.
4. *§6 red-proof (per the brief's own instruction):* appended a type error to `app/src/site.ts` → `npm run verify:spa` in `v2/` exits 2 with the TS error surfaced; restored.
5. *CI clean-state repro:* see F2.

**PWA skeleton.** `sw.js` is emitted by the Workbox injectManifest build (precache: 8 files), the registration snippet is inlined in the prerendered shell head (`data-sw-register="/sw.js"`, production-only), the manifest references the Three Seeds & a Sprout icon set (192/512/maskable/SVG, all present in `dist/client/icons/`), and the postbuild assertion runs as part of `npm run build`.

**§2 fallback honesty.** The registry path was genuinely unavailable (SWAP.md records the GitHub Packages 404 probe); the mirror path was taken. SWAP.md names the exact swap points truthfully (dependency declarations, the four mirror JSONs, `tokens.ts`/`fonts.ts` rewrites, RouteAnnouncer → @hues/ui, what is *not* part of the swap). Mirror fidelity against the package sources I could access (`~/workspace/wwwhues/packages/`): the **ref layer matches exactly** (all seven design refs verified value-for-value against `ref.color.json`); the sys-layer structure follows the package pattern; the **theme layer deviates** (F1). Fonts mirror verified by checksum: Fraunces + Newsreader woff2 are byte-identical to `v2/app/fonts/` assets; Source Sans 3 (400/600/700) byte-identical to the locked `@fontsource/source-sans-3@5.3.1` files; licenses recorded (`OFL-1.1.txt`, `font-licenses.md`). **Zero external font CDN links** — the rendered HTML contains no `https://` references at all.

**Inertness + scope discipline.** Full diff vs `56060be`: the ONLY `v2/` change is `v2/package.json` scripts (`verify` extended + `verify:spa` added) — exactly §6's allowance; `v2/wrangler.jsonc` untouched; **no `.github/workflows/*` changes**; nothing in `v2/` references `app/` except the verify script. (Plus the F4 legacy deletions inside `app/` itself.)

**Shell quality.** Skip link to `#main`; exactly one `main` landmark with `tabIndex={-1}`; `RouteAnnouncer` moves focus to main and announces the new title in a polite live region on client-side navigations (initial load correctly skipped); header/footer carry only the directory's name and the two standing disclosure lines ported verbatim from v2; tab bar is a named placeholder (structure + slots, no design); `lang="en-US"`; Source Sans 3 self-hosted for UI per Q2 with Fraunces/Newsreader editorial faces.

**Usability pass (single-evaluator, declared boundary).** The slice's only user surface is the inert, never-deployed proof route; its interactive elements are the skip link and the wordmark link (both target the one real route). I inspected the actual prerendered HTML output and the jsdom DOM shell tests rather than driving a live browser (this seat has no live-browser access). Goal taken: "land on the directory's proof page and orient" — the page states the directory's name, shows its domain, and presents the token/font proofs legibly with a correct heading order (h1 → h2 sections); no confusion findings. The uncovered remainder (real-browser rendering on a phone viewport) is named as unchecked; it does not affect this verdict, which rests on F1 + F2.

## Coverage ledger

- **Population:** the full PR diff (83 files), both verify chains, the rendered build, token sources (v2 `globals.css` @theme, the mirror's four layers, the @hues package in the wwwhues repo), every contrast pair the Q3 ground delta touches, the PWA artifacts, the JSON-LD guard, the shell components, and CI run 45360536525.
- **Structured sample checked:** all of the above, itemized in this record — this gate's scope was enumerable, so the sample is the population for in-scope surfaces.
- **Adversarial additions:** five break-proofs (token mutation, priced JSON-LD ×2 shapes, SW removal, broken app file through the root chain, clean-state CI reproduction).
- **Exclusions, with reasons:** live-browser session (no browser access in this seat; surface inert/undeployed — boundary declared in the usability pass); @hues/ui package internals (not consumed this slice; app-local equivalents sit under the §2 fallback and are named in SWAP.md); the `hues-design-system` repo's copy of the packages (the brief names the wwwhues `packages/` tree as the design-system source; its values also match the brief's quoted values exactly); dark mode (the shell is light-only by design, `color-scheme: light`).
- **Residual risk:** this coverage cannot see defects in future slices' routes, real-device rendering of the shell, or package-source drift outside the token/font surfaces checked here. A clean re-gate of the F1/F2 deltas, when they return, should re-run the token-mapping and contrast evidence against the landed values rather than trusting this record's numbers for them.
