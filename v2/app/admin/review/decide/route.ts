/**
 * POST /admin/review/decide — every queue decision (Slice A). Native form posts (no JS
 * needed): the handler resolves the admin session, enforces the role server-side, calls the
 * service-layer effect, revalidates the public paths the service returns, and redirects back
 * to the queue with the status wording + the advance cursor. Failures redirect to the same
 * friendly status lines the pane renders — never a raw error (§10.2).
 */
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getServices } from "@/lib/services/context";
import { withVariantPaths } from "@/lib/api/revalidate";
import { ServiceError } from "@/lib/services/ingest";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { composeReason, queueDef, QUEUE_WINDOW, type QueueKey } from "@/lib/admin/review-queues";

export const dynamic = "force-dynamic";

const redirect = (to: string) => new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const forbiddenPage = (back: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not included | Seed Directory admin</title></head><body><main><h1>Not included in your role</h1><p>Your reviewer role doesn't include that action.</p><p><a href="${back}">Back to the queue</a></p></main></body></html>`,
    { status: 403, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );

function text(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function intId(v: string | null): number | null {
  if (!v || !/^\d{1,12}$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}

function queueParam(v: string | null): QueueKey {
  return queueDef(v ?? "")?.key ?? "duplicates";
}

function showParam(v: string | null): number {
  const n = intId(v) ?? QUEUE_WINDOW;
  return Math.min(200, Math.max(QUEUE_WINDOW, Math.ceil(n / QUEUE_WINDOW) * QUEUE_WINDOW));
}

function backTo(queue: QueueKey, show: number, extra: Record<string, string | null>): string {
  const params = new URLSearchParams({ queue, show: String(show) });
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  return `/admin/review?${params.toString()}`;
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });
  const form = await req.formData().catch(() => null);
  const action = form ? text(form, "action") : null;
  const queue = queueParam(form ? text(form, "queue") : null);
  const show = showParam(form ? text(form, "show") : null);
  const kind = form ? text(form, "kind") : null;
  const id = intId(form ? text(form, "id") : null);
  const createdAt = form ? text(form, "created_at") : null;
  const failed = backTo(queue, show, { ...(kind && id ? { item: `${kind}-${id}` } : {}), status: "failed" });

  const services = await getServices();
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const user = await services.adminAuth.userForAdminSession(token);
  const deepNext = backTo(queue, show, { ...(kind && id ? { item: `${kind}-${id}` } : {}) });
  if (!user) return redirect(`/admin/sign-in?next=${encodeURIComponent(deepNext)}`);
  if (user.role !== "admin" && user.role !== "reviewer") return redirect("/admin/no-access");

  if (!action || (kind !== "review" && kind !== "farm") || !id) return redirect(failed);
  const after = createdAt && /^\d{4}-\d{2}-\d{2}/.test(createdAt) ? `${createdAt}~${kind}~${id}` : null;
  const done = (extra: Record<string, string | null>) => backTo(queue, show, { ...(after ? { after } : {}), ...extra });
  const c = { role: user.role, decider: { userId: user.id, name: user.name } };
  const reasonText = (() => {
    const t = form ? text(form, "reason") : null;
    return t ? t.slice(0, 500) : null;
  })();
  const sheetReason = composeReason(form ? text(form, "reason_select") : null, form ? text(form, "reason_note") : null);
  const label = (key: string) => (form ? text(form, key) : null);

  try {
    let r: { data: Record<string, unknown>; revalidate: string[] };
    let status: Record<string, string | null>;
    switch (action) {
      case "approve_candidate":
        if (kind !== "review") return redirect(failed);
        r = await services.adminReview.approveSellerCandidate(id, c);
        status = { status: "seller_created" };
        break;
      case "decline_candidate":
        if (kind !== "review") return redirect(failed);
        r = await services.adminReview.declineSellerCandidate(id, c, reasonText ?? undefined);
        status = { status: "candidate_declined", name: label("item_name") };
        break;
      case "approve_farm":
        if (kind !== "farm") return redirect(failed);
        r = await services.adminReview.approveFarm(id, c);
        status = { status: "seller_created" };
        break;
      case "decline_farm":
        if (kind !== "farm") return redirect(failed);
        r = await services.adminReview.declineFarm(id, c, reasonText ?? undefined);
        status = { status: "farm_declined", name: label("item_name") };
        break;
      case "publish_listing":
        if (kind !== "review") return redirect(failed);
        r = await services.adminReview.publishListing(id, c);
        status = { status: "published", variety: label("variety_name") };
        break;
      case "add_variety":
        if (kind !== "review") return redirect(failed);
        r = await services.adminReview.addVariety(id, c);
        status = { status: "published", variety: label("variety_name") };
        break;
      case "reject_listing":
        if (kind !== "review") return redirect(failed);
        r = await services.adminReview.rejectQueuedListing(id, c, sheetReason ?? undefined);
        status = { status: "listing_rejected" };
        break;
      case "mark_duplicate":
        if (kind !== "review") return redirect(failed);
        r = await services.adminReview.decideDuplicate(id, "duplicate", c);
        status = { status: "duplicate_kept", existing: typeof r.data.existing === "string" ? r.data.existing : label("candidate_name") };
        break;
      case "add_hold_variety":
        if (kind !== "review") return redirect(failed);
        r = await services.adminReview.decideDuplicate(id, "not_duplicate", c);
        status = { status: "variety_added", held: typeof r.data.held_name === "string" ? r.data.held_name : label("held_name") };
        break;
      case "skip_hold":
        if (kind !== "review") return redirect(failed);
        r = await services.adminReview.skipHold(id, c);
        status = { status: "hold_skipped" };
        break;
      case "dismiss_report":
        if (kind !== "review") return redirect(failed);
        r = await services.adminReview.dismissReport(id, c, reasonText ?? undefined);
        status = { status: "report_dismissed" };
        break;
      case "apply_correction":
        if (kind !== "review") return redirect(failed);
        r = await services.adminReview.applyCorrection(id, c);
        status = { status: "correction_applied", seller: label("seller_name") };
        break;
      case "confirm_report":
        if (kind !== "review") return redirect(failed);
        r = await services.adminReview.confirmReport(id, c);
        status = { status: "report_verified" };
        break;
      case "apply_removal":
        if (kind !== "review") return redirect(failed);
        r = await services.adminReview.applyRemoval(id, c);
        status = { status: "removal_applied", seller: label("seller_name") };
        break;
      case "retire_listing": {
        if (kind !== "review") return redirect(failed);
        const listingId = intId(form ? text(form, "listing_id") : null);
        if (!listingId) return redirect(failed);
        r = await services.adminReview.retireFromReport(id, listingId, sheetReason, c);
        status = { status: "listing_retired", variety: label("variety_name") };
        break;
      }
      default:
        return redirect(failed);
    }
    for (const p of withVariantPaths(r.revalidate)) revalidatePath(p);
    return redirect(done(status));
  } catch (err) {
    if (err instanceof ServiceError && err.code === "already_resolved") {
      const trail = await services.adminReview.locate({ kind, id });
      const name = trail.status === "decided" ? trail.decidedByName : null;
      return redirect(done({ status: "already_decided", ...(name ? { name } : {}) }));
    }
    if (err instanceof ServiceError && err.code === "variety_changed") {
      // The candidate moved meanwhile: stay on the hold with the fresh state + the line.
      return redirect(backTo(queue, show, { item: `${kind}-${id}`, status: "stale_candidate" }));
    }
    if (err instanceof ServiceError && err.status === 403) return forbiddenPage(backTo(queue, show, {}));
    return redirect(failed);
  }
}
