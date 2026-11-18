/**
 * The Worker's cron handler body (wrangler.jsonc "triggers.crons": every 15 minutes; entry
 * worker.ts). Runs the SAME drain as POST /api/v1/internal/notifications/drain — sweep the
 * matcher, then send queued waiting-list alerts (email + SMS) — and prunes sign-in attempt rows
 * older than a day. Runs outside a Next request, so bindings come straight from `env`.
 */
import { dbFromBindings } from "@/lib/db/client";
import { runtimeEnvFrom } from "@/lib/api/env-config";
import { servicesFor } from "@/lib/services/wire";
import { pruneAttempts } from "@/lib/repositories/accounts";

export async function runScheduled(env: unknown, now = new Date()) {
  const db = dbFromBindings(env as { DB?: D1Database });
  const services = servicesFor(db, runtimeEnvFrom(env));
  const report = await services.notifications.drain();
  await pruneAttempts(db, new Date(now.getTime() - 86_400_000).toISOString());
  console.log("scheduled drain", JSON.stringify(report));
  return report;
}
