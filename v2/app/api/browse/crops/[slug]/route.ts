/**
 * GET /api/browse/crops/[slug] — the crop-detail in-place payload (Tranche 3.1b-2): the
 * varieties window plus the per-option counts describing it. Same query vocabulary as the
 * crop page (?color_family= ?series= ?has_sellers= ?sort= ?page=) and the same service call
 * that page renders with, so first paint and every in-place update consume the identical
 * contract (?sort= included — the sort commits in place like a filter). Internal
 * (noindex, no-store); the hydrated layer's fetch failures surface the §2.5.6 path (prior
 * results stand, one error line).
 */
import { getServices } from "@/lib/services/context";
import { getRuntimeEnv } from "@/lib/api/runtime-env";
import { allowRequest, RETRY_AFTER_SECONDS } from "@/lib/api/rate-limit";
import { CACHE_NO_STORE, jsonError } from "@/lib/api/http";
import { pageWindow, totalPages } from "@/lib/paging";
import { readCropDetailFilters } from "@/lib/crop-detail";
import { BrowseCropPayloadSchema } from "@/lib/validators";
import { BROWSE_NO_INDEX, browseMethodNotAllowed, browseSearchParamsRecord, strictBrowsePage } from "@/lib/api/browse-route";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
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
    const { slug } = await ctx.params;
    const sp = browseSearchParamsRecord(new URL(req.url), ["color_family", "series", "has_sellers", "sort", "page"]);
    const page = strictBrowsePage(sp.page);
    // Garbage ?page=, pages past the end and unknown slugs are 404s, like the page's own guard.
    // Filter values stay forgiving (unknowns ignored, never a 404) — the page's parse rule.
    if (page === null) return jsonError(404, "not_found", "No such page.", BROWSE_NO_INDEX);
    const state = readCropDetailFilters(sp);
    const services = await getServices();
    const result = await services.catalog.browseCrop(slug, { state, page: pageWindow(page) });
    if (!result) return jsonError(404, "not_found", "No such crop.", BROWSE_NO_INDEX);
    if (page > totalPages(result.total)) return jsonError(404, "not_found", "No such page.", BROWSE_NO_INDEX);
    const parsed = BrowseCropPayloadSchema.safeParse({
      items: result.crop.varieties,
      total: result.total,
      page: result.page,
      pages: result.pages,
      counts: result.counts,
    });
    if (!parsed.success) {
      console.error("browse crop payload failed its shape check", parsed.error);
      return jsonError(500, "internal", "Internal error", BROWSE_NO_INDEX);
    }
    return new Response(JSON.stringify(parsed.data), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": CACHE_NO_STORE,
        ...BROWSE_NO_INDEX,
      },
    });
  } catch (err) {
    console.error("browse crop error", err);
    return jsonError(500, "internal", "Internal error", BROWSE_NO_INDEX);
  }
}

const notAllowed = browseMethodNotAllowed;
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE, notAllowed as OPTIONS, notAllowed as HEAD };
