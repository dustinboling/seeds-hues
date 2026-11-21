/**
 * Server-side admin guard (Slice 0). Every /admin/* page except the sign-in flow and the
 * wrong-role landing calls requireAdmin() first: no valid admin session redirects to
 * /admin/sign-in (an expired session carries the welcome-back explanation plus the email
 * prefill, and the return path is preserved); a valid session on a visitor-role account
 * lands on the wrong-role page. Server-only: pages and route handlers import this, never
 * client components.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServices } from "@/lib/services/context";
import { ADMIN_SESSION_COOKIE, isPrivilegedRole, safeAdminNext } from "@/lib/admin-auth";

export interface AdminViewer {
  id: number;
  name: string;
  email: string;
  role: string;
}

/**
 * The signed-in admin viewer, or a redirect away. `returnTo` is the page's own path —
 * after sign-in the person returns to the exact screen they asked for.
 */
export async function requireAdmin(returnTo: string): Promise<AdminViewer> {
  const services = await getServices();
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const user = await services.adminAuth.userForAdminSession(token);
  if (user) {
    if (!isPrivilegedRole(user.role)) redirect("/admin/no-access");
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
  const params = new URLSearchParams({ next: safeAdminNext(returnTo) ?? "/admin" });
  const email = await services.adminAuth.expiredAdminSessionEmail(token);
  if (email) {
    params.set("expired", "1");
    params.set("email", email);
  }
  redirect(`/admin/sign-in?${params.toString()}`);
}

/** Guard + the shell's badge count in one call, for the section pages. */
export async function adminPageData(returnTo: string): Promise<{ viewer: AdminViewer; totalWaiting: number }> {
  const viewer = await requireAdmin(returnTo);
  const services = await getServices();
  const { totalWaiting } = await services.adminAuth.queueCards();
  return { viewer, totalWaiting };
}
