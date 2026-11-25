/**
 * The app server's backend relay: pure helpers plus the two fetch sites.
 * The app Worker serves pages and handlers itself and reverse-proxies
 * the backend-owned paths (the /api/* form/account reads and writes; the
 * backend's /go/[id]) to the API origin. /go answers are rewritten on
 * relay only for the Bea m-3 utm_source rename; statuses pass through
 * (302, unknown/unpublished/removed-listing 404, removed-seller 410 —
 * v2's route, Bea §1.7/§7.1). The production Worker mounts the same
 * helpers at Slice 9 (carry).
 */

/** The backend URL for a backend-owned path: the API origin + path + query. */
export function backendTarget(apiBase: string, path: string, query: string): string {
  return `${new URL(apiBase).origin}${path}${query}`;
}

/**
 * The browser context the backend reads (session cookie, content type,
 * logging context), minus hop-by-hop headers and the browser Origin (a
 * server-to-server relay carries none, so the backend's same-origin
 * check passes it like any direct call).
 */
export function forwardHeaders(headers: Headers): Record<string, string> {
  const allow = new Set([
    "cookie",
    "content-type",
    "accept",
    "accept-language",
    "user-agent",
    "referer",
    "x-client",
    "x-forwarded-for",
    "cf-connecting-ip",
    // Slice 7: the key-authenticated admin API reads its credential here.
    "x-admin-key",
  ]);
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (allow.has(lower)) out[lower] = value;
  });
  return out;
}

/** v2's /go route rule: numeric listing ids only. */
export function isGoId(id: string): boolean {
  return /^\d{1,12}$/.test(id);
}

const RETIRED_UTM_SOURCE = "seedfinder";
const PORT_UTM_SOURCE = "seed-directory";

/**
 * Bea m-3, applied on relay: the backend still composes the retired
 * utm_source (the backend does not change); the port ships the current
 * product name. Only OUR value is renamed — a seller URL that already
 * carries its own utm_source keeps it (v2's withUtm keeps existing).
 */
export function rewriteGoLocation(location: string): string {
  const u = new URL(location);
  if (u.searchParams.get("utm_source") === RETIRED_UTM_SOURCE) u.searchParams.set("utm_source", PORT_UTM_SOURCE);
  return u.toString();
}

/**
 * The /go status mapping on relay: 302 passes through, missing (404) and
 * gone (410) pass through — v2 answers 410 for a removed seller's links
 * (Bea §1.7) and 404 for unknown/unpublished/removed listings (the
 * brief's unknown/removed 404); neither ever redirects. A backend fault
 * is a 502, loudly, not a silent 404.
 */
export function mapGoStatus(status: number): 302 | 404 | 410 | 502 {
  if (status === 302) return 302;
  if (status === 404) return 404;
  if (status === 410) return 410;
  return 502;
}

export interface RelayRequest {
  method: string;
  path: string;
  query: string;
  headers: Headers;
  body: Uint8Array<ArrayBuffer> | null;
  /** The downstream socket IP, appended to X-Forwarded-For (the backend's rate-limit identity). */
  socketIp: string | null;
}

export interface RelayResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: Uint8Array;
}

const PASS_RESPONSE_HEADERS = new Set(["content-type", "location", "cache-control", "retry-after", "x-robots-tag", "referrer-policy", "allow"]);

/** Relay one request to the backend and return its status, headers, and bytes. */
export async function relayHttp(apiBase: string, req: RelayRequest): Promise<RelayResponse> {
  const headers = forwardHeaders(req.headers);
  if (req.socketIp) {
    const prior = headers["x-forwarded-for"];
    headers["x-forwarded-for"] = prior ? `${prior}, ${req.socketIp}` : req.socketIp;
  }
  const res = await fetch(backendTarget(apiBase, req.path, req.query), {
    method: req.method,
    headers,
    body: req.body ?? undefined,
    redirect: "manual",
  });
  const out: Record<string, string | string[]> = {};
  res.headers.forEach((value, key) => {
    if (PASS_RESPONSE_HEADERS.has(key.toLowerCase())) out[key.toLowerCase()] = value;
  });
  const setCookies = res.headers.getSetCookie();
  if (setCookies.length > 0) out["set-cookie"] = setCookies;
  return { status: res.status, headers: out, body: new Uint8Array(await res.arrayBuffer()) };
}

export interface BackendJsonResult {
  status: number;
  json: { data?: unknown; code?: string; detail?: string };
}

/** POST one JSON body to the backend (the floor POST handlers' forward). */
export async function postBackendJson(
  apiBase: string,
  path: string,
  payload: unknown,
  opts: { cookie?: string; forwardedFor?: string } = {},
): Promise<BackendJsonResult> {
  const res = await fetch(backendTarget(apiBase, path, ""), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
      ...(opts.forwardedFor ? { "X-Forwarded-For": opts.forwardedFor } : {}),
    },
    body: JSON.stringify(payload),
    redirect: "manual",
  });
  const json = (await res.json().catch(() => ({}))) as BackendJsonResult["json"];
  return { status: res.status, json };
}
