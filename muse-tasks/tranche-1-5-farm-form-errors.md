# Task: Tranche 1.5 — Add Your Farm errors in plain language (full audit 2026-11-21, §6 item 1.5; Quinn usability finding D6.1, Nielsen severity 3)

The Add Your Farm form shows the API's raw validator text as its only error
message. Evidence (audit `sections/quinn-usability.md` D6.1): an empty-body
`POST /api/v1/farm-submissions` returns detail like "farm_name: Invalid
input: expected string, received undefined; contact_email: enter a valid
email address; …", and `components/farm/AddYourFarmForm.tsx` renders the
shared callApi helper's raw `detail` verbatim (`setError(r.message)`) into
the form's `role="alert"` line. The report form already solved this exact
problem once — `components/report/report-errors.ts` maps every failure to
plain copy and never shows validator text. Bring Add Your Farm to parity.

## What to do

1. Add a farm-form error module modeled on `components/report/report-errors.ts`
   (e.g. `components/farm/farm-errors.ts`) exporting plain-copy constants and
   a mapper from the farm-submissions API's failure shape (status, code,
   detail) to the message the form shows. Cover at minimum:
   - Per-field validation failures, keyed by the API's field names
     (farm_name, contact_name, contact_email, website, and every other field
     the submission schema validates): one plain, actionable line per field
     ("Enter your farm's name.", "Enter a valid email address.", …). When
     several fields fail, name the first in plain words, as the report
     mapper does.
   - The website format rule specifically: a farm owner typing
     "www.myfarm.com" must get a message that tells them how to fix it
     (the audit names this as the demonstrated real-world case).
   - Rate limiting, server errors (5xx), and network failure — plain lines
     in the same voice as the report form's.
   - A plain fallback for anything unrecognized ("Some of the details
     didn't look right — please check the form and try again." family).
     Raw validator/detail text must never reach the page on ANY path.
2. Wire `AddYourFarmForm.tsx` to the mapper. Everything else about the form
   stays: fields uncontrolled, input preserved on failure, the `role="alert"`
   error line, Turnstile behavior, success flow.
3. If the API's current failure shape cannot distinguish fields (no code /
   unparseable detail), make the smallest server-side change that exposes
   the field key in the existing problem+json shape — consistent with how
   the reports API already behaves — and name it in your finish summary.
   No schema changes, no new endpoints.

## Tests (required, non-vacuous)

- Form-level tests (the repo's DOM test layer): a server validation failure
  for the website rule renders the plain website message and NOT any part of
  the raw validator string; a missing-field failure renders that field's
  plain line; a 5xx and a network failure render their plain lines.
- A sweep assertion: for a table of representative raw API failure payloads
  (including the audit's empty-body detail string verbatim), the rendered
  message contains no validator fragments ("Invalid input", "expected
  string", "received undefined").
- State in your finish summary how you proved the new tests fail on the old
  code (stash/revert check).

## Constraints

- This form only. The systemic field-state set for all public forms is a
  separate later item (Tranche 3.3) — do not build it here.
- No visual/layout changes; the error line keeps its current placement and
  styling. No success-flow changes.
- US spelling in any text you touch. Follow the repo's standing code
  constraints.

## Finish-line summary (use this as the PR title)

"Tranche 1.5: Add Your Farm maps server errors to plain language (report-form parity); raw validator text never renders"
