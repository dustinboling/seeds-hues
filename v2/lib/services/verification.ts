/**
 * The shared one-time verification-code service (USER-ACCOUNTS-DESIGN §2a + §4a): ONE machinery,
 * two channels — "email" (code sent by email, proves the account email) and "phone" (code sent
 * by SMS, proves the alert number). Rules, identical for both:
 *  - 6-digit crypto-random code, stored only as SHA-256(salt:code) with a per-code salt;
 *  - expires 30 minutes after issue; 5 wrong attempts kill it;
 *  - issuing (resend) invalidates every earlier live code — one live code per user + channel;
 *  - resends are limited to 1/minute and 5/hour per user + channel.
 * BOUNDARY: these codes prove ownership of an address/number once. They are never part of
 * signing in (sign-in is the email + phone pair, with no code).
 */
import type { Db } from "@/lib/db/client";
import * as repo from "@/lib/repositories/accounts";
import { CODE_MAX_ATTEMPTS, CODE_TTL_MINUTES, RESEND_PER_HOUR, RESEND_PER_MINUTE, hashCode, newSalt, newVerificationCode, sameDigest } from "@/lib/accounts";
import type { Mailer } from "@/lib/mail";
import { sendSms, type SmsProvider } from "@/lib/sms";
import { codeEmail, codeSms } from "./messages";
import { ServiceError } from "./ingest";

export type CodeChannel = repo.CodeChannel;

/** Delivery outcome of an issued code. */
export type DeliveryStatus = "sent" | "mail_not_configured" | "sms_not_configured" | "send_failed";

export type VerifyOutcome =
  | { ok: true; target: string }
  | { ok: false; code: "no_code" | "code_expired" | "code_dead" | "code_incorrect"; attemptsLeft?: number };

export interface VerificationDeps {
  mailer: Mailer;
  sms: SmsProvider | null;
  siteUrl: string;
  now: () => Date;
  /** Test hook: receives every plaintext code at issue time (never set in production). */
  onCode?: (channel: CodeChannel, userId: number, code: string) => void;
}

export function createVerificationService(db: Db, deps: VerificationDeps) {
  return {
    /**
     * Issue a fresh code to `target` (email address or 10-digit alert number) and deliver it.
     * Throws 429 resend_too_soon / resend_limit when over the resend limits.
     */
    async issue(channel: CodeChannel, userId: number, target: string, opts: { enforceLimits?: boolean } = {}): Promise<{ delivery: DeliveryStatus }> {
      const now = deps.now();
      if (opts.enforceLimits !== false) {
        if ((await repo.codesIssuedSince(db, channel, userId, new Date(now.getTime() - 60_000).toISOString())) >= RESEND_PER_MINUTE) {
          throw new ServiceError(429, "resend_too_soon", "A code was just sent — please wait a minute before asking for another.");
        }
        if ((await repo.codesIssuedSince(db, channel, userId, new Date(now.getTime() - 3_600_000).toISOString())) >= RESEND_PER_HOUR) {
          throw new ServiceError(429, "resend_limit", "That’s the most codes we can send in an hour — please try again later.");
        }
      }
      const code = newVerificationCode();
      const salt = newSalt();
      await repo.replaceCode(db, channel, {
        userId,
        target,
        codeHash: await hashCode(salt, code),
        salt,
        expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString(),
        createdAt: now.toISOString(),
      });
      deps.onCode?.(channel, userId, code);
      if (channel === "email") {
        const r = await deps.mailer.send(codeEmail({ site: deps.siteUrl, to: target, code, minutes: CODE_TTL_MINUTES }));
        if (!r.ok && r.status === "mail_not_configured" && typeof process !== "undefined" && process.env.NODE_ENV === "development") {
          // Local `next dev` only: mail is not configured, so surface the code in the dev console.
          console.log(`[dev] email verification code for user ${userId}: ${code}`);
        }
        return { delivery: r.ok ? "sent" : r.status };
      }
      const r = await sendSms(deps.sms, target, codeSms(code, CODE_TTL_MINUTES));
      return { delivery: r.ok ? "sent" : r.code === "sms_not_configured" ? "sms_not_configured" : "send_failed" };
    },

    /** Check a typed code against the user's live code for this channel. */
    async verify(channel: CodeChannel, userId: number, typed: string): Promise<VerifyOutcome> {
      const now = deps.now();
      const live = await repo.liveCode(db, channel, userId);
      if (!live) return { ok: false, code: "no_code" };
      if (live.attempts >= CODE_MAX_ATTEMPTS) return { ok: false, code: "code_dead" };
      if (Date.parse(live.expiresAt) <= now.getTime()) return { ok: false, code: "code_expired" };
      const digits = typed.replace(/\s/g, "");
      if (/^\d{6}$/.test(digits) && sameDigest(await hashCode(live.salt, digits), live.codeHash)) {
        await repo.consumeCode(db, channel, live.id, now.toISOString());
        return { ok: true, target: live.target };
      }
      const attempts = await repo.bumpCodeAttempts(db, channel, live.id);
      if (attempts >= CODE_MAX_ATTEMPTS) return { ok: false, code: "code_dead" };
      return { ok: false, code: "code_incorrect", attemptsLeft: CODE_MAX_ATTEMPTS - attempts };
    },

    invalidate: (channel: CodeChannel, userId: number) => repo.invalidateCodes(db, channel, userId, deps.now().toISOString()),
  };
}

export type VerificationService = ReturnType<typeof createVerificationService>;

export const VERIFY_MESSAGES: Record<Exclude<VerifyOutcome, { ok: true }>["code"], string> = {
  no_code: "There’s no active code — ask for a new one.",
  code_expired: "That code has expired — ask for a new one.",
  code_dead: "Too many wrong tries — that code no longer works. Ask for a new one.",
  code_incorrect: "That code isn’t right — check it and try again.",
};
