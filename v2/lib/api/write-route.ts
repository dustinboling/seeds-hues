/**
 * Router for the delta's key-gated and write route trees (ingest, admin, reports). Each table
 * entry declares method + path pattern + auth scope + rate-limit bucket; the wrapper handles
 * auth (Bearer, hashed keys), rate limits, JSON bodies, Idempotency-Key replay, revalidation of
 * affected pages, and application/problem+json errors. Every response is `no-store`.
 */
import { z } from "zod";
import { getServices } from "@/lib/services/context";
import type { Services } from "@/lib/services";
import type { ApiKeyPrincipal, ApiScope } from "@/lib/services/auth";
import { ServiceError } from "@/lib/services/ingest";
import { baseHeaders, CACHE_NO_STORE } from "./http";
import { Problem, problemResponse } from "./problem";
import { allowKeyed, clientKey, RETRY_AFTER_SECONDS, type LimitBucket } from "./rate-limit";
import { getRuntimeEnv, type RuntimeEnv } from "./runtime-env";

export const MAX_BODY_BYTES = 2_500_000;

export interface WriteContext {
  req: Request;
  url: URL;
  params: Record<string, string>;
  services: Services;
  env: RuntimeEnv;
  principal: ApiKeyPrincipal | null;
  body: unknown;
}

export interface WriteOk {
  status?: number;
  data: unknown;
  /** Public paths whose cached HTML must be revalidated after this write. */
  revalidate?: string[];
  /** Extra response headers (e.g. Set-Cookie for the account session). */
  headers?: Record<string, string>;
}

export interface RouteSpec {
  method: "GET" | "POST";
  /** e.g. "jobs/:id/complete" relative to the tree root. */
  pattern: string;
  scope: ApiScope | null;
  bucket: LimitBucket | null;
  /** POSTs that honour Idempotency-Key. */
  idempotent?: boolean;
  handler: (ctx: WriteContext) => Promise<WriteOk>;
}

function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const s = path.split("/").filter(Boolean);
  if (p.length !== s.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i]!.startsWith(":")) out[p[i]!.slice(1)] = decodeURIComponent(s[i]!);
    else if (p[i] !== s[i]) return null;
  }
  return out;
}

/** Parse with a Zod schema; failures become 400 validation_error problems. */
export function parseBody<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new Problem(400, "validation_error", r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ").slice(0, 1000));
  }
  return r.data as z.infer<T>;
}

export function intParam(v: string | undefined, name: string): number {
  if (!v || !/^\d{1,12}$/.test(v)) throw new Problem(404, "not_found", `${name} not found`);
  return Number(v);
}

async function revalidateAll(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const { revalidatePath } = await import("next/cache");
    for (const p of new Set(paths)) revalidatePath(p);
  } catch (err) {
    // Outside a Next request (tests/scripts) there is no cache to revalidate.
    console.warn("revalidatePath skipped", err instanceof Error ? err.message : err);
  }
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": CACHE_NO_STORE, ...baseHeaders(), ...extra },
  });
}

type RouteCtx = { params: Promise<Record<string, string | string[] | undefined>> };

/**
 * Build Next route exports for a tree. `prefix` is the path before the catch-all
 * (e.g. "/api/v1/ingest"); `routes` match the remainder.
 */
export function writeRouter(prefix: string, routes: RouteSpec[]) {
  async function run(req: Request, _ctx: RouteCtx | undefined): Promise<Response> {
    const url = new URL(req.url);
    const rest = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname;
    const method = req.method === "HEAD" ? "GET" : req.method;
    let spec: RouteSpec | null = null;
    let params: Record<string, string> = {};
    let pathKnown = false;
    for (const r of routes) {
      const m = match(r.pattern, rest);
      if (!m) continue;
      pathKnown = true;
      if (r.method === method) {
        spec = r;
        params = m;
        break;
      }
    }
    if (!spec) {
      const allow = [...new Set(routes.filter((r) => match(r.pattern, rest)).map((r) => r.method))].join(", ");
      return pathKnown
        ? problemResponse(405, "method_not_allowed", `use ${allow}`, { Allow: allow })
        : problemResponse(404, "not_found", `no endpoint ${url.pathname}`);
    }

    try {
      const env = await getRuntimeEnv();
      const services = await getServices();

      let principal: ApiKeyPrincipal | null = null;
      if (spec.scope) {
        const auth = req.headers.get("authorization") ?? "";
        const token = /^Bearer\s+(\S+)$/i.exec(auth)?.[1] ?? "";
        principal = token ? await services.auth.verify(token) : null;
        if (!principal) throw new Problem(401, "unauthorized", "missing, unknown or revoked API key", { "WWW-Authenticate": 'Bearer realm="seedfinder"' });
        if (!principal.scopes.includes(spec.scope)) throw new Problem(403, "insufficient_scope", `this endpoint needs the "${spec.scope}" scope`);
      }

      if (spec.bucket) {
        const limiter =
          spec.bucket === "ingest"
            ? (env.limiters?.ingest ?? null)
            : spec.bucket === "reports"
              ? (env.limiters?.reports ?? null)
              : spec.bucket === "search"
                ? (env.limiters?.search ?? null)
                : env.rateLimiter;
        const key = spec.bucket === "ingest" && principal ? `key:${principal.id}` : clientKey(req);
        if (!(await allowKeyed(key, limiter, spec.bucket))) {
          throw new Problem(429, "rate_limited", "Too many requests", { "Retry-After": String(RETRY_AFTER_SECONDS) });
        }
      }

      let body: unknown = undefined;
      if (method === "POST") {
        const text = await req.text();
        if (text.length > MAX_BODY_BYTES) throw new Problem(413, "payload_too_large", `body exceeds ${MAX_BODY_BYTES} bytes`);
        if (text.trim().length > 0) {
          try {
            body = JSON.parse(text);
          } catch {
            throw new Problem(400, "invalid_json", "body must be JSON");
          }
        }
      }

      const idemHeader = spec.idempotent ? req.headers.get("idempotency-key")?.trim() : undefined;
      let idemKey: string | null = null;
      if (idemHeader) {
        if (!/^[\w.:-]{1,200}$/.test(idemHeader)) throw new Problem(400, "invalid_idempotency_key", "Idempotency-Key must be 1–200 of [A-Za-z0-9_.:-]");
        idemKey = `${principal?.id ?? "anon"}:${spec.method}:${rest}:${idemHeader}`;
        const prior = await services.idempotency.get(idemKey);
        if (prior) {
          const stored = JSON.parse(prior.response) as { status: number; body: unknown };
          return json(stored.status, stored.body, { "Idempotency-Replayed": "true" });
        }
      }

      const out = await spec.handler({ req, url, params, services, env, principal, body });
      const status = out.status ?? 200;
      const payload = { data: out.data, meta: { generated_at: new Date().toISOString() } };
      if (idemKey) {
        await services.idempotency.put({
          key: idemKey,
          endpoint: `${spec.method} ${prefix}/${spec.pattern}`,
          response: JSON.stringify({ status, body: payload }),
          createdAt: new Date().toISOString(),
        });
      }
      await revalidateAll(out.revalidate ?? []);
      return req.method === "HEAD" ? new Response(null, { status, headers: out.headers }) : json(status, payload, out.headers ?? {});
    } catch (err) {
      if (err instanceof Problem) return problemResponse(err.status, err.code, err.detail, err.headers);
      if (err instanceof ServiceError) return problemResponse(err.status, err.code, err.message);
      console.error("write route error", err);
      return problemResponse(500, "internal", "Internal error");
    }
  }
  return { GET: run, HEAD: run, POST: run, PUT: run, PATCH: run, DELETE: run };
}
