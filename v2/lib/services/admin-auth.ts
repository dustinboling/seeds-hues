/**
 * Admin section service (Slice 0): the email + code sign-in (§7A), the 7-day admin session
 * layer, role reads/writes (writes append the audit trail; the Accounts UI lands in Slice C),
 * and the dashboard home's queue counts + recent decisions.
 *
 * Sign-in rules:
 *  - Step 1 never reveals whether an email has an account: unknown and known addresses
 *    behave identically (the flow always advances; no code is issued for unknown ones).
 *  - Only reviewer/admin accounts complete sign-in. A visitor-role account that proves its
 *    email gets the designed refusal (no session) — never an admin session.
 *  - The admin session is distinct from the visitor session: separate table, separate
 *    cookie, 7-day lifetime. A visitor session cookie alone never resolves here.
 */
import type { Db } from "@/lib/db/client";
import * as accountsRepo from "@/lib/repositories/accounts";
import * as repo from "@/lib/repositories/admin-auth";
import * as farmRepo from "@/lib/repositories/farm-submissions";
import { USER_ROLES } from "@/lib/db/schema";
import {
  ADMIN_CODE_MAX_ATTEMPTS,
  ADMIN_CODE_TTL_MINUTES,
  ADMIN_RESEND_PER_HOUR,
  ADMIN_RESEND_PER_MINUTE,
  ADMIN_SESSION_DAYS,
  isPrivilegedRole,
  roleLabel,
} from "@/lib/admin-auth";
import { hashCode, hashSessionToken, isSessionTokenShape, newSalt, newSessionToken, newVerificationCode, normalizeEmail, sameDigest } from "@/lib/accounts";
import { decisionSentence, farmDecisionSentence } from "@/lib/admin/review-queues";
import type { Mailer } from "@/lib/mail";
import { adminCodeEmail } from "./messages";
import { ServiceError } from "./ingest";

/** Delivery outcome of an issued admin code. */
export type AdminDeliveryStatus = "sent" | "mail_not_configured" | "send_failed";

export type AdminVerifyCode = "no_code" | "code_expired" | "code_dead" | "code_incorrect" | "no_role";

export type AdminVerifyOutcome =
  | { ok: true; session: { token: string; expiresAt: string }; name: string; email: string; role: string }
  | { ok: false; code: Exclude<AdminVerifyCode, "no_role">; attemptsLeft?: number }
  | { ok: false; code: "no_role"; name: string; email: string };

/** Spec §7A step-2 copy, keyed by outcome (the code field states the real TTL). */
export const ADMIN_CODE_MESSAGES: Record<Exclude<AdminVerifyCode, "no_role">, string> = {
  no_code: "There’s no active code for this email — send a new one.",
  code_expired: "That code has expired. Send a new code.",
  code_dead: "Too many wrong tries — that code no longer works. Send a new code to try again.",
  code_incorrect: "That code doesn’t match. Check the email and try again.",
};

export const ADMIN_RESEND_MESSAGES = {
  resend_too_soon: "A code was just sent — please wait a minute before asking for another.",
  resend_limit: "That’s the most codes we can send in an hour — please try again later.",
} as const;

export interface AdminQueueCard {
  key: "duplicates" | "sellers" | "listings" | "reports";
  name: string;
  description: string;
  count: number;
  oldest: string | null;
  href: string;
}

export interface AdminAuthDeps {
  mailer: Mailer;
  siteUrl: string;
  now?: () => Date;
  /** Test hook: receives every plaintext admin code at issue time (never set in production). */
  onAdminCode?: (userId: number, code: string) => void;
}



function oldestOf(a: string | null, b: string | null): string | null {
  const both = [a, b].filter((x): x is string => x !== null).sort();
  return both[0] ?? null;
}

export function createAdminAuthService(db: Db, deps: AdminAuthDeps) {
  const now = deps.now ?? (() => new Date());
  const iso = () => now().toISOString();

  async function startSession(userId: number): Promise<{ token: string; expiresAt: string }> {
    const token = newSessionToken();
    const created = now();
    const expiresAt = new Date(created.getTime() + ADMIN_SESSION_DAYS * 86_400_000).toISOString();
    await repo.insertAdminSession(db, { userId, tokenHash: await hashSessionToken(token), createdAt: created.toISOString(), expiresAt, lastSeenAt: created.toISOString() });
    return { token, expiresAt };
  }

  const svc = {
    /**
     * Issue a sign-in code to `email`. Always succeeds from the caller's view: unknown
     * addresses advance the flow without issuing anything (no account enumeration).
     * Throws 429 resend_too_soon / resend_limit when a known account is over the limits.
     */
    async requestCode(rawEmail: string): Promise<{ delivery: AdminDeliveryStatus }> {
      const email = normalizeEmail(rawEmail);
      const user = await accountsRepo.userByEmail(db, email);
      if (!user) return { delivery: "sent" };
      const at = now();
      if ((await repo.adminCodesIssuedSince(db, user.id, new Date(at.getTime() - 60_000).toISOString())) >= ADMIN_RESEND_PER_MINUTE) {
        throw new ServiceError(429, "resend_too_soon", ADMIN_RESEND_MESSAGES.resend_too_soon);
      }
      if ((await repo.adminCodesIssuedSince(db, user.id, new Date(at.getTime() - 3_600_000).toISOString())) >= ADMIN_RESEND_PER_HOUR) {
        throw new ServiceError(429, "resend_limit", ADMIN_RESEND_MESSAGES.resend_limit);
      }
      const code = newVerificationCode();
      const salt = newSalt();
      await repo.replaceAdminCode(db, {
        userId: user.id,
        email,
        codeHash: await hashCode(salt, code),
        salt,
        expiresAt: new Date(at.getTime() + ADMIN_CODE_TTL_MINUTES * 60_000).toISOString(),
        createdAt: at.toISOString(),
      });
      deps.onAdminCode?.(user.id, code);
      const r = await deps.mailer.send(adminCodeEmail({ site: deps.siteUrl, to: email, code, minutes: ADMIN_CODE_TTL_MINUTES }));
      if (!r.ok && r.status === "mail_not_configured" && typeof process !== "undefined" && process.env.NODE_ENV === "development") {
        // Local `next dev` only: mail is not configured, so surface the code in the dev console.
        console.log(`[dev] admin sign-in code for user ${user.id}: ${code}`);
      }
      return { delivery: r.ok ? "sent" : r.status };
    },

    /**
     * Check a typed code. A correct code for a reviewer/admin account opens the 7-day
     * session; a correct code for a visitor-role account is refused (no_role, no session).
     */
    async verifyCode(rawEmail: string, typed: string): Promise<AdminVerifyOutcome> {
      const email = normalizeEmail(rawEmail);
      const user = await accountsRepo.userByEmail(db, email);
      if (!user || user.status !== "active") return { ok: false, code: "no_code" };
      const at = now();
      const live = await repo.liveAdminCode(db, user.id);
      if (!live) return { ok: false, code: "no_code" };
      if (live.attempts >= ADMIN_CODE_MAX_ATTEMPTS) return { ok: false, code: "code_dead" };
      if (Date.parse(live.expiresAt) <= at.getTime()) return { ok: false, code: "code_expired" };
      const digits = typed.replace(/\s/g, "");
      if (/^\d{6}$/.test(digits) && sameDigest(await hashCode(live.salt, digits), live.codeHash)) {
        await repo.consumeAdminCode(db, live.id, at.toISOString());
        if (!isPrivilegedRole(user.role)) return { ok: false, code: "no_role", name: user.name, email: user.email };
        const session = await startSession(user.id);
        return { ok: true, session, name: user.name, email: user.email, role: user.role };
      }
      const attempts = await repo.bumpAdminCodeAttempts(db, live.id);
      if (attempts >= ADMIN_CODE_MAX_ATTEMPTS) return { ok: false, code: "code_dead" };
      return { ok: false, code: "code_incorrect", attemptsLeft: ADMIN_CODE_MAX_ATTEMPTS - attempts };
    },

    /** Resolve a raw admin session cookie to its account (null when absent, malformed, expired or banned). */
    async userForAdminSession(rawToken: string | null | undefined): Promise<accountsRepo.UserRow | null> {
      if (!isSessionTokenShape(rawToken)) return null;
      const r = await repo.adminSessionUser(db, await hashSessionToken(rawToken), iso());
      if (!r) return null;
      const last = r.session.lastSeenAt ? Date.parse(r.session.lastSeenAt) : 0;
      if (now().getTime() - last > 3_600_000) await repo.touchAdminSession(db, r.session.id, iso());
      return r.user;
    },

    /** The email an admin session token belonged to, even after expiry (the A3 welcome back). */
    async expiredAdminSessionEmail(rawToken: string | null | undefined): Promise<string | null> {
      if (!isSessionTokenShape(rawToken)) return null;
      const r = await repo.adminSessionUserAnytime(db, await hashSessionToken(rawToken));
      if (!r || Date.parse(r.session.expiresAt) > now().getTime()) return null;
      return r.user.email;
    },

    async signOut(rawToken: string | null | undefined) {
      if (isSessionTokenShape(rawToken)) await repo.deleteAdminSessionByHash(db, await hashSessionToken(rawToken));
      return { signed_out: true };
    },

    /** Read an account's role (server-side; the only role source the shell trusts). */
    async roleOf(userId: number): Promise<string> {
      return (await repo.roleOf(db, userId)) ?? "visitor";
    },

    /**
     * Change an account's role, recording the change in the audit trail (Slice C builds
     * the UI; the data layer records every change and refuses none).
     */
    async setAccountRole(userId: number, toRole: string, actor: string) {
      if (!(USER_ROLES as readonly string[]).includes(toRole)) throw new ServiceError(422, "invalid_role", "That role is not a known account role.");
      const user = await accountsRepo.userById(db, userId);
      if (!user) throw new ServiceError(404, "account_not_found", "We couldn’t find that account.");
      await repo.setRole(db, { userId, fromRole: user.role, toRole: toRole as repo.RoleValue, actor, at: iso() });
      return { user_id: userId, from_role: user.role, to_role: toRole };
    },

    /** The home's four queue cards: real counts + oldest age from the existing queues. */
    async queueCards(): Promise<{ cards: AdminQueueCard[]; totalWaiting: number }> {
      const [stats, farm] = await Promise.all([repo.pendingReviewStats(db), repo.pendingFarmStats(db)]);
      const byType = new Map(stats.map((s) => [s.type, s]));
      const pick = (type: string) => byType.get(type) ?? { type, n: 0, oldest: null };
      const sum = (...types: string[]) => {
        let n = 0;
        let oldest: string | null = null;
        for (const t of types) {
          const s = pick(t);
          n += s.n;
          oldest = oldestOf(oldest, s.oldest);
        }
        return { n, oldest };
      };
      const sellers = sum("seller_candidate");
      sellers.n += farm.n;
      sellers.oldest = oldestOf(sellers.oldest, farm.oldest);
      const listings = sum("listing_match", "new_variety");
      const reports = sum("seller_correction", "removal");
      const duplicates = sum("duplicate_hold");
      const cards: AdminQueueCard[] = [
        { key: "duplicates", name: "Duplicate varieties", description: "Possible duplicate varieties held for a decision", count: duplicates.n, oldest: duplicates.oldest, href: "/admin/review" },
        { key: "sellers", name: "Seller candidates", description: "Seller candidates from the hunt and Add Your Farm", count: sellers.n, oldest: sellers.oldest, href: "/admin/review" },
        { key: "listings", name: "Queued listings", description: "Shop listings waiting to join a variety page", count: listings.n, oldest: listings.oldest, href: "/admin/review" },
        { key: "reports", name: "Reports", description: "Visitor reports waiting for a decision", count: reports.n, oldest: reports.oldest, href: "/admin/review" },
      ];
      return { cards, totalWaiting: cards.reduce((t, c) => t + c.count, 0) };
    },

    /** Recent decisions across the queues + the role trail, newest first, in plain words. */
    async recentDecisions(limit = 6): Promise<{ text: string; at: string }[]> {
      const [decided, farms, roles] = await Promise.all([repo.recentReviewDecisions(db, limit), farmRepo.recentFarmDecisions(db, limit), repo.recentRoleChanges(db, limit)]);
      const items = [
        ...decided.map((r) => {
          let proposal: Record<string, unknown> = {};
          try {
            proposal = JSON.parse(r.proposal) as Record<string, unknown>;
          } catch {
            proposal = {};
          }
          return { text: decisionSentence({ id: r.id, type: r.type, proposal, status: r.status, decidedByName: r.decidedByName }), at: r.at ?? "" };
        }),
        ...farms.map((f) => ({ text: farmDecisionSentence({ farmName: f.farmName, status: f.status, reviewedBy: f.reviewedBy }), at: f.at ?? "" })),
        ...roles.map((g) => ({
          text: `${g.actor} changed ${g.email ?? `account #${g.userId}`} from ${roleLabel(g.fromRole)} to ${roleLabel(g.toRole)}`,
          at: g.at,
        })),
      ];
      items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      return items.slice(0, limit);
    },
  };
  return svc;
}

export type AdminAuthService = ReturnType<typeof createAdminAuthService>;
