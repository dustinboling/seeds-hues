# QUINN GATE — SPA Slice 1 REPAIR re-gate (PR #71)

- **PR:** github.com/dustinboling/seeds-hues #71, branch `muse/45390824972`, head `e625e21`, a single commit directly on PR #70's head `e1d45e6`
- **Repair brief:** `muse-tasks/spa-slice-1-repair.md` (main, `cf5a3e4`); return conditions from `QUINN-GATE-spa-slice-1.md` (FAIL on PR #70: F1 Critical, F2 Major, F3 Minor, note F5)
- **Gate worktree:** `~/workspace/seeds-hues-quinn-slice1r-wt` at PR head, detached; the one break-proof mutation was restored and the worktree verified clean afterwards
- **Evaluator structure:** single evaluator (Quinn), same as the original gate. This is the scoped re-gate the original record prescribed: the unchanged parts of PR #70 stand on that record's evidence; only the repair deltas were re-examined.
- **Date:** 2026-11-24

## VERDICT: PASS

Every return condition is met, each verified with my own hands — file contents read on disk, the test oracle break-proved, the contrast math recomputed independently, the rendered build inspected, and the clean-state verify reproduced locally as well as proven live in CI. No new findings. Two informational notes are recorded at the end; neither gates.

Four axes, kept separate: **Severity** — no open defects; the original F1 (Critical), F2 (Major), F3 (Minor) and F5 (Note) are all closed by evidence below. **Evidence** — directly observed/measured throughout. **Coverage** — the repair delta only, per the scoped re-gate; ledger at the end. **Verdict** — PASS, above.

---

## Return conditions, verified

### F1 (Critical) — CLOSED: mirror theme adopts the seven ruled slots; oracle break-proved

`app/src/design-system/tokens/theme.seeds.json` as landed:

| Slot | Required (brief §3 / package) | Landed |
| --- | --- | --- |
| sys.color.bg | `#f8f6ec` | `#f8f6ec` ✓ |
| sys.color.link | `#1B5E37` | `#1B5E37` ✓ |
| sys.color.accent | `#2D6A4F` | `#2D6A4F` ✓ |
| sys.color.accent-strong | `#1B4332` | `#1B4332` ✓ |
| sys.color.text-muted | `#595959` | `#595959` ✓ |
| sys.color.accent-ink | `#86691f` | `#86691f` ✓ |
| sys.color.border-field | `#71806c` | `#71806c` ✓ |

- **border-field is wired, not held:** `tokens.comp.json` now routes `comp.field.border` → `sys.color.border-field` (was `sys.color.border-strong`); the generated `tokens.css` carries `--comp-field-border: var(--sys-color-border-field) /* #71806c */`. A dedicated test asserts both the resolved value and the pointer itself, so re-pointing the alias fails even if values ever coincided.
- **The old interpretation is gone:** the "design defaults NOT taken" comment appears nowhere in `app/src/` or `app/tests/` (grep, zero matches). The theme `$comment` is now a plain adoption statement per brief §3; the ref-layer notes in `tokens.ref.json` were likewise rewritten from "Seeds keeps its live…" to "adopted in theme.seeds.json (live … superseded)" — mirror ≡ package source again.
- **Derived artifacts consistent:** `token-mapping.json` marks exactly the six superseded live values `replaced` (paper, muted, leaf, leaf-600, link, warn) with `themeValue === huesRefValue` for each; `tokens.css` sys values match the theme.
- **THE ORACLE, break-proved by me:** I reverted `sys.color.link` to its old live value `#1f5c3d` in the theme file and ran the token-mapping suite — **3 tests failed**, including the ruled-slots test with `slot drift for "sys.color.link": expected '#1f5c3d' to be '#1B5E37'`. Restored via git checkout; suite green again (10/10), worktree clean. The guard now discriminates *for* the briefed resolution — the exact inversion of PR #70's defect, where the test enshrined the deviation.
- **Rendered output carries the adopted values:** fresh `npm run build` (PWA postbuild proof passed); the built tokens CSS in `dist/client/` carries all seven adopted values and `--comp-field-border: var(--sys-color-border-field)`; `<meta name="theme-color" content="#f8f6ec">`; the proof-page swatch renders `#1B5E37`. The old live values survive in the bundle only as `sourceValue` audit data inside the mapping table (status `replaced`) — the record of what was superseded, not a rendered value.

### F2 (Major) — CLOSED: verify:spa self-installs; proven clean-state locally and live in CI

- `v2/package.json` now reads exactly Quinn's accepted cure (a): `"verify:spa": "npm --prefix ../app ci && npm --prefix ../app run verify"`. The rest of the `verify` chain is unchanged.
- **Clean-state proof (mine):** with `app/node_modules` removed, `npm run verify` from `v2/` ran green end to end — **exit 0**: v2 lint + typecheck + **105 files / 1,576 tests**, then `verify:spa` installed the app tree itself (`added 564 packages`) and the app chain passed (**8 files / 81 tests**). Log: `~/workspace/quinn-slice1r-verify.log`. (First attempt at this run was interrupted by a runtime restart at ~5 minutes with no failure recorded; the state was re-established and the run repeated to completion — recorded here for evidence-chain honesty.)
- **Live CI proof:** PR #71's Verify run `45395305815` — **completed / success** at head `e625e21` (verified by me via `gh run view`, matching the coordinator's relay). The chain that died on `@eslint/js` in PR #70's CI from a clean checkout now runs green in the environment that exposed the defect.

### F3 (Minor) — CLOSED: CONTRAST.md regenerated from the landed values; math independently recomputed

- `CONTRAST.md` is the generator's output over the landed mirror (the freshness test in `contrast.test.ts` ties the file to `contrast-table.ts` output and passed in both verify runs). Only the rows the F1 delta touches changed (muted, link, leaf, warn + the two derived composites); untouched rows are byte-identical to PR #70's table.
- **Independent recomputation (WCAG relative-luminance formula, my own script):** all six briefed pairs match my original record's numbers exactly — seeds-link **7.17**, fern **5.90**, seeds-deep **10.23**, seeds-muted **6.47**, gold-ink **4.78**, ink-soft border-field **3.87** — and the table's full new-ground column (ink 13.17, ink-soft 8.91, petal 7.45, focus 7.68, line-strong 3.49, line 1.35) plus old-ground spot checks (6.22 / 6.90 / 9.84 / 4.60) all match the table to 2 d.p. All text pairs ≥ 4.5 and the border-field pair 3.87 ≥ 3.0 (SC 1.4.11): **WCAG 2.2 AA passes on the landed values**, no nearest-passing-value adjustment needed.
- One honesty note on the test change: `contrast.test.ts`'s recorded-ratio oracle now pins the *live* refs for the five superseded slots, with an in-code comment stating why — the oracle validates the contrast *math* against THEME-REPORT's recorded (live-value) ratios, while the landed values are guarded by the token-mapping oracle and the CONTRAST.md freshness test. That is the correct separation, not a weakening: the math oracle keeps its original evidence base.

### F5 (Note) — CLOSED: empty labelled landmark removed

`TabBarPlaceholder.tsx` no longer carries `aria-label="Primary"`; the component comment now records *why* (an empty labelled landmark must not ship as a pattern later slices inherit). Structure unchanged: unlabelled `<nav data-placeholder="tab-bar-d1">`, five empty `aria-hidden` slots. The shell DOM test was updated to assert `aria-label` and `aria-labelledby` are both null, and passes.

### Scope discipline — CONFIRMED

Diff of PR #71 against PR #70's head `e1d45e6` is exactly the PR body's 11 files (+144/−112), and every hunk belongs to a brief item: theme + ref notes + comp re-point + generated `tokens.css` + `token-mapping.json` (F1), `CONTRAST.md` + `contrast.test.ts` (F3), `v2/package.json` one line (F2), `TabBarPlaceholder.tsx` + `shell.test.tsx` (F5), `token-mapping.test.ts` oracle (F1). No workflow files, no deploy config, nothing else in `v2/`, no restoration of the F4 legacy deletions, and no other part of PR #70 was touched — the parts the original gate passed stand exactly as gated.

---

## Notes (informational, non-gating)

- **N1 — Two briefed pairs are not CONTRAST.md rows.** The generator's coverage rule (unchanged from PR #70, where it was accepted) is pairs recorded against the ground in THEME-REPORT / globals.css; fern (accent) and border-field are not ground-text pairs in that record, so they have no rows. Both pass their floors by my independent computation (5.90 ≥ 4.5; 3.87 ≥ 3.0), stated above — recorded so nobody mistakes their absence from the table for an unchecked pair.
- **N2 — Standing notes from the original record are unaffected:** F4 (legacy v1 deletion stands, per the repair brief), F6 (standing site meta description), F7 (stale verify.yml header comment — workflow files remain outside PR scope; still owed by whoever next touches the workflow through the gated path).

## Coverage ledger

- **Population:** the repair delta — 11 files diffed against PR #70's head — plus the two verify chains, the rendered build, and CI run 45395305815.
- **Structured sample checked:** all of the above; every return condition (F1, F2, F3, F5) re-verified first-hand, itemized in this record.
- **Adversarial additions:** the F1 oracle break-proof (link reverted to old live value → suite fails → restored → green); the F2 clean-state reproduction (app deps wiped → root verify green, locally and in CI).
- **Exclusions, with reasons:** everything PR #70's gate already passed and this PR did not touch (shell, PWA skeleton, JSON-LD guard, fonts, inertness) — excluded by the scoped re-gate's terms and confirmed untouched by the delta diff; live-browser session (same declared boundary as the original gate; the surface remains inert and undeployed).
- **Residual risk:** unchanged from the original record — future slices' routes, real-device rendering, and package-source drift outside the surfaces checked here. The mirror now matches the package theme on all seven ruled slots, so the §2 swap, when the registry path opens, starts from a faithful mirror.

**Gate disposition:** PR #71 satisfies every return condition from the Slice 1 FAIL. The slice is gate-passed; merge is the coordinator's call.
