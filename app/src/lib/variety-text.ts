/**
 * Data-built variety prose: the answer sentence (v2/lib/services/catalog.ts
 * answerSentence) and deterministic template descriptions
 * (v2/lib/services/template.ts templateDescription). Built ONLY from sourced
 * structured facts — no invented traits.
 */
import { formatFriendlyDate, proseCommonName } from "./format";
import { zeroSellerSentence } from "./zero-seller";

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

/** "As of Nov 15, 2026, 3 sellers list King's Ransom: A, B and C." — data only. */
export function answerSentence(
  varietyName: string,
  listings: { seller: { name: string }; lastCheckedAt: string | null }[],
): string {
  if (listings.length === 0) return zeroSellerSentence(varietyName);
  const names = [...new Set(listings.map((l) => l.seller.name))];
  const raw = listings
    .map((l) => l.lastCheckedAt?.slice(0, 10))
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const date = raw ? formatFriendlyDate(raw) : null;
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names.at(-1)!}`;
  const n = names.length;
  const lead = date ? `As of ${date}, ` : "";
  const verb = n === 1 ? "seller lists" : "sellers list";
  // "Songbird Seed Co." already ends the sentence.
  return `${lead}${n} ${verb} ${varietyName}: ${list}${list.endsWith(".") ? "" : "."}`;
}
