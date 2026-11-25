# Slice 7 — Admin SPA (Seed Directory SPA conversion)

You are building Slice 7 of 9 in the Seed Directory's conversion to a Vike + React SPA. Slices 0–6 are merged: the `app/` tree, data layer, revalidate machinery, variety routes, browse + search, shops + hubs, and forms + visitor account (Slice 6). This slice converts the admin section — the last surface family. Read first: `spa-conversion-2026-11-23/BUILD-SEQUENCE.md` (Slice 7 row), `spa-conversion-2026-11-23/ROUTE-INVENTORY.md` (the full admin table), `spa-conversion-2026-11-23/ARCHITECTURE-BRIEF.md` (the admin section), Bea's `spa-conversion-2026-11-23/PRERENDER-CONTENT-AUDIT.md` **§6.5** (admin), `~/workspace/seeds-hues/ADMIN-SECTION.md` (the admin commissioning record — in the main tree, read via the repo), and the gate records `QUINN-GATE-spa-slice-5.md` + `QUINN-GATE-spa-slice-6.md` for the standing notes. Consult the current official Vike docs where needed.

**Work tests-first and treat your summary accounting as a deliverable** — the standing slice discipline. Your final summary's accounting (starting-red counts, final green counts, route inventory) is extracted verbatim into the PR body by the coordinator, so write it complete and exact.

## Standing constraints

- Still INERT: nothing deploys; `v2/` stays the live tree, untouched except — if unavoidable — the verify chain. No `.github/workflows/*` edits (stop and report if one seems required). No deploy-config changes.
- Behavior and copy are a PORT of the live `v2/` admin as it stands on main today — every section, control, and outcome. Port faithfully; do not invent copy, sections, or powers. US spelling.
- The backend does not change: admin APIs, the email + 6-digit-code sign-in, sessions, and the role model (Dustin = full admin; designees = reviewer) stay exactly as they are. **Admin sessions keep NO idle timeout — deliberately (Dustin's ruling, 2026-11-23); do not add one.**
- Admin surfaces are **SPA app surfaces**: client-rendered, auth-gated, **iPad-first** layout (the standing device rule — admin is the iPad-first exception). The prerender/complete-content rules for public routes do NOT apply here; no admin surface is indexable or publicly reachable, and the auth gate is server-enforced on every admin API call, not merely hidden in the UI.
- **Internal seller notes are NEVER public** — enforced server-side (the public seller/shop payloads must not contain them) AND covered by a required test, exactly as v2 enforces it.
- **Duplicate holds are decided ONLY through the admin UI's decideDuplicate path** (Dustin's ruling — the API deliberately cannot decide holds). Port that path faithfully; do not add another.
- **The BusyForm lesson is a build requirement** on every admin form/action: a submit must never drop its own field values; every admin form carries a payload-intact test.
- Prices are NEVER shown anywhere — **including in admin** (the standing rule has no admin exception).
- Production standard: strict TS, no stubs. Every deliverable ships complete or your summary reports what is missing and why, plainly.

## Step 1 — Discriminating tests FIRST

Extend the stub/fixtures so the admin surfaces can discriminate:

- **(i)** two session fixtures: a full-admin session and a reviewer session, plus a signed-in-but-unauthorized account and a signed-out state.
- **(ii)** a review queue fixture set: a listing match awaiting decision, a structured seller-correction report, a duplicate hold, and a false-queue item (a report whose listing is already live).
- **(iii)** seller fixtures with internal notes, customer-service contacts, multiple locations, eligibility + Small-farm badge states.
- **(iv)** variety fixtures: one with live listings (removal blocked), one with none (removal allowed), listing fixtures for listing-remove.
- **(v)** statistics fixtures carrying all four popularity signals (page views, outbound clicks, waitlist joins, searches) with hand-computable rankings, and the Visitors card data shape v2 consumes.
- **(vi)** an action-endpoint stub that records received payloads verbatim and can accept/reject.

Tests that FAIL on the current tree and pass only when the surface is real (state the red result in your summary):

- **Auth gate:** every `/admin/*` surface and admin API read refuses signed-out and unauthorized sessions (redirect to sign-in / no-access as v2 does); the sign-in flow (email → 6-digit code → session) completes against the stub; **no idle-timeout behavior exists** (a session at any age the stub models stays valid until sign-out/revocation, as v2 ships).
- **Role discrimination:** the reviewer session can decide duplicate holds, read + add internal seller notes, and approve a structured seller correction (which applies the fix immediately); the reviewer is refused full-admin-only powers (variety-remove, account role changes) at the API level, not just in the UI; the full-admin session can do all of it.
- **Internal-notes guarantee:** the public shop/seller payloads for fixture (iii) contain NO internal-note text anywhere (response-body grep), while the admin sellers surface shows the notes to both roles.
- **Review flows:** approving the listing match publishes it; the correction approval applies the fix; decideDuplicate resolves the hold AND keeps the held variety's name as an alternate name on the existing variety (the standing duplicate ruling); the false-queue item is rejectable.
- **Remove flows:** variety-remove on fixture (iv)-with-listings is BLOCKED with the live-listing count; on the listing-free variety it soft-removes (public surface then 404s in the stub-backed render); listing-remove is idempotent (second call a no-op success).
- **Statistics:** the ranking orders by each of the four signals correctly on the hand-computed fixtures; the Visitors card renders its v2 data shape.
- **BusyForm:** every admin form/action submits its typed values intact to the stub; a rejection preserves values.
- **No price anywhere:** admin surfaces + payloads grep clean for price fields/patterns (the directory's prices exist in source data — they must not surface).

Design assertions so the suite fails if: an internal note appears in any public payload, a reviewer gains a full-admin power through the API, a duplicate hold becomes decidable outside the UI path, variety-remove succeeds while listings live, or an admin session gains an idle timeout.

## Step 2 — The surfaces, wired through the machinery

1. **Admin shell + sign-in:** `/admin/sign-in` + code step, `/admin/no-access`, the protected `/admin` hub — SPA surfaces in the app shell's admin variant, iPad-first; session handling identical to v2 (cookie, duration, revocation); sign-out.
2. **`/admin/review`:** the queue as v2 ships it — listing matches, structured seller corrections (reviewer approval applies the fix immediately), duplicate holds via decideDuplicate only, false-queue rejection.
3. **`/admin/sellers`:** seller records, eligibility, Small-farm badge, customer-service contacts, locations — and internal notes (admin-only, both roles read/add).
4. **`/admin/varieties` + `/admin/listings`:** variety records + crops; variety-remove (full-admin only, confirm dialog, blocked while live listings exist, soft removal); listing-remove (idempotent).
5. **`/admin/accounts`:** visitor accounts + role display/management as v2 allows (Dustin full admin; designees reviewer).
6. **`/admin/statistics`:** popularity by all four signals + the Visitors card, ported on v2's existing data paths (no new analytics plumbing; Web Analytics was already enabled zone-wide — do NOT add a manual beacon).
7. **`/admin/waitlist` + `/admin/more`:** as v2 ships them.
8. **Action handlers:** `/admin/*/actions`, `/admin/review/decide`, sign-in handlers — behavior unchanged, consumed by the SPA surfaces.

## Step 3 — Demonstrations (state each result in your summary)

- **Role drives:** as the reviewer fixture, complete a duplicate-hold decision, a correction approval, and a note add; attempt variety-remove and show the API refusal. As the admin fixture, complete the variety-remove on the listing-free variety and show the blocked refusal on the listed one.
- **Notes-leak drive:** fetch the public shop payload for the noted seller and show the note text absent; show it present in admin.
- **Sign-in drive:** full email + code flow against the stub, landing on the hub; signed-out access to a deep admin route lands on sign-in.
- **iPad viewport evidence:** the admin surfaces render at iPad dimensions (1024×768 / 1180×820) with no phone-layout collapse of the data tables/queues — assert via the DOM suite's viewport fixtures as prior slices did.

## Your summary must state (all of it — the accounting is a deliverable; omissions are findings)

- The Step-1 red result (exact counts on the starting tree) and the final green result, with test counts.
- The route inventory shipped, mapped to the admin table (sign-in, no-access, hub, review, sellers, varieties, listings, accounts, statistics, waitlist, more, handlers).
- The role-discrimination results (reviewer allowed/refused lists as exercised), the internal-notes guarantee result, the no-idle-timeout result.
- The BusyForm payload-intact result per admin form.
- Anything missing and why — plainly.
