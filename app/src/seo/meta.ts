/**
 * Page metadata builders — ported from v2/lib/seo/metadata.ts (same titles,
 * same descriptions, same canonical/OG/Twitter composition; the Next
 * Metadata type replaced by this tree's plain HeadTags). Only the builders
 * Slice 2 templates need are ported; slug-template builders arrive with
 * their slices.
 */
import { imageUrl } from "../lib/images";
import { shortCommonName } from "../lib/format";
import { ZERO_SELLER_TITLE } from "../lib/zero-seller";
import { SITE_NAME, SITE_URL } from "../site";

export function clip(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trim()}…`;
}

export interface OgImage {
  url: string;
  width: number;
  height: number;
  alt: string;
  /** MIME type; omitted when the served format is negotiated (image CDN, format=auto). */
  type?: string;
}

/** Generated OG card (`/og/{kind}/{slug}`, 1200×630 PNG). */
export function ogImage(kind: "variety" | "seller" | "crop" | "site", slug: string, alt: string): OgImage {
  return { url: `${SITE_URL}/og/${kind}/${slug}`, width: 1200, height: 630, alt, type: "image/png" };
}

/**
 * Own-work variety or crop illustration as the share image: the stored media
 * path rendered as a 1120-wide scale-down transformation from our own image
 * CDN. No `type`: format=auto negotiates the format per client, so a fixed
 * MIME type could be wrong. 1120×2240 is the illustration standard.
 */
export function mediaOgImage(path: string, alt: string): OgImage {
  return { url: imageUrl(path, { width: 1120 }), width: 1120, height: 2240, alt };
}

/**
 * Plain head tags for one page (rendered by the route's +Head). og:url (the
 * page's canonical) and og:image (the share image) stay separate fields —
 * v2's openGraph.url vs images[0].url — so the two can never collapse.
 */
export interface HeadTags {
  /** Full document title, template already applied. */
  title: string;
  description: string;
  canonical: string;
  robots: string;
  og: {
    /** The page's canonical URL (og:url). */
    url: string;
    /** The share image URL (og:image) — never the canonical. */
    image: string;
    width: number;
    height: number;
    alt: string;
    /** MIME type; omitted when the served format is negotiated (image CDN, format=auto). */
    type?: string;
    title: string;
    description: string;
  };
  twitter: { card: "summary_large_image"; title: string; description: string; image: string };
}

export function pageHead(opts: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  follow?: boolean;
  og?: OgImage;
  absoluteTitle?: boolean;
}): HeadTags {
  const image = opts.og ?? ogImage("site", "default", SITE_NAME);
  const canonical = opts.path === "/" ? SITE_URL : `${SITE_URL}${opts.path}`;
  const title = opts.absoluteTitle ? opts.title : `${opts.title} | ${SITE_NAME}`;
  const robots = opts.noindex ? `noindex, ${opts.follow ?? true ? "follow" : "nofollow"}` : "index, follow";
  return {
    title,
    description: opts.description,
    canonical,
    robots,
    og: {
      url: canonical,
      image: image.url,
      width: image.width,
      height: image.height,
      alt: image.alt,
      ...(image.type ? { type: image.type } : {}),
      title: opts.title,
      description: opts.description,
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, image: image.url },
  };
}

const sellerCount = (n: number) => (n === 0 ? ZERO_SELLER_TITLE : `${n} Seller${n === 1 ? "" : "s"}`);

/** "Where to buy" intent, written from facts: variety, crop, and the number of sellers listing it. */
export function varietyTitle(v: {
  varietyName: string;
  plant: { commonName: string };
  listings: { seller: { slug: string } }[];
}): string {
  const n = new Set(v.listings.map((l) => l.seller.slug)).size;
  return `${v.varietyName} ${shortCommonName(v.plant.commonName)} Seeds — Where to Buy (${sellerCount(n)})`;
}

const DESCRIPTION_MAX = 160;

/** Exact Wren clause (48 chars): the only optional element of Templates A and B. Never clipped. */
const DIRECTORY_CLAUSE = "Sellers list packet sizes in the Seed Directory.";

/** Exact Wren clause (61 chars): renders immediately after the head in Template C. */
const HONESTY_CLAUSE = "No US sellers currently list this variety. Join the waitlist.";

/** Template B closing when a packet range rendered. */
const EACH_LISTING_CLOSING = "Each listing links out to buy.";

/**
 * Abbreviations whose trailing period never ends a sentence (lowercased, no
 * period). Real catalog prose hits "Co." — a naive first-period split would
 * emit the dangling fragment "Offered by Hudson Valley Seed Co." When in
 * doubt this list merges (a merged candidate fails the fit check and the
 * variety falls back to Template B/C), which is always safe: fragments are
 * the defect, fallbacks are always valid.
 */
const SENTENCE_ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "st", "ave", "blvd", "rd",
  "co", "inc", "ltd", "corp", "llc", "jr", "sr", "vs", "no", "nos",
  "fig", "p", "pp", "vol", "dept", "est", "approx",
  "ft", "in", "oz", "lb", "lbs", "yd", "gal", "qt", "pt", "tbsp", "tsp", "fl",
]);

const CLOSING_MARKS = new Set(['"', "'", "”", "’", ")", "]"]);

/**
 * The first sentence of prose, whole, or null when there is no prose. A
 * terminator ends the sentence only when it is not a decimal point, not an
 * abbreviation period, and is followed by a space or the end of the string.
 * Prose with no terminator at all is one sentence (terminated).
 */
function firstSentence(prose: string): string | null {
  const t = prose.replace(/\s+/g, " ").trim();
  if (!t) return null;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    if (ch === "." && i > 0 && i + 1 < t.length && /\d/.test(t[i - 1]!) && /\d/.test(t[i + 1]!)) continue;
    if (ch === ".") {
      const word = /([A-Za-z]+)$/.exec(t.slice(0, i))?.[1]?.toLowerCase();
      if (word && SENTENCE_ABBREVIATIONS.has(word)) continue;
    }
    let j = i + 1;
    while (j < t.length && (t[j] === "." || t[j] === "!" || t[j] === "?")) j++;
    while (j < t.length && CLOSING_MARKS.has(t[j]!)) j++;
    if (j < t.length && t[j] !== " ") continue;
    return t.slice(0, j);
  }
  return `${t}.`;
}

/**
 * Variety meta/OG/Twitter description: composed from Wren's templates, never
 * from the answer — no seller roster, no seller names. One string feeds all
 * three description fields via pageHead. ≤160 chars by construction: every
 * optional element is admitted only if it fits whole; clip() stays purely
 * as a safety net.
 *
 * Template A (sellers ≥ 1, first prose sentence fits whole): head + prose +
 * directory clause (the clause only if it also fits whole). Template B
 * (sellers ≥ 1, prose absent or unusable): head + seller-count clause +
 * packet range when computable from actual listings (else omitted) +
 * closing. Template C (zero sellers): head + honesty/waitlist clause + prose
 * when it fits.
 */
export function varietyDescription(v: {
  varietyName: string;
  plant: { commonName: string; latinName: string | null };
  description: string | null;
  listings: { seller: { slug: string }; packetSizes: { seedCount: number | null }[] }[];
}): string {
  const crop = shortCommonName(v.plant.commonName);
  const lastWord = (s: string) => s.trim().split(/\s+/).at(-1) ?? "";
  // The crop word is added only when the variety name does not already end with it
  // (case-insensitive check on the final word): "Cinnamon Basil" + Basil → "Cinnamon Basil seeds".
  const head = `${v.varietyName}${lastWord(v.varietyName).toLowerCase() === lastWord(crop).toLowerCase() ? "" : ` ${crop}`} seeds`;
  const headBlock = `${head}${v.plant.latinName ? ` (${v.plant.latinName})` : ""}.`;

  const sellers = new Set(v.listings.map((l) => l.seller.slug)).size;
  const prose = v.description ? firstSentence(v.description) : null;
  const joined = (...parts: string[]) => parts.join(" ");

  if (sellers === 0) {
    // Template C: the clause renders immediately after the head; prose follows
    // in the remaining space, sentence-or-nothing.
    const base = joined(headBlock, HONESTY_CLAUSE);
    if (prose && joined(base, prose).length <= DESCRIPTION_MAX) return clip(joined(base, prose));
    return clip(base);
  }
  if (prose && joined(headBlock, prose).length <= DESCRIPTION_MAX) {
    // Template A: prose is never shortened for the clause; the clause is the only optional element.
    const base = joined(headBlock, prose);
    if (joined(base, DIRECTORY_CLAUSE).length <= DESCRIPTION_MAX) return clip(joined(base, DIRECTORY_CLAUSE));
    return clip(base);
  }
  // Template B: the count clause is the only form in which a count appears (singular agreement).
  const count = `Listed by ${sellers} US seller${sellers === 1 ? "" : "s"} in the Seed Directory.`;
  const base = joined(headBlock, count);
  const seedCounts = v.listings.flatMap((l) => l.packetSizes.map((p) => p.seedCount).filter((n): n is number => n !== null));
  if (seedCounts.length > 0) {
    const min = Math.min(...seedCounts);
    const max = Math.max(...seedCounts);
    const range = min === max ? `Packets of ${min} seeds.` : `Packets from ${min} to ${max} seeds.`;
    // The range renders only with its closing (the closing form is fixed by the range's presence).
    if (joined(base, range, EACH_LISTING_CLOSING).length <= DESCRIPTION_MAX) return clip(joined(base, range, EACH_LISTING_CLOSING));
  }
  if (joined(base, DIRECTORY_CLAUSE).length <= DESCRIPTION_MAX) return clip(joined(base, DIRECTORY_CLAUSE));
  return clip(base);
}
