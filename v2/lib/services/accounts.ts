/**
 * Accounts + waiting lists (USER-ACCOUNTS-DESIGN §2/§2a/§4/§4a/§6, PRODUCT-DESIGN §3).
 *
 *  - Create: name + email + phone + ZIP (+ farm-owner declaration) + Turnstile → user, session,
 *    a 6-digit email code. Sign-in: email + phone pair + Turnstile → session (NO password).
 *    Tranche 3.2 amends the credential model in two bounded ways (Dustin's P2 + §11.1 rulings):
 *    the waitlist join path creates a minimal account (contact + channel alone) and verifies a
 *    recognized contact's email inline, establishing the session at verify time; and a phone-less
 *    account signs in on /account by emailed code. signIn() itself is untouched by both.
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
import { activeFloorRedirect, floorRedirect, joinErrorRedirect, type FloorJoinError } from "@/lib/waitlist-floor";
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

/**
 * Create, with the Tranche 3.2 join relaxation scoped to the join path only (SPEC §3.3): the
 * /account create form still requires the full set (name, email, phone, ZIP) exactly as today,
 * while a create carrying join_variety requires only the alert's needs — email always, phone
 * iff the text channel (sms_opt_in) is chosen. Name/ZIP stay accepted on the join path when a
 * client sends them (stored when valid), but are never demanded there.
 */
/** Blank strings are absent (a cleared or unrendered field), never a value. */
const blankToUndefined = (v: unknown): unknown => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const CreateAccountSchema = z
  .strictObject({
    name: z.preprocess(blankToUndefined, name.optional()),
    email,
    phone: z.preprocess(blankToUndefined, phone.optional()),
    zip: z.preprocess(blankToUndefined, zip.optional()),
    farm_owner: z.boolean().default(false),
    sms_opt_in: z.boolean().default(false),
    /** Variety page mini-form: create the account AND join this variety's waiting list. */
    join_variety: slug.optional(),
    turnstile_token: token,
  })
  .superRefine((v, ctx) => {
    const need = (path: "name" | "phone" | "zip", present: string | undefined, message: string) => {
      if (!present || present.trim() === "") ctx.addIssue({ code: "custom", path: [path], message });
    };
    if (!v.join_variety) {
      need("name", v.name, "enter your name");
      need("phone", v.phone, "enter your phone number");
      need("zip", v.zip, "enter your ZIP code");
    } else if (v.sms_opt_in) {
      need("phone", v.phone, "enter your phone number");
    }
  });
export const SignInSchema = z.strictObject({ email, phone, turnstile_token: token });
export const CodeSchema = z.strictObject({ code: z.string().trim().regex(/^\d{6}$/, "enter the 6-digit code") });
export const ChangeEmailSchema = z.strictObject({ email });
export const AlertPhoneSchema = z.strictObject({ alert_phone: phone.optional(), sms_opt_in: z.boolean() });
export const PreferencesSchema = z.strictObject({ notify_opt_out: z.boolean() });
export const VarietyRefSchema = z.strictObject({ variety: slug, turnstile_token: token });
export const DeleteAccountSchema = z.strictObject({ confirm: z.literal("DELETE") });
/** The finish-your-account step (Tranche 3.2, §3.2.5): deferred name/ZIP/type, each optional; blanks are absent (left unset), never failures. */
export const ProfileSchema = z.strictObject({ name: z.preprocess(blankToUndefined, name.optional()), zip: z.preprocess(blankToUndefined, zip.optional()), farm_owner: z.boolean().optional() });
/** Unauthenticated code issue: the recognized-contact resend + the /account sign-in code. */
export const UnauthedCodeIssueSchema = z.strictObject({ email, turnstile_token: token });
/** Unauthenticated code verify: recognized-contact join completion + /account code sign-in. */
export const UnauthedCodeVerifySchema = z.strictObject({ email, code: z.string().trim().regex(/^\d{6}$/, "enter the 6-digit code") });

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

/**
 * Whether the deferred profile is complete (Tranche 3.2, §3.2.5): a name is set and a ZIP set
 * the zone. The empty-string sentinel counts as unset everywhere it surfaces; email and phone
 * are never re-asked, so neither gates completion. Flip-created accounts start incomplete.
 */
export function isProfileComplete(name: string, usdaZone: string | null): boolean {
  return name !== "" && usdaZone !== null;
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
      throw new ServiceError(409, "already_listed", `Good news — ${v.name} is already listed by a seller. Reload the page to see where to buy it.`);
    }
    const joined = await wl.joinWaitlist(db, user.id, v.id, iso());
    return { variety: v.slug, joined, on_list: true };
  }

  /** The joinable variety or the same errors joinInternal raises (checked before any code is issued). */
  async function joinableVariety(varietySlug: string) {
    const v = await wl.varietyBySlug(db, varietySlug);
    if (!v) throw new ServiceError(404, "variety_not_found", "We couldn’t find that variety.");
    if ((await wl.visibleListingCounts(db, [v.id])).get(v.id)) {
      throw new ServiceError(409, "already_listed", `Good news — ${v.name} is already listed by a seller. Reload the page to see where to buy it.`);
    }
    return v;
  }

  /**
   * The recognized-contact branch of the join path (SPEC §3.2.4 + §3.3 (i)–(iii)): an existing
   * email is never an error — a verification code is issued to it WITHOUT a session,
   * rate-limited by the verification service's own limits (the create path's enforceLimits:
   * false precedent is explicitly NOT carried over here), and the pending join is recorded
   * with the issued code for verifyWaitlistCode to complete. Nothing about the account is
   * disclosed beyond what §3.2.4's copy already shows the submitter themselves.
   */
  async function recognizedJoin(existing: repo.UserRow, body: { join_variety?: string; sms_opt_in: boolean; phone?: string }) {
    if (existing.status !== "active") throw new ServiceError(401, "no_match", SIGNIN_GENERIC_ERROR);
    const v = await joinableVariety(body.join_variety!);
    const phone = body.sms_opt_in ? phoneOr422(body.phone ?? "") : null;
    const issue = await deps.verification.issue("email", existing.id, existing.email);
    await repo.upsertPendingJoin(db, { userId: existing.id, varietyId: v.id, phone, smsOptIn: body.sms_opt_in, createdAt: iso() });
    return { session: null, data: { recognized: true as const, email: existing.email, delivery: issue.delivery } };
  }

  /** A failed code check becomes the same status/code/message the sessioned verify raises. */
  function codeFailure(code: "no_code" | "code_expired" | "code_dead" | "code_incorrect", attemptsLeft?: number): ServiceError {
    const status = code === "code_incorrect" ? 400 : code === "code_expired" ? 410 : 409;
    return new ServiceError(status, code, VERIFY_MESSAGES[code] + (attemptsLeft ? ` (${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left)` : ""));
  }

  /**
   * Complete a recognized-contact verification (SPEC §3.3 (iv)): the email code is checked, and
   * on success the session is established AT VERIFY TIME and the pending join completes in the
   * same step. Shared by the JSON endpoint and the no-JS code form.
   */
  async function completeRecognizedJoin(user: repo.UserRow, code: string) {
    const r = await deps.verification.verify("email", user.id, code);
    if (!r.ok) throw codeFailure(r.code, r.attemptsLeft);
    if (r.target !== user.email) throw new ServiceError(409, "no_code", VERIFY_MESSAGES.no_code);
    const pending = await repo.pendingJoinFor(db, user.id);
    if (!pending) throw new ServiceError(409, "no_pending_join", "There’s no waiting-list join waiting for that code — join the list first, then enter the new code.");
    const v = await wl.varietyById(db, pending.varietyId);
    if (!v) {
      await repo.clearPendingJoin(db, user.id);
      throw new ServiceError(404, "variety_not_found", "We couldn’t find that variety.");
    }
    const at = iso();
    await repo.updateUser(db, user.id, {
      emailVerified: true,
      emailVerifiedAt: at,
      // The submitter's channel choice, applied now that they are verified: texts join the
      // account's alert settings. The email code proves nothing about the phone number, so a
      // newly set number stays unverified until its own code is entered (an already-verified
      // unchanged number keeps its flag — the flag is never touched here).
      ...(pending.smsOptIn ? { smsOptIn: true, smsOptInAt: user.smsOptIn ? user.smsOptInAt : at, ...(pending.phone ? { alertPhone: pending.phone } : {}) } : {}),
      updatedAt: at,
    });
    const fresh: repo.UserRow = { ...user, emailVerified: true, emailVerifiedAt: at, smsOptIn: user.smsOptIn || pending.smsOptIn, alertPhone: pending.smsOptIn && pending.phone ? pending.phone : user.alertPhone };
    const join = await joinInternal(fresh, v.slug);
    await repo.clearPendingJoin(db, user.id);
    await activate(user.id);
    const session = await startSession(user.id);
    return { session, join, channels: activeChannels(fresh), held: heldReasons(fresh) };
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
      const existing = await repo.userByEmail(db, em);
      if (existing) {
        // The plain /account create keeps its 409; the join path recognizes the contact inline
        // (SPEC §3.2.4) instead of erroring or linking away.
        if (!body.join_variety) {
          throw new ServiceError(409, "email_taken", "That email already has a Seed Directory account — sign in with your email and phone instead.");
        }
        return recognizedJoin(existing, body);
      }
      const joining = body.join_variety !== undefined;
      // The join path never demands the deferred fields (§3.3): no phone without the text
      // channel, no name, no ZIP — the empty-string sentinel marks them unset. Provided values
      // are still validated and stored, so older clients keep working unchanged.
      const ph = body.phone !== undefined ? phoneOr422(body.phone) : joining && !body.sms_opt_in ? "" : phoneOr422("");
      let zone: string | null = null;
      if (body.zip !== undefined) {
        zone = lookupZone(body.zip);
        if (!zone) throw new ServiceError(422, "unknown_zip", "We don’t recognise that ZIP code — please check it and try again.");
      } else if (!joining) {
        throw new ServiceError(400, "validation_error", "zip: enter your ZIP code");
      }
      const at = iso();
      const user = await repo.insertUser(db, {
        email: em,
        name: (body.name ?? "").trim(),
        phone: ph,
        zip: body.zip !== undefined ? body.zip.trim() : null,
        usdaZone: zone,
        farmOwnerDeclared: body.farm_owner,
        alertPhone: ph === "" ? null : ph,
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

    /**
     * The finish-your-account step (Tranche 3.2, §3.2.5): the deferred name/ZIP/account-type,
     * saved together or piecemeal — email and phone are never re-asked. A blank value leaves
     * the field unset rather than failing; the step shows until name and zone are both set.
     */
    async updateProfile(u: repo.UserRow, body: z.infer<typeof ProfileSchema>) {
      const set: Partial<repo.NewUser> = {};
      if (body.name !== undefined && body.name.trim() !== "") set.name = body.name.trim();
      if (body.zip !== undefined && body.zip.trim() !== "") {
        const zone = lookupZone(body.zip.trim());
        if (!zone) throw new ServiceError(422, "unknown_zip", "We don’t recognise that ZIP code — please check it and try again.");
        set.zip = body.zip.trim();
        set.usdaZone = zone;
      }
      if (body.farm_owner !== undefined) set.farmOwnerDeclared = body.farm_owner;
      if (Object.keys(set).length > 0) {
        set.updatedAt = iso();
        await repo.updateUser(db, u.id, set);
      }
      const fresh = (await repo.userById(db, u.id)) ?? u;
      return { user: publicUser(fresh) };
    },

    // ── unauthenticated code flows (Tranche 3.2) ──
    /**
     * Recognized-contact resend: a fresh code for the pending join's email. Requires the
     * pending row — which only the Turnstile-gated join submit creates — so this endpoint is
     * indirectly human-gated; issuance itself runs under the verification service's limits.
     */
    async resendWaitlistCode(email: string) {
      const user = await repo.userByEmail(db, normalizeEmail(email));
      if (!user || user.status !== "active") throw new ServiceError(409, "no_code", VERIFY_MESSAGES.no_code);
      if (!(await repo.pendingJoinFor(db, user.id))) {
        throw new ServiceError(409, "no_pending_join", "There’s no waiting-list join waiting — join the list first, then enter the new code.");
      }
      const r = await deps.verification.issue("email", user.id, user.email);
      return { delivery: r.delivery };
    },

    /** Recognized-contact verify: the session is established at verify time and the pending join completes in the same step (§3.3 (iv)). */
    async verifyWaitlistCode(email: string, code: string) {
      const user = await repo.userByEmail(db, normalizeEmail(email));
      if (!user || user.status !== "active") throw new ServiceError(409, "no_code", VERIFY_MESSAGES.no_code);
      const r = await completeRecognizedJoin(user, code);
      return { session: r.session, data: { ...r.join, channels: r.channels, held: r.held, email_verified: true } };
    },

    /**
     * The /account sign-in accommodation for phone-less accounts (§11.1, ruled (a)): "Email me
     * a code instead". Turnstile-gated like every /account form; issuance runs under the
     * verification service's limits. Accounts WITH a phone keep the email + phone pair.
     */
    async issueSignInCode(email: string, turnstileToken: string | undefined, ip: string | null) {
      await requireHuman(turnstileToken, ip);
      const user = await repo.userByEmail(db, normalizeEmail(email));
      if (!user || user.status !== "active") throw new ServiceError(404, "no_account", "We couldn’t find an account with that email — check it and try again.");
      if (user.phone !== "") throw new ServiceError(409, "has_phone", "This account has a phone number — sign in with your email and phone number instead.");
      const r = await deps.verification.issue("email", user.id, user.email);
      return { delivery: r.delivery };
    },

    /** The /account code sign-in: the emailed code verifies and establishes the session. */
    async verifySignInCode(email: string, code: string) {
      const user = await repo.userByEmail(db, normalizeEmail(email));
      if (!user || user.status !== "active") throw new ServiceError(409, "no_code", VERIFY_MESSAGES.no_code);
      const r = await deps.verification.verify("email", user.id, code);
      if (!r.ok) throw codeFailure(r.code, r.attemptsLeft);
      if (r.target !== user.email) throw new ServiceError(409, "no_code", VERIFY_MESSAGES.no_code);
      if (user.phone !== "") throw new ServiceError(409, "has_phone", "This account has a phone number — sign in with your email and phone number instead.");
      const at = iso();
      await repo.updateUser(db, user.id, { emailVerified: true, emailVerifiedAt: at, updatedAt: at });
      await activate(user.id);
      const session = await startSession(user.id);
      const fresh = (await repo.userById(db, user.id)) ?? { ...user, emailVerified: true };
      return { session, data: { user: publicUser(fresh), next: "/account" } };
    },

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
        user: { name: u.name, email_verified: u.emailVerified, sms_opt_in: u.smsOptIn, alert_phone_verified: u.alertPhoneVerified, profile_complete: isProfileComplete(u.name, u.usdaZone) },
        channels: activeChannels(u),
        held: heldReasons(u),
      };
    },

    // ── no-JS form submissions (Tranche 3.2, §3.4) ──
    /**
     * The plain-POST join (§3.4.2): the form-encoded create-and-join contract. Turnstile-exempt
     * per §11.4 (ruled (a)) with §3.4.5's compensating controls — the email-verification hold
     * (an unverified submission activates nothing; alerts stay held until the emailed code is
     * entered) and the site's existing rate limiting (the route applies the same public bucket
     * as the create path; recognized-contact issuance runs under the verification limits).
     * Every outcome is a redirect-back to the variety page with the block's fragment — failed
     * and successful alike (Ruling 9) — so the visitor is never stranded on an error page.
     */
    async joinFromForm(raw: Record<string, unknown>, sessionUser: repo.UserRow | null): Promise<{ redirect: string; sessionToken: string | null }> {
      const str = (v: unknown): string => (typeof v === "string" ? v : "");
      const varietySlug = str(raw.variety);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(varietySlug)) return { redirect: "/", sessionToken: null };
      const emailInput = str(raw.email).trim();
      const channel = str(raw.channel) === "sms" ? ("sms" as const) : ("email" as const);
      const phoneInput = str(raw.phone).trim();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput) && emailInput.length <= 320;
      const phone = channel === "sms" ? normalizePhone(phoneInput) : null;
      // Collect every field error before redirecting, so a double failure renders the summary
      // box at the block's head exactly like the enhanced form (Ruling 9's error dialect).
      const fieldErrors: FloorJoinError[] = [];
      if (!emailOk) fieldErrors.push("email_invalid");
      if (channel === "sms" && !phone) fieldErrors.push("phone_invalid");
      if (fieldErrors.length > 0) {
        return { redirect: joinErrorRedirect(varietySlug, fieldErrors, { email: emailInput, channel, phone: phoneInput }), sessionToken: null };
      }
      const em = normalizeEmail(emailInput);
      const v = await wl.varietyBySlug(db, varietySlug);
      // Unknown variety: the variety URL itself 404s, which is the correct answer — there is
      // no block to render an error state into.
      if (!v) return { redirect: `/variety/${varietySlug}`, sessionToken: null };
      if ((await wl.visibleListingCounts(db, [v.id])).get(v.id)) {
        return { redirect: joinErrorRedirect(varietySlug, ["already_listed"], { email: emailInput, channel, phone: phoneInput }), sessionToken: null };
      }
      if (sessionUser) {
        // A signed-in visitor's floor submission joins directly — the floor is correct for
        // every session state. A freshly chosen text number joins the alert settings; an
        // email-only choice never switches texts off.
        if (channel === "sms" && phone && (phone !== sessionUser.alertPhone || !sessionUser.smsOptIn)) {
          const at = iso();
          await repo.updateUser(db, sessionUser.id, {
            alertPhone: phone,
            alertPhoneVerified: phone === sessionUser.alertPhone ? sessionUser.alertPhoneVerified : false,
            smsOptIn: true,
            smsOptInAt: sessionUser.smsOptIn ? sessionUser.smsOptInAt : at,
            updatedAt: at,
          });
        }
        try {
          await joinInternal(sessionUser, v.slug);
        } catch (err) {
          if (err instanceof ServiceError && err.code === "already_listed") {
            return { redirect: joinErrorRedirect(varietySlug, ["already_listed"], { email: emailInput, channel, phone: phoneInput }), sessionToken: null };
          }
          throw err;
        }
        const fresh = (await repo.userById(db, sessionUser.id)) ?? sessionUser;
        if (!fresh.emailVerified) {
          // No live code may exist (an old session, an expired code) — make sure one does. A
          // 429 here means a code went out recently, which is exactly the state the verify
          // floor needs, so it is not a failure.
          try {
            await deps.verification.issue("email", fresh.id, fresh.email);
          } catch (err) {
            if (!(err instanceof ServiceError) || err.status !== 429) throw err;
          }
          return { redirect: floorRedirect(varietySlug, { waitlist: "verify" }), sessionToken: null };
        }
        return { redirect: activeFloorRedirect(varietySlug, activeChannels(fresh)), sessionToken: null };
      }
      const recognizedRedirect = async (user: repo.UserRow): Promise<{ redirect: string; sessionToken: string | null }> => {
        if (user.status !== "active") {
          return { redirect: joinErrorRedirect(varietySlug, ["account_inactive"], { email: emailInput, channel, phone: phoneInput }), sessionToken: null };
        }
        try {
          await deps.verification.issue("email", user.id, user.email);
        } catch (err) {
          if (err instanceof ServiceError && err.status === 429) {
            return { redirect: joinErrorRedirect(varietySlug, ["rate_limited"], { email: emailInput, channel, phone: phoneInput }), sessionToken: null };
          }
          throw err;
        }
        await repo.upsertPendingJoin(db, { userId: user.id, varietyId: v.id, phone, smsOptIn: channel === "sms", createdAt: iso() });
        return { redirect: floorRedirect(varietySlug, { waitlist: "recognized", email: em }), sessionToken: null };
      };
      const existing = await repo.userByEmail(db, em);
      if (existing) return recognizedRedirect(existing);
      // A minimal account, exactly as the JSON join path creates it (contact + channel alone),
      // minus only the Turnstile check the exemption lifts.
      const at = iso();
      const user = await repo.insertUser(db, {
        email: em,
        name: "",
        phone: phone ?? "",
        zip: null,
        usdaZone: null,
        farmOwnerDeclared: false,
        alertPhone: phone,
        smsOptIn: channel === "sms",
        smsOptInAt: channel === "sms" ? at : null,
        createdAt: at,
        updatedAt: at,
      });
      if (!user) {
        // Lost a creation race: the email exists now — the recognized branch handles it.
        const raced = await repo.userByEmail(db, em);
        if (raced) return recognizedRedirect(raced);
        return { redirect: joinErrorRedirect(varietySlug, ["rate_limited"], { email: emailInput, channel, phone: phoneInput }), sessionToken: null };
      }
      const session = await startSession(user.id);
      await deps.verification.issue("email", user.id, em, { enforceLimits: false });
      if (channel === "sms" && phone) await deps.verification.issue("phone", user.id, phone, { enforceLimits: false });
      try {
        await joinInternal(user, v.slug);
      } catch (err) {
        if (err instanceof ServiceError && err.code === "already_listed") {
          return { redirect: joinErrorRedirect(varietySlug, ["already_listed"], { email: emailInput, channel, phone: phoneInput }), sessionToken: session.token };
        }
        throw err;
      }
      return { redirect: floorRedirect(varietySlug, { waitlist: "verify" }), sessionToken: session.token };
    },

    /**
     * The plain-POST code form (§3.4.2): sessioned (the fresh join's own code) or
     * sessionless (the recognized contact's code, completing the pending join). Turnstile
     * never applied to code verification — the code itself is the credential, attempt-limited
     * like every other code check. Every outcome redirects back with the block's fragment.
     */
    async verifyFromForm(raw: Record<string, unknown>, sessionUser: repo.UserRow | null): Promise<{ redirect: string; sessionToken: string | null }> {
      const str = (v: unknown): string => (typeof v === "string" ? v : "");
      const varietySlug = str(raw.variety);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(varietySlug)) return { redirect: "/", sessionToken: null };
      const digits = str(raw.code).replace(/\s/g, "");
      const emailInput = str(raw.email).trim();
      // The floor to return to on a code failure: the sessioned verify floor, or the
      // recognized floor carrying the email the code was issued for.
      const back = (cerr: string): string =>
        sessionUser
          ? floorRedirect(varietySlug, { waitlist: "verify", cerr })
          : floorRedirect(varietySlug, { waitlist: "recognized", email: emailInput, cerr });
      if (!/^\d{6}$/.test(digits)) return { redirect: back("code_invalid"), sessionToken: null };
      if (sessionUser) {
        const r = await deps.verification.verify("email", sessionUser.id, digits);
        if (!r.ok) return { redirect: back(r.code), sessionToken: null };
        if (r.target !== sessionUser.email) return { redirect: back("no_code"), sessionToken: null };
        const at = iso();
        await repo.updateUser(db, sessionUser.id, { emailVerified: true, emailVerifiedAt: at, updatedAt: at });
        await activate(sessionUser.id);
        const fresh = (await repo.userById(db, sessionUser.id)) ?? { ...sessionUser, emailVerified: true };
        return { redirect: activeFloorRedirect(varietySlug, activeChannels(fresh)), sessionToken: null };
      }
      const user = await repo.userByEmail(db, normalizeEmail(emailInput));
      if (!user || user.status !== "active") return { redirect: back("no_code"), sessionToken: null };
      try {
        const r = await completeRecognizedJoin(user, digits);
        return { redirect: activeFloorRedirect(varietySlug, r.channels), sessionToken: r.session.token };
      } catch (err) {
        if (err instanceof ServiceError && ["code_incorrect", "code_expired", "code_dead", "no_code", "no_pending_join"].includes(err.code)) {
          return { redirect: back(err.code), sessionToken: null };
        }
        if (err instanceof ServiceError && err.code === "already_listed") return { redirect: `/variety/${varietySlug}`, sessionToken: null };
        throw err;
      }
    },

    /** The account page's Alerts section: every tracked variety with its live status. */
    async alerts(u: repo.UserRow): Promise<AlertItem[]> {
      const entries = await wl.entriesForUser(db, u.id);
      const ids = entries.map((e) => e.varietyId);
      const counts = await wl.visibleListingCounts(db, ids.length ? ids : [-1]);
      const sellerCounts = await wl.visibleSellerCounts(db, ids.length ? ids : [-1]);
      const latest = await wl.latestVisibleListings(db, [...counts.keys()]);
      const channels = activeChannels(u);
      const held = heldReasons(u);
      return entries.map((e) => {
        const found = latest.get(e.varietyId);
        const status: AlertStatus = found
          ? { state: "found", seller: { name: found.sellerName, slug: found.sellerSlug }, listing_id: found.listingId, seller_count: sellerCounts.get(e.varietyId) ?? 1, alerted: e.notifiedAt !== null }
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
