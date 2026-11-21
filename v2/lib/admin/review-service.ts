/**
 * Review queue service (Slice A): windowed queue reads with exact counts, detail hydration
 * for the four workspaces, and the UI decision mutations. Every mutation authorizes
 * server-side: both roles decide queues/duplicates/reports, only admins apply removals or
 * retire listings (a hidden button is never the enforcement).
 */
import type { Db } from "@/lib/db/client";
import * as admin from "@/lib/repositories/admin";
import type { Decider } from "@/lib/repositories/admin";
import * as farmRepo from "@/lib/repositories/farm-submissions";
import { createAdminService, type AdminResult } from "@/lib/services/admin";
import { ServiceError } from "@/lib/services/ingest";
import { isPrivilegedRole } from "@/lib/admin-auth";
import { foldText } from "@/lib/names";
import {
  asRecord,
  correctionFields,
  itemLabel,
  matchLine,
  outcomeLabel,
  QUEUE_WINDOW,
  queueForType,
  reportListingId,
  reportMessage,
  reportTarget,
  reportTitle,
  type ItemRef,
  type QueueKey,
} from "./review-queues";

export interface ReviewContext {
  role: string;
  decider: Decider;
}

function authed(c: ReviewContext): void {
  if (!isPrivilegedRole(c.role)) throw new ServiceError(403, "forbidden", "This account doesn't have admin access.");
}

function needAdmin(c: ReviewContext): void {
  authed(c);
  if (c.role !== "admin") throw new ServiceError(403, "forbidden", "Your reviewer role doesn't include that action.");
}

function pendingOr409(item: { status: string } | null, what: string): void {
  if (!item) throw new ServiceError(404, "not_found", `${what} not found`);
  if (item.status !== "pending") throw new ServiceError(409, "already_resolved", `${what} is ${item.status}`);
}

export interface QueueRow {
  ref: ItemRef;
  type: string;
  name: string;
  facts: string;
  createdAt: string;
  source: string | null;
  verifiedBy: string | null;
  seenBy: string | null;
}

export interface DecidedRow {
  ref: ItemRef;
  type: string;
  name: string;
  outcome: string;
  decider: string | null;
  at: string;
}

async function sellerNames(db: Db, ids: number[]): Promise<Map<number, string>> {
  const rows = await farmRepo.sellersByIds(db, [...new Set(ids)].filter((n) => Number.isInteger(n) && n > 0));
  return new Map(rows.map((r) => [r.id, r.name]));
}

function rowFor(type: string, id: number, p: Record<string, unknown>, createdAt: string, extra: { verifiedBy: string | null; seenBy: string | null }, sellers: Map<number, string>): QueueRow {
  const ref: ItemRef = { kind: "review", id };
  const base = { ref, type, createdAt, verifiedBy: extra.verifiedBy, seenBy: extra.seenBy };
  switch (type) {
    case "duplicate_hold": {
      const candidate = asRecord(p.candidate);
      const candidateName = typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : null;
      return {
        ...base,
        name: itemLabel(type, p, id),
        facts: candidateName ? `Looks like '${candidateName}'` : "Possible duplicate",
        source: "From the scout",
      };
    }
    case "seller_candidate":
      return {
        ...base,
        name: itemLabel(type, p, id),
        facts: typeof p.domain === "string" ? p.domain : "",
        source: "Found by the hunt",
      };
    case "listing_match":
    case "new_variety": {
      const match = asRecord(p.match);
      const confidence = typeof match.confidence === "number" ? ` · confidence ${Math.round(match.confidence * 100)}%` : "";
      const sellerId = typeof p.seller_id === "number" ? p.seller_id : 0;
      const seller = sellers.get(sellerId);
      const method = match.method === "model" ? "Model match — a person checks it" : match.method === "exact" ? "Exact title match" : match.method === "synonym" ? "Matched on another name" : null;
      return {
        ...base,
        name: itemLabel(type, p, id),
        facts: type === "new_variety" ? `New ${typeof p.crop === "string" ? p.crop : "unknown-crop"} variety${seller ? ` · ${seller}` : ""}` : `${seller ?? "Unknown seller"}${confidence}`,
        source: method,
      };
    }
    default: {
      const report = asRecord(p.report);
      const targetType = typeof report.target_type === "string" ? report.target_type : "seller";
      const targetRef = typeof report.target_ref === "string" ? report.target_ref : "";
      const message = typeof report.message === "string" ? report.message : "";
      const kind = report.type === "remove" ? "Removal request" : report.type === "claim" ? "Ownership claim" : "Seller correction";
      return {
        ...base,
        name: kind === "Seller correction" && targetType === "variety" ? "Variety correction" : kind,
        facts: targetRef ? `${targetType} ${targetRef}` : targetType,
        source: message ? message.slice(0, 120) : null,
      };
    }
  }
}

function compareRows(a: QueueRow, b: QueueRow): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.ref.kind !== b.ref.kind) return a.ref.kind === "farm" ? -1 : 1;
  return a.ref.id - b.ref.id;
}

function afterCursor(after: { createdAt: string; kind: ItemRef["kind"]; id: number }, r: QueueRow): boolean {
  if (r.createdAt !== after.createdAt) return r.createdAt > after.createdAt;
  if (r.ref.kind !== after.kind) return after.kind === "farm" && r.ref.kind === "review";
  return r.ref.id > after.id;
}

function wordsDiffer(a: string, b: string): number {
  const aw = new Set(foldText(a).split(" ").filter(Boolean));
  const bw = new Set(foldText(b).split(" ").filter(Boolean));
  let shared = 0;
  for (const w of aw) if (bw.has(w)) shared++;
  return aw.size + bw.size - 2 * shared;
}

export function createAdminReviewService(db: Db, deps: { now?: () => Date } = {}) {
  const svc = createAdminService(db, deps.now ? { now: deps.now } : {});

  /** One window of the waiting list, oldest-first; totals always exact. */
  async function waitingList(queue: QueueKey, limit: number = QUEUE_WINDOW): Promise<{ rows: QueueRow[]; total: number }> {
      const types = queue === "duplicates" ? ["duplicate_hold"] as const : queue === "sellers" ? ["seller_candidate"] as const : queue === "listings" ? (["listing_match", "new_variety"] as const) : (["seller_correction", "removal"] as const);
      const [items, total] = await Promise.all([
        admin.listReviewItems(db, { types: [...types], status: "pending", limit, order: "queue" }),
        admin.countReviewItems(db, { types: [...types], statuses: ["pending"] }),
      ]);
      const sellers = await sellerNames(
        db,
        items.map((i) => (i.proposal as Record<string, unknown>).seller_id).filter((v): v is number => typeof v === "number"),
      );
      const rows = items.map((i) => rowFor(i.type, i.id, i.proposal as Record<string, unknown>, i.createdAt, { verifiedBy: i.verifiedByName, seenBy: i.seenByName }, sellers));
      if (queue !== "sellers") return { rows, total };
      // The sellers queue folds pending Add Your Farm submissions in, interleaved oldest-first.
      const [subs, farmTotal] = await Promise.all([
        farmRepo.listFarmSubmissions(db, { status: "pending", limit, order: "oldest" }),
        farmRepo.countFarmSubmissions(db, { status: "pending" }),
      ]);
      const farmRows: QueueRow[] = subs.map((s) => ({
        ref: { kind: "farm", id: s.id },
        type: "farm_submission",
        name: s.farmName,
        facts: `${s.city}, ${s.state}`,
        createdAt: s.createdAt,
        source: "Add Your Farm submission",
        verifiedBy: null,
        seenBy: null,
      }));
      const merged = [...rows, ...farmRows].sort(compareRows).slice(0, limit);
      return { rows: merged, total: total + farmTotal };
    }

    async function waitingTotal(queue: QueueKey): Promise<number> {
      const types = queue === "duplicates" ? ["duplicate_hold"] as const : queue === "sellers" ? ["seller_candidate"] as const : queue === "listings" ? (["listing_match", "new_variety"] as const) : (["seller_correction", "removal"] as const);
      const n = await admin.countReviewItems(db, { types: [...types], statuses: ["pending"] });
      if (queue !== "sellers") return n;
      return n + (await farmRepo.countFarmSubmissions(db, { status: "pending" }));
    }

    /** 1-based rank of a waiting item ("3 of 8") plus the queue total. */
    async function rank(queue: QueueKey, ref: ItemRef): Promise<{ rank: number; total: number } | null> {
      const total = await waitingTotal(queue);
      if (ref.kind === "farm") {
        const sub = await farmRepo.farmSubmissionById(db, ref.id);
        if (!sub || sub.status !== "pending") return null;
        const older = (await farmRepo.countOlderPendingSubmissions(db, sub.createdAt, sub.id)) + (await admin.countOlderWaiting(db, ["seller_candidate"], sub.createdAt, 0));
        return { rank: older + 1, total };
      }
      const item = await admin.reviewItemById(db, ref.id);
      if (!item || item.status !== "pending") return null;
      const types = queue === "duplicates" ? ["duplicate_hold"] : queue === "sellers" ? ["seller_candidate"] : queue === "listings" ? ["listing_match", "new_variety"] : ["seller_correction", "removal"];
      const older = await admin.countOlderWaiting(db, types as admin.ReviewType[], item.createdAt, item.id);
      const farmOlder = queue === "sellers" ? await farmRepo.countOlderPendingSubmissions(db, item.createdAt, Number.MAX_SAFE_INTEGER) : 0;
      return { rank: older + farmOlder + 1, total };
    }

    /**
     * The item to show after a decision: the first waiting item past the decided one
     * (the decide handler passes its cursor), else the oldest waiting item, else null.
     */
    async function selectedAfter(queue: QueueKey, after: { createdAt: string; kind: ItemRef["kind"]; id: number } | null, limit: number = QUEUE_WINDOW): Promise<QueueRow | null> {
      const { rows } = await waitingList(queue, limit + 1);
      if (!after) return rows[0] ?? null;
      return rows.find((r) => afterCursor(after, r)) ?? rows[0] ?? null;
    }

    /** Where a deep link lands: the live item, or the trail when it was decided meanwhile. */
    async function locate(ref: ItemRef): Promise<{ status: "pending" } | { status: "decided"; decidedByName: string | null } | { status: "missing" }> {
      if (ref.kind === "farm") {
        const sub = await farmRepo.farmSubmissionById(db, ref.id);
        if (!sub) return { status: "missing" };
        return sub.status === "pending" ? { status: "pending" } : { status: "decided", decidedByName: sub.reviewedBy };
      }
      const item = await admin.reviewItemById(db, ref.id);
      if (!item) return { status: "missing" };
      return item.status === "pending" ? { status: "pending" } : { status: "decided", decidedByName: item.decidedByName };
    }

    async function queueForRef(ref: ItemRef): Promise<QueueKey | null> {
      if (ref.kind === "farm") return "sellers";
      const item = await admin.reviewItemById(db, ref.id);
      return item ? queueForType(item.type) : null;
    }

    /** Decision history for a queue, newest first, paginated (read-only). */
    async function decidedList(queue: QueueKey, page: number, pageSize: number): Promise<{ rows: DecidedRow[]; total: number }> {
      const types = queue === "duplicates" ? ["duplicate_hold"] as const : queue === "sellers" ? ["seller_candidate"] as const : queue === "listings" ? (["listing_match", "new_variety"] as const) : (["seller_correction", "removal"] as const);
      if (queue !== "sellers") {
        const [items, total] = await Promise.all([
          admin.listDecidedReviewItems(db, { types: [...types], limit: pageSize, offset: (page - 1) * pageSize }),
          admin.countReviewItems(db, { types: [...types], statuses: ["approved", "rejected", "merged"] }),
        ]);
        return {
          rows: items.map((i) => {
            const p = i.proposal as Record<string, unknown>;
            return { ref: { kind: "review" as const, id: i.id }, type: i.type, name: itemLabel(i.type, p, i.id), outcome: outcomeLabel(i.type, i.status, p), decider: i.decidedByName, at: i.resolvedAt ?? i.createdAt };
          }),
          total,
        };
      }
      // Sellers folds two streams: merge the newest 200 of each, then paginate in memory
      // (farm-submission volume is small; the review side stays exact via its own counts).
      const [items, subs, reviewTotal, farmTotal] = await Promise.all([
        admin.listDecidedReviewItems(db, { types: ["seller_candidate"], limit: 200 }),
        farmRepo.listFarmSubmissions(db, { statuses: ["approved", "rejected"], limit: 200 }),
        admin.countReviewItems(db, { types: ["seller_candidate"], statuses: ["approved", "rejected", "merged"] }),
        farmRepo.countFarmSubmissions(db, { statuses: ["approved", "rejected"] }),
      ]);
      const merged: DecidedRow[] = [
        ...items.map((i) => {
          const p = i.proposal as Record<string, unknown>;
          return { ref: { kind: "review" as const, id: i.id }, type: i.type, name: itemLabel(i.type, p, i.id), outcome: outcomeLabel(i.type, i.status, p), decider: i.decidedByName, at: i.resolvedAt ?? i.createdAt };
        }),
        ...subs.map((s) => ({ ref: { kind: "farm" as const, id: s.id }, type: "farm_submission", name: s.farmName, outcome: s.status === "approved" ? "Approved" : "Declined", decider: s.reviewedBy, at: s.reviewedAt ?? s.createdAt })),
      ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      return { rows: merged.slice((page - 1) * pageSize, page * pageSize), total: reviewTotal + farmTotal };
    }

    // ─── detail hydration ───────────────────────────────────────────────────

    async function huntDetail(item: { id: number; createdAt: string; verifiedByName: string | null; seenByName: string | null; proposal: Record<string, unknown> }) {
      return {
        ref: { kind: "review" as const, id: item.id },
        type: "seller_candidate" as const,
        name: itemLabel("seller_candidate", item.proposal, item.id),
        createdAt: item.createdAt,
        website: typeof item.proposal.website_url === "string" ? item.proposal.website_url : typeof item.proposal.website === "string" ? item.proposal.website : null,
        domain: typeof item.proposal.domain === "string" ? item.proposal.domain : null,
      };
    }

    async function farmDetail(sub: farmRepo.FarmSubmissionRow) {
      const suggested = (() => {
        try {
          return sub.suggestedFields ? (JSON.parse(sub.suggestedFields) as Record<string, string>) : {};
        } catch {
          return {};
        }
      })();
      const evidence = (() => {
        try {
          return sub.draftEvidence ? (JSON.parse(sub.draftEvidence) as { claim: string; quote: string; url: string }[]) : [];
        } catch {
          return [];
        }
      })();
      return {
        ref: { kind: "farm" as const, id: sub.id },
        type: "farm_submission" as const,
        name: sub.farmName,
        createdAt: sub.createdAt,
        contactName: sub.contactName,
        contactEmail: sub.contactEmail,
        city: sub.city,
        state: sub.state,
        website: sub.website,
        growsText: sub.growsText,
        varietiesText: sub.varietiesText,
        businessPhone: sub.businessPhone,
        wholesale: sub.wholesale,
        notes: sub.notes,
        suggested,
        draftStatus: sub.draftStatus,
        draftSummary: sub.draftSummary,
        evidence,
      };
    }

    async function listingDetail(item: { id: number; type: string; createdAt: string; verifiedByName: string | null; seenByName: string | null; proposal: Record<string, unknown> }) {
      const p = item.proposal;
      const sellerId = typeof p.seller_id === "number" ? p.seller_id : 0;
      const listing = asRecord(p.listing);
      const packets = Array.isArray(listing.packets)
        ? listing.packets.map((x) => (typeof x === "string" ? x : typeof asRecord(x).label === "string" ? String(asRecord(x).label) : null)).filter((x): x is string => Boolean(x))
        : [];
      const [seller, plant] = await Promise.all([
        sellerId > 0 ? admin.sellerRecordByRef(db, sellerId) : null,
        typeof p.crop === "string" ? admin.plantBySlug(db, p.crop) : null,
      ]);
      const varietyId = typeof p.variety_id === "number" ? p.variety_id : null;
      const variety = item.type === "listing_match" && varietyId ? await admin.varietyDetailById(db, varietyId) : null;
      return {
        ref: { kind: "review" as const, id: item.id },
        type: item.type as "listing_match" | "new_variety",
        name: itemLabel(item.type, p, item.id),
        createdAt: item.createdAt,
        extractedName: typeof p.extracted_name === "string" ? p.extracted_name : itemLabel(item.type, p, item.id),
        crop: typeof p.crop === "string" ? p.crop : null,
        cropCommon: plant?.commonName ?? null,
        match: matchLine(p),
        listing: {
          sellerName: seller?.name ?? "Unknown seller",
          sellerSlug: seller?.slug ?? null,
          isSmallFarm: seller?.isSmallFarm ?? false,
          titleRaw: typeof listing.titleRaw === "string" ? listing.titleRaw : typeof listing.title_raw === "string" ? listing.title_raw : null,
          productUrl: typeof listing.productUrl === "string" ? listing.productUrl : typeof listing.product_url === "string" ? listing.product_url : null,
          packets,
        },
        variety: variety
          ? { kind: "existing" as const, name: variety.name, slug: variety.slug, cropCommon: variety.commonName, seriesName: variety.seriesName, sellerCount: variety.sellerCount }
          : { kind: "to_create" as const, name: typeof p.extracted_name === "string" ? p.extracted_name : "Unknown", crop: typeof p.crop === "string" ? p.crop : "unknown" },
      };
    }

    async function holdDetail(item: { id: number; createdAt: string; verifiedByName: string | null; seenByName: string | null; proposal: Record<string, unknown> }) {
      const p = item.proposal;
      const candidate = asRecord(p.candidate);
      const listing = asRecord(p.listing);
      const candidateId = typeof candidate.variety_id === "number" ? candidate.variety_id : 0;
      const sellerId = typeof p.seller_id === "number" ? p.seller_id : 0;
      const heldName = typeof p.held_name === "string" ? p.held_name : itemLabel("duplicate_hold", p, item.id);
      const [seller, plant, direct] = await Promise.all([
        sellerId > 0 ? admin.sellerRecordByRef(db, sellerId) : null,
        typeof p.crop === "string" ? admin.plantBySlug(db, p.crop) : null,
        candidateId > 0 ? admin.varietyDetailById(db, candidateId) : null,
      ]);
      // The candidate may have merged away meanwhile: follow the chain to the survivor so
      // the pane never dead-ends (the decision still guards on the live record).
      let existing = direct && direct.status === "active" ? direct : null;
      let stale = false;
      if (!existing && candidateId > 0) {
        const target = await admin.resolveVarietyTarget(db, candidateId);
        if (target) {
          existing = await admin.varietyDetailById(db, target.id);
          stale = true;
        }
      }
      const heldSellers = seller ? [{ name: seller.name, slug: seller.slug }] : [];
      const shared = existing ? heldSellers.filter((s) => existing.listings.some((l) => l.sellerSlug === s.slug)).length : 0;
      const sameCrop = Boolean(existing && plant && existing.plantSlug === plant.slug);
      const cropWords = (c: string | null) => (c ? `${c[0]!.toUpperCase()}${c.slice(1)}s` : "Unknown crop");
      return {
        ref: { kind: "review" as const, id: item.id },
        type: "duplicate_hold" as const,
        name: heldName,
        createdAt: item.createdAt,
        seenBy: item.seenByName,
        held: {
          name: heldName,
          crop: typeof p.crop === "string" ? p.crop : null,
          cropCommon: plant?.commonName ?? null,
          latinName: null as string | null,
          sellerName: seller?.name ?? null,
          sellerSlug: seller?.slug ?? null,
          titleRaw: typeof listing.titleRaw === "string" ? listing.titleRaw : null,
          productUrl: typeof listing.productUrl === "string" ? listing.productUrl : null,
          availability: typeof listing.availability === "string" ? listing.availability : null,
        },
        existing,
        stale,
        candidateName: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : `variety #${candidateId}`,
        evidenceQuote: typeof p.evidence_quote === "string" ? p.evidence_quote : null,
        holdReason: typeof p.hold_reason === "string" ? p.hold_reason : null,
        comparison: {
          sameCrop,
          cropLine: sameCrop && plant ? `Same crop: ${cropWords(plant.commonName)}` : `Different crops: ${cropWords(plant?.commonName ?? null)} / ${cropWords(existing?.commonName ?? null)}`,
          nameLine: (() => {
            if (!existing) return "The existing variety is gone";
            const d = wordsDiffer(heldName, existing.name);
            if (d <= 2) return "Names differ by one word";
            return `Names share little in common (${d} differing words)`;
          })(),
          sharedSellers: shared,
          sellerLine: shared === 0 ? "No sellers in common" : shared === 1 ? "Sold by 1 of the same sellers" : `Sold by ${shared} of the same sellers`,
        },
      };
    }

    async function reportDetail(item: { id: number; type: string; createdAt: string; verifiedByName: string | null; seenByName: string | null; proposal: Record<string, unknown> }) {
      const p = item.proposal;
      const target = reportTarget(p);
      const listingId = reportListingId(p);
      const [seller, variety, listingById] = await Promise.all([
        target.type === "seller" && target.ref ? admin.sellerRecordByRef(db, target.ref) : null,
        target.type === "variety" && target.ref ? admin.varietyDetailBySlug(db, target.ref) : null,
        listingId ? admin.listingSummaryById(db, listingId) : null,
      ]);
      const fields = correctionFields(p);
      const reportType = typeof asRecord(p.report).type === "string" ? String(asRecord(p.report).type) : null;
      return {
        ref: { kind: "review" as const, id: item.id },
        type: item.type as "seller_correction" | "removal",
        name: reportTitle(p),
        createdAt: item.createdAt,
        verifiedBy: item.verifiedByName,
        reportType,
        message: reportMessage(p),
        targetType: target.type as "seller" | "variety",
        targetRef: target.ref,
        seller,
        variety,
        fields,
        hasFields: Object.keys(fields).length > 0,
        listing: listingById && listingById.status !== "removed" ? listingById : null,
      };
    }

    /** The selected item's fully hydrated decision view (null when not pending). */
    async function detail(ref: ItemRef) {
      if (ref.kind === "farm") {
        const sub = await farmRepo.farmSubmissionById(db, ref.id);
        if (!sub || sub.status !== "pending") return null;
        return farmDetail(sub);
      }
      const item = await admin.reviewItemById(db, ref.id);
      if (!item || item.status !== "pending") return null;
      const p = item.proposal;
      switch (item.type) {
        case "seller_candidate":
          return huntDetail({ id: item.id, createdAt: item.createdAt, verifiedByName: item.verifiedByName, seenByName: item.seenByName, proposal: p });
        case "listing_match":
        case "new_variety":
          return listingDetail({ id: item.id, type: item.type, createdAt: item.createdAt, verifiedByName: item.verifiedByName, seenByName: item.seenByName, proposal: p });
        case "duplicate_hold":
          return holdDetail({ id: item.id, createdAt: item.createdAt, verifiedByName: item.verifiedByName, seenByName: item.seenByName, proposal: p });
        default:
          return reportDetail({ id: item.id, type: item.type, createdAt: item.createdAt, verifiedByName: item.verifiedByName, seenByName: item.seenByName, proposal: p });
      }
    }

    // ─── mutations (role-guarded; hidden buttons never enforce) ───────────────

    async function mustBe(itemId: number, types: string[]): Promise<{ id: number; type: string; proposal: Record<string, unknown> }> {
      const item = await admin.reviewItemById(db, itemId);
      pendingOr409(item, `review item ${itemId}`);
      if (!item || !types.includes(item.type)) throw new ServiceError(422, "wrong_type", `review item ${itemId} is not ${types.join(" or ")}`);
      return { id: item.id, type: item.type, proposal: item.proposal };
    }

    async function approveSellerCandidate(itemId: number, c: ReviewContext): Promise<AdminResult<Record<string, unknown>>> {
      authed(c);
      await mustBe(itemId, ["seller_candidate"]);
      return svc.approve(itemId, {}, { decider: c.decider });
    }

    async function declineSellerCandidate(itemId: number, c: ReviewContext, reason?: string): Promise<AdminResult<Record<string, unknown>>> {
      authed(c);
      await mustBe(itemId, ["seller_candidate"]);
      return svc.reject(itemId, { decider: c.decider, ...(reason ? { reason } : {}) });
    }

    async function approveFarm(id: number, c: ReviewContext): Promise<AdminResult<Record<string, unknown>>> {
      authed(c);
      return svc.approveFarmCandidate(id, c.decider);
    }

    async function declineFarm(id: number, c: ReviewContext, reason?: string): Promise<AdminResult<Record<string, unknown>>> {
      authed(c);
      return svc.rejectFarmSubmission(id, { decider: c.decider, ...(reason ? { reason } : {}) });
    }

    async function publishListing(itemId: number, c: ReviewContext): Promise<AdminResult<Record<string, unknown>>> {
      authed(c);
      await mustBe(itemId, ["listing_match"]);
      return svc.approve(itemId, {}, { decider: c.decider });
    }

    async function addVariety(itemId: number, c: ReviewContext): Promise<AdminResult<Record<string, unknown>>> {
      authed(c);
      await mustBe(itemId, ["new_variety"]);
      return svc.approve(itemId, {}, { decider: c.decider });
    }

    async function rejectQueuedListing(itemId: number, c: ReviewContext, reason?: string): Promise<AdminResult<Record<string, unknown>>> {
      authed(c);
      await mustBe(itemId, ["listing_match", "new_variety"]);
      return svc.reject(itemId, { decider: c.decider, ...(reason ? { reason } : {}) });
    }

    async function decideDuplicate(itemId: number, outcome: "duplicate" | "not_duplicate", c: ReviewContext): Promise<AdminResult<Record<string, unknown>>> {
      authed(c);
      return svc.decideDuplicate(itemId, outcome, { decider: c.decider });
    }

    async function skipHold(itemId: number, c: ReviewContext): Promise<AdminResult<Record<string, unknown>>> {
      authed(c);
      return svc.skipHold(itemId, c.decider.name);
    }

    async function dismissReport(itemId: number, c: ReviewContext, reason?: string): Promise<AdminResult<Record<string, unknown>>> {
      authed(c);
      await mustBe(itemId, ["seller_correction", "removal"]);
      return svc.reject(itemId, { decider: c.decider, ...(reason ? { reason } : {}) });
    }

    async function applyCorrection(itemId: number, c: ReviewContext): Promise<AdminResult<Record<string, unknown>>> {
      authed(c);
      const item = await mustBe(itemId, ["seller_correction"]);
      // Free-form corrections carry no structured fields — approving them must refuse loudly,
      // never resolve "applied" with nothing applied.
      if (Object.keys(correctionFields(item.proposal)).length === 0) throw new ServiceError(422, "no_fields", "this report carries no structured fields to apply");
      return svc.approve(itemId, {}, { decider: c.decider });
    }

    async function confirmReport(itemId: number, c: ReviewContext): Promise<AdminResult<Record<string, unknown>>> {
      authed(c);
      return svc.confirmReport(itemId, c.decider.name);
    }

    async function applyRemoval(itemId: number, c: ReviewContext): Promise<AdminResult<Record<string, unknown>>> {
      needAdmin(c);
      await mustBe(itemId, ["removal"]);
      return svc.approve(itemId, {}, { decider: c.decider });
    }

    async function retireFromReport(itemId: number, listingId: number, reason: string | null, c: ReviewContext): Promise<AdminResult<Record<string, unknown>>> {
      needAdmin(c);
      const item = await mustBe(itemId, ["seller_correction", "removal"]);
      // The path routes to the report's own listing — never an arbitrary id from the form.
      if (reportListingId(item.proposal) !== listingId) throw new ServiceError(422, "wrong_listing", "that listing is not the one this report names");
      return svc.retireListingFromReport(itemId, listingId, reason, c.decider);
    }

    return {
      waitingList,
      waitingTotal,
      rank,
      selectedAfter,
      locate,
      queueForRef,
      decidedList,
      detail,
      approveSellerCandidate,
      declineSellerCandidate,
      approveFarm,
      declineFarm,
      publishListing,
      addVariety,
      rejectQueuedListing,
      decideDuplicate,
      skipHold,
      dismissReport,
      applyCorrection,
      confirmReport,
      applyRemoval,
      retireFromReport,
    };
  }


export type AdminReviewService = ReturnType<typeof createAdminReviewService>;
