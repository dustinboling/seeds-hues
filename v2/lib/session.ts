/**
 * getCurrentUser() for Server Components: resolves the `sf_session` cookie to the signed-in
 * account (or null). Calling it makes the page dynamic — use it only on per-user pages
 * (/account, /add-your-farm); cached catalog pages fetch their per-user bits client-side.
 */
import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE } from "@/lib/accounts";
import { getServices } from "@/lib/services/context";
import { publicUser, type PublicUser } from "@/lib/services/accounts";

export const getCurrentUserRow = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? null;
  if (!token) return null;
  const { accounts } = await getServices();
  return accounts.userForSession(token);
});

export async function getCurrentUser(): Promise<PublicUser | null> {
  const u = await getCurrentUserRow();
  return u ? publicUser(u) : null;
}
