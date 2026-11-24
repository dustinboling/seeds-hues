/**
 * Site constants for the new app tree. Names, description, and URLs port
 * verbatim from v2/lib/config.ts; THEME_COLOR/BACKGROUND_COLOR take the warmed
 * ground per Dustin's Q3 ruling (PWA theme-color follows the ground delta).
 */
export const SITE_URL = "https://seeds.hues.flowers";
export const SITE_NAME = "seeds.hues.flowers";
export const SITE_DESCRIPTION =
  "Search a hard-to-find variety, see US sellers who have it — with stock state as last seen, the date each listing was checked, and a direct link to the seller.";
export const APP_NAME = "seeds.hues.flowers — Seed Directory";
export const APP_SHORT_NAME = "Seed Directory";
export const SITE_TITLE = "seeds.hues.flowers — Find Where to Buy Any Flower Seed";
export const PAGE_SIZE = 24;
/**
 * The crop browse window (home "Browse by crop", the /crop index): the whole
 * catalog on one page — one home so the surfaces can never disagree.
 */
export const CROP_BROWSE_LIMIT = 500;
/**
 * The home "Browse by crop" resting cap: at rest the grid shows the top 12
 * crops by varieties-with-sellers (then name) with a "see all crops" line.
 */
export const HOME_CROP_CAP = 12;
export const BOT_USER_AGENT = "HuesSeedFinderBot/1.0 (+https://seeds.hues.flowers/about/bot)";
export const BOT_NAME = "HuesSeedFinderBot";
export const THEME_COLOR = "#f8f6ec";
export const BACKGROUND_COLOR = "#f8f6ec";
export const OWNER_SITE_URL = "https://hues.flowers";
export const TRADEMARK_DISCLAIMER =
  "Variety and cultivar names are trademarks of their respective owners. seeds.hues.flowers is an independent directory, not affiliated with or endorsed by any listed seller.";
export const CONFLICT_OF_INTEREST =
  "Hues Floral Park grows flowers and buys seed from some listed sellers. Sellers do not pay for placement.";
