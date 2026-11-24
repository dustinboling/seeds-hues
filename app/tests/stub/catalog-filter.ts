/**
 * The stub API's catalog logic (tests/stub + the browse fixture's in-memory
 * fake share this): variety/seller filtering and sorting plus the search
 * ranking. It mirrors the live v2 service semantics (catalog-read sort
 * orders, catalog.ts search/ranking, names matching) closely enough that
 * the HTTP suite discriminates the APP's behavior — the app under test may
 * only call the public endpoints, never this module.
 *
 * DELIBERATELY INDEPENDENT of the app's builders (the derived.ts precedent):
 * prose names, life-cycle buckets, and the autocomplete ranker are local
 * copies, so app drift still fails the HTTP suite. Where the live behavior
 * needs infrastructure the stub cannot have (FTS5 trigram MATCH), the
 * facsimile is documented at the function.
 */
import type {
  ApiCrop,
  ApiSearchResponse,
  ApiSearchResult,
  ApiSellerItem,
  ApiVarietyListItem,
} from "../../src/data/types";

/* ── Names ── */

/** "Cornflower / Bachelor's Buttons" → "Cornflower (Bachelor's Buttons)". */
function proseCommonName(commonName: string): string {
  const [first, ...rest] = commonName.split(" / ");
  return rest.length > 0 ? `${first} (${rest.join(", ")})` : (first ?? commonName);
}

/* ── Life-cycle buckets (v2's lib/life-cycle.ts grammar, verbatim logic) ── */

const HABIT = "(annual|biennial|perennial)";
const BASE = `(?:(?:hardy|half-hardy|tender) )?(?:short-lived )?${HABIT}(?: (?:or|to) (?:short-lived )?${HABIT})?`;
const GROWN_AS = `, (?:usually |often |most often )?grown as (?:an? )?${HABIT}(?: or (?:an? )?${HABIT})?`;
const GRAMMAR = new RegExp(`^${BASE}(?:${GROWN_AS})?$`);

export type LifeCycleBucket = "annual" | "biennial" | "perennial";

/** Buckets for one life_cycle value, in canonical order; [] when absent or unrecognised. */
export function stubLifeCycleBuckets(lifeCycle: string | null | undefined): LifeCycleBucket[] {
  const text = lifeCycle?.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return [];
  const m = GRAMMAR.exec(text);
  if (!m) return [];
  const [, base1, base2, grown1, grown2] = m;
  const named = grown1 ? [grown1, grown2] : [base1, base2];
  return (["annual", "biennial", "perennial"] as const).filter((b) => named.includes(b));
}

/* ── Variety filtering + sorting (?season= ?method= ?life_cycle= ?color_family= ?small_farm=, v1 vocabulary) ── */

export interface StubVarietyFilters {
  plant?: string[];
  /** Short values (cool|warm), mapped to season classes like the v1 handler. */
  season?: string;
  /** Short values (direct|trays), mapped to sowing methods like the v1 handler. */
  methods?: string[];
  lifeCycle?: string[];
  colorFamily?: string[];
  smallFarmOnly?: boolean;
}

const SEASON_CLASS: Record<string, string> = {
  cool: "cool_season_hardy_annual",
  warm: "warm_season_tender_annual",
};
const SOWING_METHOD: Record<string, string> = { direct: "direct_sow", trays: "transplant" };

/** True when the item survives the filter set (AND across groups, OR within). */
export function stubVarietyMatches(
  item: ApiVarietyListItem,
  filters: StubVarietyFilters,
  smallFarmSlugs: ReadonlySet<string>,
): boolean {
  if (filters.plant?.length && !filters.plant.includes(item.plant.slug)) return false;
  if (filters.season && item.plant.season_class !== (SEASON_CLASS[filters.season] ?? filters.season)) return false;
  if (filters.methods?.length) {
    const wanted = new Set(filters.methods.map((m) => SOWING_METHOD[m] ?? m));
    if (!item.plant.sowing_methods.some((m) => wanted.has(m))) return false;
  }
  if (filters.lifeCycle?.length) {
    const buckets = stubLifeCycleBuckets(item.plant.lifeCycle);
    if (!filters.lifeCycle.some((b) => buckets.includes(b as LifeCycleBucket))) return false;
  }
  if (filters.colorFamily?.length && !filters.colorFamily.includes(item.colorFamily)) return false;
  if (filters.smallFarmOnly && !smallFarmSlugs.has(item.slug)) return false;
  return true;
}

export type StubVarietySort = "name" | "-name" | "recently_checked" | "-recently_checked" | "listing_count" | "-listing_count";

/** v2's catalog-read sortOrder() over list items (name + slug tiebreaks; null checks last). */
export function stubSortVarieties(items: ApiVarietyListItem[], sort: StubVarietySort): ApiVarietyListItem[] {
  const nameAsc = (a: ApiVarietyListItem, b: ApiVarietyListItem): number =>
    a.varietyName.toLowerCase().localeCompare(b.varietyName.toLowerCase()) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
  const checked = (dir: 1 | -1) => (a: ApiVarietyListItem, b: ApiVarietyListItem): number => {
    const an = a.lastCheckedAt === null ? 1 : 0;
    const bn = b.lastCheckedAt === null ? 1 : 0;
    if (an !== bn) return an - bn;
    if (a.lastCheckedAt !== b.lastCheckedAt) return (a.lastCheckedAt! < b.lastCheckedAt! ? -1 : 1) * dir;
    return nameAsc(a, b);
  };
  const out = [...items];
  switch (sort) {
    case "name":
      out.sort(nameAsc);
      break;
    case "-name":
      out.sort((a, b) => -nameAsc(a, b));
      break;
    case "recently_checked":
      out.sort(checked(1));
      break;
    case "-recently_checked":
      out.sort(checked(-1));
      break;
    case "listing_count":
      out.sort((a, b) => a.listingCount - b.listingCount || nameAsc(a, b));
      break;
    case "-listing_count":
      out.sort((a, b) => b.listingCount - a.listingCount || nameAsc(a, b));
      break;
  }
  return out;
}

/* ── Seller filtering (region, q, small_farm) ── */

export interface StubSellerFilters {
  region?: string[];
  q?: string;
  smallFarmOnly?: boolean;
}

export function stubSellerMatches(item: ApiSellerItem, filters: StubSellerFilters): boolean {
  if (filters.region?.length && !filters.region.includes((item.region ?? "").toUpperCase())) return false;
  if (filters.q && !item.name.toLowerCase().includes(filters.q.toLowerCase())) return false;
  if (filters.smallFarmOnly && !item.isSmallFarm) return false;
  return true;
}

/** Live order: lower(name), slug. */
export function stubSortSellers(items: ApiSellerItem[]): ApiSellerItem[] {
  return [...items].sort(
    (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  );
}

/* ── Search (v2's catalog.search + rankAutocompleteResults, over fixture rows) ── */

export const STUB_MIN_QUERY_CHARS = 2;

export interface StubSeriesSeed {
  slug: string;
  name: string;
  plantSlug: string;
}

export interface StubSearchCorpus {
  varieties: ApiVarietyListItem[];
  smallFarmSlugs: ReadonlySet<string>;
  crops: ApiCrop[];
  series: StubSeriesSeed[];
  sellers: ApiSellerItem[];
}

/** v2's normaliseQuery: NFKC, collapse whitespace, trim, cap at 100 chars. */
export function stubNormaliseQuery(q: string): string {
  return q.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 100);
}

/** v2's likePattern: ≥3 chars → substring, 2 chars → prefix (LIKE, case-insensitive). */
function stubLikeMatch(name: string, loweredQuery: string): boolean {
  const n = name.toLowerCase();
  return [...loweredQuery].length >= 3 ? n.includes(loweredQuery) : n.startsWith(loweredQuery);
}

function wordStarts(name: string, loweredQuery: string): boolean {
  const n = name.toLowerCase();
  return n.startsWith(loweredQuery) || n.split(/\s+/).some((w) => w.startsWith(loweredQuery));
}

interface VarietyMatch {
  item: ApiVarietyListItem;
  /** 0 exact, 1 prefix, 2 full-text (facsimile: substring — the stub has no FTS5). */
  tier: 0 | 1 | 2;
}

function matchVarieties(pool: ApiVarietyListItem[], query: string): VarietyMatch[] {
  const lower = query.replace(/[%_\\]/g, "").toLowerCase();
  if ([...lower].length < STUB_MIN_QUERY_CHARS) return [];
  const out = new Map<string, VarietyMatch>();
  const add = (item: ApiVarietyListItem, tier: 0 | 1 | 2): void => {
    const prev = out.get(item.slug);
    if (!prev || tier < prev.tier) out.set(item.slug, { item, tier });
  };
  for (const item of pool) {
    const name = item.varietyName.toLowerCase();
    const common = item.plant.commonName.toLowerCase();
    const latin = (item.plant.latinName ?? "").toLowerCase();
    if (name === lower || `${common} ${name}` === lower || `${name} ${common}` === lower) {
      add(item, 0);
      continue;
    }
    if (wordStarts(item.varietyName, lower) || wordStarts(item.plant.commonName, lower) || (latin && wordStarts(latin, lower))) {
      add(item, 1);
      continue;
    }
    // Tier-2 facsimile: substring over the same names FTS5 indexes (names only —
    // descriptions, tags, and aliases have no fixture rows, so they match nothing).
    if (name.includes(lower) || common.includes(lower) || (latin && latin.includes(lower))) add(item, 2);
  }
  // Ranked: tier, then has-listings first on ties, then name + slug (v2's order).
  return [...out.values()]
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        Number(b.item.listingCount > 0) - Number(a.item.listingCount > 0) ||
        a.item.varietyName.toLowerCase().localeCompare(b.item.varietyName.toLowerCase()) ||
        (a.item.slug < b.item.slug ? -1 : a.item.slug > b.item.slug ? 1 : 0),
    )
    .slice(0, 100);
}

function varietyResult(m: VarietyMatch): ApiSearchResult {
  const v = m.item;
  return {
    type: "variety",
    slug: v.slug,
    title: v.varietyName,
    subtitle: `${proseCommonName(v.plant.commonName)} · ${v.sellerCount === 0 ? "no seller listing yet" : `${v.sellerCount} seller${v.sellerCount === 1 ? "" : "s"}`}`,
    href: `/variety/${v.slug}`,
    matchedAlias: null,
  };
}

function cropResult(crop: ApiCrop): ApiSearchResult {
  return {
    type: "crop",
    slug: crop.slug,
    title: proseCommonName(crop.commonName),
    subtitle: crop.latinName ? `${crop.latinName} · crop` : "crop",
    href: `/crop/${crop.slug}`,
    matchedAlias: null,
  };
}

function seriesResult(seed: StubSeriesSeed, crops: ApiCrop[]): ApiSearchResult {
  const crop = crops.find((c) => c.slug === seed.plantSlug);
  return {
    type: "series",
    slug: seed.slug,
    title: `${seed.name} series`,
    subtitle: `${proseCommonName(crop?.commonName ?? seed.plantSlug)} · series`,
    href: `/series/${seed.slug}`,
    matchedAlias: null,
  };
}

function sellerResult(seller: ApiSellerItem): ApiSearchResult {
  return {
    type: "seller",
    slug: seller.slug,
    title: seller.name,
    subtitle: seller.location ? `${seller.location} · seller` : "seller",
    href: `/seller/${seller.slug}`,
    matchedAlias: null,
  };
}

/**
 * One name against the lowered query (v2's §5.3.2 test): exact (1); a prefix
 * of the name or of a word of it (2); anything else that matches (3).
 */
function nameMatchClass(name: string, loweredQuery: string): 1 | 2 | 3 {
  const n = name.toLowerCase();
  if (n === loweredQuery) return 1;
  if (wordStarts(name, loweredQuery)) return 2;
  return 3;
}

function bestNameMatchClass(names: (string | null)[], loweredQuery: string): 1 | 2 | 3 {
  let best: 1 | 2 | 3 = 3;
  for (const name of names) {
    if (name === null) continue;
    const c = nameMatchClass(name, loweredQuery);
    if (c < best) best = c;
  }
  return best;
}

export interface StubSearchOptions {
  limit?: number;
  types?: ("variety" | "series" | "crop" | "seller")[];
  /** Full season class (the v1 handler maps the short param before the service). */
  season?: string;
  /** Full sowing methods. */
  methods?: string[];
  colorFamily?: string[];
}

/**
 * v2's catalog.search over the fixture corpus: the grouped sets (varieties
 * ≤ limit, others ≤ min(5, limit)) plus the flat autocomplete ranking
 * (match class first, type second — varieties, crops, series, sellers).
 * Sellers never filter; hue moves only the variety slice; season/methods
 * move varieties, crops, and series.
 */
export function stubSearch(corpus: StubSearchCorpus, rawQuery: string, opts: StubSearchOptions = {}): ApiSearchResponse {
  const query = stubNormaliseQuery(rawQuery);
  const lim = Math.max(1, Math.min(opts.limit ?? 10, 50));
  const types = new Set(opts.types?.length ? opts.types : (["variety", "series", "crop", "seller"] as const));
  const empty: ApiSearchResponse = { query, results: [], varieties: [], series: [], crops: [], sellers: [] };
  const lowered = query.replace(/[%_\\]/g, "").toLowerCase();
  if ([...lowered].length < STUB_MIN_QUERY_CHARS) return empty;

  const plantOk = (season: string | null, methods: string[]): boolean => {
    if (opts.season && season !== opts.season) return false;
    if (opts.methods?.length && !methods.some((m) => opts.methods!.includes(m))) return false;
    return true;
  };

  const matches = types.has("variety") ? matchVarieties(corpus.varieties, query) : [];
  const varietyEntries = matches
    .filter(
      (m) =>
        plantOk(m.item.plant.season_class, m.item.plant.sowing_methods) &&
        (!opts.colorFamily?.length || opts.colorFamily.includes(m.item.colorFamily)),
    )
    .slice(0, lim);

  const cropRows = !types.has("crop")
    ? []
    : corpus.crops
        .filter(
          (c) =>
            plantOk(c.season_class, c.sowing_methods) &&
            (stubLikeMatch(c.commonName, lowered) || (c.latinName ? stubLikeMatch(c.latinName, lowered) : false)),
        )
        .sort((a, b) => a.commonName.toLowerCase().localeCompare(b.commonName.toLowerCase()))
        .slice(0, Math.min(5, lim));

  const seriesRows = !types.has("series")
    ? []
    : corpus.series
        .filter((s) => stubLikeMatch(s.name, lowered))
        .filter((s) => {
          const crop = corpus.crops.find((c) => c.slug === s.plantSlug);
          return crop ? plantOk(crop.season_class, crop.sowing_methods) : true;
        })
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        .slice(0, Math.min(5, lim));

  const sellerRows = !types.has("seller")
    ? []
    : corpus.sellers
        .filter((s) => stubLikeMatch(s.name, lowered))
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        .slice(0, Math.min(5, lim));

  const varieties = varietyEntries.map((e) => varietyResult(e));
  const crops = cropRows.map(cropResult);
  const series = seriesRows.map((s) => seriesResult(s, corpus.crops));
  const sellers = sellerRows.map(sellerResult);
  const q = query.toLowerCase();
  const classed: { result: ApiSearchResult; cls: 1 | 2 | 3; type: number }[] = [
    ...varietyEntries.map((e) => ({ result: varietyResult(e), cls: ((e.tier + 1) as 1 | 2 | 3), type: 0 })),
    ...cropRows.map((c) => ({ result: cropResult(c), cls: bestNameMatchClass([c.commonName, c.latinName], q), type: 1 })),
    ...seriesRows.map((s) => ({ result: seriesResult(s, corpus.crops), cls: bestNameMatchClass([s.name], q), type: 2 })),
    ...sellerRows.map((s) => ({ result: sellerResult(s), cls: bestNameMatchClass([s.name], q), type: 3 })),
  ];
  classed.sort((a, b) => a.cls - b.cls || a.type - b.type);
  return { query, results: classed.map((c) => c.result).slice(0, lim), varieties, series, crops, sellers };
}
