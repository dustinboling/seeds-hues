/**
 * Human wording for the account-form failures (Tranche 3.3, COPY-3-3.md
 * sections 1 and 3), ported from
 * v2/components/account/account-errors.ts: create account, sign in, code
 * entry, and the account panel's change-email, alert-phone, and
 * delete-confirm forms. The account API answers with problem+json
 * ({ status, code, detail }); its `detail` strings are
 * validator/diagnostic text and are never shown to visitors — every
 * outcome maps to plain copy here, keyed on the API error `code`
 * (`callApi` already returns it), in the same voice as the report and
 * farm forms. Wren's sentences are rendered verbatim, punctuation
 * included; codes below are mapping keys for the build only.
 */

import { validationFields } from "../ui/field-states";

/** A mapped failure: per-field messages in form order, plus an optional form-level message. */
export interface MappedFormFailure {
  fields: { key: string; message: string }[];
  form: string | null;
}

/** Summary headings (COPY-3-3 §1): the admin construction re-verbed with each form's own verb. */
export const CREATE_SUMMARY_HEADING = "Some fields need attention before creating your account.";
export const SIGNIN_SUMMARY_HEADING = "Some fields need attention before signing in.";
export const CHANGE_EMAIL_SUMMARY_HEADING = "Some fields need attention before updating.";
export const ALERT_PHONE_SUMMARY_HEADING = "Some fields need attention before saving.";
/** Tranche 3.2 headings (same construction; flagged as new strings in the build's PR body). */
export const WAITLIST_JOIN_SUMMARY_HEADING = "Some fields need attention before joining the waiting list.";
export const FINISH_PROFILE_SUMMARY_HEADING = "Some fields need attention before finishing your account.";

/** Sentences Wren repeats byte-identically across the account maps. */
const HUMAN_CHECK_FAILED = "The human check didn't pass — please complete it and try again.";
const RATE_LIMITED = "That's a lot of requests in a short time — please wait a minute and try again.";
const SERVER_ERROR = "Something went wrong on our side. Please try again in a few minutes.";
const SIGNED_OUT_PANEL = "You've signed out — sign in again and try again.";

/** Shared form-level outcomes: network, then code-keyed, then the 500 line. Null means the caller falls back to its own mapped generic. */
function sharedForm(status: number, code: string, network: string): string | null {
  if (code === "network" || status === 0) return network;
  if (code === "turnstile_failed" || code === "turnstile_required") return HUMAN_CHECK_FAILED;
  if (code === "rate_limited" || status === 429) return RATE_LIMITED;
  if (status >= 500) return SERVER_ERROR;
  if (code === "signed_out") return SIGNED_OUT_PANEL;
  return null;
}

/** A validation_error can name a Turnstile field the schema rejected — that is a form failure. */
function validationFormMessage(detail: string): string | null {
  if (/turnstile/i.test(detail)) return HUMAN_CHECK_FAILED;
  return null;
}

/**
 * Map a failed POST /api/v1/account response (COPY-3-3 §3.1). The
 * account-type group and the SMS opt-in send only values the schema
 * always accepts, so no group message exists: a group name in the detail
 * falls through to the form-level fallback.
 */
export function createAccountFailure(status: number, code: string, detail: string): MappedFormFailure {
  const FALLBACK = "We couldn't create your account. Please check the form and try again.";
  const FIELD_COPY: Record<string, string> = {
    name: "Enter your name.",
    email: "Enter a valid email address.",
    phone: "Enter your phone number as a 10-digit US number.",
    zip: "Enter your ZIP code as 5 digits.",
  };
  if (code === "invalid_phone") return { fields: [{ key: "phone", message: FIELD_COPY.phone as string }], form: null };
  if (code === "unknown_zip")
    return { fields: [{ key: "zip", message: "Your ZIP code isn't one we recognize — check the 5 digits and try again." }], form: null };
  if (code === "email_taken")
    return {
      fields: [{ key: "email", message: "That email already has an account — sign in with your email and phone number instead, or use a different email address." }],
      form: null,
    };
  if (code === "validation_error") {
    const fields = validationFields(detail, ["name", "email", "phone", "zip"]).map((key) => ({ key, message: FIELD_COPY[key] as string }));
    const form = validationFormMessage(detail) ?? (fields.length === 0 ? FALLBACK : null);
    return { fields, form };
  }
  return { fields: [], form: sharedForm(status, code, "Could not create your account. Check your connection and try again.") ?? FALLBACK };
}

/**
 * Map a failed POST /api/v1/account/sign-in response (COPY-3-3 §3.2).
 * Format and empty failures are per-field; the credential failure is one
 * form-level, pair-neutral message that never discloses which half of the
 * email + phone pair failed.
 */
export function signInFailure(status: number, code: string, detail: string): MappedFormFailure {
  const FALLBACK = "We couldn't sign you in. Please check the form and try again.";
  if (code === "no_match") return { fields: [], form: "We couldn't find an account with that email and phone number together — check both and try again." };
  if (code === "too_many_attempts") return { fields: [], form: "You've tried to sign in too many times — please wait a while and try again." };
  if (code === "validation_error") {
    const FIELD_COPY: Record<string, string> = { email: "Enter a valid email address.", phone: "Enter your phone number." };
    const fields = validationFields(detail, ["email", "phone"]).map((key) => ({ key, message: FIELD_COPY[key] as string }));
    const form = validationFormMessage(detail) ?? (fields.length === 0 ? FALLBACK : null);
    return { fields, form };
  }
  return { fields: [], form: sharedForm(status, code, "Could not sign you in. Check your connection and try again.") ?? FALLBACK };
}

/**
 * Map a failed CodeEntry verify/resend response (COPY-3-3 §3.3), either
 * channel. Every message is the code field's inline error except
 * signed_out, which is form-level. For code_incorrect, the service
 * appends the tries remaining to its own detail text — that count is
 * parsed out and appended to the mapped sentence, so the sentence stands
 * with it as Wren wrote it to.
 */
export function codeFailure(status: number, code: string, detail: string): MappedFormFailure {
  const FALLBACK = "We couldn't complete that just now. Please try again.";
  const field = (message: string): MappedFormFailure => ({ fields: [{ key: "code", message }], form: null });
  if (code === "validation_error") return field("Enter the 6-digit code.");
  if (code === "code_incorrect") {
    const tries = /\(\d+ (?:try|tries) left\)/.exec(detail)?.[0];
    return field(tries ? `That code isn't right — check it and try again. ${tries}` : "That code isn't right — check it and try again.");
  }
  if (code === "code_expired") return field("That code has expired — use “Send a new code” to get a fresh one.");
  if (code === "code_dead") return field("Too many wrong tries — that code no longer works. Use “Send a new code” to get a fresh one.");
  if (code === "no_code") return field("There's no active code — use “Send a new code” to get one.");
  if (code === "resend_too_soon") return field("A code was just sent — wait a minute, then use “Send a new code” again.");
  if (code === "resend_limit") return field("That's the most codes we can send in an hour — please try again later.");
  if (code === "no_alert_phone") return field("Add an alert number first, then ask for a code.");
  if (code === "signed_out") return { fields: [], form: "You've signed out — sign in again, then enter the code." };
  if (code === "network" || status === 0) return field("Could not reach Seed Directory. Check your connection and try again.");
  if (code === "rate_limited" || status === 429) return field(RATE_LIMITED);
  if (status >= 500) return field(SERVER_ERROR);
  return field(FALLBACK);
}

/** Map a failed POST /api/v1/account/email response (COPY-3-3 §3.4). */
export function changeEmailFailure(status: number, code: string, detail: string): MappedFormFailure {
  const FALLBACK = "We couldn't update your email. Please check the form and try again.";
  if (code === "email_taken") return { fields: [{ key: "email", message: "That email already belongs to another account — use a different email address." }], form: null };
  if (code === "validation_error") {
    const fields = validationFields(detail, ["email"]).map((key) => ({ key, message: "Enter a valid email address." }));
    const form = validationFormMessage(detail) ?? (fields.length === 0 ? FALLBACK : null);
    return { fields, form };
  }
  return { fields: [], form: sharedForm(status, code, "Could not update your email. Check your connection and try again.") ?? FALLBACK };
}

/** Map a failed POST /api/v1/account/alert-phone response (COPY-3-3 §3.5). */
export function alertPhoneFailure(status: number, code: string, detail: string): MappedFormFailure {
  const FALLBACK = "We couldn't save your text settings. Please check the form and try again.";
  const PHONE_MESSAGE = "Enter your alert number as a 10-digit US phone number.";
  if (code === "invalid_phone") return { fields: [{ key: "alert_phone", message: PHONE_MESSAGE }], form: null };
  if (code === "validation_error") {
    // sms_opt_in always sends a boolean, so a failure naming it is not reachable from the form;
    // the fallback covers it if that ever changes.
    const fields = validationFields(detail, ["alert_phone"]).map((key) => ({ key, message: PHONE_MESSAGE }));
    const form = validationFormMessage(detail) ?? (fields.length === 0 ? FALLBACK : null);
    return { fields, form };
  }
  return { fields: [], form: sharedForm(status, code, "Could not save your text settings. Check your connection and try again.") ?? FALLBACK };
}

/**
 * Map a failed waitlist alert-step submission (Tranche 3.2): POST
 * /api/v1/account with join_variety. Email and phone failures are
 * per-field (COPY-3-3 §3.1's sentences); a listed race passes the API's
 * own friendly message through as the form message. The
 * recognized-contact answer is never a failure — it is a 200 the caller
 * branches on.
 */
export function waitlistJoinFailure(status: number, code: string, detail: string): MappedFormFailure {
  const FALLBACK = "We couldn't join the waiting list. Please check the form and try again.";
  if (code === "invalid_phone") return { fields: [{ key: "phone", message: "Enter your phone number as a 10-digit US number." }], form: null };
  if (code === "already_listed") return { fields: [], form: detail };
  if (code === "no_match") return { fields: [], form: "We couldn't join the waiting list with that email — please try again." };
  if (code === "resend_too_soon") return { fields: [], form: "A code was just sent — wait a minute, then try again." };
  if (code === "resend_limit") return { fields: [], form: "That's the most codes we can send in an hour — please try again later." };
  if (code === "validation_error") {
    const FIELD_COPY: Record<string, string> = { email: "Enter a valid email address.", phone: "Enter your phone number as a 10-digit US number." };
    const fields = validationFields(detail, ["email", "phone"]).map((key) => ({ key, message: FIELD_COPY[key] as string }));
    const form = validationFormMessage(detail) ?? (fields.length === 0 ? FALLBACK : null);
    return { fields, form };
  }
  return { fields: [], form: sharedForm(status, code, "Could not join the waiting list. Check your connection and try again.") ?? FALLBACK };
}

/**
 * Map a failed POST /api/v1/account/profile response (Tranche 3.2,
 * §3.2.5): the deferred name/ZIP failures are per-field (COPY-3-3 §3.1's
 * sentences); the account-type group sends only values the schema
 * accepts, so it has no message.
 */
export function profileFailure(status: number, code: string, detail: string): MappedFormFailure {
  const FALLBACK = "We couldn't save your details. Please check the form and try again.";
  if (code === "unknown_zip") return { fields: [{ key: "zip", message: "Your ZIP code isn't one we recognize — check the 5 digits and try again." }], form: null };
  if (code === "validation_error") {
    const FIELD_COPY: Record<string, string> = { name: "Enter your name.", zip: "Enter your ZIP code as 5 digits." };
    const fields = validationFields(detail, ["name", "zip"]).map((key) => ({ key, message: FIELD_COPY[key] as string }));
    const form = validationFormMessage(detail) ?? (fields.length === 0 ? FALLBACK : null);
    return { fields, form };
  }
  return { fields: [], form: sharedForm(status, code, "Could not save your details. Check your connection and try again.") ?? FALLBACK };
}

/**
 * Map a failed POST /api/v1/account/sign-in/code response (Tranche 3.2,
 * §11.1): the email facts are per-field on the sign-in form's email
 * input; human-check, rate-limit, and connection failures are
 * form-level.
 */
export function signInCodeFailure(status: number, code: string, detail: string): MappedFormFailure {
  const FALLBACK = "We couldn't email you a code. Please check the form and try again.";
  if (code === "no_account") return { fields: [{ key: "email", message: "We couldn't find an account with that email — check it and try again." }], form: null };
  if (code === "has_phone") return { fields: [{ key: "email", message: "This account has a phone number — sign in with your email and phone number instead." }], form: null };
  if (code === "validation_error") {
    const fields = validationFields(detail, ["email"]).map((key) => ({ key, message: "Enter a valid email address." }));
    const form = validationFormMessage(detail) ?? (fields.length === 0 ? FALLBACK : null);
    return { fields, form };
  }
  if (code === "resend_too_soon") return { fields: [], form: "A code was just sent — wait a minute, then try again." };
  if (code === "resend_limit") return { fields: [], form: "That's the most codes we can send in an hour — please try again later." };
  return { fields: [], form: sharedForm(status, code, "Could not email you a code. Check your connection and try again.") ?? FALLBACK };
}

/** Map a failed POST /api/v1/account/delete response (COPY-3-3 §3.6). */
export function deleteAccountFailure(status: number, code: string, detail: string): MappedFormFailure {
  if (code === "validation_error") {
    const fields = validationFields(detail, ["confirm"]);
    if (fields.length > 0) return { fields: [{ key: "confirm", message: "That confirmation doesn't match — type DELETE in capitals, exactly as shown, to confirm." }], form: null };
  }
  if (code === "signed_out" || status === 401) return { fields: [], form: SIGNED_OUT_PANEL };
  return { fields: [], form: "We couldn't delete your account. Please try again in a few minutes." };
}
