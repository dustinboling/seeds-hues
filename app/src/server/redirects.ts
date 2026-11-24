/**
 * Slice 3 static redirect map (Bea §8.4's variety rows): plural legacy
 * paths, legacy ?v= slugs, and the internal small-farms path. Pure URL
 * function — no data, so the Vike +onBeforeRoute hook throws these before
 * routing, and the production edge mirrors the same rows. Every permanent
 * redirect this slice ships is 301, one hop (Bea §8.4's recommendation,
 * matching the program spec).
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The loader's slug rule, shared by pages and redirects. */
export function isVarietySlug(slug: string): boolean {
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
  if (plural && isVarietySlug(plural[1]!)) return `/variety/${plural[1]}`;
  if (pathname === "/variety") {
    const legacy = legacySlug(parsed.searchParams.get("v") ?? undefined);
    if (legacy) return `/variety/${legacy}`;
    return null;
  }
  const internal = /^\/variety\/([^/]+)\/small-farms$/.exec(pathname);
  if (internal && isVarietySlug(internal[1]!)) {
    // v2's middleware semantics: the public URL keeps its other params and
    // gains small_farm=true — the internal path is never a second address.
    const params = new URLSearchParams(parsed.search);
    params.set("small_farm", "true");
    return `/variety/${internal[1]}?${params.toString()}`;
  }
  return null;
}
