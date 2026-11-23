/**
 * GET /api/browse/varieties — the /variety in-place payload (Tranche 3.1a): the page of
 * results plus the per-option counts describing them. Same query vocabulary as the page
 * (?season= ?method= ?life_cycle= ?color_family= (comma list) ?small_farm= ?page=) and the
 * same service call the server page renders with, so first paint and every in-place update
 * consume the identical contract. Internal (noindex, no-store); the hydrated layer's fetch
 * failures surface the §2.5.6 path (prior results stand, one error line).
 */
import { getServices } from "@/lib/services/context";
import { getRuntimeEnv } from "@/lib/api/runtime-env";
import { allowRequest, RETRY_AFTER_SECONDS } from "@/lib/api/rate-limit";
import { CACHE_NO_STORE, jsonError } from "@/lib/api/http";
import { pageWindow, totalPages } from "@/lib/paging";
import { readBrowseFilters } from "@/lib/browse";

export const dynamic = "force-dynamic";

const NO_INDEX = { "X-Robots-Tag": "noindex" };

/** The page's query vocabulary as a Next-searchParams-shaped record (repeats stay arrays). */
function searchParamsRecord(url: URL): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const key of ["season", "method", "life_cycle", "color_family", "small_farm", "page"]) {
    const all = url.searchParams.getAll(key);
    if (all.length === 1) out[key] = all[0];
    else if (all.length > 1) out[key] = all;
  }
  return out;
}

/** The same ?page= rule as parsePage (lib/paging): missing → 1; anything else must be a positive int. */
function strictPage(raw: string | string[] | undefined): number | null {
  if (raw === undefined) return 1;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v !== undefined && /^[1-9]\d{0,5}$/.test(v) ? Number(v) : null;
}

export async function GET(req: Request): Promise<Response> {
  let env;
  try {
    env = await getRuntimeEnv();
  } catch {
    return jsonError(500, "internal", "Runtime environment unavailable.", NO_INDEX);
  }
  if (!(await allowRequest(req, env.rateLimiter))) {
    return jsonError(429, "rate_limited", "Too many requests — limit is 120 per minute.", {
      ...NO_INDEX,
      "Retry-After": String(RETRY_AFTER_SECONDS),
    });
  }
  try {
    const sp = searchParamsRecord(new URL(req.url));
    const page = strictPage(sp.page);
    // Garbage ?page= and pages past the end are 404s, like the page's own guard.
    if (page === null) return jsonError(404, "not_found", "No such page.", NO_INDEX);
    const filters = readBrowseFilters(sp, "multi");
    const services = await getServices();
    const payload = await services.catalog.browseVarieties({ filters, page: pageWindow(page) });
    if (page > totalPages(payload.total)) return jsonError(404, "not_found", "No such page.", NO_INDEX);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": CACHE_NO_STORE,
        ...NO_INDEX,
      },
    });
  } catch (err) {
    console.error("browse varieties error", err);
    return jsonError(500, "internal", "Internal error", NO_INDEX);
  }
}

const notAllowed = (_req: Request) =>
  jsonError(405, "method_not_allowed", "The browse payload is GET-only.", { Allow: "GET", ...NO_INDEX });
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE, notAllowed as OPTIONS, notAllowed as HEAD };
