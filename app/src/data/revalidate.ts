/**
 * Edge-cache invalidation hook — ported from v2/lib/api/revalidate.ts and
 * extended for the new app (segmented sitemap files, the prerendered
 * data-carrying pages, the Vike small-farms variant form).
 *
 * Contract (Bea §9): every write path — ingest API, admin edits, scout
 * publishes, dedupe merges, seller removals, stock updates — POSTs the
 * affected tags here (Bearer token, same convention as v2's /api/revalidate);
 * the hook expands tags to paths, purges the data cache, and returns the
 * paths for the edge-cache purge. The tag taxonomy is unchanged so the
 * existing v2 write paths keep working unmodified until cutover.
 */

const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";
export const TAG_PATTERN = new RegExp(`^(?:(?:variety|seller|crop|series):${SLUG}|list:(?:home|variety|seller|crop))$`);

const PATH_PATTERN = /^\/(?:[a-z0-9._~-]+(?:\/[a-z0-9._~-]+)*)?$/i;

export interface RevalidateBody {
  tags?: string[];
  paths?: string[];
}

export class RevalidateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RevalidateValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The v2 RevalidateBodySchema rules, hand-rolled (no zod in this tree):
 * optional tags[]/paths[] (≤200 each), tags matching TAG_PATTERN, paths
 * absolute site paths ≤300 chars, at least one tag or path present.
 */
export function parseRevalidateBody(body: unknown): Required<RevalidateBody> {
  if (!isRecord(body)) throw new RevalidateValidationError("body: must be an object");
  const problems: string[] = [];
  const readList = (key: "tags" | "paths"): string[] => {
    const value = body[key];
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
      problems.push(`${key}: must be an array of strings`);
      return [];
    }
    if (value.length > 200) problems.push(`${key}: at most 200 entries`);
    return value;
  };
  const tags = readList("tags");
  const paths = readList("paths");
  for (const tag of tags) {
    if (!TAG_PATTERN.test(tag)) problems.push(`tags: unknown tag ${JSON.stringify(tag)}`);
  }
  for (const path of paths) {
    if (path.length > 300 || !PATH_PATTERN.test(path)) problems.push(`paths: not an absolute site path ${JSON.stringify(path)}`);
  }
  if (tags.length + paths.length === 0) problems.push("body: provide tags and/or paths");
  if (problems.length > 0) throw new RevalidateValidationError(problems.join("; "));
  return { tags, paths };
}

/** Segmented sitemap files (Bea §8.2) — every tag fans out to its own file. */
export const SITEMAP_INDEX = "/sitemap.xml";
export const SITEMAP_SEGMENTS = {
  varietiesListed: "/sitemap-varieties-listed.xml",
  varietiesZeroSeller: "/sitemap-varieties-zero-seller.xml",
  sellers: "/sitemap-sellers.xml",
  crops: "/sitemap-crops.xml",
  series: "/sitemap-series.xml",
  states: "/sitemap-states.xml",
  hubs: "/sitemap-hubs.xml",
} as const;

/**
 * Paths whose rendered output depends on the given tag. v2's map, extended:
 * - a variety/seller change moves crop counts and the home coverage line, so
 *   /crop and / are in the fan-out (v2's /crop and / were force-dynamic and
 *   needed no entry; here they are prerendered + cached);
 * - the small-farms variant rides in the variety entry directly (Vike serves
 *   it as a query on the variety URL — no internal path exists to map);
 * - /sitemap.xml fans out to the index plus the tag's segment file(s).
 */
export function pathsForTag(tag: string): string[] {
  const [kind, value] = tag.split(":", 2) as [string, string];
  switch (kind) {
    case "variety":
      return [
        `/variety/${value}`,
        `/variety/${value}?small_farm=true`,
        "/variety",
        "/crop",
        "/",
        SITEMAP_INDEX,
        SITEMAP_SEGMENTS.varietiesListed,
        SITEMAP_SEGMENTS.varietiesZeroSeller,
      ];
    case "seller":
      return [
        `/seller/${value}`,
        "/seller",
        "/crop",
        "/",
        SITEMAP_INDEX,
        SITEMAP_SEGMENTS.sellers,
        SITEMAP_SEGMENTS.states,
      ];
    case "crop":
      return [`/crop/${value}`, "/crop", "/", SITEMAP_INDEX, SITEMAP_SEGMENTS.crops, SITEMAP_SEGMENTS.hubs];
    case "series":
      return [`/series/${value}`, "/", SITEMAP_INDEX, SITEMAP_SEGMENTS.series];
    case "list":
      if (value === "home") return ["/", SITEMAP_INDEX, SITEMAP_SEGMENTS.hubs];
      return [`/${value}`, "/", SITEMAP_INDEX, SITEMAP_SEGMENTS.hubs];
    default:
      return [];
  }
}

const VARIETY_PAGE = new RegExp(`^/variety/(${SLUG})$`);

/**
 * A variety page's "Small farms only" view (?small_farm=true) is its own
 * cache entry: whatever invalidates /variety/{slug} must invalidate that
 * view too. (v2 mapped to its internal small-farms path; the public URL form
 * is this app's entry key.)
 */
export function withVariantPaths(paths: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const p of paths) {
    out.add(p);
    const m = VARIETY_PAGE.exec(p);
    if (m) out.add(`/variety/${m[1]}?small_farm=true`);
  }
  return [...out];
}

/** Constant-time string comparison (bearer token check) — v2's, verbatim. */
export function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export interface RevalidateRequest {
  /** Raw Authorization header value. */
  authorization: string | null;
  /** Parsed JSON body. */
  body: unknown;
}

export interface RevalidateResult {
  revalidated: boolean;
  tags: string[];
  paths: string[];
  /** Data-cache keys purged (empty when no cache was wired). */
  purged: string[];
}

export class RevalidateAuthError extends Error {
  constructor() {
    super("Missing or invalid Bearer [REDACTED]");
    this.name = "RevalidateAuthError";
  }
}

/**
 * The hook itself, server-agnostic: the production Worker calls this from
 * POST /internal/revalidate (shared secret), then purges the edge cache for
 * `paths`. Wiring the data cache purges it inline and reports the keys.
 */
export function handleRevalidateRequest(
  request: RevalidateRequest,
  options: { expectedSecret: string; invalidatePaths?: (paths: string[]) => string[] },
): RevalidateResult {
  const auth = request.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!options.expectedSecret || !token || !timingSafeEqual(token, options.expectedSecret)) {
    throw new RevalidateAuthError();
  }
  const { tags, paths } = parseRevalidateBody(request.body);
  const expanded = new Set(paths);
  for (const tag of tags) for (const p of pathsForTag(tag)) expanded.add(p);
  const all = withVariantPaths(expanded).sort();
  const purged = options.invalidatePaths ? options.invalidatePaths(all) : [];
  return { revalidated: true, tags: [...tags].sort(), paths: all, purged };
}
