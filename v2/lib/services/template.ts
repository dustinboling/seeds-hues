/**
 * Deterministic template descriptions (FINAL §1.3 "Descriptions"). Built ONLY from sourced
 * structured facts: variety name, plant common + Latin name, breeder (when sourced — no breeder
 * field exists in the Phase 1 data, so it is never mentioned) and the live listing count.
 * No LLM text, no invented traits.
 */
export interface TemplateFacts {
  varietyName: string;
  commonName: string;
  latinName: string | null;
  listingCount: number;
  breeder?: string | null;
}

function article(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** "Cornflower / Bachelor's Buttons" → "Cornflower (Bachelor's Buttons)" reads better in prose. */
export function proseCommonName(commonName: string): string {
  const [first, ...rest] = commonName.split(" / ");
  return rest.length ? `${first} (${rest.join(", ")})` : (first ?? commonName);
}

export function templateDescription(f: TemplateFacts): string {
  const common = proseCommonName(f.commonName);
  const parts = [`${f.varietyName} is ${article(common)} ${common} variety${f.latinName ? ` (${f.latinName})` : ""}.`];
  if (f.breeder) parts.push(`It was bred by ${f.breeder}.`);
  parts.push(
    f.listingCount === 0
      ? "No seller in this directory lists it yet."
      : f.listingCount === 1
        ? "It is listed by 1 independent seed seller in this directory."
        : `It is listed by ${f.listingCount} independent seed sellers in this directory.`,
  );
  return parts.join(" ");
}

/** Factual meta-description fragment (S1): "Available from N supplier(s)". */
export function availabilityPhrase(listingCount: number): string {
  if (listingCount === 0) return "No sellers listed yet";
  return `Available from ${listingCount} supplier${listingCount === 1 ? "" : "s"}`;
}
