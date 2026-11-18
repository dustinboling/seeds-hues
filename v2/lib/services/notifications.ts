/**
 * Outbox drain (USER-ACCOUNTS-DESIGN §4/§4a). Called by POST /api/v1/internal/notifications/drain
 * (admin key) and by the Worker's cron trigger (worker.ts → lib/jobs/scheduled.ts), every 15 min.
 *
 * Email: queued rows grouped by user → ONE email per user per run listing every found variety
 * (links via /go/{listingId}); at most 200 emails per run (the rest wait for the next run).
 * SMS: one text per queued row (one per variety per arrival), at most 200 per run.
 * Rules applied at send time:
 *  - notify_opt_out or a banned account → rows marked suppressed;
 *  - email no longer verified (an email change) → rows stay queued (held) until it is;
 *  - SMS opt-in withdrawn / number unverified → sms rows suppressed;
 *  - the triggering listing went away → another visible listing of the variety is used; when the
 *    variety has none left the row is deleted so the next publish re-queues it.
 * On success: outbox status sent + sent_at, and the waiting-list entry's notified_at.
 * On failure: attempts++ and the provider code in `detail`; after 5 attempts → failed.
 * Mail binding (or unsubscribe signing key) absent → email reports "mail_not_configured" and
 * leaves rows queued; no SMS provider → "sms_not_configured". Neither blocks the other channel.
 */
import type { Db } from "@/lib/db/client";
import * as wl from "@/lib/repositories/waitlist";
import { signUnsubscribe } from "@/lib/accounts";
import type { Mailer } from "@/lib/mail";
import { sendSms, type SmsProvider } from "@/lib/sms";
import { foundEmail, foundSms, type FoundItem } from "./messages";
import { getMetaFlag } from "@/lib/repositories/meta";
import { matchWaitlists, type MatchResult } from "./waitlist-matcher";

export const DRAIN_EMAIL_CAP = 200;
export const DRAIN_SMS_CAP = 200;
export const MAX_SEND_ATTEMPTS = 5;
/** catalog_meta key: 1 pauses every alert send (global kill switch, design §4). */
export const NOTIFICATIONS_PAUSED_KEY = "notifications_paused";

export interface DrainDeps {
  mailer: Mailer;
  sms: SmsProvider | null;
  siteUrl: string;
  unsubscribeKey: string | null;
  now?: () => Date;
}

export interface ChannelReport {
  status: "ok" | "mail_not_configured" | "sms_not_configured" | "paused";
  sent: number;
  suppressed: number;
  failed: number;
  /** Rows still queued after this run. */
  remaining: number;
  detail?: string;
}

export interface DrainReport {
  /** The sweep: matchWaitlists(db, null) before sending, catching any publish path missed. */
  matched: MatchResult["queued"];
  email: ChannelReport & { emails: number };
  sms: ChannelReport;
}

export function createNotificationService(db: Db, deps: DrainDeps) {
  const now = deps.now ?? (() => new Date());

  /** Resolve each row's listing at send time (fallback: the variety's newest visible listing). */
  async function resolveListings(rows: { id: number; varietyId: number; listingId: number }[]) {
    const visible = await wl.visibleListingSellers(db, [...new Set(rows.map((r) => r.listingId))]);
    const fallback = await wl.latestVisibleListings(db, [...new Set(rows.filter((r) => !visible.has(r.listingId)).map((r) => r.varietyId))]);
    const out = new Map<number, { listingId: number; sellerName: string } | null>();
    for (const r of rows) {
      const name = visible.get(r.listingId);
      const f = fallback.get(r.varietyId);
      out.set(r.id, name !== undefined ? { listingId: r.listingId, sellerName: name } : f ? { listingId: f.listingId, sellerName: f.sellerName } : null);
    }
    return out;
  }

  async function drainEmail(): Promise<DrainReport["email"]> {
    const base = { sent: 0, suppressed: 0, failed: 0, emails: 0 };
    const remaining = () => wl.queuedCount(db, "email");
    if (!deps.mailer.configured) return { status: "mail_not_configured", ...base, remaining: await remaining(), detail: "send_email binding (EMAIL) is not configured" };
    if (!deps.unsubscribeKey) return { status: "mail_not_configured", ...base, remaining: await remaining(), detail: "UNSUBSCRIBE_SIGNING_KEY is not set" };
    const at = now().toISOString();
    const rows = await wl.queuedOutbox(db, "email", 5000);
    const byUser = new Map<number, typeof rows>();
    for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
    const report = { ...base };
    for (const [userId, urows] of byUser) {
      const u = urows[0]!;
      if (u.notifyOptOut || u.userStatus !== "active") {
        await wl.setOutboxStatus(db, urows.map((r) => r.id), { status: "suppressed", detail: u.notifyOptOut ? "notify_opt_out" : "account_inactive" });
        report.suppressed += urows.length;
        continue;
      }
      if (!u.emailVerified) continue; // held until the (changed) email is verified
      if (report.emails >= DRAIN_EMAIL_CAP) break;
      const listingsFor = await resolveListings(urows);
      const gone = urows.filter((r) => listingsFor.get(r.id) === null);
      if (gone.length) await wl.deleteOutboxRows(db, gone.map((r) => r.id));
      const live = urows.filter((r) => listingsFor.get(r.id));
      if (live.length === 0) continue;
      const items: FoundItem[] = [];
      for (const r of live) {
        const l = listingsFor.get(r.id)!;
        items.push({
          varietyId: r.varietyId,
          varietyName: r.varietyName,
          varietySlug: r.varietySlug,
          crop: r.crop,
          sellerName: l.sellerName,
          listingId: l.listingId,
          unsubscribeUrl: `${deps.siteUrl}/unsubscribe?token=${await signUnsubscribe(deps.unsubscribeKey, { kind: "variety", userId, varietyId: r.varietyId })}`,
        });
      }
      const allToken = await signUnsubscribe(deps.unsubscribeKey, { kind: "all", userId });
      const msg = foundEmail({
        site: deps.siteUrl,
        to: u.email,
        name: u.name,
        items,
        listCount: await wl.waitlistCountForUser(db, userId),
        unsubscribeAllUrl: `${deps.siteUrl}/unsubscribe?token=${allToken}`,
        oneClickUrl: `${deps.siteUrl}/api/v1/unsubscribe?token=${allToken}`,
      });
      const res = await deps.mailer.send(msg);
      const ids = live.map((r) => r.id);
      if (res.ok) {
        await wl.setOutboxStatus(db, ids, { status: "sent", sentAt: at, detail: null, bumpAttempts: true });
        await wl.markNotified(db, live.map((r) => ({ userId, varietyId: r.varietyId })), at);
        report.sent += ids.length;
        report.emails += 1;
      } else if (res.status === "mail_not_configured") {
        return { status: "mail_not_configured", ...report, remaining: await remaining() };
      } else {
        const dead = live.filter((r) => r.attempts + 1 >= MAX_SEND_ATTEMPTS).map((r) => r.id);
        const retry = ids.filter((id) => !dead.includes(id));
        await wl.setOutboxStatus(db, retry, { status: "queued", detail: res.code ?? "send_failed", bumpAttempts: true });
        await wl.setOutboxStatus(db, dead, { status: "failed", detail: res.code ?? "send_failed", bumpAttempts: true });
        report.failed += dead.length;
      }
    }
    return { status: "ok", ...report, remaining: await remaining() };
  }

  async function drainSms(): Promise<ChannelReport> {
    const base = { sent: 0, suppressed: 0, failed: 0 };
    const remaining = () => wl.queuedCount(db, "sms");
    if (!deps.sms) return { status: "sms_not_configured", ...base, remaining: await remaining(), detail: "SMS_PROVIDER is not configured" };
    const at = now().toISOString();
    const rows = await wl.queuedOutbox(db, "sms", DRAIN_SMS_CAP);
    const report = { ...base };
    const resolved = await resolveListings(rows);
    for (const r of rows) {
      if (r.notifyOptOut || r.userStatus !== "active" || !r.smsOptIn || !r.alertPhoneVerified || !r.alertPhone) {
        await wl.setOutboxStatus(db, [r.id], { status: "suppressed", detail: r.notifyOptOut ? "notify_opt_out" : !r.smsOptIn ? "sms_opt_out" : "alert_phone_unverified" });
        report.suppressed += 1;
        continue;
      }
      const l = resolved.get(r.id);
      if (!l) {
        await wl.deleteOutboxRows(db, [r.id]);
        continue;
      }
      const res = await sendSms(deps.sms, r.alertPhone, foundSms({ varietyName: r.varietyName, crop: r.crop, sellerName: l.sellerName, site: deps.siteUrl, varietySlug: r.varietySlug }));
      if (res.ok) {
        await wl.setOutboxStatus(db, [r.id], { status: "sent", sentAt: at, detail: null, bumpAttempts: true });
        await wl.markNotified(db, [{ userId: r.userId, varietyId: r.varietyId }], at);
        report.sent += 1;
      } else if (r.attempts + 1 >= MAX_SEND_ATTEMPTS) {
        await wl.setOutboxStatus(db, [r.id], { status: "failed", detail: res.code, bumpAttempts: true });
        report.failed += 1;
      } else {
        await wl.setOutboxStatus(db, [r.id], { status: "queued", detail: res.code, bumpAttempts: true });
      }
    }
    return { status: "ok", ...report, remaining: await remaining() };
  }

  return {
    async drain(): Promise<DrainReport> {
      const matched = (await matchWaitlists(db, null, { now: now() })).queued;
      if (await getMetaFlag(db, NOTIFICATIONS_PAUSED_KEY)) {
        const paused = { status: "paused" as const, sent: 0, suppressed: 0, failed: 0 };
        return { matched, email: { ...paused, emails: 0, remaining: await wl.queuedCount(db, "email") }, sms: { ...paused, remaining: await wl.queuedCount(db, "sms") } };
      }
      // Email first, then SMS; a failure on one never blocks the other.
      return { matched, email: await drainEmail(), sms: await drainSms() };
    },
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
