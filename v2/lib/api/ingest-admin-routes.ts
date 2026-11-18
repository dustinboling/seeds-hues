/**
 * Route tables for /api/v1/ingest/* (scope ingest, 600/min/key) and /api/v1/admin/* (scope
 * admin) — R10 / R11. Bound by app/api/v1/{ingest,admin}/[...path]/route.ts.
 */
import { z } from "zod";
import {
  ApproveBodySchema,
  JobBodySchema,
  MergeBodySchema,
  ReviewListQuerySchema,
  SellerActionBodySchema,
} from "@/lib/services/admin";
import { LeaseBodySchema, ObservationsBodySchema, SellerCandidateBodySchema, SourceBodySchema } from "@/lib/services/ingest";
import { ApproveFarmSchema, FarmOwnerSchema } from "@/lib/services/farms";
import { Problem } from "./problem";
import { intParam, parseBody, type RouteSpec } from "./write-route";
import { parseLimit } from "./pagination";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const utcDate = (d: Date) => d.toISOString().slice(0, 10);

export const INGEST_ROUTES: RouteSpec[] = [
  {
    method: "POST",
    pattern: "jobs/lease",
    scope: "ingest",
    bucket: "ingest",
    idempotent: true,
    handler: async ({ services, body }) => ({ data: await services.ingest.lease(parseBody(LeaseBodySchema, body)) }),
  },
  {
    method: "POST",
    pattern: "jobs/:id/complete",
    scope: "ingest",
    bucket: "ingest",
    idempotent: true,
    handler: async ({ services, params }) => ({ data: await services.ingest.completeJob(intParam(params.id, "job")) }),
  },
  {
    method: "POST",
    pattern: "jobs/:id/fail",
    scope: "ingest",
    bucket: "ingest",
    idempotent: true,
    handler: async ({ services, params }) => ({ data: await services.ingest.failJob(intParam(params.id, "job")) }),
  },
  {
    method: "POST",
    pattern: "sources",
    scope: "ingest",
    bucket: "ingest",
    idempotent: true,
    handler: async ({ services, body }) => {
      const r = await services.ingest.registerSource(parseBody(SourceBodySchema, body));
      return { status: r.created ? 201 : 200, data: r };
    },
  },
  {
    method: "POST",
    pattern: "observations",
    scope: "ingest",
    bucket: "ingest",
    idempotent: true,
    handler: async ({ services, body }) => {
      const r = await services.ingest.observations(parseBody(ObservationsBodySchema, body));
      const revalidate = r.results.flatMap((x) => (x.status === "published" ? [`/variety/${x.variety_slug}`] : []));
      return { data: r, revalidate };
    },
  },
  {
    method: "POST",
    pattern: "seller-candidates",
    scope: "ingest",
    bucket: "ingest",
    idempotent: true,
    handler: async ({ services, body }) => ({ status: 201, data: await services.ingest.sellerCandidate(parseBody(SellerCandidateBodySchema, body)) }),
  },
  {
    method: "GET",
    pattern: "match-context",
    scope: "ingest",
    bucket: "ingest",
    handler: async ({ services, url }) => {
      const crop = url.searchParams.get("crop") ?? "";
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(crop)) throw new Problem(400, "validation_error", "crop must be a crop slug");
      const r = await services.ingest.matchContext(crop);
      if (!r) throw new Problem(404, "not_found", `crop ${crop} not found`);
      return { data: r };
    },
  },
];

const ReviewAction = z.enum(["approve", "reject", "merge"]);
const SellerAction = z.enum(["approve", "reject", "remove"]);

export const ADMIN_ROUTES: RouteSpec[] = [
  {
    method: "GET",
    pattern: "review",
    scope: "admin",
    bucket: null,
    handler: async ({ services, url }) => {
      const q = parseBody(ReviewListQuerySchema, {
        type: url.searchParams.get("type") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
      });
      const items = await services.admin.listReview(q, parseLimit(url.searchParams.get("limit"), 100, 500));
      return { data: items };
    },
  },
  ...ReviewAction.options.map(
    (action): RouteSpec => ({
      method: "POST",
      pattern: `review/:id/${action}`,
      scope: "admin",
      bucket: null,
      idempotent: true,
      handler: async ({ services, params, body }) => {
        const id = intParam(params.id, "review item");
        const r =
          action === "approve"
            ? await services.admin.approve(id, parseBody(ApproveBodySchema, body ?? {}))
            : action === "reject"
              ? await services.admin.reject(id)
              : await services.admin.merge(id, parseBody(MergeBodySchema, body));
        return { data: r.data, revalidate: r.revalidate };
      },
    }),
  ),
  ...SellerAction.options.map(
    (action): RouteSpec => ({
      method: "POST",
      pattern: `sellers/:id/${action}`,
      scope: "admin",
      bucket: null,
      idempotent: true,
      handler: async ({ services, params, body }) => {
        const ref = params.id ?? "";
        if (!/^(\d{1,12}|[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(ref)) throw new Problem(404, "not_found", "seller not found");
        const r = await services.admin.sellerAction(ref, action, parseBody(SellerActionBodySchema, body ?? {}));
        return { data: r.data, revalidate: r.revalidate };
      },
    }),
  ),
  {
    method: "GET",
    pattern: "stats/demand",
    scope: "admin",
    bucket: null,
    handler: async ({ services, url }) => {
      const since = url.searchParams.get("since") ?? utcDate(new Date(Date.now() - 30 * 86_400_000));
      if (!DATE.test(since)) throw new Problem(400, "validation_error", "since must be YYYY-MM-DD");
      return { data: { since, ...(await services.admin.demand(since, parseLimit(url.searchParams.get("limit"), 20, 100))) } };
    },
  },
  {
    method: "GET",
    pattern: "health",
    scope: "admin",
    bucket: null,
    handler: async ({ services }) => ({ data: await services.admin.health() }),
  },
  {
    method: "POST",
    pattern: "rollup",
    scope: "admin",
    bucket: null,
    handler: async ({ services, body }) => {
      const b = parseBody(z.strictObject({ date: z.string().regex(DATE).optional() }).default({}), body ?? {});
      // Default: yesterday (UTC) — the nightly rollup covers the finished day.
      const date = b.date ?? utcDate(new Date(Date.now() - 86_400_000));
      return { data: { date, ...(await services.admin.rollup(date)) } };
    },
  },
  // ── Phase 3: waiting-list demand view, Add Your Farm queue, the farm-owner flag ──
  {
    method: "GET",
    pattern: "waitlist",
    scope: "admin",
    bucket: null,
    handler: async ({ services, url }) => ({ data: await services.farms.demandView(parseLimit(url.searchParams.get("limit"), 50, 500)) }),
  },
  {
    method: "GET",
    pattern: "farm-submissions",
    scope: "admin",
    bucket: null,
    handler: async ({ services, url }) => {
      const status = url.searchParams.get("status");
      if (status && !["pending", "approved", "rejected"].includes(status)) throw new Problem(400, "validation_error", "status must be pending|approved|rejected");
      return { data: await services.farms.list({ status: (status ?? undefined) as "pending" | undefined, limit: parseLimit(url.searchParams.get("limit"), 50, 500) }) };
    },
  },
  {
    method: "POST",
    pattern: "farm-submissions/:id/approve",
    scope: "admin",
    bucket: null,
    idempotent: true,
    handler: async ({ services, params, body, principal }) =>
      ({ data: await services.farms.approve(intParam(params.id, "farm submission"), parseBody(ApproveFarmSchema, body ?? {}), principal?.label ?? "admin") }),
  },
  {
    method: "POST",
    pattern: "farm-submissions/:id/reject",
    scope: "admin",
    bucket: null,
    idempotent: true,
    handler: async ({ services, params, principal }) => ({ data: await services.farms.reject(intParam(params.id, "farm submission"), principal?.label ?? "admin") }),
  },
  {
    method: "POST",
    pattern: "farm-owners/grant",
    scope: "admin",
    bucket: null,
    handler: async ({ services, body, principal }) => ({ data: await services.farms.setFarmOwner(parseBody(FarmOwnerSchema, body), principal?.label ?? "admin") }),
  },
  {
    method: "POST",
    pattern: "farm-owners/revoke",
    scope: "admin",
    bucket: null,
    handler: async ({ services, body, principal }) => ({ data: await services.farms.revokeFarmOwner(parseBody(FarmOwnerSchema, body), principal?.label ?? "admin") }),
  },
  {
    method: "POST",
    pattern: "jobs",
    scope: "admin",
    bucket: null,
    idempotent: true,
    handler: async ({ services, body }) => {
      const j = await services.admin.enqueueJob(parseBody(JobBodySchema, body));
      return { status: 201, data: { id: j.id, type: j.type, target: j.target, status: j.status } };
    },
  },
];
