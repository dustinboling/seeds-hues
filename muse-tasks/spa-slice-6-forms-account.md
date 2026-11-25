# Slice 6 — Forms + account (Seed Directory SPA conversion)

You are building Slice 6 of 9 in the Seed Directory's conversion to a Vike + React SPA. Slices 0–5 are merged: the `app/` tree, the data layer (`app/src/data/`), the revalidate machinery, variety routes (Slice 3), browse + search (Slice 4), shops + hubs (Slice 5). Read first: `spa-conversion-2026-11-23/BUILD-SEQUENCE.md` (Slice 6 row), `spa-conversion-2026-11-23/ROUTE-INVENTORY.md` (the `/report`, `/add-your-farm`, `/account`, `/unsubscribe`, `/go/[id]` rows), Bea's `spa-conversion-2026-11-23/PRERENDER-CONTENT-AUDIT.md` — **§1 (global contract), §5.1 (`/add-your-farm`), §5.2 (`/report`), §6.1 (`/account`), §6.2 (`/unsubscribe`), §7.1 (`/go/[id]`), §9 (live-data regions)** — the Tranche 3.2 rulings as shipped in v2 (the §11.1 "Email me a code instead" seam, the §11.4 Turnstile exemption for the no-JS form-encoded endpoint with its compensating controls, Ada Ruling 9's redirect-back fragment rule), and the gate records `QUINN-GATE-spa-slice-3.md` (carry 3: this slice's gate owes the end-to-end waitlist submission proof, U1) and `QUINN-GATE-spa-slice-5.md` (notes N1–N3). Consult the current official Vike docs where needed.

**Work tests-first, assert exclusivity as well as presence, and treat your summary accounting as a deliverable** — the standing slice discipline. **N1 cure (binding, from Slice 5's gate): your Step-1 starting-red result — the exact failing/passing counts on the starting tree — must be stated verbatim in your final summary's accounting; a summary without it is incomplete.**

## Standing constraints

- Still INERT: nothing deploys; `v2/` stays the live tree, untouched except — if unavoidable — the verify chain. No `.github/workflows/*` edits (stop and report if one seems required). No deploy-config changes.
- Behavior and copy are a PORT of the live `v2/` pages and flows as they stand on main today — including the Tranche 1.5 plain-language form errors, the 3.2 sign-in seam, and the waitlist block's account-aware states (Slice 3 shipped the floor form; this slice wires the real account behavior behind it). Port faithfully; do not invent copy or behavior. US spelling.
- The backend does not change: all `/api/v1/*` shapes, the account/session model, Turnstile server verification, and rate limits stay exactly as v2 has them — this slice builds the app-side pages, forms, and client flows that consume them ("one backend" rule).
- **The BusyForm lesson is a build requirement:** a form's submit path must never drop its own field values (the shipped v2 bug disabled the wrapping fieldset on submit and submissions arrived empty). Every form in this slice carries a test that types real values, submits, and asserts the payload the API receives contains those values.
- Prices are NEVER shown anywhere — visible copy, meta, OG, JSON-LD, or any rendered API field.
- Permanent redirects are **301, uniformly, one hop**; `/go/[id]` is the standing exception — a **302** handler, as v2 ships it (§7.1).
- Production standard: strict TS, no stubs. Every deliverable ships complete or your summary reports what is missing and why, plainly.

## Step 1 — Discriminating tests FIRST

Extend the fake catalog / API stub so the form and account surfaces can discriminate:

- **(i)** a visitor account fixture (name/email/phone/ZIP) with an existing waitlist entry on a zero-seller variety and a "found" alert state; a second account with email only (no phone — the §11.1 seam case).
- **(ii)** the form endpoints behind a stub that records received payloads verbatim (report submissions, farm submissions, waitlist joins, sign-in code requests/verifications) and can be told to accept or reject (validation error, rate limit, Turnstile failure).
- **(iii)** a listing fixture for `/go/[id]` (active listing → seller product URL) + a removed/unknown listing id.
- **(iv)** a signed unsubscribe token fixture (valid signature, tampered signature).

Tests that FAIL on the current tree and pass only when the surface is real (state the red result in your summary):

- **`/report` SSR:** 200; the real form in the first HTML (no JS required to see or submit it); `noindex` per §5.2; exactly one canonical/description/title. A filled submission reaches the stub endpoint with every typed value intact (BusyForm test); a stub rejection re-renders with the plain-language error AND the typed values preserved.
- **`/add-your-farm` SSR:** 200, indexable; the real form in first HTML; the `?state={code}` prefill from the state hub works; filled submission payload intact; rejection preserves values + plain-language errors (Tranche 1.5 wording as v2 ships it).
- **Turnstile posture:** the JS forms carry the Turnstile widget + server-verify round trip against the stub; the **no-JS form-encoded endpoint stays exempt** per §11.4 with its compensating controls (rate limit + honeypot/timing as v2 ships them) — a no-JS submission succeeds through the floor path and a floor-path abuse case (rate limit tripped) is refused.
- **`/account` SPA:** robots-disallowed; signed-out state renders the sign-in panel (email + phone) with the **"Email me a code instead"** seam present for the phone-less case (§11.1, verbatim v2 copy); code request → code verify → signed-in state shows the account's waitlists with their Found/Waiting/Held states; sign-out returns to the signed-out state. Session persists across a client-side route change (SPA, no reload).
- **Waitlist end-to-end (the U1 carry):** from a zero-seller variety page (Slice 3's block), a signed-in join submits and the variety page + `/account` both show the joined state; a signed-out join takes the account-creation path v2 ships and lands joined. The redirect-back URL carries the waitlist block's own fragment (Ada Ruling 9).
- **`/unsubscribe`:** valid signed token → 200 confirmation state, the subscription actually flips in the stub; tampered token → refused (4xx), no state change; robots-disallowed.
- **`/go/[id]`:** active listing → **302** to the seller product URL with UTM parameters as v2 composes them, click logged in the stub; unknown/removed id → 404 (never a redirect); response carries the nofollow/noopener posture §7.1 specifies; robots-disallowed.
- **Exclusivity** on every new SSR template: exactly one canonical / description / og:url / og:image / title.
- **Price guard** on every rendered template: no prohibited JSON-LD string, no price pattern.

Design assertions so the suite fails if: a submission arrives at the stub with any typed field missing or emptied, the no-JS endpoint gains a Turnstile requirement, the email-code seam disappears for a phone-less account, `/go/` answers 301 or redirects an unknown id, or an unsigned unsubscribe mutates state.

## Step 2 — The routes, wired through the machinery

1. **Form chassis:** one shared form/port layer over the existing `/api/v1` endpoints (reports, farm submissions, waitlist, account) — SSR floor form first (real `<form>`, form-encoded POST works with no JS), client enhancement second (in-place submit, pending state, error surface) with **identical payloads** on both paths. Turnstile: widget + server verify on the JS path; the §11.4 exemption + compensating controls on the no-JS endpoint only, exactly as v2 ships them.
2. **`/report` — SSR form** per §5.2: noindex, crawlable-not-in-sitemap as today; the correct/claim/remove report types v2 offers; success state as v2 renders it.
3. **`/add-your-farm` — SSR form** per §5.1: indexable; `?state=` prefill; plain-language errors; success state as v2 renders it.
4. **`/account` — SPA surface** per §6.1: client-rendered inside the app shell, robots-disallowed, no prerendered per-user content (SSR shell only); sign-in (email + phone; 6-digit code verifies NEW accounts; the §11.1 email-code seam for phone-less accounts), account details, waitlist management with Found/Waiting/Held states, sign-out — all against the existing account APIs and session behavior (sessions as v2 issues them; nothing about the auth model changes).
5. **Waitlist wiring:** Slice 3's waitlist block gains its account-aware states (signed-in join/joined, signed-out create-then-join) against the real endpoints; Ada Ruling 9's fragment rule on every redirect-back.
6. **`/unsubscribe` — utility** per §6.2: signed-token verification server-side; confirm state; no state change on a bad signature.
7. **`/go/[id]` — handler** per §7.1: 302 + UTM + click logging through the existing API; unknown/removed → 404; robots-disallowed.
8. **Cache/headers posture** per §9: form and account surfaces are never edge-cached as another user's state (private/no-store where v2 sets it); the SSR floor pages keep §9's public posture only where v2 has it.

## Step 3 — Demonstrations (state each result in your summary)

- **Real submission drives (the BusyForm standard):** for each form (report, add-your-farm, waitlist join, sign-in code request + verify), type real values into the built surface, submit, and show the stub received the exact typed payload; one rejection drive per form showing values preserved + the plain-language error.
- **No-JS floor drive:** with JS disabled, the floor form renders, submits through the exempt endpoint, and lands the success state with the Ruling 9 fragment where the flow redirects back.
- **Account drive:** phone-less fixture signs in via the email-code seam end-to-end; waitlists render their states; sign-out clears to the signed-out panel.
- **`/go/` drive:** the 302 target + UTM string shown; the click present in the stub log; unknown id 404.

## Your summary must state (all of it — the accounting is a deliverable; omissions are findings)

- The Step-1 red result (exact counts on the starting tree) and the final green result, with test counts.
- The route inventory shipped, mapped to the deliverables (report, add-your-farm, account SPA, waitlist wiring, unsubscribe, /go handler).
- Per-template head-exclusivity counts for every new SSR template.
- The payload-intact result per form (BusyForm evidence), and the no-JS exemption result.
- The U1 end-to-end waitlist proof result.
- Anything missing and why — plainly.
