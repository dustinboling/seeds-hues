/**
 * Visitors read path (Statistics Visitors card follow-up; admin spec §7 + §15 item 5):
 * daily pageload counts from Cloudflare Web Analytics for seeds.hues.flowers ONLY, over
 * the RUM GraphQL dataset. Web Analytics is already enabled on the hues.flowers zone
 * (auto-installed beacon) — this module only READS; it never adds a beacon anywhere.
 *
 * Both filters are mandatory on every request: the site tag is zone-wide (all of
 * hues.flowers), so `siteTag` alone would blend other hosts' traffic into the
 * directory's number. `requestHost: "seeds.hues.flowers"` keeps the count honest.
 *
 * Fail-closed throughout: any transport error, timeout, non-200 status, GraphQL
 * `errors` entry, or unexpected shape resolves to null, and the card keeps its
 * designed no-data state. A partial multi-chunk result is never returned — a total
 * the caller knows is incomplete must not present as the period's number.
 */
const DAY_MS = 86_400_000;

/** The Analytics GraphQL endpoint (POST, Bearer token). */
export const VISITORS_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
/** The Cloudflare account node the RUM dataset lives under. */
export const CF_ANALYTICS_ACCOUNT_TAG = "51080ac04974bef5a30d7ceb5b79e9e2";
/** The hues.flowers zone's Web Analytics site tag (zone-wide — never a lone filter). */
export const CF_ANALYTICS_SITE_TAG = "ae44dc0d0d524ddaa5a485bc5e62e7ff";
/** The only host whose pageloads count toward the directory's Visitors card. */
export const VISITORS_REQUEST_HOST = "seeds.hues.flowers";
/** Per-request bound: one slow GraphQL call must not stall the admin page. */
export const VISITORS_FETCH_TIMEOUT_MS = 5_000;
/**
 * Long RUM ranges are refused, so the window goes out as contiguous chunks of at most
 * this many days (fired in parallel, merged by day). 28 days is the largest range
 * observed to succeed against rumPageloadEventsAdaptiveGroups.
 */
export const VISITORS_MAX_RANGE_DAYS = 28;

function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

/**
 * Contiguous [from, to] UTC-day chunks of at most `VISITORS_MAX_RANGE_DAYS` days each
 * (single chunk for the 7-day window; the 12-week window fans out to six requests).
 */
export function splitVisitorsRange(from: string, to: string): { from: string; to: string }[] {
  const chunks: { from: string; to: string }[] = [];
  let start = from;
  while (start <= to) {
    let end = start;
    for (let i = 1; i < VISITORS_MAX_RANGE_DAYS && end < to; i++) end = nextDay(end);
    chunks.push({ from: start, to: end });
    if (end >= to) break;
    end = nextDay(end);
    start = end;
  }
  return chunks;
}

/**
 * One chunk's query: per-day pageload counts for the host. Date bounds ride as `Date`
 * scalars (`date_geq`/`date_leq`, inclusive both ends) — the dataset's documented
 * day-granularity filter pair.
 */
export const VISITORS_QUERY = `query VisitorsDaily($accountTag: string!, $siteTag: string!, $requestHost: string!, $from: Date!, $to: Date!) {
  viewer {
    accounts(filter: {accountTag: $accountTag}) {
      rumPageloadEventsAdaptiveGroups(
        limit: 1000
        filter: {siteTag: $siteTag, requestHost: $requestHost, date_geq: $from, date_leq: $to}
        orderBy: [date_ASC]
      ) {
        dimensions {
          date
        }
        count
      }
    }
  }
}`;

export interface VisitorsQueryVariables {
  accountTag: string;
  siteTag: string;
  requestHost: string;
  from: string;
  to: string;
}

export function visitorsVariables(from: string, to: string): VisitorsQueryVariables {
  return { accountTag: CF_ANALYTICS_ACCOUNT_TAG, siteTag: CF_ANALYTICS_SITE_TAG, requestHost: VISITORS_REQUEST_HOST, from, to };
}

export interface VisitorsDailyResult {
  /**
   * The earliest UTC day with a recorded pageload (the thin-data rule's `dataSince`),
   * or null when the window holds no pageloads at all — no evidence of collection.
   */
  since: string | null;
  /** UTC day → pageloads. Only days with a positive count appear (trends zero-fill). */
  byDay: Map<string, number>;
}

interface VisitorsGroupRow {
  date: string;
  count: number;
}

const DAY_PREFIX = /^(\d{4}-\d{2}-\d{2})/;

/** The `rumPageloadEventsAdaptiveGroups` rows, or null when the payload is not one. */
function groupsFromPayload(json: unknown): VisitorsGroupRow[] | null {
  if (typeof json !== "object" || json === null) return null;
  const root = json as { data?: unknown; errors?: unknown };
  if (Array.isArray(root.errors) && root.errors.length > 0) return null;
  if (typeof root.data !== "object" || root.data === null) return null;
  const viewer = (root.data as { viewer?: unknown }).viewer;
  if (typeof viewer !== "object" || viewer === null) return null;
  const accounts = (viewer as { accounts?: unknown }).accounts;
  if (!Array.isArray(accounts) || accounts.length === 0) return null;
  const groups = (accounts[0] as { rumPageloadEventsAdaptiveGroups?: unknown })?.rumPageloadEventsAdaptiveGroups;
  if (!Array.isArray(groups)) return null;
  const rows: VisitorsGroupRow[] = [];
  for (const g of groups) {
    if (typeof g !== "object" || g === null) continue;
    const row = g as { dimensions?: unknown; count?: unknown };
    const date = typeof row.dimensions === "object" && row.dimensions !== null ? (row.dimensions as { date?: unknown }).date : undefined;
    if (typeof date !== "string" || typeof row.count !== "number" || !Number.isFinite(row.count) || row.count <= 0) continue;
    const day = DAY_PREFIX.exec(date)?.[1];
    if (!day) continue;
    rows.push({ date: day, count: Math.floor(row.count) });
  }
  return rows;
}

/**
 * POST one chunk with a hard timeout. The race (not just the abort signal) enforces
 * the bound, so a fetch that ignores its signal still cannot stall the caller.
 */
async function postChunk(
  token: string,
  from: string,
  to: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<VisitorsGroupRow[] | null> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const res = await Promise.race([
      fetchFn(VISITORS_GRAPHQL_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: VISITORS_QUERY, variables: visitorsVariables(from, to) }),
        signal: ctrl.signal,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          ctrl.abort();
          reject(new Error("visitors analytics timeout"));
        }, timeoutMs);
      }),
    ]);
    if (!res.ok) return null;
    return groupsFromPayload(await res.json().catch(() => null));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Daily pageload counts for seeds.hues.flowers over [from, to] (UTC days, inclusive).
 * Null when the token is blank or any chunk fails — the caller keeps the card dark.
 * The token travels only in the Authorization header, never in logs or errors.
 */
export async function fetchVisitorsDaily(
  token: string,
  from: string,
  to: string,
  opts: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<VisitorsDailyResult | null> {
  if (!token || from > to) return null;
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? VISITORS_FETCH_TIMEOUT_MS;
  const chunks = splitVisitorsRange(from, to);
  const settled = await Promise.all(chunks.map((c) => postChunk(token, c.from, c.to, fetchFn, timeoutMs)));
  const byDay = new Map<string, number>();
  for (let i = 0; i < settled.length; i++) {
    const rows = settled[i]!;
    if (rows === null) return null; // fail closed: never a partial total
    const { from: cFrom, to: cTo } = chunks[i]!;
    for (const r of rows) {
      if (r.date < cFrom || r.date > cTo) continue;
      byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.count);
    }
  }
  let since: string | null = null;
  for (const day of byDay.keys()) {
    if (since === null || day < since) since = day;
  }
  return { since, byDay };
}
