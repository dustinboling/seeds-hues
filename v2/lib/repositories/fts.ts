/**
 * Full-text search — the ONLY module that touches `varieties_fts` (spec §3.3, FINAL X3).
 *
 * Delta R12 (canonical story 1): any query of ≥ 2 characters searches. Three tiers, merged:
 *   0 exact   — primary name ("King's Ransom", "Sweet Pea King's Ransom") or a synonym
 *               (variety_aliases, by lowercase text or name_normalized)
 *   1 prefix  — a word of the variety / crop / Latin name or of a synonym starts with the query
 *               (this is the path that serves 2-character queries)
 *   2 full    — FTS5 trigram MATCH (terms ≥ 3 chars; bm25 order) over names, description, tags
 *               and aliases
 * A hit that only matched through a synonym carries `matchedAlias` ("also sold as").
 * The service applies the has-listings tiebreak within a tier. Postgres port (Phase 3): replace
 * this file with tsvector + GIN + pg_trgm.
 */
import { and, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { plants, varieties, varietyAliases } from "@/lib/db/schema";
import { foldText, normalizeName } from "@/lib/names";

export interface FtsOptions {
  limit: number;
}

export interface VarietyMatch {
  varietyId: number;
  tier: 0 | 1 | 2;
  matchedAlias: string | null;
}

export const MIN_QUERY_CHARS = 2;

/** Normalise a user query: trim, collapse whitespace, cap length. */
export function normaliseQuery(q: string): string {
  return q.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 100);
}

/** Terms ≥ 3 chars, each quoted as an FTS5 string (double quotes doubled). */
export function ftsTerms(q: string): string[] {
  return normaliseQuery(q)
    .split(" ")
    .map((t) => t.replace(/[\u0000-\u001f]/g, ""))
    .filter((t) => [...t].length >= 3)
    .map((t) => `"${t.replace(/"/g, '""')}"`);
}

/** Strip LIKE wildcards so user input is always literal. */
function likeLiteral(s: string): string {
  return s.replace(/[%_\\]/g, "").toLowerCase();
}

const activeV = and(eq(varieties.status, "active"), isNull(varieties.deletedAt));

/** Ranked variety matches (tier, then within-tier order). At most 100. */
export async function searchVarieties(db: Db, q: string, opts: FtsOptions): Promise<VarietyMatch[]> {
  const cap = Math.max(1, Math.min(opts.limit, 100));
  const query = normaliseQuery(q);
  const lower = likeLiteral(query);
  if ([...lower].length < MIN_QUERY_CHARS) return [];
  const normalized = normalizeName(query);
  const folded = foldText(query);

  const name = sql`lower(${varieties.varietyName})`;
  const common = sql`lower(${plants.commonName})`;
  const latin = sql`lower(${plants.latinName})`;
  const alias = sql`lower(${varietyAliases.alias})`;
  const starts = `${lower}%`;
  const wordStarts = `% ${lower}%`;

  const [exactPrimary, exactAlias, prefixPrimary, prefixAlias] = await Promise.all([
    db
      .select({ id: varieties.id })
      .from(varieties)
      .innerJoin(plants, eq(plants.id, varieties.plantId))
      .where(
        and(
          activeV,
          or(
            eq(name, lower),
            sql`${common} || ' ' || ${name} = ${lower}`,
            sql`${name} || ' ' || ${common} = ${lower}`,
          ),
        ),
      )
      .orderBy(name, varieties.slug)
      .limit(cap),
    db
      .select({ id: varietyAliases.varietyId, alias: varietyAliases.alias })
      .from(varietyAliases)
      .innerJoin(varieties, eq(varieties.id, varietyAliases.varietyId))
      .where(and(activeV, or(eq(alias, lower), eq(varietyAliases.nameNormalized, normalized), eq(varietyAliases.nameNormalized, folded))))
      .orderBy(alias)
      .limit(cap),
    db
      .select({ id: varieties.id })
      .from(varieties)
      .innerJoin(plants, eq(plants.id, varieties.plantId))
      .where(
        and(
          activeV,
          or(...[name, common, latin].flatMap((f) => [like(f, starts), like(f, wordStarts)]), like(sql`${common} || ' ' || ${name}`, starts)),
        ),
      )
      .orderBy(name, varieties.slug)
      .limit(cap),
    db
      .select({ id: varietyAliases.varietyId, alias: varietyAliases.alias })
      .from(varietyAliases)
      .innerJoin(varieties, eq(varieties.id, varietyAliases.varietyId))
      .where(and(activeV, or(like(alias, starts), like(alias, wordStarts))))
      .orderBy(alias)
      .limit(cap),
  ]);

  const out = new Map<number, VarietyMatch>();
  const add = (varietyId: number, tier: VarietyMatch["tier"], matchedAlias: string | null) => {
    const prev = out.get(varietyId);
    // The cap bounds the MERGED set, not each source query: callers bind these ids into
    // IN (…) lists and D1 allows at most 100 bound parameters per statement (V20 discipline).
    // Sources add in tier order, so the cap never drops a better match for a worse one.
    if (!prev) {
      if (out.size < cap) out.set(varietyId, { varietyId, tier, matchedAlias });
    } else if (prev.tier === tier && prev.matchedAlias !== null && matchedAlias === null) prev.matchedAlias = null;
  };
  // Primary-name hits are added before synonym hits of the same tier, so they win the flag.
  for (const r of exactPrimary) add(r.id, 0, null);
  for (const r of exactAlias) add(r.id, 0, r.alias);
  for (const r of prefixPrimary) add(r.id, 1, null);
  for (const r of prefixAlias) add(r.id, 1, r.alias);

  const terms = ftsTerms(query);
  if (terms.length > 0 && out.size < cap) {
    const match = terms.join(" AND ");
    const rows = await db.all<{ id: number; variety_name: string; common_name: string; latin_name: string | null; aliases: string }>(sql`
      SELECT f.rowid AS id, f.variety_name, f.common_name, f.latin_name, f.aliases
      FROM varieties_fts f
      JOIN varieties v ON v.id = f.rowid
      WHERE varieties_fts MATCH ${match} AND v.status = 'active' AND v.deleted_at IS NULL
      ORDER BY bm25(varieties_fts, 10.0, 6.0, 3.0, 1.0, 2.0, 4.0), lower(v.variety_name), v.slug
      LIMIT ${cap}
    `);
    const needles = terms.map((t) => t.slice(1, -1).replace(/""/g, '"').toLowerCase());
    const aliasRows = rows.length
      ? await db
          .select({ id: varietyAliases.varietyId, alias: varietyAliases.alias })
          .from(varietyAliases)
          .where(inArray(varietyAliases.varietyId, rows.map((r) => Number(r.id))))
      : [];
    for (const r of rows) {
      const id = Number(r.id);
      const primary = `${r.variety_name} ${r.common_name} ${r.latin_name ?? ""}`.toLowerCase();
      const viaPrimary = needles.every((n) => primary.includes(n));
      const viaAlias = viaPrimary
        ? null
        : (aliasRows.find((a) => a.id === id && needles.every((n) => a.alias.toLowerCase().includes(n)))?.alias ?? null);
      add(id, 2, viaAlias);
    }
  }
  return [...out.values()].slice(0, cap);
}

/** Rebuild the whole FTS index from source tables (importer; after D1 import/export). */
export async function rebuildFts(db: Db): Promise<void> {
  await db.run(sql`DELETE FROM varieties_fts`);
  await db.run(sql`
    INSERT INTO varieties_fts (rowid, variety_name, common_name, latin_name, description, tags, aliases)
    SELECT v.id, v.variety_name, p.common_name, coalesce(p.latin_name, ''), coalesce(v.description, ''),
      coalesce((SELECT group_concat(t.tag, ' ') FROM variety_tags t WHERE t.variety_id = v.id), ''),
      coalesce((SELECT group_concat(a.alias, ' ') FROM variety_aliases a WHERE a.variety_id = v.id), '')
    FROM varieties v JOIN plants p ON p.id = v.plant_id
  `);
}

/** Row count of the FTS index (importer assertion: equals the varieties count). */
export async function ftsRowCount(db: Db): Promise<number> {
  const rows = await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM varieties_fts`);
  return Number(rows[0]?.n ?? 0);
}
