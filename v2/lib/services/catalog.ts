/**
 * Catalog service layer — the single implementation behind Server Components (in-process), the
 * /api/v1 route handlers and /sync (FINAL X2). Every output is parsed by its Zod schema so a bad
 * row fails loudly instead of rendering.
 *
 * Delta: no price ever leaves this layer (R1); listings carry provenance; varieties and sellers
 * carry rating; unknown facts are explicit (R13).
 */
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import * as repo from "@/lib/repositories/catalog-read";
import type {
  ListingQuery,
  PacketRow,
  Page,
  PlantFilters,
  PlantListFilters,
  PublicListingRow,
  SeasonClass,
  SowingMethod,
  VarietyFilters,
  VarietySort,
} from "@/lib/repositories/catalog-read";
import { SOWING_METHODS } from "@/lib/db/schema";
import { latestPublish } from "@/lib/repositories/catalog-write";
import { insertSearchEvent } from "@/lib/repositories/events";
import { MIN_QUERY_CHARS, normaliseQuery, searchVarieties, type VarietyMatch } from "@/lib/repositories/fts";
import { catalogSeq } from "@/lib/repositories/seq";
import { SITE_URL } from "@/lib/config";
import { formatFriendlyDate } from "@/lib/format";
import { foldText } from "@/lib/names";
import { zeroSellerSentence } from "@/lib/zero-seller";
import { stateByCode } from "@/lib/data/states";
import { totalPages } from "@/lib/paging";
import {
  BROWSE_OPTIONS,
  browseCountQueries,
  browseCountStates,
  cropFiltersFromBrowse,
  varietyFiltersFromBrowse,
  type BrowseCountQuery,
  type BrowseCountState,
  type BrowseFilterGroup,
  type BrowseFilterState,
} from "@/lib/browse";
import {
  cropCountStates,
  cropHuesForFamilies,
  cropVarietyFiltersFromState,
  type CropCountState,
  type CropDetailFilterState,
} from "@/lib/crop-detail";
import type { SellerBrowseState } from "@/lib/seller-browse";
import {
  BrowseCountsSchema,
  BrowseCropsPayloadSchema,
  BrowseSearchPayloadSchema,
  BrowseVarietiesPayloadSchema,
  CatalogVersionSchema,
  CategoryDetailSchema,
  CategorySchema,
  CoverageItemSchema,
  CropDetailCountsSchema,
  CropDetailSchema,
  CropListItemSchema,
  PublicListingSchema,
  RecentItemSchema,
  SearchResponseSchema,
  SellerBrowseCountsSchema,
  SellerDetailSchema,
  SellerListItemSchema,
  SellerStateSchema,
  SeriesDetailSchema,
  VarietyDetailSchema,
  VarietyListItemSchema,
  VarietySummarySchema,
  type BrowseCounts,
  type BrowseCropsPayload,
  type BrowseSearchPayload,
  type BrowseVarietiesPayload,
  type CatalogVersion,
  type Category,
  type CategoryDetail,
  type CoverageItem,
  type CropDetail,
  type CropDetailCounts,
  type CropListItem,
  type GrowerGuide,
  type LifeCycleParam,
  type Media,
  type PacketSize,
  type PlantRef,
  type PublicListing,
  type Rating,
  type RecentItem,
  type SearchResponse,
  type SearchResult,
  type SearchType,
  type SellerDetail,
  type ImportedRating,
  type SellerBrowseCounts,
  type SellerListItem,
  type SellerState,
  type SeriesDetail,
  type VarietyDetail,
  type VarietyListItem,
  type VarietySummary,
} from "@/lib/validators";
import { CatalogGrowerGuideInput } from "@/lib/catalog/input";
import { proseCommonName, templateDescription } from "./template";
import { sellerCounts } from "@/lib/seller-counts";

export interface Paged<T> {
  items: T[];
  total: number;
}

/**
 * The crop-detail browse result (Tranche 3.1b-2): the crop page's crop (its varieties window
 * is the page's items) plus the per-option counts describing them. The crop-detail server
 * page (first paint) and GET /api/browse/crops/[slug] share this — the route serves the
 * BrowseCropPayload slice (items/total/page/pages/counts), so SSR and in-place can never
 * disagree.
 */
export interface BrowseCropResult {
  crop: CropDetail;
  total: number;
  colorFamilies: string[];
  page: number;
  pages: number;
  counts: CropDetailCounts;
}

/**
 * The seller browse result (Tranche 3.1b-2): the sellers window plus the per-option counts
 * describing it and the rendered cloud options. The /seller server page (first paint) and
 * GET /api/browse/sellers share this — the route serves the BrowseSellersPayload slice
 * (items/total/page/pages/counts), so SSR and in-place can never disagree.
 */
export interface BrowseSellersResult {
  items: SellerListItem[];
  total: number;
  page: number;
  pages: number;
  counts: SellerBrowseCounts;
  states: SellerState[];
}

/**
 * media row → API media (design D3). url = r2_key as stored (the canonical public path; never
 * rewritten). Since the R2 + Image Transformations migration (2026-11-18) card and hero sizes are
 * transformations computed at render time (lib/images), so no thumbUrl is populated any more —
 * the field stays optional in the schema for API backward compatibility.
 */
export function toMedia(row: repo.MediaRow): Media {
  return { url: row.r2Key, licence: row.licence, credit: row.credit };
}
/** A subject shows an average only once it has this many reviews (canonical §2 "Ratings"). */
const MIN_REVIEWS_FOR_RATING = 3;

/** Validate (throws on bad data — fail loudly, NFR4). */
export function parse<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new Error(`Invalid ${what} from repository: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  return r.data;
}

export function ratingOf(reviewCount: number, average: number | null): Rating {
  return reviewCount >= MIN_REVIEWS_FOR_RATING && average !== null
    ? { state: "rated", average, review_count: reviewCount }
    : { state: "not_yet_rated", average: null, review_count: reviewCount };
}

export const goUrl = (listingId: number) => `${SITE_URL}/go/${listingId}`;

/** The ONE PlantRef builder: every repository row that joins plants carries these columns. */
function plantRefOf(r: {
  plantSlug: string;
  commonName: string;
  latinName: string | null;
  seasonClass: SeasonClass | null;
  seasonSourceLabel: string | null;
  sowingMethods: string | null;
  sowingMethodSourceLabel: string | null;
}): PlantRef {
  const methods = sowingMethodsOf(r.sowingMethods);
  return {
    slug: r.plantSlug,
    commonName: r.commonName,
    latinName: r.latinName,
    season_class: r.seasonClass,
    season_source_label: r.seasonClass ? r.seasonSourceLabel : null,
    sowing_methods: methods,
    sowing_method_source_label: methods.length ? r.sowingMethodSourceLabel : null,
  };
}

/**
 * group_concat'd method list → canonical order (direct_sow, transplant). Unknown values are kept
 * so the PlantRef Zod parse rejects them loudly instead of silently dropping them.
 */
export function sowingMethodsOf(raw: string | null): SowingMethod[] {
  if (!raw) return [];
  const got = new Set(raw.split(","));
  const rank = (m: string) => {
    const i = (SOWING_METHODS as readonly string[]).indexOf(m);
    return i === -1 ? SOWING_METHODS.length : i;
  };
  return [...got].sort((a, b) => rank(a) - rank(b)) as SowingMethod[];
}

/**
 * plants.grower_guide JSON text (as imported from catalog.json) → API GrowerGuide. Absent fields
 * become null / [] (explicit unknown); a missing section is null. Malformed stored JSON fails
 * loudly (strict parse), like every other repository row.
 */
export function growerGuideOf(raw: string | null): GrowerGuide | null {
  if (raw == null) return null;
  const g = parse(CatalogGrowerGuideInput, JSON.parse(raw), "stored grower guide");
  const t = (v: string | undefined) => v ?? null;
  const growing = g.growing;
  const seed = g.seedSaving;
  return {
    growing: growing
      ? {
          sowing: t(growing.sowing),
          germination: t(growing.germination),
          transplanting: t(growing.transplanting),
          days_to_bloom: t(growing.days_to_bloom),
          spacing: t(growing.spacing),
          growing: t(growing.growing),
          harvest_for_cutting: t(growing.harvest_for_cutting),
          good_to_know: growing.good_to_know ?? [],
        }
      : null,
    seed_saving: seed
      ? {
          difficulty: t(seed.difficulty),
          when_to_harvest: t(seed.when_to_harvest),
          how_to_collect: t(seed.how_to_collect),
          cleaning: t(seed.cleaning),
          drying: t(seed.drying),
          storage: t(seed.storage),
          pollination_notes: t(seed.pollination_notes),
        }
      : null,
  };
}

function groupPackets(rows: PacketRow[]): Map<number, PacketSize[]> {
  const m = new Map<number, PacketSize[]>();
  for (const r of rows) {
    const list = m.get(r.listingId) ?? [];
    list.push({ label: r.label, seedCount: r.seedCount });
    m.set(r.listingId, list);
  }
  return m;
}

/** The ONE public listing serializer (pages, API, /recent, /sync all go through it). */
function mapListing(l: PublicListingRow, packets: PacketSize[], media: Media[] = [], cropMedia: Media[] = []): PublicListing {
  return parse(
    PublicListingSchema,
    {
      id: l.id,
      variety: {
        slug: l.varietySlug,
        varietyName: l.varietyName,
        plant: plantRefOf(l),
        colorSwatch: l.colorSwatch,
        media,
        cropMedia,
      },
      seller: {
        slug: l.sellerSlug,
        name: l.sellerName,
        location: l.sellerLocation,
        region: l.sellerRegion,
        country: l.sellerCountry,
        isSmallFarm: l.sellerIsSmallFarm,
      },
      availability: l.availability,
      lastCheckedAt: l.lastCheckedAt,
      firstSeenAt: l.firstSeenAt,
      goUrl: goUrl(l.id),
      productUrl: l.productUrl,
      notes: l.notes,
      status: "published",
      packetSizes: packets,
      provenance: {
        source_url: l.sourceUrl,
        retrieved_at: l.lastCheckedAt,
        method: l.matchMethod,
        confidence: l.confidence,
      },
      sourceLabel: l.sourceLabel ?? null,
    },
    "listing",
  );
}

/** "As of Nov 15, 2026, 3 sellers list King's Ransom: A, B and C." — data only (canonical §5 GEO). */
export function answerSentence(varietyName: string, listings: PublicListing[]): string {
  if (listings.length === 0) return zeroSellerSentence(varietyName);
  const names = [...new Set(listings.map((l) => l.seller.name))];
  const raw = listings
    .map((l) => l.lastCheckedAt?.slice(0, 10))
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const date = raw ? formatFriendlyDate(raw) : null;
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names.at(-1)!}`;
  const n = names.length;
  const lead = date ? `As of ${date}, ` : "";
  const verb = n === 1 ? "seller lists" : "sellers list";
  // "Songbird Seed Co." already ends the sentence.
  return `${lead}${n} ${verb} ${varietyName}: ${list}${list.endsWith(".") ? "" : "."}`;
}

function summaryFrom(r: repo.VarietySummaryRow): VarietySummary {
  return parse(
    VarietySummarySchema,
    {
      slug: r.slug,
      varietyName: r.varietyName,
      plant: plantRefOf(r),
      category: { slug: r.categorySlug, name: r.categoryName },
      subcategory: r.subcategorySlug && r.subcategoryName ? { slug: r.subcategorySlug, name: r.subcategoryName } : null,
      series: r.seriesSlug && r.seriesName ? { slug: r.seriesSlug, name: r.seriesName } : null,
      colorSwatch: r.colorSwatch,
      colorFamily: r.colorFamily,
      listingCount: r.listingCount ?? 0,
      sellerCount: r.sellerCount ?? 0,
      inStockCount: r.inStockCount ?? 0,
      lastCheckedAt: r.lastChecked,
      indexable: r.indexable,
      rating: ratingOf(0, null),
    },
    "variety summary",
  );
}

type SellerRow = NonNullable<Awaited<ReturnType<typeof repo.sellerRow>>>;

/** The six sellers.imported_rating_* columns (catalog read and sync rows share these names). */
interface ImportedRatingColumns {
  importedRatingSource: ImportedRating["source"] | null;
  importedRatingPlaceName: string | null;
  importedRatingPlaceId: string | null;
  importedRatingValue: number | null;
  importedRatingCount: number | null;
  importedRatingFetchedAt: string | null;
}

/**
 * Imported third-party aggregate, or null. Kept apart from ratingOf(): it never feeds our rating.
 * A row with a source but missing fields is passed through so the schema fails loudly.
 */
export function importedRatingOf(r: ImportedRatingColumns): ImportedRating | null {
  if (r.importedRatingSource === null) return null;
  return {
    source: r.importedRatingSource,
    placeName: r.importedRatingPlaceName as string,
    placeId: r.importedRatingPlaceId as string,
    rating: r.importedRatingValue as number,
    reviewCount: r.importedRatingCount as number,
    fetchedDate: r.importedRatingFetchedAt as string,
  };
}

function sellerBase(r: SellerRow) {
  return {
    slug: r.slug,
    name: r.name,
    type: r.type,
    location: r.location,
    region: r.region,
    country: r.country,
    homepage: r.homepage,
    ratingCount: r.ratingCount,
    ratingAverage: r.ratingCount > 0 ? r.ratingAverage : null,
    rating: ratingOf(r.ratingCount, r.ratingCount > 0 ? r.ratingAverage : null),
    importedRating: importedRatingOf(r),
    isSmallFarm: r.isSmallFarm,
  };
}

function parseShipsTo(raw: string): string[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) && v.every((x) => typeof x === "string") && v.length > 0 ? v : ["unknown"];
  } catch {
    return ["unknown"];
  }
}

function likePattern(query: string): string {
  const lowered = query.replace(/[%_\\]/g, "").toLowerCase();
  return [...lowered].length >= 3 ? `%${lowered}%` : `${lowered}%`;
}

interface SearchOptions {
  limit?: number;
  types?: SearchType[];
  /** When set, the search is logged to search_events with this client label. */
  logClient?: string | null;
  /** Only crops / series / varieties whose crop has this season class (sellers are unaffected). */
  season?: SeasonClass;
  /** Only crops / series / varieties whose crop has ANY of these sowing methods (sellers are unaffected). */
  methods?: SowingMethod[];
  /** Only crops / series / varieties whose crop is in ANY of these life-cycle buckets (sellers are unaffected). */
  lifeCycle?: LifeCycleParam[];
  /** Only varieties of these colour families (variety-level: crops, series and sellers are unaffected). */
  colorFamily?: string[];
}

/** The /search page's result cap (also the browse-search payload's): 50 varieties, 5 per other group. */
const SEARCH_BROWSE_LIMIT = 50;

/** Crop / series / seller search rows → SearchResult (shared by search and browseSearch). */
function cropSearchResults(rows: Awaited<ReturnType<typeof repo.searchPlantRows>>): SearchResult[] {
  return rows.map((p) => ({
    type: "crop",
    slug: p.slug,
    title: proseCommonName(p.commonName),
    subtitle: p.latinName ? `${p.latinName} · crop` : "crop",
    href: `/crop/${p.slug}`,
    matchedAlias: null,
  }));
}

function seriesSearchResults(rows: Awaited<ReturnType<typeof repo.searchSeriesRows>>): SearchResult[] {
  return rows.map((s) => ({
    type: "series",
    slug: s.slug,
    title: `${s.name} series`,
    subtitle: `${proseCommonName(s.commonName)} · series`,
    href: `/series/${s.slug}`,
    matchedAlias: null,
  }));
}

function sellerSearchResults(rows: Awaited<ReturnType<typeof repo.searchSellerRows>>): SearchResult[] {
  return rows.map((s) => ({
    type: "seller",
    slug: s.slug,
    title: s.name,
    subtitle: s.location ? `${s.location} · seller` : "seller",
    href: `/seller/${s.slug}`,
    matchedAlias: null,
  }));
}

/**
 * Count-query totals → BrowseCounts. The matrix shape is validated by the schema parse (a
 * missing or extra option fails loudly); the sellers on-count is looked up strictly — a
 * missing "true" option is a matrix defect, never a silent 0.
 */
function assembleBrowseCounts(queries: BrowseCountQuery[], totals: number[]): BrowseCounts {
  const byGroup = new Map<string, { all: number; options: Record<string, number> }>();
  for (const [i, q] of queries.entries()) {
    const g = byGroup.get(q.group) ?? { all: 0, options: {} };
    if (q.option === null) g.all = totals[i] ?? 0;
    else g.options[q.option] = totals[i] ?? 0;
    byGroup.set(q.group, g);
  }
  const g = (name: string) => byGroup.get(name) ?? { all: 0, options: {} };
  const sellers = g("smallFarm");
  const on = sellers.options["true"];
  if (on === undefined) throw new Error("browse counts: small-farm on-count missing from the count matrix");
  return parse(
    BrowseCountsSchema,
    {
      season: g("season"),
      method: g("method"),
      lifeCycle: g("lifeCycle"),
      hue: g("hue"),
      smallFarm: { all: sellers.all, on },
    },
    "browse counts",
  );
}

/**
 * Count-query totals → BrowseCounts for a surface rendering a subset of the groups
 * (Tranche 3.1b). Queried groups stay strict (a missing cell is a matrix defect, never a
 * silent 0); groups the surface does not render carry their honest All — the result total,
 * since the group is always cleared — and fail-closed 0 options. No chip reads those
 * cells; if one ever did, the 0 renders and stays operable per the zero-count rule.
 */
function assemblePartialBrowseCounts(queries: BrowseCountState[], totals: number[], total: number): BrowseCounts {
  const queried = new Set(queries.map((q) => q.group));
  const cells = new Map<string, number>();
  queries.forEach((q, i) => {
    const t = totals[i];
    if (t === undefined) throw new Error(`browse counts: missing total for ${q.group}:${q.option ?? "all"}`);
    cells.set(`${q.group}:${q.option ?? "all"}`, t);
  });
  const cell = (group: BrowseFilterGroup, option: string | null): number => {
    const hit = cells.get(`${group}:${option ?? "all"}`);
    if (hit !== undefined) return hit;
    if (queried.has(group)) throw new Error(`browse counts: ${group}:${option ?? "all"} missing from the count matrix`);
    return option === null ? total : 0;
  };
  const group = (name: BrowseFilterGroup) => ({
    all: cell(name, null),
    options: Object.fromEntries(
      BROWSE_OPTIONS[name].options.filter((o) => o.value !== null).map((o) => [o.value, cell(name, o.value)]),
    ),
  });
  return parse(
    BrowseCountsSchema,
    {
      season: group("season"),
      method: group("method"),
      lifeCycle: group("lifeCycle"),
      hue: group("hue"),
      smallFarm: { all: cell("smallFarm", null), on: cell("smallFarm", "true") },
    },
    "browse counts",
  );
}

/**
 * Crop-detail count-query totals → CropDetailCounts (Tranche 3.1b-2). Every queried cell is
 * strict (a missing cell is a matrix defect, never a silent 0); the hue/series option keys
 * are the matrix's own rendered options, so the counts and the chips share one option list.
 * Zero counts are kept: a 0-count option renders its 0 and stays operable.
 */
function assembleCropDetailCounts(queries: CropCountState[], totals: number[]): CropDetailCounts {
  const cells = new Map<string, number>();
  queries.forEach((q, i) => {
    const t = totals[i];
    if (t === undefined) throw new Error(`crop-detail counts: missing total for ${q.group}:${q.option ?? "all"}`);
    cells.set(`${q.group}:${q.option ?? "all"}`, t);
  });
  const cell = (group: CropCountState["group"], option: string | null): number => {
    const hit = cells.get(`${group}:${option ?? "all"}`);
    if (hit === undefined) throw new Error(`crop-detail counts: ${group}:${option ?? "all"} missing from the count matrix`);
    return hit;
  };
  const options = (group: CropCountState["group"]): Record<string, number> =>
    Object.fromEntries(queries.filter((q) => q.group === group && q.option !== null).map((q) => [q.option, cell(group, q.option)]));
  return parse(
    CropDetailCountsSchema,
    {
      sellers: { all: cell("sellers", null), has: cell("sellers", "true"), none: cell("sellers", "false") },
      hue: { all: cell("hue", null), options: options("hue") },
      series: { all: cell("series", null), options: options("series") },
    },
    "crop-detail counts",
  );
}

export function createCatalogService(db: Db) {
  /**
   * Variety summaries without media. Used directly only where list media is never shown: search
   * (maps to SearchResult) and getVariety (fetches its own media). Everything else uses summaries().
   */
  async function baseSummaries(filters: VarietyFilters, sort: VarietySort, page: Page): Promise<Paged<VarietySummary> & { ids: number[] }> {
    const { rows, total } = await repo.listVarietySummaryRows(db, filters, sort, page);
    return { items: rows.map(summaryFrom), ids: rows.map((r) => r.id), total };
  }

  /** List items: the page's summaries plus each variety's media (one batched media query). */
  async function summaries(filters: VarietyFilters, sort: VarietySort, page: Page): Promise<Paged<VarietyListItem> & { ids: number[] }> {
    const { items, ids, total } = await baseSummaries(filters, sort, page);
    const mediaByVariety = await repo.listMediaForVarieties(db, ids);
    return {
      items: items.map((v, i) =>
        parse(
          VarietyListItemSchema,
          { ...v, media: (mediaByVariety.get(ids[i]!) ?? []).map(toMedia) },
          "variety list item",
        ),
      ),
      ids,
      total,
    };
  }

  async function listings(q: ListingQuery): Promise<PublicListing[]> {
    const rows = await repo.publicListingRows(db, q);
    const packets = groupPackets(await repo.packetRows(db, rows.map((l) => l.id)));
    // Seller-listing artwork: the varieties' own plates + their crops' plates, two batched
    // queries (chunked at 50 ids, like packets) — no N+1. Absent from the map = [] when none.
    const mediaByVariety = await repo.listMediaForVarieties(db, rows.map((l) => l.varietyId));
    const mediaByPlant = await repo.listMediaForPlants(db, rows.map((l) => l.plantId));
    return rows.map((l) =>
      mapListing(
        l,
        packets.get(l.id) ?? [],
        (mediaByVariety.get(l.varietyId) ?? []).map(toMedia),
        (mediaByPlant.get(l.plantId) ?? []).map(toMedia),
      ),
    );
  }

  async function cropListItem(
    p: Awaited<ReturnType<typeof repo.listPlantRows>>["rows"][number],
    mediaRows: repo.MediaRow[],
  ): Promise<CropListItem> {
    return parse(
      CropListItemSchema,
      {
        ...plantRefOf({ ...p, plantSlug: p.slug }),
        category: { slug: p.categorySlug, name: p.categoryName },
        varietyCount: p.coverage.varieties,
        varietiesWithSellers: p.coverage.withSellers,
        lastUpdated: p.coverage.lastUpdated,
        media: mediaRows.map(toMedia),
      },
      "crop",
    );
  }

  /** Crop windows with media (one batched media query) — shared by listCrops and browseCrops. */
  async function cropListItems(page: Page, opts: PlantListFilters = {}): Promise<Paged<CropListItem>> {
    const { rows, total } = await repo.listPlantRows(db, page, {
      season: opts.season,
      methods: opts.methods,
      lifeCycle: opts.lifeCycle,
    });
    const mediaByPlant = await repo.listMediaForPlants(db, rows.map((r) => r.id));
    return { items: await Promise.all(rows.map((r) => cropListItem(r, mediaByPlant.get(r.id) ?? []))), total };
  }

  /**
   * FTS variety matches → filtered, ranked variety results (shared by search and
   * browseSearch): exact → prefix → full text, has-listings first on ties. matchCount is the
   * untruncated ranked length (the logged search total's variety slice); varieties is the
   * rendered group, capped at lim.
   */
  async function varietySearchResults(
    matches: VarietyMatch[],
    filters: VarietyFilters,
    lim: number,
  ): Promise<{ varieties: SearchResult[]; matchCount: number }> {
    if (!matches.length) return { varieties: [], matchCount: 0 };
    const found = await baseSummaries(
      { ...filters, ids: matches.map((m) => m.varietyId) },
      "name",
      { offset: 0, limit: matches.length },
    );
    const byId = new Map(found.ids.map((id, i) => [id, found.items[i]!]));
    const ranked = matches
      .map((m, order) => ({ m, order, v: byId.get(m.varietyId) }))
      .filter((x): x is { m: VarietyMatch; order: number; v: VarietySummary } => Boolean(x.v))
      .sort((a, b) => a.m.tier - b.m.tier || Number(b.v.listingCount > 0) - Number(a.v.listingCount > 0) || a.order - b.order);
    const varieties: SearchResult[] = ranked.slice(0, lim).map(({ m, v }) => ({
      type: "variety",
      slug: v.slug,
      title: v.varietyName,
      subtitle: `${proseCommonName(v.plant.commonName)} · ${v.sellerCount === 0 ? "no seller listing yet" : `${v.sellerCount} seller${v.sellerCount === 1 ? "" : "s"}`}`,
      href: `/variety/${v.slug}`,
      matchedAlias: m.matchedAlias,
    }));
    return { varieties, matchCount: ranked.length };
  }

  /**
   * US states with at least one visible seller, alphabetical by name, with counts. Drives the
   * /seller?state= chips and decides which /state/{slug} pages exist. Regions that are not a
   * US state code (or non-US sellers) are left out.
   */
  async function sellerStates(): Promise<SellerState[]> {
    const rows = await repo.sellerRegionCountRows(db);
    const out: SellerState[] = [];
    for (const r of rows) {
      const st = r.country === "US" ? stateByCode(r.region) : null;
      if (st && r.region === st.code) out.push(parse(SellerStateSchema, { ...st, sellerCount: r.n }, "seller state"));
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    async listVarieties(opts: { filters?: VarietyFilters; sort?: VarietySort; page: Page }): Promise<Paged<VarietyListItem>> {
      const { items, total } = await summaries(opts.filters ?? {}, opts.sort ?? "name", opts.page);
      return { items, total };
    },

    /**
     * The /variety browse payload (Tranche 3.1a): the page of results plus the per-option
     * counts describing them, from the same query behind the results. The server page and
     * GET /api/browse/varieties share this — first paint and every in-place update consume
     * the identical contract. Resting order is Name A–Z (PB-1: the sort control is Item 3.4).
     */
    async browseVarieties(opts: { filters: BrowseFilterState; page: Page }): Promise<BrowseVarietiesPayload> {
      const vf = varietyFiltersFromBrowse(opts.filters);
      const queries = browseCountQueries(opts.filters);
      const [{ items, total }, totals] = await Promise.all([
        summaries(vf, "name", opts.page),
        Promise.all(queries.map((q) => repo.countVarietyRows(db, q.filters))),
      ]);
      return parse(
        BrowseVarietiesPayloadSchema,
        {
          items,
          total,
          page: Math.floor(opts.page.offset / opts.page.limit) + 1,
          pages: totalPages(total, opts.page.limit),
          counts: assembleBrowseCounts(queries, totals),
        },
        "browse varieties payload",
      );
    },

    async getVariety(slug: string): Promise<VarietyDetail | null> {
      const row = await repo.varietyDetailRow(db, slug);
      if (!row) return null;
      const [{ tags, aliases }, ls, s, mediaRows] = await Promise.all([
        repo.varietyTagsAndAliases(db, row.id),
        listings({ varietyId: row.id }),
        baseSummaries({ ids: [row.id] }, "name", { offset: 0, limit: 1 }),
        repo.listMediaForVariety(db, row.id),
      ]);
      const summary = s.items[0];
      if (!summary) return null;
      const detail: VarietyDetail = {
        ...summary,
        plant: {
          ...plantRefOf(row),
          description: row.plantDescription,
          sowingNotes: row.plantSowingNotes,
        },
        description: row.description,
        templateDescription: templateDescription({
          varietyName: row.varietyName,
          commonName: row.commonName,
          latinName: row.latinName,
          sellerCount: sellerCounts(ls).sellers,
        }),
        answer: answerSentence(row.varietyName, ls),
        sowingNotes: row.sowingNotes,
        heightCm: row.heightCm,
        facts: {
          color_family: row.colorFamily,
          pollination: row.pollination,
          // One sourced height is both ends of the range; null means unknown.
          height_cm: { min: row.heightCm, max: row.heightCm },
          days_to_bloom: { min: row.daysToBloomMin, max: row.daysToBloomMax },
        },
        tags,
        aliases,
        protection: row.protection,
        protectionNote: row.protectionNote,
        contentLevel: row.contentLevel,
        updatedAt: row.updatedAt,
        listings: ls,
        media: mediaRows.map(toMedia),
      };
      return parse(VarietyDetailSchema, detail, "variety detail");
    },

    /** Surviving slug for a merged variety (pages 308 to it). */
    mergedVarietyTarget: (slug: string) => repo.mergedVarietyTarget(db, slug),

    async varietyListings(slug: string, q: Pick<ListingQuery, "availability" | "shipsTo" | "smallFarmOnly"> = {}): Promise<PublicListing[] | null> {
      const row = await repo.varietyDetailRow(db, slug);
      if (!row) return null;
      return listings({ varietyId: row.id, ...q });
    },

    async listSellers(page: Page, filters: repo.SellerFilters = {}): Promise<Paged<SellerListItem>> {
      const { rows, total } = await repo.listSellerRows(db, page, filters);
      const items = rows.map((r) =>
        parse(SellerListItemSchema, { ...sellerBase(r), varietyCount: r.varietyCount ?? 0 }, "seller list item"),
      );
      return { items, total };
    },

    listSellerStates: sellerStates,

    /**
     * The seller browse result (Tranche 3.1b-2): the sellers window plus the per-option
     * counts describing it and the rendered cloud options. The /seller server page (first
     * paint) and GET /api/browse/sellers share this — first paint and every in-place update
     * consume the identical contract. The counts are the cloud's own numbers (the All-states
     * total plus each state chip's seller count, from the same sellerStates() the cloud
     * renders), so the chips and the payload can never disagree.
     */
    async browseSellers(opts: { state: SellerBrowseState; page: Page }): Promise<BrowseSellersResult> {
      const states = await sellerStates();
      const { rows, total } = await repo.listSellerRows(db, opts.page, opts.state.state ? { region: [opts.state.state] } : {});
      const items = rows.map((r) =>
        parse(SellerListItemSchema, { ...sellerBase(r), varietyCount: r.varietyCount ?? 0 }, "seller list item"),
      );
      return {
        items,
        total,
        page: Math.floor(opts.page.offset / opts.page.limit) + 1,
        pages: totalPages(total, opts.page.limit),
        counts: parse(
          SellerBrowseCountsSchema,
          {
            all: states.reduce((n, s) => n + s.sellerCount, 0),
            options: Object.fromEntries(states.map((s) => [s.code, s.sellerCount])),
          },
          "seller browse counts",
        ),
        states,
      };
    },

    async getSeller(slug: string): Promise<SellerDetail | null> {
      const r = await repo.sellerRow(db, slug);
      if (!r) return null;
      const ls = await listings({ sellerId: r.id });
      const detail: SellerDetail = {
        ...sellerBase(r),
        description: r.description,
        orderingNotes: r.orderingNotes,
        varietyCount: r.varietyCount ?? 0,
        updatedAt: r.updatedAt,
        claimStatus: r.claimStatus,
        shipsTo: parseShipsTo(r.shipsTo),
        isSiteOwner: r.isSiteOwner,
        listings: ls,
      };
      return parse(SellerDetailSchema, detail, "seller detail");
    },

    /** "ok" (visible), "gone" (removed at the seller's request → 410), or "missing" (→ 404). */
    async sellerStatus(slug: string): Promise<"ok" | "gone" | "missing"> {
      const e = await repo.sellerEligibility(db, slug);
      if (!e) return "missing";
      if (e.eligibility === "removed_by_request" || e.listingPolicy === "removed") return "gone";
      return (await repo.sellerRow(db, slug)) ? "ok" : "missing";
    },

    async sellerListings(slug: string, q: Pick<ListingQuery, "availability" | "plant"> = {}): Promise<PublicListing[] | null> {
      const r = await repo.sellerRow(db, slug);
      if (!r) return null;
      return listings({ sellerId: r.id, ...q });
    },

    async listCategories(): Promise<Category[]> {
      const rows = await repo.categoryRows(db);
      return rows.map((c) => parse(CategorySchema, c, "category"));
    },

    async getCategory(slug: string, page: Page): Promise<{ category: CategoryDetail; total: number } | null> {
      const [c] = await repo.categoryRows(db, slug);
      if (!c) return null;
      const { items, total } = await summaries({ category: slug }, "name", page);
      return { category: parse(CategoryDetailSchema, { ...c, varieties: items }, "category detail"), total };
    },

    async listCrops(page: Page, opts: PlantListFilters = {}): Promise<Paged<CropListItem>> {
      return cropListItems(page, opts);
    },

    /**
     * The crop browse payload (Tranche 3.1b): the crop window plus the per-option counts
     * describing them, from the same query behind the results. The home page and the /crop
     * index (first paint) and GET /api/browse/crops share this — first paint and every
     * in-place update consume the identical contract. Resting order is Name A–Z, the whole
     * catalog on one window (PB-1: the sort control is Item 3.4).
     */
    async browseCrops(opts: { filters: BrowseFilterState; page: Page }): Promise<BrowseCropsPayload> {
      const queries = browseCountStates(opts.filters, ["season", "method"], "single");
      const [{ items, total }, totals] = await Promise.all([
        cropListItems(opts.page, cropFiltersFromBrowse(opts.filters)),
        Promise.all(queries.map((q) => repo.countPlantRows(db, cropFiltersFromBrowse(q.state)))),
      ]);
      return parse(
        BrowseCropsPayloadSchema,
        {
          items,
          total,
          page: Math.floor(opts.page.offset / opts.page.limit) + 1,
          pages: totalPages(total, opts.page.limit),
          counts: assemblePartialBrowseCounts(queries, totals, total),
        },
        "browse crops payload",
      );
    },

    async getCrop(
      slug: string,
      opts: { page: Page; filters?: Pick<VarietyFilters, "colorFamily" | "series" | "hasListings">; sort?: VarietySort },
    ): Promise<{ crop: CropDetail; total: number; colorFamilies: string[] } | null> {
      const p = await repo.plantRow(db, slug);
      if (!p) return null;
      const [s, seriesRows, colorFamilies, mediaRows] = await Promise.all([
        summaries({ ...opts.filters, plant: [slug] }, opts.sort ?? "name", opts.page),
        repo.seriesForPlant(db, p.id),
        repo.colorFamiliesForPlant(db, slug),
        repo.listMediaForPlant(db, p.id),
      ]);
      const crop: CropDetail = {
        ...(await cropListItem(p, mediaRows)),
        description: p.description,
        sowingNotes: p.sowingNotes,
        life_cycle: p.lifeCycle,
        hardiness: p.hardiness,
        grower_guide: growerGuideOf(p.growerGuide),
        series: seriesRows,
        varieties: s.items,
      };
      return { crop: parse(CropDetailSchema, crop, "crop detail"), total: s.total, colorFamilies };
    },

    /**
     * The crop-detail browse result (Tranche 3.1b-2): the crop page's crop (its varieties
     * window is the page's items) plus the per-option counts describing them, each counted
     * by the same total query behind the results, so counts and results can never disagree.
     * The crop-detail server page (first paint) and GET /api/browse/crops/[slug] share this
     * — first paint and every in-place update consume the identical contract. Resting order
     * is Name A–Z (PB-1: the sort control is Item 3.4).
     */
    async browseCrop(slug: string, opts: { state: CropDetailFilterState; page: Page }): Promise<BrowseCropResult | null> {
      const p = await repo.plantRow(db, slug);
      if (!p) return null;
      const [s, seriesRows, colorFamilies, mediaRows] = await Promise.all([
        summaries({ ...cropVarietyFiltersFromState(opts.state), plant: [slug] }, "name", opts.page),
        repo.seriesForPlant(db, p.id),
        repo.colorFamiliesForPlant(db, slug),
        repo.listMediaForPlant(db, p.id),
      ]);
      const queries = cropCountStates(opts.state, {
        hues: cropHuesForFamilies(colorFamilies),
        series: seriesRows.map((r) => r.slug),
      });
      const totals = await Promise.all(
        queries.map((q) => repo.countVarietyRows(db, { ...cropVarietyFiltersFromState(q.state), plant: [slug] })),
      );
      const crop: CropDetail = {
        ...(await cropListItem(p, mediaRows)),
        description: p.description,
        sowingNotes: p.sowingNotes,
        life_cycle: p.lifeCycle,
        hardiness: p.hardiness,
        grower_guide: growerGuideOf(p.growerGuide),
        series: seriesRows,
        varieties: s.items,
      };
      return {
        crop: parse(CropDetailSchema, crop, "crop detail"),
        total: s.total,
        colorFamilies,
        page: Math.floor(opts.page.offset / opts.page.limit) + 1,
        pages: totalPages(s.total, opts.page.limit),
        counts: assembleCropDetailCounts(queries, totals),
      };
    },

    async getSeries(slug: string): Promise<SeriesDetail | null> {
      const r = await repo.seriesRow(db, slug);
      if (!r) return null;
      const { items } = await summaries({ series: [slug] }, "name", { offset: 0, limit: 100 });
      return parse(
        SeriesDetailSchema,
        {
          slug: r.slug,
          name: r.name,
          crop: plantRefOf(r),
          varietyCount: items.length,
          varietiesWithSellers: items.filter((v) => v.listingCount > 0).length,
          varieties: items,
        },
        "series detail",
      );
    },

    async coverage(): Promise<CoverageItem[]> {
      const rows = await repo.coverageRows(db);
      return rows.map((r) =>
        parse(
          CoverageItemSchema,
          {
            crop: { slug: r.slug, name: r.commonName },
            varieties: r.coverage.varieties,
            varieties_with_sellers: r.coverage.withSellers,
            last_updated: r.coverage.lastUpdated,
          },
          "coverage",
        ),
      );
    },

    async recent(opts: { plant?: string[]; since?: string; limit: number }): Promise<RecentItem[]> {
      const events = await repo.recentEventRows(db, opts);
      const byId = new Map((await listings({ ids: [...new Set(events.map((e) => e.listingId))] })).map((l) => [l.id, l]));
      return events
        .filter((e) => byId.has(e.listingId))
        .map((e) => parse(RecentItemSchema, { event: e.event, at: e.at, listing: byId.get(e.listingId) }, "recent item"));
    },

    /**
     * Search (R12). Any query of ≥ 2 characters searches; varieties rank exact → prefix → full
     * text with has-listings first on ties. Logs one search_events row when `logClient` is set.
     */
    async search(q: string, opts: SearchOptions = {}): Promise<SearchResponse> {
      const query = normaliseQuery(q);
      const lim = Math.max(1, Math.min(opts.limit ?? 10, 50));
      const types = new Set<SearchType>(opts.types?.length ? opts.types : ["variety", "series", "crop", "seller"]);
      const empty = { query, results: [], varieties: [], series: [], crops: [], sellers: [] };
      if ([...query.replace(/[%_\\]/g, "")].length < MIN_QUERY_CHARS) {
        if (opts.logClient && query) await logSearch(query, 0, opts.logClient);
        return parse(SearchResponseSchema, empty, "search");
      }
      const pattern = likePattern(query);
      const plantFilters: PlantFilters = { season: opts.season, methods: opts.methods, lifeCycle: opts.lifeCycle };
      const [plantRows, seriesRows, matches, sellerRows] = await Promise.all([
        types.has("crop") ? repo.searchPlantRows(db, pattern, Math.min(5, lim), plantFilters) : Promise.resolve([]),
        types.has("series") ? repo.searchSeriesRows(db, pattern, Math.min(5, lim), plantFilters) : Promise.resolve([]),
        types.has("variety") ? searchVarieties(db, query, { limit: 100 }) : Promise.resolve([] as VarietyMatch[]),
        types.has("seller") ? repo.searchSellerRows(db, pattern, Math.min(5, lim)) : Promise.resolve([]),
      ]);
      const vr = await varietySearchResults(
        matches,
        {
          season: opts.season ? [opts.season] : undefined,
          methods: opts.methods,
          lifeCycle: opts.lifeCycle,
          colorFamily: opts.colorFamily,
        },
        lim,
      );
      const crops = cropSearchResults(plantRows);
      const series = seriesSearchResults(seriesRows);
      const sellers = sellerSearchResults(sellerRows);
      const results = [...crops, ...series, ...vr.varieties, ...sellers].slice(0, lim);
      const total = vr.matchCount + crops.length + series.length + sellers.length;
      if (opts.logClient) await logSearch(query, total, opts.logClient);
      return parse(SearchResponseSchema, { query, results, varieties: vr.varieties, series, crops, sellers }, "search");
    },

    /**
     * The /search browse payload (Tranche 3.1b): the grouped results for the query under the
     * active filters, the grouped total, and the per-option counts describing it. The FTS
     * matches compute once, then filter per count state; sellers never filter (constant
     * across the matrix); hue moves only the variety slice (variety-level); season, method
     * and life cycle move varieties, crops and series (plant-level). The /search page and
     * GET /api/browse/search share this. Logs one search_events row when `logClient` is
     * set — the /search page view sets it (client `web/search-page`), so the page view is
     * logged exactly once; the browse endpoint never sets it — refinements are silent,
     * like every in-place change.
     */
    async browseSearch(q: string, opts: { filters: BrowseFilterState; logClient?: string | null }): Promise<BrowseSearchPayload> {
      const query = normaliseQuery(q);
      const lim = SEARCH_BROWSE_LIMIT;
      if ([...query.replace(/[%_\\]/g, "")].length < MIN_QUERY_CHARS) {
        if (opts.logClient && query) await logSearch(query, 0, opts.logClient);
        return parse(
          BrowseSearchPayloadSchema,
          {
            crops: [],
            series: [],
            varieties: [],
            sellers: [],
            total: 0,
            page: 1,
            pages: 1,
            counts: assemblePartialBrowseCounts([], [], 0),
          },
          "browse search payload",
        );
      }
      const pattern = likePattern(query);
      const matches = await searchVarieties(db, query, { limit: 100 });
      const sellers = sellerSearchResults(await repo.searchSellerRows(db, pattern, Math.min(5, lim)));
      const groupsFor = async (s: BrowseFilterState) => {
        const pf = cropFiltersFromBrowse(s);
        const [plantRows, seriesRows, vr] = await Promise.all([
          repo.searchPlantRows(db, pattern, Math.min(5, lim), pf),
          repo.searchSeriesRows(db, pattern, Math.min(5, lim), pf),
          varietySearchResults(matches, varietyFiltersFromBrowse(s), lim),
        ]);
        const crops = cropSearchResults(plantRows);
        const series = seriesSearchResults(seriesRows);
        return { crops, series, varieties: vr.varieties, total: crops.length + series.length + vr.varieties.length + sellers.length };
      };
      const countQueries = browseCountStates(opts.filters, ["season", "method", "lifeCycle", "hue"], "single");
      const [main, totals] = await Promise.all([
        groupsFor(opts.filters),
        Promise.all(countQueries.map((c) => groupsFor(c.state).then((g) => g.total))),
      ]);
      if (opts.logClient) await logSearch(query, main.total, opts.logClient);
      return parse(
        BrowseSearchPayloadSchema,
        {
          crops: main.crops,
          series: main.series,
          varieties: main.varieties,
          sellers,
          total: main.total,
          page: 1,
          pages: 1,
          counts: assemblePartialBrowseCounts(countQueries, totals, main.total),
        },
        "browse search payload",
      );
    },

    async catalogVersion(siteUrl: string): Promise<CatalogVersion> {
      const p = await latestPublish(db);
      return parse(
        CatalogVersionSchema,
        p
          ? {
              version: p.version,
              publishedAt: p.publishedAt,
              snapshotUrl: p.snapshotKey ? `${siteUrl}/api/v1/catalog/snapshot/${p.version}.sqlite` : null,
            }
          : { version: 0, publishedAt: null, snapshotUrl: null },
        "catalog version",
      );
    },

    catalogSeq: () => catalogSeq(db),
    counts: () => repo.catalogCounts(db),
    sitemapEntries: async () => ({
      varieties: await repo.indexableVarietyRows(db),
      sellers: await repo.allSellerSlugs(db),
      states: (await sellerStates()).map((st) => ({ slug: st.slug })),
      crops: await repo.allPlantSlugs(db),
      series: await repo.allSeriesSlugs(db),
    }),
  };

  async function logSearch(query: string, resultCount: number, client: string) {
    try {
      await insertSearchEvent(db, {
        at: new Date().toISOString(),
        queryNormalized: foldText(query).slice(0, 100),
        resultCount,
        client: client.slice(0, 60),
      });
    } catch (err) {
      // Logging must never break search.
      console.error("search_events insert failed", err);
    }
  }
}

export type CatalogService = ReturnType<typeof createCatalogService>;
