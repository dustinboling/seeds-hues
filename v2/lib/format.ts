/** Presentation formatting. No price formatting exists: prices are stored, never shown (R1). */

export function formatHeight(cm: number): string {
  const inches = Math.round(cm / 2.54);
  return `${cm} cm (about ${inches} in)`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function titleCaseTag(tag: string): string {
  return tag
    .split("-")
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function sellerTypeLabel(t: "wholesale" | "retail" | "specialty"): string {
  return { wholesale: "Wholesale farm seed", retail: "Retail seed shop", specialty: "Specialty grower" }[t];
}

/** Short common name for titles: "Cornflower / Bachelor's Buttons" → "Cornflower". */
export function shortCommonName(common: string): string {
  return common.split(" / ")[0] ?? common;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * Friendly "checked" date for listing cards (Quiet Ledger, 2026-11-20): today → "today",
 * yesterday → "yesterday", otherwise "Mon D" (e.g. "Nov 19"). Never an ISO string.
 * Compares calendar days (the stored value's YYYY-MM-DD part against `now`'s local calendar
 * day); `now` is injectable for tests. Returns null for a missing or unparseable value —
 * callers render their "not yet checked" wording instead.
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

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
