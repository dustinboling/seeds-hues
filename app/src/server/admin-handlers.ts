/**
 * The app server's admin handlers: session-authorized behavior carried
 * over from v2's /admin route handlers (sign-in request/verify/sign-out,
 * review/decide, the per-section actions). Each handler accepts native
 * form posts (303 back with the status wording, v2's behavior) AND the
 * SPA's JSON posts (v2's sheet-JSON vocabulary: {ok, redirect} /
 * {ok:false, message}), resolves the admin session server-side, enforces
 * the role, forwards to the admin service, and returns the revalidate
 * paths the server purges (data cache + edge, v2's revalidatePath).
 *
 * Pure request/response mapping over an injected service 〈fetch〉 — the
 * Node harness and the Worker mount the same functions (Slice 9 carry).
 * Sessions expire absolutely (7 days) and die on sign-out or revocation
 * ONLY — deliberately no idle timeout (Dustin's ruling 2026-11-23).
 */
import { composeReason, QUEUE_WINDOW, queueDef, type QueueKey } from "../lib/admin/review";
import { SELLER_FIELD_LABELS } from "../lib/admin/sellers";
import { safeAdminNext } from "../lib/admin/auth";

export interface AdminViewer {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface AdminMe {
  signedIn: boolean;
  user: AdminViewer | null;
  expired: boolean;
  email: string | null;
}

export type ServiceFetch = (path: string, init: { method: "GET" | "POST"; cookie?: string; body?: unknown }) => Promise<{ status: number; json: Record<string, unknown>; setCookie: string | null }>;

export type HandlerResult =
  | { kind: "redirect"; location: string; setCookie?: string; revalidate: string[] }
  | { kind: "json"; status: number; body: Record<string, unknown>; setCookie?: string; revalidate: string[] }
  | { kind: "html"; status: number; body: string; revalidate: string[] };

export async function fetchMe(serviceFetch: ServiceFetch, cookie?: string): Promise<AdminMe> {
  try {
    const r = await serviceFetch("/api/internal/admin/me", { method: "GET", cookie });
    const data = (r.json.data ?? {}) as { signed_in?: boolean; user?: AdminViewer; expired?: boolean; email?: string };
    if (data.signed_in && data.user) return { signedIn: true, user: data.user, expired: false, email: null };
    return { signedIn: false, user: null, expired: data.expired === true, email: typeof data.email === "string" ? data.email : null };
  } catch {
    return { signedIn: false, user: null, expired: false, email: null };
  }
}

const isPrivileged = (role: string): boolean => role === "admin" || role === "reviewer";

function textOf(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function intId(v: unknown): number | null {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v : null;
  if (!s || !/^\d{1,12}$/.test(s.trim())) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

function signedOutJson(deepNext: string): Record<string, unknown> {
  return { ok: false, code: "signed_out", message: "Your admin session ended. Sign in again to pick up where you left off.", signin: `/admin/sign-in?next=${encodeURIComponent(deepNext)}` };
}

function forbiddenPage(back: string, message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not included | Seed Directory admin</title></head><body><main><h1>Not included in your role</h1><p>${message}</p><p><a href="${back}">Back</a></p></main></body></html>`;
}

/* ── Sign-in ── */

const SIGNIN_ERRORS: Record<string, string> = {
  send_failed: "We couldn’t send the email — check the address and try again.",
  missing_email: "Enter your email address.",
  resend_too_soon: "A code was just sent — please wait a minute before asking for another.",
  resend_limit: "That’s the most codes we can send in an hour — please try again later.",
};

export async function handleSignInRequest(serviceFetch: ServiceFetch, input: { raw: Record<string, unknown>; wantsJson: boolean }): Promise<HandlerResult> {
  const email = String(input.raw.email ?? "").trim();
  const next = safeAdminNext(input.raw.next) ?? "/admin";
  const resend = input.raw.resend === "1" || input.raw.resend === true;
  if (!email || !email.includes("@")) {
    if (input.wantsJson) return { kind: "json", status: 400, body: { ok: false, message: SIGNIN_ERRORS.missing_email }, revalidate: [] };
    const params = new URLSearchParams({ error: "missing_email", next });
    if (email) params.set("email", email);
    return { kind: "redirect", location: `/admin/sign-in?${params.toString()}`, revalidate: [] };
  }
  const r = await serviceFetch("/api/internal/admin/sign-in/request", { method: "POST", body: { email } });
  const delivery = ((r.json.data ?? {}) as { delivery?: string }).delivery;
  if (r.status === 200 && delivery === "sent") {
    const params = new URLSearchParams({ email, next });
    if (resend) params.set("sent", "1");
    const to = `/admin/sign-in/code?${params.toString()}`;
    if (input.wantsJson) return { kind: "json", status: 200, body: { ok: true, redirect: to }, revalidate: [] };
    return { kind: "redirect", location: to, revalidate: [] };
  }
  const code = typeof r.json.code === "string" ? r.json.code : "send_failed";
  if (code === "resend_too_soon" || code === "resend_limit") {
    const message = SIGNIN_ERRORS[code]!;
    if (input.wantsJson) return { kind: "json", status: 429, body: { ok: false, message }, revalidate: [] };
    return { kind: "redirect", location: `/admin/sign-in/code?${new URLSearchParams({ email, next, error: code }).toString()}`, revalidate: [] };
  }
  if (input.wantsJson) return { kind: "json", status: 400, body: { ok: false, message: SIGNIN_ERRORS.send_failed }, revalidate: [] };
  return { kind: "redirect", location: `/admin/sign-in?${new URLSearchParams({ error: "send_failed", email, next }).toString()}`, revalidate: [] };
}

const CODE_MESSAGES: Record<string, string> = {
  no_code: "There’s no active code for this email — send a new one.",
  code_expired: "That code has expired. Send a new code.",
  code_dead: "Too many wrong tries — that code no longer works. Send a new code to try again.",
  code_incorrect: "That code doesn’t match. Check the email and try again.",
};

export async function handleSignInVerify(serviceFetch: ServiceFetch, input: { raw: Record<string, unknown>; wantsJson: boolean }): Promise<HandlerResult> {
  const email = String(input.raw.email ?? "").trim();
  const code = String(input.raw.code ?? "").trim();
  const next = safeAdminNext(input.raw.next) ?? "/admin";
  if (!email) {
    if (input.wantsJson) return { kind: "json", status: 400, body: { ok: false, message: "Enter your email address." }, revalidate: [] };
    return { kind: "redirect", location: `/admin/sign-in?next=${encodeURIComponent(next)}`, revalidate: [] };
  }
  if (!code) {
    if (input.wantsJson) return { kind: "json", status: 400, body: { ok: false, message: "Enter the 6-digit code." }, revalidate: [] };
    return { kind: "redirect", location: `/admin/sign-in/code?${new URLSearchParams({ email, next, error: "missing_code" }).toString()}`, revalidate: [] };
  }
  const r = await serviceFetch("/api/internal/admin/sign-in/verify", { method: "POST", body: { email, code } });
  if (r.status === 200) {
    if (input.wantsJson) return { kind: "json", status: 200, body: { ok: true, redirect: next }, setCookie: r.setCookie ?? undefined, revalidate: [] };
    return { kind: "redirect", location: next, setCookie: r.setCookie ?? undefined, revalidate: [] };
  }
  const errCode = typeof r.json.code === "string" ? r.json.code : "code_incorrect";
  if (errCode === "no_role") {
    const data = (r.json.data ?? {}) as { name?: string; email?: string };
    const params = new URLSearchParams({ name: data.name ?? email, email: data.email ?? email });
    if (input.wantsJson) return { kind: "json", status: 403, body: { ok: false, code: "no_role", message: "This account doesn't have admin access.", redirect: `/admin/no-access?${params.toString()}` }, revalidate: [] };
    return { kind: "redirect", location: `/admin/no-access?${params.toString()}`, revalidate: [] };
  }
  const message = CODE_MESSAGES[errCode] ?? "That code doesn’t match. Check the email and try again.";
  const status = errCode === "code_incorrect" ? 400 : r.status >= 400 ? r.status : 400;
  if (input.wantsJson) return { kind: "json", status, body: { ok: false, code: errCode, message }, revalidate: [] };
  const params = new URLSearchParams({ email, next, error: errCode });
  return { kind: "redirect", location: `/admin/sign-in/code?${params.toString()}`, revalidate: [] };
}

export async function handleSignOut(serviceFetch: ServiceFetch, cookie?: string): Promise<HandlerResult> {
  const r = await serviceFetch("/api/internal/admin/sign-out", { method: "POST", cookie, body: {} });
  return { kind: "redirect", location: "/admin/sign-in?signedout=1", setCookie: r.setCookie ?? undefined, revalidate: [] };
}

/* ── Review decide ── */

function queueParam(v: unknown): QueueKey {
  return queueDef(typeof v === "string" ? v : "")?.key ?? "duplicates";
}

function showParam(v: unknown): number {
  const n = intId(typeof v === "number" ? String(v) : typeof v === "string" ? v : null) ?? QUEUE_WINDOW;
  return Math.min(200, Math.max(QUEUE_WINDOW, Math.ceil(n / QUEUE_WINDOW) * QUEUE_WINDOW));
}

function decideBackTo(queue: QueueKey, show: number, extra: Record<string, string | null>): string {
  const params = new URLSearchParams({ queue, show: String(show) });
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  return `/admin/review?${params.toString()}`;
}

const DECIDE_LABELS: Record<string, string> = {
  candidate_declined: "item_name",
  farm_declined: "item_name",
  published: "variety_name",
  duplicate_kept: "candidate_name",
  variety_added: "held_name",
  correction_applied: "seller_name",
  removal_applied: "seller_name",
  listing_retired: "variety_name",
};

export async function handleDecide(serviceFetch: ServiceFetch, input: { raw: Record<string, unknown>; wantsJson: boolean; cookie?: string }): Promise<HandlerResult> {
  const raw = input.raw;
  const action = textOf(raw.action);
  const queue = queueParam(raw.queue);
  const show = showParam(raw.show);
  const kind = textOf(raw.kind);
  const id = intId(raw.id);
  const createdAt = textOf(raw.created_at);
  const failed = decideBackTo(queue, show, { ...(kind && id ? { item: `${kind}-${id}` } : {}), status: "failed" });

  const me = await fetchMe(serviceFetch, input.cookie);
  const deepNext = decideBackTo(queue, show, { ...(kind && id ? { item: `${kind}-${id}` } : {}) });
  if (!me.signedIn || !me.user) {
    if (input.wantsJson) return { kind: "json", status: 401, body: signedOutJson(deepNext), revalidate: [] };
    return { kind: "redirect", location: `/admin/sign-in?next=${encodeURIComponent(deepNext)}`, revalidate: [] };
  }
  if (!isPrivileged(me.user.role)) {
    if (input.wantsJson) return { kind: "json", status: 403, body: { ok: false, message: "This account doesn't have admin access." }, revalidate: [] };
    return { kind: "redirect", location: "/admin/no-access", revalidate: [] };
  }
  if (!action || (kind !== "review" && kind !== "farm") || !id) {
    if (input.wantsJson) return { kind: "json", status: 400, body: { ok: false, message: "Unknown decision." }, revalidate: [] };
    return { kind: "redirect", location: failed, revalidate: [] };
  }
  const after = createdAt && /^\d{4}-\d{2}-\d{2}/.test(createdAt) ? `${createdAt}~${kind}~${id}` : null;
  const done = (extra: Record<string, string | null>) => decideBackTo(queue, show, { ...(after ? { after } : {}), ...extra });
  // The sheet's select + note compose into the one stored reason (v2's
  // composeReason) — the service records exactly this string.
  const sheetReason = composeReason(textOf(raw.reason_select), textOf(raw.reason_note));
  // Verbatim forwarding (BusyForm): queue/show ride only when the caller
  // sent them — the service never needs the redirect's normalized pair.
  const forwarded: Record<string, unknown> = { action, kind, id };
  if (raw.queue !== undefined) forwarded.queue = queue;
  if (raw.show !== undefined) forwarded.show = String(show);
  if (createdAt) forwarded.created_at = createdAt;
  const directReason = textOf(raw.reason);
  if (sheetReason) forwarded.reason = sheetReason;
  else if (directReason) forwarded.reason = directReason;
  for (const key of ["listing_id", "item_name", "variety_name", "candidate_name", "held_name", "seller_name"] as const) {
    const v = raw[key];
    if (typeof v === "string" && v) forwarded[key] = key === "listing_id" ? Number(v) || v : v;
    else if (typeof v === "number") forwarded[key] = v;
  }

  const r = await serviceFetch("/api/internal/admin/review/decide", { method: "POST", cookie: input.cookie, body: forwarded });
  const data = (r.json.data ?? {}) as Record<string, unknown>;
  const revalidate = Array.isArray(data.revalidate) ? (data.revalidate as string[]) : [];
  if (r.status === 200 && typeof data.status === "string") {
    const status = data.status;
    const labelKey = DECIDE_LABELS[status];
    const label = labelKey ? textOf(raw[labelKey]) : null;
    const extra: Record<string, string | null> = { status };
    if (status === "published") extra.variety = typeof data.variety === "string" ? data.variety : label;
    if (status === "duplicate_kept") extra.existing = typeof data.existing === "string" ? data.existing : label;
    if (status === "variety_added") extra.held = typeof data.held === "string" ? data.held : label;
    if (status === "correction_applied" || status === "removal_applied") extra.seller = typeof data.seller === "string" ? data.seller : label;
    if (status === "listing_retired") extra.variety = typeof data.variety === "string" ? data.variety : label;
    if (status === "candidate_declined" || status === "farm_declined") extra.name = typeof data.name === "string" ? data.name : label;
    const to = done(extra);
    if (input.wantsJson) return { kind: "json", status: 200, body: { ok: true, redirect: to }, revalidate };
    return { kind: "redirect", location: to, revalidate };
  }
  const code = typeof r.json.code === "string" ? r.json.code : "failed";
  if (code === "already_resolved") {
    const to = done({ status: "already_decided" });
    if (input.wantsJson) return { kind: "json", status: 409, body: { ok: false, code, message: "That one was already decided.", redirect: to }, revalidate: [] };
    return { kind: "redirect", location: to, revalidate };
  }
  if (code === "variety_changed") {
    const to = decideBackTo(queue, show, { item: `${kind}-${id}`, status: "stale_candidate" });
    if (input.wantsJson) return { kind: "json", status: 409, body: { ok: false, code, message: "That variety changed while you were deciding.", redirect: to }, revalidate: [] };
    return { kind: "redirect", location: to, revalidate };
  }
  if (r.status === 403) {
    if (input.wantsJson) return { kind: "json", status: 403, body: { ok: false, message: "Your reviewer role doesn't include that action." }, revalidate: [] };
    return { kind: "html", status: 403, body: forbiddenPage(decideBackTo(queue, show, {}), "Your reviewer role doesn't include that action."), revalidate: [] };
  }
  const detail = typeof r.json.detail === "string" ? r.json.detail : "That didn't go through. Try again.";
  if (input.wantsJson) return { kind: "json", status: r.status >= 400 ? r.status : 400, body: { ok: false, code, message: detail }, revalidate: [] };
  return { kind: "redirect", location: failed, revalidate };
}

/* ── Section actions ── */

interface SectionCtx {
  ref: string | null;
  params: Record<string, string | null>;
}

function readCtx(raw: Record<string, unknown>, refKey: string, extraKeys: string[]): SectionCtx {
  const ref = typeof raw[refKey] === "string" && (raw[refKey] as string).trim() ? (raw[refKey] as string).trim().slice(0, 160) : typeof raw[refKey] === "number" ? String(raw[refKey]) : null;
  const params: Record<string, string | null> = {};
  for (const key of extraKeys) {
    const v = raw[key];
    params[key] = typeof v === "string" && v.trim() ? v.trim().slice(0, 160) : null;
  }
  return { ref, params };
}

function sectionBackTo(base: string, ctx: SectionCtx, refKey: string | null, extra: Record<string, string | null>, hash = ""): string {
  const params = new URLSearchParams();
  if (refKey && ctx.ref) params.set(refKey, ctx.ref);
  for (const [k, v] of Object.entries(ctx.params)) if (v) params.set(k, v);
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  const query = params.toString();
  return `${base}${query ? `?${query}` : ""}${hash}`;
}

const SECTION_FRIENDLY: Record<string, Record<string, string>> = {
  sellers: {
    seller_not_found: "That seller is gone.",
    seller_removed: "That seller was removed from the directory.",
    invalid_fields: "Some fields need attention before saving.",
    description_rejected: "That About text can't be published: it contains a price or working notes. Remove those and save again.",
  },
  varieties: {
    variety_not_found: "That variety is gone.",
    alias_not_found: "That name is gone.",
    alias_protected: "Names added from a duplicate decision stay on the variety.",
    invalid_fields: "Something needs attention before continuing.",
  },
  listings: {
    listing_not_found: "That listing is gone.",
    invalid_fields: "Something needs attention before continuing.",
  },
  accounts: {
    account_not_found: "That account is gone.",
    seller_not_found: "That seller is gone.",
    self_role_change: "You can't change your own role.",
    last_admin: "That account is the last admin — give someone else the admin role first.",
    invalid_fields: "Something needs attention before continuing.",
  },
};

const SECTION_FALLBACK = "That didn't go through. Nothing was changed — try again.";

export type AdminSection = "sellers" | "varieties" | "listings" | "accounts";

const SECTION_BASE: Record<AdminSection, string> = {
  sellers: "/admin/sellers",
  varieties: "/admin/varieties",
  listings: "/admin/listings",
  accounts: "/admin/accounts",
};

const SECTION_SERVICE: Record<AdminSection, string> = {
  sellers: "/api/internal/admin/sellers/actions",
  varieties: "/api/internal/admin/varieties/actions",
  listings: "/api/internal/admin/listings/actions",
  accounts: "/api/internal/admin/accounts/actions",
};

export async function handleSectionActions(serviceFetch: ServiceFetch, section: AdminSection, input: { raw: Record<string, unknown>; wantsJson: boolean; cookie?: string }): Promise<HandlerResult> {
  const raw = input.raw;
  const action = textOf(raw.action);
  const refKey = section === "sellers" ? "seller" : section === "varieties" ? "variety" : section === "listings" ? "listing" : "account";
  const ctxKeys = section === "sellers" ? ["q", "badge", "state", "sort"] : section === "varieties" ? ["tab", "q", "crop", "show"] : section === "listings" ? ["q", "chip", "seller", "variety", "show"] : ["q", "show"];
  const ctx = readCtx(raw, refKey, ctxKeys);
  const backTo = (c: SectionCtx, extra: Record<string, string | null>, hash = "") => sectionBackTo(SECTION_BASE[section], c, refKey, extra, hash);
  const failed = backTo(ctx, { status: "save_failed" });
  const friendly = SECTION_FRIENDLY[section]!;

  const me = await fetchMe(serviceFetch, input.cookie);
  const deepNext = backTo(ctx, {});
  if (!me.signedIn || !me.user) {
    if (input.wantsJson) return { kind: "json", status: 401, body: signedOutJson(deepNext), revalidate: [] };
    return { kind: "redirect", location: `/admin/sign-in?next=${encodeURIComponent(deepNext)}`, revalidate: [] };
  }
  const adminOnly = section === "accounts";
  if (adminOnly ? me.user.role !== "admin" : !isPrivileged(me.user.role)) {
    const message = me.user.role === "reviewer" && adminOnly ? "Your reviewer role doesn't include account settings." : me.user.role === "reviewer" ? "Your reviewer role doesn't include that action." : "This account doesn't have admin access.";
    if (input.wantsJson) return { kind: "json", status: 403, body: { ok: false, message }, revalidate: [] };
    return me.user.role === "reviewer" && adminOnly
      ? { kind: "html", status: 403, body: forbiddenPage("/admin", message), revalidate: [] }
      : { kind: "redirect", location: "/admin/no-access", revalidate: [] };
  }
  if (!action || !ctx.ref) {
    if (input.wantsJson) return { kind: "json", status: 400, body: { ok: false, message: SECTION_FALLBACK }, revalidate: [] };
    return { kind: "redirect", location: failed, revalidate: [] };
  }
  const done = (extra: Record<string, string | null>, hash = "") => backTo(ctx, extra, hash);

  const forwarded: Record<string, unknown> = { ...raw, action, [refKey]: refKey === "listing" || refKey === "account" ? (Number(ctx.ref) || ctx.ref) : ctx.ref };
  const r = await serviceFetch(SECTION_SERVICE[section], { method: "POST", cookie: input.cookie, body: forwarded });
  const data = (r.json.data ?? {}) as Record<string, unknown>;
  const revalidate = Array.isArray(data.revalidate) ? (data.revalidate as string[]) : [];
  if (r.status === 200 && typeof data.status === "string") {
    const to = await successRedirect(serviceFetch, section, ctx, data, done, backTo, input.cookie);
    if (input.wantsJson) return { kind: "json", status: 200, body: { ok: true, redirect: to }, revalidate };
    return { kind: "redirect", location: to, revalidate };
  }
  const code = typeof r.json.code === "string" ? r.json.code : "failed";
  if (r.status === 403) {
    const message = code === "alias_protected" || code === "self_role_change" || code === "last_admin" ? (friendly[code] ?? SECTION_FALLBACK) : me.user.role === "reviewer" && section !== "accounts" ? "Your reviewer role doesn't include that action." : (friendly[code] ?? SECTION_FALLBACK);
    if (input.wantsJson) return { kind: "json", status: 403, body: { ok: false, message }, revalidate: [] };
    return { kind: "html", status: 403, body: forbiddenPage(backTo(ctx, {}), message), revalidate: [] };
  }
  // variety_has_listings passes the service detail through: it names the
  // live-listing count — the API contract the block enforces (v2's UI
  // line softens it, but the count is the load-bearing fact).
  const message = code === "variety_has_listings" && typeof r.json.detail === "string" ? r.json.detail : (friendly[code] ?? SECTION_FALLBACK);
  if (input.wantsJson) return { kind: "json", status: r.status >= 400 ? r.status : 400, body: { ok: false, code, message }, revalidate: [] };
  return { kind: "redirect", location: failed, revalidate };
}

/** Success → the v2 status redirect (form and JSON share it). */
async function successRedirect(
  serviceFetch: ServiceFetch,
  section: AdminSection,
  ctx: SectionCtx,
  data: Record<string, unknown>,
  done: (extra: Record<string, string | null>, hash?: string) => string,
  backTo: (c: SectionCtx, extra: Record<string, string | null>, hash?: string) => string,
  cookie?: string,
): Promise<string> {
  const status = data.status as string;
  switch (section) {
    case "sellers": {
      if (status === "seller_updated") {
        const changed = Array.isArray(data.changed) ? (data.changed as string[]).filter((f): f is keyof typeof SELLER_FIELD_LABELS => typeof f === "string" && f in SELLER_FIELD_LABELS) : [];
        let extra: Record<string, string | null> = { updated: changed.join(",") || null };
        // A single changed field names its new value, read back off the
        // saved record — honest (v2's read-back).
        if (changed.length === 1 && ctx.ref) {
          try {
            const detail = await serviceFetch(`/api/internal/admin/sellers/${ctx.ref}`, { method: "GET", cookie });
            const value = ((detail.json.data ?? {}) as Record<string, unknown>)[changed[0]!];
            if (typeof value === "string" && value.trim() && value.length <= 160) extra = { ...extra, updated_to: value };
          } catch {
            // The save succeeded; the naming is decoration — drop it loudly never.
          }
        }
        return done(extra, "#info");
      }
      if (status === "classified") {
        const small = data.is_small_farm === true;
        return done({ classified: small ? "small" : "not", ...(typeof data.published === "string" && data.published ? { published: "1" } : {}) }, "#classification");
      }
      if (status === "note_added") return done({ status: "note_added" }, "#notes");
      if (status === "reactivated") return done({ status: "reactivated" });
      if (status === "deactivated") return done({});
      if (status === "removed") return backTo({ ...ctx, ref: null }, { status: "removed", ...(typeof data.name === "string" ? { name: data.name } : {}) });
      return done({ status: "save_failed" });
    }
    case "varieties": {
      if (status === "alias_added") return done({ status: "alias_added", ...(typeof data.alias === "string" ? { name: data.alias } : {}) }, "#names");
      if (status === "alias_removed") return done({ status: "alias_removed", ...(typeof data.alias === "string" ? { name: data.alias } : {}) }, "#names");
      if (status === "variety_removed") return backTo({ ...ctx, ref: null }, { status: "variety_removed", ...(typeof data.name === "string" ? { name: data.name } : {}) });
      return done({ status: "save_failed" });
    }
    case "listings": {
      const variety: Record<string, string | null> = typeof data.variety_name === "string" ? { variety_name: data.variety_name } : {};
      if (status === "retired") return done({ status: "retired", ...variety });
      if (status === "restored") return done({ status: data.restored === true ? "restored" : "restore_skipped", ...variety });
      if (status === "restore_skipped") return done({ status: "restore_skipped", ...variety });
      return done({ status: "save_failed" });
    }
    case "accounts": {
      if (status === "role_changed") return done({ status: "role_changed", ...(typeof data.name === "string" ? { name: data.name } : {}), ...(typeof data.to_role === "string" ? { role: data.to_role } : {}) }, "#role");
      if (status === "role_unchanged") return done({ status: "role_unchanged" }, "#role");
      if (status === "farm_granted") return done({ status: "farm_granted", ...(typeof data.name === "string" ? { name: data.name } : {}), ...(typeof data.seller === "string" ? { seller: data.seller } : {}) }, "#farm");
      if (status === "farm_revoked" || status === "farm_unchanged") return done({ status: status === "farm_revoked" ? "farm_revoked" : "role_unchanged" }, "#farm");
      return done({ status: "save_failed" });
    }
  }
}

/* ── Page gate (the +data hooks' guard) ── */

export type GateResult = { kind: "pass"; viewer: AdminViewer } | { kind: "redirect"; location: string };

/** Protected surfaces: no session → sign-in (expired → the A3 welcome back); visitor → no-access. */
export function gateProtected(me: AdminMe, returnTo: string): GateResult {
  if (!me.signedIn || !me.user) {
    const params = new URLSearchParams({ next: safeAdminNext(returnTo) ?? "/admin" });
    if (me.expired && me.email) {
      params.set("expired", "1");
      params.set("email", me.email);
    }
    return { kind: "redirect", location: `/admin/sign-in?${params.toString()}` };
  }
  if (!isPrivileged(me.user.role)) return { kind: "redirect", location: "/admin/no-access" };
  return { kind: "pass", viewer: me.user };
}

/** Sign-in flow: a live privileged session skips to the return path. */
export function gateSignIn(me: AdminMe, next: string): GateResult | { kind: "show" } {
  if (me.signedIn && me.user && isPrivileged(me.user.role)) return { kind: "redirect", location: next };
  return { kind: "show" };
}

/** No-access: privileged strays home; a bare visit signs in first. */
export function gateNoAccess(me: AdminMe, email: string | null, name?: string | null): GateResult | { kind: "show"; name: string; email: string } {
  if (me.signedIn && me.user) {
    if (isPrivileged(me.user.role)) return { kind: "redirect", location: "/admin" };
    return { kind: "show", name: me.user.name, email: me.user.email };
  }
  if (!email) return { kind: "redirect", location: "/admin/sign-in" };
  return { kind: "show", name: name?.trim() ? name.trim() : email, email };
}
