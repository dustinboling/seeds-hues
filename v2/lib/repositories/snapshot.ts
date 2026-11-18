/**
 * Reads the allowlisted public tables for a catalog snapshot. Sellers that are not approved, or
 * whose listing policy is `removed` (and their listings/packets), are excluded; listings that are
 * not publicly visible are excluded. Prices are not in the allowlist at all (R1).
 */
import { getTableColumns } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { Db } from "@/lib/db/client";
import { listings, sellers, VISIBLE_LISTING_STATUS } from "@/lib/db/schema";
import { SNAPSHOT_ALLOWLIST, columnInfo, type AllowlistedTable } from "@/lib/repositories/snapshot-allowlist";

export type SnapshotRows = Record<string, Record<string, unknown>[]>;

async function readTable(db: Db, t: AllowlistedTable): Promise<Record<string, unknown>[]> {
  const cols = getTableColumns(t.table) as Record<string, SQLiteColumn>;
  const selection = Object.fromEntries(t.columns.map((p) => [p, cols[p]!]));
  const rows = (await db.select(selection).from(t.table)) as Record<string, unknown>[];
  const info = columnInfo(t);
  // Re-key to SQL column names; booleans → 0/1 so the snapshot matches D1 storage.
  return rows.map((r) =>
    Object.fromEntries(
      info.map((c) => {
        const v = r[c.prop];
        return [c.name, typeof v === "boolean" ? (v ? 1 : 0) : v instanceof Date ? v.toISOString() : v ?? null];
      }),
    ),
  );
}

export async function readSnapshotRows(db: Db): Promise<SnapshotRows> {
  const policy = await db
    .select({ id: sellers.id, listingPolicy: sellers.listingPolicy, eligibility: sellers.eligibility, status: sellers.status })
    .from(sellers);
  const removed = new Set(
    policy.filter((p) => p.listingPolicy === "removed" || p.eligibility !== "approved" || p.status !== "active").map((p) => p.id),
  );
  const listingRows = await db.select({ id: listings.id, sellerId: listings.sellerId, status: listings.status }).from(listings);
  const listingSeller = new Map(listingRows.map((l) => [l.id, l.sellerId]));
  const hiddenListing = new Set(
    listingRows
      .filter((l) => removed.has(l.sellerId) || !(VISIBLE_LISTING_STATUS as readonly string[]).includes(l.status))
      .map((l) => l.id),
  );

  const out: SnapshotRows = {};
  for (const t of SNAPSHOT_ALLOWLIST) {
    let rows = await readTable(db, t);
    if (t.name === "sellers") rows = rows.filter((r) => !removed.has(r.id as number));
    if (t.name === "listings") rows = rows.filter((r) => !hiddenListing.has(r.id as number));
    if (t.name === "listing_packet_sizes") {
      rows = rows.filter(
        (r) => listingSeller.has(r.listing_id as number) && !hiddenListing.has(r.listing_id as number),
      );
    }
    out[t.name] = rows;
  }
  return out;
}

