/**
 * Human wording for /report failures, ported from
 * v2/components/report/report-errors.ts. The reports API answers with
 * problem+json ({ status, code, detail }); its `detail` strings are
 * validator/diagnostic text ("turnstile_token is required", "message:
 * Too small: expected string to have >=5 characters") and are never
 * shown to visitors. Every outcome maps to plain copy here.
 *
 * Tranche 3.3 (COPY-3-3 §3.7): the per-field sentences below are
 * unchanged — they already pass SPEC §4.2.5 — but the single-string
 * return only ever named the first failing field. `reportFailure` is
 * the set's multi-field mapping: per-field messages for every failing
 * field at once, with `unknown_target` attached to the Page address
 * name field instead of the form.
 */

import { validationFields } from "../ui/field-states";
import type { MappedFormFailure } from "../account/account-errors";

/** Shown when the visitor submits before the Turnstile widget has produced a token. */
export const REPORT_TURNSTILE_PENDING = "The human check hasn’t loaded yet — give it a moment, or reload the page if it doesn’t appear.";

/** Shown when the server refuses the Turnstile token (missing, expired, used or invalid). */
export const REPORT_TURNSTILE_FAILED = "The human check didn’t pass — please complete it and try again.";

export const REPORT_NETWORK_ERROR = "Could not send. Check your connection and try again.";

const FIELD_COPY: Record<string, string> = {
  target_ref: "Check the page address name — use the last part of the page’s URL, e.g. songbird-seed-co.",
  target_type: "Choose whether this is about a seller or a variety.",
  type: "Choose what you would like to do.",
  message: "Please add a few words of detail (at least 5 characters, at most 4,000).",
  contact: "Please enter a valid email address so we can reply.",
};

/** Summary heading (COPY-3-3 §1): the admin construction re-verbed with the form's own verb. */
export const REPORT_SUMMARY_HEADING = "Some fields need attention before sending.";

/**
 * Map a failed /api/v1/reports response to per-field messages for every
 * failing field at once, plus an optional form-level message.
 * `unknown_target` attaches to the Page address name (target_ref) field;
 * Turnstile, rate-limit, network, server, and unmapped failures are
 * form-level. Raw detail never leaves this module.
 */
export function reportFailure(status: number, code: string, detail: string): MappedFormFailure {
  if (code === "network" || status === 0) return { fields: [], form: REPORT_NETWORK_ERROR };
  if (code === "turnstile_required" || code === "turnstile_failed" || /turnstile/i.test(detail)) return { fields: [], form: REPORT_TURNSTILE_FAILED };
  if (code === "rate_limited" || status === 429) return { fields: [], form: "That’s a lot of requests in a short time — please wait a minute and try again." };
  if (code === "unknown_target")
    return { fields: [{ key: "target_ref", message: "We couldn’t find a page with that address name. Check the seller or variety and the spelling, then try again." }], form: null };
  if (code === "validation_error") {
    const fields = validationFields(detail, ["target_ref", "target_type", "type", "message", "contact"]).map((key) => ({ key, message: FIELD_COPY[key] as string }));
    if (fields.length > 0) return { fields, form: null };
    return { fields: [], form: "Some of the details didn’t look right — please check the form and try again." };
  }
  if (status >= 500) return { fields: [], form: "Something went wrong on our side. Please try again in a few minutes." };
  return { fields: [], form: "We couldn’t send your request. Please check the form and try again." };
}

/** Map a failed /api/v1/reports response to the message the form shows. */
export function reportErrorMessage(status: number, code: string, detail: string): string {
  if (code === "network" || status === 0) return REPORT_NETWORK_ERROR;
  if (code === "turnstile_required" || code === "turnstile_failed" || /turnstile/i.test(detail)) return REPORT_TURNSTILE_FAILED;
  if (code === "rate_limited" || status === 429) return "That’s a lot of requests in a short time — please wait a minute and try again.";
  if (code === "unknown_target") return "We couldn’t find a page with that address name. Check the seller or variety and the spelling, then try again.";
  if (code === "validation_error") {
    // Validator detail is "field: message; field: message" — name the first field in plain words.
    const field = /^([a-z_]+):/.exec(detail)?.[1];
    if (field && FIELD_COPY[field]) return FIELD_COPY[field] as string;
    return "Some of the details didn’t look right — please check the form and try again.";
  }
  if (status >= 500) return "Something went wrong on our side. Please try again in a few minutes.";
  return "We couldn’t send your request. Please check the form and try again.";
}
