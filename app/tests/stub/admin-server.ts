/**
 * Slice 7 stub: the admin data layer behind the app's internal admin
 * endpoints. The stub plays the UNCHANGED backend here exactly as it does
 * for the catalog and account surfaces: sessions (absolute 7-day expiry,
 * NO idle timeout — deliberately), role enforcement on every call (403
 * pre-effect, never UI-only), review/seller/variety/listing/account
 * effects mirroring v2's admin services, statistics over the fixture
 * signals, and the key-API refusal that keeps duplicate holds decidable
 * ONLY through the UI's decideDuplicate path.
 *
 * Every action payload is recorded verbatim in state.admin.received BEFORE
 * its mode applies, so a rejection drive still proves the payload arrived
 * intact. Modes (state.admin.modes) flip an endpoint group to reject with
 * a field-naming 422.
 *
 * Success shapes are v2's ({data, meta}); errors are problem+json
 * ({type, title, status, detail, code}).
 */
import type { IncomingMessage } from "node:http";
import type { FakeCatalogState } from "../unit/fake-catalog";
import {
  queueForType,
  type AdminAccountFixture,
  type AdminEndpointKey,
  type ReviewItemFixture,
} from "../unit/admin-fixtures";
import type { ApiPublicListing } from "../../src/data/types";

const GENERATED_AT = "2026-11-24T00:00:00.000Z";

export const ADMIN_SESSION_COOKIE = "sf_admin_session";
const ADMIN_SESSION_MAX_AGE = 7 * 86_400;

function adminSessionCookie(token: string): string {
  return `${ADMIN_SESSION_COOKIE}=${token}; Path=/admin; Max-Age=${ADMIN_SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

const clearAdminSessionCookie = `${ADMIN_SESSION_COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export type AdminSendJson = (status: number, body: unknown, headers?: Record<string, string>) => void;

function ok(data: unknown) {
  return { data, meta: { generated_at: GENERATED_AT } };
}

const PROBLEM_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Content",
};

function problem(status: number, code: string, detail: string) {
  return {
    type: `https://seeds.hues.flowers/api-docs#error-${code}`,
    title: PROBLEM_TITLES[status] ?? "Error",
    status,
    detail,
    code,
  };
}

function reject(send: AdminSendJson, status: number, code: string, detail: string): void {
  send(status, problem(status, code, detail));
}

function cookieOf(req: IncomingMessage, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=") || null;
  }
  return null;
}

export interface AdminSession {
  account: AdminAccountFixture;
  token: string;
}

function sessionOf(req: IncomingMessage, state: FakeCatalogState): AdminSession | null {
  const token = cookieOf(req, ADMIN_SESSION_COOKIE);
  if (!token) return null;
  const session = state.admin.sessions.find((s) => s.token === token);
  if (!session) return null;
  // Absolute expiry ONLY — age never invalidates (no idle timeout exists).
  if (Date.parse(session.expiresAt) <= Date.parse(state.admin.now)) return null;
  const account = state.admin.accounts.find((a) => a.email === session.email && a.status === "active");
  if (!account) return null;
  return { account, token };
}

/** The A3 welcome-back: the email a token belonged to, even after expiry. */
function expiredSessionEmail(req: IncomingMessage, state: FakeCatalogState): string | null {
  const token = cookieOf(req, ADMIN_SESSION_COOKIE);
  if (!token) return null;
  const session = state.admin.sessions.find((s) => s.token === token);
  if (!session || Date.parse(session.expiresAt) > Date.parse(state.admin.now)) return null;
  return session.email;
}

const isPrivileged = (account: AdminAccountFixture): boolean => account.role === "admin" || account.role === "reviewer";

/** 401 when signed out; 403 + no-role when signed in without a role. Null = proceed. */
function gate(session: AdminSession | null): { status: 401 | 403; code: string; detail: string } | null {
  if (!session) return { status: 401, code: "signed_out", detail: "Your admin session ended. Sign in again to pick up where you left off." };
  if (!isPrivileged(session.account)) return { status: 403, code: "no_role", detail: "This account doesn't have admin access." };
  return null;
}

function gateAdmin(session: AdminSession | null): { status: 401 | 403; code: string; detail: string } | null {
  const base = gate(session);
  if (base) return base;
  if (session!.account.role !== "admin") {
    return { status: 403, code: "forbidden", detail: session!.account.role === "reviewer" ? "Your reviewer role doesn't include that action." : "This account doesn't have admin access." };
  }
  return null;
}

function record(state: FakeCatalogState, endpoint: string, body: unknown): void {
  state.admin.received.push({ endpoint, body: structuredClone(body) });
}

/** Mode rejection (after recording): the BusyForm rejection drive. */
function modeReject(state: FakeCatalogState, key: AdminEndpointKey): { status: number; code: string; detail: string } | null {
  if (state.admin.modes[key] === "accept") return null;
  return { status: 422, code: "invalid_fields", detail: "Some fields need attention before continuing." };
}

const strField = (body: Record<string, unknown>, key: string): string => (typeof body[key] === "string" ? (body[key] as string) : "");
const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/* ── Public-surface guards (soft removal + alias proof) ── */

/** Public slugs currently soft-removed (their public surface 404s). */
export function removedVarietySlugs(state: FakeCatalogState): string[] {
  return state.admin.varieties.filter((v) => v.deletedAt !== null).map((v) => v.slug);
}

/** Extra variety search hits from duplicate-decision aliases (matchedAlias set). */
export function decisionAliasHits(state: FakeCatalogState, q: string): { slug: string; title: string; subtitle: string; href: string; matchedAlias: string }[] {
  const lower = q.trim().toLowerCase();
  if (!lower) return [];
  const out: { slug: string; title: string; subtitle: string; href: string; matchedAlias: string }[] = [];
  for (const alias of state.admin.decisionAliases) {
    if (!alias.alias.toLowerCase().includes(lower)) continue;
    const variety = state.admin.varieties.find((v) => v.slug === alias.varietySlug && !v.deletedAt);
    if (!variety) continue;
    out.push({
      slug: variety.slug,
      title: variety.name,
      subtitle: `${variety.cropCommon} · decide-duplicate alias`,
      href: `/variety/${variety.slug}`,
      matchedAlias: alias.alias,
    });
  }
  return out;
}

/* ── Queue reads ── */

const QUEUE_DEFS = [
  { key: "duplicates", name: "Duplicate varieties", description: "Possible duplicate varieties held for a decision", href: "/admin/review?queue=duplicates" },
  { key: "sellers", name: "Seller candidates", description: "Seller candidates from the hunt and Add Your Farm", href: "/admin/review?queue=sellers" },
  { key: "listings", name: "Queued listings", description: "Shop listings waiting to join a variety page", href: "/admin/review?queue=listings" },
  { key: "reports", name: "Reports", description: "Visitor reports waiting for a decision", href: "/admin/review?queue=reports" },
] as const;

function itemLabel(item: ReviewItemFixture): string {
  const p = item.proposal;
  if (item.type === "seller_candidate") return typeof p.name === "string" ? p.name : `seller candidate #${item.id}`;
  if (item.type === "duplicate_hold") return typeof p.held_name === "string" ? p.held_name : `duplicate hold #${item.id}`;
  if (item.type === "listing_match") return typeof p.extracted_name === "string" ? p.extracted_name : `listing match #${item.id}`;
  if (item.type === "seller_correction" || item.type === "removal") {
    const report = (p.report ?? {}) as Record<string, unknown>;
    if (item.type === "removal") return "Removal request";
    return report.target_type === "variety" ? "Variety correction" : "Seller correction";
  }
  return `item #${item.id}`;
}

function queueRow(item: ReviewItemFixture): Record<string, unknown> {
  const p = item.proposal;
  if (item.type === "seller_candidate") {
    return {
      ref: { kind: "review", id: item.id },
      type: item.type,
      name: itemLabel(item),
      facts: typeof p.domain === "string" ? p.domain : "",
      createdAt: item.createdAt,
      source: "Found by the hunt",
    };
  }
  if (item.type === "duplicate_hold") {
    const candidate = (p.candidate ?? {}) as Record<string, unknown>;
    return {
      ref: { kind: "review", id: item.id },
      type: item.type,
      name: itemLabel(item),
      facts: typeof candidate.name === "string" ? `Looks like '${candidate.name}'` : "Possible duplicate",
      createdAt: item.createdAt,
      source: "From the scout",
    };
  }
  if (item.type === "listing_match") {
    const match = (p.match ?? {}) as Record<string, unknown>;
    const confidence = typeof match.confidence === "number" ? ` · confidence ${Math.round(match.confidence * 100)}%` : "";
    return {
      ref: { kind: "review", id: item.id },
      type: item.type,
      name: itemLabel(item),
      facts: `Blue Ridge Seeds${confidence}`,
      createdAt: item.createdAt,
      source: match.method === "model" ? "Model match — a person checks it" : null,
    };
  }
  const report = (p.report ?? {}) as Record<string, unknown>;
  const targetType = typeof report.target_type === "string" ? report.target_type : "seller";
  const targetRef = typeof report.target_ref === "string" ? report.target_ref : "";
  const message = typeof report.message === "string" ? report.message : "";
  return {
    ref: { kind: "review", id: item.id },
    type: item.type,
    name: itemLabel(item),
    facts: targetRef ? `${targetType} ${targetRef}` : targetType,
    createdAt: item.createdAt,
    source: message ? message.slice(0, 120) : null,
  };
}

function decisionText(item: ReviewItemFixture): string {
  const name = item.decidedByName?.trim() || null;
  const lead = (verb: string): string => (name ? `${name} ${verb} ` : `${verb[0]!.toUpperCase()}${verb.slice(1)} `);
  if (item.type === "duplicate_hold") {
    const held = typeof item.proposal.held_name === "string" ? item.proposal.held_name : `hold #${item.id}`;
    if (item.status === "merged") {
      const candidate = (item.proposal.candidate ?? {}) as Record<string, unknown>;
      const existing = typeof candidate.name === "string" ? candidate.name : "its match";
      return name ? `${name} marked '${held}' a duplicate of '${existing}'` : `Marked '${held}' a duplicate of '${existing}'`;
    }
    return `${lead("added")}'${held}' as its own variety`;
  }
  if (item.type === "seller_correction" && item.status === "approved") {
    const report = (item.proposal.report ?? {}) as Record<string, unknown>;
    const ref = typeof report.target_ref === "string" ? report.target_ref : `report #${item.id}`;
    return `${lead("applied")}a correction to ${ref}`;
  }
  if (item.type === "removal" && item.status === "approved") {
    const report = (item.proposal.report ?? {}) as Record<string, unknown>;
    const ref = typeof report.target_ref === "string" ? report.target_ref : `report #${item.id}`;
    return `${lead("removed")}${ref}`;
  }
  if (item.status === "rejected") return `${lead("declined")}${itemLabel(item)}`;
  if (item.status === "approved") return `${lead("approved")}${itemLabel(item)}`;
  return `${lead("decided")}${itemLabel(item)}`;
}

function queueCards(state: FakeCatalogState): { cards: unknown[]; totalWaiting: number } {
  const pending = state.admin.review.filter((i) => i.status === "pending");
  const pendingFarms = state.admin.farmSubmissions.filter((s) => s.status === "pending").sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const cards = QUEUE_DEFS.map((def) => {
    const items = pending.filter((i) => queueForType(i.type) === def.key).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    if (def.key !== "sellers") return { ...def, count: items.length, oldest: items[0]?.createdAt ?? null };
    // The sellers queue folds pending Add Your Farm submissions in.
    const oldest = [items[0]?.createdAt ?? null, pendingFarms[0]?.createdAt ?? null].filter((x): x is string => x !== null).sort()[0] ?? null;
    return { ...def, count: items.length + pendingFarms.length, oldest };
  });
  return { cards, totalWaiting: pending.length + pendingFarms.length };
}

/** 1-based rank of a waiting item ("3 of 8") plus the queue total. */
function rankOf(state: FakeCatalogState, queue: string, kind: string, id: number): { rank: number; total: number } | null {
  const rows: { kind: string; id: number; createdAt: string }[] = state.admin.review
    .filter((i) => i.status === "pending" && queueForType(i.type) === queue)
    .map((i) => ({ kind: "review", id: i.id, createdAt: i.createdAt }));
  if (queue === "sellers") {
    for (const s of state.admin.farmSubmissions.filter((s) => s.status === "pending")) rows.push({ kind: "farm", id: s.id, createdAt: s.createdAt });
  }
  rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id - b.id));
  const at = rows.findIndex((r) => r.kind === kind && r.id === id);
  return at < 0 ? null : { rank: at + 1, total: rows.length };
}

/** Decided-segment outcome in plain words (v2 outcomeLabel). */
function decidedOutcome(item: ReviewItemFixture): string {
  const p = item.proposal;
  if (item.type === "duplicate_hold" && item.status === "merged") {
    const existing = ((p.candidate ?? {}) as Record<string, unknown>).name;
    return typeof existing === "string" ? `Marked a duplicate of '${existing}'` : "Marked a duplicate";
  }
  if (item.type === "duplicate_hold" && item.status === "approved") return "Added as its own variety";
  if (item.type === "seller_correction" && item.status === "approved") return "Correction applied";
  if (item.type === "removal" && item.status === "approved") return "Removal applied";
  if (item.status === "approved") return "Approved";
  if (item.status === "rejected") return "Declined";
  if (item.status === "merged") return "Merged";
  return item.status;
}

/** The sellers queue's farm-submission rows, shaped like queue rows. */
function farmRows(state: FakeCatalogState): Record<string, unknown>[] {
  return state.admin.farmSubmissions
    .filter((s) => s.status === "pending")
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .map((s) => ({
      ref: { kind: "farm", id: s.id },
      type: "farm_submission",
      name: s.farmName,
      facts: `${s.city}, ${s.state}`,
      createdAt: s.createdAt,
      source: "Add Your Farm submission",
    }));
}

/* ── Statistics (hand-computed from the fixture signals) ── */

type StatRange = "7d" | "30d" | "12w";
const RANGE_WORDS: Record<StatRange, { last: string; words: string }> = {
  "7d": { last: "Last 7 days", words: "Nov 17 – Nov 23, 2026" },
  "30d": { last: "Last 30 days", words: "Oct 25 – Nov 23, 2026" },
  "12w": { last: "Last 12 weeks", words: "Sep 1 – Nov 23, 2026" },
};

function statDelta(cur: number, prev: number): { kind: string; text: string } {
  if (cur === prev) return { kind: "no-change", text: "No change" };
  if (prev === 0) return { kind: "new", text: "New" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (cur > prev) return { kind: "up", text: `▲ ${pct}% up` };
  return { kind: "down", text: `▼ ${-pct}% down` };
}

function statMovement(curRank: number, prevRank: number | null): { kind: string; text: string } {
  if (prevRank === null) return { kind: "new", text: "New" };
  const d = prevRank - curRank;
  if (d === 0) return { kind: "same", text: "—" };
  return d > 0 ? { kind: "up", text: `▲ ${d}` } : { kind: "down", text: `▼ ${-d}` };
}

function rankBy<T>(rows: T[], value: (r: T) => number): Map<T, number> {
  const sorted = [...rows].sort((a, b) => value(b) - value(a));
  const ranks = new Map<T, number>();
  sorted.forEach((row, i) => ranks.set(row, i + 1));
  return ranks;
}

function trendBuckets(label: string, days: string[], values: number[]): { buckets: { key: string; label: string; value: number }[]; summary: string } {
  const buckets = days.map((day, i) => ({ key: day, label: day.slice(5).replace("-", " "), value: values[i] ?? 0 }));
  let total = 0;
  let peak: { key: string; label: string; value: number } | null = null;
  for (const b of buckets) {
    total += b.value;
    if (peak === null || b.value > peak.value) peak = b;
  }
  if (peak === null || total === 0) return { buckets, summary: `${label}: none in this period.` };
  return { buckets, summary: `${label} peaked on ${peak.label}, with ${peak.value.toLocaleString("en-US")}.` };
}

const TREND_DAYS = ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"];

function overviewCards(state: FakeCatalogState, range: StatRange, home: boolean) {
  const s = state.admin.statistics;
  const caption = `${RANGE_WORDS[range].last} · ${RANGE_WORDS[range].words}`;
  return [
    {
      key: "visitors",
      label: "Visitors",
      href: "/admin/statistics",
      caption,
      total: null,
      delta: null,
      trend: null,
      thinLine: null,
      noData: home
        ? "Not connected yet — visitor counts come from Cloudflare Web Analytics."
        : "Visitor counts come from Cloudflare Web Analytics. It isn’t connected to the directory yet, so there are no visitor numbers to show.",
      error: false,
    },
    {
      key: "accounts",
      label: "New accounts",
      href: "/admin/accounts",
      caption,
      total: s.accountsTotal,
      delta: statDelta(s.accountsTotal, s.accountsPrev),
      trend: trendBuckets("New accounts", TREND_DAYS, [2, 2, 3, 3, 2, 3, 3]),
      thinLine: null,
      noData: null,
      error: false,
    },
    {
      key: "waitlist",
      label: "Waitlist signups",
      href: "/admin/statistics?signal=waitlist",
      caption,
      total: s.waitlistSignups,
      delta: statDelta(s.waitlistSignups, s.waitlistSignupsPrev),
      trend: trendBuckets("Waitlist signups", TREND_DAYS, [1, 1, 2, 1, 1, 2, 1]),
      thinLine: null,
      noData: null,
      error: false,
    },
    {
      key: "clicks",
      label: "Clicks to sellers",
      href: "/admin/statistics?signal=clicks",
      caption,
      total: s.clicksTotal,
      delta: statDelta(s.clicksTotal, s.clicksPrev),
      trend: trendBuckets("Clicks to sellers", TREND_DAYS, [10, 11, 9, 12, 10, 11, 12]),
      thinLine: null,
      noData: null,
      error: false,
    },
  ];
}

function popularity(state: FakeCatalogState, range: StatRange, signal: string, show: number): Record<string, unknown> {
  const s = state.admin.statistics;
  const caption = `${RANGE_WORDS[range].last} · ${RANGE_WORDS[range].words}`;
  if (signal === "views" || signal === "clicks") {
    const rows = signal === "views" ? s.views : s.clicks;
    const curRank = rankBy(rows, (r) => r.cur);
    const prevRank = rankBy(rows, (r) => r.prev);
    const ranked = [...rows]
      .sort((a, b) => b.cur - a.cur || (a.slug < b.slug ? -1 : 1))
      .map((r) => ({
        rank: curRank.get(r)!,
        slug: r.slug,
        name: r.name,
        crop: r.crop,
        value: r.cur,
        movement: statMovement(curRank.get(r)!, prevRank.get(r)!),
      }));
    const soldOut = signal === "clicks" ? Math.round((100 * 25) / 75) : 0;
    return {
      signal,
      title: signal === "views" ? "Most viewed varieties" : "Most clicked varieties",
      valueLabel: signal === "views" ? "Views" : "Clicks",
      rows: ranked.slice(0, show),
      shown: Math.min(show, ranked.length),
      total: ranked.length,
      thin: false,
      thinLine: null,
      emptyLine: signal === "views" ? "No views recorded in this period." : "No clicks recorded in this period.",
      soldOutLine: signal === "clicks" ? `${soldOut}% of clicks were on sold-out listings` : null,
      caption,
      error: false,
    };
  }
  if (signal === "waitlist") {
    const ranked = [...s.waitlist]
      .sort((a, b) => b.waiters - a.waiters || (a.slug < b.slug ? -1 : 1))
      .map((r, i) => ({ rank: i + 1, slug: r.slug, name: r.name, crop: r.crop, waiters: r.waiters, verified: r.verified, sellers: r.sellers }));
    return {
      signal: "waitlist",
      rows: ranked.slice(0, show),
      shown: Math.min(show, ranked.length),
      total: ranked.length,
      caption: `The current waiting list — it doesn’t change with the date range.`,
      error: false,
    };
  }
  return {
    signal: "searches",
    top: s.searches.slice(0, show).map((r) => ({ term: r.term, count: r.count, finds: r.finds })),
    topShown: Math.min(show, s.searches.length),
    topTotal: s.searches.length,
    noResults: s.fruitless.map((r) => ({ term: r.term, count: r.count })),
    noResultsShown: s.fruitless.length,
    noResultsTotal: s.fruitless.length,
    caption,
    error: false,
  };
}

/* ── Detail hydration (admin reads — notes included, prices never) ── */

function sellerDetailPayload(state: FakeCatalogState, slug: string): Record<string, unknown> | null {
  const seller = state.admin.sellers.find((s) => s.slug === slug);
  if (!seller) return null;
  const liveListingCount = seller.listings.filter((l) => l.status === "active" || l.status === "published").length;
  return {
    slug: seller.slug,
    name: seller.name,
    type: seller.type,
    platform: seller.platform,
    homepage: seller.homepage,
    contactEmail: seller.contactEmail,
    csPhone: seller.csPhone,
    csEmail: seller.csEmail,
    location: seller.location,
    locations: seller.locations,
    region: seller.region,
    country: seller.country,
    shipsTo: seller.shipsTo,
    description: seller.description,
    orderingNotes: seller.orderingNotes,
    status: seller.status,
    eligibility: seller.eligibility,
    listingPolicy: seller.listingPolicy,
    isSmallFarm: seller.isSmallFarm,
    liveListingCount,
    listings: seller.listings,
    notes: seller.notes.map((n) => ({ id: n.id, authorName: n.authorName, authorRole: n.authorRole, body: n.body, createdAt: n.createdAt })),
  };
}

function reviewDetail(state: FakeCatalogState, id: number): { status: number; body: unknown } {
  const item = state.admin.review.find((i) => i.id === id);
  if (!item || item.status !== "pending") return { status: 404, body: problem(404, "not_found", `review item ${id} not found`) };
  const p = item.proposal;
  const base = { ref: { kind: "review", id: item.id }, type: item.type, name: itemLabel(item), createdAt: item.createdAt };
  if (item.type === "seller_candidate") {
    return {
      status: 200,
      body: ok({
        ...base,
        website: typeof p.website_url === "string" ? p.website_url : typeof p.website === "string" ? p.website : null,
        domain: typeof p.domain === "string" ? p.domain : null,
      }),
    };
  }
  if (item.type === "listing_match") {
    const match = (p.match ?? {}) as Record<string, unknown>;
    const listing = (p.listing ?? {}) as Record<string, unknown>;
    const confidence = typeof match.confidence === "number" ? Math.round(match.confidence * 100) : null;
    return {
      status: 200,
      body: ok({
        ...base,
        extractedName: p.extracted_name,
        crop: p.crop,
        cropCommon: "Cosmos",
        match: `The model matched this listing${confidence !== null ? `; confidence ${confidence}%` : ""}; the crop agrees (cosmos).`,
        listing: {
          sellerName: "Blue Ridge Seeds",
          sellerSlug: "blue-ridge-seeds",
          isSmallFarm: true,
          titleRaw: listing.titleRaw ?? null,
          productUrl: listing.productUrl ?? null,
          packets: [{ label: "25 seeds", seedCount: 25 }],
        },
        variety: { kind: "existing", name: "Lonely Bloom", slug: "cosmos-lonely-bloom", cropCommon: "Cosmos", seriesName: null, sellerCount: 0 },
      }),
    };
  }
  if (item.type === "seller_correction") {
    const report = (p.report ?? {}) as Record<string, unknown>;
    const fields = (p.fields ?? {}) as Record<string, unknown>;
    const seller = state.admin.sellers.find((s) => s.slug === report.target_ref);
    return {
      status: 200,
      body: ok({
        ...base,
        verifiedBy: typeof p.verifiedBy === "string" ? p.verifiedBy : null,
        reportType: report.type ?? null,
        message: report.message ?? null,
        targetType: report.target_type ?? "seller",
        targetRef: report.target_ref ?? "",
        seller: seller
          ? { slug: seller.slug, name: seller.name, location: seller.location, region: seller.region, homepage: seller.homepage, description: seller.description, orderingNotes: seller.orderingNotes, shipsTo: seller.shipsTo }
          : null,
        fields,
        hasFields: Object.keys(fields).length > 0,
        listingRef: null,
      }),
    };
  }
  if (item.type === "duplicate_hold") {
    const candidate = (p.candidate ?? {}) as Record<string, unknown>;
    const listing = (p.listing ?? {}) as Record<string, unknown>;
    return {
      status: 200,
      body: ok({
        ...base,
        held: {
          name: p.held_name,
          crop: p.crop,
          cropCommon: "Sweet Pea",
          sellerName: "Blue Ridge Seeds",
          sellerSlug: "blue-ridge-seeds",
          titleRaw: listing.titleRaw ?? null,
          productUrl: listing.productUrl ?? null,
          availability: listing.availability ?? null,
        },
        existing: { name: "King's Ransom", slug: "sweet-pea-kings-ransom", cropCommon: "Sweet Pea", sellerCount: 2, status: "active" },
        stale: false,
        candidateName: candidate.name ?? `variety #${candidate.variety_id ?? "?"}`,
        evidenceQuote: p.evidence_quote ?? null,
        holdReason: p.hold_reason ?? null,
        comparison: {
          sameCrop: true,
          cropLine: "Same crop: Sweet Peas",
          nameLine: "Names differ by one word",
          sharedSellers: 1,
          sellerLine: "Sold by 1 of the same sellers",
        },
      }),
    };
  }
  // removal
  const report = (p.report ?? {}) as Record<string, unknown>;
  const seller = state.admin.sellers.find((s) => s.slug === report.target_ref);
  const listingId = typeof p.listing_id === "number" ? p.listing_id : null;
  return {
    status: 200,
    body: ok({
      ...base,
      verifiedBy: typeof p.verifiedBy === "string" ? p.verifiedBy : null,
      reportType: report.type ?? null,
      message: report.message ?? null,
      targetType: report.target_type ?? "seller",
      targetRef: report.target_ref ?? "",
      seller: seller ? { slug: seller.slug, name: seller.name, location: seller.location, status: seller.status } : null,
      fields: {},
      hasFields: false,
      listingRef: listingId
        ? { id: listingId, live: p.live === true, titleRaw: "Sweet Pea King's Ransom — 50 seeds", varietyName: "King's Ransom", sellerName: "Prairie Seed House" }
        : null,
    }),
  };
}

/* ── GET dispatch (true when the path is an admin path) ── */

export function routeAdminGet(url: URL, req: IncomingMessage, send: AdminSendJson, state: FakeCatalogState): boolean {
  const path = url.pathname;
  if (!path.startsWith("/api/internal/admin/")) return false;
  const session = sessionOf(req, state);

  if (path === "/api/internal/admin/me") {
    if (!session) {
      const email = expiredSessionEmail(req, state);
      send(200, ok(email ? { signed_in: false, expired: true, email } : { signed_in: false }));
      return true;
    }
    send(200, ok({ signed_in: true, user: { id: session.account.id, name: session.account.name, email: session.account.email, role: session.account.role } }));
    return true;
  }

  const gated = gate(session);
  if (gated) {
    reject(send, gated.status, gated.code, gated.detail);
    return true;
  }

  if (path === "/api/internal/admin/home") {
    const { cards, totalWaiting } = queueCards(state);
    const decisions = state.admin.review
      .filter((i) => i.status !== "pending")
      .sort((a, b) => (a.resolvedAt ?? "") < (b.resolvedAt ?? "") ? 1 : -1)
      .slice(0, 6)
      .map((i) => ({ text: decisionText(i), at: i.resolvedAt ?? i.createdAt }));
    const wanted = [...state.admin.statistics.waitlist]
      .sort((a, b) => b.waiters - a.waiters)
      .slice(0, 5)
      .map((w) => ({ slug: w.slug, name: w.name, waiters: w.waiters }));
    send(200, ok({ cards, totalWaiting, decisions, wanted, snapshot: { cards: overviewCards(state, "7d", true) } }));
    return true;
  }

  if (path === "/api/internal/admin/review/queue") {
    const queue = url.searchParams.get("queue") ?? "duplicates";
    const show = Math.min(200, Math.max(25, Number(url.searchParams.get("show") ?? "25") || 25));
    let rows = state.admin.review
      .filter((i) => i.status === "pending" && queueForType(i.type) === queue)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .map(queueRow);
    if (queue === "sellers") {
      rows = [...rows, ...farmRows(state)].sort((a, b) => (String(a.createdAt) < String(b.createdAt) ? -1 : 1));
    }
    send(200, ok({ rows: rows.slice(0, show), total: rows.length }));
    return true;
  }

  if (path === "/api/internal/admin/review/detail") {
    const kind = url.searchParams.get("kind") ?? "review";
    const id = Number(url.searchParams.get("id") ?? "");
    if (!Number.isInteger(id) || id <= 0) {
      reject(send, 404, "not_found", "review item not found");
      return true;
    }
    if (kind === "farm") {
      const sub = state.admin.farmSubmissions.find((s) => s.id === id && s.status === "pending");
      if (!sub) {
        reject(send, 404, "not_found", `farm submission ${id} not found`);
        return true;
      }
      send(200, ok({ ...sub, ref: { kind: "farm", id: sub.id }, type: "farm_submission", rank: rankOf(state, "sellers", "farm", id) }));
      return true;
    }
    const r = reviewDetail(state, id);
    if (r.status !== 200) {
      send(r.status, r.body);
      return true;
    }
    const item = state.admin.review.find((i) => i.id === id)!;
    const queue = queueForType(item.type) ?? "duplicates";
    send(200, ok({ ...(r.body as { data: Record<string, unknown> }).data, rank: rankOf(state, queue, "review", id) }));
    return true;
  }

  if (path === "/api/internal/admin/review/decided") {
    const queue = url.searchParams.get("queue") ?? "duplicates";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = 20;
    const rows = state.admin.review
      .filter((i) => i.status !== "pending" && queueForType(i.type) === queue)
      .sort((a, b) => ((a.resolvedAt ?? "") < (b.resolvedAt ?? "") ? 1 : -1))
      .map((i) => ({ ref: { kind: "review", id: i.id }, type: i.type, name: itemLabel(i), outcome: decidedOutcome(i), decider: i.decidedByName, at: i.resolvedAt ?? i.createdAt }));
    send(200, ok({ rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length }));
    return true;
  }

  if (path === "/api/internal/admin/sellers") {
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const badge = url.searchParams.get("badge") ?? "all";
    const rows = state.admin.sellers
      .filter((s) => (!q || s.name.toLowerCase().includes(q) || s.slug.includes(q)) && (badge !== "small" || s.isSmallFarm) && (badge !== "not" || !s.isSmallFarm))
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .map((s) => ({ slug: s.slug, name: s.name, location: s.location, region: s.region, isSmallFarm: s.isSmallFarm, status: s.status, eligibility: s.eligibility, listings: s.listings.length }));
    send(200, ok({ rows, total: rows.length }));
    return true;
  }

  const sellerDetail = /^\/api\/internal\/admin\/sellers\/([^/]+)$/.exec(path);
  if (sellerDetail) {
    const detail = sellerDetailPayload(state, sellerDetail[1]!);
    if (!detail) {
      reject(send, 404, "seller_not_found", `seller ${sellerDetail[1]} not found`);
      return true;
    }
    send(200, ok(detail));
    return true;
  }

  if (path === "/api/internal/admin/crops") {
    send(200, ok([{ slug: "sweet-pea", commonName: "Sweet Pea", varietyCount: 1 }, { slug: "cosmos", commonName: "Cosmos", varietyCount: 1 }]));
    return true;
  }

  if (path === "/api/internal/admin/varieties") {
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const crop = url.searchParams.get("crop") ?? "";
    const rows = state.admin.varieties
      .filter((v) => !v.deletedAt)
      .filter((v) => !q || v.name.toLowerCase().includes(q) || v.slug.includes(q) || v.aliases.some((a) => a.alias.toLowerCase().includes(q)))
      .filter((v) => !crop || v.crop === crop)
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .map((v) => {
        const matched = q ? (v.aliases.find((a) => a.alias.toLowerCase().includes(q) && !v.name.toLowerCase().includes(q))?.alias ?? null) : null;
        return { slug: v.slug, name: v.name, crop: v.crop, cropCommon: v.cropCommon, sellers: v.liveListings > 0 ? 1 : 0, aliases: v.aliases.length, matchedAlias: matched };
      });
    send(200, ok({ rows, total: rows.length }));
    return true;
  }

  const varietyDetail = /^\/api\/internal\/admin\/varieties\/([^/]+)$/.exec(path);
  if (varietyDetail) {
    const variety = state.admin.varieties.find((v) => v.slug === varietyDetail[1] && !v.deletedAt);
    if (!variety) {
      reject(send, 404, "variety_not_found", `variety ${varietyDetail[1]} not found`);
      return true;
    }
    send(
      200,
      ok({
        slug: variety.slug,
        name: variety.name,
        crop: variety.crop,
        cropCommon: variety.cropCommon,
        liveListingCount: variety.liveListings,
        listingCounts: variety.liveListings > 0 ? [{ word: "Active", n: variety.liveListings }] : [],
        listingTotal: variety.liveListings,
        waiters: variety.waiters,
        aliases: variety.aliases.map((a) => ({ alias: a.alias, source: a.source, decidedByName: a.decidedByName, createdAt: a.createdAt })),
      }),
    );
    return true;
  }

  if (path === "/api/internal/admin/listings") {
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const seller = url.searchParams.get("seller") ?? "";
    const variety = url.searchParams.get("variety") ?? "";
    const rows = state.admin.listings
      .filter((l) => !q || (l.titleRaw ?? "").toLowerCase().includes(q) || l.varietyName.toLowerCase().includes(q))
      .filter((l) => !seller || l.sellerSlug === seller)
      .filter((l) => !variety || l.varietySlug === variety)
      .map((l) => ({ id: l.id, title: l.titleRaw ?? l.varietyName, varietyName: l.varietyName, varietySlug: l.varietySlug, sellerName: l.sellerName, sellerSlug: l.sellerSlug, status: l.status, lastCheckedAt: l.lastCheckedAt }));
    send(200, ok({ rows, total: rows.length }));
    return true;
  }

  const listingDetail = /^\/api\/internal\/admin\/listings\/(\d+)$/.exec(path);
  if (listingDetail) {
    const listing = state.admin.listings.find((l) => l.id === Number(listingDetail[1]));
    if (!listing) {
      reject(send, 404, "listing_not_found", `listing ${listingDetail[1]} not found`);
      return true;
    }
    send(
      200,
      ok({
        id: listing.id,
        title: listing.titleRaw ?? listing.varietyName,
        varietyName: listing.varietyName,
        varietySlug: listing.varietySlug,
        sellerName: listing.sellerName,
        sellerSlug: listing.sellerSlug,
        productUrl: listing.productUrl,
        status: listing.status,
        packets: listing.packets,
        lastCheckedAt: listing.lastCheckedAt,
        history: listing.history.map((h) => ({ ...h, words: h.event === "first_seen" ? "Published" : h.event === "gone" ? "Retired" : h.event === "restored" ? "Restored" : h.event })),
      }),
    );
    return true;
  }

  // Accounts: admin only — reviewers get no data here, reads included.
  if (path === "/api/internal/admin/accounts" || path === "/api/internal/admin/seller-options" || /^\/api\/internal\/admin\/accounts\/\d+$/.test(path)) {
    if (session!.account.role !== "admin") {
      reject(send, 403, "forbidden", session!.account.role === "reviewer" ? "Your reviewer role doesn't include account settings." : "This account doesn't have admin access.");
      return true;
    }
    if (path === "/api/internal/admin/seller-options") {
      send(200, ok(state.admin.sellers.map((s) => ({ slug: s.slug, name: s.name, location: s.location })).sort((a, b) => (a.name < b.name ? -1 : 1))));
      return true;
    }
    if (path === "/api/internal/admin/accounts") {
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const rows = state.admin.accounts
        .filter((a) => !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
        .sort((a, b) => (a.name < b.name ? -1 : 1))
        .map((a) => ({ id: a.id, name: a.name, email: a.email, role: a.role, status: a.status, isFarmOwner: a.isFarmOwner, waitlists: a.waitlists }));
      send(200, ok({ rows, total: rows.length }));
      return true;
    }
    const account = state.admin.accounts.find((a) => a.id === Number(/^\/api\/internal\/admin\/accounts\/(\d+)$/.exec(path)![1]));
    if (!account) {
      reject(send, 404, "account_not_found", "account not found");
      return true;
    }
    const seller = account.sellerId ? state.admin.sellers.find((s) => s.id === account.sellerId) : null;
    send(200, ok({ id: account.id, name: account.name, email: account.email, role: account.role, status: account.status, isFarmOwner: account.isFarmOwner, seller: seller ? { slug: seller.slug, name: seller.name } : null, waitlists: account.waitlists, joinedAt: account.joinedAt }));
    return true;
  }

  if (path === "/api/internal/admin/statistics/overview") {
    const range = (url.searchParams.get("range") ?? "7d") as StatRange;
    const words = RANGE_WORDS[range] ?? RANGE_WORDS["7d"];
    send(200, ok({ period: { words: words.words, caption: `${words.last} · ${words.words}` }, cards: overviewCards(state, range in RANGE_WORDS ? range : "7d", false) }));
    return true;
  }

  if (path === "/api/internal/admin/statistics/popularity") {
    const range = (url.searchParams.get("range") ?? "7d") as StatRange;
    const signal = url.searchParams.get("signal") ?? "views";
    const show = url.searchParams.get("show") === "25" ? 25 : 10;
    if (signal !== "views" && signal !== "clicks" && signal !== "waitlist" && signal !== "searches") {
      reject(send, 400, "invalid_signal", "signal must be views, clicks, waitlist, or searches");
      return true;
    }
    send(200, ok(popularity(state, range in RANGE_WORDS ? range : "7d", signal, show)));
    return true;
  }

  return false;
}

/* ── Mutation effects ── */

function pendingItem(state: FakeCatalogState, id: number): ReviewItemFixture | null {
  const item = state.admin.review.find((i) => i.id === id);
  return item && item.status === "pending" ? item : null;
}

function resolveItem(state: FakeCatalogState, item: ReviewItemFixture, status: "approved" | "rejected" | "merged", byName: string, reason?: string): void {
  item.status = status;
  item.decidedByName = byName;
  item.resolvedAt = state.admin.now;
  if (reason !== undefined) item.reason = reason;
}

/** Publish listing_match 101 onto cosmos-lonely-bloom's PUBLIC detail (rederived on read). */
function publishMatchListing(state: FakeCatalogState, item: ReviewItemFixture): { listingId: number; varietySlug: string; sellerSlug: string } {
  const listing = (item.proposal.listing ?? {}) as Record<string, unknown>;
  const detail = state.details["cosmos-lonely-bloom"];
  const packets = Array.isArray(listing.packets) ? (listing.packets as { label: string; seedCount: number }[]) : [{ label: "25 seeds", seedCount: 25 }];
  if (!detail) throw new Error("stub: cosmos-lonely-bloom detail missing");
  const published: ApiPublicListing = {
    id: 900,
    variety: {
      slug: "cosmos-lonely-bloom",
      varietyName: "Lonely Bloom",
      plant: {
        slug: "cosmos",
        commonName: "Cosmos",
        latinName: "Cosmos bipinnatus",
        lifeCycle: "Annual",
        season_class: "warm_season_tender_annual",
        season_source_label: "The Gardener's Workshop",
        sowing_methods: ["direct_sow"],
        sowing_method_source_label: "Floret",
      },
      colorSwatch: null,
      colorFamily: "white",
      media: [],
      cropMedia: [],
    },
    seller: { slug: "blue-ridge-seeds", name: "Blue Ridge Seeds", location: "Portland, OR", region: "OR", country: "US", isSmallFarm: true },
    availability: "in_stock",
    lastCheckedAt: typeof listing.checkedAt === "string" ? listing.checkedAt : "2026-11-20T08:00:00.000Z",
    firstSeenAt: state.admin.now,
    goUrl: "https://seeds.hues.flowers/go/900",
    productUrl: typeof listing.productUrl === "string" ? listing.productUrl : null,
    notes: null,
    status: "published",
    packetSizes: packets,
    provenance: { source_url: typeof listing.productUrl === "string" ? listing.productUrl : null, retrieved_at: state.admin.now, method: "model", confidence: 0.87 },
    sourceLabel: null,
  };
  detail.listings.push(published);
  return { listingId: 900, varietySlug: "cosmos-lonely-bloom", sellerSlug: "blue-ridge-seeds" };
}

/** Approving a candidate/submission creates the candidate seller (v2's createCandidateSeller). */
function createSellerFromName(state: FakeCatalogState, name: string, website: string | null): void {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const id = Math.max(0, ...state.admin.sellers.map((s) => s.id)) + 1;
  state.admin.sellers.push({
    id,
    slug,
    name,
    type: "retail",
    platform: null,
    homepage: website,
    contactEmail: null,
    csPhone: null,
    csEmail: null,
    location: null,
    locations: [],
    region: null,
    country: "US",
    shipsTo: "unknown",
    description: null,
    orderingNotes: null,
    status: "active",
    eligibility: "candidate",
    listingPolicy: "standard",
    isSmallFarm: false,
    notes: [],
    listings: [],
  });
}

const CORRECTION_LABELS: Record<string, string> = {
  name: "Name",
  location: "Location",
  region: "Region",
  homepage: "Website",
  description: "About",
  orderingNotes: "Ordering notes",
  shipsTo: "Ships to",
};

function applyCorrectionFields(state: FakeCatalogState, sellerSlug: string, fields: Record<string, unknown>): string[] {
  const seller = state.admin.sellers.find((s) => s.slug === sellerSlug);
  if (!seller) return [];
  const applied: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!(key in CORRECTION_LABELS) || typeof value !== "string") continue;
    (seller as unknown as Record<string, unknown>)[key] = value;
    applied.push(key);
  }
  // The fix lands on the PUBLIC payloads immediately too (same record).
  const row = state.sellers.find((s) => s.slug === sellerSlug);
  if (row) {
    if (typeof fields.location === "string") row.location = fields.location;
    if (typeof fields.name === "string") row.name = fields.name;
  }
  const full = state.sellerDetails[sellerSlug];
  if (full) {
    if (typeof fields.location === "string") full.location = fields.location;
    if (typeof fields.description === "string") full.description = fields.description;
    if (typeof fields.orderingNotes === "string") full.orderingNotes = fields.orderingNotes;
  }
  return applied;
}

/* ── POST dispatch (true when the path is an admin path) ── */

export function routeAdminPost(
  url: URL,
  body: Record<string, unknown>,
  req: IncomingMessage,
  send: AdminSendJson,
  state: FakeCatalogState,
): boolean {
  const path = url.pathname;

  // The key-authenticated admin review API (Dustin's ruling 2026-11-21):
  // approve/reject DECIDE non-holds — but a duplicate hold is refused on
  // BOTH, before any effect. decideDuplicate (the session UI path) is the
  // ONLY path that may decide a hold.
  const keyDecision = /^\/api\/v1\/admin\/review\/(\d+)\/(approve|reject)$/.exec(path);
  if (keyDecision) {
    if (req.headers["x-admin-key"] !== state.admin.apiKey) {
      reject(send, 401, "unauthorized", "A valid admin key is required.");
      return true;
    }
    const item = state.admin.review.find((i) => i.id === Number(keyDecision[1]));
    if (!item) {
      reject(send, 404, "not_found", "review item not found");
      return true;
    }
    if (item.type === "duplicate_hold") {
      reject(send, 422, "duplicate_hold_ui_only", `review item ${item.id} is a duplicate hold, decided in the admin UI only`);
      return true;
    }
    if (item.status !== "pending") {
      reject(send, 409, "already_resolved", `review item ${item.id} is ${item.status}`);
      return true;
    }
    if (keyDecision[2] === "approve" && item.type === "listing_match") publishMatchListing(state, item);
    if (keyDecision[2] === "approve" && item.type === "seller_correction") {
      const report = (item.proposal.report ?? {}) as Record<string, unknown>;
      applyCorrectionFields(state, String(report.target_ref ?? ""), (item.proposal.fields ?? {}) as Record<string, unknown>);
    }
    resolveItem(state, item, keyDecision[2] === "approve" ? "approved" : "rejected", "API key");
    send(200, ok({ id: item.id, type: item.type, status: item.status }));
    return true;
  }

  if (!path.startsWith("/api/internal/admin/")) return false;

  if (path === "/api/internal/admin/sign-in/request") {
    record(state, "admin:signInRequest", body);
    const mode = modeReject(state, "signInRequest");
    if (mode) {
      reject(send, mode.status, mode.code, mode.detail);
      return true;
    }
    const email = normalizeEmail(strField(body, "email"));
    const account = state.admin.accounts.find((a) => a.email === email);
    // Unknown emails advance identically (no account enumeration).
    if (account) state.admin.issuedCodes[email] = account.code;
    send(200, ok({ delivery: "sent" }));
    return true;
  }

  if (path === "/api/internal/admin/sign-in/verify") {
    record(state, "admin:signInVerify", body);
    const mode = modeReject(state, "signInVerify");
    if (mode) {
      reject(send, mode.status, mode.code, mode.detail);
      return true;
    }
    const email = normalizeEmail(strField(body, "email"));
    const code = strField(body, "code").replace(/\s/g, "");
    const account = state.admin.accounts.find((a) => a.email === email && a.status === "active");
    if (!account) {
      reject(send, 409, "no_code", "There’s no active code for this email — send a new one.");
      return true;
    }
    const live = state.admin.issuedCodes[email] ?? account.code;
    if (code !== live) {
      reject(send, 400, "code_incorrect", "That code doesn’t match. Check the email and try again.");
      return true;
    }
    delete state.admin.issuedCodes[email];
    if (!isPrivileged(account)) {
      // v2's verifyCode refusal: the landing names the account (no session).
      send(403, { data: { name: account.name, email: account.email }, code: "no_role", error: { code: "no_role", message: "This account doesn't have admin access." } });
      return true;
    }
    const token = `stub-admin-session-${state.admin.sessions.length + 1}`;
    const created = Date.parse(state.admin.now);
    state.admin.sessions.push({
      token,
      email: account.email,
      createdAt: new Date(created).toISOString(),
      expiresAt: new Date(created + 7 * 86_400_000).toISOString(),
    });
    send(200, ok({ name: account.name, email: account.email, role: account.role }), { "Set-Cookie": adminSessionCookie(token) });
    return true;
  }

  if (path === "/api/internal/admin/sign-out") {
    const token = cookieOf(req, ADMIN_SESSION_COOKIE);
    if (token) state.admin.sessions = state.admin.sessions.filter((s) => s.token !== token);
    send(200, ok({ signed_out: true }), { "Set-Cookie": clearAdminSessionCookie });
    return true;
  }

  const session = sessionOf(req, state);

  if (path === "/api/internal/admin/review/decide") {
    record(state, "admin:decide", body);
    const mode = modeReject(state, "decide");
    if (mode) {
      reject(send, mode.status, mode.code, mode.detail);
      return true;
    }
    const gated = gate(session);
    if (gated) {
      reject(send, gated.status, gated.code, gated.detail);
      return true;
    }
    const action = strField(body, "action");
    const kind = strField(body, "kind") || "review";
    const id = typeof body.id === "number" ? body.id : Number(strField(body, "id"));
    const byName = session!.account.name;
    const reason = strField(body, "reason") || undefined;
    // Farm submissions ride the sellers queue under kind "farm".
    if (kind === "farm") {
      const sub = state.admin.farmSubmissions.find((s) => s.id === id && s.status === "pending");
      if (!action || !sub) {
        reject(send, 404, "not_found", action ? `farm submission ${strField(body, "id")} not found` : "Unknown decision.");
        return true;
      }
      if (action === "approve_farm") {
        sub.status = "approved";
        sub.reviewedBy = byName;
        sub.reviewedAt = state.admin.now;
        createSellerFromName(state, sub.farmName, sub.website);
        send(200, ok({ status: "seller_created", revalidate: [] }));
        return true;
      }
      if (action === "decline_farm") {
        sub.status = "rejected";
        sub.reviewedBy = byName;
        sub.reviewedAt = state.admin.now;
        send(200, ok({ status: "farm_declined", name: sub.farmName, revalidate: [] }));
        return true;
      }
      reject(send, 400, "unknown_action", "Unknown decision.");
      return true;
    }
    const item = Number.isInteger(id) ? pendingItem(state, id) : null;
    if (!action || !item) {
      reject(send, 404, "not_found", action ? `review item ${strField(body, "id")} not found` : "Unknown decision.");
      return true;
    }
    switch (action) {
      case "approve_candidate": {
        if (item.type !== "seller_candidate") {
          reject(send, 422, "wrong_type", `review item ${item.id} is not a seller candidate`);
          return true;
        }
        const proposal = item.proposal;
        createSellerFromName(state, String(proposal.name ?? "New seller"), typeof proposal.website_url === "string" ? proposal.website_url : null);
        resolveItem(state, item, "approved", byName);
        send(200, ok({ status: "seller_created", revalidate: [] }));
        return true;
      }
      case "decline_candidate": {
        if (item.type !== "seller_candidate") {
          reject(send, 422, "wrong_type", `review item ${item.id} is not a seller candidate`);
          return true;
        }
        resolveItem(state, item, "rejected", byName, reason);
        send(200, ok({ status: "candidate_declined", name: String(item.proposal.name ?? ""), revalidate: [] }));
        return true;
      }
      case "confirm_report": {
        if (item.type !== "seller_correction" && item.type !== "removal") {
          reject(send, 422, "wrong_type", `review item ${item.id} is not a report`);
          return true;
        }
        // Verified by the reviewer — waiting for an admin. Never resolved.
        item.proposal = { ...item.proposal, verifiedBy: byName };
        send(200, ok({ status: "report_verified", revalidate: [] }));
        return true;
      }
      case "publish_listing": {
        if (item.type !== "listing_match") {
          reject(send, 422, "wrong_type", `review item ${item.id} is not a listing match`);
          return true;
        }
        publishMatchListing(state, item);
        resolveItem(state, item, "approved", byName);
        send(200, ok({ status: "published", variety: "Lonely Bloom", revalidate: ["/variety/cosmos-lonely-bloom", "/seller/blue-ridge-seeds"] }));
        return true;
      }
      case "reject_listing": {
        if (item.type !== "listing_match") {
          reject(send, 422, "wrong_type", `review item ${item.id} is not a listing match`);
          return true;
        }
        resolveItem(state, item, "rejected", byName, reason);
        send(200, ok({ status: "listing_rejected", revalidate: [] }));
        return true;
      }
      case "apply_correction": {
        // BOTH roles: a reviewer's approval applies the fix immediately
        // (Dustin's ruling 2026-11-20) — no admin step.
        if (item.type !== "seller_correction") {
          reject(send, 422, "wrong_type", `review item ${item.id} is not a seller correction`);
          return true;
        }
        const fields = (item.proposal.fields ?? {}) as Record<string, unknown>;
        if (Object.keys(fields).length === 0) {
          reject(send, 422, "no_fields", "this report carries no structured fields to apply");
          return true;
        }
        const report = (item.proposal.report ?? {}) as Record<string, unknown>;
        const target = String(report.target_ref ?? "");
        const applied = applyCorrectionFields(state, target, fields);
        resolveItem(state, item, "approved", byName);
        send(200, ok({ status: "correction_applied", seller: target, applied, revalidate: [`/seller/${target}`] }));
        return true;
      }
      case "dismiss_report": {
        if (item.type !== "seller_correction" && item.type !== "removal") {
          reject(send, 422, "wrong_type", `review item ${item.id} is not a report`);
          return true;
        }
        resolveItem(state, item, "rejected", byName, reason);
        send(200, ok({ status: "report_dismissed", revalidate: [] }));
        return true;
      }
      case "mark_duplicate": {
        if (item.type !== "duplicate_hold") {
          reject(send, 422, "wrong_type", `review item ${item.id} is not a duplicate hold`);
          return true;
        }
        const heldName = String(item.proposal.held_name ?? "");
        const variety = state.admin.varieties.find((v) => v.slug === "sweet-pea-kings-ransom");
        if (!variety || variety.deletedAt) {
          reject(send, 409, "variety_changed", "the existing variety changed while this hold was waiting");
          return true;
        }
        variety.aliases.push({ alias: heldName, source: "duplicate_decision", decidedByName: byName, createdAt: state.admin.now });
        state.admin.decisionAliases.push({ alias: heldName, varietySlug: variety.slug, itemId: item.id, decidedByName: byName, createdAt: state.admin.now });
        const detail = state.details[variety.slug];
        if (detail && !detail.aliases.includes(heldName)) detail.aliases.push(heldName);
        resolveItem(state, item, "merged", byName);
        send(200, ok({ status: "duplicate_kept", held_name: heldName, existing: "King's Ransom", revalidate: [`/variety/${variety.slug}`, "/seller/blue-ridge-seeds"] }));
        return true;
      }
      case "add_hold_variety": {
        if (item.type !== "duplicate_hold") {
          reject(send, 422, "wrong_type", `review item ${item.id} is not a duplicate hold`);
          return true;
        }
        const heldName = String(item.proposal.held_name ?? "");
        const slug = `sweet-pea-${heldName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
        state.admin.varieties.push({ id: 3, slug, name: heldName, crop: "sweet-pea", cropCommon: "Sweet Pea", liveListings: 1, aliases: [], waiters: 0, deletedAt: null });
        resolveItem(state, item, "approved", byName);
        send(200, ok({ status: "variety_added", held: heldName, revalidate: [`/variety/${slug}`] }));
        return true;
      }
      case "skip_hold": {
        if (item.type !== "duplicate_hold") {
          reject(send, 422, "wrong_type", `review item ${item.id} is not a duplicate hold`);
          return true;
        }
        // Skipped for now — still waiting (no resolution recorded).
        send(200, ok({ status: "hold_skipped", revalidate: [] }));
        return true;
      }
      case "apply_removal": {
        const admin = gateAdmin(session);
        if (admin) {
          reject(send, admin.status, admin.code, admin.detail);
          return true;
        }
        if (item.type !== "removal") {
          reject(send, 422, "wrong_type", `review item ${item.id} is not a removal`);
          return true;
        }
        const report = (item.proposal.report ?? {}) as Record<string, unknown>;
        const target = String(report.target_ref ?? "");
        const seller = state.admin.sellers.find((s) => s.slug === target);
        if (seller) {
          seller.status = "inactive";
          seller.eligibility = "ineligible";
          seller.listingPolicy = "removed";
        }
        if (target && !state.removedSellers.includes(target)) state.removedSellers.push(target);
        resolveItem(state, item, "approved", byName);
        send(200, ok({ status: "removal_applied", seller: target, revalidate: [`/seller/${target}`] }));
        return true;
      }
      case "retire_listing": {
        const admin = gateAdmin(session);
        if (admin) {
          reject(send, admin.status, admin.code, admin.detail);
          return true;
        }
        if (item.type !== "seller_correction" && item.type !== "removal") {
          reject(send, 422, "wrong_type", `review item ${item.id} is not a report`);
          return true;
        }
        const listingId = typeof body.listing_id === "number" ? body.listing_id : Number(strField(body, "listing_id"));
        if (item.proposal.listing_id !== listingId) {
          reject(send, 422, "wrong_listing", "that listing is not the one this report names");
          return true;
        }
        // The live listing comes off the public variety detail (v2's
        // removeListing effect, stub-faithful: gone + reason recorded).
        for (const detail of Object.values(state.details)) {
          const at = detail.listings.findIndex((l) => l.id === listingId);
          if (at >= 0) detail.listings.splice(at, 1);
        }
        resolveItem(state, item, "approved", byName, reason);
        send(200, ok({ status: "listing_retired", variety: "King's Ransom", revalidate: ["/variety/sweet-pea-kings-ransom"] }));
        return true;
      }
      default:
        reject(send, 400, "unknown_action", "Unknown decision.");
        return true;
    }
  }

  if (path === "/api/internal/admin/sellers/actions") {
    record(state, "admin:sellerActions", body);
    const mode = modeReject(state, "sellerActions");
    if (mode) {
      reject(send, mode.status, mode.code, mode.detail);
      return true;
    }
    const gated = gate(session);
    if (gated) {
      reject(send, gated.status, gated.code, gated.detail);
      return true;
    }
    const action = strField(body, "action");
    const seller = state.admin.sellers.find((s) => s.slug === strField(body, "seller"));
    if (!action || !seller) {
      reject(send, 404, "seller_not_found", action ? `seller ${strField(body, "seller")} not found` : "Unknown seller action.");
      return true;
    }
    if (action === "add_note") {
      const noteBody = strField(body, "body");
      if (!noteBody) {
        reject(send, 422, "invalid_fields", "Write the note before adding it.");
        return true;
      }
      const note = {
        id: Math.max(0, ...state.admin.sellers.flatMap((s) => s.notes.map((n) => n.id))) + 1,
        authorName: session!.account.name,
        authorRole: session!.account.role,
        body: noteBody,
        createdAt: state.admin.now,
      };
      seller.notes.push(note);
      send(200, ok({ status: "note_added", note, revalidate: [] }));
      return true;
    }
    const admin = gateAdmin(session);
    if (admin) {
      reject(send, admin.status, admin.code, admin.detail);
      return true;
    }
    if (action === "edit_save") {
      const allowed = ["name", "type", "platform", "homepage", "contactEmail", "location", "region", "country", "shipsTo", "description", "orderingNotes"];
      if (body.name !== undefined && !strField(body, "name")) {
        reject(send, 422, "invalid_fields", "name: enter the seller's name.");
        return true;
      }
      const changed: string[] = [];
      for (const key of allowed) {
        if (body[key] === undefined) continue;
        const value = body[key];
        if (typeof value !== "string" && value !== null) continue;
        const current = (seller as unknown as Record<string, unknown>)[key];
        const next = value === "" && key !== "name" ? null : value;
        if (next !== current) {
          (seller as unknown as Record<string, unknown>)[key] = next;
          changed.push(key);
        }
      }
      send(200, ok({ status: "seller_updated", changed, revalidate: changed.length > 0 ? [`/seller/${seller.slug}`] : [] }));
      return true;
    }
    if (action === "classify") {
      const raw = body.is_small_farm;
      const value = typeof raw === "boolean" ? raw : raw === "true" ? true : raw === "false" ? false : null;
      if (value === null) {
        reject(send, 422, "invalid_fields", "is_small_farm: choose yes or no.");
        return true;
      }
      seller.isSmallFarm = value;
      // Resolution 4: classifying a candidate completes it (approved).
      const published = seller.eligibility === "candidate" ? seller.name : null;
      if (seller.eligibility === "candidate") seller.eligibility = "approved";
      send(200, ok({ status: "classified", is_small_farm: value, published, revalidate: [`/seller/${seller.slug}`] }));
      return true;
    }
    if (action === "deactivate" || action === "reactivate") {
      seller.status = action === "deactivate" ? "inactive" : "active";
      send(200, ok({ status: action === "deactivate" ? "deactivated" : "reactivated", revalidate: [`/seller/${seller.slug}`] }));
      return true;
    }
    if (action === "remove") {
      seller.status = "inactive";
      seller.listingPolicy = "removed";
      if (!state.removedSellers.includes(seller.slug)) state.removedSellers.push(seller.slug);
      send(200, ok({ status: "removed", name: seller.name, revalidate: [`/seller/${seller.slug}`] }));
      return true;
    }
    reject(send, 400, "unknown_action", "Unknown seller action.");
    return true;
  }

  if (path === "/api/internal/admin/varieties/actions") {
    record(state, "admin:varietyActions", body);
    const mode = modeReject(state, "varietyActions");
    if (mode) {
      reject(send, mode.status, mode.code, mode.detail);
      return true;
    }
    const admin = gateAdmin(session);
    if (admin) {
      reject(send, admin.status, admin.code, admin.detail);
      return true;
    }
    const action = strField(body, "action");
    const variety = state.admin.varieties.find((v) => v.slug === strField(body, "variety"));
    if (!action || !variety) {
      reject(send, 404, "variety_not_found", action ? `variety ${strField(body, "variety")} not found` : "Unknown variety action.");
      return true;
    }
    // A removed variety is gone for every action except the idempotent
    // re-remove (v2's already_removed, writing nothing).
    if (variety.deletedAt && action !== "variety_remove") {
      reject(send, 404, "variety_not_found", `variety ${strField(body, "variety")} not found`);
      return true;
    }
    if (action === "alias_add") {
      const name = strField(body, "name");
      if (!name) {
        reject(send, 422, "invalid_fields", "name: enter another name.");
        return true;
      }
      const fold = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (fold(name) === fold(variety.name)) {
        reject(send, 422, "invalid_fields", "name: that is already this variety's name.");
        return true;
      }
      if (variety.aliases.some((a) => fold(a.alias) === fold(name))) {
        reject(send, 422, "invalid_fields", `name: '${name}' is already another name for this variety.`);
        return true;
      }
      variety.aliases.push({ alias: name, source: "manual", decidedByName: null, createdAt: state.admin.now });
      send(200, ok({ status: "alias_added", alias: name, revalidate: [`/variety/${variety.slug}`] }));
      return true;
    }
    if (action === "alias_remove") {
      const alias = strField(body, "alias");
      const row = variety.aliases.find((a) => a.alias === alias);
      if (!row) {
        reject(send, 404, "alias_not_found", `'${alias}' is not another name for this variety`);
        return true;
      }
      // RA-1, enforced here: decision aliases are never removable.
      if (row.source === "duplicate_decision") {
        reject(send, 403, "alias_protected", "Names added from a duplicate decision stay on the variety — they keep a decided duplicate out of the queue.");
        return true;
      }
      variety.aliases = variety.aliases.filter((a) => a.alias !== alias);
      send(200, ok({ status: "alias_removed", alias, revalidate: [`/variety/${variety.slug}`] }));
      return true;
    }
    if (action === "variety_remove") {
      if (variety.deletedAt) {
        send(200, ok({ status: "variety_removed", already_removed: true, revalidate: [] }));
        return true;
      }
      // Resolution 3: blocked while live listings exist — the count named.
      if (variety.liveListings > 0) {
        const n = variety.liveListings;
        reject(send, 409, "variety_has_listings", `this variety still has ${n} live ${n === 1 ? "listing" : "listings"} — retire ${n === 1 ? "it" : "them"} before removing the variety`);
        return true;
      }
      variety.deletedAt = state.admin.now;
      send(200, ok({ status: "variety_removed", name: variety.name, already_removed: false, revalidate: [`/variety/${variety.slug}`] }));
      return true;
    }
    reject(send, 400, "unknown_action", "Unknown variety action.");
    return true;
  }

  if (path === "/api/internal/admin/listings/actions") {
    record(state, "admin:listingActions", body);
    const mode = modeReject(state, "listingActions");
    if (mode) {
      reject(send, mode.status, mode.code, mode.detail);
      return true;
    }
    const admin = gateAdmin(session);
    if (admin) {
      reject(send, admin.status, admin.code, admin.detail);
      return true;
    }
    const action = strField(body, "action");
    const id = typeof body.listing === "number" ? body.listing : Number(strField(body, "listing"));
    const listing = state.admin.listings.find((l) => l.id === id);
    if (!action || !listing) {
      reject(send, 404, "listing_not_found", action ? "listing not found" : "Unknown listing action.");
      return true;
    }
    if (action === "retire") {
      if (listing.status === "removed") {
        // Idempotent: the second call is a no-op success writing nothing.
        send(200, ok({ status: "retired", already_removed: true, revalidate: [] }));
        return true;
      }
      const reason = strField(body, "reason");
      if (!reason) {
        reject(send, 422, "invalid_fields", "reason: choose a reason.");
        return true;
      }
      const note = strField(body, "note");
      listing.status = "removed";
      listing.history.push({ event: "gone", at: state.admin.now, actor: session!.account.name, reason: note ? `${reason} — ${note}` : reason });
      send(200, ok({ status: "retired", variety_name: listing.varietyName, already_removed: false, revalidate: [`/variety/${listing.varietySlug}`] }));
      return true;
    }
    if (action === "restore") {
      if (listing.status !== "removed") {
        send(200, ok({ status: "restore_skipped", revalidate: [] }));
        return true;
      }
      listing.status = "published";
      listing.history.push({ event: "restored", at: state.admin.now, actor: session!.account.name, reason: null });
      send(200, ok({ status: "restored", restored: true, variety_name: listing.varietyName, revalidate: [`/variety/${listing.varietySlug}`] }));
      return true;
    }
    reject(send, 400, "unknown_action", "Unknown listing action.");
    return true;
  }

  if (path === "/api/internal/admin/accounts/actions") {
    record(state, "admin:accountActions", body);
    const mode = modeReject(state, "accountActions");
    if (mode) {
      reject(send, mode.status, mode.code, mode.detail);
      return true;
    }
    if (!session || session.account.role !== "admin") {
      reject(send, 403, "forbidden", session?.account.role === "reviewer" ? "Your reviewer role doesn't include account settings." : "This account doesn't have admin access.");
      return true;
    }
    const action = strField(body, "action");
    const id = typeof body.account === "number" ? body.account : Number(strField(body, "account"));
    const target = state.admin.accounts.find((a) => a.id === id);
    if (!action || !target) {
      reject(send, 404, "account_not_found", action ? "account not found" : "Unknown account action.");
      return true;
    }
    if (action === "role_save") {
      const role = strField(body, "role");
      if (role !== "admin" && role !== "reviewer" && role !== "visitor") {
        reject(send, 422, "invalid_fields", "role: choose Admin, Reviewer, or Visitor.");
        return true;
      }
      if (target.id === session.account.id) {
        reject(send, 403, "self_role_change", "You can't change your own role.");
        return true;
      }
      if (target.role === role) {
        send(200, ok({ status: "role_unchanged", revalidate: [] }));
        return true;
      }
      if (target.role === "admin" && state.admin.accounts.filter((a) => a.role === "admin").length <= 1) {
        reject(send, 409, "last_admin", `${target.name} is the last admin. Give someone else the admin role before removing theirs.`);
        return true;
      }
      const fromRole = target.role;
      target.role = role as AdminAccountFixture["role"];
      send(200, ok({ status: "role_changed", name: target.name, from_role: fromRole, to_role: role, revalidate: [] }));
      return true;
    }
    if (action === "farm_grant") {
      const seller = state.admin.sellers.find((s) => s.slug === strField(body, "seller"));
      if (!seller) {
        reject(send, 404, "seller_not_found", `seller ${strField(body, "seller")} not found`);
        return true;
      }
      if (target.isFarmOwner && target.sellerId === seller.id) {
        send(200, ok({ status: "farm_unchanged", revalidate: [] }));
        return true;
      }
      target.isFarmOwner = true;
      target.sellerId = seller.id;
      send(200, ok({ status: "farm_granted", name: target.name, seller: seller.name, sellerSlug: seller.slug, revalidate: [] }));
      return true;
    }
    if (action === "farm_revoke") {
      if (!target.isFarmOwner) {
        send(200, ok({ status: "farm_unchanged", revalidate: [] }));
        return true;
      }
      target.isFarmOwner = false;
      send(200, ok({ status: "farm_revoked", name: target.name, revalidate: [] }));
      return true;
    }
    reject(send, 400, "unknown_action", "Unknown account action.");
    return true;
  }

  return false;
}
