/**
 * Draft the profile summaries for new Add Your Farm submissions (brief #3 addendum).
 *
 *   npm run farm-summaries                                   # local D1 (.wrangler/state/v3)
 *   tsx scripts/farm-summaries.ts --limit 5
 *   tsx scripts/farm-summaries.ts --remote --config wrangler.remote.jsonc
 *
 * Processes the queued "farm_summary" crawl_jobs one submission (one host) at a time: fetches
 * robots.txt, the homepage and the About page as HuesSeedFinderBot with ≥ 2 s between requests,
 * keeps only claims whose quote is found verbatim in the fetched text, and stores the DRAFT +
 * evidence + machine-suggested values on the submission (lib/services/farm-summary.ts). Nothing
 * is published. Run it from a laptop/CI cron after new submissions arrive (they also show in
 * /admin/waitlist with draft status "pending" until then).
 */
import { createDb } from "@/lib/db/client";
import { runQueuedFarmSummaries } from "@/lib/services/farm-summary";
import { openPlatform, parseArgs } from "./lib/platform";

async function main() {
  const args = parseArgs();
  const limit = Number(args.values.get("limit") ?? "10");
  const proxy = await openPlatform(args);
  try {
    const results = await runQueuedFarmSummaries(createDb(proxy.env.DB), { limit });
    if (results.length === 0) console.log("No queued farm_summary jobs.");
    for (const r of results) console.log(JSON.stringify(r));
  } finally {
    await proxy.dispose();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
