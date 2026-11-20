/**
 * atomic() — the ONLY place `db.batch()` may be called (FINAL spec §1.3 X1).
 *
 * D1 has no interactive transactions; a D1 batch runs its statements sequentially inside one
 * implicit transaction and rolls the whole batch back if any statement fails. When the catalog
 * moves to Postgres (Hyperdrive), this helper becomes `db.transaction(async (tx) => …)` and no
 * caller changes. A guardrail test fails the build if `.batch(` appears anywhere else.
 */
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "@/lib/db/client";

export type AtomicOp = BatchItem<"sqlite">;

/** Runs the ops as one transaction; resolves to each op's result (rows for `.returning()` ops). */
export async function atomic(db: Db, ops: AtomicOp[]): Promise<unknown[]> {
  if (ops.length === 0) return [];
  const [first, ...rest] = ops;
  return (await db.batch([first as AtomicOp, ...rest])) as unknown[];
}
