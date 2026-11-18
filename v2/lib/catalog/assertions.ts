/**
 * Fail-fast assertions for the initial catalog import (FINAL spec §6). No silent fixes: every
 * problem is collected and the import aborts if the list is non-empty.
 */
import { lifeCycleBuckets } from "@/lib/life-cycle";
import { hostOf, hostOnDomain } from "@/lib/names";
import type { CatalogInput, CatalogListingInput, CatalogPlantInput, CatalogVarietyInput } from "./input";

/**
 * Canonical decision 25: six owner-named exemplar sellers (seed-data regenerated 2026-11-16).
 * Varieties/plants grew 2026-11-16 with the Floret Library name import (565 names:
 * 551 new varieties, 74 new crops; see scripts/import-floret-names.ts).
 * Sellers grew 6 → 24 on 2026-11-16: the owner directed adding every farm on Floret's
 * Favorite Seed Sources list (9 candidates + 8 borderline; see
 * scripts/add-floret-source-sellers.py) plus Johnny's Selected Seeds (below); then 24 → 25
 * with The Gardener's Workshop, nominated by the owner the same day
 * (see scripts/add-gardeners-workshop.py).
 */
export const EXPECTED_COUNTS = { varieties: 778, sellers: 25, listings: 17, plants: 124 } as const;

/**
 * EXCLUSION LISTS (FINAL §1.1 / §6). Large seed companies are never sellers in v2. These names
 * exist in the codebase ONLY here, as exclusion lists; tests and scans import them from here.
 * EXCEPTION (owner ruling, 2026-11-16): Johnny's Selected Seeds IS an approved seller, so
 * "johnny" no longer appears in either list. The exception is for Johnny's only — Ball,
 * GeoSeed, Territorial and the rest stay excluded.
 */
export const EXCLUDED_SELLER_TOKENS = ["ball", "geoseed", "park-seed", "baker", "everwilde", "reimer", "onings"] as const;
export const EXCLUDED_COMPANY_NAMES = [
  "ball seed",
  "geoseed",
  "park seed",
  "baker creek",
  "everwilde",
  "reimer",
  "onings",
  "silver falls",
  "todd's seeds",
  "todds seeds",
] as const;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Seller slug/name scan (substring, case-insensitive). */
export const SELLER_EXCLUSION_PATTERN = new RegExp(EXCLUDED_SELLER_TOKENS.map(escapeRe).join("|"), "i");

/** Whole-catalog scan for excluded company names in any string value (word-bounded). */
export const COMPANY_NAME_EXCLUSION_PATTERN = new RegExp(
  `\\b(?:${EXCLUDED_COMPANY_NAMES.map(escapeRe).join("|")})\\b`,
  "i",
);

export class CatalogAssertionError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Catalog assertions failed (${problems.length}):\n  - ${problems.join("\n  - ")}`);
    this.name = "CatalogAssertionError";
  }
}

function dupes(values: string[]): string[] {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const v of values) (seen.has(v) ? out : seen).add(v);
  return [...out];
}

function* strings(value: unknown, path: string): Generator<[string, string]> {
  if (typeof value === "string") yield [path, value];
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${path}[${i}]`);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) yield* strings(v, `${path}.${k}`);
}

export function collectCatalogProblems(c: CatalogInput): string[] {
  const p: string[] = [];

  // Counts.
  const actual = {
    varieties: c.varieties.length,
    sellers: c.sellers.length,
    listings: c.listings.length,
    plants: c.plants.length,
  };
  for (const [k, expected] of Object.entries(EXPECTED_COUNTS)) {
    const got = actual[k as keyof typeof actual];
    if (got !== expected) p.push(`count ${k}: expected ${expected}, got ${got}`);
  }

  // Unique keys.
  for (const [label, values] of [
    ["source id", c.sources.map((s) => s.id)],
    ["category slug", c.categories.map((x) => x.slug)],
    ["subcategory slug", c.subcategories.map((x) => `${x.category}/${x.slug}`)],
    ["plant slug", c.plants.map((x) => x.slug)],
    ["plant names", c.plants.map((x) => `${x.commonName}|${x.latinName}`)],
    ["variety slug", c.varieties.map((x) => x.slug)],
    ["seller slug", c.sellers.map((x) => x.slug)],
    ["listing variety×seller", c.listings.map((x) => `${x.variety}×${x.seller}`)],
  ] as const) {
    for (const d of dupes([...values])) p.push(`duplicate ${label}: ${d}`);
  }

  // Orphan FKs.
  const sources = new Set(c.sources.map((s) => s.id));
  const cats = new Set(c.categories.map((x) => x.slug));
  const subs = new Set(c.subcategories.map((x) => x.slug));
  const plantSet = new Set(c.plants.map((x) => x.slug));
  const varietySet = new Set(c.varieties.map((x) => x.slug));
  const sellerSet = new Set(c.sellers.map((x) => x.slug));
  for (const s of c.subcategories) if (!cats.has(s.category)) p.push(`orphan subcategory ${s.slug} → category ${s.category}`);
  for (const pl of c.plants) {
    if (!cats.has(pl.category)) p.push(`orphan plant ${pl.slug} → category ${pl.category}`);
    // Season class travels with its source: both or neither (a class is never unsourced).
    const hasClass = pl.seasonClass != null;
    const hasSource = pl.seasonSource != null;
    if (hasClass !== hasSource) p.push(`plant ${pl.slug}: seasonClass and seasonSource must be set together`);
    if (hasSource && !sources.has(pl.seasonSource!)) p.push(`plant ${pl.slug} has no valid season source (${pl.seasonSource})`);
    // Sowing methods travel with their source the same way; an empty list is not a value.
    const methods = pl.sowingMethods ?? [];
    const hasMethodSource = pl.sowingMethodSource != null;
    if (pl.sowingMethods && methods.length === 0) p.push(`plant ${pl.slug}: sowingMethods is empty (omit it instead)`);
    if (new Set(methods).size !== methods.length) p.push(`plant ${pl.slug}: duplicate sowingMethods`);
    if ((methods.length > 0) !== hasMethodSource) p.push(`plant ${pl.slug}: sowingMethods and sowingMethodSource must be set together`);
    if (hasMethodSource && !sources.has(pl.sowingMethodSource!)) p.push(`plant ${pl.slug} has no valid sowing method source (${pl.sowingMethodSource})`);
    // Grower guide content (life cycle, hardiness, guide) travels with its source the same way;
    // an empty guide object or section is not a value (omit it instead).
    const g = pl.growerGuide;
    const hasGuideContent = pl.lifeCycle != null || pl.hardiness != null || g != null;
    if (hasGuideContent !== (pl.growerGuideSource != null))
      p.push(`plant ${pl.slug}: lifeCycle/hardiness/growerGuide and growerGuideSource must be set together`);
    // Every life cycle must land in at least one browse-filter bucket; unrecognised wording
    // would otherwise silently drop the crop out of the Life cycle filter.
    if (pl.lifeCycle != null && lifeCycleBuckets(pl.lifeCycle).length === 0)
      p.push(`plant ${pl.slug}: lifeCycle "${pl.lifeCycle}" maps to no life-cycle bucket (extend lib/life-cycle.ts)`);
    if (pl.growerGuideSource != null && !sources.has(pl.growerGuideSource)) p.push(`plant ${pl.slug} has no valid grower guide source (${pl.growerGuideSource})`);
    if (g && !g.growing && !g.seedSaving) p.push(`plant ${pl.slug}: growerGuide is empty (omit it instead)`);
    for (const [k, section] of [["growing", g?.growing], ["seedSaving", g?.seedSaving]] as const)
      if (section && Object.keys(section).length === 0) p.push(`plant ${pl.slug}: growerGuide.${k} is empty (omit it instead)`);
  }
  for (const v of c.varieties) {
    if (!plantSet.has(v.plant)) p.push(`orphan variety ${v.slug} → plant ${v.plant}`);
    if (v.subcategory && !subs.has(v.subcategory)) p.push(`orphan variety ${v.slug} → subcategory ${v.subcategory}`);
    if (!sources.has(v.sourceId)) p.push(`variety ${v.slug} has no valid source (${v.sourceId})`);
  }
  for (const l of c.listings) {
    const key = `${l.variety}×${l.seller}`;
    if (!varietySet.has(l.variety)) p.push(`orphan listing ${key} → variety`);
    if (!sellerSet.has(l.seller)) p.push(`orphan listing ${key} → seller`);
    if (!l.sourceId || !sources.has(l.sourceId)) p.push(`listing ${key} has no valid source (${l.sourceId})`);
    for (const [i, pk] of l.packetSizes.entries()) {
      if (pk.priceCents !== null) {
        if (!Number.isInteger(pk.priceCents)) p.push(`listing ${key} packet ${i}: price_cents not an integer`);
        if (!pk.priceSource) p.push(`listing ${key} packet ${i}: priced packet missing priceSource`);
        if (!pk.priceCheckDate) p.push(`listing ${key} packet ${i}: priced packet missing priceCheckDate`);
      }
    }
  }

  // Approval block (canonical §2): every launch seller is hand-approved, with a domain that
  // matches its homepage; every listing URL sits on its seller's domain.
  const sellerBySlug = new Map(c.sellers.map((s) => [s.slug, s]));
  for (const s of c.sellers) {
    if (s.eligibility !== "approved") p.push(`seller ${s.slug} is not approved (eligibility ${s.eligibility})`);
    if (s.eligibility === "approved" && !s.approvedAt) p.push(`seller ${s.slug} is approved without approvedAt`);
    if (s.homepage && !hostOnDomain(hostOf(s.homepage), s.domain)) p.push(`seller ${s.slug} homepage is not on domain ${s.domain}`);
  }
  for (const d of dupes(c.sellers.map((s) => s.domain))) p.push(`duplicate seller domain: ${d}`);
  for (const l of c.listings) {
    const s = sellerBySlug.get(l.seller);
    if (s && l.productUrl && !hostOnDomain(hostOf(l.productUrl), s.domain)) {
      p.push(`listing ${l.variety}×${l.seller} product URL is off the seller's domain (${s.domain})`);
    }
  }

  // Seller exclusion scan (slug or name).
  for (const s of c.sellers) {
    if (SELLER_EXCLUSION_PATTERN.test(s.slug) || SELLER_EXCLUSION_PATTERN.test(s.name)) {
      p.push(`excluded large-company seller: ${s.slug} (${s.name})`);
    }
  }
  // Whole-file scan for excluded company names anywhere in the data.
  for (const [path, value] of strings(c, "catalog")) {
    if (COMPANY_NAME_EXCLUSION_PATTERN.test(value)) p.push(`excluded company name at ${path}: "${value.slice(0, 80)}"`);
  }

  return p;
}

export function assertCatalog(c: CatalogInput): void {
  const problems = collectCatalogProblems(c);
  if (problems.length > 0) throw new CatalogAssertionError(problems);
}

// ─── content_level / indexable (index rule: owner ruling 2026-11-16) ────────

export function countSourcedFacts(v: CatalogVarietyInput, plant: CatalogPlantInput | undefined): number {
  return [
    v.description !== null,
    v.sowingNotes !== null,
    v.heightCm !== null,
    v.tags.length >= 2,
    Boolean(plant && (plant.description !== null || plant.sowingNotes !== null)),
  ].filter(Boolean).length;
}

export function contentLevel(v: CatalogVarietyInput, plant: CatalogPlantInput | undefined): "thin" | "factual" {
  return countSourcedFacts(v, plant) >= 3 ? "factual" : "thin";
}

/**
 * Index rule (owner ruling 2026-11-16; SUPERSEDES canonical decision 8 / R5): EVERY active
 * variety page is Google-indexable — `index, follow` and included in the sitemap — regardless
 * of how many listings it has or how many words of its own notes it carries. A zero-seller
 * variety stays public in a "no sellers yet / currently unavailable" state (Amazon model:
 * the page persists; sellers attach to it). Non-active varieties (draft / discontinued /
 * merged) and soft-deleted rows have no public page, so they are never indexable.
 */
export function isIndexable(status: string, deletedAt: string | null = null): boolean {
  return status === "active" && deletedAt === null;
}

// ─── Listing derivations (design D2) — only from sourced packet/listing data ─────────────

export type Availability = "in_stock" | "sold_out" | "preorder" | "shop_closed" | "unknown";

/**
 * in_stock if any packet was seen in stock; sold_out if any packet was seen sold out, or the
 * listing's sourced note records a sold-out check; otherwise unknown. Never invented.
 */
export function deriveAvailability(l: Pick<CatalogListingInput, "packetSizes" | "notes">): Availability {
  if (l.packetSizes.some((p) => p.inStock === true)) return "in_stock";
  if (l.packetSizes.some((p) => p.inStock === false)) return "sold_out";
  if (l.notes && /\bsold out\b/i.test(l.notes) && !/\bback in stock\b/i.test(l.notes)) return "sold_out";
  return "unknown";
}

/** Max packet priceCheckDate, else the listing source's checkedDate, else null. */
export function deriveLastChecked(
  l: Pick<CatalogListingInput, "packetSizes">,
  sourceCheckedDate: string | null,
): string | null {
  const dates = l.packetSizes.map((p) => p.priceCheckDate).filter((d): d is string => Boolean(d));
  if (dates.length) return dates.sort().at(-1) ?? null;
  return sourceCheckedDate;
}
