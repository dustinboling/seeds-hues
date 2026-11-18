/**
 * POST /admin/waitlist/action — the /admin/waitlist page's forms (admin cookie, same-origin):
 *   approve | reject a farm submission, grant | revoke the farm-owner flag.
 * Each calls the same service as the /api/v1/admin JSON routes, then redirects back with a note.
 */
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminPrincipal } from "@/lib/admin-session";
import { getServices } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/ingest";

export const dynamic = "force-dynamic";

const back = (note: string) =>
  new Response(null, { status: 303, headers: { Location: `/admin/waitlist?note=${encodeURIComponent(note)}`, "Cache-Control": "no-store" } });

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });
  const services = await getServices();
  const principal = await adminPrincipal(services, (await cookies()).get(ADMIN_COOKIE)?.value);
  if (!principal) return new Response(null, { status: 303, headers: { Location: "/admin/waitlist" } });
  const f = await req.formData();
  const op = String(f.get("op") ?? "");
  const id = Number(f.get("id") ?? 0);
  const seller = String(f.get("seller") ?? "").trim() || undefined;
  const userRaw = String(f.get("user") ?? "").trim();
  const user = /^\d+$/.test(userRaw) ? Number(userRaw) : userRaw;
  try {
    if (op === "approve") {
      const r = await services.farms.approve(id, { seller }, principal.label);
      return back(`Submission ${id} approved${r.farm_owner ? ` — account ${r.farm_owner.user_id} is now the verified owner of ${r.farm_owner.seller}` : r.seller ? " (no matching account to flag)" : " (no seller linked yet)"}.`);
    }
    if (op === "reject") {
      await services.farms.reject(id, principal.label);
      return back(`Submission ${id} declined.`);
    }
    if (op === "grant") {
      const r = await services.farms.setFarmOwner({ user, seller }, principal.label);
      return back(`Account ${r.user_id} is now the verified owner of ${r.seller}.`);
    }
    if (op === "revoke") {
      const r = await services.farms.revokeFarmOwner({ user }, principal.label);
      return back(`Farm-owner status revoked for account ${r.user_id}.`);
    }
    return back("Unknown action.");
  } catch (err) {
    if (err instanceof ServiceError) return back(`Not done: ${err.message}`);
    throw err;
  }
}
