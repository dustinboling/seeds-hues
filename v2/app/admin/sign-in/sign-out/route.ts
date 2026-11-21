/** POST /admin/sign-in/sign-out → drop the admin session, confirm, keep the visitor session. */
import { cookies } from "next/headers";
import { getServices } from "@/lib/services/context";
import { ADMIN_SESSION_COOKIE, clearAdminSessionCookie } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });
  const services = await getServices();
  await services.adminAuth.signOut((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  return new Response(null, {
    status: 303,
    headers: { Location: "/admin/sign-in?signedout=1", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Set-Cookie": clearAdminSessionCookie() },
  });
}
