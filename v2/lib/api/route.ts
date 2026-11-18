/**
 * apiRoute() — wraps every /api/v1 handler: rate limit → method gate (405) → handler →
 * envelope → ETag/304 → Cache-Control, X-API-Version, X-Robots-Tag, CORS allowlist.
 * Route files stay thin: `export const { GET, HEAD, OPTIONS, POST, PUT, PATCH, DELETE } = apiRoute(...)`.
 */
import { getServices } from "@/lib/services/context";
import type { Services } from "@/lib/services";
import { ApiError } from "./errors";
import { Problem, problemResponse } from "./problem";
import {
  ALLOWED_METHODS,
  CACHE_DEFAULT,
  corsHeaders,
  jsonError,
  jsonWithEtag,
} from "./http";
import { allowKeyed, allowRequest, clientKey, RETRY_AFTER_SECONDS } from "./rate-limit";
import { getRuntimeEnv, type RuntimeEnv } from "./runtime-env";

export interface ApiContext {
  req: Request;
  url: URL;
  params: Record<string, string>;
  services: Services;
  env: RuntimeEnv;
}

export interface ApiOk {
  data: unknown;
  meta?: Record<string, unknown> | null;
  /** Canonical §3 envelope `page` (list endpoints); defaults to a single, final page. */
  page?: { next_cursor: string | null; has_more: boolean };
  cacheControl?: string;
}

export interface ApiRouteOptions {
  /** Extra rate-limit bucket on top of the 120/min public limit (search: 60/min). */
  bucket?: "search";
  /** Errors as application/problem+json (new route trees, e.g. /sync). */
  problemErrors?: boolean;
}

export type ApiHandler = (ctx: ApiContext) => Promise<ApiOk | Response>;

type RouteCtx = { params: Promise<Record<string, string | string[] | undefined>> };

function flatParams(p: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) if (v !== undefined) out[k] = Array.isArray(v) ? v.join("/") : v;
  return out;
}

export function apiRoute(handler: ApiHandler, opts: ApiRouteOptions = {}) {
  const fail = (status: number, code: Parameters<typeof jsonError>[1] | string, message: string, headers: Record<string, string>) =>
    opts.problemErrors ? problemResponse(status, code, message, headers) : jsonError(status, code as Parameters<typeof jsonError>[1], message, headers);

  async function run(req: Request, ctx: RouteCtx): Promise<Response> {
    let env: RuntimeEnv;
    try {
      env = await getRuntimeEnv();
    } catch {
      return fail(500, "internal", "runtime environment unavailable", {});
    }
    const cors = corsHeaders(req, env.corsOrigins);
    if (!(await allowRequest(req, env.rateLimiter))) {
      return fail(429, "rate_limited", "Too many requests — limit is 120 per minute.", {
        ...cors,
        "Retry-After": String(RETRY_AFTER_SECONDS),
      });
    }
    if (opts.bucket === "search" && !(await allowKeyed(clientKey(req), env.limiters?.search ?? null, "search"))) {
      return fail(429, "rate_limited", "Too many requests — search is limited to 60 per minute.", {
        ...cors,
        "Retry-After": String(RETRY_AFTER_SECONDS),
      });
    }
    try {
      const url = new URL(req.url);
      const params = flatParams((await ctx.params) ?? {});
      const services = await getServices();
      const result = await handler({ req, url, params, services, env });
      if (result instanceof Response) {
        for (const [k, v] of Object.entries(cors)) result.headers.set(k, v);
        return result;
      }
      const catalogSeq = await services.catalog.catalogSeq();
      const generatedAt = new Date().toISOString();
      const page = result.page ?? { next_cursor: null, has_more: false };
      const meta = { ...(result.meta ?? {}), catalog_seq: catalogSeq };
      const body = { data: result.data, page, meta: { ...meta, generated_at: generatedAt }, error: null };
      // ETag over everything except the volatile generated_at.
      return jsonWithEtag(req, body, result.cacheControl ?? CACHE_DEFAULT, cors, { data: result.data, page, meta });
    } catch (err) {
      if (err instanceof Problem) return problemResponse(err.status, err.code, err.detail, { ...cors, ...err.headers });
      if (err instanceof ApiError) return fail(err.status, err.code, err.message, { ...cors, ...err.headers });
      console.error("api error", err);
      return fail(500, "internal", "Internal error", cors);
    }
  }

  const methodNotAllowed = async (req: Request) => {
    let origins: string[] = [];
    try {
      origins = (await getRuntimeEnv()).corsOrigins;
    } catch {
      /* no env: no CORS header */
    }
    return fail(405, "method_not_allowed", "The public API is read-only (GET, HEAD, OPTIONS).", {
      Allow: ALLOWED_METHODS,
      ...corsHeaders(req, origins),
    });
  };

  const options = async (req: Request) => {
    let origins: string[] = [];
    try {
      origins = (await getRuntimeEnv()).corsOrigins;
    } catch {
      /* ignore */
    }
    const cors = corsHeaders(req, origins);
    const headers: Record<string, string> = {
      Allow: ALLOWED_METHODS,
      "X-Robots-Tag": "noindex",
      "X-API-Version": "1",
      ...cors,
    };
    if (cors["Access-Control-Allow-Origin"]) {
      headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS;
      headers["Access-Control-Allow-Headers"] = "If-None-Match, Content-Type";
      headers["Access-Control-Max-Age"] = "86400";
    }
    return new Response(null, { status: 204, headers });
  };

  return {
    GET: run,
    HEAD: run,
    OPTIONS: options,
    POST: methodNotAllowed,
    PUT: methodNotAllowed,
    PATCH: methodNotAllowed,
    DELETE: methodNotAllowed,
  };
}
