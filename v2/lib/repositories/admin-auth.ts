/**
 * Admin section repository (Slice 0): account roles + the role audit trail, admin sessions,
 * admin sign-in codes, and the dashboard home's queue counts. PRIVATE data — nothing here is
 * ever read by the snapshot, sync or public API paths. Role changes are recorded, never
 * refused, at this layer (the last-admin guard is Slice C UI logic).
 */
import { and, count, desc, eq, gt, isNull, min, ne, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { adminSessions, adminSigninCodes, farmSubmissions, reviewItems, roleAudit, users, USER_ROLES } from "@/lib/db/schema";
import { atomic, type AtomicOp } from "./atomic";

export type AdminSessionRow = typeof adminSessions.$inferSelect;
export type RoleValue = (typeof USER_ROLES)[number];

// ─── roles + audit ────────────────────────────────────────────────────────────

export async function roleOf(db: Db, userId: number): Promise<string | null> {
  const [r] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  return r?.role ?? null;
}

/** Set the role and append the audit row atomically. */
export async function setRole(db: Db, row: { userId: number; fromRole: RoleValue; toRole: RoleValue; actor: string; at: string }): Promise<void> {
  await atomic(db, [
    db.update(users).set({ role: row.toRole, updatedAt: row.at }).where(eq(users.id, row.userId)) as unknown as AtomicOp,
    db.insert(roleAudit).values({ userId: row.userId, actor: row.actor, fromRole: row.fromRole, toRole: row.toRole, createdAt: row.at }) as unknown as AtomicOp,
  ]);
}

export async function roleAuditFor(db: Db, userId: number) {
  return db.select().from(roleAudit).where(eq(roleAudit.userId, userId)).orderBy(desc(roleAudit.id));
}

/** Latest role changes across accounts, with the account's current email (null when gone). */
export async function recentRoleChanges(db: Db, limit: number) {
  return db
    .select({ id: roleAudit.id, userId: roleAudit.userId, email: users.email, actor: roleAudit.actor, fromRole: roleAudit.fromRole, toRole: roleAudit.toRole, at: roleAudit.createdAt })
    .from(roleAudit)
    .leftJoin(users, eq(users.id, roleAudit.userId))
    .orderBy(desc(roleAudit.id))
    .limit(limit);
}

// ─── admin sessions ───────────────────────────────────────────────────────────

export async function insertAdminSession(db: Db, s: typeof adminSessions.$inferInsert): Promise<void> {
  await db.insert(adminSessions).values(s);
}

/** A live admin session's account (null when absent, expired, or the account is banned). */
export async function adminSessionUser(db: Db, tokenHash: string, nowIso: string) {
  const [r] = await db
    .select({ session: adminSessions, user: users })
    .from(adminSessions)
    .innerJoin(users, eq(users.id, adminSessions.userId))
    .where(and(eq(adminSessions.tokenHash, tokenHash), gt(adminSessions.expiresAt, nowIso)))
    .limit(1);
  if (!r || r.user.status !== "active") return null;
  return r;
}

/**
 * The account behind a session token regardless of expiry (for the expired-session welcome
 * back: the email the token belonged to). Null for an unknown token or a banned account.
 */
export async function adminSessionUserAnytime(db: Db, tokenHash: string) {
  const [r] = await db
    .select({ session: adminSessions, user: users })
    .from(adminSessions)
    .innerJoin(users, eq(users.id, adminSessions.userId))
    .where(eq(adminSessions.tokenHash, tokenHash))
    .limit(1);
  if (!r || r.user.status !== "active") return null;
  return r;
}

export async function touchAdminSession(db: Db, id: number, at: string): Promise<void> {
  await db.update(adminSessions).set({ lastSeenAt: at }).where(eq(adminSessions.id, id));
}

export async function deleteAdminSessionByHash(db: Db, tokenHash: string): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash));
}

// ─── admin sign-in codes (one live code per user) ─────────────────────────────

export interface AdminCodeRow {
  id: number;
  userId: number;
  email: string;
  codeHash: string;
  salt: string;
  expiresAt: string;
  attempts: number;
  consumedAt: string | null;
  invalidatedAt: string | null;
  createdAt: string;
}

/** Invalidate every live code for the user + insert the fresh one, atomically. */
export async function replaceAdminCode(
  db: Db,
  row: { userId: number; email: string; codeHash: string; salt: string; expiresAt: string; createdAt: string },
): Promise<void> {
  await atomic(db, [
    db
      .update(adminSigninCodes)
      .set({ invalidatedAt: row.createdAt })
      .where(and(eq(adminSigninCodes.userId, row.userId), isNull(adminSigninCodes.consumedAt), isNull(adminSigninCodes.invalidatedAt))) as unknown as AtomicOp,
    db.insert(adminSigninCodes).values({ userId: row.userId, email: row.email, codeHash: row.codeHash, salt: row.salt, expiresAt: row.expiresAt, createdAt: row.createdAt }) as unknown as AtomicOp,
  ]);
}

/** The newest code that is neither consumed nor invalidated (it may be expired or dead). */
export async function liveAdminCode(db: Db, userId: number): Promise<AdminCodeRow | null> {
  const [r] = await db
    .select()
    .from(adminSigninCodes)
    .where(and(eq(adminSigninCodes.userId, userId), isNull(adminSigninCodes.consumedAt), isNull(adminSigninCodes.invalidatedAt)))
    .orderBy(desc(adminSigninCodes.createdAt), desc(adminSigninCodes.id))
    .limit(1);
  return r ?? null;
}

export async function bumpAdminCodeAttempts(db: Db, id: number): Promise<number> {
  const [r] = await db
    .update(adminSigninCodes)
    .set({ attempts: sql`${adminSigninCodes.attempts} + 1` })
    .where(eq(adminSigninCodes.id, id))
    .returning({ attempts: adminSigninCodes.attempts });
  // A vanished row counts as dead.
  return r?.attempts ?? Number.MAX_SAFE_INTEGER;
}

export async function consumeAdminCode(db: Db, id: number, at: string): Promise<void> {
  await db.update(adminSigninCodes).set({ consumedAt: at }).where(eq(adminSigninCodes.id, id));
}

export async function invalidateAdminCodes(db: Db, userId: number, at: string): Promise<void> {
  await db.update(adminSigninCodes).set({ invalidatedAt: at }).where(and(eq(adminSigninCodes.userId, userId), isNull(adminSigninCodes.consumedAt), isNull(adminSigninCodes.invalidatedAt)));
}

export async function adminCodesIssuedSince(db: Db, userId: number, sinceIso: string): Promise<number> {
  const [r] = await db.select({ n: count() }).from(adminSigninCodes).where(and(eq(adminSigninCodes.userId, userId), gt(adminSigninCodes.createdAt, sinceIso)));
  return r?.n ?? 0;
}

// ─── dashboard home (Slice 0 reads; Slice A+ decide) ──────────────────────────

/** Pending queue depth + oldest item per queue type, for the home queue cards. */
export async function pendingReviewStats(db: Db): Promise<{ type: string; n: number; oldest: string | null }[]> {
  const rows = await db
    .select({ type: reviewItems.type, n: count(), oldest: min(reviewItems.createdAt) })
    .from(reviewItems)
    .where(eq(reviewItems.status, "pending"))
    .groupBy(reviewItems.type);
  return rows.map((r) => ({ type: r.type, n: r.n, oldest: r.oldest }));
}

/** Pending Add Your Farm submissions (folded into the seller-candidates card, spec §15.6). */
export async function pendingFarmStats(db: Db): Promise<{ n: number; oldest: string | null }> {
  const [r] = await db
    .select({ n: count(), oldest: min(farmSubmissions.createdAt) })
    .from(farmSubmissions)
    .where(eq(farmSubmissions.status, "pending"));
  return { n: r?.n ?? 0, oldest: r?.oldest ?? null };
}

/** Latest decided queue items, newest first (Slice A: with the proposal + decider for plain-words rows). */
export async function recentReviewDecisions(db: Db, limit: number) {
  return db
    .select({ id: reviewItems.id, type: reviewItems.type, proposal: reviewItems.proposal, status: reviewItems.status, decidedByName: reviewItems.decidedByName, at: reviewItems.resolvedAt })
    .from(reviewItems)
    .where(ne(reviewItems.status, "pending"))
    .orderBy(desc(reviewItems.resolvedAt), desc(reviewItems.id))
    .limit(limit);
}
