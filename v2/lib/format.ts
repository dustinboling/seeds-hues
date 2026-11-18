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

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
