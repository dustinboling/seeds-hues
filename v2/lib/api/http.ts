/** Response helpers: envelope, ETag/304, cache headers, CORS allowlist, API headers. */
import { errorBody } from "./errors";
import type { ErrorCode } from "@/lib/validators";

export const API_VERSION = "1";

export const CACHE_DEFAULT = "public, max-age=300, stale-while-revalidate=86400";
export const CACHE_LONG = "public, max-age=3600, stale-while-revalidate=86400";
export const CACHE_NO_STORE = "no-store";

export const ALLOWED_METHODS = "GET, HEAD, OPTIONS";

export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === "*") return true;
  const bare = etag.replace(/^W\//, "");
  return ifNoneMatch.split(",").some((t) => t.trim().replace(/^W\//, "") === bare);
}

export function corsHeaders(req: Request, allowlist: string[]): Record<string, string> {
  const origin = req.headers.get("origin");
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin && allowlist.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Expose-Headers"] = "ETag, X-API-Version, Retry-After";
  }
  return h;
}

export function baseHeaders(): Record<string, string> {
  return {
    "X-API-Version": API_VERSION,
    "X-Robots-Tag": "noindex",
    "X-Content-Type-Options": "nosniff",
  };
}

export function jsonError(
  status: number,
  code: ErrorCode,
  message: string,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(errorBody(code, message)), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": CACHE_NO_STORE,
      ...baseHeaders(),
      ...extra,
    },
  });
}

/**
 * 200 JSON with a strong ETag; 304 when If-None-Match matches. The ETag hashes `etagInput`
 * (default: the body) — callers pass the body minus volatile fields such as meta.generated_at,
 * so the tag changes exactly when the content or catalog_seq does.
 */
export async function jsonWithEtag(
  req: Request,
  body: unknown,
  cacheControl: string,
  extra: Record<string, string> = {},
  etagInput?: unknown,
): Promise<Response> {
  const text = JSON.stringify(body);
  const etag = `"${(await sha256Hex(etagInput === undefined ? text : JSON.stringify(etagInput))).slice(0, 32)}"`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheControl,
    ETag: etag,
    ...baseHeaders(),
    ...extra,
  };
  if (etagMatches(req.headers.get("if-none-match"), etag)) {
    const { "Content-Type": _ct, ...rest } = headers;
    void _ct;
    return new Response(null, { status: 304, headers: rest });
  }
  return new Response(req.method === "HEAD" ? null : text, { status: 200, headers });
}
