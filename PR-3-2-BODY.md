# Tranche 3, Item 3.2 — Waitlist flip (alert first, account in place) + no-JS fallback

## Provenance

- Brief: Tranche 3, Item 3.2 build brief (this run).
- Normative: `backlog-2026-11-21/tranche-3/SPEC.md` §3 (whole item) + §8 checks
  3.2-A…3.2-G (this build's gates). §4 behavior contract governs every form touched;
  Item 3.3's field-state set is consumed as shipped, never forked.
- Rulings: Dustin P2 (the flip itself, 2026-11-20); SPEC §11.1 RULED (a) —
  "Email me a code instead" at `/account` sign-in for phone-less accounts (IN scope);
  SPEC §11.4 RULED (a) — the no-JS form-encoded endpoint is Turnstile-exempt with
  §3.4.5's compensating controls (DECISIONS.md §§3–4).
- Ada Ruling 9 (`ADA-RULINGS-3-3.md`): redirect-back URLs carry the waitlist block's
  fragment on failed AND successful plain-POST submissions; floor errors render the
  enhanced error dialect (carried by check 3.2-G).
- `FIELD-STATES-DESIGN.md` §8.6: the set's application to this block, incl. CodeEntry's
  shipped A4 fix — consumed, not reimplemented.
- Quinn design gate: FAIL (scoped) → A-1…A-7 → delta re-gate PASS (`QA-GATE-design.md`).
  Built as written; no redesign. No design defect was found mid-build.

## Per-state disposition (every §3.2 state + §3.4 floor state)

| # | State | Disposition |
|---|---|---|
| §3.2.1 | Alert step (email + channel radios + conditional phone; no name/ZIP/type) | LANDED. `WaitlistBlock.tsx` rebuilt; `SignupFields` no longer consumed there and untouched (§3.6). |
| §3.2.2 | Text reveals phone (required for that channel; focus never moves; hide on switch-back, phone not submitted) | LANDED. Conditional render + shared channel state; consent + sign-in explanation beside the choice; the choice is the opt-in, no checkbox. |
| §3.2.3 | Minimal create in place (email; phone iff text; name unset, zone null, gardener default) + success machinery States A–D, hold, focus, leave | LANDED. Success copy/focus/leave byte-identical; `""` sentinel never rendered as a value. |
| §3.2.4 | Recognized contact → inline code state, session at verify, join completes same step; "Sign in, then come back" deleted | LANDED. In-place transition with §3.2.4 copy + shared `CodeEntry` (new unauthenticated mode, no fork). |
| §3.2.5 | Finish-your-account step (optional, dismissible; name/ZIP/type; never re-asks contact) in block + equivalently in `AccountPanel` | LANDED via one shared `FinishProfileFields` component so both homes are field-identical. |
| §3.2.6 | Signed-in path unchanged | LANDED (untouched: one-click join, states, leave). |
| §3.4.1 | Server-rendered floor (real form; phone visible, labeled text-only, never `required`; skeleton deleted) | LANDED. The block's pre-fetch render IS the floor; "Loading waiting-list status…" appears nowhere in any server document. |
| §3.4.2 | Plain POST join → redirect-back with verify / recognized / active / error states; plain code form | LANDED. All four states server-render; no join state is JS-only. |
| §3.4.3 | Enhancement replaces floor only after status fetch resolves; failed fetch keeps floor + brief note | LANDED. Floor stays visible during fetch (no skeleton flash); signed-in floor submitters join directly. |
| §3.4.4 | Listing-state gate server-side (block only on zero-seller pages) | LANDED (pre-existing `v.listings.length === 0` gate kept; floor inherits it). |
| §3.4.5 | Turnstile disposition (a) | LANDED — see footprint below. |
| §11.1 | "Email me a code instead" at `/account` sign-in for phone-less accounts | LANDED in `SignInForm.tsx`; create form untouched (3.2-F scope guard). |
| Ruling 9 | Fragment on failed + successful redirect-backs; error state in initial viewport | LANDED. Every floor redirect ends `#waitlist-block`; floor errors use the enhanced dialect (ids, describedby, summary for multiples). |

No §3.2/§3.4 state is unlanded. Partial-build reporting does not apply.

## Service-contract changes (enumerated)

1. **Schema relaxation — join_variety-scoped (not general).** `CreateAccountSchema` keeps
   name/phone/ZIP required for the plain `/account` create (identical 400/409 behavior —
   the 3.2-F scope guard holds by construction) and requires only email (+ phone iff
   `sms_opt_in`) when `join_variety` is present. Blanks preprocess to absent. Provided
   name/ZIP on the join path are still validated and stored (older clients keep working).
   No `users` migration: `name`/`phone` `""` defaults + nullable `zip`/`usda_zone` already
   express the minimal account; `alert_phone` is NULL (not `""`) when there is no number.
2. **Code-issue rate limits.** Recognized-contact issue, recognized resend, sign-in-code
   issue, and both floor issue paths all run under the verification service's default
   limits (1/min, 5/hr per user+channel). `enforceLimits: false` appears ONLY on the
   create path's own first issues (the pre-existing precedent, kept) — explicitly never
   on any unauthenticated issue path. The recognized resend additionally requires the
   pending row, so it is indirectly gated by the Turnstile-protected join submit that is
   the only way to create one.
3. **Pending-join representation: new `waitlist_pending_joins` table** (migration `0016`,
   `user_id` PK → one row per user mirroring the one-live-code rule; `variety_id` plain
   integer per the no-FK catalog convention; `phone` nullable; `sms_opt_in`; added to
   `PRIVATE_ACCOUNT_TABLES` + cascade delete). Recorded at recognized issue, consumed when
   verification establishes the session and completes the join in the same step. The
   submitter's channel/phone choice rides along and is applied at verify time (a newly set
   number stays unverified — an email code proves nothing about a phone).
4. **New endpoints (all JSON unless noted):** `POST /api/v1/account` recognized branch
   (200 `{recognized,email,delivery}`, no session); `POST …/waitlist/verify`, `POST
   …/waitlist/code` (unauthenticated, code-attempt-limited, no Turnstile — codes are
   self-authenticating as on the sessioned verify paths); `POST …/account/profile`
   (authed; blanks are no-ops); `POST …/sign-in/code` (Turnstile-required) + `POST
   …/sign-in/verify` (establishes session, stamps email verified — the code proves it).
5. **Floor plumbing:** `lib/waitlist-floor.ts` (redirect vocabulary + parser, pure);
   `write-route.ts` parses `application/x-www-form-urlencoded` and answers `WriteOk.redirect`
   as 303 (JSON path untouched); middleware rewrites `?waitlist=*` to the dynamic internal
   `/variety/[slug]/waitlist` route (same pattern as `small-farms`; canonical page stays
   ISR; floor URLs noindexed).

## Turnstile exemption — exact footprint

- EXEMPT: `POST /api/v1/account/waitlist/join-form` ONLY (§11.4(a)). Compensating
  controls exactly as §3.4.5: (i) the verification hold is untouched — the floor create
  issues the email code and alerts stay held until it is entered (integration-pinned);
  (ii) the route carries the same `public` rate-limit bucket (120/min/IP) as the create
  path, and recognized issuance on it runs under the verification limits; (iii) Turnstile
  stays required on the JavaScript path exactly as today (create/join, pair sign-in,
  sign-in-code issue — all 403 without a token, pinned by tests old and new).
- NOT exempt (never had Turnstile): `…/waitlist/verify-form` and the JSON
  `…/waitlist/verify` — code verification never used Turnstile; the 6-digit code plus
  attempt limits (5 wrong kills it) is the credential, identical to the sessioned paths.
- Flood behavior: a bucket-429 on a form endpoint stays a bare 429 (the standard signal
  with Retry-After), like every other endpoint; all *validation* failures redirect back
  to the floor and never strand.

## T-C — payload and route changes (no price anywhere)

- `GET …/waitlist` signed-in `user` gains `profile_complete: boolean` (sole status
  payload change). `POST /api/v1/account` gains the recognized 200 shape (no session
  cookie). New routes/payloads: `profile`, `waitlist/code`, `waitlist/verify`,
  `sign-in/code`, `sign-in/verify`, `waitlist/join-form`, `waitlist/verify-form` (303s).
- No new payload carries a price field; no new string names a price. The price guardrail
  suite passes unchanged.

## New strings (flagged, not invented silently)

Spec-verbatim (straight apostrophes as in SPEC.md): §3.2.4 recognized copy; §3.2.5 finish
copy; §3.4.2 verify copy; "How should we tell you?"; "Email only"; "Email and text";
"Email me a code instead". Existing-verbatim (curly, byte-identical): heading, one-alert
copy, States A–D, `SMS_CONSENT`, phone hint line. Derived/new (flagged here): consent
"the phone number **below**" ("above" is wrong in the new layout); floor phone label
"Phone number (only needed for text alerts)"; headings "Check your email for a code",
"Finish your account"; buttons "Save"/"Saving…", "Not now", "Use a different email";
notes "We couldn't check your account status just now — …", "Your account details are
saved."; summary headings "…before joining the waiting list." / "…before finishing your
account."; floor code-expiry/dead/missing sentences pointing at re-join (the floor has no
resend button); sign-in code copy ("We emailed a 6-digit code to {email}…",
`no_account`/`has_phone` messages); panel sentinel lines ("Not set yet.", "No phone
number on this account.", "…you sign in with a code we email you."); floor held sentence;
`no_pending_join` message. All US spelling.

## T-A — every new test fails on pre-build `origin/main` (base behaviors)

- `tests/integration/waitlist-flip.test.ts` (21): base 400s minimal creates (name/phone/
  ZIP required), 409s recognized joins (`email_taken`), 404s all seven new routes, and
  has no `waitlist_pending_joins` table — every test fails behaviorally. The two scope/
  fence pins (plain-create 400/409; JS-path 403) pass on base too and are labeled
  regression pins in-code by their names.
- `tests/dom/waitlist-flip.test.tsx` (12): base renders the SignupFields wall (`waitlist-
  name` etc.), no channel radios, the "then come back" line, the loading skeleton, no
  recognized/finish states, and a code-less sign-in — every test fails behaviorally.
- `tests/dom/waitlist-floor-ssr.test.tsx` (4): base server output is the skeleton with no
  form — every assertion fails.
- `tests/unit/waitlist-floor.test.ts` (5): `lib/waitlist-floor.ts` does not exist on base
  (import failure).
- Stale-contract updates (spec-mandated, not rewrites-to-fit): the 3.3 waitlist busy test
  now drives the alert step (base's `waitlist-name` no longer exists per B-7);
  `ACCOUNT_TABLE_EXPORTS` gains `waitlistPendingJoins` (guardrail intent preserved:
  every account table stays private).
- Base-behavior statements above are from the pre-build code read this session (skeleton,
  `CreateAccountSchema`, 409 path, route table); no worktree re-run was performed.

## Spec gaps / design defects

None found. Two mechanism choices the spec leaves to the builder, recorded: (1)
pending-join storage is a dedicated table (see above) rather than columns on the code
rows, so the channel/phone choice travels with the variety; (2) a signed-in floor
submitter joins directly (same existing-email branch as recognized) instead of being
issued a redundant code — the observable (§3.4.3: correct for every session state) holds.

## Gate record — checks 3.2-A…G and drive conditions

- 3.2-A (flip, cold): zero-seller variety → email-only join → success in place → emailed
  code completes State B → A in the inline `CodeEntry`. Driver: controlled test mailbox;
  delete the test account afterward (standing rule).
- 3.2-B (text): choose "Email and text" → phone reveals, focus stays → join records
  `sms_opt_in` + consent timestamp; switching back pre-submit stores no phone.
- 3.2-C (recognized): sign out → rejoin with the same email → in-place code state (no
  error, no `/account` link) → code completes the join on the same page.
- 3.2-D (optional profile): finish step present after joining + in the panel until
  completed; dismiss leaves the alert active; completion asks name/ZIP/type only.
- 3.2-E (no-JS e2e): served HTML contains the real form; "Loading waiting-list status…"
  appears nowhere in the server document; plain POST → verify floor → plain code POST →
  joined; JS-on/fetch-blocked keeps the floor form + note.
- 3.2-F (scope guard): `/account` create form unchanged; signed-in join renders States
  A–D identically (pinned by `waitlist-success.test.tsx`, untouched and green).
- 3.2-G (no-JS errors + Ruling 9): invalid-email POST and wrong-code POST land back on
  the variety page with errors stated, values/channel preserved, and the block's error
  state in the initial viewport via `#waitlist-block` (every redirect-back carries the
  fragment — asserted on all floor outcomes in the integration suite).
- Suite: full `npm run verify` exits 0 on the final tree (re-run after the last test
  addition; see run notes). Controlled-test-mailbox drives: 3.2-A/C/D; no-JS drives:
  3.2-E/G (+ fetch-blocked JS variant).

## Files

- Rebuilt: `v2/components/variety/WaitlistBlock.tsx`.
- Extended: `v2/lib/services/accounts.ts`, `v2/lib/api/account-routes.ts`,
  `v2/lib/api/write-route.ts` (urlencoded + 303), `v2/components/account/CodeEntry.tsx`
  (unauth mode), `v2/components/account/SignInForm.tsx`, `v2/components/account/AccountPanel.tsx`,
  `v2/components/account/account-errors.ts`, `v2/app/variety/[slug]/variety-view.tsx`,
  `v2/middleware.ts`, `v2/lib/repositories/accounts.ts`, `v2/lib/repositories/waitlist.ts`,
  `v2/lib/db/schema.ts`, comment-only `v2/lib/accounts.ts`, `v2/lib/services/verification.ts`.
- Added: `v2/lib/waitlist-floor.ts`, `v2/components/account/FinishProfileFields.tsx`,
  `v2/app/variety/[slug]/waitlist/page.tsx`, `v2/migrations/0016_waitlist_pending_joins.sql`,
  `v2/tests/integration/waitlist-flip.test.ts`, `v2/tests/dom/waitlist-flip.test.tsx`,
  `v2/tests/dom/waitlist-floor-ssr.test.tsx`, `v2/tests/unit/waitlist-floor.test.ts`.
- Untouched per the fence: `SignupFields.tsx`, `CreateAccountForm.tsx`, success copy,
  States A–D, `SellerFilterSection.tsx`. Work left UNCOMMITTED for the workflow's WIP/PR steps.
