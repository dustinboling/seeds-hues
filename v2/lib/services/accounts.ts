/**
 * Accounts + waiting lists (USER-ACCOUNTS-DESIGN §2/§2a/§4/§4a/§6, PRODUCT-DESIGN §3).
 *
 *  - Create: name + email + phone + ZIP (+ farm-owner declaration) + Turnstile → user, session,
 *    a 6-digit email code. Sign-in: email + phone pair + Turnstile → session (NO password, NO code).
 *  - Sign-in failures are rate limited from a D1 attempt log (hashed keys): 5 per 15 min per IP,
 *    and per email+phone pair a lockout that starts at 15 min and doubles with each failure past 5.
 *  - Verification gates notifications, never the account: a verified email turns on email alerts;
 *    SMS opt-in + a verified alert number turns on texts. Verifying re-runs the matcher for the
 *    user's waiting varieties, so held entries activate by themselves (no re-join).
 *  - Waiting lists: one entry per user per variety; joins only while the variety has no visible
 *    listing (first-found only at launch).
 */
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import * as repo from "@/lib/repositories/accounts";
import * as wl from "@/lib/repositories/waitlist";
import {
  SESSION_DAYS,
  SIGNIN_GENERIC_ERROR,
  SIGNIN_IP_LIMIT,
  SIGNIN_PAIR_FREE_FAILURES,
  SIGNIN_WINDOW_MINUTES,
  attemptKey,
  formatPhone,
  hashSessionToken,
  isSessionTokenShape,
  newSessionToken,
  normalizeEmail,
  normalizePhone,
  verifyUnsubscribe,
} from "@/lib/accounts";
import { lookupZone } from "@/lib/data/zones";
import { turnstileOutcome, TURNSTILE_REFUSAL, type TurnstileConfig, type TurnstileOutcome } from "@/lib/turnstile";
import { ServiceError } from "./ingest";
import { matchWaitlists } from "./waitlist-matcher";
import { VERIFY_MESSAGES, type DeliveryStatus, type VerificationService } from "./verification";

// ─── request bodies (validated at the route) ────────────────────────────────

const name = z.string().trim().min(1, "enter your name").max(120);
const email = z.email("enter a valid email address").max(320);
const phone = z.string().trim().min(7).max(32);
const zip = z.string().trim().regex(/^\d{5}$/, "enter a 5-digit US ZIP code");
const token = z.string().max(2048).optional();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160);

export const CreateAccountSchema = z.strictObject({
  name,
  email,
  phone,
  zip,
  farm_owner: z.boolean().default(false),
  sms_opt_in: z.boolean().default(false),
  /** Variety page mini-form: create the account AND join this variety's waiting list. */
  join_variety: slug.optional(),
  turnstile_token: token,
});
export const SignInSchema = z.strictObject({ email, phone, turnstile_token: token });
export const CodeSchema = z.strictObject({ code: z.string().trim().regex(/^\d{6}$/, "enter the 6-digit code") });
export const ChangeEmailSchema = z.strictObject({ email });
export const AlertPhoneSchema = z.strictObject({ alert_phone: phone.optional(), sms_opt_in: z.boolean() });
export const PreferencesSchema = z.strictObject({ notify_opt_out: z.boolean() });
export const VarietyRefSchema = z.strictObject({ variety: slug, turnstile_token: token });
export const DeleteAccountSchema = z.strictObject({ confirm: z.literal("DELETE") });

export interface AccountDeps {
  turnstile: TurnstileConfig;
  verification: VerificationService;
  unsubscribeKey: string | null;
  now?: () => Date;
}

export interface PublicUser {
  name: string;
  email: string;
  phone: string;
  phone_display: string;
  usda_zone: string | null;
  email_verified: boolean;
  notify_opt_out: boolean;
  farm_owner_declared: boolean;
  is_farm_owner: boolean;
  alert_phone: string | null;
  alert_phone_display: string | null;
  alert_phone_verified: boolean;
  sms_opt_in: boolean;
}

/** The signed-in owner's own view of their account (never public). ZIP is not echoed back. */
export function publicUser(u: repo.UserRow): PublicUser {
  return {
    name: u.name,
    email: u.email,
    phone: u.phone,
    phone_display: formatPhone(u.phone),
    usda_zone: u.usdaZone,
    email_verified: u.emailVerified,
    notify_opt_out: u.notifyOptOut,
    farm_owner_declared: u.farmOwnerDeclared,
    is_farm_owner: u.isFarmOwner,
    alert_phone: u.alertPhone,
    alert_phone_display: u.alertPhone ? formatPhone(u.alertPhone) : null,
    alert_phone_verified: u.alertPhoneVerified,
    sms_opt_in: u.smsOptIn,
  };
}

// ─── held / active (PRODUCT-DESIGN §3) ──────────────────────────────────────

export type Channel = "email" | "sms";

/** Which alert channels are switched on for this account right now. */
export function activeChannels(u: Pick<repo.UserRow, "emailVerified" | "notifyOptOut" | "smsOptIn" | "alertPhoneVerified" | "alertPhone" | "status">): Channel[] {
  if (u.status !== "active" || u.notifyOptOut) return [];
  const out: Channel[] = [];
  if (u.emailVerified) out.push("email");
  if (u.smsOptIn && u.alertPhoneVerified && u.alertPhone) out.push("sms");
  return out;
}

/** What still switches a held entry on (empty when at least one channel is active). */
export function heldReasons(u: Pick<repo.UserRow, "emailVerified" | "notifyOptOut" | "smsOptIn" | "alertPhoneVerified" | "alertPhone" | "status">): string[] {
  if (activeChannels(u).length > 0) return [];
  if (u.status !== "active") return ["This account is not active"];
  if (u.notifyOptOut) return ["Alerts are turned off for your account — turn them back on below"];
  const r = ["Verify your email (enter the 6-digit code we emailed you)"];
  if (u.smsOptIn && !u.alertPhoneVerified) r.push("or verify your alert number for texts");
  return r;
}

export type AlertStatus =
  | { state: "found"; seller: { name: string; slug: string }; listing_id: number; seller_count: number; alerted: boolean }
  | { state: "waiting"; channels: Channel[] }
  | { state: "held"; reasons: string[] };

export interface AlertItem {
  variety: { slug: string; name: string; crop: string };
  joined_at: string;
  notified_at: string | null;
  status: AlertStatus;
}

export function createAccountService(db: Db, deps: AccountDeps) {
  const now = deps.now ?? (() => new Date());
  const iso = () => now().toISOString();

  async function requireHuman(t: string | undefined, ip: string | null): Promise<TurnstileOutcome> {
    const outcome = await turnstileOutcome(t, ip, deps.turnstile);
    if (!outcome) throw new ServiceError(403, "turnstile_failed", TURNSTILE_REFUSAL);
    return outcome;
  }

  function phoneOr422(raw: string, field = "phone"): string {
    const p = normalizePhone(raw);
    if (!p) throw new ServiceError(422, "invalid_phone", `${field === "phone" ? "Enter" : "Enter an alert number as"} a 10-digit US phone number.`);
    return p;
  }

  async function startSession(userId: number): Promise<{ token: string; expiresAt: string }> {
    const token = newSessionToken();
    const created = now();
    const expiresAt = new Date(created.getTime() + SESSION_DAYS * 86_400_000).toISOString();
    await repo.insertSession(db, { userId, tokenHash: await hashSessionToken(token), createdAt: created.toISOString(), expiresAt, lastSeenAt: created.toISOString() });
    return { token, expiresAt };
  }

  /** Activation: queue alerts for anything this user waits on that is already found. */
  async function activate(userId: number) {
    const pending = await wl.pendingVarietyIdsForUser(db, userId);
    if (pending.length) await matchWaitlists(db, pending, { now: now(), userIds: [userId] });
  }

  async function joinInternal(user: repo.UserRow, varietySlug: string) {
    const v = await wl.varietyBySlug(db, varietySlug);
    if (!v) throw new ServiceError(404, "variety_not_found", "We couldn’t find that variety.");
    const existing = await wl.entryFor(db, user.id, v.id);
    if (existing) return { variety: v.slug, joined: false, on_list: true };
    if ((await wl.visibleListingCounts(db, [v.id])).get(v.id)) {
      throw new ServiceError(409, "already_listed", `Good news — ${v.name} is already listed by a farm. Reload the page to see where to buy it.`);
    }
    const joined = await wl.joinWaitlist(db, user.id, v.id, iso());
    return { variety: v.slug, joined, on_list: true };
  }

  async function signInLimits(ipHash: string | null, pairHash: string): Promise<void> {
    const t = now().getTime();
    if (ipHash) {
      const ip = await repo.attemptsSince(db, "ip", ipHash, new Date(t - SIGNIN_WINDOW_MINUTES * 60_000).toISOString());
      if (ip.n >= SIGNIN_IP_LIMIT) throw new ServiceError(429, "too_many_attempts", "Too many sign-in attempts. Please wait 15 minutes and try again.");
    }
    const pair = await repo.attemptsSince(db, "pair", pairHash, new Date(t - 86_400_000).toISOString());
    if (pair.n >= SIGNIN_PAIR_FREE_FAILURES && pair.last) {
      const lockMs = Math.min(86_400_000, SIGNIN_WINDOW_MINUTES * 60_000 * 2 ** (pair.n - SIGNIN_PAIR_FREE_FAILURES));
      if (t - Date.parse(pair.last) < lockMs) throw new ServiceError(429, "too_many_attempts", "Too many sign-in attempts. Please wait and try again later.");
    }
  }

  const svc = {
    /** Resolve a raw session cookie to its user (null when absent, malformed, expired or banned). */
    async userForSession(rawToken: string | null | undefined): Promise<repo.UserRow | null> {
      if (!isSessionTokenShape(rawToken)) return null;
      const r = await repo.sessionUser(db, await hashSessionToken(rawToken), iso());
      if (!r || r.user.status !== "active") return null;
      const last = r.session.lastSeenAt ? Date.parse(r.session.lastSeenAt) : 0;
      if (now().getTime() - last > 3_600_000) await repo.touchSession(db, r.session.id, iso());
      return r.user;
    },

    async create(body: z.infer<typeof CreateAccountSchema>, ip: string | null) {
      const turnstile = await requireHuman(body.turnstile_token, ip);
      const em = normalizeEmail(body.email);
      const ph = phoneOr422(body.phone);
      const zone = lookupZone(body.zip);
      if (!zone) throw new ServiceError(422, "unknown_zip", "We don’t recognise that ZIP code — please check it and try again.");
      if (await repo.userByEmail(db, em)) {
        throw new ServiceError(409, "email_taken", "That email already has a Seed Directory account — sign in with your email and phone instead.");
      }
      const at = iso();
      const user = await repo.insertUser(db, {
        email: em,
        name: body.name.trim(),
        phone: ph,
        zip: body.zip.trim(),
        usdaZone: zone,
        farmOwnerDeclared: body.farm_owner,
        alertPhone: ph,
        smsOptIn: body.sms_opt_in,
        smsOptInAt: body.sms_opt_in ? at : null,
        createdAt: at,
        updatedAt: at,
      });
      if (!user) throw new ServiceError(409, "email_taken", "That email already has a Seed Directory account — sign in with your email and phone instead.");
      const session = await startSession(user.id);
      const emailCode = await deps.verification.issue("email", user.id, em, { enforceLimits: false });
      let phoneCode: DeliveryStatus | null = null;
      if (body.sms_opt_in) phoneCode = (await deps.verification.issue("phone", user.id, ph, { enforceLimits: false })).delivery;
      let waitlist: { variety: string; joined: boolean; on_list: boolean } | { variety: string; error: string; message: string } | null = null;
      if (body.join_variety) {
        try {
          waitlist = await joinInternal(user, body.join_variety);
        } catch (err) {
          if (!(err instanceof ServiceError)) throw err;
          waitlist = { variety: body.join_variety, error: err.code, message: err.message };
        }
      }
      return {
        session,
        data: {
          user: publicUser(user),
          turnstile,
          verification: { email: emailCode.delivery, phone: phoneCode },
          waitlist,
          next: body.farm_owner ? "/add-your-farm" : "/account",
        },
      };
    },

    async signIn(body: z.infer<typeof SignInSchema>, ip: string | null) {
      const em = normalizeEmail(body.email);
      const ph = normalizePhone(body.phone) ?? body.phone.replace(/\D/g, "");
      const pairHash = await attemptKey("pair", `${em}|${ph}`);
      const ipHash = ip ? await attemptKey("ip", ip) : null;
      await signInLimits(ipHash, pairHash);
      await requireHuman(body.turnstile_token, ip);
      const user = await repo.userByEmail(db, em);
      if (!user || user.phone !== ph || user.status !== "active") {
        const at = iso();
        await repo.recordAttempt(db, "pair", pairHash, at);
        if (ipHash) await repo.recordAttempt(db, "ip", ipHash, at);
        throw new ServiceError(401, "no_match", SIGNIN_GENERIC_ERROR);
      }
      await repo.clearAttempts(db, "pair", pairHash);
      const session = await startSession(user.id);
      return { session, data: { user: publicUser(user), next: "/account" } };
    },

    async signOut(rawToken: string | null | undefined) {
      if (isSessionTokenShape(rawToken)) await repo.deleteSessionByHash(db, await hashSessionToken(rawToken));
      return { signed_out: true };
    },

    me: (u: repo.UserRow) => publicUser(u),

    // ── verification ──
    async verifyEmail(u: repo.UserRow, body: z.infer<typeof CodeSchema>) {
      const r = await deps.verification.verify("email", u.id, body.code);
      if (!r.ok) throw new ServiceError(r.code === "code_incorrect" ? 400 : r.code === "code_expired" ? 410 : 409, r.code, VERIFY_MESSAGES[r.code] + (r.attemptsLeft ? ` (${r.attemptsLeft} ${r.attemptsLeft === 1 ? "try" : "tries"} left)` : ""));
      if (r.target !== u.email) throw new ServiceError(409, "no_code", VERIFY_MESSAGES.no_code);
      const at = iso();
      await repo.updateUser(db, u.id, { emailVerified: true, emailVerifiedAt: at, updatedAt: at });
      await activate(u.id);
      return { email_verified: true };
    },

    async resendEmail(u: repo.UserRow) {
      if (u.emailVerified) return { email_verified: true, delivery: null };
      const r = await deps.verification.issue("email", u.id, u.email);
      return { email_verified: false, delivery: r.delivery };
    },

    async changeEmail(u: repo.UserRow, body: z.infer<typeof ChangeEmailSchema>) {
      const em = normalizeEmail(body.email);
      if (em === u.email) return { email: em, email_verified: u.emailVerified, delivery: null };
      if (await repo.userByEmail(db, em)) throw new ServiceError(409, "email_taken", "That email already belongs to another account.");
      const at = iso();
      await repo.updateUser(db, u.id, { email: em, emailVerified: false, emailVerifiedAt: null, updatedAt: at });
      await deps.verification.invalidate("email", u.id);
      const r = await deps.verification.issue("email", u.id, em, { enforceLimits: false });
      return { email: em, email_verified: false, delivery: r.delivery };
    },

    async setAlertPhone(u: repo.UserRow, body: z.infer<typeof AlertPhoneSchema>) {
      const at = iso();
      const next = body.alert_phone !== undefined ? phoneOr422(body.alert_phone, "alert_phone") : (u.alertPhone ?? u.phone);
      const changed = next !== u.alertPhone;
      const set: Partial<repo.NewUser> = { alertPhone: next, updatedAt: at, smsOptIn: body.sms_opt_in };
      if (changed) set.alertPhoneVerified = false;
      if (body.sms_opt_in && !u.smsOptIn) set.smsOptInAt = at;
      await repo.updateUser(db, u.id, set);
      if (changed) await deps.verification.invalidate("phone", u.id);
      if (!body.sms_opt_in) await wl.suppressQueued(db, u.id, "sms", "sms_opt_out");
      let delivery: DeliveryStatus | null = null;
      const verified = changed ? false : u.alertPhoneVerified;
      if (body.sms_opt_in && !verified) delivery = (await deps.verification.issue("phone", u.id, next, { enforceLimits: !changed })).delivery;
      if (body.sms_opt_in && verified) await activate(u.id);
      return { alert_phone: next, alert_phone_verified: verified, sms_opt_in: body.sms_opt_in, delivery };
    },

    async verifyPhone(u: repo.UserRow, body: z.infer<typeof CodeSchema>) {
      const r = await deps.verification.verify("phone", u.id, body.code);
      if (!r.ok) throw new ServiceError(r.code === "code_incorrect" ? 400 : r.code === "code_expired" ? 410 : 409, r.code, VERIFY_MESSAGES[r.code] + (r.attemptsLeft ? ` (${r.attemptsLeft} ${r.attemptsLeft === 1 ? "try" : "tries"} left)` : ""));
      // Per-number: a code proves only the number it was sent to.
      if (r.target !== u.alertPhone) throw new ServiceError(409, "no_code", VERIFY_MESSAGES.no_code);
      await repo.updateUser(db, u.id, { alertPhoneVerified: true, updatedAt: iso() });
      await activate(u.id);
      return { alert_phone_verified: true };
    },

    async resendPhone(u: repo.UserRow) {
      if (!u.alertPhone) throw new ServiceError(409, "no_alert_phone", "Add an alert number first.");
      if (u.alertPhoneVerified) return { alert_phone_verified: true, delivery: null };
      const r = await deps.verification.issue("phone", u.id, u.alertPhone);
      return { alert_phone_verified: false, delivery: r.delivery };
    },

    async setPreferences(u: repo.UserRow, body: z.infer<typeof PreferencesSchema>) {
      await repo.updateUser(db, u.id, { notifyOptOut: body.notify_opt_out, updatedAt: iso() });
      if (body.notify_opt_out) await wl.suppressQueued(db, u.id, null, "notify_opt_out");
      else await activate(u.id);
      return { notify_opt_out: body.notify_opt_out };
    },

    async deleteAccount(u: repo.UserRow) {
      await repo.deleteUserCascade(db, u.id);
      return { deleted: true };
    },

    // ── waiting lists ──
    async join(u: repo.UserRow, body: z.infer<typeof VarietyRefSchema>) {
      const r = await joinInternal(u, body.variety);
      return { ...r, channels: activeChannels(u), held: heldReasons(u) };
    },

    async leave(u: repo.UserRow, body: z.infer<typeof VarietyRefSchema>) {
      const v = await wl.varietyBySlug(db, body.variety);
      if (!v) throw new ServiceError(404, "variety_not_found", "We couldn’t find that variety.");
      const left = await wl.leaveWaitlist(db, u.id, v.id);
      return { variety: v.slug, left, on_list: false };
    },

    /** The variety-page block's state (fetched client-side so the page itself stays cached). */
    async waitlistStatus(u: repo.UserRow | null, varietySlug: string) {
      const v = await wl.varietyBySlug(db, varietySlug);
      if (!v) throw new ServiceError(404, "variety_not_found", "We couldn’t find that variety.");
      const listed = ((await wl.visibleListingCounts(db, [v.id])).get(v.id) ?? 0) > 0;
      if (!u) return { signed_in: false, variety: { slug: v.slug, name: v.name, listed }, on_list: false };
      const entry = await wl.entryFor(db, u.id, v.id);
      return {
        signed_in: true,
        variety: { slug: v.slug, name: v.name, listed },
        on_list: Boolean(entry),
        user: { name: u.name, email_verified: u.emailVerified, sms_opt_in: u.smsOptIn, alert_phone_verified: u.alertPhoneVerified },
        channels: activeChannels(u),
        held: heldReasons(u),
      };
    },

    /** The account page's Alerts section: every tracked variety with its live status. */
    async alerts(u: repo.UserRow): Promise<AlertItem[]> {
      const entries = await wl.entriesForUser(db, u.id);
      const ids = entries.map((e) => e.varietyId);
      const counts = await wl.visibleListingCounts(db, ids.length ? ids : [-1]);
      const latest = await wl.latestVisibleListings(db, [...counts.keys()]);
      const channels = activeChannels(u);
      const held = heldReasons(u);
      return entries.map((e) => {
        const found = latest.get(e.varietyId);
        const status: AlertStatus = found
          ? { state: "found", seller: { name: found.sellerName, slug: found.sellerSlug }, listing_id: found.listingId, seller_count: counts.get(e.varietyId) ?? 1, alerted: e.notifiedAt !== null }
          : channels.length
            ? { state: "waiting", channels }
            : { state: "held", reasons: held };
        return { variety: { slug: e.slug, name: e.name, crop: e.crop }, joined_at: e.createdAt, notified_at: e.notifiedAt, status };
      });
    },

    // ── unsubscribe (signed link, no sign-in) ──
    /** What a link unsubscribes from, without changing anything (the /unsubscribe confirm page). */
    async describeUnsubscribe(tokenStr: string) {
      if (!deps.unsubscribeKey) return null;
      const scope = await verifyUnsubscribe(deps.unsubscribeKey, tokenStr);
      if (!scope) return null;
      if (scope.kind === "all") return { kind: "all" as const, variety: null };
      const entries = await wl.entriesForUser(db, scope.userId);
      const e = entries.find((x) => x.varietyId === scope.varietyId);
      return { kind: "variety" as const, variety: e ? { name: e.name, slug: e.slug } : null };
    },

    async unsubscribe(tokenStr: string) {
      if (!deps.unsubscribeKey) throw new ServiceError(503, "unsubscribe_unavailable", "Unsubscribe links are not configured.");
      const scope = await verifyUnsubscribe(deps.unsubscribeKey, tokenStr);
      if (!scope) throw new ServiceError(400, "invalid_token", "This unsubscribe link is not valid.");
      const user = await repo.userById(db, scope.userId);
      if (!user) return { kind: scope.kind, done: true, variety: null };
      if (scope.kind === "all") {
        await repo.updateUser(db, user.id, { notifyOptOut: true, updatedAt: iso() });
        await wl.suppressQueued(db, user.id, null, "unsubscribed_all");
        return { kind: "all" as const, done: true, variety: null };
      }
      const entries = await wl.entriesForUser(db, user.id);
      const e = entries.find((x) => x.varietyId === scope.varietyId);
      await wl.leaveWaitlist(db, user.id, scope.varietyId);
      return { kind: "variety" as const, done: true, variety: e ? { name: e.name, slug: e.slug } : null };
    },

    /** STOP forwarded by the SMS provider: texts stop for every account using that number. */
    async smsStop(rawPhone: string) {
      const p = normalizePhone(rawPhone);
      if (!p) return { updated: 0 };
      const rows = await repo.usersByAlertPhone(db, p);
      for (const r of rows) {
        await repo.updateUser(db, r.id, { smsOptIn: false, updatedAt: iso() });
        await wl.suppressQueued(db, r.id, "sms", "sms_stop");
      }
      return { updated: rows.length };
    },
  };
  return svc;
}

export type AccountService = ReturnType<typeof createAccountService>;
