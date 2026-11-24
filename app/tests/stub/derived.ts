/**
 * The stub API's read-time derivation (tests/stub only): the live API
 * computes answer sentences, template descriptions, and counts from the
 * CURRENT listings on every read, so the stub must too — otherwise the
 * invalidation proof would assert against a frozen answer. This is a
 * DELIBERATELY INDEPENDENT port of the v2 algorithms (not an import of the
 * app's builders): if the app's port drifts, the stub still serves the live
 * behavior and the HTTP suite catches the drift. Guarded by
 * derived.test.ts against the same hardcoded strings.
 */
import type { ApiPublicListing, ApiVarietyDetail } from "../../src/data/types";

type Listing = Pick<ApiPublicListing, "seller" | "availability" | "lastCheckedAt">;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function friendlyDate(isoDate: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${MONTHS[month - 1]} ${day}, ${m[1]}`;
}

function proseCommonName(commonName: string): string {
  const [first, ...rest] = commonName.split(" / ");
  return rest.length > 0 ? `${first} (${rest.join(", ")})` : (first ?? commonName);
}

export function stubAnswer(varietyName: string, listings: Listing[]): string {
  if (listings.length === 0) return `No seller found selling ${varietyName} yet.`;
  const names = [...new Set(listings.map((l) => l.seller.name))];
  const latest = listings
    .map((l) => l.lastCheckedAt?.slice(0, 10))
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const date = latest ? friendlyDate(latest) : null;
  const roster = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names.at(-1)!}`;
  const lead = date ? `As of ${date}, ` : "";
  const verb = names.length === 1 ? "seller lists" : "sellers list";
  return `${lead}${names.length} ${verb} ${varietyName}: ${roster}${roster.endsWith(".") ? "" : "."}`;
}

export function stubTemplateDescription(facts: {
  varietyName: string;
  commonName: string;
  latinName: string | null;
  sellerCount: number;
}): string {
  const common = proseCommonName(facts.commonName);
  const article = /^[aeiou]/i.test(common) ? "an" : "a";
  const head = `${facts.varietyName} is ${article} ${common} variety${facts.latinName ? ` (${facts.latinName})` : ""}.`;
  const tail =
    facts.sellerCount === 0
      ? `No seller found selling ${facts.varietyName} yet.`
      : facts.sellerCount === 1
        ? "It is listed by 1 seed seller in this directory."
        : `It is listed by ${facts.sellerCount} seed sellers in this directory.`;
  return `${head} ${tail}`;
}

/** Recompute every derived field of a detail from its current listings. */
export function rederive(detail: ApiVarietyDetail): ApiVarietyDetail {
  const sellers = new Set(detail.listings.map((l) => l.seller.slug));
  const latest = detail.listings
    .map((l) => l.lastCheckedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  return {
    ...detail,
    listingCount: detail.listings.length,
    sellerCount: sellers.size,
    inStockCount: detail.listings.filter((l) => l.availability === "in_stock").length,
    lastCheckedAt: latest ? (detail.listings.find((l) => l.lastCheckedAt === latest)?.lastCheckedAt ?? null) : null,
    answer: stubAnswer(detail.varietyName, detail.listings),
    templateDescription: stubTemplateDescription({
      varietyName: detail.varietyName,
      commonName: detail.plant.commonName,
      latinName: detail.plant.latinName,
      sellerCount: sellers.size,
    }),
  };
}
