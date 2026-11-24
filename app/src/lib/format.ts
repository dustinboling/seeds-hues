/**
 * Presentation formatting. Ported from v2/lib/format.ts (same functions, same
 * output) plus proseCommonName from v2/lib/services/template.ts (the crop
 * name's prose form, used by cards, llms.txt, and titles). No price
 * formatting exists: prices are stored, never shown (R1).
 */

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Short common name for titles: "Cornflower / Bachelor's Buttons" → "Cornflower". */
export function shortCommonName(common: string): string {
  return common.split(" / ")[0] ?? common;
}

/** "Cornflower / Bachelor's Buttons" → "Cornflower (Bachelor's Buttons)" reads better in prose. */
export function proseCommonName(commonName: string): string {
  const [first, ...rest] = commonName.split(" / ");
  return rest.length ? `${first} (${rest.join(", ")})` : (first ?? commonName);
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * Friendly absolute date for reader prose: "Nov 20, 2026". Returns null for a
 * missing or unparseable value — callers omit the date rather than print ISO.
 */
export function formatFriendlyDate(value: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${MONTH_SHORT[month - 1]} ${day}, ${year}`;
}
