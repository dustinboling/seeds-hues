/**
 * Static redirect map (Bea §8.4): Slice 3 shipped the variety rows
 * (plural legacy paths, legacy ?v= slugs, the internal small-farms path);
 * Slice 4 extends the same module — never a fork — with the seller rows
 * (plural legacy paths, legacy ?s= slugs) and the ?page=1 rule for the two
 * index routes. Pure URL function — no data, so the Vike +onBeforeRoute
 * hook throws these before routing, and the production edge mirrors the
 * same rows. Every permanent redirect this tree ships is 301, one hop
 * (Bea §8.4's recommendation, matching the program spec).
 *
 * Detail-template ?page=1 rows (/seller/[slug], /crop/[slug], /state/[slug])
 * land with Slice 5's routes — this module grows by pathname, one row set
 * per slice.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The catalog slug rule (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), shared by variety/seller pages and redirects. */
export function isSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** v1 query-string slugs (`?v=`) — ported from v2/lib/legacy.ts. */
export function legacySlug(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const slug = value.trim().toLowerCase();
  return SLUG_PATTERN.test(slug) && slug.length <= 160 ? slug : null;
}

/**
 * The static 301 target for a request URL, or null when no static row
 * matches (live routes, garbage params, and malformed slugs fall through
 * to routing: the variety route 404s malformed slugs itself).
 */
export function redirectForUrl(url: string): string | null {
  const parsed = new URL(url, "http://localhost");
  const pathname = parsed.pathname;
  if (pathname === "/varieties") return "/variety";
  const plural = /^\/varieties\/([^/]+)$/.exec(pathname);
  if (plural && isSlug(plural[1]!)) return `/variety/${plural[1]}`;
  if (pathname === "/sellers") return "/seller";
  const sellerPlural = /^\/sellers\/([^/]+)$/.exec(pathname);
  if (sellerPlural && isSlug(sellerPlural[1]!)) return `/seller/${sellerPlural[1]}`;
  if (pathname === "/variety") {
    const legacy = legacySlug(parsed.searchParams.get("v") ?? undefined);
    if (legacy) return `/variety/${legacy}`;
    return pageOneRedirect(parsed);
  }
  if (pathname === "/seller") {
    const legacy = legacySlug(parsed.searchParams.get("s") ?? undefined);
    if (legacy) return `/seller/${legacy}`;
    return pageOneRedirect(parsed);
  }
  const internal = /^\/variety\/([^/]+)\/small-farms$/.exec(pathname);
  if (internal && isSlug(internal[1]!)) {
    // v2's middleware semantics: the public URL keeps its other params and
    // gains small_farm=true — the internal path is never a second address.
    const params = new URLSearchParams(parsed.search);
    params.set("small_farm", "true");
    return `/variety/${internal[1]}?${params.toString()}`;
  }
  return null;
}

/**
 * Bea §4.1's port requirement (new behavior — the live build renders
 * ?page=1 with a clean canonical instead): page 1 lives at the bare path,
 * so ?page=1 301s to the same URL minus the page param. Other params are
 * kept (a filtered page 1 redirects to the filtered clean URL); the result
 * carries no page param, so the rule can never refire (one hop by
 * construction). Only the FIRST page value is read (v2's parsePage rule);
 * anything else falls through to routing (+data 404s malformed pages).
 */
function pageOneRedirect(parsed: URL): string | null {
  const first = parsed.searchParams.get("page");
  if (first !== "1") return null;
  const params = new URLSearchParams(parsed.search);
  params.delete("page");
  const qs = params.toString();
  return qs ? `${parsed.pathname}?${qs}` : parsed.pathname;
}
