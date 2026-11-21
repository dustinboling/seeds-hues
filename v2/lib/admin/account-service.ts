/**
 * Accounts section service (Slice C): the account-list reads, detail hydration, role
 * changes and the farm-owner flag. Admin only — every method authorizes server-side,
 * reads included: reviewers never receive Accounts data (a hidden section is never the
 * enforcement). Every role change writes through the role_audit repository path; the
 * farm-owner flag reuses setFarmOwner/farmOwnerAuditFor unchanged in effect.
 */
import type { Db } from "@/lib/db/client";
import * as admin from "@/lib/repositories/admin";
import type { Decider } from "@/lib/repositories/admin";
import * as adminAuthRepo from "@/lib/repositories/admin-auth";
import * as accountsRepo from "@/lib/repositories/accounts";
import { ServiceError } from "@/lib/services/ingest";
import { isAccountRole, shownName, type AccountListParams } from "./accounts";

export interface AccountContext {
  role: string;
  decider: Decider;
}

function needAdmin(c: AccountContext): void {
  if (c.role !== "admin") {
    if (c.role === "reviewer") throw new ServiceError(403, "forbidden", "Your reviewer role doesn't include account settings.");
    throw new ServiceError(403, "forbidden", "This account doesn't have admin access.");
  }
}

export interface FieldError {
  field: string;
  message: string;
}

export class AccountValidationError extends ServiceError {
  fields: FieldError[];
  constructor(fields: FieldError[]) {
    super(422, "invalid_fields", "Something needs attention before continuing.");
    this.fields = fields;
  }
}

function accountIdOr422(raw: unknown): number {
  const n = typeof raw === "string" && /^\d{1,12}$/.test(raw.trim()) ? Number(raw.trim()) : typeof raw === "number" ? raw : NaN;
  if (!Number.isInteger(n) || n <= 0) throw new AccountValidationError([{ field: "account", message: "Choose an account first." }]);
  return n;
}

export function createAdminAccountService(db: Db, deps: { now?: () => Date } = {}) {
  const iso = () => (deps.now ?? (() => new Date()))().toISOString();

  async function targetOr404(id: number) {
    const u = await accountsRepo.userById(db, id);
    if (!u) throw new ServiceError(404, "account_not_found", `account ${id} not found`);
    return u;
  }

  /** The account list (G1): the window + the exact total. Admin only. */
  async function listAccounts(params: AccountListParams, c: AccountContext): Promise<{ rows: admin.AdminAccountRow[]; total: number }> {
    needAdmin(c);
    return admin.listAccountsAdmin(db, { q: params.q, limit: params.show, offset: 0 });
  }

  /** One account + trails (G2). Admin only. */
  async function detail(raw: Record<string, unknown>, c: AccountContext): Promise<admin.AdminAccountDetail> {
    needAdmin(c);
    const d = await admin.accountDetailById(db, accountIdOr422(raw.account));
    if (!d) throw new ServiceError(404, "account_not_found", `account ${String(raw.account)} not found`);
    return d;
  }

  /**
   * Change a role (G2): through the role_audit repository path, with the server-side
   * guardrails (resolution 12) — no self change (defense in depth behind the absent
   * self-controls), never demote the last admin. A same-role save writes nothing.
   */
  async function setRole(raw: Record<string, unknown>, c: AccountContext): Promise<{ changed: boolean; fromRole: string; toRole: string; name: string }> {
    needAdmin(c);
    const id = accountIdOr422(raw.account);
    if (!isAccountRole(raw.role)) throw new AccountValidationError([{ field: "role", message: "Choose Admin, Reviewer, or Visitor." }]);
    const u = await targetOr404(id);
    const name = shownName(u);
    if (id === c.decider.userId) throw new ServiceError(403, "self_role_change", "You can't change your own role.");
    if (u.role === raw.role) return { changed: false, fromRole: u.role, toRole: raw.role, name };
    if (u.role === "admin" && (await adminAuthRepo.countAdmins(db)) <= 1) {
      throw new ServiceError(409, "last_admin", `${name} is the last admin. Give someone else the admin role before removing theirs.`);
    }
    await adminAuthRepo.setRole(db, { userId: id, fromRole: u.role as "visitor" | "reviewer" | "admin", toRole: raw.role, actor: c.decider.name, at: iso() });
    return { changed: true, fromRole: u.role, toRole: raw.role, name };
  }

  /**
   * Set as farm owner (G2): through the existing setFarmOwner repository, binding the
   * picked seller's id. Granting the same seller again writes nothing.
   */
  async function grantFarmOwner(raw: Record<string, unknown>, c: AccountContext): Promise<{ changed: boolean; name: string; sellerSlug: string; sellerName: string }> {
    needAdmin(c);
    const id = accountIdOr422(raw.account);
    const sellerRef = typeof raw.seller === "string" ? raw.seller.trim() : "";
    if (!sellerRef) throw new AccountValidationError([{ field: "seller", message: "Choose a seller." }]);
    const u = await targetOr404(id);
    const seller = await admin.sellerRecordByRef(db, sellerRef);
    if (!seller) throw new ServiceError(404, "seller_not_found", `seller ${sellerRef} not found`);
    const name = shownName(u);
    if (u.isFarmOwner && u.sellerId === seller.id) return { changed: false, name, sellerSlug: seller.slug, sellerName: seller.name };
    await accountsRepo.setFarmOwner(db, id, { isFarmOwner: true, sellerId: seller.id, actor: c.decider.name, at: iso() });
    return { changed: true, name, sellerSlug: seller.slug, sellerName: seller.name };
  }

  /** Remove farm-owner status (G2): the account and its waiting lists stay. */
  async function revokeFarmOwner(raw: Record<string, unknown>, c: AccountContext): Promise<{ changed: boolean; name: string }> {
    needAdmin(c);
    const id = accountIdOr422(raw.account);
    const u = await targetOr404(id);
    const name = shownName(u);
    if (!u.isFarmOwner) return { changed: false, name };
    await accountsRepo.setFarmOwner(db, id, { isFarmOwner: false, sellerId: u.sellerId ?? null, actor: c.decider.name, at: iso() });
    return { changed: true, name };
  }

  /** The seller picker options (G2 grant sheet): every seller, A–Z. Admin only. */
  async function sellerOptions(c: AccountContext): Promise<{ slug: string; name: string; location: string | null }[]> {
    needAdmin(c);
    const list = await admin.listSellersAdmin(db, { q: null, badge: "all", state: "all", sort: "name" });
    return list.rows.map((r) => ({ slug: r.slug, name: r.name, location: r.location }));
  }

  return { listAccounts, detail, setRole, grantFarmOwner, revokeFarmOwner, sellerOptions };
}

export type AdminAccountService = ReturnType<typeof createAdminAccountService>;
