# Quinn Design Gate — Tranche 3 SPEC (Seed Directory, seeds.hues.flowers)

**Gate:** Design gate (spec review only — no build exists; nothing was executed against a branch).
**Spec under gate:** `backlog-2026-11-21/tranche-3/SPEC.md` — Nadia, UX, 2026-11-22.
**Gate date:** 2026-11-22 · **Reviewer:** Quinn, QA (independent; no contribution to the spec).

## VERDICT: FAIL

The failure is **scoped and small to repair** — it is not a redesign. Items 3.5, 3.3's behavior contract, and the bulk of 3.1 and 3.4 pass this gate on their merits (see §5, what passed). The spec fails because Item 3.2 — the tranche's only service-schema build — contains one contract that **cannot be built as written** (F-1, Blocker) and one flow whose service half was never specified (F-2, Major), and because the §7 change register and the PB-2 build gate contradict the spec's own body (F-3, F-4, Major). A spec that would fail its own acceptance check 3.2-E on the day it is built is not a buildable spec, however good the rest of it is. All required amendments are stated in §6 precisely enough to apply without a second interpretation round; on their application this gate re-runs as a delta check on §§3/7/9/10 only.

**Blocking findings:** F-1 (Blocker) · F-2, F-3, F-4 (Major). **Non-blocking:** F-5, F-6 (Minor) · N-1…N-4 (Notes).

---

## 1. Scope coverage against AUDIT §6 Tranche 3 — PASS

Checked line by line against `full-audit-2026-11-21/AUDIT.md` §6 and the underlying section files (Nadia, Mina, Ada + addendum, Quinn):

| §6 commitment | Spec disposition | Verdict |
|---|---|---|
| 3.1 Filter parity + in-place + per-option counts + Clear All (NUX-01, UX-04, F-11) | §2 complete: group table, counts contract, Q7 in-place contract generalized, applied row + Clear All, crop-detail rebuild, State-cloud exception bounded | Covered |
| 3.2 Waitlist flip + no-JS fallback (UX-05, U5.2) | §3 — covered in intent; buildability defects F-1/F-2 below | Covered, defective |
| 3.3 Field-state set + behavior contract; A4 (F-20, Ada A4) | §4 — behavior contract + full form inventory + sequence; visual design correctly left to Mina + Ada | Covered |
| 3.4 Home composition (UX-02), sort (UX-03), autocomplete ranking + empty state + no-auto-open (UX-06, U1.1–U1.3) | §5 complete, incl. U1.3 did-you-mean bounded design and U1.4 folded in as a named same-touch fix | Covered |
| 3.5 Variety pagination → true 404s (Ember M1 / NUX-02) | §6 — correctly no design; root cause named; proof matrix extends to every paginated route (verification scope, not build scope) | Covered |
| Ada A3 (FilterStrip) | §2.7 ruled into 3.1-F with reasoning on record; Ada's prescribed values carried verbatim (`px-1.5 py-1.5`, `scroll-padding-inline: 3rem` — verified against her §8); the 44px chevron correctly attributed as a house-standard call, not Ada's floor | Covered |
| Ada AD-2 (autocomplete active row) | §5.3.5 ruled into 3.4; prescribed direction followed; values recomputed by me (§3 below) | Covered |

**Nothing silently dropped. Nothing out-of-scope absorbed:** Item 5.2 (65ch prose cap) is explicitly fenced out at §5.1.4 (hero `max-w-2xl` stands); Item 5.3 (desktop header) is untouched; the seller-tag system is explicitly not built (§2 header, §11.4) — Item 3.1 builds only the machinery it will inherit, and the Sellers group is today's Small farm boolean; **prices are never shown** — the only numbers added are result counts, and check T-C guards payloads as well as surfaces. The search Sellers exclusion (§2.2) and the seller-cloud Clear All exception (§2.6.2) are recorded as decided interpretations with reasons, not silent deviations — the correct hygiene.

## 2. Dustin's settled rulings — PASS

- **Waitlist flip (P2, ruled in the team's favor 2026-11-20):** §3 implements the ruling — alert set with contact + channel alone, minimal account created in place, profile extras afterwards or never. It does not re-litigate it. Correct.
- **In-place standard / usability doctrine:** §2.5 states the standard as observables (focus, scroll, history count, no beacon) and §8 gates it with real-browser drives. Correct.
- **Small Farm legend relocation (P4/D3):** §2.3 preserves the current placement (this tranche can neither drop, duplicate, nor move it) and §11.2 flags the missing tranche assignment for Hue with a recommendation. Exactly the handling the brief required.
- **PB-1 (sort default)** is framed as Dustin's decision, designed both ways (§5.2.4/§5.2.5), and the §5.2 build is correctly gated on the ruling in §9 while the rest of the tranche proceeds. **PB-2's gating is defective — see F-4.**
- **§11.1 (sign-in seam)** is framed as Dustin's decision (credential-model change, P2-class), with a one-line recommended default recorded and the waitlist build correctly **not** gated on it. Correct.
- **Item 3.3 ownership:** §4 frames, does not design — behavior contract, inventory, and sequence are Nadia's seat's contribution; visual values are Mina's, the A4 pattern's final form is Ada's, and §4.4 flags both of Ada's sign-offs (A4 pattern ownership; error-state color pairs) as hers. Correct.

## 3. Current-state claims — spot-verified against `origin/main` (via `git show` / `git grep` only; the stale working tree was never read) and live probes

Every load-bearing claim sampled **verified true**, except one (marked ✗):

| Claim | Evidence | Result |
|---|---|---|
| §3.1: `CreateAccountSchema` requires name, email, phone, zip for every create incl. `join_variety` | `v2/lib/services/accounts.ts`: all four fields non-optional in the strict object; `create()` calls `phoneOr422(body.phone)` and `lookupZone(body.zip)` unconditionally | ✓ |
| §2.1: home count line renders only when a filter is active | `v2/app/page.tsx`: `{active.length ? (<p … aria-live="polite" aria-atomic="true">) : null}` | ✓ |
| §2.1: `/crop` index count line has no live region | `v2/app/crop/page.tsx`: no `aria-live` present | ✓ |
| §2.1/§2.7: FilterStrip `px-1 py-1`, no scroll-padding, chevrons `h-10 w-10` | `FilterStrip.tsx` classes verbatim | ✓ |
| §2.1: no facet/count payload exists | `git grep facet\|countBy` over `v2/lib` + `v2/app/api`: no hits | ✓ |
| §5.3: autocomplete consumes combined array in type order | `catalog.ts` line 690: `[...crops, ...series, ...varieties, ...sellers].slice(0, lim)` | ✓ |
| §5.3: SearchBox auto-opens on mount | Effect keyed on `q` initialized from `defaultValue`, calls `setOpen(true)`; `onFocus` reopens when results exist | ✓ |
| §3.1: no-JS waitlist renders only the loading shell | `WaitlistBlock.tsx`: sr-only "Loading waiting-list status…" + two skeleton bars | ✓ |
| §4.2.10: CodeEntry `maxLength={6}` defeats its own space-stripping | Input carries `maxLength={6}` and no `aria-invalid`/`aria-describedby`; submit handler strips `\s` — the truncation happens first, exactly as U7.2 and the spec state | ✓ |
| §6.1: live pagination statuses | My probes 2026-11-22: `/variety?page=99` → **200**, `/variety?page=35` → **200**, `/seller?page=99` → **404**, `/crop/zinnia?page=99` → **404**, `/state/oregon?page=99` → **404** — the spec's table verbatim; `loading.tsx` present on the variety segment and `assertPageInRange` in its page, as §6.1 states | ✓ |
| §5.3.5: AD-2 contrast values | Recomputed by WCAG relative luminance, unrounded: leaf-50 `#E3EAD8` on surface `#FFFDF6` = **1.2118:1**; leaf `#1E4634` on surface = **10.4162:1** — the spec's 1.2118 and 10.42 exactly | ✓ |
| §5.2.2: availability order is expressible from existing data | `VarietySort` set matches §5.2's list; summary rows carry `inStockCount` and `listingCount` | ✓ |
| §3.3: `PublicUser.usda_zone` admits null | Interface: `usda_zone: string \| null` | ✓ (but see N-2) |
| §3.2.4: recognized-contact verification — "the session is established as the existing code flow establishes it" | The existing code flow establishes the session **at create time**, before any code; `verifyEmail`/`resendEmail` operate on an already-sessioned user (`u: repo.UserRow`). No unauthenticated code-issue path exists, and `create()` answers an existing email with **409 `email_taken`**. There is no existing flow that does what this sentence claims | ✗ — see F-2 |

## 4. Findings

### F-1 — BLOCKER — The no-JS waitlist flow (§3.4) cannot succeed: it never disposes of Turnstile, which fails closed without JavaScript

**Object:** SPEC §3.2.1, §3.3, §3.4; acceptance check 3.2-E.
**Evidence:** `v2/lib/turnstile.ts` — "A missing or invalid token is a 403… If the secret is unset, verification FAILS CLOSED"; `turnstileOutcome()` returns null for a missing token in production. `accounts.ts` `create()` calls `requireHuman()` before anything is processed. A Turnstile token is minted by Cloudflare's JavaScript widget; a no-JS plain POST (§3.4.2) can never present one. The spec mentions Turnstile once — §3.2.1, "rides the submission as today, invisibly to the contract," in the *JavaScript* flow — and §3.3's service-contract inputs, which carefully relax name/zip/phone, say nothing about the human-verification requirement on the non-JS path.
**Expected vs actual:** The spec's contract requires (§3.4.2) that a plain POST join succeed and land back on the variety page in a verify state, and check 3.2-E requires exactly that drive to pass. As specified, every such POST is refused 403 before the relaxed schema is ever reached. The build must therefore either fail its own gate or silently weaken bot protection on an account-creation endpoint — a security-relevant decision the spec currently makes by omission, which is the one way it must never be made.
**Standard violated:** Conformance to requirements (the spec's requirements are mutually inconsistent); the house rule that a decision reserved upward is never taken by default. Note the mitigating fact the amendment can build on, already in the spec: §3.2.3 holds all alerts until the email is verified by code, so the no-JS path's abuse ceiling is bounded — but that reasoning must be *stated and ruled*, not left for a builder to improvise.
**Required amendment:** A-1 (§6).

### F-2 — MAJOR — The recognized-contact path (§3.2.4) has no service contract: the code it depends on cannot be issued to a signed-out visitor by any existing endpoint

**Object:** SPEC §3.2.4, §3.3, §3.6.
**Evidence:** §3 above (✗ row). `create()` 409s on an existing email; verification codes are issued inside `create()` (new user, session already started) or by `resendEmail(u)` for a sessioned user. §3.3 enumerates only the minimal-create relaxation and the non-JS encoding; §3.6's file list gives `accounts.ts` "minimal-create contract + non-JS path" and nothing for: an unauthenticated code-issue for an existing account, its rate limiting (the in-house precedent, `create()`, issues with `enforceLimits: false` — copying that onto a public code-issue endpoint would be an open code-bombing relay), session establishment *at verify time* (a new moment — no existing flow establishes a session there), and recording the pending variety join across the verify step so §3.2.4's "on verification, the join completes" has somewhere to live.
**Expected vs actual:** §3.3 is titled "normative contents, for the pipeline" and §3.1 prides itself on stating the schema change "as a build input rather than letting the build discover it." The recognized-contact half of the flip is a larger service change than the schema relaxation, and the build *would* discover it — mid-build, ungated.
**Standard violated:** The spec's own §0/§3.1 standard (service contract changes are stated as build inputs); completeness of a normative contract.
**Required amendment:** A-2 (§6).

### F-3 — MAJOR — The §7 change register is incomplete against the spec's own prescriptions (the T-B discipline)

**Object:** SPEC §7 vs §§2–5. §7 declares itself "the complete, closed list," and check T-B fails the tranche on an eleventh difference. As written, a faithful build produces at least six differences the register omits — so T-B would either fail a correct build or be waived into meaninglessness:
1. **Search gains the Life cycle group** (§2.2 table) — a new rendered control group on `/search`; no B-item names it.
2. **`/crop` index count line gains live-region attributes** (§2.5.9) — B-5 names only the home line.
3. **Designed zero-results states appear on home and `/crop` index** (§2.6.3) — new rendered content inside the results region; B-2 covers the applied row, not the empty states.
4. **The in-place filter failure line** (§2.5.6: error copy, `role="alert"`, selected-state revert) — a rendered/behavior difference named nowhere in §7.
5. **The finish-your-account step in the account panel** (§3.2.5: "also appears, equivalently, in the account panel") — B-7 locates the step only "after joining," and §3.6's per-file list omits `AccountPanel.tsx` entirely; a brief lifted from §3.6 would never build it.
6. **Item 3.3 copy/behavior changes beyond B-10's enumeration** — hint-stated rules (§4.2.4: the ZIP hint's "5-digit", Add Your Farm's minimum/format rules restated as rules) and CodeEntry's lifetime copy + spaced-paste acceptance (§4.2.10) are rendered/behavior differences; B-10 names only field states, associated errors, focus, and mapped copy. (The U1.4 quote-spacing fix, §5.3.4, is likewise absent from B-8 — trivial in itself, listed here because the register's claim is completeness.)
**Standard violated:** The spec's own §7 completeness claim; the Tranche 2 T-B discipline this gate is charged to re-apply.
**Required amendment:** A-3 (§6).

### F-4 — MAJOR — PB-2's build gate contradicts the §9 build order, and its count semantics contradict §2.4 under the multi-select ruling

**Object:** SPEC §2.2, §2.4.1, §9, §10 PB-2.
**Evidence (gate):** §2.2 states "The build does not start on Hue's semantics until Hue carries PB-2 to Dustin." §9's build 2 (3.1a) builds the in-place core on `/variety` — "the complete model," Hue included — and §9's only gating note reserves PB-1 for §5.2. §10's preamble promises both pushbacks are "flagged *before* their builds dispatch, so a ruling costs no rework." These cannot all hold: either 3.1a stalls awaiting PB-2 (undisclosed in §9), or it builds Hue single-select and PB-2's later ruling re-opens the tranche's riskiest build after its gate (undisclosed rework). PB-1's gating, by contrast, is stated identically in §5.2.5 and §9 — the standard PB-2 must meet.
**Evidence (counts):** §2.4.1 defines an option's count as results "with **that option selected** and every other group held." Under PB-2, for a hue already in the selected set, §10 defines its count as "results if this hue were **toggled**" — i.e., with it *removed*. For a selected hue the two definitions give different numbers, and §§2.3–2.6 — which §2.2 asserts "hold under either ruling" — never reconcile them (the "All" option's meaning under a partial Hue set is likewise unspecified in the body; §10 alone designs the multi-select semantics).
**Standard violated:** Internal consistency of a normative contract; decisions hygiene (a Dustin-reserved decision's gating must be unambiguous before dispatch).
**Required amendments:** A-4, A-5 (§6).

### F-5 — MINOR — §2.5.6's failure behavior has no acceptance check; §8's error-path coverage is thinner than the contract it gates

§8 contains no check that simulates a failed in-place update. §2.5.6 prescribes a precise observable (results/counts/URL unchanged, selected state reverts, one `role="alert"` line, not repeated per retry) and no check in §8 can fail a build that omits or botches it. This is the happy-path-only failure mode in spec form — the same class as the escapes this gate exists to prevent (the BusyForm defect was, at root, an unexercised failure/interaction path). Related thinner spots, same root: check 3.2-E drives the no-JS happy path but no no-JS error state (invalid email, wrong code via the plain code form); check 3.4-B invokes §2.5's rules for sort without naming the page-reset-to-1 observable §2.5.4 requires. **Amendment:** A-6 (§6).

### F-6 — MINOR — Two §5 acceptance checks are too weak to fail the defects they exist to catch

1. **3.4-A never checks the cap's defining property.** §5.1 fixes the resting 12 as "varieties-with-sellers descending, then name ascending." Check 3.4-A verifies count (12), see-all total, section order, and cap-lift — a build rendering the first 12 crops *alphabetically* passes every clause. The ordering is the item's entire point (the most buyable crops first) and is checkable against `catalog.coverage()` data.
2. **3.4-B under-tests the availability order it gates.** §5.2.2 defines three tiers (in-stock → listed → none), listing-count descending within tier, name as tiebreak. The check verifies only that page 1 contains no zero-listing variety while a listing-bearing one exists deeper — a build that ignored the in-stock tier entirely, or ordered within tiers by name alone, passes. The sibling-rail clause has the same weakness by reference.
**Amendment:** A-7 (§6).

### Notes (not findings against the verdict)

- **N-1 — §5.2.3 sort values.** §1 declares URL parameters normative, but §5.2.3 leaves the `sort` value names "the builder's within that discipline," and its parenthetical "(absent = default; `sort=name`, `sort=recent` for the others)" never names the explicit value for the availability option itself. Harmless if the brief fixes the three values; the spec should not claim normative status it then delegates.
- **N-2 — §3.3 minimal-account storage representation.** The users table stores `name`/`phone` as NOT NULL with `""` defaults, and `PublicUser.name`/`phone` are non-nullable strings — so "name unset" (§3.3) will in practice be an empty-string sentinel that the account panel and §3.2.5's step must treat as unset. The contract's observable behavior is unaffected; one sentence in §3.3 naming the sentinel would save the build a discovery.
- **N-3 — §2.5.3's 400ms–1s band.** Results must land "within ~400ms," and the busy indication is permitted only past 1s; the band between is unspecified, and check 3.1-A's "(or §2.5.3's busy rule is observed on a throttled connection)" blurs which clause a 700ms update is judged against. State the band (e.g., 400ms is the budget on an unthrottled local build; throttled drives judge only the >1s busy rule) in §2.5.3 or 3.1-A.
- **N-4 — §3.4.1 no-JS phone field.** The floor form carries the phone field "present in the markup for the text channel," but its no-JS presentation is unspecified: always-visible (with what instruction?) vs. present-but-unlabeled. If it renders `required`, an email-only no-JS submission is blocked by native validation. One sentence in §3.4.1 — visible, optional unless the text channel is chosen, never `required` in the floor form — closes it. (This is presentation detail only; F-1 is the blocker on this flow.)

## 5. What passed, for the record

- **§0's governing rule** (server document correct, hydration makes it faster) is the right constitution for this tranche and is applied consistently — every §2–§5 behavior can be restated in its terms, and §2.6.4's no-JS floor (a remover that does nothing is a breach) is exactly the floor discipline U5.2 demands.
- **§2.5's in-place contract** is the Q7 matrix generalized without loss: stable keys/no remount, one history entry per deliberate change, stale-response discard, no page-view beacon, persistent live regions — and it correctly identifies and repairs the defect Tranche 1.3 introduced (the conditionally mounted home region) rather than building on it.
- **§2.4's counts contract** (server-computed, same-payload as results, zero counts stay operable) forecloses the client-derived-count lie and the Priya-dedupe disagreement class by construction.
- **§4** is a model of the framing discipline: a complete behavior contract (GOV.UK summary pattern, identical wording, data preservation, BusyForm criteria adopted as gate-checked properties in §4.2.6) that invents no visual value and flags its two Ada dependencies honestly.
- **§5.3.2's ranking contract** names the root cause in code (verified, §3), defines match classes with worked examples, and converts Quinn's U1.1 probes into acceptance checks unchanged — the audit-to-spec traceability the program asks for. §5.3.4's did-you-mean is genuinely bounded (one candidate, stated rule, empty-set-only computation).
- **§6 (Item 3.5)** is the correct amount of spec: root cause, two sanctioned patterns, observable stated, proof matrix wider than the defect.
- **§8, where it is strong, is very strong:** 3.1-A's measured drive (navigation events, scroll, `activeElement`, history count), 3.1-C's count reconciliation against fresh server loads, 3.1-F's rendered (not class-read) A3 proof, T-A's non-vacuity in both directions, T-C's payload-level price guard. F-5/F-6 are gaps in an otherwise executable checklist, not a pattern.

## 6. Required amendments (apply verbatim in substance; Nadia's wording may vary where the substance is preserved)

- **A-1 (fixes F-1).** Add a Turnstile disposition to §3.4 (and cross-reference it in §3.3), stating one of: **(a)** the non-JS form-encoded endpoint is exempt from Turnstile, with the compensating controls named in the spec (email-verification hold per §3.2.3, existing rate limiting, Turnstile still required on the JS path) — if this exemption needs Dustin's or a security ruling, §11 gains an entry saying so and Item 3.2's build is gated on it; or **(b)** another stated human-verification mechanism for the no-JS path. Silence is the only unacceptable disposition. Check 3.2-E stands as written once the disposition exists.
- **A-2 (fixes F-2).** Extend §3.3 with the recognized-contact service contract: (i) submitting an existing email to the join path issues a verification code to that email without a session and without disclosing account existence beyond what §3.2.4's copy already shows the submitter; (ii) code issuance on this path is rate-limited (limits stated or referenced to the existing verification service's limits — `enforceLimits: false` is explicitly not carried over); (iii) successful verification establishes the session at verify time and completes the pending join for the variety in the same step; (iv) correct §3.2.4's final parenthetical — the session is established at verification, a new moment, not "as the existing code flow establishes it." Add the corresponding file scope to §3.6.
- **A-3 (fixes F-3).** Amend §7 to register every difference listed in F-3 (extend B-2, B-5, B-7, B-8, B-10 or add B-11… as Nadia prefers), and add `AccountPanel.tsx` (finish-your-account step) to §3.6's file list. After amendment, a recount: every prescription in §§2–5 that changes rendering or behavior appears in §7 exactly once.
- **A-4 (fixes F-4, gate).** Reconcile §2.2 and §9 in one direction, stated identically in both places: either 3.1a is gated on the PB-2 ruling (say so in §9's table and gate note, as PB-1 is gated), or 3.1a builds Hue single-select and a later PB-2 ruling re-opens only the Hue group's selection logic as a named, bounded amendment build (say so in §2.2, replacing "does not start").
- **A-5 (fixes F-4, counts).** Add one paragraph to §2.4 (or §10 PB-2, cross-referenced from §2.4) defining counts under multi-select Hue: for an unselected hue, results with it added; for a selected hue, results with it removed; all other groups held; and the meaning of Hue's "All" chip under a partial set (clears the set; its count is the total under the other groups alone).
- **A-6 (fixes F-5).** Add acceptance checks: **3.1-K** — with the update request forced to fail (route blocked in the drive), the prior results/counts/URL stand, the tapped control's state reverts, exactly one `role="alert"` error line appears, and a successful retry clears it; **3.2-G** — no-JS error states: a plain-POST join with an invalid email and a plain code-form submission with a wrong code each land back on the variety page with the error stated and entered data preserved; and name the page-reset observable in 3.4-B ("switching sort from page 2 returns to page 1 in place").
- **A-7 (fixes F-6).** Strengthen 3.4-A: the resting 12 crop slugs equal the top 12 computed from the catalog's coverage data (varieties-with-sellers descending, name ascending), compared as a set in order. Strengthen 3.4-B: against service data, page 1 under availability order contains no variety from a lower tier while a higher-tier variety exists anywhere in the set, and within a tier the listing-count order is non-increasing.

## 7. Gate method and boundaries

Read in full: the spec; AUDIT.md §6 and the Nadia/Mina/Ada/Ada-addendum/Quinn section files for every cited finding. Spot-verified against `origin/main` via `git show`/`git grep` (never the working tree) and live production status probes, per §3's table — all local reads, within the standing gate approval; no execution-risk stop was encountered and nothing was worked around. This is a design gate: no build, browser drive, or verify suite was run, and none is claimed. Checks in §8 were judged for executability and determinacy as written, not executed.

**Re-gate path:** Nadia applies A-1…A-7 (A-1 may route through Hue/Dustin if the Turnstile disposition needs a ruling). Quinn re-checks the amended §§3, 7, 9, 10 and §8 additions as a delta gate. No other section needs re-review.

*— Quinn, QA. Verdict: FAIL (scoped; amendments A-1…A-7 required before any Tranche 3 build brief lifts from §§3/7/9/10; builds 3.5 and the 3.3 design may proceed on the current spec at Hue's discretion, as neither touches a defective section).*


---

# DELTA RE-GATE — Tranche 3 SPEC amendments A-1…A-7, N-1…N-4

**Gate:** Delta re-gate, scoped exactly as the original record prescribed (§7 of the FAIL above): the amended sections only (§§2.2/2.4, 3, 5.2.3, 7, 8 additions, 9, 11) — no re-review of what already passed.
**Spec under gate:** `backlog-2026-11-21/tranche-3/SPEC.md` as amended by Nadia, 2026-11-22. The tranche-3 directory is untracked in git, so there is no diff; verification was by full read of the amended sections plus targeted greps for stale wording, register counts, and cross-references.
**Gate date:** 2026-11-22 · **Reviewer:** Quinn, QA (independent; no contribution to the spec or the amendments).

## VERDICT: PASS

Every required amendment A-1…A-7 is applied **as written** and closes its finding; every note N-1…N-4 is also applied. No new contradiction was introduced inside the amendment footprint, and nothing outside it changed in substance. F-1…F-6 are closed. The build briefs cleared and the briefs still gated on Dustin's rulings are stated explicitly in §3 below — those gates are Dustin's decisions, not defects, and they do not qualify this verdict.

## 1. Amendment-by-amendment verification

### A-1 (F-1, Blocker) — CLOSED
- **§3.4.5 exists and states disposition (a) in full:** the non-JS form-encoded create-and-join endpoint is exempt from Turnstile; the compensating controls are named — (i) the §3.2.3 email-verification hold (an unverified submission activates nothing), (ii) the site's existing rate limiting, (iii) Turnstile still required on the JavaScript path exactly as today, the exemption covering only the form-encoded endpoint.
- **Cross-referenced in §3.3:** the "Turnstile on the non-JS path" bullet points to §3.4.5, restates that the JS path is unchanged, and states the gate.
- **§9 gate is real:** build row 7 reads "3.2 does not start until the §11.4 Turnstile exemption is ruled." The gate is stated identically in four places (§3.3, §3.4.5, §9, §11.4) with one direction — it cannot be missed by a brief lifted from any of them.
- **§11.4 framing is complete:** the exemption is framed as a security posture decision for Dustin (via Hue), not a design decision the spec takes on its own authority, and the decline path is stated — if he declines, §3.4 needs a new stated human-verification mechanism before 3.2 can build; "silence is not an available disposition." Check 3.2-E is explicitly conditioned on the disposition and the ruling both existing. The F-1 failure mode — a security decision made by omission — is foreclosed.

### A-2 (F-2, Major) — CLOSED
- **§3.3's recognized-contact service contract carries all four required clauses:** (i) submitting an existing email issues a verification code to that email **without a session**, disclosing nothing about account existence beyond what §3.2.4's copy already shows the submitter; (ii) issuance is **rate-limited** to the existing verification service's limits, with the create path's `enforceLimits: false` precedent **explicitly not carried over**; (iii) the pending join (the variety) is recorded with the issued code; (iv) successful verification **establishes the session at verify time and completes the pending join in the same step**. A closing sentence bars satisfying any part of it by linking to `/account`.
- **§3.2.4's parenthetical is corrected:** it now reads that the session is established "at verification, in that step (a new moment: no existing flow establishes a session there; see §3.3's recognized-contact contract)." Grep confirms the original false claim ("as the existing code flow establishes it") no longer appears anywhere in the spec.
- **§3.6 extended:** the `accounts.ts` row now carries unauthenticated code issue, rate limiting (never `enforceLimits: false`), pending-join recording, session establishment at verify time, and the Turnstile exemption scoped to the form-encoded endpoint only.

### A-3 (F-3, Major) — CLOSED
- **§7 now registers B-1…B-13** (grep count: exactly 13 register rows), and all six differences F-3 named are registered: **B-11** (new) — Search gains the Life cycle group; **B-5** (extended) — home count line always-rendered **and** the `/crop` index count line gains the live-region attributes; **B-12** (new) — designed zero-results states on home and `/crop` index with the applied row visible and Clear All in place; **B-13** (new) — the §2.5.6 in-place failure line (`role="alert"`, announced once, not repeated per retry, prior state stands); **B-7** (extended) — the finish-your-account step "after joining **and, equivalently, in the account panel** for waitlist-created accounts until completed"; **B-10** (extended) — hint-stated rules (ZIP "5-digit", Add Your Farm's minimum/format rules restated as rules) and CodeEntry's lifetime copy plus spaced-paste acceptance; **B-8** (extended) — the U1.4 stray-space fix in the zero-results copy.
- **`AccountPanel.tsx` is in §3.6** with the finish-your-account step's full contents (same fields, same optionality, email/phone never re-asked, empty-string sentinel treated as unset).
- **T-B updated:** §8 now reads "exactly §7's B-1…B-13 and nothing else. A **fourteenth** difference is a FAIL." The register's completeness claim and the check that enforces it agree again.

### A-4 + A-5 (F-4, Major) — CLOSED
- **One direction, stated identically in both places:** §2.2 — "Build 3.1a — the in-place core, Hue included — **does not start until PB-2 is ruled** (the gating is stated identically in §9)"; §9 row 2 — "**Gate: 3.1a does not start until PB-2 is ruled** (stated identically in §2.2, as PB-1's gate is stated for §5.2)." Grep confirms the old contradictory phrasing ("does not start on Hue's semantics until Hue carries PB-2…") is gone. §10's preamble ("flagged *before* their builds dispatch, so a ruling costs no rework") is now true under this direction: the gate holds dispatch until the ruling lands.
- **§2.4's counts paragraph (item 5) defines multi-select Hue without contradicting §2.4.1 or §10:** for an **unselected** hue, results with it **added**; for a **selected** hue, results with it **removed**; every other group held; counts for other groups' options hold Hue's current set as it stands; Hue's "All" chip under a partial set **clears the set**, its count the total under the other groups alone. The paragraph explicitly reconciles the wording: under multi-select, §2.4.1's "selected" is read through this paragraph for Hue, and §2.4.1 stands unchanged for every single-select group. This matches §10 PB-2's toggle definition exactly.

### A-6 (F-5, Minor) — CLOSED
- **3.1-K (new)** is executable with determinate pass/fail: the update request is forced to fail (route blocked in the drive); pass requires prior results, per-option counts, and URL standing exactly, the tapped control's selected state reverting, exactly one `role="alert"` error line with the applied row, and a successful retry clearing the line without re-announcement per retry.
- **3.2-G (new)** covers the no-JS error states with landing-page, error-stated, and data-preserved conditions for both an invalid-email plain POST and a wrong-code plain code-form submission, and bars stranding on an error page, a blank state, or `/account`.
- **3.4-B names the page-reset observable:** "switching sort from page 2 returns to page 1 in place," tied to §2.5.4.

### A-7 (F-6, Minor) — CLOSED
- **3.4-A** now requires the resting 12 crop slugs to **equal, as a set in order, the top 12 computed from the catalog's coverage data** (varieties-with-sellers descending, name ascending) — "a build rendering any other 12, in any other order, fails." The alphabetical-first-12 build that passed the old check now fails it.
- **3.4-B** now runs the tier test **against service data**: page 1 under availability order contains no variety from a lower tier while a higher-tier variety exists anywhere in the set, and within a tier the listing-count order is non-increasing (name ascending breaks ties). The **sibling rail is included** under the same tier test.

### Notes N-1…N-4 — ALL APPLIED
- **N-1:** §5.2.3 names all three sort values normatively — `sort=availability`, `sort=name`, `sort=recent` (absent = default). The spec no longer delegates what §1 claims as normative.
- **N-2:** §3.3 names the empty-string sentinel: `name`/`phone` are NOT NULL with `""` defaults, `""` is how "unset" is stored, the account panel and §3.2.5's step must treat `""` as unset, and no surface may render the sentinel as a value. §3.6's AccountPanel row repeats the obligation at the file that implements it.
- **N-3:** the 400ms/1s band is clarified at the end of 3.1-K: the ~400ms budget is judged on an unthrottled local build; a throttled drive judges only §2.5.3's >1s busy rule; an update landing in the 400ms–1s band on a throttled drive is neither a pass nor a fail of the 400ms clause. Determinate.
- **N-4:** §3.4.1 specifies the floor form's phone field: visible, labeled as needed only for text alerts, **never carrying `required`** — native validation can never block an email-only no-JS submission, and the server enforces phone-required-iff-text-chosen per §3.3.

## 2. Scope discipline — CONFIRMED

- The amendments are confined to the prescribed footprint (§§2.2/2.4, 3, 5.2.3 by N-1 only, 7, 8, 9, 11). §§0, 1, 4, 5 (outside 5.2.3), and 6 read unchanged in substance against the original gate's record of what passed, and §10's PB-1/PB-2 designs match what F-4 quoted from the original — including PB-2's toggle-count wording, which the new §2.4 paragraph now reconciles rather than revises. (Byte-stability of §10 cannot be proven — the directory is untracked and no pre-amendment copy survives — but no substantive change is present, and none was needed there.)
- **Nothing quietly absorbs 5.2 or 5.3:** §5.1's boundary still stands verbatim — the hero's `max-w-2xl` stands, the 65ch cap is a later build, the header is untouched.
- **Seller tags untouched:** the header fence stands (Item 3.1 builds only the machinery the future tag filter inherits; the Sellers group is today's Small farm boolean), and §11.5 names the tag filter as another workstream's property.
- **No price anywhere:** every "price" occurrence in the amended spec is a prohibition, a fence, or check T-C's payload guard. The only numbers the tranche adds remain result counts.

**Form observation (non-gating, recorded for accuracy only):** the multi-select counts definition lives as numbered item 5 inside §2.4 rather than under a headed "§2.4.5." Nothing in the spec cross-references a §2.4.5 heading (§2.2, §2.4, and §10 all point to §2.4), so no reference dangles and no brief can miss it — the paragraph is the last item of the section it amends, explicitly labeled as applying only under a multi-select PB-2 ruling. No action required.

## 3. Build clearance — what lifts, what stays gated

On this PASS, the following is the clearance state per §9's order and gates:

**Cleared to lift now:**
- **Build 1 — 3.5** (pagination 404s, §6). No gate. (Already clearable under the original FAIL; confirmed again here.)
- **Build 3 — 3.3 design** (Mina + Ada's field-state deliverable against §4.2's contract). A design deliverable, not a build; its remaining dependencies are Ada's §4.4 sign-offs inside that deliverable, not Dustin rulings.
- **Build 6 — 3.3 build**, in §9's sequence (after the 3.3 design gate). No Dustin ruling gates it.
- **Build 4 — 3.1b**, in sequence only: it has no ruling gate of its own, but it spreads the 3.1a core, so it cannot start until 3.1a has run — which puts it behind the PB-2 ruling in practice.
- **Build 5 — 3.4, except its §5.2 default:** home composition, the sort control's machinery, and the search repair carry no gate; only the default-order decision inside §5.2 waits (below).

**Still gated on Dustin's rulings (rulings, not defects):**
- **Build 2 — 3.1a: gated on PB-2** (Hue multi-select, §10). Does not start until Dustin rules.
- **Build 5 — §5.2's sort default: gated on PB-1** (availability-first vs. A–Z default, §10). The rest of 3.4 is unaffected.
- **Build 7 — 3.2: gated on the §11.4 Turnstile exemption ruling.** Does not start until Dustin rules on disposition (a); a decline sends §3.4 back for a new stated no-JS human-verification mechanism before 3.2 can build.
- **§11.1** (the `/account` sign-in accommodation for phone-less accounts) remains Dustin's open decision by design; per the spec it does **not** gate the 3.2 build once the Turnstile ruling lands, and it gates nothing else.

## 4. Method and boundaries of this re-gate

Read in full: the amended §§2, 3, 5, 7, 8, 9, 10, 11 of the spec; spot-read §§0, 1, 4, 6 for scope discipline. Greps run: stale F-2/F-4 phrasings (absent), register row count (13), T-B wording, `enforceLimits` occurrences (both are the explicit not-carried-over statements), all "Gate:" lines in §9 (three, consistent), price/tag/5.2/5.3 fences. This is a design-gate delta: no build exists, no browser drive or verify suite was run, and none is claimed. Checks were judged for executability and determinacy as written, not executed — that judgment is the build gates' work, per §8.

*— Quinn, QA. Verdict: PASS. F-1…F-6 closed; A-1…A-7 and N-1…N-4 verified as written. Tranche 3 build briefs may lift per §3 above; 3.1a waits on PB-2, §5.2's default waits on PB-1, and 3.2 waits on the §11.4 Turnstile ruling — all three are Dustin's calls, carried by Hue.*
