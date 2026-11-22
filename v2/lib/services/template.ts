/**
 * Deterministic template descriptions (FINAL §1.3 "Descriptions"). Built ONLY from sourced
 * structured facts: variety name, plant common + Latin name, breeder (when sourced — no breeder
 * field exists in the Phase 1 data, so it is never mentioned) and the live distinct-seller
 * count. No LLM text, no invented traits.
 */
import { zeroSellerSentence } from "@/lib/zero-seller";

export interface TemplateFacts {
  varietyName: string;
  commonName: string;
  latinName: string | null;
  /** Distinct sellers — never a listing count (Dustin's ruling, 2026-11-21). */
  sellerCount: number;
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
    f.sellerCount === 0
      ? zeroSellerSentence(f.varietyName)
      : f.sellerCount === 1
        ? "It is listed by 1 seed seller in this directory."
        : `It is listed by ${f.sellerCount} seed sellers in this directory.`,
  );
  return parts.join(" ");
}

/** Factual meta-description fragment (S1): "Available from N seller(s)". */
export function availabilityPhrase(sellerCount: number, varietyName: string): string {
  if (sellerCount === 0) return zeroSellerSentence(varietyName);
  return `Available from ${sellerCount} seller${sellerCount === 1 ? "" : "s"}`;
}
