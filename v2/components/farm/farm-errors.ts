/**
 * Human wording for Add Your Farm failures. The farm-submissions API answers with
 * problem+json ({ status, code, detail }); its `detail` strings are validator/diagnostic
 * text ("farm_name: Invalid input: expected string, received undefined",
 * "website: enter a full web address starting with https://") and are never shown to
 * visitors. Every outcome maps to plain copy here, in the same voice as the report
 * form (components/report/report-errors.ts).
 */

/** Shown when the server refuses the Turnstile token (missing, expired, used or invalid). */
export const FARM_TURNSTILE_FAILED = "The human check didn’t pass — please complete it and try again.";

export const FARM_NETWORK_ERROR = "Could not send. Check your connection and try again.";

const FIELD_COPY: Record<string, string> = {
  farm_name: "Enter your farm’s name.",
  contact_name: "Enter a contact name.",
  contact_email: "Enter a valid email address.",
  city: "Enter your farm’s city.",
  state: "Choose your farm’s state from the list.",
  website: "Enter your full website address starting with https:// — for example https://www.myfarm.com.",
  about: "Tell us a little about your farm (at least 10 characters).",
  varieties: "List at least one variety you want listed.",
  authorized: "Please confirm you own or represent this farm.",
  business_phone: "Enter your farm’s business phone as a 10-digit US number.",
  gbp_url: "Enter your full Google Business Profile link starting with https://.",
  instagram_url: "Enter your full Instagram link starting with https://.",
  tiktok_url: "Enter your full TikTok link starting with https://.",
  facebook_url: "Enter your full Facebook page link starting with https://.",
  wholesale: "Choose whether you sell wholesale too.",
  notes: "Keep any extra notes under 2,000 characters.",
};

/** Map a failed /api/v1/farm-submissions response to the message the form shows. */
export function farmErrorMessage(status: number, code: string, detail: string): string {
  if (code === "network" || status === 0) return FARM_NETWORK_ERROR;
  if (code === "turnstile_required" || code === "turnstile_failed" || /turnstile/i.test(detail)) return FARM_TURNSTILE_FAILED;
  if (code === "rate_limited" || status === 429) return "That’s a lot of requests in a short time — please wait a minute and try again.";
  if (code === "invalid_state") return FIELD_COPY.state!;
  if (code === "invalid_phone") return FIELD_COPY.business_phone!;
  if (code === "validation_error") {
    // Validator detail is "field: message; field: message" — name the first field in plain words.
    const field = /^([a-z_]+):/.exec(detail)?.[1];
    if (field && FIELD_COPY[field]) return FIELD_COPY[field];
    return "Some of the details didn’t look right — please check the form and try again.";
  }
  if (status >= 500) return "Something went wrong on our side. Please try again in a few minutes.";
  return "We couldn’t send your submission. Please check the form and try again.";
}
