/** api_keys (design D5): only SHA-256 hashes are stored; the token is shown once at creation. */
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { apiKeys } from "@/lib/db/schema";

export async function insertApiKey(db: Db, row: { keyHash: string; label: string; scopes: string[]; createdAt: string }) {
  const [r] = await db
    .insert(apiKeys)
    .values({ keyHash: row.keyHash, label: row.label, scopes: JSON.stringify(row.scopes), createdAt: row.createdAt })
    .returning({ id: apiKeys.id });
  return r!.id;
}

/** Active (not revoked) key by hash. */
export async function apiKeyByHash(db: Db, keyHash: string) {
  const [r] = await db
    .select({ id: apiKeys.id, label: apiKeys.label, scopes: apiKeys.scopes })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);
  return r ?? null;
}

export async function touchApiKey(db: Db, id: number, at: string): Promise<void> {
  await db.update(apiKeys).set({ lastUsedAt: at }).where(eq(apiKeys.id, id));
}

export async function revokeApiKey(db: Db, id: number, at: string): Promise<boolean> {
  const r = await db.update(apiKeys).set({ revokedAt: at }).where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt))).returning({ id: apiKeys.id });
  return r.length > 0;
}
