/**
 * Public-table allowlist for catalog snapshots (FINAL §3.3). Only these tables/columns ever leave
 * D1 in a snapshot. Seller provenance, listing policy, rating sums, contact email, sources,
 * batches, clicks, media and the account/review stubs are NOT exported.
 *
 * Delta R1 (canonical decision 3/23): prices are stored, never shown — the snapshot is served
 * from /api/v1, so packet price columns (price_cents, price_source, price_check_date) are NOT
 * exported either.
 */
import { getTableColumns } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import {
  catalogPublish,
  categories,
  listingPacketSizes,
  listings,
  plants,
  plantSowingMethods,
  sellers,
  series,
  subcategories,
  varieties,
  varietyAliases,
  varietyTags,
} from "@/lib/db/schema";

export interface AllowlistedTable {
  name: string;
  table: SQLiteTable;
  /** Drizzle property names to export. */
  columns: string[];
  primaryKey: string[];
}

const all = (t: SQLiteTable) => Object.keys(getTableColumns(t));

/** Never exported (R1). Checked by tests/unit/guardrails.test.ts. */
export const PRICE_COLUMNS = ["priceCents", "priceSource", "priceCheckDate"];

export const SNAPSHOT_ALLOWLIST: AllowlistedTable[] = [
  { name: "categories", table: categories, columns: all(categories), primaryKey: ["id"] },
  { name: "subcategories", table: subcategories, columns: all(subcategories), primaryKey: ["id"] },
  { name: "plants", table: plants, columns: all(plants), primaryKey: ["id"] },
  { name: "plant_sowing_methods", table: plantSowingMethods, columns: all(plantSowingMethods), primaryKey: ["plant_id", "method"] },
  { name: "series", table: series, columns: all(series), primaryKey: ["id"] },
  {
    name: "varieties",
    table: varieties,
    columns: all(varieties).filter((c) => c !== "sourceId"),
    primaryKey: ["id"],
  },
  { name: "variety_tags", table: varietyTags, columns: all(varietyTags), primaryKey: ["variety_id", "tag"] },
  { name: "variety_aliases", table: varietyAliases, columns: all(varietyAliases), primaryKey: ["variety_id", "alias"] },
  {
    name: "sellers",
    table: sellers,
    columns: [
      "id",
      "slug",
      "name",
      "type",
      "homepage",
      "description",
      "orderingNotes",
      "location",
      "status",
      "ratingCount",
      "ratingAverage",
      "createdAt",
      "updatedAt",
      "eligibility",
      "domain",
      "country",
      "region",
      "shipsTo",
      "claimStatus",
      "isSiteOwner",
      // Small farm badge (Open Directory) — public; drives the badge in the JSON API too.
      "isSmallFarm",
      // Imported third-party aggregate (brief #4) — public, separate from our rating columns.
      "importedRatingSource",
      "importedRatingPlaceName",
      "importedRatingPlaceId",
      "importedRatingValue",
      "importedRatingCount",
      "importedRatingFetchedAt",
      "updatedSeq",
    ],
    primaryKey: ["id"],
  },
  {
    name: "listings",
    table: listings,
    columns: all(listings).filter((c) => c !== "sourceId"),
    primaryKey: ["id"],
  },
  {
    name: "listing_packet_sizes",
    table: listingPacketSizes,
    columns: all(listingPacketSizes).filter((c) => !PRICE_COLUMNS.includes(c)),
    primaryKey: ["id"],
  },
  { name: "catalog_publish", table: catalogPublish, columns: ["version", "snapshotKey", "publishedAt"], primaryKey: ["version"] },
];

export function columnInfo(t: AllowlistedTable): { prop: string; name: string; sqlType: string }[] {
  const cols = getTableColumns(t.table) as Record<string, SQLiteColumn>;
  return t.columns.map((prop) => {
    const c = cols[prop];
    if (!c) throw new Error(`allowlist: ${t.name}.${prop} is not a column`);
    return { prop, name: c.name, sqlType: c.getSQLType() };
  });
}

/** CREATE TABLE statement for the snapshot (types only; no FKs to non-exported tables). */
export function snapshotDdl(t: AllowlistedTable): string {
  const cols = columnInfo(t).map((c) => `"${c.name}" ${c.sqlType}`);
  return `CREATE TABLE "${t.name}" (${cols.join(", ")}, PRIMARY KEY (${t.primaryKey.map((k) => `"${k}"`).join(", ")}))`;
}
