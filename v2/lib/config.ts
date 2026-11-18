/** Site-wide constants. Canonical URLs always point at production (S2). */
export const SITE_URL = "https://seeds.hues.flowers";
export const SITE_NAME = "seeds.hues.flowers";
export const SITE_TITLE = "seeds.hues.flowers — Find Where to Buy Any Flower Seed";
export const SITE_DESCRIPTION =
  "A directory of flower seed varieties and the small farms that sell them — with stock state as last seen, the date each listing was checked, and a direct link to the farm.";
export const APP_NAME = "seeds.hues.flowers — Seed Directory";
export const APP_SHORT_NAME = "Seed Directory";
export const THEME_COLOR = "#F8F1E1";
export const BACKGROUND_COLOR = "#F8F1E1";
export const PAGE_SIZE = 24;
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
