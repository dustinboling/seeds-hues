# QUINN GATE — SPA Slice 7: Admin SPA (Seed Directory SPA conversion)

- **Subject:** PR #80, github.com/dustinboling/seeds-hues — "Slice 7 — Admin SPA (Seed Directory SPA conversion)", branch `muse/45557112321`, head `ebb5c37`
- **Reviewer:** Quinn Assurance (independent; did not make this work). Single-evaluator gate (see Coverage ledger).
- **Worktree:** `~/workspace/seeds-hues-gate-s7-wt` at the PR head, as supplied. No fetch/checkout elsewhere; all work on disk inside that worktree.
- **Contract, in order:** (1) build brief `muse-tasks/spa-slice-7-admin-spa.md`; (2) `spa-conversion-2026-11-23/ROUTE-INVENTORY.md` admin table + `ADMIN-SECTION.md` (the admin commissioning record, incl. the v2 Slice A–D ship records and Dustin's standing duplicate-hold ruling); (3) `QUINN-GATE-spa-slice-6.md` carries C1 (builder accounting mechanism), C2 (Slice 9 mount list), C3 (real-browser boundary). All read before testing.
- **Date:** 2026-11-24 (America/Los_Angeles)

## VERDICT: PASS WITH NOTES

No Blocker, Critical, or Major defect found. The build-integrity question this PR carried — a first builder turn that paused mid-build, finished by in-job repair turns — is answered directly: from a clean `npm ci` in this worktree the shipped tree builds clean and verifies green twice at exactly the accounted counts (§1). The C1 accounting mechanism **worked for the first time**: the coordinator-appended accounting is present in the PR body, arithmetically accurate, and correctly labeled — **C1 is DISCHARGED** (§2). Every gate-emphasis item was exercised: my own independent built-artifact drive passed **15/15** with my own typed values, my own note marker, and my own hand-computed statistics (§3); the `/admin/waitlist` 404 claim is verified against the v2 tree on main — it is a faithful port of a deliberate retirement, not a defect (§4); and all three mutation spot-proofs were noticed by the shipped suite (§5). The notes are Minor/Trivial (§7). One declared boundary, unchanged from Slices 3–6: no real-browser session is available to this gate, so the hydrated admin layer is proven at jsdom + HTTP-wire fidelity, not in Chromium (§8, carry C3 continues). Severity, evidence, coverage, and verdict are kept on separate axes throughout.

---

## 1. Verify chains + build integrity (executed by me)

| Chain | Result | Evidence |
|---|---|---|
| app `npm ci` (clean, in the gate worktree) | exit 0 | directly observed |
| app `npm run build` + `build:server` from that clean install | **exit 0** — vike build, SW emitted, PWA proof passed, `dist-server/serve.mjs` produced | directly observed |
| app `npm run verify` (lint + typecheck + test) — first run | **exit 0 — 56 test files, 831 tests, all passed** | directly observed |
| Slice 7 suites within it | `tests/build/slice7-admin.test.ts` 51 tests; `tests/dom/admin-busyform.test.tsx`; `tests/dom/admin-surfaces.test.tsx`; `tests/unit/admin-lib.test.ts`; `tests/unit/admin-stub.test.ts` — all green | directly observed |
| Final confirmation `npm run verify` after all mutations restored and my gate suite deleted | **exit 0** (56 workers); `git status` clean, tree byte-identical to the PR head `ebb5c37` | directly observed |

Builder accounting checks:
- **Final green — CONFIRMED as reproduced: 56 files / 831 tests.** Against Slice 6's gate-confirmed 664 / 51, this slice adds 167 tests across 5 files. The PR body's gate-step figure matches my reproduction exactly.
- **Diff scope — CONFIRMED:** 109 files, +12,509/−13 against the Slice 6 merge, all under `app/` plus the task file; `v2/` untouched, no `.github/workflows/*`, no deploy config. The v2 verify chain was therefore not re-run (identical tree to Slice 6's gate, where the diff-scope rule was established).

## 2. C1 accounting grade — DISCHARGED

Slice 6's carry C1 demanded a *mechanism* for the builder's accounting, after three consecutive slices filed the starting-red statement as missing. The mechanism shipped in this PR's body, and I grade it on the three properties the carry named:

- **Present — YES.** The PR body carries a "Coordinator-appended builder accounting (C1 mechanism, from Quinn's Slice 6 carry)" section, explicitly labeled as extracted verbatim from workflow run 45557112321's run log, with the provenance stated honestly: the builder's first turn paused mid-build and the in-job repair turns completed the build. That provenance disclosure is exactly right — it does not dress a repaired build up as a single clean run.
- **Accurate — YES, on every checkable figure.** Starting-red: "4 files / 126 tests — 3 passed, 123 red (unit 0/29, BusyForm DOM 0/24, surfaces DOM 0/22, HTTP build 3/51 with 48 failing on missing routes)" — the per-file counts sum to 126, the passes sum to 3, and the HTTP file's 51 matches the shipped suite's test count I observed under mutation runs. Final green: 56 files / 831 tests — my own reproduction, exactly (§1).
- **Correctly labeled — YES.** The section states plainly that the 56/831 figures are the **app/** suite's numbers and names the workflow's "verify in v2/" line as the standing mislabel (Slice 6's N2) rather than repeating it. The auto-generated header still carries that mislabel (see N1), but the accounting section itself — the part a reader reconciles from — is labeled correctly.

**C1 is discharged.** The chronic process defect from Slices 4–6 is closed by a mechanism, as the carry required, not by another brief sentence. One residual: the workflow header's own mislabel persists above the correction (N1, Minor) — the fix belongs to the workflow template, and the appended correction currently neutralizes it.

## 3. My independent drive of the built artifact (15 tests, all passed)

I wrote my own contract suite (own harness copy, own cookie jar, own typed values and scanners, expectations from the brief/ADMIN-SECTION/v2 behavior — not the builder's assertions), built the app against the test stub, served it through the shipped harness, drove it over plain HTTP, then deleted the suite. **Result: 15/15 passed, first run, no corrections needed.**

My typed values were my own: note body `QG-991 probe note — double  spaces kept`, a BusyForm payload `QG typed  value — with  gaps & symbols <ok>`, and statistics expectations I computed by hand from the fixture definitions before reading the builder's assertions.

### Role drives at the API level (emphasis 1)
- **Reviewer — duplicate hold:** POST `/admin/review/decide` `mark_duplicate` on hold 103 → 200; the hold is `merged` and the held name "King's Ransom Select" is an alternate name on the existing variety (the standing duplicate ruling).
- **Reviewer — structured correction:** `apply_correction` on item 102 → 200; the fix is live immediately in the admin read **and** in the public seller payload (Prairie Seed House location → "Eudora, KS").
- **Reviewer — internal note:** `add_note` with my QG-991 body → 200, present in the admin seller read.
- **Reviewer — refused, API level, no state change:** `variety_remove` → **403**, variety's `deletedAt` still null; `role_save` (visitor → admin) → **403**, role unchanged.
- **Full admin — variety-remove:** on King's Ransom (3 live listings) → **409 naming "3 live listings"**, no state change; on Lonely Bloom (listing-free) → 200 soft removal, and the public variety page then answers **404**. **Listing retire idempotent:** second retire → 200 with the listing's history length unchanged.

### Internal notes never public (emphasis 2)
After adding my own note to Prairie Seed House as the reviewer, I grepped for my note text **and** both fixture note markers across: the public seller API payloads for both noted sellers, the public variety API payload, and — beyond the shipped suite's coverage — the **public seller HTML pages** `/seller/prairie-seed-house` and `/seller/blue-ridge-seeds`. Absent everywhere public. Present in the admin seller read for **both** roles.

### Auth spine (emphasis 3)
- Signed-out GETs of `/admin`, `/admin/review`, `/admin/sellers`, `/admin/statistics`, `/admin/accounts` never return admin data (no note marker anywhere) and redirect to sign-in where they redirect; the internal admin APIs (`sellers`, `statistics/overview`, `accounts`) refuse both signed-out and visitor sessions with no data in the body.
- **Full sign-in drive (form wire, my own jar):** request code for the reviewer fixture → stub issued `222222` → verify → 303 to `/admin` with the session cookie → hub 200. **Sign-out revokes:** after sign-out, `/admin` answers 303 to sign-in with the same jar.
- **No idle timeout:** the aged session fixture (created 6.5 days before the stub's clock, inside its absolute 7-day lifetime) opens `/admin` and the internal sellers read at 200 — Dustin's deliberate ruling holds; the expired fixture is refused (shipped suite + code read).

### Statistics (emphasis 5) — hand-computed before checking
From the fixture definitions I computed: views Candy Stripe 120 / King's Ransom 90 / Lonely Bloom 60; clicks Lonely Bloom 40 / Candy Stripe 25 / King's Ransom **10** (its 50 bot clicks excluded — never 60); waitlist Lonely Bloom 7 / Mystery Bloom 5 / King's Ransom 2, identical at ranges 7d/30d/12w; searches cosmos 30 / ransom 12 / "lonely blum" 4 with the fruitless term `xyz-no-match` 5. The served rankings match on every signal, and the overview Visitors card carries v2's dark shape (`key: "visitors"`, `total: null`, the not-connected explanation). My own scan of the statistics shell found **no manual analytics beacon** (`cloudflareinsights` / `beacon.min.js` absent), and a source grep confirms no beacon was added anywhere in the admin code.

### BusyForm + prices (emphasis 6)
- My typed note body arrived at the stub **verbatim** (double spaces and symbols intact) in the stub's received-payload log; with the stub tripped to reject, the same POST → 422, the payload still recorded verbatim server-side, and **no note was written** — the entered→constructed→received chain is compared link by link, and the client-side preservation half is pinned by the shipped BusyForm DOM suite (§6).
- **Prices:** my own scan ($-amount pattern + the fixture price markers `$4.95` / `$3.50` / `priceCents`) across eight admin shells (both roles) and four admin JSON reads found **zero** occurrences — including the listing reads, where the fixture deliberately carries prices in source data.

## 4. /admin/waitlist — the 404 claim VERIFIED against v2 (emphasis 4)

The builder pins `/admin/waitlist` as a deliberate 404, "retired in v2 Slice D". I verified the claim against the v2 tree on main rather than trusting it: `v2/app/admin/` contains **no waitlist route** (the directory holds sign-in, no-access, and the (protected) sections only), and `ADMIN-SECTION.md`'s Slice D ship record states the legacy `/admin/waitlist` page + action were deleted in that slice, both routes answering 404 in production, with the key-API `GET /api/v1/admin/waitlist` deliberately untouched. The SPA's 404 (confirmed for both roles in my drive) is a **faithful port of a deliberate retirement — not a defect**. The route inventory's "/admin/waitlist — SPA" row is the stale document here (it predates the v2 retirement); the build is right against the live tree, which is the brief's governing standard ("a PORT of the live v2/ admin as it stands on main today"). Recorded as N2 so the inventory can be aligned.

## 5. Mutation spot-proofs (suite sensitivity — each applied, run, restored byte-identical)

| # | Mutation | Outcome |
|---|---|---|
| M1 | Leak an internal note into the public payload (`fake-catalog.ts`: public Blue Ridge detail gains `internalNotes: "NOTE-BLUERIDGE-7A"`) | **NOTICED** — 1 test failed (shipped notes-leak test), 50 passed |
| M2 | Reviewer gains variety-remove (stub varieties/actions gate `gateAdmin` → `gate`) | **NOTICED** — 1 test failed (reviewer-refusal test), 50 passed |
| M3 | Duplicate hold becomes decidable via the key API (stub's `duplicate_hold_ui_only` refusal disabled) | **NOTICED** — 1 test failed (key-API refusal test), 50 passed |

All three mutations were caught. Tree restored after each (backups byte-copied back and `cmp`-verified; final `git status` clean and final full verify green, §1).

## 6. Usability drive (admin goals)

Evaluator structure: single evaluator (Quinn); Nielsen 0–4 for usability items. Modes: JS-disabled raw HTML + HTTP wire at full fidelity (§3) for the server-enforced layer; the shipped jsdom DOM suites for the hydrated layer (`tests/dom/admin-surfaces.test.tsx`, `tests/dom/admin-busyform.test.tsx` — read as code and green in verify; real components, real fixture data; the Vike router, real CSS painting, and a real browser's form construction are the unproven links, §8); a desk cognitive walkthrough of the decide/duplicate and sign-in components from source; and a code-level iPad render check (below).

**Flow 1 — "Decide whether this held name is a duplicate."** The C4 duplicate choice is the project's own exemplar of the consequence standard, ported faithfully: two equal-weight buttons ("It's a duplicate" / "Not a duplicate"), each expanding its consequence **inline, never a modal** — the duplicate panel states in plain words that the held name stays as another name for the existing variety, still turns up in search, its listings move, and the scout won't re-propose it — *before* the confirm button ("Confirm: mark as duplicate", verb-labelled, not Yes/No). **No finding.**

**Flow 2 — "Work the queue as a reviewer; hit a wall that isn't yours."** Role refusals explain themselves: the stub's refusal copy names the limit in the user's terms ("Your reviewer role doesn't include that action." / "…doesn't include account settings.") rather than a bare 403 — and the accounts surface renders a reviewer landing ("Account settings"), never data and never a silent no-op. Decisions confirm in place via status redirects (`status=duplicate_kept`, `status=correction_applied`). **No finding.**

**Flow 3 — "Sign in, come back days later, sign out."** The form-wire drive (§3) lands on the hub; the code step names the address and the code's lifetime; the aged session still works at 6.5 days (the deliberate no-idle-timeout ruling, so "come back later" never strands the operator mid-queue); sign-out actually revokes server-side. **No finding.**

**Flow 4 — iPad render check (emphasis 7).** No real browser is available to this gate, so the check is at the two fidelities that exist: (a) the shipped DOM suite's viewport evidence — `viewportBand` boundaries asserted at 390/743/744/1024/1180/1181/1440 (1180px belongs to the iPad band, desktop from 1181, per v2 §4) and the AdminShell rendered at 1024×768 and 1180×820 showing the section rail with the review badge, not the phone tab bar; (b) my own code read — the SSR default width is the iPad band (1024, the primary surface) with client correction on mount, and `admin.css` carries its layout breakpoints at exactly `min-width: 744px` and `min-width: 1181px`, so queues/tables take the master–detail layout across the whole iPad band with no phone collapse. A rendered-pixel check on a real iPad remains Dustin's proof / the cutover gate's, as at every prior slice. **No finding.**

**Findings summary:** 0 usability findings at Nielsen ≥ 1 in this pass. Boundaries in §8.

## 7. Findings (all notes; nothing returns to the maker)

- **N1 — Minor (PR-body accuracy, residual of the discharged C1).** The auto-generated PR header still states "Gate: `npm run verify` in `v2/` passed" above the accounting section that corrects it. The correction is present and prominent, so no reader who reaches the accounting is misled; the wart is now cosmetic rather than evidentiary. Same workflow-template fix as Slice 6's N2 — one line in the workflow's PR-body template ends the recurrence. Evidence: PR body read against §1/§2 — directly observed.
- **N2 — Trivial (program document staleness).** `ROUTE-INVENTORY.md`'s admin table still lists `/admin/waitlist` as an SPA surface to port; v2 retired it in Slice D and the build correctly ships a 404 (§4). The inventory row should be annotated "retired in v2 Slice D — port as 404" so Slice 8/9 briefs don't re-litigate it.
- **N3 — Trivial (program artifact, recurring since Slice 3).** No standalone `structured-data-inventory.md` exists in the tree. Slice 7's admin templates are noindex app surfaces emitting no JSON-LD beyond the shell's carried inventory; the diff was performed at this gate from emitted HTML + the price/head scans, which serves as the record for these templates.

**Code review (diff read in context):** 109 files under `app/` (+12,509/−13). Design sound: one handler layer (`admin-handlers.ts`) forwards to the internal admin mounts with the session cookie and an Origin check on every POST (mismatched Origin → 403, shipped suite); the admin BusyForm's own comment carries the founding lesson verbatim and its fieldset is never disabled — only the submit button takes the busy state; role enforcement lives in the backend-facing layer the handlers delegate to, and my API-level drives (§3) plus M2 confirm it is not UI-deep. The relay allowlist gains `x-admin-key` (for the key-API refusal proof) — scoped to the admin relay paths and disclosed in the accounting. No strictness weakening observed in the files read (auth, handlers, decide forms, statistics lib); no secrets in code.

## 8. Coverage ledger

- **Population:** the Slice 7 surface — the auth spine (signed-out / visitor / reviewer / admin / aged / expired sessions × every `/admin/*` surface and internal admin API), the sign-in flow (form + JSON wires, wrong code, visitor-code → no-access), the review queue (listing match publish, structured correction, duplicate hold via decideDuplicate only + both non-UI paths refused, false-queue dismissal, removal apply + reviewer pre-effect refusal, seller candidate, skip), sellers (records, CS contacts, multi-location, eligibility/Small-farm states, internal notes read/add both roles), varieties + listings (remove blocked/allowed/idempotent-soft, alias paths, listing retire/restore/idempotency), accounts (role display/save + self-change and farm grant/revoke guardrails, reviewer landing), statistics (four signals' rankings + movement, Visitors card shape, range behavior), `/admin/waitlist` (404), `/admin/more`, BusyForm payload parity on every admin action family, the price guard on every admin shell + JSON read, and the iPad viewport bands.
- **Structured sample:** all of the above, exercised by the shipped suite (831 tests, incl. the 51-test HTTP suite and the two admin DOM suites), my independent HTTP suite (15 tests, own values/markers/hand-computed stats), and 3 reviewer mutations — every stratum exercised at least twice by independent code, except the hydrated client-router behavior and real-browser form construction (shipped DOM suites only), both named here.
- **Adversarial additions:** my own note text grepped across public **HTML pages** as well as API payloads (beyond the shipped suite); a reviewer attempting promotion to *admin* (not just reviewer) via role_save; bot-inflated clicks (served 10, never 60); waitlist rankings probed at three ranges; a BusyForm payload with double spaces and symbols; sign-out followed by a hub fetch with the same jar; mismatched-Origin POSTs (shipped suite).
- **Exclusions, with reasons:** a real-browser (Chromium) drive of the hydrated admin layer — no live-browser session is available to this gate (carry C3, §9); admin behavior is proven at jsdom level by the shipped DOM suites (green in verify) plus my HTTP wire-level drives of every handler those components consume. The production Worker's mounts (the app relay, the admin handlers, and the `/api/internal/admin/*` mounts are Slice 9 mounts — the harness's `serve.ts` is the proven layer, as at prior slices). Live production data and the real code-delivery mail path (the stub's code issuance is the proven link; delivery is the unchanged backend's, live since 2026-11-21). A rendered-pixel iPad check (§6, Flow 4 states the two fidelities actually used).
- **Evaluator structure:** single evaluator (Quinn), no second rater commissioned for this gate; there are no usability findings ≥ Nielsen 1 to rate, so no severity disagreements exist to surface.
- **Residual risk:** defects that appear only in a real browser's form construction / client routing on the enhanced admin path, only against production-shaped admin data (queues far larger than the fixtures, sellers with many notes/locations), or only in the production Worker's relay mounts could still escape this coverage. The Slice 9 cutover gate — with the mounts live and a real-browser drive owed — is the control for that class.

## 9. Return conditions + carries for Slice 8

Nothing returns to the maker. The slice may proceed to merge on this verdict, with carry C1 recorded as **discharged** (§2).

Carries for Slice 8 / the program:
- **C2 (Slice 9 mount list, extension — as the coordinator directed):** `/api/internal/admin/*` joins `/api/internal/variety-status/[slug]` and `/api/internal/unsubscribe/describe` as hard pre-cutover mounts; the cutover checklist must name all three families. The builder's accounting already records this addition.
- **C3 (from §8, continuing):** the real-browser drive of the enhanced flows — now including the admin surfaces (real form construction in the decide/note/role forms, client-side navigation with a live admin session, a rendered iPad check) — is owed at the first gate where a browser session exists, latest at the Slice 9 cutover gate.
- **C4 (new, forward-looking — not a finding against this slice):** Dustin's 2026-11-25 standing rule makes Tailwind Plus (Application UI + Catalyst, on latest Tailwind mapped onto the @hues tokens) the standard kit for all admin areas going forward. This slice was built 2026-11-24 under a brief that predates the rule, and the rule is explicitly not a retroactive rebuild order — so it does not gate Slice 7. Slice 8/9 briefs and any admin rebuild should state how the rule applies to the converted admin surfaces so the decision is Dustin's, recorded, rather than ambient.

— Quinn Assurance, 2026-11-24
