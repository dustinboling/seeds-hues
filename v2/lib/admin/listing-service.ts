/**
 * Listings section service (Slice C): the working-list reads, detail hydration and the
 * E2 mutations. Every mutation authorizes server-side: admins retire and restore (a
 * hidden button is never the enforcement); both roles read through the guarded pages.
 * Validation failures throw ListingValidationError with per-field messages.
 */
import type { Db } from "@/lib/db/client";
import * as admin from "@/lib/repositories/admin";
import type { Decider } from "@/lib/repositories/admin";
import { createAdminService, type AdminResult } from "@/lib/services/admin";
import { ServiceError } from "@/lib/services/ingest";
import { isPrivilegedRole } from "@/lib/admin-auth";
import { composeRetireReason, isRetireReason, type ListingListParams } from "./listings";

export interface ListingContext {
  role: string;
  decider: Decider;
}

function authed(c: ListingContext): void {
  if (!isPrivilegedRole(c.role)) throw new ServiceError(403, "forbidden", "This account doesn't have admin access.");
}

function needAdmin(c: ListingContext): void {
  authed(c);
  if (c.role !== "admin") throw new ServiceError(403, "forbidden", "Your reviewer role doesn't include that action.");
}

export interface FieldError {
  field: string;
  message: string;
}

export class ListingValidationError extends ServiceError {
  fields: FieldError[];
  constructor(fields: FieldError[]) {
    super(422, "invalid_fields", "Something needs attention before continuing.");
    this.fields = fields;
  }
}

function listingIdOr422(raw: unknown): number {
  const n = typeof raw === "string" && /^\d{1,12}$/.test(raw.trim()) ? Number(raw.trim()) : typeof raw === "number" ? raw : NaN;
  if (!Number.isInteger(n) || n <= 0) throw new ListingValidationError([{ field: "listing", message: "Choose a listing first." }]);
  return n;
}

export function createAdminListingService(db: Db, deps: { now?: () => Date } = {}) {
  const svc = createAdminService(db, deps.now ? { now: deps.now } : {});

  /** The working list (E1): the window + the exact total. Both roles read. */
  function listListings(params: ListingListParams): Promise<{ rows: admin.AdminListingRow[]; total: number }> {
    return admin.listListingsAdmin(db, { q: params.q, chip: params.chip, sellerSlug: params.seller, varietySlug: params.variety, limit: params.show, offset: 0 });
  }

  /** One listing + packets + history (E2). Both roles read. */
  async function detail(id: number): Promise<admin.AdminListingDetail | null> {
    return admin.listingDetailById(db, id);
  }

  /** Deep-link chip labels: the seller/variety name for a filter slug (null when unknown). */
  async function filterLabels(f: { seller: string | null; variety: string | null }): Promise<{ seller: { slug: string; name: string } | null; variety: { slug: string; name: string } | null }> {
    const [seller, variety] = await Promise.all([
      f.seller ? admin.sellerChipBySlug(db, f.seller) : Promise.resolve(null),
      f.variety ? admin.varietyChipBySlug(db, f.variety) : Promise.resolve(null),
    ]);
    return { seller, variety: variety ? { slug: variety.slug, name: variety.name } : null };
  }

  /**
   * E2 retire (admin only): the reason label (required, from the confirm's select) with
   * the optional note appended, through the existing removeListing effect with the actor
   * stamped — retire logic is never forked into the UI layer.
   */
  async function retire(raw: Record<string, unknown>, c: ListingContext): Promise<AdminResult<Record<string, unknown>>> {
    needAdmin(c);
    const id = listingIdOr422(raw.listing);
    if (!isRetireReason(raw.reason)) throw new ListingValidationError([{ field: "reason", message: "Choose a reason." }]);
    const note = typeof raw.note === "string" ? raw.note.trim() : "";
    if (note.length > 500) throw new ListingValidationError([{ field: "note", message: "Keep the note under 500 characters." }]);
    return svc.removeListing(id, { reason: composeRetireReason(raw.reason, note || null) }, { actor: c.decider.name });
  }

  /** E2 restore (admin only): a retired listing returns to 'published' with a 'restored' event. */
  async function restore(raw: Record<string, unknown>, c: ListingContext): Promise<AdminResult<Record<string, unknown>>> {
    needAdmin(c);
    const id = listingIdOr422(raw.listing);
    return svc.restoreListing(id, { actor: c.decider.name });
  }

  return { listListings, detail, filterLabels, retire, restore };
}

export type AdminListingService = ReturnType<typeof createAdminListingService>;
