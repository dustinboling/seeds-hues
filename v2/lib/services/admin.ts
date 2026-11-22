/**
 * Admin service (R11 + the R8 removal flow). Every mutating call returns the public paths whose
 * cached HTML must be revalidated; the route layer revalidates them.
 */
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import * as admin from "@/lib/repositories/admin";
import type { Decider } from "@/lib/repositories/admin";
import * as ingest from "@/lib/repositories/ingest";
import * as farmRepo from "@/lib/repositories/farm-submissions";
import { demandStats, rollupDay } from "@/lib/repositories/events";
import { resolveReport } from "@/lib/repositories/reports";
import { AVAILABILITY, REVIEW_ITEM_STATUS, REVIEW_ITEM_TYPE, SELLER_PLATFORMS, SELLER_TYPES } from "@/lib/db/schema";
import { hostOf, hostOnDomain, normalizeName } from "@/lib/names";
import { COLOR_FAMILIES } from "@/lib/validators";
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

/** POST /admin/sellers/{ref}/small-farm — the Small farm badge judgment (Open Directory). */
export const SellerBadgeBodySchema = z.strictObject({ is_small_farm: z.boolean() });

/** POST /api/v1/admin/sellers/{ref}/description — a string sets, null clears. */
export const SellerDescriptionBodySchema = z.strictObject({ description: z.string().max(2000).nullable() });

/**
 * POST /api/v1/admin/varieties/:id/color — the variety Hue filing (Tranche 1.8). Each key
 * is independent: an absent key leaves that field untouched; color_swatch null clears it.
 * "unknown" files the family back to unfiled. At least one key is required.
 */
export const VarietyColorBodySchema = z
  .strictObject({
    color_family: z.enum([...COLOR_FAMILIES, "unknown"] as const).optional(),
    color_swatch: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  })
  .refine((b) => b.color_family !== undefined || b.color_swatch !== undefined, { message: "set color_family and/or color_swatch" });

const PRICE_PATTERNS = [
  /\$\s*\d/,
  /\bUSD\s*\$?\s*\d/i,
  /\b\d+(?:\.\d+)?\s*USD\b/i,
  /\b\d+(?:\.\d+)?\s*(?:dollars?|bucks?)\b/i,
  /\bpriced?\b(?:\s+(?:at|of|is|was|are))?\s*[:–—\-(]?\s*\$?\s*\d/i,
];

const INTERNAL_MARKER_PATTERNS = [
  /(?:^|[\r\n])\s*(?:anchor|badge|feed|note):/i,
  // The audit's C2 shape: capitalized segment labels mid-string — after a pipe
  // separator or sentence-ending punctuation. Case-sensitive on purpose: lowercase
  // lookalikes inside ordinary sentences ("Take note: ...") stay clean.
  /(?:\||[.!?])\s*(?:Anchor|Badge|Feed|Note):/,
  /hue\s+review/i,
  /coordinator\s+to\s+verify/i,
  // A dated verification stamp ("verified 2026-11-19", "verified on the product
  // page 2026-11-19"); an undated "verified ..." stays clean.
  /verified(?:\s+[A-Za-z][A-Za-z'-]*){0,5}\s+\d{4}-\d{2}-\d{2}/i,
];

/**
 * The seller-description publication guard (audit 2026-11-21 C1 + C2): prices are
 * captured but NEVER shown, and working notes never publish as About copy. Pure —
 * returns the matched violation class names (empty = clean).
 */
export function descriptionViolations(text: string): string[] {
  const out: string[] = [];
  if (PRICE_PATTERNS.some((re) => re.test(text))) out.push("price");
  if (INTERNAL_MARKER_PATTERNS.some((re) => re.test(text))) out.push("internal_marker");
  return out;
}

/**
 * Slice B (D3): the general admin seller update (Hue resolution 1) — CORRECTABLE plus
 * type, platform, country, contactEmail. type/platform validate against the schema enums.
 * Nullable fields take null to clear (the UI normalizes empty inputs to null first).
 */
export const SellerUpdateBodySchema = z
  .strictObject({
    name: z.string().trim().min(1, "enter a name").max(200).optional(),
    type: z.enum(SELLER_TYPES).optional(),
    platform: z.enum(SELLER_PLATFORMS).nullable().optional(),
    homepage: z.string().trim().url("enter a full web address, starting with https://").max(2000).nullable().optional(),
    contactEmail: z.email("enter a valid email address").max(320).nullable().optional(),
    location: z.string().trim().max(200).nullable().optional(),
    region: z.string().trim().max(10).nullable().optional(),
    country: z.string().trim().min(1).max(80).optional(),
    shipsTo: z.array(z.string().trim().min(1).max(10)).max(60).optional(),
    description: z.string().max(2000).nullable().optional(),
    orderingNotes: z.string().max(2000).nullable().optional(),
  });

/** Slice B (D4): the classification save — the badge judgment plus the optional Why note. */
export const SellerClassifyBodySchema = z.strictObject({ is_small_farm: z.boolean(), note: z.string().trim().max(2000).optional() });

/** Slice B (D2 danger zone): deactivate → inactive, reactivate → active. */
export const SellerStatusBodySchema = z.strictObject({ status: z.enum(["active", "inactive"]) });

/** Slice B (D5): the note composer — both roles. */
export const SellerNoteBodySchema = z.strictObject({ body: z.string().trim().min(1, "write the note first").max(2000) });

export const ListingRemoveBodySchema = z.strictObject({ reason: z.string().max(500).optional() }).default({});

export const JobBodySchema = z.strictObject({ type: z.string().min(1).max(50), target: z.string().min(1).max(2000) });

const isoDate = z.string().min(1).max(40).refine((s) => !Number.isNaN(Date.parse(s)), "must be an ISO date");

/**
 * The scout-holds feed payload (Slice A §6): a POSSIBLE-DUPLICATE hold as one pending
 * `duplicate_hold` queue item. `crop` is the held name's plant slug; `candidate.variety_id`
 * is the existing variety it may duplicate.
 */
export const DuplicateHoldBodySchema = z.strictObject({
  held_name: z.string().trim().min(1).max(200),
  crop: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  seller_id: z.number().int().positive(),
  seller_slug: z.string().max(160).optional(),
  listing: z.strictObject({
    productUrl: z.string().url().max(2000),
    titleRaw: z.string().max(500).nullable().optional(),
    availability: z.enum(AVAILABILITY).optional(),
    checkedAt: isoDate,
  }),
  candidate: z.strictObject({
    variety_id: z.number().int().positive(),
    name: z.string().trim().min(1).max(200),
    slug: z.string().max(160).optional(),
  }),
  evidence_quote: z.string().trim().min(1).max(2000),
  hold_reason: z.string().trim().min(1).max(2000),
  source: z.string().trim().min(1).max(40).default("scout"),
});

export type DuplicateHoldBody = z.infer<typeof DuplicateHoldBodySchema>;

/** Provenance marker written only by duplicate decisions (RA-1; Slice C's F2 keys off it). */
export const DUPLICATE_DECISION_SOURCE = "duplicate_decision";

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

  async function publishProposal(p: ListingProposal, varietyId: number, aliasKind: "seller_alias" | "synonym", provenance?: admin.AliasProvenance) {
    const seller = await ingest.sellerByRef(db, p.seller_id);
    if (!seller || seller.eligibility !== "approved") throw new AdminError(409, "seller_not_approved", "the listing's seller is not approved");
    if (await ingest.isBlockedDomain(db, [hostOf(p.listing.productUrl) ?? "", seller.domain ?? ""])) throw new AdminError(409, "blocked_domain", "domain is blocked");
    const variety = await ingest.varietyForMatch(db, varietyId);
    if (!variety || variety.status !== "active") throw new AdminError(404, "variety_not_found", `variety ${varietyId} not found`);
    const r = await ingest.upsertObservedListing(db, { ...p.listing, varietyId, matchMethod: "human", confidence: 1 });
    // Publish trigger (Phase 3): an approved listing may be a waited-for variety's first.
    await notifyWaitlists(db, [varietyId], now());
    if (p.extracted_name && p.extracted_name !== "unknown" && p.extracted_name !== variety.name) {
      await admin.addAlias(db, varietyId, p.extracted_name, aliasKind, variety.commonName, provenance);
    }
    return { listing_id: r.listingId, variety_slug: variety.slug, seller_slug: seller.slug };
  }

  /** A stored duplicate_hold proposal, validated (a malformed hold fails loudly, never half-applies). */
  function holdProposal(p: Record<string, unknown>) {
    const listing = asRecord(p.listing);
    const candidate = asRecord(p.candidate);
    const heldName = typeof p.held_name === "string" ? p.held_name.trim() : "";
    const crop = typeof p.crop === "string" ? p.crop : "";
    const sellerId = typeof p.seller_id === "number" ? p.seller_id : 0;
    const candidateId = typeof candidate.variety_id === "number" ? candidate.variety_id : 0;
    const productUrl = typeof listing.productUrl === "string" ? listing.productUrl : "";
    const checkedAt = typeof listing.checkedAt === "string" && !Number.isNaN(Date.parse(listing.checkedAt)) ? listing.checkedAt : "";
    if (!heldName || !crop || !Number.isInteger(sellerId) || sellerId <= 0 || !Number.isInteger(candidateId) || candidateId <= 0 || !productUrl || !checkedAt) {
      throw new AdminError(422, "malformed_hold", "this hold's proposal is missing its held name, crop, seller, listing or candidate");
    }
    return {
      heldName,
      crop,
      sellerId,
      candidateId,
      candidateName: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : `variety #${candidateId}`,
      listing: {
        sellerId,
        productUrl,
        variantKey: "",
        externalProductId: null as string | null,
        titleRaw: typeof listing.titleRaw === "string" ? listing.titleRaw : null,
        availability: (typeof listing.availability === "string" ? listing.availability : "unknown") as ListingProposal["listing"]["availability"],
        sourceUrl: productUrl,
        checkedAt,
      },
    };
  }

  async function decideDuplicateHold(
    item: { id: number; proposal: Record<string, unknown> },
    outcome: "duplicate" | "not_duplicate",
    decider?: Decider,
  ): Promise<AdminResult<Record<string, unknown>>> {
    const h = holdProposal(item.proposal);
    const at = iso();
    if (outcome === "duplicate") {
      const candidate = await ingest.varietyForMatch(db, h.candidateId);
      // Merged/renamed/retired meanwhile: the UI reloads the pane with the fresh state.
      if (!candidate || candidate.status !== "active") throw new AdminError(409, "variety_changed", "the existing variety changed while this hold was waiting");
      const published = await publishProposal(
        { seller_id: h.sellerId, variety_id: h.candidateId, crop: h.crop, extracted_name: h.heldName, listing: h.listing },
        h.candidateId,
        "synonym",
        decider ? { source: DUPLICATE_DECISION_SOURCE, decisionItemId: item.id, decidedByName: decider.name, createdAt: at } : undefined,
      );
      await admin.resolveReviewItem(db, item.id, "merged", at, decider ? { decider } : {});
      return {
        data: { id: item.id, type: "duplicate_hold", status: "merged", held_name: h.heldName, existing: candidate.name, ...published },
        revalidate: [`/variety/${candidate.slug}`, `/seller/${published.seller_slug}`],
      };
    }
    const v = await admin.createVariety(db, { plantSlug: h.crop, name: h.heldName, at });
    if (!v) throw new AdminError(422, "unknown_crop", `crop ${h.crop} not found`);
    const published = await publishProposal(
      { seller_id: h.sellerId, variety_id: v.id, crop: h.crop, extracted_name: h.heldName, listing: h.listing },
      v.id,
      "seller_alias",
    );
    await admin.resolveReviewItem(db, item.id, "approved", at, decider ? { decider } : {});
    return {
      data: { id: item.id, type: "duplicate_hold", status: "approved", held_name: h.heldName, variety_id: v.id, ...published },
      revalidate: [`/variety/${v.slug}`, `/crop/${h.crop}`, "/sitemap.xml"],
    };
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

  async function removeListing(id: number, body: z.infer<typeof ListingRemoveBodySchema>, opts: { actor?: string | null } = {}): Promise<AdminResult<Record<string, unknown>>> {
    const r = await admin.removeListing(db, id, body.reason ?? null, iso(), opts.actor ?? null);
    if (!r) throw new AdminError(404, "listing_not_found", `listing ${id} not found`);
    return {
      data: { listing_id: id, status: "removed", already_removed: r.alreadyRemoved },
      // The variety page lists it and the seller page counts it; the variety stays indexable, so no sitemap change.
      revalidate: [`/variety/${r.varietySlug}`, `/seller/${r.sellerSlug}`],
    };
  }

  /**
   * Restore a retired listing (Slice C, E2 — driven by the admin session only). Unknown
   * id → 404; a non-removed listing is a no-op naming why (`not_removed`), with nothing
   * written. Success flips to 'published' with a 'restored' event carrying the actor.
   */
  async function restoreListing(id: number, opts: { actor?: string | null } = {}): Promise<AdminResult<Record<string, unknown>>> {
    const r = await admin.restoreListing(db, id, iso(), opts.actor ?? null);
    if (!r) throw new AdminError(404, "listing_not_found", `listing ${id} not found`);
    if (!r.restored) return { data: { listing_id: id, restored: false, why: r.why }, revalidate: [] };
    return {
      data: { listing_id: id, status: "published", restored: true },
      revalidate: [`/variety/${r.varietySlug}`, `/seller/${r.sellerSlug}`],
    };
  }

  /**
   * Remove a variety (Slice C — driven by the F2 danger zone AND the key-based admin API
   * as POST /api/v1/admin/varieties/:id/remove, one effect). Unknown id → 404; a second
   * remove reports already_removed with nothing written; live listings present → 409
   * naming the count. Success removes the public page, so the variety, crop, directory
   * and sitemap paths revalidate.
   */
  async function removeVariety(id: number): Promise<AdminResult<Record<string, unknown>>> {
    const r = await admin.removeVariety(db, id, iso());
    if (!r) throw new AdminError(404, "variety_not_found", `variety ${id} not found`);
    if (r.outcome === "blocked") {
      const n = r.liveListings;
      throw new AdminError(409, "variety_has_listings", `this variety still has ${n} live ${n === 1 ? "listing" : "listings"} — retire ${n === 1 ? "it" : "them"} before removing the variety`);
    }
    return {
      data: { variety_id: id, slug: r.slug, already_removed: r.outcome === "already_removed" },
      revalidate: [`/variety/${r.slug}`, `/crop/${r.plantSlug}`, "/variety", "/sitemap.xml"],
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

  /**
   * The variety color write (Tranche 1.8): the ONE funnel for color_family / color_swatch
   * updates, so any future caller (admin UI included) gets identical validation, the
   * changed-field list, the catalog sequence bump, and the revalidation set. Each key is
   * independent (an absent key leaves that field untouched); a hex is stored
   * uppercase-normalized like the importer's writes.
   */
  async function varietyColorUpdate(ref: string, body: z.infer<typeof VarietyColorBodySchema>): Promise<AdminResult<Record<string, unknown>>> {
    const variety = await ingest.varietyForMatch(db, /^\d+$/.test(ref) ? Number(ref) : ref);
    if (!variety) throw new AdminError(404, "variety_not_found", `variety ${ref} not found`);
    const patch: admin.VarietyColorPatch = {};
    if (body.color_family !== undefined) patch.colorFamily = body.color_family;
    if (body.color_swatch !== undefined) patch.colorSwatch = body.color_swatch === null ? null : body.color_swatch.toUpperCase();
    const changed = await admin.updateVarietyColor(db, variety.id, patch, iso());
    return {
      data: { variety: variety.slug, id: variety.id, changed },
      revalidate: [`/variety/${variety.slug}`, `/crop/${variety.plantSlug}`, "/variety"],
    };
  }

  return {
    removeListing,
    restoreListing,
    removeVariety,
    varietyColorUpdate,

    listReview: (q: z.infer<typeof ReviewListQuerySchema>, limit: number) => admin.listReviewItems(db, { ...q, limit }),

    async approve(id: number, body: z.infer<typeof ApproveBodySchema>, opts: { decider?: Decider } = {}): Promise<AdminResult<Record<string, unknown>>> {
      const item = await itemOr404(id);
      // Dustin ruling 2026-11-21: a duplicate hold is decided ONLY through decideDuplicate
      // (the admin UI) — never through this generic path, where approve would silently mean
      // "not a duplicate" and create the variety.
      if (item.type === "duplicate_hold") throw new AdminError(422, "duplicate_hold_ui_only", `review item ${id} is a duplicate hold, decided in the admin UI only`);
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
        // duplicate_hold is refused above (decideDuplicate in the admin UI is its only
        // decision path); the narrowed type keeps it out of this switch.
      }
      await admin.resolveReviewItem(db, id, "approved", iso(), opts.decider ? { decider: opts.decider } : {});
      return { data: { id, type: item.type, status: "approved", ...data }, revalidate };
    },

    async reject(id: number, opts: { decider?: Decider; reason?: string } = {}): Promise<AdminResult<Record<string, unknown>>> {
      const item = await itemOr404(id);
      // Dustin ruling 2026-11-21: same refusal as approve — decideDuplicate only.
      if (item.type === "duplicate_hold") throw new AdminError(422, "duplicate_hold_ui_only", `review item ${id} is a duplicate hold, decided in the admin UI only`);
      await admin.resolveReviewItem(db, id, "rejected", iso(), { ...(opts.decider ? { decider: opts.decider } : {}), ...(opts.reason ? { reason: opts.reason } : {}) });
      await closeReport(item.proposal, "dismissed");
      return { data: { id, type: item.type, status: "rejected" }, revalidate: [] };
    },

    async merge(id: number, body: z.infer<typeof MergeBodySchema>, opts: { decider?: Decider } = {}): Promise<AdminResult<Record<string, unknown>>> {
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
      await admin.resolveReviewItem(db, id, "merged", iso(), opts.decider ? { decider: opts.decider } : {});
      return { data: { id, status: "merged", merged, ...published }, revalidate: [...revalidate, `/seller/${published.seller_slug}`] };
    },

    /**
     * The scout-holds feed (Slice A §6): validate the hold, then insert it — idempotent on
     * (normalized held name + candidate variety id): re-submitting a pending hold returns the
     * existing item instead of a second row.
     */
    async createDuplicateHold(body: DuplicateHoldBody): Promise<{ id: number; type: string; status: string; created: boolean }> {
      const candidate = await ingest.varietyForMatch(db, body.candidate.variety_id);
      if (!candidate || candidate.status !== "active") throw new AdminError(422, "unknown_candidate", `candidate variety ${body.candidate.variety_id} is not an active variety`);
      const seller = await ingest.sellerByRef(db, body.seller_id);
      if (!seller) throw new AdminError(422, "unknown_seller", `seller ${body.seller_id} not found`);
      const plant = await admin.plantBySlug(db, body.crop);
      const groupKey = normalizeName(body.held_name, plant?.commonName ?? null);
      const existing = await admin.findPendingDuplicateHold(db, groupKey, candidate.id);
      if (existing) return { id: existing.id, type: "duplicate_hold", status: "pending", created: false };
      const id = await admin.insertReviewItem(db, { type: "duplicate_hold", groupKey, proposal: body, reason: "scout:possible_duplicate", confidence: null, at: iso() });
      return { id, type: "duplicate_hold", status: "pending", created: true };
    },

    /** A UI duplicate decision (both outcomes; both roles — the role check lives in the review service). */
    async decideDuplicate(id: number, outcome: "duplicate" | "not_duplicate", opts: { decider?: Decider } = {}): Promise<AdminResult<Record<string, unknown>>> {
      const item = await itemOr404(id);
      if (item.type !== "duplicate_hold") throw new AdminError(422, "not_a_hold", `review item ${id} is not a duplicate hold`);
      return decideDuplicateHold(item, outcome, opts.decider);
    },

    /** Reviewer confirm on a report: stamped verified, still pending (an admin acts next). */
    async confirmReport(id: number, name: string): Promise<AdminResult<Record<string, unknown>>> {
      const item = await itemOr404(id);
      if (item.type !== "seller_correction" && item.type !== "removal") throw new AdminError(422, "not_a_report", `review item ${id} is not a report`);
      await admin.stampReviewVerified(db, id, name, iso());
      return { data: { id, type: item.type, status: "pending", verified_by: name }, revalidate: [] };
    },

    /** Skip a hold for now: recorded as seen, never as decided — the item stays pending. */
    async skipHold(id: number, name: string): Promise<AdminResult<Record<string, unknown>>> {
      const item = await itemOr404(id);
      if (item.type !== "duplicate_hold") throw new AdminError(422, "not_a_hold", `review item ${id} is not a duplicate hold`);
      await admin.stampReviewSeen(db, id, name, iso());
      return { data: { id, type: item.type, status: "pending", seen_by: name }, revalidate: [] };
    },

    /**
     * Approve an Add Your Farm submission (Slice A C2): create the candidate seller from the
     * submission (the system proposes the slug), link it, and mark the submission approved
     * with the decider. A candidate is not publicly listed — no public paths change. Never
     * touches the farm-owner flag (Slice C's G2 owns that).
     */
    async approveFarmCandidate(id: number, decider: Decider): Promise<AdminResult<Record<string, unknown>>> {
      const sub = await farmRepo.farmSubmissionById(db, id);
      if (!sub) throw new AdminError(404, "not_found", `farm submission ${id} not found`);
      if (sub.status !== "pending") throw new AdminError(409, "already_resolved", `farm submission ${id} is ${sub.status}`);
      const domain = hostOf(sub.website);
      if (!domain) throw new AdminError(422, "bad_website", "the submission's website is not a usable web address");
      if (await ingest.isBlockedDomain(db, [domain])) throw new AdminError(409, "blocked_domain", `${domain} is blocked`);
      if (await ingest.sellerByDomain(db, domain)) throw new AdminError(409, "seller_exists", `${domain} already exists`);
      const at = iso();
      const s = await admin.createCandidateSeller(db, { name: sub.farmName, homepage: sub.website, domain, at });
      await farmRepo.updateFarmSubmission(db, id, { status: "approved", reviewedAt: at, reviewedBy: decider.name, sellerId: s.id });
      return { data: { id, type: "farm_submission", status: "approved", seller_id: s.id, seller_slug: s.slug, farm_name: sub.farmName }, revalidate: [] };
    },

    /** Decline an Add Your Farm submission: the optional reason is kept in decision_note. */
    async rejectFarmSubmission(id: number, opts: { decider: Decider; reason?: string }): Promise<AdminResult<Record<string, unknown>>> {
      const sub = await farmRepo.farmSubmissionById(db, id);
      if (!sub) throw new AdminError(404, "not_found", `farm submission ${id} not found`);
      if (sub.status !== "pending") throw new AdminError(409, "already_resolved", `farm submission ${id} is ${sub.status}`);
      await farmRepo.updateFarmSubmission(db, id, { status: "rejected", reviewedAt: iso(), reviewedBy: opts.decider.name, ...(opts.reason ? { decisionNote: opts.reason } : {}) });
      return { data: { id, type: "farm_submission", status: "rejected", farm_name: sub.farmName }, revalidate: [] };
    },

    /**
     * Retire a listing routed from a report (Slice A C5, admin only — the role check lives in
     * the review service): the shipped listing-retire effect, then the report resolves with
     * the decider (its remedy applied).
     */
    async retireListingFromReport(id: number, listingId: number, reason: string | null, decider: Decider): Promise<AdminResult<Record<string, unknown>>> {
      const item = await itemOr404(id);
      if (item.type !== "seller_correction" && item.type !== "removal") throw new AdminError(422, "not_a_report", `review item ${id} is not a report`);
      const r = await removeListing(listingId, { reason: reason ?? undefined }, { actor: decider.name });
      const at = iso();
      await admin.resolveReviewItem(db, id, "approved", at, { decider });
      await closeReport(item.proposal, "resolved");
      const removed = r.data as { already_removed: boolean };
      return { data: { id, type: item.type, status: "approved", listing_id: listingId, listing_status: "removed", already_removed: removed.already_removed }, revalidate: r.revalidate };
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

    /**
     * Set or clear the "Small farm" badge. A judgment call recorded in seller-classification.md
     * (edit that record in the same change); independent of eligibility. A seller removed at its
     * request is not re-badged.
     */
    async sellerBadge(ref: string, isSmallFarm: boolean) {
      const seller = await ingest.sellerByRef(db, ref);
      if (!seller) throw new AdminError(404, "seller_not_found", `seller ${ref} not found`);
      if (seller.eligibility === "removed_by_request") throw new AdminError(409, "seller_removed", `${seller.slug} was removed at its request`);
      const { varietySlugs } = await admin.setSellerSmallFarm(db, seller.id, isSmallFarm, iso());
      return {
        data: { seller: seller.slug, id: seller.id, is_small_farm: isSmallFarm },
        // sellerAction's set, plus every variety page that lists this seller: those ISR pages show
        // the badge on its rows and decide the Small-farms chip pair from it (each variety path is
        // expanded to its small-farms view by withVariantPaths).
        revalidate: [`/seller/${seller.slug}`, "/seller", "/sitemap.xml", ...varietySlugs.map((s) => `/variety/${s}`)],
      };
    },

    /**
     * Slice B (D3): the general admin seller update (resolution 1). Changes exactly the
     * submitted fields and returns the changed-field list the D2 status line renders. Never
     * touches eligibility — a D3 save alone never publishes (resolution 4).
     */
    async sellerUpdate(ref: string, body: z.infer<typeof SellerUpdateBodySchema>): Promise<AdminResult<Record<string, unknown>>> {
      const seller = await ingest.sellerByRef(db, ref);
      if (!seller) throw new AdminError(404, "seller_not_found", `seller ${ref} not found`);
      if (seller.eligibility === "removed_by_request") throw new AdminError(409, "seller_removed", `${seller.slug} was removed at its request`);
      if (typeof body.description === "string") {
        const violations = descriptionViolations(body.description);
        if (violations.length > 0) throw new AdminError(422, "description_rejected", `description rejected: ${violations.join(", ")}`);
      }
      const changed = await admin.updateSellerFields(db, seller.id, body, iso());
      const varietySlugs = await admin.sellerVisibleVarietySlugs(db, seller.id);
      return {
        data: { seller: seller.slug, id: seller.id, changed },
        revalidate: [`/seller/${seller.slug}`, "/seller", "/sitemap.xml", ...varietySlugs.map((s) => `/variety/${s}`)],
      };
    },

    /**
     * Slice B (D4): the classification save through the badge write — plus, on a candidate
     * seller, eligibility → approved via the existing setSellerEligibility, because
     * classification is the last of the two named completion steps (resolution 4). The
     * optional Why note files into seller_notes authored by the decider.
     */
    async sellerClassify(
      ref: string,
      body: z.infer<typeof SellerClassifyBodySchema>,
      opts: { decider?: Decider & { role: string } } = {},
    ): Promise<AdminResult<Record<string, unknown>>> {
      const seller = await ingest.sellerByRef(db, ref);
      if (!seller) throw new AdminError(404, "seller_not_found", `seller ${ref} not found`);
      if (seller.eligibility === "removed_by_request") throw new AdminError(409, "seller_removed", `${seller.slug} was removed at its request`);
      const at = iso();
      const { varietySlugs } = await admin.setSellerSmallFarm(db, seller.id, body.is_small_farm, at);
      const published = seller.eligibility === "candidate";
      if (published) await admin.setSellerEligibility(db, seller.id, "approved", at);
      let noteId: number | null = null;
      if (body.note && opts.decider) {
        noteId = await admin.addSellerNote(db, { sellerId: seller.id, authorUserId: opts.decider.userId, authorName: opts.decider.name, authorRole: opts.decider.role, body: body.note, at });
      }
      return {
        data: { seller: seller.slug, id: seller.id, is_small_farm: body.is_small_farm, published, ...(noteId !== null ? { note_id: noteId } : {}) },
        revalidate: [`/seller/${seller.slug}`, "/seller", "/sitemap.xml", ...varietySlugs.map((s) => `/variety/${s}`)],
      };
    },

    /**
     * Slice B (D2 danger zone): deactivate (status → inactive) / reactivate (→ active).
     * Nothing is deleted; the public layer hides an inactive seller through visibleSeller
     * (resolution 2).
     */
    async sellerSetStatus(ref: string, body: z.infer<typeof SellerStatusBodySchema>): Promise<AdminResult<Record<string, unknown>>> {
      const seller = await ingest.sellerByRef(db, ref);
      if (!seller) throw new AdminError(404, "seller_not_found", `seller ${ref} not found`);
      if (seller.eligibility === "removed_by_request") throw new AdminError(409, "seller_removed", `${seller.slug} was removed at its request`);
      const { varietySlugs } = await admin.setSellerStatus(db, seller.id, body.status, iso());
      return {
        data: { seller: seller.slug, id: seller.id, status: body.status },
        revalidate: [`/seller/${seller.slug}`, "/seller", "/sitemap.xml", ...varietySlugs.map((s) => `/variety/${s}`)],
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
