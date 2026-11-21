/**
 * Wrong-role landing (spec §7 A4, §8.1): a signed-in account without an admin role — or a
 * reviewer/admin session that lost its role — lands here, with no admin data rendered. A
 * privileged session that strays here goes home; a bare visit signs in first.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServices } from "@/lib/services/context";
import { ADMIN_SESSION_COOKIE, firstParam, isPrivilegedRole } from "@/lib/admin-auth";
import { NoAccess } from "@/components/admin/NoAccess";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin access", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminNoAccessPage({ searchParams }: Props) {
  const services = await getServices();
  const user = await services.adminAuth.userForAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (user && isPrivilegedRole(user.role)) redirect("/admin");
  if (user) return <NoAccess variant="no-role" name={user.name} email={user.email} />;
  const sp = await searchParams;
  const email = firstParam(sp.email);
  if (!email) redirect("/admin/sign-in");
  return <NoAccess variant="no-role" name={firstParam(sp.name) ?? email} email={email} />;
}
