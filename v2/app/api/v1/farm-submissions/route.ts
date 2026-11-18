/** POST /api/v1/farm-submissions — the Add Your Farm form (Turnstile required; pending review). */
import { assertSameOrigin, sessionUser } from "@/lib/api/account-routes";
import { clientKey } from "@/lib/api/rate-limit";
import { parseBody, writeRouter } from "@/lib/api/write-route";
import { FarmSubmissionSchema } from "@/lib/services/farms";

export const dynamic = "force-dynamic";

export const { GET, HEAD, POST, PUT, PATCH, DELETE } = writeRouter("/api/v1/farm-submissions", [
  {
    method: "POST",
    pattern: "",
    scope: null,
    bucket: "reports",
    handler: async (ctx) => {
      assertSameOrigin(ctx);
      const ip = clientKey(ctx.req);
      const r = await ctx.services.farms.submit(parseBody(FarmSubmissionSchema, ctx.body ?? {}), await sessionUser(ctx), ip === "unknown" ? null : ip);
      return { status: 201, data: r };
    },
  },
]);
