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
 * NO BADGE — DEFAULT (unreviewed) (56). Sellers added by the 2026-11-19/20 seller hunts after
 * the classification above was written (production grew 28 → 84 sellers). No individual Small
 * farm judgment has been recorded for any of them: the flag is OFF by default per the standing
 * when-in-doubt rule — "when in doubt, leave the flag OFF — Hue reviews new sellers from the
 * reports and adjusts badges afterward." These are NOT affirmative NO BADGE judgments like
 * SMALL_FARM_NO_BADGE_SLUGS above; each entry is a default pending Hue's individual review and
 * is flippable via the admin path. When Hue judges one, move its slug into BADGE or NO BADGE
 * (in seller-classification.md first, then here, same change). Mirrors the "NO BADGE — DEFAULT
 * (unreviewed)" section of seller-classification.md, recorded 2026-11-20.
 */
export const SMALL_FARM_DEFAULT_NO_BADGE_SLUGS = [
  "sweet-pea-gardens",
  "uprising-seeds",
  "territorial-seed-company",
  "outsidepride",
  "adaptive-seeds",
  "eden-brothers",
  "reimer-seeds",
  "thresh-seed-co",
  "tomorrowseeds",
  "south-ga-seed-co",
  "alliance-of-native-seedkeepers",
  "osborne-seed",
  "rupp-seeds",
  "urban-farmer",
  "harris-seeds",
  "park-seed",
  "fedco-seeds",
  "trailing-petunia",
  "epic-gardening",
  "everwilde-farms",
  "seedman",
  "halden-garden",
  "hirts-gardens",
  "trf-la",
  "high-country-gardens",
  "tomato-growers-supply-co",
  "true-leaf-market",
  "bucktown-seed-co",
  "baker-creek-heirloom-seed-co",
  "gertens-garden-center",
  "angletok",
  "autumn-prairie-pumpkins",
  "fellabees-nativeseeds",
  "grow-organic-peaceful-valley-farm-garden-supply",
  "homestead-culture",
  "j-l-hudson-seeds",
  "plant-good-seed",
  "sandhill-preservation",
  "sow-true-seed",
  "survival-garden-seeds",
  "ujamaa-seeds",
  "wild-garden-seed",
  "san-diego-seed-company",
  "jerras-garden",
  "marys-heirloom-seeds",
  "grow-hoss",
  "vermont-wildflower-farm",
  "flower-people",
  "garden-tree-nursery",
  "prairie-road-organic-seed",
  "garden-pro-hub",
  "southern-seeds",
  "walnut-creek-supply",
  "seedway",
  "deep-harvest-farm",
  "strictly-medicinal-seeds",
] as const;

/**
 * Production reconciliation target (updated 2026-11-20): 84 sellers — the original 28
 * (verified against the live API 2026-11-19: the 25 in seed-data/catalog.json, seedtime +
 * davids-garden-seeds (ingest), geoseed (crawl)) plus the 56 sellers added by the 2026-11-19/20
 * seller hunts, recorded above as NO BADGE — DEFAULT (unreviewed) pending Hue's review.
 * Badged stays 20; not-badged is 8 judged + 56 defaults = 64.
 */
export const SMALL_FARM_PRODUCTION_TARGET = { total: 84, badged: 20, notBadged: 64 } as const;
