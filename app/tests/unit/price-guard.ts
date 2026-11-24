/**
 * The suite's no-price check (Bea §1.2's template-level rendered-HTML
 * check, automated): the prohibited JSON-LD strings hardcoded from the
 * audit (never imported from the app), plus price patterns — a dollar
 * amount, or "price" as a field label. Runs over script-stripped HTML
 * (page data + JSON-LD are asserted separately) with the footer's policy
 * sentence pinned-and-scrubbed (the one known-good "price" hit — Quinn
 * reads the hit rather than failing on the word).
 *
 * Sensitivity is proven, not assumed: price-guard.test.ts feeds this
 * violations, including a price string inside a listing note, and asserts
 * each one fires.
 */

/** Bea §1.1's prohibited list, hardcoded from the audit (not the app). */
export const PROHIBITED_STRINGS = [
  "Product",
  "Offer",
  "AggregateOffer",
  "AggregateRating",
  "Review",
  "FAQPage",
  "price",
  "lowPrice",
  "offers",
  "aggregateRating",
  "review",
  "priceValidUntil",
];

const DOLLAR_AMOUNT = /\$\s*\d/;
const PRICE_LABEL = /("[Pp]rice"|\b[Pp]rices?)\s*:/;
const FOOTER_POLICY = "No prices are shown.";

export function stripScriptElements(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/g, "");
}

/**
 * Every price-rule violation in rendered HTML (empty = clean). Throws
 * nothing; callers assert on the returned list. The footer policy sentence
 * must be present (its absence is itself reported — the scrub can never
 * silently hide a regression).
 */
export function findPriceViolations(html: string): string[] {
  const bodiless = stripScriptElements(html);
  const violations: string[] = [];
  if (!bodiless.includes(FOOTER_POLICY)) violations.push("footer policy sentence missing");
  const scrubbed = bodiless.replace(FOOTER_POLICY, "");
  for (const forbidden of PROHIBITED_STRINGS) {
    if (scrubbed.includes(forbidden)) violations.push(`prohibited string ${JSON.stringify(forbidden)}`);
  }
  if (DOLLAR_AMOUNT.test(scrubbed)) violations.push("dollar amount");
  if (PRICE_LABEL.test(scrubbed)) violations.push("price label");
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const raw = match[1]!;
    for (const forbidden of PROHIBITED_STRINGS) {
      if (raw.includes(forbidden)) violations.push(`JSON-LD contains ${JSON.stringify(forbidden)}`);
    }
    if (DOLLAR_AMOUNT.test(raw)) violations.push("JSON-LD contains a dollar amount");
  }
  return violations;
}
