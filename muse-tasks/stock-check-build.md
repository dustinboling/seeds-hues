# Check stock now — build (Item CSN)

## Provenance

- Commissioned by Dustin, 2026-11-22: a small "Check stock now" link on each listing fires a check of that listing's stock on the seller's own product page; the result is cached and shared; the freshness window is **24 hours**.
- Design: `stock-check-design/` (Nadia SPEC, Priya ENGINEERING, Mina UI-DESIGN, Wren COPY, Ada ADA-RULINGS). Design gate: **PASS WITH NOTES** (QA-GATE-design.md). Amendments A1–A3 + A5 applied post-rulings (SPEC 9386b27; ENGINEERING ruling note e4fd268). Re-check of the amended set: **PASS WITH NOTES** (QA-RECHECK-amendments.md, 58ff9b8) — no send-backs; conditions C1–C3 below are that record's.
- Build GO: Dustin, 2026-11-22 16:20 PT, verbatim: "Go — build Check stock now on this design."
- Sequencing: this build runs in its own worktree behind the Tranche 3 build order and the SHOP build. The brief is written and held until its queue turn is dispatched.

## Dustin's three rulings (operative)

1. **Couldn't-check window — Nadia's model.** After a failed check the control stays immediately retryable; only SUCCESSFUL checks start the 24-hour clock. The endpoint keys on the last successful check.
2. **Re-order in place.** When a check flips a card's stock status inside a shop's grouped sort, the card re-orders in place immediately (move-never-remount), per Ada §3.5. Scope: grouped-sort section-boundary flips only (Quinn re-check, §6.2 scoping confirmed).
3. **Turnstile OFF in v1**, behind config (`STOCK_CHECK_ENABLED` kill switch is separate and always present). Compensating controls carry it: per-domain pacing (≥5s/host), global daily ceiling, numeric listing ids only.

## Build to the amended design set

SPEC.md as amended governs (its §3.1 single eligibility conjunction is THE eligibility rule: observation ≥24h old or absent AND last successful check ≥24h old or absent AND checkable AND not block-listed AND not in flight, evaluated server-side in §1.1 order). Where ENGINEERING's pre-ruling text conflicts with Priya's ruling note or SPEC §3.1, the ruling note + SPEC govern.

## Carried conditions — binding on this build

**A4 (from the design gate).** The build implements, and its tests pin:
- the UI-state ↔ API-state/outcome mapping table (design set's table — every API outcome lands in exactly one UI state);
- the single eligibility conjunction above (no second, divergent eligibility expression anywhere — client or server);
- the 25s executor deadline / 30s polling ceiling stated and implemented as ONE rule (CSN-12 as re-pointed);
- the blocked-stamp / `blocked_until` interaction (Q-D7 as dissolved by C1: blocked state never touches the success clock).

**A6 (from the design gate) — verbatim binding requirements:**
- Ada's single-owner + clear-between-events announcement prescription (ADA-RULINGS §4 item 5a): one live region owns stock announcements; it is cleared between events.
- The couldn't-check announcement (Ada §2.4 / COPY S4 as swapped): after a failed check the retry line is NOT used; the announcement follows the ruled copy.
- Non-participant announcement discipline (Ada §7.5, stronger form as applied): a non-participant (a listing whose observation did not change / a bystander card) never renders and never announces the notice.
- `deferred` outcomes hold to resolution: the control does not resolve, time out visually, or announce until the check resolves.
- Reduced motion: static hold + pulse removal (DR-2 / Ada §6). NOTE: SPEC §6.1's "suppressed under prefers-reduced-motion" phrasing was already overruled by DR-2 — the static hold governs, per the re-check record.
- **K-20 token-change tripwire:** the couldn't-check notice's warn pairing (warn #8A5E08 on paper-deep #F0E5CB, accepted at 4.5520:1 unrounded) is ruled as-is; **any change to either token voids the ruling automatically** and the notice must be re-ruled before shipping.

**C1 (re-check condition — the success timestamp).** Add ONE additive success timestamp on `listing_stock_checks` (pre-authorized additive plumbing under Dustin's 2026-11-22 standing authorization). It is written ONLY by `recordResult` on `outcome='ok'` at claim completion, and is never overwritten by non-ok outcomes. The §4.2 window test and lease claim key on this field per SPEC §3.1 — NOT on `attempted_at`. The §5.2 blocked-click stamp and the §4.2 sweeper `lease_expired` stamp write `attempted_at` ONLY and must never write the success field.

**C2 (re-check condition — fetch ceilings).** Do NOT quote ENGINEERING §6.1's derived ceiling (~2,960/day), §6.3's repetition claims, or the appendix Guardrails ceiling as ruled bounds anywhere in code comments, tests, or the PR body — they are attempt-model arithmetic, false under Ruling 1. The operative ceiling is §6.4's **3,000 fetches/day** as designed, with its graceful degradation (feature disables until UTC midnight) implemented as designed. Re-calibration of that number is a separate named item flagged to Dustin — NOT part of this build.

**C3 (re-check condition — superseded passages).** The following ENGINEERING passages are superseded by Priya's ruling note + SPEC §3.1 and must not be implemented as written: governing-value #2; §1.1 step 8 (its §4.2 cross-reference resolves to the re-keyed window test under C1); §2.3's "starts the 24h attempt window"; §8 Q8's "absolute" phrasing. This brief is the C3 record (the re-check offered brief-carriage as one of the two discharges; the coordinator elects it).

## Acceptance

- The CSN check series as amended (CSN-1…CSN-15 with the re-check's re-points: CSN-2 override case, CSN-3 inverted fixtures, CSN-7 timing + non-persistence, CSN-9 re-order with Ada §3.5 conditions inside the check, CSN-10 in its original form, CSN-12 the 25s/30s pair, CSN-15 state-(e) focus behavior) — all executed, none weakened.
- New tests are non-vacuous against the merge-base in the usual way (gate mutation spot-checks expected).
- No prices anywhere; no change to any surface outside the listing card's check control + its announcement behavior + the shop grouped-sort re-order.

## Gate

Quinn build gate (usability drive in a real browser: a shopper checking stock on listings incl. a failure-and-retry under Ruling 1, a grouped-sort flip under Ruling 2) + **Athene Coldread commissioned as second rater** (independent severity ratings locked before sight of Quinn's). The drive MUST include a passing **keyboard drive of the in-place re-order** (Ruling 2's Ada condition) and real-render proof of the control's states. Merge/deploy/live-verify follow the standing pipeline; the dashboard CSN card updates as part of done.

## PR body hygiene

Provenance (this brief), the workflow's Build accounting, verify counts (branch + merge-base), the C1–C3 discharges stated, and a Gate record section pre-templated for Quinn + Athene.

## Coordinator addendum (2026-11-23, post-SHOP — read with the brief)

- **The SHOP build has shipped** (PR #66, merged 47e1e67, Worker c046092f) since this brief was held. The seller page no longer renders ledger cards: its listings are the unified `VarietyCard` in **shop context**, which carries the ledger's stock line transferred whole. The stock line the check control lives in now exists in exactly two components: `ListingRow` (variety context — unchanged by SHOP) and `VarietyCard` shop context. **The control, its states, and its announcement behavior attach to the stock line in BOTH.** Where the design set (`stock-check-design/`) speaks of the seller-page ledger card, read the shop-context card's stock line.
- **Ruling 2's grouped sort is the shipped shop sort** (model: `v2/lib/shop-browse.ts`; the shop results region re-orders in place). The re-order on a stock flip happens inside that region, move-never-remount, per Ada §3.5 as the brief already requires.
- **Migration numbering:** the next migration is **0019** (0018_seller_shop_contact_locations shipped with SHOP). The `listing_stock_checks` table (with C1's additive success timestamp) + the append-only `stock_check_log` land there, additive only.
- Everything else in this brief stands exactly as written, including conditions A4, A6, C1–C3 and the Athene second-rater gate.
