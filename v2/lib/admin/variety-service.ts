/**
 * Varieties section service (Slice C): the working-list reads, crops, detail hydration,
 * alias management and the variety remove. Every mutation authorizes server-side: admins
 * add/remove aliases and remove varieties (a hidden button is never the enforcement);
 * both roles read through the guarded pages. RA-1 is enforced here, not just in the
 * rendering: a decision alias is never removable no matter how the request arrives.
 */
import type { Db } from "@/lib/db/client";
import * as admin from "@/lib/repositories/admin";
import type { Decider } from "@/lib/repositories/admin";
import { createAdminService, DUPLICATE_DECISION_SOURCE, type AdminResult } from "@/lib/services/admin";
import { ServiceError } from "@/lib/services/ingest";
import { isPrivilegedRole } from "@/lib/admin-auth";
import { normalizeName } from "@/lib/names";
import { statusWordForListing } from "./listings";
import type { VarietyListParams } from "./varieties";

export interface VarietyContext {
  role: string;
  decider: Decider;
}

function authed(c: VarietyContext): void {
  if (!isPrivilegedRole(c.role)) throw new ServiceError(403, "forbidden", "This account doesn't have admin access.");
}

function needAdmin(c: VarietyContext): void {
  authed(c);
  if (c.role !== "admin") throw new ServiceError(403, "forbidden", "Your reviewer role doesn't include that action.");
}

export interface FieldError {
  field: string;
  message: string;
}

export class VarietyValidationError extends ServiceError {
  fields: FieldError[];
  constructor(fields: FieldError[]) {
    super(422, "invalid_fields", "Something needs attention before continuing.");
    this.fields = fields;
  }
}

export interface VarietyListingCount {
  word: string;
  n: number;
}

export interface VarietyDetail extends admin.AdminVarietyDetail {
  /** The variety's listings counted by resolution-5 status words (A–Z by word). */
  listingCounts: VarietyListingCount[];
  listingTotal: number;
  /** Live listings (resolution 3's definition) — the danger-zone number, server-counted. */
  liveListingCount: number;
}

export function createAdminVarietyService(db: Db, deps: { now?: () => Date } = {}) {
  const svc = createAdminService(db, deps.now ? { now: deps.now } : {});

  async function refOr404(ref: string): Promise<{ id: number; slug: string; name: string }> {
    const v = await admin.varietyRefBySlugOrId(db, ref);
    if (!v) throw new ServiceError(404, "variety_not_found", `variety ${ref} not found`);
    return v;
  }

  /** The working list (F1): the window + the exact total. Both roles read. */
  function listVarieties(params: VarietyListParams): Promise<{ rows: admin.AdminVarietyRow[]; total: number }> {
    return admin.listVarietiesAdmin(db, { q: params.q, crop: params.crop, limit: params.show, offset: 0 });
  }

  /** The crops list (F3, orientation only). Both roles read. */
  function listCrops(): Promise<admin.AdminCropRow[]> {
    return admin.listCropsAdmin(db);
  }

  /** One admin variety view (F2). Both roles read; null when missing or removed. */
  async function detail(slug: string): Promise<VarietyDetail | null> {
    const d = await admin.varietyDetailBySlugAdmin(db, slug);
    if (!d) return null;
    const byWord = new Map<string, number>();
    for (const s of d.listingStates) {
      const word = statusWordForListing(s);
      byWord.set(word, (byWord.get(word) ?? 0) + 1);
    }
    return {
      ...d,
      listingCounts: [...byWord.entries()].map(([word, n]) => ({ word, n })).sort((a, b) => (a.word < b.word ? -1 : 1)),
      listingTotal: d.listingStates.length,
      liveListingCount: await admin.liveListingCountForVariety(db, d.id),
    };
  }

  /**
   * Add another name (admin only): kind = 'synonym', provenance NULL, the catalog's seq
   * conventions via the shared addAlias write. Refusals write nothing: blank; the
   * variety's own name (normalized); already an alias of this variety (normalized).
   */
  async function addAlias(varietyRef: string, raw: Record<string, unknown>, c: VarietyContext): Promise<{ alias: string }> {
    needAdmin(c);
    const v = await refOr404(varietyRef);
    const d = await admin.varietyDetailBySlugAdmin(db, v.slug);
    if (!d) throw new ServiceError(404, "variety_not_found", `variety ${varietyRef} not found`);
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) throw new VarietyValidationError([{ field: "name", message: "Enter another name." }]);
    if (name.length > 200) throw new VarietyValidationError([{ field: "name", message: "Keep the name under 200 characters." }]);
    const normalized = normalizeName(name, d.commonName);
    if (normalized === normalizeName(d.name, d.commonName)) throw new VarietyValidationError([{ field: "name", message: "That is already this variety's name." }]);
    for (const a of d.aliases) {
      if (normalizeName(a.alias, d.commonName) === normalized) throw new VarietyValidationError([{ field: "name", message: `'${a.alias}' is already another name for this variety.` }]);
    }
    await admin.addAlias(db, d.id, name, "synonym", d.commonName);
    return { alias: name };
  }

  /**
   * Remove a manually added name (admin only). A `duplicate_decision` alias is refused
   * with no state change (RA-1, enforced here); so is the primary name, which the UI
   * never offers.
   */
  async function removeAlias(varietyRef: string, raw: Record<string, unknown>, c: VarietyContext): Promise<{ alias: string }> {
    needAdmin(c);
    const v = await refOr404(varietyRef);
    const alias = typeof raw.alias === "string" ? raw.alias : "";
    if (!alias) throw new VarietyValidationError([{ field: "alias", message: "Choose a name first." }]);
    const row = await admin.aliasRow(db, v.id, alias);
    if (!row) throw new ServiceError(404, "alias_not_found", `'${alias}' is not another name for this variety`);
    if (row.kind === "primary") throw new ServiceError(403, "alias_primary", "A variety's own name can't be removed here.");
    if (row.source === DUPLICATE_DECISION_SOURCE) {
      throw new ServiceError(403, "alias_protected", "Names added from a duplicate decision stay on the variety — they keep a decided duplicate out of the queue.");
    }
    await admin.removeAlias(db, v.id, alias);
    return { alias };
  }

  /** Remove the variety (admin only): the shared remove effect (soft, no cascade). */
  async function removeVariety(varietyRef: string, c: VarietyContext): Promise<AdminResult<Record<string, unknown>>> {
    needAdmin(c);
    const v = await refOr404(varietyRef);
    return svc.removeVariety(v.id);
  }

  return { listVarieties, listCrops, detail, addAlias, removeAlias, removeVariety };
}

export type AdminVarietyService = ReturnType<typeof createAdminVarietyService>;
