/**
 * Admin service (R11 + the R8 removal flow). Every mutating call returns the public paths whose
 * cached HTML must be revalidated; the route layer revalidates them.
 */
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import * as admin from "@/lib/repositories/admin";
import * as ingest from "@/lib/repositories/ingest";
import { demandStats, rollupDay } from "@/lib/repositories/events";
import { resolveReport } from "@/lib/repositories/reports";
import { REVIEW_ITEM_STATUS, REVIEW_ITEM_TYPE } from "@/lib/db/schema";
import { hostOf, hostOnDomain } from "@/lib/names";
import { notifyWaitlists, ServiceError } from "./ingest";

export class AdminError extends ServiceError {}

export const ReviewListQuerySchema = z.object({
  type: z.enum(REVIEW_ITEM_TYPE).optional(),
  status: z.enum(REVIEW_ITEM_STATUS).optional(),
});

export const ApproveBodySchema = z
  .strictObject({
    /** seller_correction: the fields to apply (overrides proposal.fields). */
    fields: z
      .strictObject({
        name: z.string().min(1).max(200).optional(),
        location: z.string().max(200).nullable().optional(),
        region: z.string().max(10).nullable().optional(),
        homepage: z.string().url().nullable().optional(),
        description: z.string().max(2000).nullable().optional(),
        orderingNotes: z.string().max(2000).nullable().optional(),
        shipsTo: z.array(z.string().max(10)).max(60).optional(),
      })
      .optional(),
    note: z.string().max(500).optional(),
  })
  .default({});

export const MergeBodySchema = z.strictObject({
  into_id: z.union([z.number().int().positive(), z.string().min(1).max(160)]),
  /** The losing variety; defaults to the item's proposal.variety_id. */
  variety_id: z.union([z.number().int().positive(), z.string().min(1).max(160)]).optional(),
});

export const SellerActionBodySchema = z.strictObject({ reason: z.string().max(500).optional(), note: z.string().max(500).optional() }).default({});

export const JobBodySchema = z.strictObject({ type: z.string().min(1).max(50), target: z.string().min(1).max(2000) });

type ListingProposal = {
  seller_id: number;
  variety_id: number | null;
  crop: string | null;
  extracted_name: string;
  listing: Omit<ingest.ObservedListing, "varietyId" | "matchMethod" | "confidence">;
};

const asRecord = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export interface AdminResult<T> {
  data: T;
  revalidate: string[];
}

export function createAdminService(db: Db, opts: { now?: () => Date } = {}) {
  const now = opts.now ?? (() => new Date());
  const iso = () => now().toISOString();

  async function publishProposal(p: ListingProposal, varietyId: number, aliasKind: "seller_alias" | "synonym") {
    const seller = await ingest.sellerByRef(db, p.seller_id);
    if (!seller || seller.eligibility !== "approved") throw new AdminError(409, "seller_not_approved", "the listing's seller is not approved");
    if (await ingest.isBlockedDomain(db, [hostOf(p.listing.productUrl) ?? "", seller.domain ?? ""])) throw new AdminError(409, "blocked_domain", "domain is blocked");
    const variety = await ingest.varietyForMatch(db, varietyId);
    if (!variety || variety.status !== "active") throw new AdminError(404, "variety_not_found", `variety ${varietyId} not found`);
    const r = await ingest.upsertObservedListing(db, { ...p.listing, varietyId, matchMethod: "human", confidence: 1 });
    // Publish trigger (Phase 3): an approved listing may be a waited-for variety's first.
    await notifyWaitlists(db, [varietyId], now());
    if (p.extracted_name && p.extracted_name !== "unknown" && p.extracted_name !== variety.name) {
      await admin.addAlias(db, varietyId, p.extracted_name, aliasKind, variety.commonName);
    }
    return { listing_id: r.listingId, variety_slug: variety.slug, seller_slug: seller.slug };
  }

  async function removal(sellerRef: string | number, reason: string) {
    const seller = await ingest.sellerByRef(db, sellerRef);
    if (!seller) throw new AdminError(404, "seller_not_found", `seller ${sellerRef} not found`);
    const r = await admin.removeSeller(db, seller.id, reason, iso());
    if (!r) throw new AdminError(404, "seller_not_found", `seller ${sellerRef} not found`);
    return {
      data: { seller: r.sellerSlug, eligibility: "removed_by_request", listings_removed: r.listings, blocked_domain: r.domain },
      revalidate: [`/seller/${r.sellerSlug}`, "/seller", "/", "/sitemap.xml", ...r.varietySlugs.map((s) => `/variety/${s}`)],
    };
  }

  async function itemOr404(id: number) {
    const item = await admin.reviewItemById(db, id);
    if (!item) throw new AdminError(404, "not_found", `review item ${id} not found`);
    if (item.status !== "pending") throw new AdminError(409, "already_resolved", `review item ${id} is ${item.status}`);
    return item;
  }

  async function closeReport(proposal: Record<string, unknown>, status: "resolved" | "dismissed") {
    const reportId = proposal.report_id;
    if (typeof reportId === "number") await resolveReport(db, reportId, status, iso());
  }

  return {
    listReview: (q: z.infer<typeof ReviewListQuerySchema>, limit: number) => admin.listReviewItems(db, { ...q, limit }),

    async approve(id: number, body: z.infer<typeof ApproveBodySchema>): Promise<AdminResult<Record<string, unknown>>> {
      const item = await itemOr404(id);
      const p = item.proposal;
      let data: Record<string, unknown> = {};
      let revalidate: string[] = [];
      switch (item.type) {
        case "listing_match": {
          const lp = p as unknown as ListingProposal;
          if (!lp.variety_id) throw new AdminError(422, "no_variety", "listing_match has no variety_id; use merge with into_id");
          data = await publishProposal(lp, lp.variety_id, "seller_alias");
          revalidate = [`/variety/${String(data.variety_slug)}`, `/seller/${String(data.seller_slug)}`];
          break;
        }
        case "new_variety": {
          const lp = p as unknown as ListingProposal;
          if (!lp.crop) throw new AdminError(422, "no_crop", "new_variety proposal has no crop");
          const v = await admin.createVariety(db, { plantSlug: lp.crop, name: lp.extracted_name, at: iso() });
          if (!v) throw new AdminError(422, "unknown_crop", `crop ${lp.crop} not found`);
          data = { variety_id: v.id, ...(await publishProposal(lp, v.id, "seller_alias")) };
          revalidate = [`/variety/${v.slug}`, `/crop/${lp.crop}`, "/sitemap.xml"];
          break;
        }
        case "seller_candidate": {
          const domain = String(p.domain ?? "");
          if (await ingest.isBlockedDomain(db, [domain])) throw new AdminError(409, "blocked_domain", `${domain} is blocked`);
          if (await ingest.sellerByDomain(db, domain)) throw new AdminError(409, "seller_exists", `${domain} already exists`);
          const s = await admin.createCandidateSeller(db, { name: String(p.name), homepage: String(p.website_url), domain, at: iso() });
          data = { seller_id: s.id, seller_slug: s.slug, eligibility: "candidate" };
          break;
        }
        case "seller_correction": {
          const report = asRecord(p.report);
          const target = String(report.target_ref ?? p.seller_slug ?? "");
          if (report.target_type && report.target_type !== "seller") {
            data = { applied: [], note: "variety corrections are applied by hand; report resolved" };
          } else {
            const seller = await ingest.sellerByRef(db, target);
            if (!seller) throw new AdminError(404, "seller_not_found", `seller ${target} not found`);
            const fields = body.fields ?? (asRecord(p.fields) as admin.SellerCorrection);
            const applied = await admin.applySellerCorrection(db, seller.id, fields, iso());
            data = { seller: seller.slug, applied };
            revalidate = [`/seller/${seller.slug}`];
          }
          await closeReport(p, "resolved");
          break;
        }
        case "removal": {
          const report = asRecord(p.report);
          if (report.target_type !== "seller") throw new AdminError(422, "not_a_seller", "removal applies to sellers; resolve variety reports by hand");
          const r = await removal(String(report.target_ref), `removal request (report ${String(p.report_id ?? "?")})`);
          await closeReport(p, "resolved");
          data = r.data;
          revalidate = r.revalidate;
          break;
        }
      }
      await admin.resolveReviewItem(db, id, "approved", iso());
      return { data: { id, type: item.type, status: "approved", ...data }, revalidate };
    },

    async reject(id: number): Promise<AdminResult<Record<string, unknown>>> {
      const item = await itemOr404(id);
      await admin.resolveReviewItem(db, id, "rejected", iso());
      await closeReport(item.proposal, "dismissed");
      return { data: { id, type: item.type, status: "rejected" }, revalidate: [] };
    },

    async merge(id: number, body: z.infer<typeof MergeBodySchema>): Promise<AdminResult<Record<string, unknown>>> {
      const item = await itemOr404(id);
      if (item.type !== "listing_match" && item.type !== "new_variety") throw new AdminError(422, "not_mergeable", "merge applies to listing_match / new_variety items");
      const winner = await ingest.varietyForMatch(db, body.into_id);
      if (!winner || winner.status !== "active") throw new AdminError(404, "variety_not_found", `into_id ${body.into_id} not found`);
      const lp = item.proposal as unknown as ListingProposal;
      const loserRef = body.variety_id ?? lp.variety_id;
      const revalidate = [`/variety/${winner.slug}`];
      let merged: Record<string, unknown> | null = null;
      if (loserRef !== null && loserRef !== undefined) {
        const loser = await ingest.varietyForMatch(db, loserRef);
        if (loser && loser.id !== winner.id) {
          const m = await admin.mergeVarieties(db, loser.id, winner.id, iso());
          if (m) {
            merged = { loser: m.loserSlug, into: m.winnerSlug };
            revalidate.push(`/variety/${m.loserSlug}`, "/sitemap.xml");
          }
        }
      }
      const published = await publishProposal(lp, winner.id, "synonym");
      await admin.resolveReviewItem(db, id, "merged", iso());
      return { data: { id, status: "merged", merged, ...published }, revalidate: [...revalidate, `/seller/${published.seller_slug}`] };
    },

    async sellerAction(ref: string, action: "approve" | "reject" | "remove", body: z.infer<typeof SellerActionBodySchema>) {
      if (action === "remove") return removal(ref, body.reason ?? "removed by admin");
      const seller = await ingest.sellerByRef(db, ref);
      if (!seller) throw new AdminError(404, "seller_not_found", `seller ${ref} not found`);
      if (seller.eligibility === "removed_by_request") throw new AdminError(409, "seller_removed", `${seller.slug} was removed at its request`);
      await admin.setSellerEligibility(db, seller.id, action === "approve" ? "approved" : "rejected", iso(), body.note);
      return {
        data: { seller: seller.slug, id: seller.id, eligibility: action === "approve" ? "approved" : "rejected" },
        revalidate: [`/seller/${seller.slug}`, "/seller", "/sitemap.xml"],
      };
    },

    demand: (since: string, limit: number) => demandStats(db, since, limit),
    rollup: (date: string) => rollupDay(db, date),
    enqueueJob: (b: z.infer<typeof JobBodySchema>) => ingest.enqueueJob(db, { ...b, at: iso() }),

    async health() {
      const [rows, blocked, queue, jobs] = await Promise.all([
        admin.publishedListingsForHealth(db),
        ingest.blockedDomainList(db),
        admin.reviewQueueStats(db),
        ingest.jobStats(db),
      ]);
      const blockedSet = new Set(blocked);
      const violations: { invariant: string; listing_id: number; seller: string; detail: string }[] = [];
      for (const r of rows) {
        if (r.eligibility !== "approved") violations.push({ invariant: "unapproved_seller", listing_id: r.id, seller: r.sellerSlug, detail: r.eligibility });
        const host = r.productUrl ? hostOf(r.productUrl) : null;
        if (host && !hostOnDomain(host, r.sellerDomain)) violations.push({ invariant: "off_domain_url", listing_id: r.id, seller: r.sellerSlug, detail: `${host} vs ${r.sellerDomain ?? "(none)"}` });
        const d = r.sellerDomain?.replace(/^www\./, "");
        const hit = [...(d ? ingest.domainAndParents(d) : []), ...(host ? ingest.domainAndParents(host) : [])].some((x) => blockedSet.has(x));
        if (hit) violations.push({ invariant: "blocked_domain", listing_id: r.id, seller: r.sellerSlug, detail: d ?? host ?? "" });
      }
      return {
        ok: violations.length === 0,
        invariants: { checked_listings: rows.length, violations },
        queue: { pending: queue.depth, oldest_pending_at: queue.oldest },
        jobs,
        blocked_domains: blocked.length,
      };
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
