/**
 * application/problem+json (RFC 9457) for the route trees added by the delta (design D5):
 * /api/v1/ingest/*, /api/v1/admin/*, /api/v1/reports and /api/v1/sync/* errors.
 * Every problem carries a stable `code`.
 */
import { baseHeaders, CACHE_NO_STORE } from "./http";

const TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  410: "Gone",
  413: "Payload Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

export class Problem extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly detail: string,
    public readonly headers: Record<string, string> = {},
  ) {
    super(detail);
    this.name = "Problem";
  }
}

export function problemBody(status: number, code: string, detail: string) {
  return {
    type: `https://seeds.hues.flowers/api-docs#error-${code}`,
    title: TITLES[status] ?? "Error",
    status,
    detail,
    code,
  };
}

export function problemResponse(status: number, code: string, detail: string, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(problemBody(status, code, detail)), {
    status,
    headers: { "Content-Type": "application/problem+json", "Cache-Control": CACHE_NO_STORE, ...baseHeaders(), ...extra },
  });
}
