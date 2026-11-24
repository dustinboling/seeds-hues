/**
 * US states: USPS code (= sellers.region) ↔ name ↔ URL slug. Ported verbatim
 * from v2/lib/data/states.ts (same table, same lookups) — the sitemap's
 * state segment and the state-page rule ("exists iff it has a visible
 * seller") read this, never a second source.
 */

const NAMES: Readonly<Record<string, string>> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

export interface UsState {
  code: string;
  name: string;
  slug: string;
}

const kebab = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const US_STATES: readonly UsState[] = Object.entries(NAMES).map(([code, name]) => ({ code, name, slug: kebab(name) }));

const BY_CODE = new Map(US_STATES.map((s) => [s.code, s]));
const BY_SLUG = new Map(US_STATES.map((s) => [s.slug, s]));

/** "OR" (any case) → Oregon; null for anything that is not a US state code. */
export function stateByCode(code: string | null | undefined): UsState | null {
  return code ? (BY_CODE.get(code.trim().toUpperCase()) ?? null) : null;
}

/** "new-york" → New York; null for anything that is not an exact state slug. */
export function stateBySlug(slug: string | null | undefined): UsState | null {
  return slug ? (BY_SLUG.get(slug) ?? null) : null;
}

export const stateSlugOf = (code: string | null | undefined): string | null => stateByCode(code)?.slug ?? null;
export const stateCodeOf = (slug: string | null | undefined): string | null => stateBySlug(slug)?.code ?? null;
