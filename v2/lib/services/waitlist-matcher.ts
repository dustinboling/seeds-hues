/**
 * The publish trigger (USER-ACCOUNTS-DESIGN §4): after listings become visible, queue one alert
 * per waiting user per channel for every variety that now has ≥ 1 visible listing.
 *
 *   matchWaitlists(db, varietyIds)   // the varieties a publish touched (or null = every
 *                                    // variety that has un-notified waiters)
 *
 * Why this is the "0 → ≥ 1" rule: a waiting-list entry can only be created while its variety has
 * no visible listing (joins are refused once a variety is listed — first-found only), and an
 * entry leaves the matcher's scope once an alert is SENT (notified_at). So "has an un-notified
 * waiter AND now has a visible listing" is exactly "crossed 0 → ≥ 1 since they joined".
 * Idempotent: the outbox UNIQUE (user, variety, channel) dedupes, so it is safe to call with the
 * full changed set, after overlapping imports, or repeatedly.
 *
 * Channel eligibility = the activation rule (PRODUCT-DESIGN §3), decided per channel:
 *  - email: the account's email is verified;
 *  - sms:   sms_opt_in AND the alert number is verified.
 * A user eligible for neither gets NO outbox row — their entry is HELD and activates by itself:
 * verifying a channel re-runs this matcher for that user's pending varieties (accounts service).
 * Banned accounts are never queued. notify_opt_out is applied by the drain (rows → suppressed).
 */
import type { Db } from "@/lib/db/client";
import * as repo from "@/lib/repositories/waitlist";

export interface MatchResult {
  /** Varieties that have a visible listing and un-notified waiters. */
  varieties: number;
  /** Outbox rows actually created (dedupe makes re-runs create 0). */
  queued: { email: number; sms: number };
}

export async function matchWaitlists(
  db: Db,
  varietyIds: number[] | null,
  opts: { now?: Date; userIds?: number[] } = {},
): Promise<MatchResult> {
  const at = (opts.now ?? new Date()).toISOString();
  const candidates = varietyIds === null ? await repo.varietiesWithPendingWaiters(db) : [...new Set(varietyIds)];
  if (candidates.length === 0) return { varieties: 0, queued: { email: 0, sms: 0 } };
  const listed = new Map<number, { listingId: number }>();
  for (let i = 0; i < candidates.length; i += 90) {
    for (const [vid, l] of await repo.latestVisibleListings(db, candidates.slice(i, i + 90))) listed.set(vid, l);
  }
  if (listed.size === 0) return { varieties: 0, queued: { email: 0, sms: 0 } };

  const waiters: Awaited<ReturnType<typeof repo.unnotifiedWaiters>> = [];
  const listedIds = [...listed.keys()];
  for (let i = 0; i < listedIds.length; i += 90) waiters.push(...(await repo.unnotifiedWaiters(db, listedIds.slice(i, i + 90))));
  const scoped = opts.userIds ? waiters.filter((w) => opts.userIds!.includes(w.userId)) : waiters;

  const email: repo.OutboxInsert[] = [];
  const sms: repo.OutboxInsert[] = [];
  for (const w of scoped) {
    if (w.status !== "active") continue;
    const listingId = listed.get(w.varietyId)!.listingId;
    if (w.emailVerified) email.push({ userId: w.userId, varietyId: w.varietyId, listingId, channel: "email", queuedAt: at });
    if (w.smsOptIn && w.alertPhoneVerified && w.alertPhone) sms.push({ userId: w.userId, varietyId: w.varietyId, listingId, channel: "sms", queuedAt: at });
  }
  const queued = { email: await repo.enqueueOutbox(db, email), sms: await repo.enqueueOutbox(db, sms) };
  return { varieties: new Set(scoped.map((w) => w.varietyId)).size, queued };
}
