/**
 * POST /admin/sign-in/verify (form: email, code, next?) → check the code. A correct code
 * for a reviewer/admin account sets the 7-day admin session cookie and 303s to the return
 * path; a correct code for a visitor-role account lands on the wrong-role page (no
 * session); anything else returns to the code step with the designed state.
 */
import { getServices } from "@/lib/services/context";
import { adminSessionCookie, safeAdminNext } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const redirect = (to: string, cookie?: string) =>
  new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...(cookie ? { "Set-Cookie": cookie } : {}) } });

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });
  const form = await req.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").trim();
  const code = String(form?.get("code") ?? "").trim();
  const next = safeAdminNext(form?.get("next")) ?? "/admin";
  if (!email) return redirect(`/admin/sign-in?next=${encodeURIComponent(next)}`);
  if (!code) return redirect(`/admin/sign-in/code?${new URLSearchParams({ email, next, error: "missing_code" }).toString()}`);
  const services = await getServices();
  const r = await services.adminAuth.verifyCode(email, code);
  if (!r.ok && r.code === "no_role") {
    return redirect(`/admin/no-access?${new URLSearchParams({ name: r.name, email: r.email }).toString()}`);
  }
  if (!r.ok) {
    const params = new URLSearchParams({ email, next, error: r.code });
    if (r.code === "code_incorrect" && r.attemptsLeft !== undefined) params.set("tries", String(r.attemptsLeft));
    return redirect(`/admin/sign-in/code?${params.toString()}`);
  }
  return redirect(next, adminSessionCookie(r.session.token));
}
