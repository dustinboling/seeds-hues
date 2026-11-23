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
function cropPhrases(commonName: string | null | undefined): string[] {
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

/**
 * Damerau-Levenshtein distance (unrestricted: adjacent transpositions plus inserts, deletes
 * and substitutions — a transposition counts as 1). Powers did-you-mean (§5.3.4).
 */
export function damerauLevenshtein(a: string, b: string): number {
  const aChars = [...a];
  const bChars = [...b];
  const aLen = aChars.length;
  const bLen = bChars.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  const INF = aLen + bLen;
  const da = new Map<string, number>();
  const d: number[][] = Array.from({ length: aLen + 2 }, () => new Array<number>(bLen + 2).fill(0));
  d[0]![0] = INF;
  for (let i = 0; i <= aLen; i++) {
    d[i + 1]![0] = INF;
    d[i + 1]![1] = i;
  }
  for (let j = 0; j <= bLen; j++) {
    d[0]![j + 1] = INF;
    d[1]![j + 1] = j;
  }
  for (let i = 1; i <= aLen; i++) {
    let db = 0;
    for (let j = 1; j <= bLen; j++) {
      const i1 = da.get(bChars[j - 1]!) ?? 0;
      const j1 = db;
      const cost = aChars[i - 1] === bChars[j - 1] ? 0 : 1;
      if (cost === 0) db = j;
      d[i + 1]![j + 1] = Math.min(
        d[i]![j]! + cost, // substitution
        d[i + 1]![j]! + 1, // insertion
        d[i]![j + 1]! + 1, // deletion
        d[i1]![j1]! + (i - i1 - 1) + 1 + (j - j1 - 1), // transposition
      );
    }
    da.set(aChars[i - 1]!, i);
  }
  return d[aLen + 1]![bLen + 1]!;
}

/** A did-you-mean candidate: a variety or crop name, with seller presence for tie-breaking. */
export interface DidYouMeanCandidate {
  name: string;
  hasSellers: boolean;
}

/**
 * The did-you-mean pick (§5.3.4 — the whole rule): names sharing the query's first letter
 * with edit distance ≤ 2 (a transposition counts as 1), the closest wins, ties break to the
 * name with sellers, then alphabetical. An exact match is not a correction — distance 0
 * never suggests. At most one suggestion; null when nothing qualifies.
 */
export function pickDidYouMean(query: string, candidates: DidYouMeanCandidate[]): string | null {
  const q = foldText(query);
  if (!q) return null;
  const first = [...q][0]!;
  let best: string | null = null;
  let bestDist = 0;
  let bestSellers = false;
  for (const c of candidates) {
    const folded = foldText(c.name);
    if (!folded.startsWith(first)) continue;
    const dist = damerauLevenshtein(q, folded);
    if (dist < 1 || dist > 2) continue;
    const lower = c.name.toLowerCase();
    if (
      best === null ||
      dist < bestDist ||
      (dist === bestDist && c.hasSellers && !bestSellers) ||
      (dist === bestDist && c.hasSellers === bestSellers && (lower < best.toLowerCase() || (lower === best.toLowerCase() && c.name < best)))
    ) {
      best = c.name;
      bestDist = dist;
      bestSellers = c.hasSellers;
    }
  }
  return best;
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
