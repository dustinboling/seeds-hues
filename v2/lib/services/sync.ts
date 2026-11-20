/**
 * Sync service (R9, canonical §3): /sync/snapshot and /sync/changes. Public shapes only — no
 * prices, approved sellers only, published listings only. Hidden rows in a change window become
 * tombstones (`deletes`), and a merged variety names its survivor.
 */
import type { Db } from "@/lib/db/client";
import * as repo from "@/lib/repositories/sync";
import { catalogSeq } from "@/lib/repositories/seq";
import {
  SyncChangesSchema,
  SyncSnapshotSchema,
  type SyncChanges,
  type SyncDelete,
  type SyncSnapshot,
} from "@/lib/validators";
import { goUrl, importedRatingOf, parse, ratingOf, sowingMethodsOf } from "./catalog";

export const SYNC_SCHEMA_VERSION = 1;
export const SYNC_DEFAULT_LIMIT = 500;
export const SYNC_MAX_LIMIT = 1000;

function shipsTo(raw: string): string[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string") ? v : ["unknown"];
  } catch {
    return ["unknown"];
  }
}

const crop = (r: repo.SyncCropRow) => ({
  id: r.id,
  slug: r.slug,
  common_name: r.commonName,
  latin_name: r.latinName,
  category: r.category,
  season_class: r.seasonClass,
  season_source_id: r.seasonSourceId,
  sowing_methods: sowingMethodsOf(r.sowingMethods),
  sowing_method_source_id: r.sowingMethodSourceId,
  updated_seq: r.updatedSeq,
});
const seriesOut = (r: repo.SyncSeriesRow) => ({ id: r.id, slug: r.slug, name: r.name, crop_id: r.plantId, updated_seq: r.updatedSeq });
const variety = (r: repo.SyncVarietyRow) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  crop_id: r.plantId,
  series_id: r.seriesId,
  color_swatch: r.colorSwatch,
  color_family: r.colorFamily,
  pollination: r.pollination,
  height_cm: r.heightCm,
  days_to_bloom: { min: r.daysToBloomMin, max: r.daysToBloomMax },
  indexable: r.indexable,
  rating: ratingOf(0, null),
  updated_seq: r.updatedSeq,
});
const seller = (r: repo.SyncSellerRow) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  location: r.location,
  region: r.region,
  country: r.country,
  homepage: r.homepage,
  ships_to: shipsTo(r.shipsTo),
  claim_status: r.claimStatus,
  rating: ratingOf(r.ratingCount, r.ratingCount > 0 ? r.ratingAverage : null),
  imported_rating: importedRatingSync(r),
  is_small_farm: r.isSmallFarm,
  updated_seq: r.updatedSeq,
});
function importedRatingSync(r: repo.SyncSellerRow) {
  const ir = importedRatingOf(r);
  return ir
    ? { source: ir.source, place_name: ir.placeName, place_id: ir.placeId, rating: ir.rating, review_count: ir.reviewCount, fetched_date: ir.fetchedDate }
    : null;
}
const listing = (r: repo.SyncListingRow) => ({
  id: r.id,
  variety_id: r.varietyId,
  seller_id: r.sellerId,
  availability: r.availability,
  last_checked_at: r.lastCheckedAt,
  first_seen_at: r.firstSeenAt,
  go_url: goUrl(r.id),
  product_url: r.productUrl,
  provenance: { source_url: r.sourceUrl, retrieved_at: r.lastCheckedAt, method: r.matchMethod, confidence: r.confidence },
  updated_seq: r.updatedSeq,
});
const name = (r: { varietyId: number; name: string; kind: string }) => ({ variety_id: r.varietyId, name: r.name, kind: r.kind });

export class SyncRangeError extends Error {
  constructor(
    public readonly status: 400 | 410,
    public readonly code: "invalid_since" | "resync_required",
    message: string,
  ) {
    super(message);
  }
}

export function createSyncService(db: Db) {
  return {
    catalogSeq: () => catalogSeq(db),

    async snapshot(): Promise<SyncSnapshot> {
      const [seq, rows] = await Promise.all([catalogSeq(db), repo.snapshotRows(db)]);
      return parse(
        SyncSnapshotSchema,
        {
          catalog_seq: seq,
          schema_version: SYNC_SCHEMA_VERSION,
          generated_at: new Date().toISOString(),
          crops: rows.crops.map(crop),
          series: rows.series.map(seriesOut),
          varieties: rows.varieties.map(variety),
          names: rows.names.map(name),
          sellers: rows.sellers.map(seller),
          listings: rows.listings.map(listing),
        },
        "sync snapshot",
      );
    },

    /**
     * Changes after `since`. `since` > catalog_seq → 400 invalid_since; `since` < 0 → 410
     * resync_required (no change log is pruned yet, so only a negative cursor is out of range).
     */
    async changes(since: number, limit = SYNC_DEFAULT_LIMIT): Promise<SyncChanges> {
      const seq = await catalogSeq(db);
      if (since < 0) throw new SyncRangeError(410, "resync_required", "since is older than the retained change window; download /sync/snapshot");
      if (since > seq) throw new SyncRangeError(400, "invalid_since", `since ${since} is ahead of catalog_seq ${seq}`);
      const lim = Math.max(1, Math.min(limit, SYNC_MAX_LIMIT));
      const rows = await repo.changedRows(db, since, lim + 1);
      type Item = { seq: number; apply: (out: SyncChanges) => void };
      const items: Item[] = [];
      for (const r of rows.crops)
        items.push({ seq: r.updatedSeq, apply: (o) => (r.deletedAt ? o.deletes.push({ type: "crop", id: r.id }) : o.upserts.crops.push(crop(r))) });
      for (const r of rows.series)
        items.push({ seq: r.updatedSeq, apply: (o) => (r.deletedAt ? o.deletes.push({ type: "series", id: r.id }) : o.upserts.series.push(seriesOut(r))) });
      for (const r of rows.varieties)
        items.push({
          seq: r.updatedSeq,
          apply: (o) => {
            if (r.status === "active" && !r.deletedAt) o.upserts.varieties.push(variety(r));
            else {
              const d: SyncDelete = { type: "variety", id: r.id };
              if (r.status === "merged" && r.mergedIntoId) d.merged_into = r.mergedIntoId;
              o.deletes.push(d);
            }
          },
        });
      for (const r of rows.sellers)
        items.push({ seq: r.updatedSeq, apply: (o) => (r.visible ? o.upserts.sellers.push(seller(r)) : o.deletes.push({ type: "seller", id: r.id })) });
      for (const r of rows.listings)
        items.push({ seq: r.updatedSeq, apply: (o) => (r.visible ? o.upserts.listings.push(listing(r)) : o.deletes.push({ type: "listing", id: r.id })) });

      items.sort((a, b) => a.seq - b.seq);
      let page = items.slice(0, lim);
      // Never split one sequence number across pages.
      if (items.length > lim && page.length > 0) {
        const cut = page.at(-1)!.seq;
        if (items[lim]!.seq === cut) {
          const kept = page.filter((i) => i.seq < cut);
          page = kept.length > 0 ? kept : items.filter((i) => i.seq <= cut);
        }
      }
      const out: SyncChanges = {
        upserts: { crops: [], series: [], varieties: [], names: [], sellers: [], listings: [] },
        deletes: [],
        next_seq: page.length ? page.at(-1)!.seq : since,
        has_more: items.length > page.length,
      };
      for (const i of page) i.apply(out);
      out.upserts.names = (await repo.namesFor(db, out.upserts.varieties.map((v) => v.id))).map(name);
      if (!out.has_more) out.next_seq = Math.max(out.next_seq, since);
      return parse(SyncChangesSchema, out, "sync changes");
    },
  };
}

export type SyncService = ReturnType<typeof createSyncService>;
