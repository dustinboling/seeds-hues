/** Site-wide constants. Canonical URLs always point at production (S2). */
export const SITE_URL = "https://seeds.hues.flowers";
export const SITE_NAME = "seeds.hues.flowers";
export const SITE_TITLE = "seeds.hues.flowers — Find Where to Buy Any Flower Seed";
export const SITE_DESCRIPTION =
  "Search a hard-to-find variety, see US sellers who have it — with stock state as last seen, the date each listing was checked, and a direct link to the seller.";
export const APP_NAME = "seeds.hues.flowers — Seed Directory";
export const APP_SHORT_NAME = "Seed Directory";
export const THEME_COLOR = "#F8F1E1";
export const BACKGROUND_COLOR = "#F8F1E1";
export const PAGE_SIZE = 24;
/**
 * The crop browse window (home "Browse by crop", the /crop index, GET /api/browse/crops):
 * the whole catalog on one page. Must cover the catalog (124 crops, Nov 2026) — one home
 * so the surfaces and the endpoint can never disagree on the window.
 */
export const CROP_BROWSE_LIMIT = 500;
/**
 * The home "Browse by crop" resting cap (Tranche 3.4 §5.1): at rest the grid shows the top
 * 12 crops by varieties-with-sellers (then name) with a "see all crops" line; the cap lifts
 * under an active home filter. The /crop index is uncapped — this is the home grid's only.
 */
export const HOME_CROP_CAP = 12;
/**
 * Contact for seller corrections / removal requests and crawler opt-outs (the /report form is the
 * primary route). No address is recorded in
 * the project sources, so none is invented: set NEXT_PUBLIC_CONTACT_EMAIL at build time to publish
 * one; otherwise pages direct people to Hues Floral Park at https://hues.flowers.
 */
export const CONTACT_EMAIL: string | null = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
export const OWNER_SITE_URL = "https://hues.flowers";
export const BOT_USER_AGENT = "HuesSeedFinderBot/1.0 (+https://seeds.hues.flowers/about/bot)";
export const BOT_NAME = "HuesSeedFinderBot";

export const TRADEMARK_DISCLAIMER =
  "Variety and cultivar names are trademarks of their respective owners. seeds.hues.flowers is an independent directory, not affiliated with or endorsed by any listed seller.";
export const CONFLICT_OF_INTEREST =
  "Hues Floral Park grows flowers and buys seed from some listed sellers. Sellers do not pay for placement.";
