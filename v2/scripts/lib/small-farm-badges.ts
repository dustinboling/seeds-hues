/**
 * Core of scripts/apply-small-farm-badges.ts (Open Directory, data-spec §4.1) — kept apart from
 * the CLI so the integration suite runs the exact same code against a throwaway D1.
 *
 * Steps, in order, all fail-closed:
 *   1. backup   — every column of every `sellers` row, frozen before any write (JSON) plus a
 *                 targeted rollback file (one UPDATE per seller restoring its prior badge value).
 *   2. resolve  — the 42 BADGE slugs to seller ids; abort unless exactly 42 distinct rows resolve,
 *                 none removed at its request, and every NO BADGE slug present — judged or
 *                 DEFAULT (the list is empty since Hue's 2026-11-20 review judged all 56) — is
 *                 still unbadged. A seller in none of the three recorded lists is unclassified
 *                 and fails the pre-flight (fail-closed).
 *   3. apply    — setSellerSmallFarm(db, id, true, now) per seller NOT already badged. The admin
 *                 repository bumps catalog_seq + the seller's updated_seq in one atomic batch, so
 *                 sync/snapshot consumers see the change (§4.3/§4.4). Already-badged sellers are
 *                 left untouched (idempotent re-runs add no sequence noise).
 *   4. reconcile — re-read and compare against the expected totals; any mismatch is a failure.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { asc, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { sellers } from "@/lib/db/schema";
import { setSellerSmallFarm } from "@/lib/repositories/admin";
import { catalogSeq } from "@/lib/repositories/seq";
import { SMALL_FARM_BADGE_SLUGS, SMALL_FARM_DEFAULT_NO_BADGE_SLUGS, SMALL_FARM_NO_BADGE_SLUGS } from "@/lib/catalog/small-farm-classification";

export interface BadgeTarget {
  total: number;
  badged: number;
  notBadged: number;
}

export interface ApplyOptions {
  /** Directory for the pre-write backup files (created if missing). */
  backupDir: string;
  /** Label for the backup filenames ("local", "remote", …). */
  label: string;
  /** Expected totals after the run; the production target is SMALL_FARM_PRODUCTION_TARGET. */
  expect: BadgeTarget;
  dryRun?: boolean;
  now?: () => Date;
  log?: (line: string) => void;
}

export interface ApplyResult {
  backupJson: string;
  backupRollbackSql: string;
  backupSha256: string;
  resolved: { slug: string; id: number; before: boolean }[];
  written: string[];
  alreadyBadged: string[];
  seqBefore: number;
  seqAfter: number;
  reconciliation: BadgeTarget & { unclassified: string[]; strayBadged: string[] };
  dryRun: boolean;
}

export class BadgeApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadgeApplyError";
  }
}

const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function readAllSellers(db: Db) {
  return db.select().from(sellers).orderBy(asc(sellers.id));
}

export async function applySmallFarmBadges(db: Db, opts: ApplyOptions): Promise<ApplyResult> {
  const log = opts.log ?? (() => {});
  const now = opts.now ?? (() => new Date());
  const dryRun = opts.dryRun ?? false;
  const badgeSlugs: readonly string[] = SMALL_FARM_BADGE_SLUGS;
  const noBadgeSlugs: readonly string[] = SMALL_FARM_NO_BADGE_SLUGS;
  const defaultNoBadgeSlugs: readonly string[] = SMALL_FARM_DEFAULT_NO_BADGE_SLUGS;

  // Guard the recorded lists themselves before touching the database.
  if (new Set(badgeSlugs).size !== badgeSlugs.length || badgeSlugs.length !== 42) {
    throw new BadgeApplyError(`classification BADGE list must hold 42 distinct slugs (has ${badgeSlugs.length})`);
  }
  if (new Set(defaultNoBadgeSlugs).size !== defaultNoBadgeSlugs.length || defaultNoBadgeSlugs.length !== 0) {
    throw new BadgeApplyError(`classification DEFAULT NO BADGE list must hold 0 distinct slugs (has ${defaultNoBadgeSlugs.length})`);
  }
  const overlap = badgeSlugs.filter((s) => noBadgeSlugs.includes(s));
  if (overlap.length) throw new BadgeApplyError(`slugs in both BADGE and NO BADGE: ${overlap.join(", ")}`);
  const overlapDefaultBadge = badgeSlugs.filter((s) => defaultNoBadgeSlugs.includes(s));
  if (overlapDefaultBadge.length) throw new BadgeApplyError(`slugs in both BADGE and DEFAULT NO BADGE: ${overlapDefaultBadge.join(", ")}`);
  const overlapDefaultJudged = noBadgeSlugs.filter((s) => defaultNoBadgeSlugs.includes(s));
  if (overlapDefaultJudged.length) throw new BadgeApplyError(`slugs in both NO BADGE and DEFAULT NO BADGE: ${overlapDefaultJudged.join(", ")}`);

  // ── 1. Backup (always, even on a dry run) ────────────────────────────────────────────────
  const before = await readAllSellers(db);
  const stamp = now().toISOString().replace(/[:.]/g, "-");
  mkdirSync(opts.backupDir, { recursive: true });
  const backupJson = join(opts.backupDir, `sellers-${opts.label}-${stamp}.json`);
  const backupRollbackSql = join(opts.backupDir, `sellers-${opts.label}-${stamp}.rollback.sql`);
  const json = JSON.stringify({ takenAt: now().toISOString(), table: "sellers", rows: before }, null, 2) + "\n";
  writeFileSync(backupJson, json, { flag: "wx" });
  const backupSha256 = createHash("sha256").update(json).digest("hex");
  writeFileSync(
    backupRollbackSql,
    [
      `-- Rollback for the Small farm badge backfill: restores every seller's is_small_farm to its`,
      `-- value at ${now().toISOString()} (backup ${backupJson}, sha256 ${backupSha256}).`,
      `-- Raw SQL does not bump catalog_seq: after running it, bump the sequence for each changed`,
      `-- seller (or re-apply through POST /api/v1/admin/sellers/{ref}/small-farm instead).`,
      ...before.map((r) => `UPDATE sellers SET is_small_farm = ${r.isSmallFarm ? 1 : 0} WHERE id = ${r.id} AND slug = ${sqlString(r.slug)};`),
      "",
    ].join("\n"),
    { flag: "wx" },
  );
  log(`backup: ${before.length} seller rows → ${backupJson} (sha256 ${backupSha256})`);
  log(`rollback: ${backupRollbackSql}`);

  // ── 2. Resolve + guards ──────────────────────────────────────────────────────────────────
  const rows = await db
    .select({ id: sellers.id, slug: sellers.slug, isSmallFarm: sellers.isSmallFarm, eligibility: sellers.eligibility })
    .from(sellers)
    .where(inArray(sellers.slug, [...badgeSlugs]));
  const bySlug = new Map<string, typeof rows>();
  for (const r of rows) bySlug.set(r.slug, [...(bySlug.get(r.slug) ?? []), r]);
  const missing = badgeSlugs.filter((s) => !bySlug.has(s));
  const duplicated = [...bySlug.entries()].filter(([, v]) => v.length > 1).map(([k]) => k);
  if (missing.length || duplicated.length || rows.length !== badgeSlugs.length) {
    throw new BadgeApplyError(
      `expected exactly ${badgeSlugs.length} resolutions, got ${rows.length}` +
        (missing.length ? `; missing: ${missing.join(", ")}` : "") +
        (duplicated.length ? `; duplicated: ${duplicated.join(", ")}` : ""),
    );
  }
  const removed = rows.filter((r) => r.eligibility === "removed_by_request").map((r) => r.slug);
  if (removed.length) throw new BadgeApplyError(`sellers removed at their request are never re-badged: ${removed.join(", ")}`);
  const strayBefore = before.filter((r) => r.isSmallFarm && (noBadgeSlugs.includes(r.slug) || defaultNoBadgeSlugs.includes(r.slug))).map((r) => r.slug);
  if (strayBefore.length) throw new BadgeApplyError(`NO BADGE sellers already carry the badge — investigate first: ${strayBefore.join(", ")}`);
  const resolved = badgeSlugs.map((slug) => {
    const r = bySlug.get(slug)![0]!;
    return { slug, id: r.id, before: r.isSmallFarm };
  });
  log(`resolved: ${resolved.length}/${badgeSlugs.length} BADGE slugs`);

  // Pre-flight: project the end state from the frozen rows and refuse to write at all if it
  // cannot reconcile (unexpected seller count, an unclassified seller, a stray badge).
  const preflight = reconcile(before, (r) => r.isSmallFarm || badgeSlugs.includes(r.slug), badgeSlugs, noBadgeSlugs, defaultNoBadgeSlugs);
  const preProblems = problemsOf(preflight, opts.expect);
  if (preProblems.length) {
    throw new BadgeApplyError(`pre-flight FAILED — nothing was written:\n  - ${preProblems.join("\n  - ")}`);
  }

  // ── 3. Apply through the admin repository ────────────────────────────────────────────────
  const seqBefore = await catalogSeq(db);
  const written: string[] = [];
  const alreadyBadged = resolved.filter((r) => r.before).map((r) => r.slug);
  for (const r of resolved) {
    if (r.before) continue;
    if (!dryRun) await setSellerSmallFarm(db, r.id, true, now().toISOString());
    written.push(r.slug);
    log(`${dryRun ? "would set" : "set"} is_small_farm = true  ${r.slug} (id ${r.id})`);
  }
  if (alreadyBadged.length) log(`already badged (left untouched): ${alreadyBadged.join(", ")}`);
  const seqAfter = await catalogSeq(db);

  // ── 4. Reconcile (re-read; a dry run reconciles the projection) ─────────────────────────
  const after = await readAllSellers(db);
  const reconciliation = reconcile(after, (r) => r.isSmallFarm || (dryRun && written.includes(r.slug)), badgeSlugs, noBadgeSlugs, defaultNoBadgeSlugs);
  log(
    `reconcile: total ${reconciliation.total} · badged ${reconciliation.badged} · not ${reconciliation.notBadged}` +
      ` (expected ${opts.expect.total} / ${opts.expect.badged} / ${opts.expect.notBadged})` +
      ` · catalog_seq ${seqBefore} → ${seqAfter}${dryRun ? " · DRY RUN (nothing written)" : ""}`,
  );
  const problems = problemsOf(reconciliation, opts.expect);
  if (!dryRun && seqAfter - seqBefore !== written.length) {
    problems.push(`catalog_seq advanced by ${seqAfter - seqBefore}, expected ${written.length} (one per write)`);
  }
  if (problems.length) {
    throw new BadgeApplyError(`reconciliation FAILED — stop and investigate before deploying anything on top:\n  - ${problems.join("\n  - ")}`);
  }

  return { backupJson, backupRollbackSql, backupSha256, resolved, written, alreadyBadged, seqBefore, seqAfter, reconciliation, dryRun };
}

type SellerRow = Awaited<ReturnType<typeof readAllSellers>>[number];

function reconcile(
  rows: SellerRow[],
  isBadged: (r: SellerRow) => boolean,
  badgeSlugs: readonly string[],
  noBadgeSlugs: readonly string[],
  defaultNoBadgeSlugs: readonly string[],
): ApplyResult["reconciliation"] {
  const badged = rows.filter(isBadged);
  // Known = judged BADGE + judged NO BADGE + DEFAULT NO BADGE (unreviewed). A seller in none
  // of the three is unclassified and fails reconciliation — fail-closed survives the defaults.
  const known = new Set([...badgeSlugs, ...noBadgeSlugs, ...defaultNoBadgeSlugs]);
  return {
    total: rows.length,
    badged: badged.length,
    notBadged: rows.length - badged.length,
    unclassified: rows.filter((r) => !known.has(r.slug)).map((r) => r.slug),
    strayBadged: badged.filter((r) => !badgeSlugs.includes(r.slug)).map((r) => r.slug),
  };
}

function problemsOf(r: ApplyResult["reconciliation"], expect: BadgeTarget): string[] {
  const p: string[] = [];
  if (r.total !== expect.total) p.push(`total ${r.total} ≠ ${expect.total}`);
  if (r.badged !== expect.badged) p.push(`badged ${r.badged} ≠ ${expect.badged}`);
  if (r.notBadged !== expect.notBadged) p.push(`not badged ${r.notBadged} ≠ ${expect.notBadged}`);
  if (r.unclassified.length) p.push(`sellers with no recorded judgment: ${r.unclassified.join(", ")}`);
  if (r.strayBadged.length) p.push(`badged sellers outside the BADGE list: ${r.strayBadged.join(", ")}`);
  return p;
}
