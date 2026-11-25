# QUINN GATE — SPA Slice 6: Forms + account (Seed Directory SPA conversion)

- **Subject:** PR #79, github.com/dustinboling/seeds-hues — "Slice 6 — Forms + account (Seed Directory SPA conversion)", branch `muse/45548821328`, head `e9ec246`
- **Reviewer:** Quinn Assurance (independent; did not make this work). Single-evaluator gate (see Coverage ledger).
- **Worktree:** `~/workspace/seeds-hues-gate-s6-wt` at the PR head, as supplied. No fetch/checkout/worktree/clone run; all work on disk inside that worktree.
- **Contract, in order:** (1) build brief `muse-tasks/spa-slice-6-forms-account.md`; (2) Bea's prerender-content audit `spa-conversion-2026-11-23/PRERENDER-CONTENT-AUDIT.md` §1, §5.1, §5.2, §6.1, §6.2, §7.1, §9; (3) the Tranche 3.2 rulings as recorded in `backlog-2026-11-21/tranche-3/DECISIONS.md` (§11.1 ruled (a); §11.4 ruled (a) with its compensating controls) and Ada Ruling 9; (4) gate records `QUINN-GATE-spa-slice-3.md` (carry 3 / U1, owed here) and `QUINN-GATE-spa-slice-5.md` (N1). All read before testing.
- **Date:** 2026-11-24 (America/Los_Angeles)

## VERDICT: PASS WITH NOTES

No Blocker, Critical, or Major defect found. The build-integrity question this PR carried — a two-run build whose first run died red on 4 rolldown build errors — is answered directly: from a clean `npm ci` in this worktree the shipped tree builds clean and verifies green twice (§1). Every gate-emphasis item was exercised: my own independent built-artifact drive passed **21/21** with my own typed values and my own price/exclusivity scanners (§2), the U1 carry from Slice 3 is **discharged** (§3), and all three mutation spot-proofs were noticed by the shipped suite (§4). The notes are Minor/Trivial: the starting-red statement is **still not filed** — now the third consecutive slice, despite Slice 6's brief making it a binding cure (N1, graded as a finding per the gate brief either way); two contract-reading rulings the build got right against looser brief shorthand (§6); and the recurring inventory-artifact note (N3). One declared boundary: no real-browser session is available to this gate, so the hydrated layer is proven at jsdom + HTTP-wire fidelity, not in Chromium (§8) — the same boundary as Slices 3–5, named rather than rounded up. Severity, evidence, coverage, and verdict are kept on separate axes throughout.

---

## 1. Verify chains + build integrity (executed by me)

| Chain | Result | Evidence |
|---|---|---|
| app `npm ci` (clean, in the gate worktree) | exit 0 — 588 packages | directly observed |
| app `npm run build` + `build:server` from that clean install | **exit 0** — vike build, SW emitted, PWA proof passed, `dist-server/serve.mjs` produced; **no rolldown errors** | directly observed |
| app `npm run verify` (lint + typecheck + test) — first run | **exit 0 — 51 test files, 664 tests, all passed** | directly observed |
| Slice 6 HTTP suite within it | `tests/build/slice6-forms-account.test.ts` — 41 tests passed (count observed under mutation runs) | directly observed |
| Final confirmation `npm run verify` after all mutations restored and my gate suite deleted | **exit 0** (51 workers); `git status` clean, tree byte-identical to the PR head `e9ec246` | directly observed |

Builder accounting checks:
- **Final green — CONFIRMED as reproduced: 51 files / 664 tests.** Against Slice 5's gate-confirmed 560 / 42, this slice adds 104 tests across 9 files. The PR body's verify figure (51 / 664) matches my reproduction exactly — but see N2 on what the PR body claims that figure *is*.
- **Step-1 starting-red — NOT FILED.** The PR body is the workflow's auto-generated stub (task file + run id + the final commit's diffstat only); it contains no builder summary at all, and no summary file exists anywhere in the tree (searched). Ruled on as N1 (§7). This is the Slice 5 N1 pattern recurring *after* the Slice 6 brief made the verbatim red statement a binding cure ("a summary without it is incomplete") — the cure was procedural and it did not take. The discriminating property the red exists to prove is independently established at this gate by §4's mutations and §2's contract-first drive, so the omission does not block; the recurrence is the finding.
- **Diff scope — CONFIRMED:** 73 files, +8,325/−71 against the Slice 5 merge, all under `app/` plus program records; `v2/` untouched, no `.github/workflows/*`, no deploy config. The v2 verify chain was therefore not re-run (identical tree to Slice 5's gate, where the diff-scope rule was established).

## 2. My independent drive of the built artifact (21 tests, all passed)

I wrote my own contract suite (own harness copy, own cookie jar, own exclusivity counter and price scanner, expectations from the brief/audit/v2 behavior — not the builder's assertions), built the app against the test stub, served it through the shipped harness, drove it over plain HTTP, then deleted the suite. **Result: 21/21 passed.** Two initial failures were defects in my own tests, corrected and re-run green — recorded because both corrections are evidence about the product's deliberate shapes: `/api/v1/account/me` answers 200 with `{signed_in: false}` when signed out (v2's shape — sign-out proof is that body plus a 401 from `/alerts`), and the §11.1 seam's code *request* requires a Turnstile token on the JS path (403 without one — the code itself is the credential only at *verify*).

My typed values were my own (probe identities `quinn.probe@…`, `gate.probe@…`, farm "Quinn Probe Acres QG-881", markers QG-771…QG-882), distinct from the builder's fixtures strings.

### Forms — the BusyForm standard, payload parity end to end
- **Report, floor POST (form-encoded, with the widget's token field):** stub received exactly the typed payload — type, target_type, lowercased target_ref (`Blue-Ridge-Seeds` → `blue-ridge-seeds`, v2's mapping), message verbatim, contact, token — and the response is the success state (the typed message does not echo back as a form). **JSON POST (the enhanced path's wire):** verbatim payload at the stub, 2xx.
- **Report, rejection drive:** stub in `validation_error` mode → 200 re-render with the typed message and contact **preserved** and a plain-language error. **No-token floor POST:** refused by the human check with values preserved — the designed posture (§6(b)).
- **Add-your-farm:** GET `?state=ks` (lowercase — my choice; the builder tested uppercase) → 200, indexable (no `noindex` anywhere), the KS option rendered `selected`. Floor POST with token: the stub received all typed fields intact (farm/contact/city/state/website/about/varieties/phone/wholesale/notes + token). Rejection drive: farm name and email preserved with the error.
- **Structural BusyForm check (code read):** no form component disables a fieldset or its fields while sending — fieldsets in `ReportForm`/`AddYourFarmForm` carry no `disabled`; only the submit *button* disables (and these are controlled React forms posting explicit payloads via fetch, with the shipped DOM test pinning "the busy submit never disables its own fields"). The founding defect's mechanism is absent by construction on both paths, and the entered→constructed→received→readback chain is compared link-by-link in the drives above.

### No-JS floor — the §11.4-exempt endpoint
- POST to `/api/v1/account/waitlist/join-form` through the app relay with **no Turnstile token anywhere in the request**: **303** to the verify floor, Location ending `#waitlist-block` (Ada Ruling 9); the stub created the account, joined the entry, and set the session cookie. Verify-form POST (code `123456`) → 303 to the active floor, fragment again. Compensating controls present and exercised: the verification hold (the join lands in `verify`, alerts held until the code confirms — §11.4 control (i)) and rate limiting (control (ii)): with the stub's join-form mode tripped to `rate_limited`, the same POST → 303 to the error floor carrying the typed email in the URL + the fragment. Turnstile remains required everywhere else (report/farm floor without a token refused; sign-in/code-request 403 without one).

### Account drive (wire level, through the app's relay)
- **Phone-less seam end-to-end:** `sign-in/code` (with token) → 200; `sign-in/verify` with the fixture's code `654321` → 200, session cookie issued; `/account/me` → 200 naming `phoneless@example.com`. The seam exists in the SSR shell verbatim ("Email me a code instead") and the signed-out `/account` HTML carries **no user data** (neither fixture name nor email appears).
- **Willa (full account):** pair sign-in → session; `/account/alerts` shows `cosmos-lonely-bloom` = **found** and `cosmos-candy-stripe` = **waiting** — matching the fixture definitions by hand. **Held** is rendered by the panel when no channel is active (`AccountPanel` Held badge + reasons, code read) and is exercised in the shipped DOM suite (§5). **Sign-out:** POST → `/me` reports `signed_in: false` and `/alerts` answers 401 — the session is cleared server-side, not just in the UI.
- **Session persistence across a client-side route change** is a client-router property; it is pinned by the shipped DOM suite (remount with no reload, `account-flows.test.tsx`) and is *not* provable at my HTTP fidelity — named in §8, not rounded up.

### /go/[id] (§7.1)
`/go/1` → **302, not 301**, Location = the seller product URL with `utm_source=seed-directory` (the m-3 rename applied on relay — the stub backend still composes the retired `seedfinder` value) + `utm_medium=referral`; `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`; the click is in the stub's log with listing id 1. `/go/3` keeps the target's own `?color=red`; `/go/4` keeps the seller's own `utm_source=newsletter` (never overwritten). Unknown 999, removed listing 2, unpublished 7, non-numeric `abc` → **404, Location null — never a redirect**. Removed *seller* 5 → **410** (§6(a)).

### /unsubscribe (§6.2)
GET with the valid token → 200 confirm state naming Lonely Bloom, `noindex, nofollow`, and **the GET changed nothing** (waitlist count and unsubscribed log untouched — mail-scanner safety). GET with the tampered token → 200 invalid-link state ("isn't valid"), no state change. POST with the tampered token → **400 refused, no state change**. POST with the valid token → 200 and the state actually flips: Willa's Lonely Bloom entry is gone from the stub and the token is recorded. (The brief's shorthand "valid token flips; tampered refused" is realized through the one-click POST + confirm-button flow the audit's §6.2 mandates — a GET that flipped state would fail §6.2; ruled in §6(c).)

### Head exclusivity + price guard (my own counts/scans)
On `/report`, `/add-your-farm`, `/account`, `/unsubscribe`: **canonical 1, meta description 1, og:url 1, og:image 1, title 1 — every template exactly one of each.** My own rendered-HTML price scan ($-amount pattern + the prohibited JSON-LD strings) found **zero violations** on all four, and the shipped code guard (`assertNoProhibitedJsonLd`, 18 guard tests green in verify) is the second half. Cache posture: all four surfaces answer `no-store` — no form/account surface rides the public §9 posture, and floor-state variety URLs bypass the edge mock (shipped suite, green).

## 3. U1 carry from Slice 3 — DISCHARGED

Slice 3's gate left the constructed→received link of the waitlist chain unchecked ("owed at Slice 6's gate"). It is now proven end to end, by the shipped suite and independently by my §2 drive:
- **Signed-out create-then-join (no-JS floor):** join-form POST → account created + entry joined + session issued → verify-form → active floor; the variety page's active state and the account's alerts both show the joined entry.
- **Signed-in join:** pair sign-in, then the account's alerts and the variety page's waitlist read (`/api/v1/account/waitlist`) agree on membership; the shipped HTTP suite's signed-in floor join shows the joined state on both surfaces.
- Every redirect-back in both paths ends with `#waitlist-block` (Ruling 9), asserted on the raw Location headers.

The Slice 3 carry is discharged in full. Slice 3's U1 usability note (email requiredness invisible before submit) remains a note on the block's copy, unchanged by this slice — carried forward as N4, still Minor/cosmetic.

## 4. Mutation spot-proofs (suite sensitivity — each applied, run, restored byte-identical)

| # | Mutation | Outcome |
|---|---|---|
| M1 | Field-dropping submit path (`form-posts.ts`: report floor builder sends `message: ""`) | **NOTICED** — 3 tests failed across 2 files (form-posts unit + BusyForm DOM) |
| M2 | No-JS floor form loses its exempt endpoint (`WaitlistBlock`: floor form action `join-form` → the Turnstile/session JSON `join`) | **NOTICED** — 1 test failed (the slice-6 HTTP suite pins the floor form's action in the rendered page) |
| M3 | `/go/` answers 301 (`serve.ts` go handler) | **NOTICED** — 1 test failed (slice-6 HTTP 302 assertion) |

All three mutations were caught. Tree restored after each (backups byte-copied back and `cmp`-verified; final `git status` clean and final full verify green, §1).

## 5. Usability drive (visitor goals)

Evaluator structure: single evaluator (Quinn); Nielsen 0–4 for usability items. Modes: JS-disabled raw HTML at full fidelity (§2) for the SSR floors and shells; the shipped jsdom DOM suites for the hydrated layer (`tests/dom/forms-busyform.test.tsx`, `tests/dom/waitlist-joins.test.tsx`, `tests/dom/account-flows.test.tsx` — read as code and green in verify; component fidelity: real components, real error mapping, real fixture data; the Vike router and real CSS painting are the unproven links, §8); plus a desk cognitive walkthrough of the sign-in seam from the component source.

**Flow 1 — "Tell the directory a listing is wrong."** The report form is present in the first HTML with named fields; a filled submission either lands a success state or returns with every value still in place and a plain-language, field-named error — the visitor edits, never retypes. The one friction is structural, not a defect: without JavaScript the human check cannot pass, so a no-JS visitor's report is refused with values preserved (§6(b)) — the same posture v2 ships and the audit's §5.2 Turnstile row requires. **No finding.**

**Flow 2 — "List my farm."** The state hub's prefill survives into the SSR form (`?state=ks` selected, case-insensitive); the 16-field payload arrives intact; rejection preserves. The form is long, but it is v2's field set ported faithfully, single-column, with the error summary pattern. **No finding.**

**Flow 3 — "Get alerted when Lonely Bloom is back."** The zero-seller page's block offers a native form; the no-JS path joins, then asks for the emailed code *on the same page* (the redirect lands on the block itself, fragment-anchored — no hunting), then states the active channels. The held case states the hold instead of claiming an alert (the floor's `held=1` state + the panel's Held badge with reasons). **No finding** beyond the carried N4.

**Flow 4 — "Sign in without a phone on file."** Cognitive walkthrough of `SignInForm`: the seam is a plain button beside Sign in (never a submit, so native phone-required validation can't trap it), with a muted explainer line under the form ("No phone number on your account? Emailing a code signs you in without one."); the code state headings itself ("Check your email for a code"), names the address the code went to, takes focus, and offers a way back. A wrong email+phone pair yields the pair-neutral form message (never "that email has no account") with focus moved to the summary. This is the §11.1 accommodation working as ruled. **No finding.**

**Flow 5 — "Stop these alerts."** The email link lands on a page that names the exact variety and asks for one click; nothing changes until the click; a tampered link gets a plain invalid-link state with a path to /account. No dead end. **No finding.**

**Findings summary:** 0 usability findings at Nielsen ≥ 1 in this pass (N4 is the carried Slice 3 note, Nielsen 1). Boundaries in §8.

## 6. Rulings

**(a) /go/ removed-seller 410 vs the brief's "unknown/removed id → 404" — CONFORMANT, build correct.** The brief's Step-1 shorthand says unknown/removed → 404; Bea §7.1 + §1.7 (the governing audit) and v2's shipped route both split it: removed *listing* → 404, removed *seller* → 410. The build implements the split, its fixtures name it explicitly, and my drive observed both (2 → 404, 5 → 410, neither ever a redirect). The load-bearing requirement — never a redirect for a dead id — holds on every dead-id class. No defect; the shorthand is the coordinator's to align in future briefs.

**(b) Report/farm no-JS floor cannot complete (Turnstile) — CONFORMANT, by the ruling's own scope.** Dustin's §11.4 ruling exempts **only** "the form-encoded no-JS create-and-join endpoint" (the waitlist join-form); Turnstile "remains required on the JavaScript path exactly as today", and audit §5.1/§5.2 keep Turnstile on the report/farm surfaces. The port's floor POSTs for report/farm therefore relay to the token-requiring backend and a tokenless no-JS submission is refused with values preserved + the human-check error — while the waitlist floor, the one endpoint the exemption names, completes with no token (§2). The gate brief's emphasis phrasing ("the floor forms render and submit through the §11.4-exempt endpoint") reads broader than the ruling; the ruling governs. If a no-JS-completable report/farm path is ever wanted, it needs its own ruling, not a repair to this slice.

**(c) Unsubscribe GET-does-not-flip — CONFORMANT.** Audit §6.2 is explicit: "a GET never changes anything (mail-scanner safety)". The flip happens on the confirm click / RFC 8058 one-click POST, both proven in §2 (tampered POST refused 400 with zero state change). The brief's Step-1 line ("valid signed token → 200 confirmation state, the subscription actually flips") is satisfied across the two steps it names.

## 7. Findings (all notes; nothing returns to the maker)

- **N1 — Minor (accounting / evidence, recurring — now chronic).** The Step-1 starting-red statement is not filed: the PR body is the workflow's auto-generated stub with no builder summary, and no summary exists in the tree. Evidence: PR body read + tree search — directly observed absence. Slice 6's brief escalated this to a binding cure ("must be stated verbatim in your final summary's accounting; a summary without it is incomplete") after Slices 4 and 5 filed the same omission as N1 — the escalation changed the brief text but not the workflow that produces the PR body, so the summary has nowhere to land. Per Juran's distinction this is a **chronic** process defect, not a sporadic one: the remedy is in the workflow (a summary artifact the run must emit, or the coordinator appending the builder's accounting to the PR body pre-gate, as was done by hand for PR #58), not another brief sentence. The property the red proves is independently established at this gate (§4, §2). **Carry, program-level, third filing:** fix the *mechanism* before Slice 7's dispatch.
- **N2 — Minor (PR-body accuracy).** The auto-generated body states "Gate: `npm run verify` in `v2/` passed" while printing the **app** suite's figures (51 files / 664 tests — my reproduced app counts exactly; v2's suite is a different, larger census). The numbers are true; the label is wrong, and a reader reconciling from the body alone would look for this slice's evidence in the wrong tree. Same workflow-mechanism family as N1. Evidence: PR body read against my §1 runs — directly observed.
- **N3 — Trivial (program artifact, recurring since Slice 3).** No standalone `structured-data-inventory.md` exists in the tree. Slice 6's new templates emit no JSON-LD beyond the shell's carried inventory (account/utility surfaces are noindex utilities; the diff was performed at this gate from emitted HTML + the guard suite), which serves as the record for these templates.
- **N4 — Minor usability (Nielsen 1, carried from Slice 3's U1).** The waitlist block's email requiredness is still only in markup, nothing visible distinguishing required email from optional phone before submit. V2-faithful; note only, for Wren's copy pass if the block is touched.

**Code review (diff read in context):** 73 files under `app/` (+8,325/−71). Design sound: one shared form chassis (`form-posts.ts` builders) feeds both the floor POSTs and the enhanced submits, so payload parity is by construction, and my drives confirmed it behaviorally on both wires; the relay (`api-relay.ts`) forwards an allowlist of headers only (no Origin — the backend's same-origin check sees a server call), passes Set-Cookie through, and maps /go statuses without ever inventing a redirect (backend fault → 502, loudly); the /go UTM rename touches only the retired value and never a seller's own `utm_source`. The unsubscribe page's +data consumes a new internal describe mount (`/api/internal/unsubscribe/describe`) that the real backend does not have yet — the same disclosed pattern as Slice 3's variety-status mount: it fails toward the invalid-link state, the tree is inert, and it joins the Slice 9 mount list (carry C2). No strictness weakening observed in the files read (route handlers, form chassis, error mappers, Turnstile component); no secrets in code.

## 8. Coverage ledger

- **Population:** the Slice 6 surface — `/report` (floor + JSON, accept/reject/no-token), `/add-your-farm` (prefill cases, floor + rejection), the Turnstile posture split (exempt join-form vs required everywhere else, incl. the rate-limit abuse floor), `/account` (signed-out shell, pair sign-in, §11.1 seam, alerts Found/Waiting/Held, sign-out, session persistence), the waitlist end-to-end U1 paths (signed-in, signed-out create-then-join, recognized contact), `/unsubscribe` (GET valid/tampered, POST valid/tampered), `/go/[id]` (active, own-query, own-UTM, unknown, unpublished, removed listing, removed seller, non-numeric), head exclusivity + price guard on every new SSR template, §9 cache posture on the form/account surfaces.
- **Structured sample:** all of the above, exercised by the shipped suite (664 tests, incl. the 41-test HTTP suite and the three DOM suites), my independent HTTP suite (21 tests, own values/scanners), and 3 reviewer mutations — every stratum exercised at least twice by independent code, except Held (shipped DOM suite + code read) and session-persistence-across-route-change (shipped DOM suite only), both named here.
- **Adversarial additions:** lowercase `?state=ks` prefill; a seller target_ref typed in mixed case (lowercasing map); a tokenless report POST; a rate-limited join-form POST; tampered unsubscribe token on both GET and POST; a seller's own `utm_source` (must survive); non-numeric and unpublished /go ids; field-drop, floor-action, and 301 mutations.
- **Exclusions, with reasons:** a real-browser (Chromium) drive of the hydrated account/form layer — no live-browser session is available to this gate; hydrated behavior is proven at jsdom level by the shipped DOM suites (green in verify) plus my HTTP wire-level drives of every endpoint those components consume. The entered→constructed link *inside a real browser* for the enhanced (JS) path therefore rests on jsdom fidelity, and the verdict's notes carry that boundary rather than rounding it up. The production Worker's mounts (the app relay, the floor POST handlers, and the internal unsubscribe-describe endpoint are Slice 9 mounts — the harness's `serve.ts` is the proven layer, as at prior slices). Live production data and the real Turnstile service (the stub's token-presence check is the proven link; Siteverify itself is the unchanged backend's). The builder's Step-1 red (N1).
- **Evaluator structure:** single evaluator (Quinn), no second rater commissioned for this gate; there are no usability findings ≥ Nielsen 1 to rate, so no severity disagreements exist to surface.
- **Residual risk:** defects that appear only in a real browser's form construction / router behavior on the enhanced path, only against production-shaped account data (e.g. accounts with many waitlist entries, zones/names beyond the two fixtures), or only in the production Worker's relay mounts could still escape this coverage. The Slice 9 cutover gate — with the mounts live and a real-browser drive owed — is the control for that class.

## 9. Return conditions + carries for Slice 7

Nothing returns to the maker. The slice may proceed to merge on this verdict, with the Slice 3 U1 carry recorded as **discharged** (§3) and N1–N4 tracked as notes.

Carries for Slice 7 / the program:
- **C1 (from N1/N2, program-level, third filing):** give the builder summary a mechanism — a run-emitted accounting artifact or a coordinator PR-body append — so Slice 7's gate receives the starting-red statement and a correctly labeled verify figure without relying on brief text alone.
- **C2 (Slice 9 mount list, addition):** `/api/internal/unsubscribe/describe` joins `/api/internal/variety-status/[slug]` as a hard pre-cutover mount; the cutover checklist must name both.
- **C3 (from §8):** the real-browser drive of the enhanced form/account flows (real form construction, client-side route change with a live session) is owed at the first gate where a browser session exists — latest at the Slice 9 cutover gate.

— Quinn Assurance, 2026-11-24
