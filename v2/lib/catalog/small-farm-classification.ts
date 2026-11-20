/**
 * The recorded "Small farm" badge judgment (Open Directory, Dustin's ruling 2026-11-19), copied
 * verbatim as slug lists from the source of truth:
 *
 *   ~/workspace/seeds-hues/open-directory/seller-classification.md
 *
 * Ops/test data only — the site never reads this file; the badge lives on `sellers.is_small_farm`
 * and is set through the admin path (lib/repositories/admin.ts setSellerSmallFarm). If Dustin flips
 * a call: edit seller-classification.md FIRST, then these lists (same change), then re-run
 * scripts/apply-small-farm-badges.ts for production and scripts/add-small-farm-data.py for the
 * curated catalog.
 */

/** BADGE — small farms and small seed sellers (20). */
export const SMALL_FARM_BADGE_SLUGS = [
  "3-porch-farm",
  "blomma-flower-farm",
  "dawn-creek-farm",
  "floret",
  "half-moons-farm",
  "hudson-valley-seed-co",
  "jig-bee-flower-farm",
  "millay-and-meadowlark-flower-farm",
  "peace-seedlings",
  "renees-garden",
  "prairie-moon-nursery",
  "seedtime",
  "select-seeds",
  "songbird-seed-co",
  "summertime-seed-co",
  "sunflower-selections",
  "sunflower-steve-seed-co",
  "the-gardeners-workshop",
  "three-brothers-blooms",
  "davids-garden-seeds",
] as const;

/**
 * NO BADGE — national catalogs, wholesale, and national-scale institutions (7), plus GeoSeed,
 * pre-recorded NO BADGE in the classification and live in production as seller 28 since the
 * 2026-11-19 crawl.
 */
export const SMALL_FARM_NO_BADGE_SLUGS = [
  "american-meadows",
  "botanical-interests",
  "great-basin-seed",
  "high-mowing-organic-seeds",
  "johnnys-selected-seeds",
  "seed-savers-exchange",
  "wild-west-seed",
  "geoseed",
] as const;

/**
 * Production reconciliation target (verified against the live API 2026-11-19): 28 sellers —
 * the 25 in seed-data/catalog.json, seedtime + davids-garden-seeds (ingest), geoseed (crawl).
 */
export const SMALL_FARM_PRODUCTION_TARGET = { total: 28, badged: 20, notBadged: 8 } as const;
