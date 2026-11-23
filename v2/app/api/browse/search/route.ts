/**
 * GET /api/browse/search — the /search in-place payload (Tranche 3.1b): the grouped results
 * for the query under the active filters, the grouped total, and the per-option counts
 * describing it. Same query vocabulary as the /search page (?q= ?season= ?method=
 * ?life_cycle= ?color_family=) and the same service call the page renders with, so first
 * paint and every in-place update consume the identical contract. Internal (noindex,
 * no-store); the hydrated layer's fetch failures surface the §2.5.6 path (prior results
 * stand, one error line). Never logs: refinements are silent, like every in-place change.
 * An empty query answers the empty payload (total 0) — the client never changes q in place
 * (a new query is a navigation), and ?page= is meaningless here (no pagination).
 */
import { getServices } from "@/lib/services/context";
import { getRuntimeEnv } from "@/lib/api/runtime-env";
import { allowRequest, RETRY_AFTER_SECONDS } from "@/lib/api/rate-limit";
import { CACHE_NO_STORE, jsonError } from "@/lib/api/http";
import { parseSearchQueryParam, readBrowseFiltersForGroups } from "@/lib/browse";
import { BROWSE_NO_INDEX, browseMethodNotAllowed, browseSearchParamsRecord } from "@/lib/api/browse-route";

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
    const sp = browseSearchParamsRecord(new URL(req.url), ["q", "season", "method", "life_cycle", "color_family"]);
    const q = parseSearchQueryParam(sp.q);
    // /search stays single-select hue (Item 3.1b spreads the core): the page's parse rule.
    const filters = readBrowseFiltersForGroups(sp, ["season", "method", "lifeCycle", "hue"], "single");
    const services = await getServices();
    const payload = await services.catalog.browseSearch(q, { filters });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": CACHE_NO_STORE,
        ...BROWSE_NO_INDEX,
      },
    });
  } catch (err) {
    console.error("browse search error", err);
    return jsonError(500, "internal", "Internal error", BROWSE_NO_INDEX);
  }
}

const notAllowed = browseMethodNotAllowed;
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE, notAllowed as OPTIONS, notAllowed as HEAD };
