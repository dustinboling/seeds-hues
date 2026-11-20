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

/** BADGE — small farms and small seed sellers (42: the original 20 plus 22 of the 24 hunt-added sellers judged BADGE in Hue's 2026-11-20 review; Urban Farmer and Halden Garden were flipped to NO BADGE by Hue's ruling on Quinn's dispute later that day). */
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
  "sweet-pea-gardens",
  "uprising-seeds",
  "adaptive-seeds",
  "thresh-seed-co",
  "south-ga-seed-co",
  "alliance-of-native-seedkeepers",
  "bucktown-seed-co",
  "autumn-prairie-pumpkins",
  "fellabees-nativeseeds",
  "homestead-culture",
  "j-l-hudson-seeds",
  "plant-good-seed",
  "sandhill-preservation",
  "sow-true-seed",
  "wild-garden-seed",
  "san-diego-seed-company",
  "jerras-garden",
  "marys-heirloom-seeds",
  "flower-people",
  "prairie-road-organic-seed",
  "deep-harvest-farm",
  "strictly-medicinal-seeds",
] as const;

/**
 * NO BADGE — national catalogs, wholesale, and national-scale institutions (41: the original 7
 * plus 34 hunt-added sellers judged NO BADGE in Hue's 2026-11-20 review — the 32 judged
 * NO BADGE at review plus Urban Farmer and Halden Garden, flipped from BADGE by Hue's ruling
 * on Quinn's dispute), plus GeoSeed,
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
  "territorial-seed-company",
  "outsidepride",
  "eden-brothers",
  "reimer-seeds",
  "tomorrowseeds",
  "osborne-seed",
  "rupp-seeds",
  "harris-seeds",
  "park-seed",
  "fedco-seeds",
  "trailing-petunia",
  "epic-gardening",
  "everwilde-farms",
  "seedman",
  "hirts-gardens",
  "trf-la",
  "high-country-gardens",
  "tomato-growers-supply-co",
  "true-leaf-market",
  "baker-creek-heirloom-seed-co",
  "gertens-garden-center",
  "angletok",
  "grow-organic-peaceful-valley-farm-garden-supply",
  "survival-garden-seeds",
  "ujamaa-seeds",
  "grow-hoss",
  "vermont-wildflower-farm",
  "garden-tree-nursery",
  "garden-pro-hub",
  "southern-seeds",
  "walnut-creek-supply",
  "seedway",
  "urban-farmer",
  "halden-garden",
] as const;

/**
 * NO BADGE — DEFAULT (unreviewed). Sellers added by the 2026-11-19/20 seller hunts after the
 * classification above was written (production grew 28 → 84 sellers) sat in this list as
 * unreviewed defaults — flag OFF per the standing when-in-doubt rule ("when in doubt, leave
 * the flag OFF — Hue reviews new sellers from the reports and adjusts badges afterward").
 * Hue's individual review on 2026-11-20 judged all 56: 24 moved to BADGE and 32 to NO BADGE
 * above, each with its judgment recorded in seller-classification.md. The list is retained,
 * empty, so the fail-closed machinery keeps a recorded home for the next unreviewed seller:
 * a seller in none of the three lists still fails.
 */
/** NO BADGE — DEFAULT (unreviewed) (0). */
export const SMALL_FARM_DEFAULT_NO_BADGE_SLUGS = [] as const;

/**
 * Production reconciliation target (updated 2026-11-20, after Hue's badge review and her
 * same-day ruling on Quinn's dispute): 84 sellers —
 * the original 28 (verified against the live API 2026-11-19: the 25 in seed-data/catalog.json,
 * seedtime + davids-garden-seeds (ingest), geoseed (crawl)) plus the 56 sellers added by the
 * 2026-11-19/20 seller hunts, all 56 individually reviewed 2026-11-20 (24 BADGE at review,
 * 32 NO BADGE; Urban Farmer and Halden Garden then flipped BADGE → NO BADGE by the ruling).
 * Badged is 42; not-badged is 42 judged — no unreviewed defaults remain.
 */
export const SMALL_FARM_PRODUCTION_TARGET = { total: 84, badged: 42, notBadged: 42 } as const;
