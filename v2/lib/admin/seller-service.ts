/**
 * Sellers section service (Slice B): the working-list reads, detail hydration and the UI
 * mutations. Every mutation authorizes server-side: admins edit, classify, deactivate,
 * reactivate and remove; both roles read and add notes (a hidden button is never the
 * enforcement). Validation failures throw SellerValidationError with per-field messages.
 */
import type { Db } from "@/lib/db/client";
import * as admin from "@/lib/repositories/admin";
import type { Decider } from "@/lib/repositories/admin";
import { createAdminService, SellerClassifyBodySchema, SellerNoteBodySchema, SellerUpdateBodySchema, type AdminResult } from "@/lib/services/admin";
import { ServiceError } from "@/lib/services/ingest";
import { isPrivilegedRole } from "@/lib/admin-auth";
import { parseShipsTo, type SellerListParams } from "./sellers";

export interface SellerContext {
  role: string;
  decider: Decider;
}

function authed(c: SellerContext): void {
  if (!isPrivilegedRole(c.role)) throw new ServiceError(403, "forbidden", "This account doesn't have admin access.");
}

function needAdmin(c: SellerContext): void {
  authed(c);
  if (c.role !== "admin") throw new ServiceError(403, "forbidden", "Your reviewer role doesn't include that action.");
}

export interface FieldError {
  field: string;
  message: string;
}

export class SellerValidationError extends ServiceError {
  fields: FieldError[];
  constructor(fields: FieldError[]) {
    super(422, "invalid_fields", "Some fields need attention before saving.");
    this.fields = fields;
  }
}

/** Zod's enum message is log-speak ("Invalid option: expected one of…") — say it plainly. */
function friendlyIssue(field: string, message: string): string {
  if (message.startsWith("Invalid option")) return "Choose one of the options.";
  return message.endsWith(".") ? message : `${message}.`;
}

function asFieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }): FieldError[] {
  return error.issues.map((i) => {
    const field = typeof i.path[0] === "string" ? i.path[0] : "form";
    return { field, message: friendlyIssue(field, i.message) };
  });
}

/** Non-empty trimmed text, or null (nullable fields clear on empty). */
function nullableText(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : null;
}

/** Required-ish text: passes through (possibly empty) so the schema reports it. */
function rawText(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return typeof v === "string" ? v : undefined;
}

/**
 * A D3 submission (form fields or JSON): only present keys update ("changes exactly the
 * submitted fields"); empty nullable inputs clear; ships_to arrives as comma-separated text
 * (resolution 6) or an array; platform "none"/empty clears.
 */
function normalizeUpdate(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (raw.name !== undefined) out.name = rawText(raw.name);
  if (raw.type !== undefined) out.type = rawText(raw.type);
  if (raw.platform !== undefined) {
    const p = rawText(raw.platform);
    out.platform = p === undefined || p === "" || p === "none" ? null : p;
  }
  for (const k of ["homepage", "contactEmail", "location", "region", "description", "orderingNotes"] as const) {
    if (raw[k] !== undefined) out[k] = nullableText(raw[k]);
  }
  if (raw.country !== undefined) out.country = rawText(raw.country);
  if (raw.shipsTo !== undefined) out.shipsTo = typeof raw.shipsTo === "string" ? parseShipsTo(raw.shipsTo) : raw.shipsTo;
  return out;
}

function normalizeClassify(raw: Record<string, unknown>): { is_small_farm: unknown; note?: unknown } {
  const v = raw.is_small_farm;
  const bool = typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : v;
  return { is_small_farm: bool, ...(raw.note !== undefined ? { note: typeof raw.note === "string" ? raw.note : raw.note } : {}) };
}

export function createAdminSellerService(db: Db, deps: { now?: () => Date } = {}) {
  const svc = createAdminService(db, deps.now ? { now: deps.now } : {});

  /** The working list (D1): full filtered list + exact total. Both roles read. */
  function listSellers(params: SellerListParams): Promise<{ rows: admin.AdminSellerListRow[]; total: number }> {
    return admin.listSellersAdmin(db, { q: params.q, badge: params.badge, state: params.state, sort: params.sort });
  }

  /** The full admin record + first listings + notes (D2). Both roles read. */
  async function detail(slug: string): Promise<admin.AdminSellerDetail | null> {
    return admin.sellerDetailBySlug(db, slug);
  }

  /** The seller's notes newest-first (the D5 read). Both roles read. */
  async function listNotes(ref: string, c: SellerContext): Promise<admin.SellerNote[]> {
    authed(c);
    const seller = await admin.sellerRecordByRef(db, ref);
    if (!seller) throw new ServiceError(404, "seller_not_found", `seller ${ref} not found`);
    return admin.listSellerNotes(db, seller.id);
  }

  /** D3 save (admin only): exactly the submitted fields change; the changed list comes back. */
  async function updateSeller(ref: string, raw: Record<string, unknown>, c: SellerContext): Promise<AdminResult<Record<string, unknown>>> {
    needAdmin(c);
    const parsed = SellerUpdateBodySchema.safeParse(normalizeUpdate(raw));
    if (!parsed.success) throw new SellerValidationError(asFieldErrors(parsed.error));
    return svc.sellerUpdate(ref, parsed.data);
  }

  /** D4 save (admin only): the badge write; on a candidate also eligibility → approved. */
  async function classifySeller(ref: string, raw: Record<string, unknown>, c: SellerContext): Promise<AdminResult<Record<string, unknown>>> {
    needAdmin(c);
    const parsed = SellerClassifyBodySchema.safeParse(normalizeClassify(raw));
    if (!parsed.success) throw new SellerValidationError(asFieldErrors(parsed.error));
    return svc.sellerClassify(ref, parsed.data, { decider: { ...c.decider, role: c.role } });
  }

  /** Deactivate / reactivate (admin only). */
  async function setStatus(ref: string, status: "active" | "inactive", c: SellerContext): Promise<AdminResult<Record<string, unknown>>> {
    needAdmin(c);
    if (status !== "active" && status !== "inactive") throw new SellerValidationError([{ field: "status", message: "Choose active or inactive." }]);
    return svc.sellerSetStatus(ref, { status });
  }

  /** Remove (admin only): the existing removal flow, unchanged. */
  async function removeSeller(ref: string, c: SellerContext, reason?: string): Promise<AdminResult<Record<string, unknown>>> {
    needAdmin(c);
    return svc.sellerAction(ref, "remove", reason ? { reason } : {});
  }

  /** D5 composer (both roles): the note files authored by the signed-in decider. */
  async function addNote(ref: string, raw: Record<string, unknown>, c: SellerContext): Promise<{ note: admin.SellerNote }> {
    authed(c);
    const parsed = SellerNoteBodySchema.safeParse({ body: typeof raw.body === "string" ? raw.body : raw.body });
    if (!parsed.success) throw new SellerValidationError(asFieldErrors(parsed.error));
    const seller = await admin.sellerRecordByRef(db, ref);
    if (!seller) throw new ServiceError(404, "seller_not_found", `seller ${ref} not found`);
    const at = (deps.now ?? (() => new Date()))().toISOString();
    const id = await admin.addSellerNote(db, { sellerId: seller.id, authorUserId: c.decider.userId, authorName: c.decider.name, authorRole: c.role, body: parsed.data.body, at });
    const notes = await admin.listSellerNotes(db, seller.id);
    const note = notes.find((n) => n.id === id)!;
    return { note };
  }

  return { listSellers, detail, listNotes, updateSeller, classifySeller, setStatus, removeSeller, addNote };
}

export type AdminSellerService = ReturnType<typeof createAdminSellerService>;
