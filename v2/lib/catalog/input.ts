/**
 * Zod schema for seed-data/catalog.json (the single source of v2 seed data, FINAL spec §1.2).
 * Strict objects: an unexpected key fails the import instead of being silently dropped.
 */
import { z } from "zod";
import {
  CLAIM_STATUS,
  CRAWL_POLICY,
  ELIGIBILITY,
  IMPORTED_RATING_SOURCES,
  LISTING_POLICY,
  LISTING_STATUS,
  PROTECTION,
  SEASON_CLASSES,
  SELLER_PLATFORMS,
  SELLER_PROVENANCE,
  SELLER_STATUS,
  SELLER_TYPES,
  SOURCE_ACCESS,
  SOURCE_KINDS,
  SOWING_METHODS,
} from "@/lib/db/schema";
import { COLOR_FAMILIES } from "@/lib/validators";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const url = z.string().regex(/^https?:\/\/\S+$/);

export const CatalogSourceInput = z.strictObject({
  id: slug,
  kind: z.enum(SOURCE_KINDS),
  label: z.string().min(1),
  url: url.nullable(),
  checkedDate: isoDate.nullable(),
  access: z.enum(SOURCE_ACCESS),
});

export const CatalogCategoryInput = z.strictObject({
  slug,
  name: z.string().min(1),
  sortOrder: z.number().int(),
});

export const CatalogSubcategoryInput = z.strictObject({
  slug,
  name: z.string().min(1),
  category: slug,
});

const guideText = z.string().trim().min(1);

/**
 * Grower guide content for a crop (seed-saving import). Field names mirror the content files
 * (growing.json / instructions.json). Every field is optional: an absent field is not known and
 * is never filled in. Strict objects: an unknown key fails the import.
 */
export const CatalogGrowerGuideInput = z.strictObject({
  growing: z
    .strictObject({
      sowing: guideText.optional(),
      germination: guideText.optional(),
      transplanting: guideText.optional(),
      days_to_bloom: guideText.optional(),
      spacing: guideText.optional(),
      growing: guideText.optional(),
      harvest_for_cutting: guideText.optional(),
      good_to_know: z.array(guideText).min(1).optional(),
    })
    .optional(),
  seedSaving: z
    .strictObject({
      when_to_harvest: guideText.optional(),
      how_to_collect: guideText.optional(),
      cleaning: guideText.optional(),
      drying: guideText.optional(),
      storage: guideText.optional(),
      pollination_notes: guideText.optional(),
      difficulty: guideText.optional(),
    })
    .optional(),
});

export const CatalogPlantInput = z.strictObject({
  slug,
  commonName: z.string().min(1),
  latinName: z.string().min(1).nullable(),
  category: slug,
  description: z.string().min(1).nullable(),
  sowingNotes: z.string().min(1).nullable(),
  /** Season class + the source slug it came from. Both or neither; absent = not classified. */
  seasonClass: z.enum(SEASON_CLASSES).nullable().optional(),
  seasonSource: slug.nullable().optional(),
  /** Sowing methods + the source slug they came from. Both or neither; absent = not classified. */
  sowingMethods: z.array(z.enum(SOWING_METHODS)).optional(),
  sowingMethodSource: slug.nullable().optional(),
  /** Life cycle + hardiness (header fact) and the grower guide, with the one source slug they
   *  came from (internal provenance, never displayed). Absent = no content. */
  lifeCycle: guideText.optional(),
  hardiness: guideText.optional(),
  growerGuide: CatalogGrowerGuideInput.optional(),
  growerGuideSource: slug.optional(),
});

export const CatalogVarietyInput = z.strictObject({
  slug,
  plant: slug,
  varietyName: z.string().min(1),
  subcategory: slug.nullable(),
  description: z.string().min(1).nullable(),
  sowingNotes: z.string().min(1).nullable(),
  heightCm: z.number().int().positive().nullable(),
  colorSwatch: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  /** Colour family ("Hue"). Absent = unknown ('unknown' itself is never an input value). */
  colorFamily: z.enum(COLOR_FAMILIES).optional(),
  tags: z.array(z.string().min(1)),
  aliases: z.array(z.string().min(1)).optional(),
  protection: z.enum(PROTECTION),
  protectionNote: z.string().min(1).nullable(),
  sourceId: slug,
  /** Series name (e.g. "Dearest") or null. Series rows are created by the importer. */
  series: z.string().min(1).nullable(),
});

/**
 * Imported third-party aggregate rating (brief #4): rating + review count from the source's
 * places route. There is no review text. It is never our own rating.
 */
export const CatalogImportedRatingInput = z.strictObject({
  source: z.enum(IMPORTED_RATING_SOURCES),
  placeName: z.string().min(1),
  placeId: z.string().min(1),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  fetchedDate: isoDate,
});

export const CatalogSellerInput = z.strictObject({
  slug,
  name: z.string().min(1),
  type: z.enum(SELLER_TYPES),
  homepage: url.nullable(),
  location: z.string().min(1).nullable(),
  provenance: z.enum(SELLER_PROVENANCE),
  description: z.string().min(1).nullable(),
  orderingNotes: z.string().min(1).nullable(),
  platform: z.enum(SELLER_PLATFORMS).nullable(),
  listingPolicy: z.enum(LISTING_POLICY),
  status: z.enum(SELLER_STATUS),
  // Canonical §2 approval block (decision 25: the six owner-named exemplars).
  eligibility: z.enum(ELIGIBILITY),
  approvedAt: isoDate.nullable(),
  termsReviewedAt: isoDate.nullable(),
  approvalNote: z.string().min(1).nullable(),
  domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
  crawlPolicy: z.enum(CRAWL_POLICY),
  claimStatus: z.enum(CLAIM_STATUS),
  country: z.string().regex(/^[A-Z]{2}$/),
  region: z.string().min(1).nullable(),
  shipsTo: z.array(z.string().min(1)).min(1),
  isSiteOwner: z.boolean(),
  /** Absent or null = no imported rating. */
  importedRating: CatalogImportedRatingInput.nullable().optional(),
});

export const CatalogPacketInput = z.strictObject({
  label: z.string().min(1),
  seedCount: z.number().int().positive().nullable(),
  // Integer cents or NULL — a float here is a hard failure (§6 assertion).
  priceCents: z.number().int().nonnegative().nullable(),
  priceSource: z.string().min(1).nullable(),
  priceCheckDate: isoDate.nullable(),
  inStock: z.boolean().nullable(),
});

export const CatalogListingInput = z.strictObject({
  variety: slug,
  seller: slug,
  sourceId: slug,
  sku: z.string().min(1).nullable(),
  productUrl: url.nullable(),
  notes: z.string().min(1).nullable(),
  status: z.enum(LISTING_STATUS),
  packetSizes: z.array(CatalogPacketInput),
});

export const CatalogInput = z.strictObject({
  batch: z.strictObject({ label: z.literal("initial-catalog"), note: z.string() }),
  sources: z.array(CatalogSourceInput),
  categories: z.array(CatalogCategoryInput),
  subcategories: z.array(CatalogSubcategoryInput),
  plants: z.array(CatalogPlantInput),
  varieties: z.array(CatalogVarietyInput),
  sellers: z.array(CatalogSellerInput),
  listings: z.array(CatalogListingInput),
});

export type CatalogInput = z.infer<typeof CatalogInput>;
export type CatalogVarietyInput = z.infer<typeof CatalogVarietyInput>;
export type CatalogPlantInput = z.infer<typeof CatalogPlantInput>;
export type CatalogGrowerGuideInput = z.infer<typeof CatalogGrowerGuideInput>;
export type CatalogListingInput = z.infer<typeof CatalogListingInput>;
export type CatalogSellerInput = z.infer<typeof CatalogSellerInput>;
export type CatalogImportedRatingInput = z.infer<typeof CatalogImportedRatingInput>;
