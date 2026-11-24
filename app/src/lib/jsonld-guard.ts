/**
 * No-price JSON-LD guard, ported from v2/lib/seo/jsonld.ts. Throws if any
 * prohibited @type or key appears anywhere in a JSON-LD payload.
 *
 * Bea's prohibited list (brief §2, binding): Product, Offer, AggregateOffer,
 * AggregateRating, Review, and any `price` key. The port keeps v2's shipped
 * extensions (offers/lowPrice/aggregateRating/review keys, FAQPage,
 * priceValidUntil) — narrowing the live guard would weaken the gate.
 * Extended only with Bea's sign-off.
 */
export const PROHIBITED_JSONLD = [
  "Product",
  "AggregateOffer",
  "Offer",
  "offers",
  "price",
  "lowPrice",
  "FAQPage",
  "AggregateRating",
  "Review",
  "priceValidUntil",
  "aggregateRating",
  "review",
] as const;

export class ProhibitedJsonLdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProhibitedJsonLdError";
  }
}

function isProhibitedName(name: string): boolean {
  return (PROHIBITED_JSONLD as readonly string[]).includes(name);
}

/** Throws if any prohibited @type or key appears anywhere in the graph. */
export function assertNoProhibitedJsonLd(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoProhibitedJsonLd(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (isProhibitedName(key)) throw new ProhibitedJsonLdError(`Prohibited JSON-LD key ${key} at ${path}`);
    if (key === "@type") {
      const types = Array.isArray(entry) ? entry : [entry];
      for (const type of types) {
        if (isProhibitedName(String(type)))
          throw new ProhibitedJsonLdError(`Prohibited JSON-LD @type ${String(type)} at ${path}`);
      }
    }
    assertNoProhibitedJsonLd(entry, `${path}.${key}`);
  }
}
