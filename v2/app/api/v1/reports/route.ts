/** POST /api/v1/reports — public; Turnstile behind config; 3/min/IP (R8). */
import { parseBody, writeRouter } from "@/lib/api/write-route";
import { clientKey } from "@/lib/api/rate-limit";
import { ReportBodySchema } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

export const { GET, HEAD, POST, PUT, PATCH, DELETE } = writeRouter("/api/v1/reports", [
  {
    method: "POST",
    pattern: "",
    scope: null,
    bucket: "reports",
    handler: async ({ req, services, body }) => {
      const ip = clientKey(req);
      const r = await services.reports.submit(parseBody(ReportBodySchema, body), ip === "unknown" ? null : ip);
      return { status: 201, data: r };
    },
  },
]);
