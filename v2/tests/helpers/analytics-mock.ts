/**
 * Mock Cloudflare GraphQL Analytics endpoint for the Visitors read path tests. Holds
 * RUM-style fixture rows (any hosts under the zone's site tag) and answers each request
 * the way the real API would: it honors the filters the request payload actually
 * carries — a request that dropped `requestHost` gets the blended zone-wide rows, a
 * wrong account tag gets no accounts — so totals that ignore the filters fail loudly.
 * Every request is captured for direct payload assertions (both filters, the window).
 */
import {
  CF_ANALYTICS_ACCOUNT_TAG,
  CF_ANALYTICS_SITE_TAG,
  VISITORS_GRAPHQL_URL,
} from "@/lib/admin/visitors";

export interface AnalyticsFixtureRow {
  date: string;
  host: string;
  count: number;
}

export interface AnalyticsSeenRequest {
  url: string;
  method: string;
  authorization: string | null;
  query: string;
  variables: Record<string, unknown>;
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

export function mockAnalyticsServer(rows: AnalyticsFixtureRow[]): { fetchFn: typeof fetch; seen: AnalyticsSeenRequest[] } {
  const seen: AnalyticsSeenRequest[] = [];
  const fetchFn: typeof fetch = async (...args: Parameters<typeof fetch>) => {
    const [url, init] = args;
    const body = asRecord(typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null);
    const variables = asRecord(body.variables);
    const headers = init?.headers as Record<string, string> | undefined;
    const authorization = typeof headers?.authorization === "string" ? headers.authorization : null;
    seen.push({ url: String(url), method: init?.method ?? "GET", authorization, query: typeof body.query === "string" ? body.query : "", variables });
    if (String(url) !== VISITORS_GRAPHQL_URL) return new Response("not found", { status: 404 });
    if (variables.accountTag !== CF_ANALYTICS_ACCOUNT_TAG) {
      return Response.json({ data: { viewer: { accounts: [] } } });
    }
    let filtered = rows;
    if (typeof variables.siteTag === "string") {
      if (variables.siteTag !== CF_ANALYTICS_SITE_TAG) filtered = [];
    }
    if (typeof variables.requestHost === "string") filtered = filtered.filter((r) => r.host === variables.requestHost);
    if (typeof variables.from === "string" && typeof variables.to === "string") {
      filtered = filtered.filter((r) => r.date >= (variables.from as string) && r.date <= (variables.to as string));
    }
    const byDay = new Map<string, number>();
    for (const r of filtered) byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.count);
    const groups = [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, count]) => ({ dimensions: { date }, count }));
    return Response.json({ data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: groups }] } } });
  };
  return { fetchFn, seen };
}
