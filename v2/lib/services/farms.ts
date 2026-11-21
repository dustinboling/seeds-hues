/**
 * Add Your Farm + the farm-owner flag + the admin demand view (USER-ACCOUNTS-DESIGN §4, §9).
 *
 *  - submit(): the locked field list (2026-11-16) + Turnstile → farm_submissions row (pending),
 *    a queued farm_summary draft job, and an admin notice email (ADMIN_NOTIFY_EMAIL). Signed-in
 *    submissions link user_id. NOTHING auto-publishes: the seller record is made by hand in the
 *    catalog.
 *  - approve(): marks the submission approved; when a seller slug is supplied (the catalog entry
 *    exists) and an account matches the contact email (or submitted it), the same step sets
 *    is_farm_owner + seller_id and writes a farm_owner_audit row. Without a seller it only marks
 *    the queue state; the flag is then set later via setFarmOwner().
 *  - setFarmOwner()/revokeFarmOwner(): admin-only flag changes, each audited. Revoking never
 *    touches the account or its waiting lists.
 * The flag is never user-settable: no signup or profile path writes is_farm_owner.
 */
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import * as accounts from "@/lib/repositories/accounts";
import * as repo from "@/lib/repositories/farm-submissions";
import * as wl from "@/lib/repositories/waitlist";
import { normalizeEmail, normalizePhone } from "@/lib/accounts";
import { stateByCode } from "@/lib/data/states";
import type { Mailer } from "@/lib/mail";
import { turnstileOutcome, TURNSTILE_REFUSAL, type TurnstileConfig } from "@/lib/turnstile";
import { ServiceError } from "./ingest";
import { farmSubmissionAdminEmail } from "./messages";

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .url("enter a full web address starting with https://")
  .refine((u) => /^https?:\/\//i.test(u), "enter a full web address starting with https://");
const optionalUrl = z.union([httpUrl, z.literal("")]).optional();

export const FarmSubmissionSchema = z.strictObject({
  farm_name: z.string().trim().min(2, "enter the farm’s name").max(200),
  contact_name: z.string().trim().min(1, "enter a contact name").max(120),
  contact_email: z.email("enter a valid email address").max(320),
  city: z.string().trim().min(2, "enter the farm’s city").max(120),
  state: z.string().trim().length(2, "choose a state"),
  website: httpUrl,
  about: z.string().trim().min(10, "tell us a little about the farm").max(2000),
  varieties: z.string().trim().min(2, "list at least one variety").max(5000),
  authorized: z.literal(true, "please confirm you own or represent this farm"),
  business_phone: z.string().trim().min(7, "enter the farm’s business phone").max(32),
  gbp_url: optionalUrl,
  instagram_url: optionalUrl,
  tiktok_url: optionalUrl,
  facebook_url: optionalUrl,
  wholesale: z.enum(["yes", "no", ""]).optional(),
  notes: z.string().trim().max(2000).optional(),
  turnstile_token: z.string().max(2048).optional(),
});

export const ApproveFarmSchema = z.strictObject({ seller: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160).optional(), note: z.string().max(500).optional() }).default({});
export const FarmOwnerSchema = z.strictObject({
  user: z.union([z.number().int().positive(), z.email()]),
  seller: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160).optional(),
});

export interface FarmDeps {
  turnstile: TurnstileConfig;
  mailer: Mailer;
  siteUrl: string;
  adminNotifyEmail: string | null;
  now?: () => Date;
}

/**
 * The permission rule for FUTURE farm-owner tools (design §9) — designed now, no consumers yet:
 * an owner surface for seller S requires is_farm_owner = true AND users.seller_id = S, checked
 * server-side on every request. Throws 403 otherwise.
 */
export function assertFarmOwner(user: Pick<accounts.UserRow, "isFarmOwner" | "sellerId" | "status"> | null, sellerId: number): void {
  if (!user || user.status !== "active" || !user.isFarmOwner || user.sellerId === null || user.sellerId !== sellerId) {
    throw new ServiceError(403, "not_farm_owner", "This page is only for the verified owner of this farm.");
  }
}

const opt = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export function createFarmService(db: Db, deps: FarmDeps) {
  const now = deps.now ?? (() => new Date());
  const iso = () => now().toISOString();

  async function userRef(ref: number | string) {
    return typeof ref === "number" ? accounts.userById(db, ref) : accounts.userByEmail(db, normalizeEmail(ref));
  }

  return {
    async submit(body: z.infer<typeof FarmSubmissionSchema>, user: accounts.UserRow | null, ip: string | null) {
      const turnstile = await turnstileOutcome(body.turnstile_token, ip, deps.turnstile);
      if (!turnstile) throw new ServiceError(403, "turnstile_failed", TURNSTILE_REFUSAL);
      const state = body.state.toUpperCase();
      if (!stateByCode(state)) throw new ServiceError(422, "invalid_state", "Choose the farm’s state from the list.");
      const phone = normalizePhone(body.business_phone);
      if (!phone) throw new ServiceError(422, "invalid_phone", "Enter the farm’s business phone as a 10-digit US number.");
      const at = iso();
      const row = await repo.insertFarmSubmission(db, {
        userId: user?.id ?? null,
        farmName: body.farm_name,
        contactName: body.contact_name,
        contactEmail: normalizeEmail(body.contact_email),
        city: body.city,
        state,
        website: body.website,
        growsText: body.about,
        varietiesText: body.varieties,
        authorized: true,
        businessPhone: phone,
        gbpUrl: opt(body.gbp_url),
        instagramUrl: opt(body.instagram_url),
        tiktokUrl: opt(body.tiktok_url),
        facebookUrl: opt(body.facebook_url),
        wholesale: body.wholesale === "yes" ? true : body.wholesale === "no" ? false : null,
        notes: opt(body.notes),
        turnstile,
        status: "pending",
        createdAt: at,
        draftStatus: "pending",
      });
      await repo.enqueueFarmSummaryJob(db, row.id, at);
      let adminNotice: string = "not_configured";
      if (deps.adminNotifyEmail) {
        const r = await deps.mailer.send(
          farmSubmissionAdminEmail({
            site: deps.siteUrl,
            to: deps.adminNotifyEmail,
            id: row.id,
            farmName: row.farmName,
            city: row.city,
            state: row.state,
            website: row.website,
            contactName: row.contactName,
            contactEmail: row.contactEmail,
            declared: Boolean(user?.farmOwnerDeclared),
          }),
        );
        adminNotice = r.ok ? "sent" : r.status;
      }
      return { id: row.id, status: "pending" as const, turnstile, admin_notice: adminNotice };
    },

    list: (opts: { status?: "pending" | "approved" | "rejected"; limit: number }) => repo.listFarmSubmissions(db, opts),

    async approve(id: number, body: z.infer<typeof ApproveFarmSchema>, actor: string) {
      const sub = await repo.farmSubmissionById(db, id);
      if (!sub) throw new ServiceError(404, "not_found", `farm submission ${id} not found`);
      if (sub.status !== "pending") throw new ServiceError(409, "already_reviewed", `farm submission ${id} is ${sub.status}`);
      const seller = body.seller ? await repo.sellerBySlug(db, body.seller) : null;
      if (body.seller && !seller) throw new ServiceError(404, "seller_not_found", `seller ${body.seller} not found — create the catalog entry first, or approve without a seller`);
      const at = iso();
      await repo.updateFarmSubmission(db, id, { status: "approved", reviewedAt: at, reviewedBy: actor, sellerId: seller?.id ?? null });
      let farmOwner: { user_id: number; seller: string } | null = null;
      if (seller) {
        const userId = sub.userId ?? (await repo.userIdByEmail(db, sub.contactEmail));
        if (userId) {
          await accounts.setFarmOwner(db, userId, { isFarmOwner: true, sellerId: seller.id, actor, at });
          farmOwner = { user_id: userId, seller: seller.slug };
        }
      }
      return { id, status: "approved" as const, seller: seller?.slug ?? null, farm_owner: farmOwner };
    },

    async reject(id: number, actor: string) {
      const sub = await repo.farmSubmissionById(db, id);
      if (!sub) throw new ServiceError(404, "not_found", `farm submission ${id} not found`);
      if (sub.status !== "pending") throw new ServiceError(409, "already_reviewed", `farm submission ${id} is ${sub.status}`);
      // Decline: the account stays a normal account; farm_owner_declared stays on record.
      await repo.updateFarmSubmission(db, id, { status: "rejected", reviewedAt: iso(), reviewedBy: actor });
      return { id, status: "rejected" as const };
    },

    async setFarmOwner(body: z.infer<typeof FarmOwnerSchema>, actor: string) {
      const user = await userRef(body.user);
      if (!user) throw new ServiceError(404, "user_not_found", "no account matches that user");
      if (!body.seller) throw new ServiceError(400, "validation_error", "seller is required to grant farm-owner status");
      const seller = await repo.sellerBySlug(db, body.seller);
      if (!seller) throw new ServiceError(404, "seller_not_found", `seller ${body.seller} not found`);
      await accounts.setFarmOwner(db, user.id, { isFarmOwner: true, sellerId: seller.id, actor, at: iso() });
      return { user_id: user.id, is_farm_owner: true, seller: seller.slug };
    },

    async revokeFarmOwner(body: z.infer<typeof FarmOwnerSchema>, actor: string) {
      const user = await userRef(body.user);
      if (!user) throw new ServiceError(404, "user_not_found", "no account matches that user");
      // seller_id is retained for the record; it confers nothing while the flag is false.
      await accounts.setFarmOwner(db, user.id, { isFarmOwner: false, sellerId: user.sellerId, actor, at: iso() });
      return { user_id: user.id, is_farm_owner: false };
    },

    /** The admin demand view: demand ranking, totals, outbox status, recent farm submissions — served to the admin home, Statistics, and the key API. */
    async demandView(limit = 50) {
      const [ranked, totals, members, outbox, submissions] = await Promise.all([
        wl.waitlistDemand(db, limit),
        accounts.accountTotals(db),
        wl.waitlistTotals(db),
        wl.outboxStatusCounts(db),
        repo.listFarmSubmissions(db, { limit: 25 }),
      ]);
      const linked = await repo.sellersByIds(db, [...new Set(submissions.map((s) => s.sellerId).filter((x): x is number => x !== null))]);
      const sellerSlug = new Map(linked.map((s) => [s.id, s.slug]));
      return {
        varieties: ranked.map((r) => ({ slug: r.slug, name: r.name, crop: r.crop, waiters: Number(r.waiters), verified_waiters: Number(r.verifiedWaiters ?? 0), seller_count: r.sellerCount })),
        totals: { ...totals, memberships: members.memberships, active_memberships: members.active, alerted_memberships: members.alerted },
        outbox: outbox.map((o) => ({ channel: o.channel, status: o.status, count: o.n })),
        farm_submissions: submissions.map((s) => ({
          ...s,
          sellerSlug: s.sellerId ? (sellerSlug.get(s.sellerId) ?? null) : null,
          draftEvidence: s.draftEvidence ? (JSON.parse(s.draftEvidence) as { claim: string; quote: string; url: string }[]) : [],
          suggestedFields: s.suggestedFields ? (JSON.parse(s.suggestedFields) as Record<string, string>) : {},
        })),
      };
    },
  };
}

export type FarmService = ReturnType<typeof createFarmService>;
