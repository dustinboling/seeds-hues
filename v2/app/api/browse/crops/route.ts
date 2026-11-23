/**
 * GET /api/browse/crops — the crop in-place payload (Tranche 3.1b): the crop window plus
 * the per-option counts describing it. Same query vocabulary as the home "Browse by crop"
 * and /crop index pages (?season= ?method= ?page=) and the same service call those pages
 * render with, so first paint and every in-place update consume the identical contract.
 * Internal (noindex, no-store); the hydrated layer's fetch failures surface the §2.5.6 path
 * (prior results stand, one error line).
 */
import { getServices } from "@/lib/services/context";
import { getRuntimeEnv } from "@/lib/api/runtime-env";
import { allowRequest, RETRY_AFTER_SECONDS } from "@/lib/api/rate-limit";
import { CACHE_NO_STORE, jsonError } from "@/lib/api/http";
import { pageWindow, totalPages } from "@/lib/paging";
import { readBrowseFiltersForGroups } from "@/lib/browse";
import { CROP_BROWSE_LIMIT } from "@/lib/config";
import { BROWSE_NO_INDEX, browseMethodNotAllowed, browseSearchParamsRecord, strictBrowsePage } from "@/lib/api/browse-route";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  let env;
  try {
    env = await getRuntimeEnv();
  } catch {
    return jsonError(500, "internal", "Runtime environment unavailable.", BROWSE_NO_INDEX);
  }
  if (!(await allowRequest(req, env.rateLimiter))) {
    return jsonError(429, "rate_limited", "Too many requests — limit is 120 per minute.", {
      ...BROWSE_NO_INDEX,
      "Retry-After": String(RETRY_AFTER_SECONDS),
    });
  }
  try {
    const sp = browseSearchParamsRecord(new URL(req.url), ["season", "method", "page"]);
    const page = strictBrowsePage(sp.page);
    // Garbage ?page= and pages past the end are 404s, like the page's own guard.
    if (page === null) return jsonError(404, "not_found", "No such page.", BROWSE_NO_INDEX);
    const filters = readBrowseFiltersForGroups(sp, ["season", "method"], "single");
    const services = await getServices();
    const payload = await services.catalog.browseCrops({ filters, page: pageWindow(page, CROP_BROWSE_LIMIT) });
    if (page > totalPages(payload.total, CROP_BROWSE_LIMIT)) return jsonError(404, "not_found", "No such page.", BROWSE_NO_INDEX);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": CACHE_NO_STORE,
        ...BROWSE_NO_INDEX,
      },
    });
  } catch (err) {
    console.error("browse crops error", err);
    return jsonError(500, "internal", "Internal error", BROWSE_NO_INDEX);
  }
}

const notAllowed = browseMethodNotAllowed;
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE, notAllowed as OPTIONS, notAllowed as HEAD };
