/**
 * Accounts repository (Phase 3): users, sessions, sign-in attempt log, one-time verification
 * codes (email + alert phone, one shape), the farm-owner audit trail, and account deletion.
 * PRIVATE data — nothing here is ever read by the snapshot, sync or public API paths.
 */
import { and, count, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  authAttempts,
  emailVerificationCodes,
  farmOwnerAudit,
  farmSubmissions,
  notificationOutbox,
  phoneVerificationCodes,
  sessions,
  users,
  waitlistEntries,
} from "@/lib/db/schema";
import { atomic, type AtomicOp } from "./atomic";

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ─── users ──────────────────────────────────────────────────────────────────

export async function userByEmail(db: Db, email: string): Promise<UserRow | null> {
  const [r] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return r ?? null;
}

export async function userById(db: Db, id: number): Promise<UserRow | null> {
  const [r] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return r ?? null;
}

/** Insert; null when the email is taken (UNIQUE). */
export async function insertUser(db: Db, u: NewUser): Promise<UserRow | null> {
  const rows = await db.insert(users).values(u).onConflictDoNothing({ target: users.email }).returning();
  return rows[0] ?? null;
}

export async function updateUser(db: Db, id: number, set: Partial<NewUser>): Promise<void> {
  await db.update(users).set(set).where(eq(users.id, id));
}

/** Users whose SMS alert number is this one (STOP webhook). */
export async function usersByAlertPhone(db: Db, phone: string) {
  return db.select({ id: users.id }).from(users).where(eq(users.alertPhone, phone));
}

// ─── sessions ───────────────────────────────────────────────────────────────

export async function insertSession(db: Db, s: typeof sessions.$inferInsert): Promise<void> {
  await db.insert(sessions).values(s);
}

export async function sessionUser(db: Db, tokenHash: string, nowIso: string) {
  const [r] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, nowIso)))
    .limit(1);
  return r ?? null;
}

export async function touchSession(db: Db, id: number, at: string): Promise<void> {
  await db.update(sessions).set({ lastSeenAt: at }).where(eq(sessions.id, id));
}

export async function deleteSessionByHash(db: Db, tokenHash: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

// ─── sign-in attempt log ────────────────────────────────────────────────────

export async function recordAttempt(db: Db, scope: "ip" | "pair", keyHash: string, at: string): Promise<void> {
  await db.insert(authAttempts).values({ scope, keyHash, createdAt: at });
}

export async function attemptsSince(db: Db, scope: "ip" | "pair", keyHash: string, sinceIso: string): Promise<{ n: number; last: string | null }> {
  const [r] = await db
    .select({ n: count(), last: sql<string | null>`max(${authAttempts.createdAt})` })
    .from(authAttempts)
    .where(and(eq(authAttempts.scope, scope), eq(authAttempts.keyHash, keyHash), gt(authAttempts.createdAt, sinceIso)));
  return { n: r?.n ?? 0, last: r?.last ?? null };
}

export async function clearAttempts(db: Db, scope: "ip" | "pair", keyHash: string): Promise<void> {
  await db.delete(authAttempts).where(and(eq(authAttempts.scope, scope), eq(authAttempts.keyHash, keyHash)));
}

export async function pruneAttempts(db: Db, beforeIso: string): Promise<void> {
  await db.delete(authAttempts).where(sql`${authAttempts.createdAt} < ${beforeIso}`);
}

// ─── verification codes (one machinery, two channels) ───────────────────────

export type CodeChannel = "email" | "phone";

export interface CodeRow {
  id: number;
  userId: number;
  /** The address/number the code was sent to. */
  target: string;
  codeHash: string;
  salt: string;
  expiresAt: string;
  attempts: number;
  consumedAt: string | null;
  invalidatedAt: string | null;
  createdAt: string;
}

const codeTable = (c: CodeChannel) => (c === "email" ? emailVerificationCodes : phoneVerificationCodes);

function toCodeRow(c: CodeChannel, r: Record<string, unknown>): CodeRow {
  return { ...(r as unknown as CodeRow), target: String(c === "email" ? r.email : r.phone) };
}

/** Invalidate every live code for the user + insert the fresh one, atomically (one live code). */
export async function replaceCode(
  db: Db,
  c: CodeChannel,
  row: { userId: number; target: string; codeHash: string; salt: string; expiresAt: string; createdAt: string },
): Promise<void> {
  const ops: AtomicOp[] = [];
  if (c === "email") {
    ops.push(
      db
        .update(emailVerificationCodes)
        .set({ invalidatedAt: row.createdAt })
        .where(and(eq(emailVerificationCodes.userId, row.userId), isNull(emailVerificationCodes.consumedAt), isNull(emailVerificationCodes.invalidatedAt))) as unknown as AtomicOp,
      db.insert(emailVerificationCodes).values({ userId: row.userId, email: row.target, codeHash: row.codeHash, salt: row.salt, expiresAt: row.expiresAt, createdAt: row.createdAt }) as unknown as AtomicOp,
    );
  } else {
    ops.push(
      db
        .update(phoneVerificationCodes)
        .set({ invalidatedAt: row.createdAt })
        .where(and(eq(phoneVerificationCodes.userId, row.userId), isNull(phoneVerificationCodes.consumedAt), isNull(phoneVerificationCodes.invalidatedAt))) as unknown as AtomicOp,
      db.insert(phoneVerificationCodes).values({ userId: row.userId, phone: row.target, codeHash: row.codeHash, salt: row.salt, expiresAt: row.expiresAt, createdAt: row.createdAt }) as unknown as AtomicOp,
    );
  }
  await atomic(db, ops);
}

/** The newest code that is neither consumed nor invalidated (it may be expired or dead). */
export async function liveCode(db: Db, c: CodeChannel, userId: number): Promise<CodeRow | null> {
  const t = codeTable(c);
  const [r] = await db
    .select()
    .from(t)
    .where(and(eq(t.userId, userId), isNull(t.consumedAt), isNull(t.invalidatedAt)))
    .orderBy(desc(t.createdAt), desc(t.id))
    .limit(1);
  return r ? toCodeRow(c, r as unknown as Record<string, unknown>) : null;
}

export async function bumpCodeAttempts(db: Db, c: CodeChannel, id: number): Promise<number> {
  const t = codeTable(c);
  const [r] = await db.update(t).set({ attempts: sql`${t.attempts} + 1` }).where(eq(t.id, id)).returning({ attempts: t.attempts });
  // A vanished row counts as dead.
  return r?.attempts ?? Number.MAX_SAFE_INTEGER;
}

export async function consumeCode(db: Db, c: CodeChannel, id: number, at: string): Promise<void> {
  const t = codeTable(c);
  await db.update(t).set({ consumedAt: at }).where(eq(t.id, id));
}

export async function invalidateCodes(db: Db, c: CodeChannel, userId: number, at: string): Promise<void> {
  const t = codeTable(c);
  await db.update(t).set({ invalidatedAt: at }).where(and(eq(t.userId, userId), isNull(t.consumedAt), isNull(t.invalidatedAt)));
}

export async function codesIssuedSince(db: Db, c: CodeChannel, userId: number, sinceIso: string): Promise<number> {
  const t = codeTable(c);
  const [r] = await db.select({ n: count() }).from(t).where(and(eq(t.userId, userId), gt(t.createdAt, sinceIso)));
  return r?.n ?? 0;
}

// ─── farm-owner flag (admin-set only) + audit ───────────────────────────────

export async function setFarmOwner(
  db: Db,
  userId: number,
  next: { isFarmOwner: boolean; sellerId: number | null; actor: string; at: string },
): Promise<void> {
  await atomic(db, [
    db
      .update(users)
      .set({ isFarmOwner: next.isFarmOwner, ...(next.isFarmOwner ? { sellerId: next.sellerId } : {}), updatedAt: next.at })
      .where(eq(users.id, userId)) as unknown as AtomicOp,
    db.insert(farmOwnerAudit).values({
      userId,
      actor: next.actor,
      action: next.isFarmOwner ? "granted" : "revoked",
      sellerId: next.sellerId,
      createdAt: next.at,
    }) as unknown as AtomicOp,
  ]);
}

export async function farmOwnerAuditFor(db: Db, userId: number) {
  return db.select().from(farmOwnerAudit).where(eq(farmOwnerAudit.userId, userId)).orderBy(desc(farmOwnerAudit.id));
}

// ─── deletion ───────────────────────────────────────────────────────────────

/**
 * Delete an account (design §6): user, sessions, verification codes, waiting-list entries and
 * outbox rows go; a farm submission it made stays in the review queue unlinked (user_id NULL);
 * the append-only farm_owner_audit trail is kept.
 */
export async function deleteUserCascade(db: Db, userId: number): Promise<void> {
  await atomic(db, [
    db.delete(sessions).where(eq(sessions.userId, userId)) as unknown as AtomicOp,
    db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.userId, userId)) as unknown as AtomicOp,
    db.delete(phoneVerificationCodes).where(eq(phoneVerificationCodes.userId, userId)) as unknown as AtomicOp,
    db.delete(notificationOutbox).where(eq(notificationOutbox.userId, userId)) as unknown as AtomicOp,
    db.delete(waitlistEntries).where(eq(waitlistEntries.userId, userId)) as unknown as AtomicOp,
    db.update(farmSubmissions).set({ userId: null }).where(eq(farmSubmissions.userId, userId)) as unknown as AtomicOp,
    db.delete(users).where(eq(users.id, userId)) as unknown as AtomicOp,
  ]);
}

export async function accountTotals(db: Db) {
  const [u] = await db.select({ n: count() }).from(users);
  const [v] = await db.select({ n: count() }).from(users).where(eq(users.emailVerified, true));
  return { accounts: u?.n ?? 0, verified: v?.n ?? 0 };
}

export async function usersByIds(db: Db, ids: number[]) {
  if (ids.length === 0) return [];
  return db.select().from(users).where(inArray(users.id, ids));
}
