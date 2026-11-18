/**
 * /api/v1/internal/* — operations endpoints, admin API key (Bearer, scope "admin"):
 *   POST /api/v1/internal/notifications/drain   — send queued waiting-list alerts (also run by
 *                                                 the Worker cron every 15 min; worker.ts).
 * Not part of the documented public API.
 */
import { writeRouter } from "@/lib/api/write-route";

export const dynamic = "force-dynamic";

export const { GET, HEAD, POST, PUT, PATCH, DELETE } = writeRouter("/api/v1/internal", [
  {
    method: "POST",
    pattern: "notifications/drain",
    scope: "admin",
    bucket: null,
    handler: async ({ services }) => ({ data: await services.notifications.drain() }),
  },
]);
