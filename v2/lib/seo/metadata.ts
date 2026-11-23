/** Metadata builders (S1/S2/S3). Titles get the root template `%s | seeds.hues.flowers`. No prices (R1). */
import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/config";
import { shortCommonName } from "@/lib/format";
import { imageUrl } from "@/lib/images";
import { ZERO_SELLER_TITLE } from "@/lib/zero-seller";
import type { SellerDetail, SellerState, VarietyDetail } from "@/lib/validators";

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
 * Own-work variety or crop illustration as the share image: the stored media path rendered as a
 * 1120-wide scale-down transformation from our own image CDN (lib/images; absolute URL on
 * images.seeds.hues.flowers since the 2026-11-18 migration). No `type`: format=auto negotiates the
 * format per client (AVIF/WebP, else the original's format), so a fixed MIME type could be wrong.
 * 1120×2240 is the illustration standard (every variety original is exactly that size).
 */
export function mediaOgImage(path: string, alt: string): OgImage {
  return { url: imageUrl(path, { width: 1120 }), width: 1120, height: 2240, alt };
}

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  follow?: boolean;
  og?: OgImage;
  absoluteTitle?: boolean;
}): Metadata {
  const image = opts.og ?? ogImage("site", "default", SITE_NAME);
  const canonical = opts.path === "/" ? SITE_URL : `${SITE_URL}${opts.path}`;
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical },
    robots: opts.noindex ? { index: false, follow: opts.follow ?? true } : { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: canonical,
      title: opts.title,
      description: opts.description,
      images: [image],
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [image.url],
    },
  };
}

const sellerCount = (n: number) => (n === 0 ? ZERO_SELLER_TITLE : `${n} Seller${n === 1 ? "" : "s"}`);

/** "Where to buy" intent, written from facts: variety, crop, and the number of sellers listing it. */
export function varietyTitle(v: VarietyDetail): string {
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
 * Abbreviations whose trailing period never ends a sentence (lowercased, no period). Real catalog
 * prose hits "Co." ("Offered by Hudson Valley Seed Co. in its ... line") — a naive first-period
 * split would emit the dangling fragment "Offered by Hudson Valley Seed Co." When in doubt this
 * list merges (a merged candidate fails the fit check and the variety falls back to Template B/C),
 * which is always safe: fragments are the defect, fallbacks are always valid.
 */
const SENTENCE_ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "st", "ave", "blvd", "rd",
  "co", "inc", "ltd", "corp", "llc", "jr", "sr", "vs", "no", "nos",
  "fig", "p", "pp", "vol", "dept", "est", "approx",
  "ft", "in", "oz", "lb", "lbs", "yd", "gal", "qt", "pt", "tbsp", "tsp", "fl",
]);

const CLOSING_MARKS = new Set(['"', "'", "”", "’", ")", "]"]);

/**
 * The first sentence of prose, whole, or null when there is no prose. A terminator ends the
 * sentence only when it is not a decimal point, not an abbreviation period, and is followed by a
 * space or the end of the string. Prose with no terminator at all is one sentence (terminated).
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
 * Variety meta/OG/Twitter description (Dustin's ruling, 2026-11-23): composed from Wren's
 * templates, never from `v.answer` — no seller roster, no seller names. One string feeds all
 * three description fields via pageMetadata. ≤160 chars by construction: every optional element
 * is admitted only if it fits whole; clip() stays purely as a safety net.
 *
 * Template A (sellers ≥ 1, first prose sentence fits whole): head + prose + directory clause
 *   (the clause only if it also fits whole). Template B (sellers ≥ 1, prose absent or unusable):
 *   head + seller-count clause + packet range when computable from actual listings (else omitted)
 *   + closing. Template C (zero sellers): head + honesty/waitlist clause + prose when it fits.
 */
export function varietyDescription(v: VarietyDetail): string {
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
    // Template C: the clause renders immediately after the head (Flag 2 ruling); prose follows
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

export function sellerTitle(s: SellerDetail): string {
  return `${s.name} — Flower Seed Seller`;
}

export function sellerDescription(s: SellerDetail): string {
  const where = s.location ? ` in ${s.location}` : "";
  return clip(
    `${s.name}${where}: ${s.varietyCount} flower seed ${s.varietyCount === 1 ? "variety" : "varieties"} listed, each with its stock state and the date it was last checked. ${s.description ?? ""}`,
  );
}

/** /state/{slug}: an absolute title (no site-name template suffix). */
export function stateTitle(st: SellerState): string {
  return `Seed sellers in ${st.name} — Seed Directory`;
}

export function stateDescription(st: SellerState): string {
  const n = st.sellerCount;
  return clip(
    `${n} ${n === 1 ? "farm or seed company" : "farms and seed companies"} in ${st.name} ${n === 1 ? "lists" : "list"} flower seed with the Seed Directory, with the varieties each one carries and when each listing was last checked.`,
  );
}
