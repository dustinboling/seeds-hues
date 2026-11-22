# Item 5.3 — Desktop header (SUCCESSOR build — Quinn gate FAIL cure)

PR #38 implemented this item and passed Quinn's gate on everything except one Major. Reproduce PR #38's change set (branch `muse/45028650323`, closed unmerged — its diff is your starting reference) with the cures below. The gate record is `~/workspace/seeds-hues/QUINN-GATE-header-5-3-pr38.md` — read F-1/F-2/F-3 in full; everything the record marks as passed must not regress. The original brief (`muse-tasks/header-5-3-desktop.md`) and Mina's normative pass (`backlog-2026-11-21/header-5.3/MINA-PASS.md`) still govern everything not mentioned here.

## The cures

- **F-1 (Major) — apply the §6 levers IN ORDER; lever 2 was never justified.** Quinn's rendered counterfactuals on PR #38 (real layout/fonts, 1024px): no levers = 16.44px slack (a lever was genuinely needed); **lever 1 only (nav `px-3`→`px-2` at the takeover tier) = 56.44px slack, no truncation**; both levers = 190.36px. So: keep lever 1 exactly as PR #38 applied it, and **restore the byline at `lg`** — remove the suppression PR #38 added (the byline span returns to its merge-base behavior, visible at `lg`). The "by Hues Floral Park" byline must render at desktop widths.
- **Flip the pinning test:** PR #38's header suite pins the byline suppression as intent. Update the suite so it pins the correct end state — byline visible at ≥1024px, lever-1 padding in place, slack condition expressed as the spec states it — with the same non-vacuity standard (fails on merge-base, passes on your branch).
- **F-3 (Nit) — HeaderNav comment accuracy:** the comment claiming every destination is reachable "from the header alone" is wrong by design — About is footer-carried (MINA-PASS §2.5). Correct the comment to state the true map.

## Finish discipline (standing)

- No scratch or fixture files. ESLint per file group as you go; expected values derived, never hardcoded counts that drift.
- Full `npm run verify` once, as the last act; fix only failures in files this task touched and re-run once if needed; report any other failure verbatim in the PR body rather than chasing it.
- The PR body states the rendered 1024px slack measurement for the shipped configuration (lever 1 only) and the 768px escape-hatch measurement, per the original brief — do not leave either unstated.
- US spelling. No prices. Nothing outside this item's scope.
