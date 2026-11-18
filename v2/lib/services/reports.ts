/**
 * Reports (R8): correct / claim / remove requests from /report. Turnstile is verified against
 * siteverify ONLY when TURNSTILE_SECRET_KEY is configured; otherwise the report is accepted and
 * stored with turnstile = "not_configured". Each report lands in the review queue.
 */
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { REPORT_TARGET, REPORT_TYPE } from "@/lib/db/schema";
import { insertReportWithReviewItem, targetExists } from "@/lib/repositories/reports";
import { ServiceError } from "./ingest";

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const ReportBodySchema = z.strictObject({
  type: z.enum(REPORT_TYPE),
  target_type: z.enum(REPORT_TARGET),
  target_ref: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "a variety or seller slug").max(160),
  message: z.string().trim().min(5).max(4000),
  contact: z.email().max(320),
  turnstile_token: z.string().max(2048).optional(),
});
export type ReportBody = z.infer<typeof ReportBodySchema>;

export interface ReportDeps {
  turnstileSecret: string | null;
  fetchFn?: typeof fetch;
}

export function createReportService(db: Db, deps: ReportDeps) {
  const fetchFn = deps.fetchFn ?? fetch;
  return {
    async submit(body: ReportBody, ip: string | null) {
      let turnstile: "verified" | "not_configured" = "not_configured";
      if (deps.turnstileSecret) {
        if (!body.turnstile_token) throw new ServiceError(400, "turnstile_required", "turnstile_token is required");
        const form = new URLSearchParams({ secret: deps.turnstileSecret, response: body.turnstile_token });
        if (ip) form.set("remoteip", ip);
        const res = await fetchFn(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
        const out = (await res.json().catch(() => ({}))) as { success?: boolean };
        if (!out.success) throw new ServiceError(403, "turnstile_failed", "Turnstile verification failed");
        turnstile = "verified";
      }
      if (!(await targetExists(db, body.target_type, body.target_ref))) {
        throw new ServiceError(404, "unknown_target", `${body.target_type} ${body.target_ref} not found`);
      }
      const r = await insertReportWithReviewItem(db, {
        type: body.type,
        targetType: body.target_type,
        targetRef: body.target_ref,
        message: body.message,
        contact: body.contact,
        turnstile,
        createdAt: new Date().toISOString(),
      });
      return { report_id: r.reportId, review_item_id: r.reviewItemId, status: "open", turnstile };
    },
  };
}
