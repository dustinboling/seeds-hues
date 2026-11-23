/**
 * Human wording for Add Your Farm failures. The farm-submissions API answers with
 * problem+json ({ status, code, detail }); its `detail` strings are validator/diagnostic
 * text ("farm_name: Invalid input: expected string, received undefined",
 * "website: enter a full web address starting with https://") and are never shown to
 * visitors. Every outcome maps to plain copy here, in the same voice as the report
 * form (components/report/report-errors.ts).
 *
 * Tranche 3.3 (COPY-3-3 §3.7 + §6): `farmFailure` is the set's multi-field mapping —
 * per-field messages for every failing field at once. The per-field sentences are unchanged
 * except the three §6 gap closures: `not_farm_owner` mapped instead of the misleading
 * fallback, About stating both bounds, and the Varieties format sibling.
 */

import { validationFields } from "@/components/ui/field-states";
import type { MappedFormFailure } from "@/components/account/account-errors";

/** Shown when the server refuses the Turnstile token (missing, expired, used or invalid). */
export const FARM_TURNSTILE_FAILED = "The human check didn’t pass — please complete it and try again.";

export const FARM_NETWORK_ERROR = "Could not send. Check your connection and try again.";

/** Summary heading (COPY-3-3 §1): the admin construction re-verbed with the form's own verb. */
export const FARM_SUMMARY_HEADING = "Some fields need attention before sending for review.";

const FIELD_COPY: Record<string, string> = {
  farm_name: "Enter your farm’s name.",
  contact_name: "Enter a contact name.",
  contact_email: "Enter a valid email address.",
  city: "Enter your farm’s city.",
  state: "Choose your farm’s state from the list.",
  website: "Enter your full website address starting with https:// — for example https://www.myfarm.com.",
  about: "Tell us a little about your farm (at least 10 characters, at most 2,000).",
  varieties_empty: "List at least one variety you want listed.",
  varieties_format: "List your varieties one per line.",
  authorized: "Please confirm you own or represent this farm.",
  business_phone: "Enter your farm’s business phone as a 10-digit US number.",
  gbp_url: "Enter your full Google Business Profile link starting with https://.",
  instagram_url: "Enter your full Instagram link starting with https://.",
  tiktok_url: "Enter your full TikTok link starting with https://.",
  facebook_url: "Enter your full Facebook page link starting with https://.",
  wholesale: "Choose whether you sell wholesale too.",
  notes: "Keep any extra notes under 2,000 characters.",
};

const VARIETIES_FIELDS = ["varieties"] as const;

/**
 * The Varieties sibling (COPY-3-3 §6.3): the schema's min message ("list at least one variety")
 * and a missing value are the empty failure and keep the existing sentence; any other failure
 * naming the field names the one-per-line format the restated hint states as a rule.
 */
function varietiesMessage(detail: string): string {
  const segment = detail
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("varieties:"));
  if (segment === undefined || /list at least one variety|received undefined|required/i.test(segment)) return FIELD_COPY.varieties_empty!;
  return FIELD_COPY.varieties_format!;
}

/** Map a failed /api/v1/farm-submissions response to per-field + form-level messages. */
export function farmFailure(status: number, code: string, detail: string): MappedFormFailure {
  if (code === "network" || status === 0) return { fields: [], form: FARM_NETWORK_ERROR };
  if (code === "turnstile_required" || code === "turnstile_failed" || /turnstile/i.test(detail)) return { fields: [], form: FARM_TURNSTILE_FAILED };
  if (code === "rate_limited" || status === 429) return { fields: [], form: "That’s a lot of requests in a short time — please wait a minute and try again." };
  if (code === "not_farm_owner")
    return {
      fields: [],
      form: "This account isn’t the verified owner of your farm — sign in with the farm owner’s account, or submit your farm through Add Your Farm and we’ll verify it in review.",
    };
  if (code === "invalid_state") return { fields: [{ key: "state", message: FIELD_COPY.state! }], form: null };
  if (code === "invalid_phone") return { fields: [{ key: "business_phone", message: FIELD_COPY.business_phone! }], form: null };
  if (code === "validation_error") {
    const known = ["farm_name", "contact_name", "contact_email", "city", "state", "website", "about", ...VARIETIES_FIELDS, "authorized", "business_phone", "gbp_url", "instagram_url", "tiktok_url", "facebook_url", "wholesale", "notes"];
    const fields = validationFields(detail, known).map((key) => ({ key, message: key === "varieties" ? varietiesMessage(detail) : FIELD_COPY[key]! }));
    if (fields.length > 0) return { fields, form: null };
    return { fields: [], form: "Some of the details didn’t look right — please check the form and try again." };
  }
  if (status >= 500) return { fields: [], form: "Something went wrong on our side. Please try again in a few minutes." };
  return { fields: [], form: "We couldn’t send your submission. Please check the form and try again." };
}

/**
 * Map a failed /api/v1/farm-submissions response to a single message: the first field's
 * message, else the form-level message. Kept for single-string consumers; the form itself
 * renders the full multi-field mapping above.
 */
export function farmErrorMessage(status: number, code: string, detail: string): string {
  const mapped = farmFailure(status, code, detail);
  return mapped.fields[0]?.message ?? mapped.form ?? "We couldn’t send your submission. Please check the form and try again.";
}
