/**
 * POST /admin/sign-in/request (form: email, next?, resend?) → issue a sign-in code, then 303
 * to the code step. Unknown emails advance identically (no enumeration). Resend-limit hits
 * land back on the code step with the designed note; a failed send returns to the email
 * step with the address preserved.
 */
import { getServices } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/ingest";
import { safeAdminNext } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const redirect = (to: string) => new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });
  const form = await req.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").trim();
  const next = safeAdminNext(form?.get("next")) ?? "/admin";
  const resend = form?.get("resend") === "1";
  if (!email || !email.includes("@")) {
    const params = new URLSearchParams({ error: "missing_email", next });
    if (email) params.set("email", email);
    return redirect(`/admin/sign-in?${params.toString()}`);
  }
  const services = await getServices();
  try {
    const { delivery } = await services.adminAuth.requestCode(email);
    if (delivery === "sent" || (delivery === "mail_not_configured" && process.env.NODE_ENV === "development")) {
      const params = new URLSearchParams({ email, next });
      if (resend) params.set("sent", "1");
      return redirect(`/admin/sign-in/code?${params.toString()}`);
    }
    const params = new URLSearchParams({ error: "send_failed", email, next });
    return redirect(`/admin/sign-in?${params.toString()}`);
  } catch (err) {
    if (err instanceof ServiceError && (err.code === "resend_too_soon" || err.code === "resend_limit")) {
      const params = new URLSearchParams({ email, next, error: err.code });
      return redirect(`/admin/sign-in/code?${params.toString()}`);
    }
    throw err;
  }
}
