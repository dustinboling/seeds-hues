/**
 * Preview Worker: the variety-status mount's D1 read (the one Phase B mount
 * the preview carries). GET /api/internal/variety-status/[slug] answers
 * exactly the contract the app + stub pin (ApiVarietyStatus in
 * src/data/types.ts, served by tests/stub/api-server.ts): always 200
 * {status, merged_into}; a status='merged' row resolves merged_into to its
 * survivor; soft-deleted or absent slugs are the unknown class.
 *
 * The stub DB below simulates SQL semantics only (row lookup by slug/id,
 * the target lookup's active + not-deleted predicates) — the mount's own
 * classification logic stays in the unit under test.
 */
import { describe, expect, it } from "vitest";
import { varietyStatusForSlug, type VarietyStatusDb } from "../../src/server/variety-status";

interface VarietyRow {
  id: number;
  slug: string;
  status: string;
  merged_into_id: number | null;
  deleted_at: string | null;
}

const row = (overrides: Partial<VarietyRow> & { slug: string }): VarietyRow => ({
  id: 1,
  status: "active",
  merged_into_id: null,
  deleted_at: null,
  ...overrides,
});

/**
 * A D1-shaped stub: prepare/bind/first over an in-memory row set. The
 * slug lookup returns the raw row (the mount classifies it); the id
 * lookup applies the active + not-deleted predicates the mount's SQL
 * carries, the way D1 itself would.
 */
function stubDb(varieties: VarietyRow[]): { db: VarietyStatusDb; queries: string[] } {
  const queries: string[] = [];
  const bySlug = new Map(varieties.map((v) => [v.slug, v]));
  const byId = new Map(varieties.map((v) => [v.id, v]));
  const db: VarietyStatusDb = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind(...values: Array<string | number | null>) {
          return {
            first: async <R extends Record<string, unknown>>(): Promise<R | null> => {
              const found = values[0] === null || values[0] === undefined ? null : query.includes("slug =") ? (bySlug.get(String(values[0])) ?? null) : (byId.get(Number(values[0])) ?? null);
              if (!found) return null;
              if (!query.includes("slug =") && (found.status !== "active" || found.deleted_at !== null)) return null;
              return { ...found } as unknown as R;
            },
          };
        },
      };
    },
  };
  return { db, queries };
}

describe("varietyStatusForSlug", () => {
  it("answers active for a live active row", async () => {
    const { db } = stubDb([row({ slug: "sweet-pea-kings-ransom" })]);
    await expect(varietyStatusForSlug(db, "sweet-pea-kings-ransom")).resolves.toEqual({ status: "active", merged_into: null });
  });

  it("resolves a merged row to its survivor's slug, the way the stub does", async () => {
    const { db, queries } = stubDb([
      { ...row({ id: 7, slug: "sweet-pea-old-ransom", status: "merged", merged_into_id: 3 }) },
      { ...row({ id: 3, slug: "sweet-pea-kings-ransom" }) },
    ]);
    await expect(varietyStatusForSlug(db, "sweet-pea-old-ransom")).resolves.toEqual({
      status: "merged",
      merged_into: "sweet-pea-kings-ransom",
    });
    expect(queries).toHaveLength(2);
  });

  it("answers unknown when the merge target is absent", async () => {
    const { db } = stubDb([{ ...row({ slug: "sweet-pea-old-ransom", status: "merged", merged_into_id: 4242 }) }]);
    await expect(varietyStatusForSlug(db, "sweet-pea-old-ransom")).resolves.toEqual({ status: "unknown", merged_into: null });
  });

  it("answers unknown when the merge target is soft-deleted or retired", async () => {
    const deleted = stubDb([
      { ...row({ slug: "m1", status: "merged", merged_into_id: 2 }) },
      { ...row({ id: 2, slug: "gone", deleted_at: "2026-11-20T00:00:00.000Z" }) },
    ]);
    await expect(varietyStatusForSlug(deleted.db, "m1")).resolves.toEqual({ status: "unknown", merged_into: null });
    const draft = stubDb([
      { ...row({ slug: "m2", status: "merged", merged_into_id: 2 }) },
      { ...row({ id: 2, slug: "unborn", status: "draft" }) },
    ]);
    await expect(varietyStatusForSlug(draft.db, "m2")).resolves.toEqual({ status: "unknown", merged_into: null });
  });

  it("answers unknown for a merged row with no target id, without a second query", async () => {
    const { db, queries } = stubDb([{ ...row({ slug: "m3", status: "merged", merged_into_id: null }) }]);
    await expect(varietyStatusForSlug(db, "m3")).resolves.toEqual({ status: "unknown", merged_into: null });
    expect(queries).toHaveLength(1);
  });

  it("answers unknown for soft-deleted slugs, whatever their status", async () => {
    const active = stubDb([{ ...row({ slug: "retired", deleted_at: "2026-11-20T00:00:00.000Z" }) }]);
    await expect(varietyStatusForSlug(active.db, "retired")).resolves.toEqual({ status: "unknown", merged_into: null });
    expect(active.queries).toHaveLength(1);
    const merged = stubDb([
      { ...row({ slug: "retired-merge", status: "merged", merged_into_id: 2, deleted_at: "2026-11-20T00:00:00.000Z" }) },
      { ...row({ id: 2, slug: "survivor" }) },
    ]);
    await expect(varietyStatusForSlug(merged.db, "retired-merge")).resolves.toEqual({ status: "unknown", merged_into: null });
  });

  it("answers unknown for absent slugs and non-public statuses", async () => {
    const { db } = stubDb([
      { ...row({ slug: "draft-rose", status: "draft" }) },
      { ...row({ slug: "dropped-rose", status: "discontinued" }) },
    ]);
    await expect(varietyStatusForSlug(db, "no-such-variety")).resolves.toEqual({ status: "unknown", merged_into: null });
    await expect(varietyStatusForSlug(db, "draft-rose")).resolves.toEqual({ status: "unknown", merged_into: null });
    await expect(varietyStatusForSlug(db, "dropped-rose")).resolves.toEqual({ status: "unknown", merged_into: null });
  });

  it("reads with SELECT only and binds the slug (never interpolates it)", async () => {
    const { db, queries } = stubDb([row({ slug: "plain" })]);
    // A quote-heavy slug would break — or inject into — an interpolated query.
    await expect(varietyStatusForSlug(db, "x' OR '1'='1")).resolves.toEqual({ status: "unknown", merged_into: null });
    expect(queries.length).toBeGreaterThan(0);
    for (const query of queries) {
      expect(query.trim().toLowerCase().startsWith("select")).toBe(true);
      expect(query).toContain("?");
      expect(query).not.toContain("x' OR");
    }
  });
});
