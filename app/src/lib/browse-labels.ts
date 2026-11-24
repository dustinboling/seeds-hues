/**
 * Crop season-class and sowing-method display labels. Ported from
 * v2/lib/browse.ts (same strings); the Record types keep completeness over
 * the API enums checked at compile time.
 */
import type { ApiSeasonClass, ApiSowingMethod } from "../data/types";

export const SEASON_LABELS: Record<ApiSeasonClass, string> = {
  cool_season_hardy_annual: "Cool Season Hardy Annuals",
  warm_season_tender_annual: "Warm Season Tender Annuals",
};

export const SOWING_METHOD_LABELS: Record<ApiSowingMethod, string> = {
  direct_sow: "Direct Sow",
  transplant: "Start indoors",
};
