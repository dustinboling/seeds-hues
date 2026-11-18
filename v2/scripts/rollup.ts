/**
 * Nightly rollup (R11): aggregate non-bot click_events for one UTC day into daily_stats
 * (replacing that day's rows, so re-runs are safe). Same code path as POST /api/v1/admin/rollup.
 *
 *   tsx scripts/rollup.ts                 # yesterday (UTC)
 *   tsx scripts/rollup.ts --date 2026-11-16 [--persist-to <dir>]
 */
import { createDb } from "@/lib/db/client";
import { createAdminService } from "@/lib/services/admin";
import { openPlatform, parseArgs } from "./lib/platform";

async function main() {
  const args = parseArgs();
  const date = args.values.get("date") ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error("--date must be YYYY-MM-DD");
    process.exit(2);
  }
  const proxy = await openPlatform(args);
  try {
    const r = await createAdminService(createDb(proxy.env.DB)).rollup(date);
    console.log(`daily_stats ${date}: ${r.rows} (variety, seller) rows, ${r.clicks} non-bot clicks`);
  } finally {
    await proxy.dispose();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
