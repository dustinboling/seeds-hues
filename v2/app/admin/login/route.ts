/** POST /admin/login (form: key) → admin cookie; POST /admin/login with logout=1 clears it. */
import { adminCookie, adminPrincipal, clearAdminCookie } from "@/lib/admin-session";
import { getServices } from "@/lib/services/context";

export const dynamic = "force-dynamic";

const redirect = (to: string, cookie?: string) =>
  new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...(cookie ? { "Set-Cookie": cookie } : {}) } });

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });
  const form = await req.formData().catch(() => null);
  if (form?.get("logout")) return redirect("/admin/waitlist", clearAdminCookie());
  const key = String(form?.get("key") ?? "").trim();
  const services = await getServices();
  if (!(await adminPrincipal(services, key))) return redirect("/admin/waitlist?error=key");
  return redirect("/admin/waitlist", adminCookie(key));
}
