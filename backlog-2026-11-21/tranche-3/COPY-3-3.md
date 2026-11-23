# Tranche 3, Item 3.3 — Public Field-State Set: Copy Pack

**Seat:** Wren, Copywriting / Storytelling. **Item:** 3.3, the public field-state set for seeds.hues.flowers.
**Sources:** Mina's FIELD-STATES-DESIGN.md (§5.3, §8.1–§8.7, §12), Nadia's SPEC.md §4.2.5, the existing mapping layers (`v2/components/report/report-errors.ts`, `v2/components/farm/farm-errors.ts`), and the account forms, API helper, account routes, and account / verification services on `origin/main`.
**Rules held:** US spelling throughout. No price appears in any line below. Every error message names the field's subject in the visitor's words, states the problem, and states the fix (SPEC §4.2.5). No raw validator string, error code, or API detail is visitor copy — codes below are mapping keys for the build only. Existing sentences not named for change are kept verbatim.

---

## 1. Summary headings (design §5.3, Content A)

Construction: the admin summary's "Some fields need attention before saving." re-verbed with each form's own verb. One heading per form. These headings serve the multi-error summary only; a form-level message plus field errors uses the form-level message as the heading instead (§5.3), and a single field error has no summary box.

| Form | Summary heading |
|---|---|
| Report a problem | Some fields need attention before sending. |
| Add Your Farm | Some fields need attention before sending for review. |
| Create account | Some fields need attention before creating your account. |
| Sign in | Some fields need attention before signing in. |
| Account panel — Change email | Some fields need attention before updating. |
| Account panel — Text alerts (alert phone) | Some fields need attention before saving. |

Notes:

- Add Your Farm's verb is taken from its own submit control ("Send for review", busy "Sending…"); Report's from its own ("Send request", busy "Sending…").
- The delete-confirm form in the account panel gets no heading here: it carries one field, so its failures are the field's own inline message (§3.6 below) or a form-level box whose heading is the message itself (§5.3, Content B). Preferences is a button action, not a data form (§8.7 of the design), and gets no heading.

---

## 2. Hint rule sentences (design §3.9 / D-4)

Full replacement hint texts. The before text is quoted verbatim from `origin/main`; the after text keeps every existing sentence and adds or restates the enforced rule.

### 2(a) ZIP code — SignupFields

Before:

> Sets your USDA growing zone. Your ZIP stays private; only the zone is shown, to you.

After:

> Sets your USDA growing zone. Your ZIP stays private; only the zone is shown, to you. Enter it as a 5-digit ZIP code.

### 2(b) About your farm or company — Add Your Farm

Before:

> A few sentences: what you sell, and where you are. If you grow your own seed, tell us about that too.

After:

> A few sentences: what you sell, and where you are. If you grow your own seed, tell us about that too. Your About must be at least 10 characters long.

### 2(c) Varieties you want listed — Add Your Farm

Before:

> One per line, e.g. “Zinnia — Queen Lime Blush”.

After:

> List one variety per line, e.g. “Zinnia — Queen Lime Blush”.

---

## 3. Error message maps

Keyed by the API error code the form actually receives (from `callApi` in `v2/components/account/api.ts`: `code` from the problem body, `network` on a failed fetch, the HTTP status otherwise). Field errors attach to the named field; form-level failures render in the §5.3 summary box, Content B. The generic write-route limit (`rate_limited`, 429) can reach every account form; its wording is the report / farm forms' existing sentence, kept verbatim.

### 3.1 Create account — `POST /api/v1/account`

Field errors:

| Key | Visitor message |
|---|---|
| `validation_error` — name | Enter your name. |
| `validation_error` — email | Enter a valid email address. |
| `validation_error` — phone | Enter your phone number as a 10-digit US number. |
| `invalid_phone` (422) — phone | Enter your phone number as a 10-digit US number. |
| `validation_error` — zip | Enter your ZIP code as 5 digits. |
| `unknown_zip` (422) — ZIP code | Your ZIP code isn't one we recognize — check the 5 digits and try again. |
| `email_taken` (409) — Email | That email already has an account — sign in with your email and phone number instead, or use a different email address. |

Form-level failures:

| Key | Visitor message |
|---|---|
| `turnstile_failed` (403) | The human check didn't pass — please complete it and try again. |
| `rate_limited` (429) | That's a lot of requests in a short time — please wait a minute and try again. |
| `network` (status 0) | Could not create your account. Check your connection and try again. |
| Status 500 / any other failure | Something went wrong on our side. Please try again in a few minutes. |
| Fallback | We couldn't create your account. Please check the form and try again. |

Notes:

- The account-type radio group and the SMS opt-in checkbox send only values the schema always accepts (`farm_owner` / `sms_opt_in` booleans with defaults), so no group error message is written for them; if the group ever fails server-side, the fallback above is its message until a specific one is commissioned.
- This form never sends `join_variety` (the waiting-list create-and-join is a separate component), so no join failure is mapped here.

### 3.2 Sign in — `POST /api/v1/account/sign-in`

Format and empty failures are per-field. The credential failure is one form-level, pair-neutral message (§8.4 of the design): it must never disclose which half of the email + phone pair failed.

Field errors:

| Key | Visitor message |
|---|---|
| `validation_error` — email | Enter a valid email address. |
| `validation_error` — phone | Enter your phone number. |

Form-level failures:

| Key | Visitor message |
|---|---|
| `no_match` (401) — the pair | We couldn't find an account with that email and phone number together — check both and try again. |
| `too_many_attempts` (429) | You've tried to sign in too many times — please wait a while and try again. |
| `turnstile_failed` (403) | The human check didn't pass — please complete it and try again. |
| `rate_limited` (429) | That's a lot of requests in a short time — please wait a minute and try again. |
| `network` (status 0) | Could not sign you in. Check your connection and try again. |
| Status 500 / any other failure | Something went wrong on our side. Please try again in a few minutes. |
| Fallback | We couldn't sign you in. Please check the form and try again. |

Notes:

- `too_many_attempts` covers two different lockouts in the service (a 15-minute IP limit and a pair lockout that lengthens with each failure), so the message names no number of minutes — a stated wait the service does not keep would be a wrong promise.
- The service's current pair message (`SIGNIN_GENERIC_ERROR`, "We couldn't find that email + phone pair") states the problem but no fix; the mapped message above replaces it at the form and is not a paraphrase of it.

### 3.3 CodeEntry — verify and resend, both channels

The component posts to `/api/v1/account/email/verify` + `/resend` (email channel) or `/api/v1/account/alert-phone/verify` + `/resend` (phone channel). The existing service copy for these failures is already channel-neutral, so the mapped messages are channel-neutral too; the one phone-only failure is marked. All messages below are the code field's inline error (§5.1 of the design), except `signed_out`, which is form-level.

Verify failures (code field):

| Key | Visitor message |
|---|---|
| `validation_error` — code (not 6 digits) | Enter the 6-digit code. |
| `code_incorrect` (400) | That code isn't right — check it and try again. |
| `code_expired` (410) | That code has expired — use “Send a new code” to get a fresh one. |
| `code_dead` (409) — too many attempts | Too many wrong tries — that code no longer works. Use “Send a new code” to get a fresh one. |
| `no_code` (409) | There's no active code — use “Send a new code” to get one. |

Resend failures:

| Key | Visitor message |
|---|---|
| `resend_too_soon` (429) | A code was just sent — wait a minute, then use “Send a new code” again. |
| `resend_limit` (429) | That's the most codes we can send in an hour — please try again later. |
| `no_alert_phone` (409) — phone channel only | Add an alert number first, then ask for a code. |

Shared failures:

| Key | Visitor message |
|---|---|
| `signed_out` (401) | You've signed out — sign in again, then enter the code. |
| `rate_limited` (429) | That's a lot of requests in a short time — please wait a minute and try again. |
| `network` (status 0) | Could not reach Seed Directory. Check your connection and try again. |
| Status 500 / any other failure | Something went wrong on our side. Please try again in a few minutes. |
| Fallback | We couldn't complete that just now. Please try again. |

Notes:

- For `code_incorrect`, the service already appends the tries remaining (e.g. "(4 tries left)") to its own message text. That count is useful and is the service's to supply; the mapped sentence above is written to stand with or without it.
- A resend against an already-verified address or number returns success, not an error — the component's existing "Already verified." note covers it, and no message is written for it here.
- The delivery notes on a successful resend (`deliveryNote` in `api.ts`) are existing, already channel-aware copy ("We've emailed you a 6-digit code." / "We've texted a 6-digit code to your alert number.", and the not-switched-on variants) and are unchanged by this pack.

### 3.4 Account panel — Change email — `POST /api/v1/account/email`

| Key | Placement | Visitor message |
|---|---|---|
| `validation_error` — email | Email field | Enter a valid email address. |
| `email_taken` (409) | Email field | That email already belongs to another account — use a different email address. |
| `signed_out` (401) | Form-level | You've signed out — sign in again and try again. |
| `rate_limited` (429) | Form-level | That's a lot of requests in a short time — please wait a minute and try again. |
| `network` (status 0) | Form-level | Could not update your email. Check your connection and try again. |
| Status 500 / any other failure | Form-level | Something went wrong on our side. Please try again in a few minutes. |
| Fallback | Form-level | We couldn't update your email. Please check the form and try again. |

Notes:

- Submitting the address already on the account returns success with no code sent; it is not a failure and gets no message.
- Its CodeEntry follow-on (verifying the new address) uses §3.3's email-channel map unchanged — no distinct messages exist for it in the service.

### 3.5 Account panel — Text alerts (alert phone) — `POST /api/v1/account/alert-phone`

| Key | Placement | Visitor message |
|---|---|---|
| `validation_error` — alert_phone | Alert number field | Enter your alert number as a 10-digit US phone number. |
| `invalid_phone` (422) | Alert number field | Enter your alert number as a 10-digit US phone number. |
| `signed_out` (401) | Form-level | You've signed out — sign in again and try again. |
| `rate_limited` (429) | Form-level | That's a lot of requests in a short time — please wait a minute and try again. |
| `network` (status 0) | Form-level | Could not save your text settings. Check your connection and try again. |
| Status 500 / any other failure | Form-level | Something went wrong on our side. Please try again in a few minutes. |
| Fallback | Form-level | We couldn't save your text settings. Please check the form and try again. |

Notes:

- `sms_opt_in` is always sent by this form as a boolean, so a validation failure on it is not reachable from the form; no message is written for it, and the fallback above covers it if that ever changes.
- Its CodeEntry follow-on (confirming a new alert number) uses §3.3's phone-channel map, including the phone-only `no_alert_phone` resend message — no distinct messages exist for it in the service.

### 3.6 Account panel — Delete account confirm — `POST /api/v1/account/delete`

The hint-side text stands as it is ("Type DELETE (in capitals) to confirm."). A mistyped confirmation is the field's own inline error (§8.7 of the design), replacing the current routing of that failure to the panel-head line:

| Key | Placement | Visitor message |
|---|---|---|
| `validation_error` — confirm (anything other than DELETE) | Confirmation field | That confirmation doesn't match — type DELETE in capitals, exactly as shown, to confirm. |
| `signed_out` (401) | Form-level, inside the delete form | You've signed out — sign in again and try again. |
| Status 500 / any other failure | Form-level, inside the delete form | We couldn't delete your account. Please try again in a few minutes. |

Note: the delete service itself refuses nothing else — with the confirmation correct, the only failures the route can return are the session and server failures above.

### 3.7 Gap notes — Report and Add Your Farm mapping layers (not rewritten)

Checked against SPEC §4.2.5 (subject named in the visitor's words, problem stated, fix stated). Both layers keep raw validator text from visitors and are sound in voice; the gaps are structural, for the 3.3 build to close:

**Report (`report-errors.ts`):**

1. **First field only.** On a `validation_error`, the map reads the first field named in the detail string and returns that one field's copy. Under the 3.3 set, a multi-field failure needs every failing field's message at once (inline lines plus character-identical summary entries), so the layer's single-string return is the gap — the per-field sentences themselves pass §4.2.5.
2. **`unknown_target` placement.** Its copy passes §4.2.5, but the failure belongs to the Page address name field; today it can only render as the form's single form-level message. The 3.3 build should attach it to that field.
3. Covered, not gaps: the message field's one sentence states both of its bounds (at least 5 characters, at most 4,000), so the too-short and too-long failures share it correctly; `turnstile_required` and `turnstile_failed` sharing one sentence is correct, because the visitor's fix is the same.

**Add Your Farm (`farm-errors.ts`):**

1. **First field only** — the same structural gap as Report's: one string per failure, where the 3.3 set needs per-field messages for every failing field at once.
2. **`not_farm_owner` (403) is unmapped.** The farm service refuses a submission from an account that is not the farm's verified owner with this code; the map has no case for it, so it lands on the fallback ("We couldn't send your submission. Please check the form and try again."), which misstates the problem as a form error and offers a fix that cannot work. This is the one clear §4.2.5 failure in either layer.
3. **About's message states only its minimum.** "Tell us a little about your farm (at least 10 characters)" is also the message for an over-length About (2,000-character maximum), where it states neither the problem nor the fix. Report's message field, which states both bounds, is the pattern to match.
4. **Varieties' message omits the format.** "List at least one variety you want listed" does not mention the one-per-line format the restated hint (§2(c) above) now states as a rule; if a format failure can reach this field, its message should name the format.

---

## 4. CodeEntry lifetime line (design §8.5, U7.1)

One sentence, rendered under the code field in every CodeEntry context, email and text alike. `{N}` is rendered by the build from the `CODE_TTL_MINUTES` constant — never a typed numeral.

> It works for {N} minutes.

---

## 5. Report success onward link text (design §8.1 / §6)

The Report success panel gains one link back to the page the report was about, taken from the form's own `target_type` / `target_ref` props. Link text pattern, by target type:

| Target | Link text |
|---|---|
| Variety | Back to the variety page |
| Seller | Back to the seller page |

— Wren, Copywriting / Storytelling

---

## 6. Supplement — Add Your Farm gap closures

Closes the three Add Your Farm copy gaps named in §3.7 (gaps 2–4 there; gap 1 is structural and stays with the build). Same rules as the head of this pack: US spelling, no prices, subject in the visitor's words + problem + fix (§4.2.5), codes are mapping keys only.

### 6.1 `not_farm_owner` (403) — form-level

| Key | Placement | Visitor message |
|---|---|---|
| `not_farm_owner` (403) | Form-level | This account isn’t the verified owner of your farm — sign in with the farm owner’s account, or submit your farm through Add Your Farm and we’ll verify it in review. |

Note: the verified-owner flag is set only by the directory, when an Add Your Farm submission is approved — no account setting grants it — so the two fixes above are the ones the product supports: the owner’s own sign-in, or the submission itself, which is the request path. This message replaces the fallback for this code, which misstated the refusal as a form error.

### 6.2 About — both bounds in one message

| Key | Placement | Visitor message |
|---|---|---|
| `validation_error` — about (too short or too long) | About field | Tell us a little about your farm (at least 10 characters, at most 2,000). |

Note: replaces the current About sentence, which states only the 10-character minimum and also serves the over-length failure (2,000-character maximum). Patterned on the Report form's message sentence, which states both of its bounds the same way and serves both of its failures.

### 6.3 Varieties — format message

| Key | Placement | Visitor message |
|---|---|---|
| `validation_error` — varieties (format) | Varieties field | List your varieties one per line. |

Note: a sibling to the existing message, not a replacement — "List at least one variety you want listed." stays for the empty failure, and this line serves a format failure only, naming the one-per-line format the §2(c) hint states as a rule.
