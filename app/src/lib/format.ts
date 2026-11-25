/**
 * Presentation formatting. Ported from v2/lib/format.ts (same functions, same
 * output) plus proseCommonName from v2/lib/services/template.ts (the crop
 * name's prose form, used by cards, llms.txt, and titles). No price
 * formatting exists: prices are stored, never shown (R1).
 */

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Seller-kind label for cards (ported from v2/lib/format.ts, same strings). */
export function sellerTypeLabel(t: "wholesale" | "retail" | "specialty"): string {
  return { wholesale: "Wholesale farm seed", retail: "Retail seed shop", specialty: "Specialty grower" }[t];
}

export function formatHeight(cm: number): string {
  const inches = Math.round(cm / 2.54);
  return `${cm} cm (about ${inches} in)`;
}

export function titleCaseTag(tag: string): string {
  return tag
    .split("-")
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
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
 * Friendly "checked" date for listing cards: today → "today", yesterday →
 * "yesterday", otherwise "Mon D" (e.g. "Nov 19"). Never an ISO string.
 * Compares calendar days; `now` is injectable for tests. Returns null for a
 * missing or unparseable value — callers render their "not yet checked"
 * wording instead. Ported from v2/lib/format.ts.
 */
export function formatCheckedDate(lastCheckedAt: string | null, now: Date = new Date()): string | null {
  if (!lastCheckedAt) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(lastCheckedAt);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const DAY_MS = 86_400_000;
  const checkedDay = Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  const todayDay = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
  const diff = todayDay - checkedDay;
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  return `${MONTH_SHORT[month - 1]} ${day}`;
}

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

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The dialable tel: href for a published customer-service phone number:
 * digits with country code, derived from the display form at render — the
 * href and the visible number can never disagree. Ported from
 * v2/lib/format.ts.
 */
export function telHref(display: string): string {
  const digits = display.replace(/\D/g, "");
  if (display.trimStart().startsWith("+")) return `tel:+${digits}`;
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return `tel:+${digits}`;
}
