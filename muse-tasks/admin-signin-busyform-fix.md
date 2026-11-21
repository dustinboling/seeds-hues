# Admin sign-in submits EMPTY in a real browser — BusyForm disables its own fields on submit

## Why (live defect, reproduced 2026-11-21)

Dustin cannot sign in to the admin. A real browser filled `dustin@hues.flowers` on
https://seeds.hues.flowers/admin/sign-in and clicked "Email me a code"; the browser landed on
`/admin/sign-in?error=missing_email` ("Enter your email address.") and NO code row was created
server-side — the email never arrived. Curl-level tests of the same endpoint work, which is how
this shipped unnoticed through five gated slices: the defect only exists in a real browser's
form submission.

## Root cause (confirmed in the code)

`v2/components/admin/BusyForm.tsx`:

```tsx
<form method="post" action={action} onSubmit={() => setBusy(true)}>
  <fieldset disabled={busy} className="flex flex-col gap-3">
```

BusyForm does NOT `preventDefault` — it is a native POST form. The submit handler sets the busy
state; React flushes that re-render; the browser then constructs the submission's form data —
and disabled fields are excluded from form data by spec. The `<fieldset disabled>` therefore
strips EVERY field (the email input AND the hidden `next` input) from every submission. Both
forms that use BusyForm are in the sign-in flow, so both are broken:

- `v2/app/admin/sign-in/page.tsx` — email request form (action `/admin/sign-in/request`)
- `v2/app/admin/sign-in/code/page.tsx` — code verify form (action `/admin/sign-in/verify`)

## The fix — BusyForm

- Keep the designed behaviour: the submit button shows its busy label ("Sending…" /
  "Verifying…") while the submission is in flight, and double submission stays prevented.
- NEVER disable the form's input fields (directly or via a fieldset) in response to submit /
  busy state. Disable ONLY the submit button, and set `aria-busy` on the form while busy.
- Keep BusyForm's props and API identical (`action`, `submitLabel`, `busyLabel`, children) —
  the two sign-in pages do not change.
- Progressive enhancement stays: without JS it remains an ordinary working form.

## Scope — the same defect class in the admin sheets (fix all of it)

The same pattern — form fields disabled by the busy state inside a submitting form — exists in
the four admin sheet files. Those forms are saved today only by a timing accident: their
`onSubmit` calls `preventDefault()` and their `postSheet()` helper constructs
`new FormData(form)` synchronously in the same call stack as `setBusy(true)`, before React
flushes the re-render. One refactor (an `await` before FormData construction) breaks them
identically and silently. The pattern is the defect; remove it everywhere it appears:

- `v2/app/admin/(protected)/sellers/_components/seller-sheets.tsx` — the `disabled={busy}`
  fieldsets (edit-seller groups, classify) and the individually disabled textareas
  (classify note, add-note body).
- `v2/app/admin/(protected)/accounts/_components/account-sheets.tsx` — the `disabled={busy}`
  role fieldset and any other busy-disabled form fields in the file.
- `v2/app/admin/(protected)/listings/_components/listing-sheets.tsx` — the retire-reason
  `<select>` and note `<input>` carrying `disabled={busy}`.
- `v2/app/admin/(protected)/varieties/_components/variety-sheets.tsx` — the add-alias name
  `<input>` carrying `disabled={busy}`.

Rule for the sheets: no `disabled` driven by busy state on any `input`, `select`, `textarea`,
or `fieldset` inside a submitting form. Submit and cancel BUTTONS may (and should) keep their
`disabled={busy}` behaviour, busy labels stay, and the existing `if (busy) return` submit
guards stay. Enumerate every occurrence in these four files — do not sample.

Explicitly OUT of scope (verified safe — do not touch):

- The danger-button hidden forms in the sheet files (alias remove, variety remove, seller
  deactivate/remove, farm revoke): their hidden inputs are never disabled; only dialog
  buttons disable. They submit intact.
- Public forms that disable only their submit button (`SignInForm`, `CreateAccountForm`,
  `CodeEntry`, `ReportForm`, `AddYourFarmForm`, `WaitlistBlock`, `AccountPanel`).

## Tests (required — this bug shipped because the test stack couldn't see it)

Add DOM-level submission tests that reproduce the browser mechanics, covering BOTH BusyForm
forms:

1. Render the sign-in email form as the page composes it (BusyForm + hidden `next` + email
   input), fill the email, submit, let the busy state flush, then construct the form data the
   way a browser does for a native submission (`new FormData(form)` after the submit handler
   has run) and assert it contains the typed email and the `next` value.
2. Same for the code form: hidden email + `next` + the 6-digit code input — fill the code,
   submit, assert the constructed form data contains the code and the email.

jsdom's form-data construction honours disabled fields, so these tests FAIL against the
pre-fix BusyForm and PASS against the fixed one. Prove that locally before finishing: run the
new tests against the OLD component (e.g. via `git stash` of the component change) and record
that they fail, then against the fix and record that they pass. A test that passes on both is
vacuous and does not count.

Test-stack notes: the suite is vitest (`npm run verify` = lint + typecheck + vitest). You may
add the minimal devDependencies needed for DOM rendering (jsdom and, if useful,
@testing-library/react) and adjust the vitest config/include so the new test files actually
run under `npm run verify` — existing suites must keep running unchanged. Test-only changes
to config are fine; production dependencies do not change.

For the sheets, the fix is structural (fields are never disabled, so `postSheet`'s FormData
capture is safe by construction rather than by timing); say in your finish summary how you
verified no busy-disabled form fields remain in the four files (a grep over the result is
the honest check).

## Constraints

- Standing code constraints: no `setState` in effect bodies; React children passed as JSX
  children, never via a `children` prop object; the R4 guardrail's scope and token list are
  unchanged — do not rename copy to dodge a scanner.
- No copy changes, no layout changes, no styling changes beyond what the BusyForm fix
  requires. US spelling in anything you touch.
- Prices are never shown — nothing here touches prices.

## Verify before you finish

You can run commands. In `v2/`, run `npm run verify` yourself; if anything fails, fix it and
re-run until the full gate is green. Do not finish with a failing or unrun gate — the workflow
runs the same gate after you and opens no PR unless it passes.

Finish-line summary for the PR (the workflow's placeholder title/body get hand-corrected to
this): "Fix BusyForm disabling its own fields on submit (admin sign-in submitted empty in a
real browser) + remove busy-disabled form fields from the admin sheets; DOM submission tests
for both sign-in forms, proven to fail on the old component."
