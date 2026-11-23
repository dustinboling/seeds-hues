/**
 * Shared plumbing for the GET /api/browse/* in-place payload endpoints (Tranche 3.1b):
 * query-vocabulary harvesting, the strict ?page= rule, the internal headers and the
 * GET-only refusal. Every browse endpoint answers the same shapes, so the hydrated layer
 * treats them identically and the three can never disagree on the guard rules.
 */
import { jsonError } from "@/lib/api/http";

export const BROWSE_NO_INDEX = { "X-Robots-Tag": "noindex" };

/** The endpoint's query vocabulary as a Next-searchParams-shaped record (repeats stay arrays). */
export function browseSearchParamsRecord(url: URL, keys: string[]): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const key of keys) {
    const all = url.searchParams.getAll(key);
    if (all.length === 1) out[key] = all[0];
    else if (all.length > 1) out[key] = all;
  }
  return out;
}

/** The same ?page= rule as parsePage (lib/paging): missing → 1; anything else must be a positive int. */
export function strictBrowsePage(raw: string | string[] | undefined): number | null {
  if (raw === undefined) return 1;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v !== undefined && /^[1-9]\d{0,5}$/.test(v) ? Number(v) : null;
}

/** The browse payload is GET-only: every other method answers 405. */
export function browseMethodNotAllowed(_req: Request): Response {
  return jsonError(405, "method_not_allowed", "The browse payload is GET-only.", { Allow: "GET", ...BROWSE_NO_INDEX });
}
