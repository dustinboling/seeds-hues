/**
 * The variety-status mount's D1 read (the one Phase B mount the preview
 * Worker carries): GET /api/internal/variety-status/[slug] over the
 * production catalog database. Answers exactly the contract the app +
 * stub pin (ApiVarietyStatus in ../data/types.ts): always 200
 * {status, merged_into}; a status='merged' row resolves merged_into to
 * its survivor's slug the way the stub does; soft-deleted or absent
 * slugs are the unknown class.
 *
 * SELECT only, by construction: the mount takes the minimal D1 surface
 * (prepare/bind/first — no run/batch/execute exists on this interface)
 * and both statements are single-row SELECTs with bound parameters.
 */
import type { ApiVarietyStatus } from "../data/types";

/**
 * The mount's whole D1 surface. The real D1Database satisfies this
 * structurally (checked where the Worker entry adapts its env); tests
 * stub it without casts.
 */
export interface VarietyStatusDb {
  prepare(query: string): {
    bind(...values: Array<string | number | null>): {
      first<Row extends Record<string, unknown>>(): Promise<Row | null>;
    };
  };
}

const UNKNOWN: ApiVarietyStatus = { status: "unknown", merged_into: null };

type VarietyStatusRow = {
  status: unknown;
  merged_into_id: unknown;
  deleted_at: unknown;
};

const asId = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

export async function varietyStatusForSlug(db: VarietyStatusDb, slug: string): Promise<ApiVarietyStatus> {
  const found = await db
    .prepare("SELECT status, merged_into_id, deleted_at FROM varieties WHERE slug = ? LIMIT 1")
    .bind(slug)
    .first<VarietyStatusRow>();
  if (!found) return UNKNOWN;
  // Soft-deleted slugs are the unknown class, whatever their status.
  if (found.deleted_at !== null && found.deleted_at !== undefined) return UNKNOWN;
  if (found.status === "active") return { status: "active", merged_into: null };
  if (found.status === "merged") {
    const targetId = asId(found.merged_into_id);
    if (targetId === null) return UNKNOWN;
    // The survivor must be live itself; a merge pointing at a missing,
    // retired, or deleted row answers unknown (fail closed — a merged
    // answer without a valid target would 500 the app's lookup).
    const target = await db
      .prepare("SELECT slug FROM varieties WHERE id = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1")
      .bind(targetId)
      .first<{ slug: unknown }>();
    if (!target || typeof target.slug !== "string" || target.slug.length === 0) return UNKNOWN;
    return { status: "merged", merged_into: target.slug };
  }
  // Draft, discontinued, and anything unrecognized: not publicly visible.
  return UNKNOWN;
}
