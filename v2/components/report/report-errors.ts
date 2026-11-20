/**
 * Human wording for /report failures. The reports API answers with problem+json
 * ({ status, code, detail }); its `detail` strings are validator/diagnostic text
 * ("turnstile_token is required", "message: Too small: expected string to have >=5 characters")
 * and are never shown to visitors. Every outcome maps to plain copy here.
 */

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

/** Map a failed /api/v1/reports response to the message the form shows. */
export function reportErrorMessage(status: number, code: string, detail: string): string {
  if (code === "network" || status === 0) return REPORT_NETWORK_ERROR;
  if (code === "turnstile_required" || code === "turnstile_failed" || /turnstile/i.test(detail)) return REPORT_TURNSTILE_FAILED;
  if (code === "rate_limited" || status === 429) return "That’s a lot of requests in a short time — please wait a minute and try again.";
  if (code === "unknown_target") return "We couldn’t find a page with that address name. Check the seller or variety and the spelling, then try again.";
  if (code === "validation_error") {
    // Validator detail is "field: message; field: message" — name the first field in plain words.
    const field = /^([a-z_]+):/.exec(detail)?.[1];
    if (field && FIELD_COPY[field]) return FIELD_COPY[field];
    return "Some of the details didn’t look right — please check the form and try again.";
  }
  if (status >= 500) return "Something went wrong on our side. Please try again in a few minutes.";
  return "We couldn’t send your request. Please check the form and try again.";
}
