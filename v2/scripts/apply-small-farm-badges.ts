/**
 * One-off: apply the "Small farm" badge judgment (seller-classification.md, 44 BADGE slugs) to
 * the sellers table through the admin path — repositories/admin.ts setSellerSmallFarm, which
 * bumps catalog_seq + updated_seq so /sync/changes and the next snapshot carry the change
 * (Open Directory data-spec §4.1–§4.4). Never raw SQL.
 *
 *   tsx scripts/apply-small-farm-badges.ts --dry-run                        # local D1, no writes
 *   tsx scripts/apply-small-farm-badges.ts                                  # local D1
 *   tsx scripts/apply-small-farm-badges.ts --persist-to <dir> --expect 25/18/7   # a dev copy
 *   tsx scripts/apply-small-farm-badges.ts --remote --config wrangler.remote.jsonc --dry-run
 *
 * PRODUCTION (ship step only — not run during the build): migration 0010 first, then this script
 * with --remote (dry run, then real), THEN the code deploy, so every ISR page renders fresh with
 * the badges (a deploy starts a new build-id cache; this script cannot revalidate pages itself).
 * Production covers all 84 sellers (updated 2026-11-20): the original 28 (the 25 in
 * seed-data/catalog.json, seedtime + davids-garden-seeds (ingest) and geoseed (crawl)) plus the
 * 56 sellers added by the 2026-11-19/20 seller hunts, all individually reviewed by Hue
 * on 2026-11-20 (24 BADGE, 32 NO BADGE); no unreviewed defaults remain. Default
 * expectation: 84 total / 44 / 40.
 *
 * Every run (dry runs included) first writes a full `sellers` backup + a targeted rollback file to
 * tmp/backups/ (override with --backup-dir). D1 export is blocked by the FTS5 tables, so the
 * backup is read through the binding. Exit 0 = reconciled; 1 = aborted (see message).
 */
import { resolve } from "node:path";
import { createDb } from "@/lib/db/client";
import { SMALL_FARM_PRODUCTION_TARGET } from "@/lib/catalog/small-farm-classification";
import { openPlatform, parseArgs } from "./lib/platform";
import { BadgeApplyError, applySmallFarmBadges, type BadgeTarget } from "./lib/small-farm-badges";

function parseExpect(v: string | undefined): BadgeTarget {
  if (v === undefined) return { ...SMALL_FARM_PRODUCTION_TARGET };
  const m = /^(\d+)\/(\d+)\/(\d+)$/.exec(v);
  if (!m) throw new BadgeApplyError(`--expect takes total/badged/notBadged, e.g. 84/20/64 (got "${v}")`);
  const [total, badged, notBadged] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (badged + notBadged !== total) throw new BadgeApplyError(`--expect ${v}: badged + notBadged must equal total`);
  return { total, badged, notBadged };
}

async function main() {
  const args = parseArgs();
  const remote = args.flags.has("remote");
  if (remote && !args.values.get("config")) {
    throw new BadgeApplyError("--remote requires --config <wrangler config with remote D1 bindings> (README “Production data operations”)");
  }
  const expect = parseExpect(args.values.get("expect"));
  const dryRun = args.flags.has("dry-run");
  const label = remote ? "remote" : args.values.get("persist-to") ? "dev-copy" : "local";
  const proxy = await openPlatform(args);
  try {
    const db = createDb(proxy.env.DB);
    console.log(`Small farm badges → ${label} D1${dryRun ? " (DRY RUN)" : ""}; expecting ${expect.total} / ${expect.badged} / ${expect.notBadged}`);
    const r = await applySmallFarmBadges(db, {
      backupDir: resolve(args.values.get("backup-dir") ?? "tmp/backups"),
      label,
      expect,
      dryRun,
      log: (line) => console.log(`  ${line}`),
    });
    console.log(
      `\n✓ ${dryRun ? "Dry run reconciled" : "Reconciled"}: ${r.reconciliation.total} sellers · ${r.reconciliation.badged} badged · ` +
        `${r.reconciliation.notBadged} not · ${r.written.length} ${dryRun ? "would be written" : "written"} · ` +
        `${r.alreadyBadged.length} already badged`,
    );
  } finally {
    await proxy.dispose();
  }
}

main().catch((err: unknown) => {
  if (err instanceof BadgeApplyError) console.error(`✗ ${err.message}`);
  else console.error(err);
  process.exit(1);
});
