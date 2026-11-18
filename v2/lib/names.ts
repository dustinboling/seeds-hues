/**
 * Name normalization shared by the importer, search and the ingest matcher (canonical §2
 * "variety_names": lowercased, accent-free and punctuation-free, with the crop word and
 * pack-size words removed). Pure functions — safe in Worker and Node code.
 */

const PACK_WORDS = new Set([
  "seed",
  "seeds",
  "packet",
  "packets",
  "pkt",
  "pkts",
  "pack",
  "packs",
  "oz",
  "ounce",
  "ounces",
  "g",
  "gram",
  "grams",
  "ct",
  "count",
]);

/** Lowercase, strip accents (NFKD + combining marks), drop apostrophes, punctuation → space. */
export function foldText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Crop phrases to strip, from a crop common name like "Cornflower / Bachelor's Buttons". */
export function cropPhrases(commonName: string | null | undefined): string[] {
  if (!commonName) return [];
  return commonName
    .split("/")
    .map((p) => foldText(p))
    .filter((p) => p.length > 0)
    .sort((a, b) => b.length - a.length);
}

/**
 * Normalized name: folded text with the crop phrase(s) (optionally plural) and pack-size words
 * removed. Falls back to the folded text if stripping would leave nothing.
 */
export function normalizeName(name: string, cropCommonName?: string | null): string {
  const folded = foldText(name);
  let s = ` ${folded} `;
  for (const phrase of cropPhrases(cropCommonName)) {
    s = s.split(` ${phrase}s `).join(" ").split(` ${phrase} `).join(" ");
  }
  const tokens = s
    .trim()
    .split(" ")
    .filter((t) => t.length > 0 && !PACK_WORDS.has(t) && !/^\d+$/.test(t));
  const out = tokens.join(" ");
  return out.length > 0 ? out : folded;
}

/** URL-safe slug: lowercase ASCII, hyphens, apostrophes dropped, ≤ 80 chars (canonical §2). */
export function slugify(s: string, max = 80): string {
  return foldText(s).replace(/ /g, "-").slice(0, max).replace(/-+$/g, "");
}

/** Host without a leading "www.". */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * True when `host` is the seller's domain or a subdomain of it (shop.floretflowers.com is on
 * floretflowers.com). Both sides lose a leading "www.".
 */
export function hostOnDomain(host: string | null, domain: string | null): boolean {
  if (!host || !domain) return false;
  const h = host.toLowerCase().replace(/^www\./, "");
  const d = domain.toLowerCase().replace(/^www\./, "");
  return h === d || h.endsWith(`.${d}`);
}

/** Word count for the R5 index rule (own notes ≥ 150 words). */
export function wordCount(...texts: (string | null | undefined)[]): number {
  return texts.reduce((n, t) => n + (t ? t.trim().split(/\s+/).filter(Boolean).length : 0), 0);
}
