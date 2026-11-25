/**
 * Slice 3 test stub: the fake catalog behind the live API's HTTP wire
 * shapes. The built app under test points SEEDS_API_BASE at this server, so
 * the contract suite drives the real SSR path (Vike renderPage over HTTP)
 * against deterministic fixture data — no network, no live catalog reads.
 *
 * Wire fidelity: list endpoints emit v2's envelope
 * ({data, page:{next_cursor,has_more}, meta:{nextCursor,count,total,
 * generated_at}, error:null}); detail endpoints emit the one() form; unknown
 * slugs 404 with a v2-shaped error body. Every response is cloned: a real
 * API returns fresh JSON per fetch, never a live reference — without this
 * the app's caches would alias the state and no test could observe
 * staleness (the invalidation proof would be vacuous).
 *
 * The stub also plays the deployment's second role: the app-internal
 * GET /api/internal/variety-status/[slug] lookup (served by the new Worker's
 * own mount in production — Slice 9) reads from the same fixture state.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { FakeCatalogState } from "../unit/fake-catalog";
import type { FormsAccountFixture, FormsMode } from "../unit/forms-fixtures";
import {
  stubSearch,
  stubSellerMatches,
  stubSortSellers,
  stubSortVarieties,
  stubVarietyMatches,
  type StubSeriesSeed,
  type StubVarietySort,
} from "./catalog-filter";
import { rederive } from "./derived";
import { decisionAliasHits, removedVarietySlugs, routeAdminGet, routeAdminPost } from "./admin-server";

const GENERATED_AT = "2026-11-24T00:00:00.000Z";

function envelope(data: unknown[], opts: { nextCursor: string | null; total: number }) {
  return {
    data,
    page: { next_cursor: opts.nextCursor, has_more: opts.nextCursor !== null },
    meta: { nextCursor: opts.nextCursor, count: data.length, total: opts.total, generated_at: GENERATED_AT },
    error: null,
  };
}

function one(data: unknown) {
  return {
    data,
    page: { next_cursor: null, has_more: false },
    meta: { nextCursor: null, count: 1, generated_at: GENERATED_AT },
    error: null,
  };
}

function notFound(what: string) {
  return { data: null, error: { code: "not_found", message: `${what} not found` } };
}

function validationError(message: string) {
  return { data: null, error: { code: "validation_error", message } };
}

/** Repeatable and/or comma-separated list param (v2's listParam vocabulary). */
function listValues(search: URLSearchParams, key: string): string[] {
  return search
    .getAll(key)
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/** v2's boolParam: true|1 → true, false|0 → false, anything else → 400. */
function boolParam(search: URLSearchParams, key: string): boolean | undefined | "invalid" {
  const raw = search.get(key);
  if (raw === null || raw === "") return undefined;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return "invalid";
}

const VARIETY_SORTS = ["name", "-name", "recently_checked", "-recently_checked", "listing_count", "-listing_count"] as const;
const SEASONS = ["cool", "warm"] as const;
const METHODS = ["direct", "trays"] as const;
const LIFE_CYCLES = ["annual", "biennial", "perennial"] as const;
const SEARCH_TYPES = ["variety", "series", "crop", "seller"] as const;

function paged(items: unknown[], search: URLSearchParams) {
  const limit = Math.max(1, Math.min(Number(search.get("limit") ?? "24") || 24, 100));
  const offset = Math.max(0, Number(search.get("cursor") ?? "0") || 0);
  const slice = items.slice(offset, offset + limit);
  const next = offset + slice.length;
  return envelope(slice, { nextCursor: next < items.length ? String(next) : null, total: items.length });
}

/* ── Slice 6: the stub backend's form/account/go/unsubscribe endpoints ──
 *
 * The stub plays the UNCHANGED v2 backend for the app's new surfaces:
 * report/farm JSON submissions, the account/session/code/waitlist JSON
 * endpoints, the Turnstile-exempt no-JS form endpoints (303-only, Ruling 9
 * fragments), the one-click unsubscribe POST, the new internal unsubscribe
 * describe mount (a Slice 9 carry — the backend has no such read today),
 * and the backend's own /go/[id] (which the app relays with the Bea m-3
 * utm_source rename and the brief's 410→404 mapping).
 *
 * Every POST is recorded verbatim in state.forms.received BEFORE its mode
 * is applied, so a rejection drive still proves the payload arrived
 * intact. Modes (state.forms.modes) tell an endpoint to accept or reject:
 * validation_error (400 with field-naming detail), rate_limited (429 —
 * a 303 error floor on the 303-only endpoints), turnstile_failed (403).
 * The exempt form endpoints never require a token however their mode is
 * set; the JSON endpoints require a non-empty turnstile_token in accept
 * mode (the server-verify round trip), except code verification (the code
 * itself is the credential) and the reads. Success and error shapes are
 * v2's ({data, meta} / {type, title, status, detail, code}).
 */

type SendJson = (status: number, body: unknown, headers?: Record<string, string>) => void;
type SendRaw = (status: number, headers: Record<string, string>, body?: string) => void;

interface PostParsed {
  json: unknown;
  form: Record<string, string> | null;
}

function readPostBody(req: IncomingMessage): Promise<PostParsed> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        const contentType = req.headers["content-type"] ?? "";
        if (contentType.includes("application/x-www-form-urlencoded")) {
          resolve({ json: null, form: Object.fromEntries(new URLSearchParams(text).entries()) });
        } else {
          resolve({ json: text.trim().length > 0 ? (JSON.parse(text) as unknown) : {}, form: null });
        }
      } catch {
        reject(new Error("bad body"));
      }
    });
    req.on("error", () => reject(new Error("bad body")));
  });
}

const SESSION_COOKIE = "sf_session";

function ok(data: unknown) {
  return { data, meta: { generated_at: GENERATED_AT } };
}

const PROBLEM_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  410: "Gone",
  422: "Unprocessable Content",
  429: "Too Many Requests",
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

function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`;
}

const clearSessionCookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

function sessionTokenOf(req: IncomingMessage): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return v.join("=") || null;
  }
  return null;
}

function accountOf(req: IncomingMessage, state: FakeCatalogState): FormsAccountFixture | null {
  const token = sessionTokenOf(req);
  if (!token) return null;
  const email = state.forms.sessions[token];
  if (!email) return null;
  return state.forms.accounts.find((a) => a.email === email && a.email !== "") ?? null;
}

function newSessionToken(state: FakeCatalogState): string {
  return `stub-session-${Object.keys(state.forms.sessions).length + 1}`;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** v2's normalizePhone (US numbers: leading 1 dropped, then NXX-NXX-XXXX). */
function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return null;
  return d;
}

function formatPhone(d: string): string {
  return /^\d{10}$/.test(d) ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d;
}

/** v2's publicUser (the signed-in owner's own view — ZIP never echoed). */
function publicUser(a: FormsAccountFixture) {
  return {
    name: a.name,
    email: a.email,
    phone: a.phone,
    phone_display: a.phoneDisplay,
    usda_zone: a.zone,
    email_verified: a.emailVerified,
    notify_opt_out: a.notifyOptOut,
    farm_owner_declared: a.farmOwnerDeclared,
    is_farm_owner: a.isFarmOwner,
    alert_phone: a.alertPhone,
    alert_phone_display: a.alertPhone ? formatPhone(a.alertPhone) : null,
    alert_phone_verified: a.alertPhoneVerified,
    sms_opt_in: a.smsOptIn,
  };
}

type FormsChannel = "email" | "sms";

/** v2's activeChannels (fixture accounts are always status active). */
function activeChannels(a: FormsAccountFixture): FormsChannel[] {
  if (a.notifyOptOut) return [];
  const out: FormsChannel[] = [];
  if (a.emailVerified) out.push("email");
  if (a.smsOptIn && a.alertPhoneVerified && a.alertPhone) out.push("sms");
  return out;
}

/** v2's heldReasons, verbatim. */
function heldReasons(a: FormsAccountFixture): string[] {
  if (activeChannels(a).length > 0) return [];
  if (a.notifyOptOut) return ["Alerts are turned off for your account — turn them back on below"];
  const r = ["Verify your email (enter the 6-digit code we emailed you)"];
  if (a.smsOptIn && !a.alertPhoneVerified) r.push("or verify your alert number for texts");
  return r;
}

const isProfileComplete = (name: string, zone: string | null): boolean => name !== "" && zone !== null;

/** The stub's alerts read, in v2's AlertItem shape (read from recorded entries). */
function alertsFor(state: FakeCatalogState, a: FormsAccountFixture) {
  const channels = activeChannels(a);
  const held = heldReasons(a);
  return state.forms.waitlists
    .filter((e) => e.email === a.email)
    .map((e) => ({
      variety: { slug: e.varietySlug, name: e.varietyName, crop: e.crop },
      joined_at: e.joinedAt,
      notified_at: e.notifiedAt,
      status: e.found
        ? {
            state: "found",
            seller: { name: e.found.sellerName, slug: e.found.sellerSlug },
            listing_id: e.found.listingId,
            seller_count: e.found.sellerCount,
            alerted: e.notifiedAt !== null,
          }
        : channels.length > 0
          ? { state: "waiting", channels }
          : { state: "held", reasons: held },
    }));
}

function varietyNameOf(state: FakeCatalogState, slug: string): { name: string; crop: string } | null {
  const detail = state.details[slug];
  if (!detail) return null;
  return { name: detail.varietyName, crop: detail.plant.commonName };
}

function joinWaitlistEntry(state: FakeCatalogState, email: string, varietySlug: string): { joined: boolean } {
  const existing = state.forms.waitlists.find((e) => e.email === email && e.varietySlug === varietySlug);
  if (existing) return { joined: false };
  const v = varietyNameOf(state, varietySlug);
  if (!v) return { joined: false };
  state.forms.waitlists.push({
    email,
    varietySlug,
    varietyName: v.name,
    crop: v.crop,
    joinedAt: "2026-11-24T00:00:00.000Z",
    notifiedAt: null,
    channels: ["email"],
    found: null,
  });
  return { joined: true };
}

/* The no-JS floor's redirect-back vocabulary (test copy of v2's
 * lib/waitlist-floor — every Location below ends with #waitlist-block,
 * Ada Ruling 9). The suite asserts these exact strings; the app relays
 * them verbatim and never composes them. */
const WAITLIST_FRAGMENT = "waitlist-block";

function floorLocation(variety: string, params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, v);
  const s = q.toString();
  return `/variety/${variety}${s ? `?${s}` : ""}#${WAITLIST_FRAGMENT}`;
}

const verifyFloor = (variety: string, cerr?: string): string => floorLocation(variety, { waitlist: "verify", cerr });
const recognizedFloor = (variety: string, email: string, cerr?: string): string =>
  floorLocation(variety, { waitlist: "recognized", email, cerr });
const activeFloor = (variety: string, channels: readonly string[]): string => {
  const csv = channels.filter((c) => c === "email" || c === "sms");
  return floorLocation(variety, { waitlist: "active", channels: csv.join(","), held: csv.length > 0 ? undefined : "1" });
};
const errorFloor = (variety: string, err: string, values: { email?: string; channel?: string; phone?: string }): string =>
  floorLocation(variety, { waitlist: "error", err, email: values.email ?? "", channel: values.channel ?? "email", phone: values.phone ?? "" });

function seeOther(sendRaw: SendRaw, location: string, setCookie?: string): void {
  sendRaw(303, { Location: location, "Cache-Control": "no-store", ...(setCookie ? { "Set-Cookie": setCookie } : {}) });
}

/** v2's withUtm with the backend's STALE utm_source (Bea m-3: the app — not the backend — ships the rename). */
function backendUtm(target: string): string {
  const u = new URL(target);
  if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", "seedfinder");
  if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", "referral");
  return u.toString();
}

function bodyRecord(parsed: PostParsed): Record<string, unknown> {
  if (parsed.form) return { ...parsed.form };
  return (parsed.json ?? {}) as Record<string, unknown>;
}

const strField = (body: Record<string, unknown>, key: string): string => (typeof body[key] === "string" ? (body[key] as string) : "");

/**
 * The mode gate for one JSON endpoint: null accepts (subject to the
 * endpoint's own checks); otherwise the rejection to send. The 303-only
 * floor endpoints do not use this — they map modes onto floors.
 */
function modeRejection(mode: FormsMode, validationDetail: string): { status: number; code: string; detail: string } | null {
  if (mode === "accept") return null;
  if (mode === "rate_limited") return { status: 429, code: "rate_limited", detail: "Too many requests" };
  if (mode === "turnstile_failed") return { status: 403, code: "turnstile_failed", detail: "Turnstile verification failed" };
  return { status: 400, code: "validation_error", detail: validationDetail };
}

function reject(send: SendJson, r: { status: number; code: string; detail: string }): void {
  send(r.status, problem(r.status, r.code, r.detail));
}

function requireToken(body: Record<string, unknown>): boolean {
  return typeof body.turnstile_token === "string" && body.turnstile_token.length > 0;
}

const ALREADY_LISTED = (name: string): string => `Good news — ${name} is already listed by a seller. Reload the page to see where to buy it.`;

export interface StubApi {
  /** Base URL, e.g. http://127.0.0.1:PORT (SEEDS_API_BASE = `${url}/api/v1`). */
  url: string;
  state: FakeCatalogState;
  close: () => Promise<void>;
}

export async function startStubApi(state: FakeCatalogState): Promise<StubApi> {
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, body: unknown, headers: Record<string, string> = {}): void => {
      const text = JSON.stringify(structuredClone(body));
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
      res.end(text);
    };
    const sendRaw = (status: number, headers: Record<string, string>, body?: string): void => {
      res.writeHead(status, headers);
      res.end(body ?? "");
    };
    try {
      const url = new URL(req.url ?? "/", "http://stub");
      const path = url.pathname;
      if (req.method === "POST") {
        // Slice 6: the form/account POSTs (JSON or form-encoded). Async arm —
        // return now; the promise below sends the one response.
        readPostBody(req).then(
          (parsed) => {
            try {
              // Slice 7: the admin service endpoints (session reads decide
              // them; the parsed body is already a record here).
              if (routeAdminPost(url, bodyRecord(parsed), req, send, state)) return;
              if (!routeFormsPost(url, parsed, req, send, sendRaw, state)) {
                send(404, { error: { code: "not_found", message: "stub has no such path" } });
              }
            } catch (error) {
              send(500, { error: { code: "stub_error", message: String(error) } });
            }
          },
          () => send(400, { error: { code: "invalid_body", message: "stub could not read the request body" } }),
        );
        return;
      }
      if (req.method !== "GET") {
        send(405, { error: { code: "method_not_allowed", message: "stub serves GET and POST only" } });
        return;
      }
      if (path === "/api/v1/crops") {
        send(200, paged(state.crops, url.searchParams));
        return;
      }
      if (path === "/api/v1/sellers") {
        const q = url.searchParams.get("q")?.trim() ?? undefined;
        if (q && q.length > 100) {
          send(400, validationError("q must be at most 100 characters"));
          return;
        }
        const smallFarm = boolParam(url.searchParams, "small_farm");
        if (smallFarm === "invalid") {
          send(400, validationError("small_farm must be true or false"));
          return;
        }
        const regions = listValues(url.searchParams, "region").map((r) => r.toUpperCase());
        const items = stubSortSellers(
          state.sellers.filter((s) => stubSellerMatches(s, { region: regions, q, smallFarmOnly: smallFarm })),
        );
        send(200, paged(items, url.searchParams));
        return;
      }
      if (path === "/api/v1/coverage") {
        send(200, envelope(state.coverage, { nextCursor: null, total: state.coverage.length }));
        return;
      }
      if (path === "/api/v1/recent") {
        const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? "6") || 6, 100));
        const items = state.recent.slice(0, limit);
        send(200, envelope(items, { nextCursor: null, total: state.recent.length }));
        return;
      }
      if (path === "/api/v1/sync/snapshot") {
        send(200, state.snapshot, { ETag: `seq-${state.snapshot.catalog_seq}` });
        return;
      }
      if (path === "/api/v1/varieties") {
        const sortRaw = url.searchParams.get("sort") ?? "name";
        if (!(VARIETY_SORTS as readonly string[]).includes(sortRaw)) {
          // Live-faithful: "availability" is deliberately NOT in VARIETY_SORTS
          // — the app sorts it read-side and must never send it.
          send(400, validationError(`sort must be one of ${VARIETY_SORTS.join(", ")}`));
          return;
        }
        const seasonRaw = url.searchParams.get("season");
        if (seasonRaw !== null && !(SEASONS as readonly string[]).includes(seasonRaw)) {
          send(400, validationError(`season has an invalid value "${seasonRaw.slice(0, 40)}"`));
          return;
        }
        const methods = listValues(url.searchParams, "method");
        if (methods.length > 10 || methods.some((m) => !(METHODS as readonly string[]).includes(m))) {
          send(400, validationError("method has an invalid value"));
          return;
        }
        const lifeCycle = listValues(url.searchParams, "life_cycle");
        if (lifeCycle.length > 10 || lifeCycle.some((b) => !(LIFE_CYCLES as readonly string[]).includes(b))) {
          send(400, validationError("life_cycle has an invalid value"));
          return;
        }
        const smallFarm = boolParam(url.searchParams, "small_farm");
        if (smallFarm === "invalid") {
          send(400, validationError("small_farm must be true or false"));
          return;
        }
        const plants = listValues(url.searchParams, "plant").concat(listValues(url.searchParams, "crop"));
        const colors = listValues(url.searchParams, "color_family");
        const smallFarmSlugs = new Set(state.smallFarmVarieties);
        // Slice 7: soft-removed varieties leave the public list (v2's
        // removeVariety — the record stays, the surface comes off).
        const removed = new Set(removedVarietySlugs(state));
        const pool = stubSortVarieties(
          state.listItems.filter((item) => !removed.has(item.slug)).filter((item) =>
            stubVarietyMatches(
              item,
              {
                plant: plants,
                season: seasonRaw ?? undefined,
                methods,
                lifeCycle,
                colorFamily: colors,
                smallFarmOnly: smallFarm || undefined,
              },
              smallFarmSlugs,
            ),
          ),
          sortRaw as StubVarietySort,
        );
        send(200, paged(pool, url.searchParams));
        return;
      }
      if (path === "/api/v1/search") {
        const q = url.searchParams.get("q") ?? "";
        const limitRaw = url.searchParams.get("limit");
        if (limitRaw !== null && !/^-?\d+$/.test(limitRaw.trim())) {
          send(400, validationError("limit must be an integer"));
          return;
        }
        const types = listValues(url.searchParams, "type");
        if (types.some((t) => !(SEARCH_TYPES as readonly string[]).includes(t))) {
          send(400, validationError("type has an invalid value"));
          return;
        }
        const seasonRaw = url.searchParams.get("season");
        if (seasonRaw !== null && !(SEASONS as readonly string[]).includes(seasonRaw)) {
          send(400, validationError(`season has an invalid value "${seasonRaw.slice(0, 40)}"`));
          return;
        }
        const methods = listValues(url.searchParams, "method");
        if (methods.some((m) => !(METHODS as readonly string[]).includes(m))) {
          send(400, validationError("method has an invalid value"));
          return;
        }
        const seasonClass =
          seasonRaw === "cool" ? "cool_season_hardy_annual" : seasonRaw === "warm" ? "warm_season_tender_annual" : undefined;
        const methodClasses = methods.map((m) => (m === "direct" ? "direct_sow" : "transplant"));
        const removedSlugs = new Set(removedVarietySlugs(state));
        const response = stubSearch(
          {
            // Slice 7: soft-removed varieties leave public search; the
            // duplicate-decision aliases below keep finding their variety.
            varieties: state.listItems.filter((item) => !removedSlugs.has(item.slug)),
            smallFarmSlugs: new Set(state.smallFarmVarieties),
            crops: state.crops,
            series: state.seriesCatalog,
            sellers: state.sellers,
          },
          q,
          {
            limit: limitRaw === null ? 10 : Number.parseInt(limitRaw, 10),
            types: types as ("variety" | "series" | "crop" | "seller")[],
            season: seasonClass,
            methods: methodClasses,
            colorFamily: listValues(url.searchParams, "color_family"),
          },
        );
        // Slice 7: duplicate-decision aliases keep turning up in search
        // (the standing duplicate ruling — the held name stays findable).
        for (const hit of decisionAliasHits(state, q)) {
          const entry = { type: "variety" as const, ...hit };
          response.results.push(entry);
          response.varieties.push(entry);
        }
        send(200, one(response));
        return;
      }
      const varietyDetail = /^\/api\/v1\/varieties\/([^/]+)$/.exec(path);
      if (varietyDetail) {
        // Slice 7: a soft-removed variety's public surface 404s (v2's
        // removeVariety — the record stays, the page comes off).
        const detail = removedVarietySlugs(state).includes(varietyDetail[1]!) ? undefined : state.details[varietyDetail[1]!];
        if (!detail) {
          send(404, notFound("variety"));
          return;
        }
        // The live API derives these at read time; the stub does the same.
        send(200, one(rederive(detail)));
        return;
      }
      const sellerDetail = /^\/api\/v1\/sellers\/([^/]+)$/.exec(path);
      if (sellerDetail) {
        const slug = sellerDetail[1]!;
        // Live-faithful: a removed seller 410s at the API (gone), like v2's
        // getSeller handler — the page resolves gone-vs-missing through the
        // seller-status lookup, below.
        if (state.removedSellers.includes(slug)) {
          send(410, { data: null, error: { code: "gone", message: "seller removed at its request" } });
          return;
        }
        const full = state.sellerDetails[slug];
        if (full) {
          send(200, one(full));
          return;
        }
        // Pre-Slice-5 fallback for old suites: the OG-subset shape.
        const seller = state.sellers.find((s) => s.slug === slug);
        if (!seller) {
          send(404, notFound("seller"));
          return;
        }
        // The OG card reads a subset of the full SellerDetail (same names).
        send(200, one({ slug: seller.slug, name: seller.name, location: seller.location, varietyCount: seller.varietyCount }));
        return;
      }
      const cropDetail = /^\/api\/v1\/crops\/([^/]+)$/.exec(path);
      if (cropDetail) {
        const crop = state.crops.find((c) => c.slug === cropDetail[1]);
        if (!crop) {
          send(404, notFound("crop"));
          return;
        }
        // Live-faithful: the resting Name A–Z window (the hub walks the
        // full set and filters/sorts read-side — the handler takes no
        // filter params). v2's shape: data is the crop with the window
        // inside, meta.total the full count.
        const extra = state.cropExtras[crop.slug] ?? {
          description: null,
          sowingNotes: null,
          life_cycle: null,
          hardiness: null,
          grower_guide: null,
          series: [],
        };
        const members = stubSortVarieties(
          state.listItems.filter((item) => item.plant.slug === crop.slug),
          "name",
        );
        const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? "24") || 24, 100));
        const offset = Math.max(0, Number(url.searchParams.get("cursor") ?? "0") || 0);
        const window = members.slice(offset, offset + limit);
        const next = offset + window.length;
        send(200, {
          data: {
            slug: crop.slug,
            commonName: crop.commonName,
            latinName: crop.latinName,
            lifeCycle: crop.lifeCycle,
            season_class: crop.season_class,
            sowing_methods: crop.sowing_methods,
            varietyCount: crop.varietyCount,
            varietiesWithSellers: crop.varietiesWithSellers,
            lastUpdated: crop.lastUpdated,
            media: crop.media,
            description: extra.description,
            sowingNotes: extra.sowingNotes,
            life_cycle: extra.life_cycle,
            hardiness: extra.hardiness,
            grower_guide: extra.grower_guide,
            series: extra.series,
            varieties: window,
          },
          page: { next_cursor: next < members.length ? String(next) : null, has_more: next < members.length },
          meta: { nextCursor: next < members.length ? String(next) : null, count: window.length, total: members.length, generated_at: GENERATED_AT },
          error: null,
        });
        return;
      }
      const seriesDetail = /^\/api\/v1\/series\/([^/]+)$/.exec(path);
      if (seriesDetail) {
        const seed: StubSeriesSeed | undefined = state.seriesCatalog.find((s) => s.slug === seriesDetail[1]);
        const crop = seed ? state.crops.find((c) => c.slug === seed.plantSlug) : undefined;
        if (!seed || !crop) {
          send(404, notFound("series"));
          return;
        }
        // The SeriesDetail's crop is the full plant ref; its variety set is
        // the pool's members in Name A–Z (honest counts, not placeholders).
        const members = stubSortVarieties(
          state.listItems.filter((item) => item.series?.slug === seed.slug),
          "name",
        );
        send(
          200,
          one({
            slug: seed.slug,
            name: seed.name,
            crop: {
              slug: crop.slug,
              commonName: crop.commonName,
              latinName: crop.latinName,
              lifeCycle: crop.lifeCycle,
              season_class: crop.season_class,
              season_source_label: null,
              sowing_methods: crop.sowing_methods,
              sowing_method_source_label: null,
            },
            varietyCount: members.length,
            varietiesWithSellers: members.filter((m) => m.listingCount > 0).length,
            varieties: members,
          }),
        );
        return;
      }
      if (path === "/api/v1/openapi.json") {
        send(200, state.openapi);
        return;
      }
      const varietyStatus = /^\/api\/internal\/variety-status\/([^/]+)$/.exec(path);
      if (varietyStatus) {
        const slug = varietyStatus[1]!;
        if (Object.hasOwn(state.details, slug)) {
          send(200, { status: "active", merged_into: null });
          return;
        }
        const target = state.merged[slug];
        if (target) {
          send(200, { status: "merged", merged_into: target });
          return;
        }
        send(200, { status: "unknown", merged_into: null });
        return;
      }
      const sellerStatus = /^\/api\/internal\/seller-status\/([^/]+)$/.exec(path);
      if (sellerStatus) {
        // v2's shipped precedent: ok (visible), gone (removed → 410), or
        // missing (→ 404). Always 200: a lookup, not a fetch. Malformed
        // slugs are missing, like the live route.
        const slug = sellerStatus[1]!;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) {
          send(200, { status: "missing" });
          return;
        }
        if (state.removedSellers.includes(slug)) {
          send(200, { status: "gone" });
          return;
        }
        if (state.sellerDetails[slug] || state.sellers.some((s) => s.slug === slug)) {
          send(200, { status: "ok" });
          return;
        }
        send(200, { status: "missing" });
        return;
      }
      // Slice 6 reads: session/alerts/waitlist status, the unsubscribe
      // describe mount, and the backend's own /go/[id].
      if (routeFormsGet(url, req, send, sendRaw, state)) return;
      // Slice 7: the admin service reads (session + role enforced inside).
      if (routeAdminGet(url, req, send, state)) return;
      send(404, { error: { code: "not_found", message: "stub has no such path" } });
    } catch (error) {
      send(500, { error: { code: "stub_error", message: String(error) } });
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("stub: could not bind an ephemeral port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    state,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

/* ── Slice 6 POST dispatch (true when the path is a forms path) ── */

function routeFormsPost(
  url: URL,
  parsed: PostParsed,
  req: IncomingMessage,
  send: SendJson,
  sendRaw: SendRaw,
  state: FakeCatalogState,
): boolean {
  const path = url.pathname;
  const body = bodyRecord(parsed);
  const record = (endpoint: string): void => {
    state.forms.received.push({ endpoint, body: structuredClone(body) });
  };

  if (path === "/api/v1/reports") {
    record("reports");
    const r = modeRejection(state.forms.modes.reports, "target_ref: a variety or seller slug; contact: enter a valid email address");
    if (r) {
      reject(send, r);
      return true;
    }
    if (!requireToken(body)) {
      reject(send, { status: 403, code: "turnstile_failed", detail: "Turnstile verification failed" });
      return true;
    }
    const n = state.forms.received.filter((e) => e.endpoint === "reports").length;
    send(201, ok({ report_id: n, review_item_id: n, status: "open", turnstile: "verified" }));
    return true;
  }

  if (path === "/api/v1/farm-submissions") {
    record("farm");
    const r = modeRejection(state.forms.modes.farm, "farm_name: enter the farm's name; website: enter a full web address starting with https://");
    if (r) {
      reject(send, r);
      return true;
    }
    if (!requireToken(body)) {
      reject(send, { status: 403, code: "turnstile_failed", detail: "Turnstile verification failed" });
      return true;
    }
    const n = state.forms.received.filter((e) => e.endpoint === "farm").length;
    send(201, ok({ id: n, status: "pending", turnstile: "verified", admin_notice: "not_configured" }));
    return true;
  }

  if (path === "/api/v1/account") {
    record("create");
    const r = modeRejection(state.forms.modes.create, "name: enter your name; zip: enter your ZIP code");
    if (r) {
      reject(send, r);
      return true;
    }
    if (!requireToken(body)) {
      reject(send, { status: 403, code: "turnstile_failed", detail: "Turnstile verification failed" });
      return true;
    }
    const email = normalizeEmail(strField(body, "email"));
    const joinVariety = strField(body, "join_variety") || null;
    const existing = state.forms.accounts.find((a) => a.email === email);
    if (existing) {
      // The recognized-contact branch (§3.2.4): a join for an existing
      // email is a 200 with no session, never a 409.
      if (!joinVariety) {
        reject(send, { status: 409, code: "email_taken", detail: "That email already has a Seed Directory account." });
        return true;
      }
      state.forms.pendingJoins[email] = joinVariety;
      send(200, ok({ recognized: true, email, delivery: "sent" }));
      return true;
    }
    const smsOptIn = body.sms_opt_in === true;
    const rawPhone = strField(body, "phone");
    const phone = rawPhone ? (normalizePhone(rawPhone) ?? rawPhone) : joinVariety && !smsOptIn ? "" : "";
    const zip = strField(body, "zip") || null;
    const account: FormsAccountFixture = {
      id: state.forms.accounts.length + 1,
      name: strField(body, "name"),
      email,
      phone,
      phoneDisplay: formatPhone(phone),
      zip,
      zone: zip ? "8b" : null,
      emailVerified: false,
      smsOptIn,
      alertPhone: phone === "" ? null : phone,
      alertPhoneVerified: false,
      notifyOptOut: false,
      farmOwnerDeclared: body.farm_owner === true,
      isFarmOwner: false,
      code: "123456",
    };
    state.forms.accounts.push(account);
    const token = newSessionToken(state);
    state.forms.sessions[token] = email;
    let waitlist: unknown = null;
    if (joinVariety) {
      const detail = state.details[joinVariety];
      if (!detail) waitlist = { variety: joinVariety, error: "variety_not_found", message: "We couldn't find that variety." };
      else if (detail.listings.length > 0) waitlist = { variety: joinVariety, error: "already_listed", message: ALREADY_LISTED(detail.varietyName) };
      else {
        const j = joinWaitlistEntry(state, email, joinVariety);
        waitlist = { variety: joinVariety, joined: j.joined, on_list: true };
      }
    }
    send(
      201,
      ok({
        user: publicUser(account),
        verification: { email: "sent", phone: smsOptIn ? "sent" : null },
        waitlist,
        next: account.farmOwnerDeclared ? "/add-your-farm" : "/account",
      }),
      { "Set-Cookie": sessionCookie(token) },
    );
    return true;
  }

  if (path === "/api/v1/account/sign-in") {
    record("signIn");
    const r = modeRejection(state.forms.modes.signIn, "email: enter a valid email address; phone: enter your phone number");
    if (r) {
      reject(send, r);
      return true;
    }
    if (!requireToken(body)) {
      reject(send, { status: 403, code: "turnstile_failed", detail: "Turnstile verification failed" });
      return true;
    }
    const email = normalizeEmail(strField(body, "email"));
    const ph = normalizePhone(strField(body, "phone")) ?? strField(body, "phone").replace(/\D/g, "");
    const user = state.forms.accounts.find((a) => a.email === email);
    if (!user || user.phone !== ph || user.phone === "") {
      reject(send, { status: 401, code: "no_match", detail: "We couldn’t find that email + phone pair" });
      return true;
    }
    const token = newSessionToken(state);
    state.forms.sessions[token] = email;
    send(200, ok({ user: publicUser(user), next: "/account" }), { "Set-Cookie": sessionCookie(token) });
    return true;
  }

  if (path === "/api/v1/account/sign-out") {
    record("signOut");
    const token = sessionTokenOf(req);
    if (token) delete state.forms.sessions[token];
    send(200, ok({ signed_out: true }), { "Set-Cookie": clearSessionCookie });
    return true;
  }

  if (path === "/api/v1/account/sign-in/code") {
    record("signInCode");
    const r = modeRejection(state.forms.modes.signInCode, "email: enter a valid email address");
    if (r) {
      reject(send, r);
      return true;
    }
    if (!requireToken(body)) {
      reject(send, { status: 403, code: "turnstile_failed", detail: "Turnstile verification failed" });
      return true;
    }
    const email = normalizeEmail(strField(body, "email"));
    const user = state.forms.accounts.find((a) => a.email === email);
    if (!user) {
      reject(send, { status: 404, code: "no_account", detail: "We couldn't find an account with that email." });
      return true;
    }
    if (user.phone !== "") {
      reject(send, { status: 409, code: "has_phone", detail: "This account has a phone number." });
      return true;
    }
    send(200, ok({ delivery: "sent" }));
    return true;
  }

  if (path === "/api/v1/account/sign-in/verify") {
    record("signInVerify");
    const r = modeRejection(state.forms.modes.signInVerify, "code: enter the 6-digit code");
    if (r) {
      reject(send, r);
      return true;
    }
    const email = normalizeEmail(strField(body, "email"));
    const user = state.forms.accounts.find((a) => a.email === email);
    if (!user) {
      reject(send, { status: 409, code: "no_code", detail: "There’s no active code — ask for a new one." });
      return true;
    }
    if (strField(body, "code") !== user.code) {
      reject(send, { status: 400, code: "code_incorrect", detail: "That code isn’t right — check it and try again. (4 tries left)" });
      return true;
    }
    if (user.phone !== "") {
      reject(send, { status: 409, code: "has_phone", detail: "This account has a phone number." });
      return true;
    }
    user.emailVerified = true;
    const token = newSessionToken(state);
    state.forms.sessions[token] = email;
    send(200, ok({ user: publicUser(user), next: "/account" }), { "Set-Cookie": sessionCookie(token) });
    return true;
  }

  if (path === "/api/v1/account/waitlist/join") {
    record("waitlistJoin");
    const user = accountOf(req, state);
    if (!user) {
      reject(send, { status: 401, code: "signed_out", detail: "Please sign in first." });
      return true;
    }
    const r = modeRejection(state.forms.modes.waitlistJoin, "variety: must be a variety slug");
    if (r) {
      reject(send, r);
      return true;
    }
    const slug = strField(body, "variety");
    const detail = state.details[slug];
    if (!detail) {
      reject(send, { status: 404, code: "variety_not_found", detail: "We couldn't find that variety." });
      return true;
    }
    if (detail.listings.length > 0) {
      reject(send, { status: 409, code: "already_listed", detail: ALREADY_LISTED(detail.varietyName) });
      return true;
    }
    const j = joinWaitlistEntry(state, user.email, slug);
    send(200, ok({ variety: slug, joined: j.joined, on_list: true, channels: activeChannels(user), held: heldReasons(user) }));
    return true;
  }

  if (path === "/api/v1/account/waitlist/verify") {
    record("waitlistVerify");
    const r = modeRejection(state.forms.modes.waitlistVerify, "code: enter the 6-digit code");
    if (r) {
      reject(send, r);
      return true;
    }
    const email = normalizeEmail(strField(body, "email"));
    const user = state.forms.accounts.find((a) => a.email === email);
    const pending = state.forms.pendingJoins[email];
    if (!user || !pending) {
      reject(send, { status: 409, code: "no_pending_join", detail: "There’s no waiting-list join waiting for that code — join the list first, then enter the new code." });
      return true;
    }
    if (strField(body, "code") !== user.code) {
      reject(send, { status: 400, code: "code_incorrect", detail: "That code isn’t right — check it and try again. (4 tries left)" });
      return true;
    }
    user.emailVerified = true;
    const j = joinWaitlistEntry(state, email, pending);
    delete state.forms.pendingJoins[email];
    const token = newSessionToken(state);
    state.forms.sessions[token] = email;
    send(
      200,
      ok({ variety: pending, joined: j.joined, on_list: true, channels: activeChannels(user), held: heldReasons(user), email_verified: true }),
      { "Set-Cookie": sessionCookie(token) },
    );
    return true;
  }

  if (path === "/api/v1/account/waitlist/code") {
    record("waitlistCode");
    const email = normalizeEmail(strField(body, "email"));
    const user = state.forms.accounts.find((a) => a.email === email);
    if (!user || !state.forms.pendingJoins[email]) {
      reject(send, { status: 409, code: "no_pending_join", detail: "There’s no waiting-list join waiting — join the list first, then enter the new code." });
      return true;
    }
    send(200, ok({ delivery: "sent" }));
    return true;
  }

  if (path === "/api/v1/account/waitlist/join-form") {
    record("joinForm");
    stubJoinForm(url, body, req, sendRaw, state);
    return true;
  }

  if (path === "/api/v1/account/waitlist/verify-form") {
    record("verifyForm");
    stubVerifyForm(body, req, sendRaw, state);
    return true;
  }

  if (path === "/api/v1/unsubscribe") {
    const token = url.searchParams.get("token") ?? "";
    record("unsubscribe");
    state.forms.received[state.forms.received.length - 1] = { endpoint: "unsubscribe", body: { token } };
    const mode = state.forms.modes.unsubscribe;
    if (mode === "rate_limited") {
      reject(send, { status: 429, code: "rate_limited", detail: "Too many requests" });
      return true;
    }
    if (mode === "validation_error" || token !== state.forms.unsubTokens.valid) {
      reject(send, { status: 400, code: "invalid_token", detail: "This unsubscribe link is not valid." });
      return true;
    }
    const scope = state.forms.unsubTokens.scope;
    const idx = state.forms.waitlists.findIndex((e) => e.varietySlug === scope.varietySlug);
    const variety = idx >= 0 ? { name: scope.varietyName, slug: scope.varietySlug } : null;
    if (idx >= 0) state.forms.waitlists.splice(idx, 1);
    if (!state.forms.unsubscribed.includes(token)) state.forms.unsubscribed.push(token);
    send(200, ok({ kind: "variety", done: true, variety }));
    return true;
  }

  return false;
}

/**
 * The no-JS plain join (v2's joinFromForm, stub-faithful): field validation
 * is REAL (email_invalid/phone_invalid floors with preserved values); the
 * mode only forces the rate_limited floor. Turnstile is NEVER consulted —
 * the §11.4 exemption is structural: even a turnstile_failed mode cannot
 * make this endpoint ask for a token. Every outcome is a 303.
 */
function stubJoinForm(url: URL, body: Record<string, unknown>, req: IncomingMessage, sendRaw: SendRaw, state: FakeCatalogState): void {
  void url;
  const varietySlug = strField(body, "variety");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(varietySlug)) {
    seeOther(sendRaw, "/");
    return;
  }
  const emailInput = strField(body, "email").trim();
  const channel = strField(body, "channel") === "sms" ? "sms" : "email";
  const phoneInput = strField(body, "phone").trim();
  const values = { email: emailInput, channel, phone: phoneInput };
  const mode = state.forms.modes.joinForm;
  if (mode === "rate_limited") {
    seeOther(sendRaw, errorFloor(varietySlug, "rate_limited", values));
    return;
  }
  if (mode === "validation_error") {
    seeOther(sendRaw, errorFloor(varietySlug, "email_invalid,phone_invalid", values));
    return;
  }
  const emailOk = EMAIL_RE.test(emailInput) && emailInput.length <= 320;
  const phone = channel === "sms" ? normalizePhone(phoneInput) : null;
  const fieldErrors: string[] = [];
  if (!emailOk) fieldErrors.push("email_invalid");
  if (channel === "sms" && !phone) fieldErrors.push("phone_invalid");
  if (fieldErrors.length > 0) {
    seeOther(sendRaw, errorFloor(varietySlug, fieldErrors.join(","), values));
    return;
  }
  const em = normalizeEmail(emailInput);
  const detail = state.details[varietySlug];
  if (!detail) {
    seeOther(sendRaw, `/variety/${varietySlug}`);
    return;
  }
  if (detail.listings.length > 0) {
    seeOther(sendRaw, errorFloor(varietySlug, "already_listed", values));
    return;
  }
  const sessionUser = accountOf(req, state);
  if (sessionUser) {
    joinWaitlistEntry(state, sessionUser.email, varietySlug);
    if (!sessionUser.emailVerified) {
      seeOther(sendRaw, verifyFloor(varietySlug));
      return;
    }
    seeOther(sendRaw, activeFloor(varietySlug, activeChannels(sessionUser)));
    return;
  }
  const existing = state.forms.accounts.find((a) => a.email === em);
  if (existing) {
    state.forms.pendingJoins[em] = varietySlug;
    seeOther(sendRaw, recognizedFloor(varietySlug, em));
    return;
  }
  const account: FormsAccountFixture = {
    id: state.forms.accounts.length + 1,
    name: "",
    email: em,
    phone: phone ?? "",
    phoneDisplay: phone ? formatPhone(phone) : "",
    zip: null,
    zone: null,
    emailVerified: false,
    smsOptIn: channel === "sms",
    alertPhone: phone,
    alertPhoneVerified: false,
    notifyOptOut: false,
    farmOwnerDeclared: false,
    isFarmOwner: false,
    code: "123456",
  };
  state.forms.accounts.push(account);
  joinWaitlistEntry(state, em, varietySlug);
  const token = newSessionToken(state);
  state.forms.sessions[token] = em;
  seeOther(sendRaw, verifyFloor(varietySlug), sessionCookie(token));
}

/** The no-JS plain code form (v2's verifyFromForm, stub-faithful). Every outcome is a 303. */
function stubVerifyForm(body: Record<string, unknown>, req: IncomingMessage, sendRaw: SendRaw, state: FakeCatalogState): void {
  const varietySlug = strField(body, "variety");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(varietySlug)) {
    seeOther(sendRaw, "/");
    return;
  }
  const digits = strField(body, "code").replace(/\s/g, "");
  const emailInput = strField(body, "email").trim();
  const sessionUser = accountOf(req, state);
  const back = (cerr: string): string =>
    sessionUser ? verifyFloor(varietySlug, cerr) : recognizedFloor(varietySlug, emailInput, cerr);
  const mode = state.forms.modes.verifyForm;
  if (mode === "rate_limited") {
    seeOther(sendRaw, errorFloor(varietySlug, "rate_limited", { email: emailInput }));
    return;
  }
  if (mode === "validation_error" || !/^\d{6}$/.test(digits)) {
    seeOther(sendRaw, back("code_invalid"));
    return;
  }
  if (sessionUser) {
    if (digits !== sessionUser.code) {
      seeOther(sendRaw, back("code_incorrect"));
      return;
    }
    sessionUser.emailVerified = true;
    seeOther(sendRaw, activeFloor(varietySlug, activeChannels(sessionUser)));
    return;
  }
  const em = normalizeEmail(emailInput);
  const user = state.forms.accounts.find((a) => a.email === em);
  if (!user) {
    seeOther(sendRaw, back("no_code"));
    return;
  }
  if (state.forms.pendingJoins[em] !== varietySlug) {
    seeOther(sendRaw, back("no_pending_join"));
    return;
  }
  if (digits !== user.code) {
    seeOther(sendRaw, back("code_incorrect"));
    return;
  }
  user.emailVerified = true;
  joinWaitlistEntry(state, em, varietySlug);
  delete state.forms.pendingJoins[em];
  const token = newSessionToken(state);
  state.forms.sessions[token] = em;
  seeOther(sendRaw, activeFloor(varietySlug, activeChannels(user)), sessionCookie(token));
}

/* ── Slice 6 GET dispatch (true when the path is a forms path) ── */

function routeFormsGet(url: URL, req: IncomingMessage, send: SendJson, sendRaw: SendRaw, state: FakeCatalogState): boolean {
  const path = url.pathname;

  if (path === "/api/v1/account/me") {
    const user = accountOf(req, state);
    send(200, ok(user ? { signed_in: true, user: publicUser(user) } : { signed_in: false }));
    return true;
  }

  if (path === "/api/v1/account/alerts") {
    const user = accountOf(req, state);
    if (!user) {
      reject(send, { status: 401, code: "signed_out", detail: "Please sign in first." });
      return true;
    }
    send(200, ok(alertsFor(state, user)));
    return true;
  }

  if (path === "/api/v1/account/waitlist") {
    const variety = url.searchParams.get("variety") ?? "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(variety)) {
      reject(send, { status: 400, code: "validation_error", detail: "variety must be a variety slug" });
      return true;
    }
    const detail = state.details[variety];
    if (!detail) {
      reject(send, { status: 404, code: "variety_not_found", detail: "We couldn't find that variety." });
      return true;
    }
    const listed = detail.listings.length > 0;
    const user = accountOf(req, state);
    if (!user) {
      send(200, ok({ signed_in: false, variety: { slug: variety, name: detail.varietyName, listed }, on_list: false, turnstile_site_key: state.forms.turnstileSiteKey }));
      return true;
    }
    const onList = state.forms.waitlists.some((e) => e.email === user.email && e.varietySlug === variety);
    send(
      200,
      ok({
        signed_in: true,
        variety: { slug: variety, name: detail.varietyName, listed },
        on_list: onList,
        user: {
          name: user.name,
          email_verified: user.emailVerified,
          sms_opt_in: user.smsOptIn,
          alert_phone_verified: user.alertPhoneVerified,
          profile_complete: isProfileComplete(user.name, user.zone),
        },
        channels: activeChannels(user),
        held: heldReasons(user),
        turnstile_site_key: state.forms.turnstileSiteKey,
      }),
    );
    return true;
  }

  if (path === "/api/internal/unsubscribe/describe") {
    const token = url.searchParams.get("token") ?? "";
    if (token !== state.forms.unsubTokens.valid) {
      reject(send, { status: 400, code: "invalid_token", detail: "This unsubscribe link is not valid." });
      return true;
    }
    const scope = state.forms.unsubTokens.scope;
    const entry = state.forms.waitlists.find((e) => e.varietySlug === scope.varietySlug);
    send(200, ok({ kind: "variety", variety: entry ? { name: scope.varietyName, slug: scope.varietySlug } : null }));
    return true;
  }

  // The backend's own /go/[id] (v2's route, stub-faithful): numeric ids
  // only, logging that never blocks the redirect, 302 with the backend's
  // stale utm_source (the app applies the m-3 rename on relay), 404 for
  // unknown/unpublished/removed listings, 410 for a removed seller.
  const go = /^\/go\/([^/]+)$/.exec(path);
  if (go) {
    const id = go[1]!;
    if (!/^\d{1,12}$/.test(id)) {
      sendRaw(404, { ...GO_HEADERS, "Content-Type": "text/plain; charset=utf-8" }, "Listing not found");
      return true;
    }
    const listing = state.forms.goListings[Number(id)];
    if (!listing || listing.status === "unpublished" || listing.status === "removed") {
      sendRaw(404, { ...GO_HEADERS, "Content-Type": "text/plain; charset=utf-8" }, "Listing not found");
      return true;
    }
    if (listing.status === "seller_removed") {
      sendRaw(410, { ...GO_HEADERS, "Content-Type": "text/plain; charset=utf-8" }, "This seller asked to be removed from the directory.");
      return true;
    }
    state.forms.clicks.push({ listingId: Number(id), at: GENERATED_AT });
    sendRaw(302, { ...GO_HEADERS, Location: backendUtm(listing.target), "Referrer-Policy": "origin" });
    return true;
  }

  return false;
}

const GO_HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
