/**
 * Browser access to the admin surfaces (/admin/*), same admin-token pattern as /api/v1/admin:
 * the admin pastes an admin-scope API key once; it is kept in an HttpOnly, Secure,
 * SameSite=Strict cookie scoped to /admin for 8 hours and re-verified (hash lookup, revocation
 * honoured) on every request.
 */
import type { ApiKeyPrincipal } from "@/lib/services/auth";
import type { Services } from "@/lib/services";

export const ADMIN_COOKIE = "sf_admin";
export const ADMIN_COOKIE_MAX_AGE = 8 * 3600;

export const adminCookie = (key: string) => `${ADMIN_COOKIE}=${encodeURIComponent(key)}; Path=/admin; Max-Age=${ADMIN_COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
export const clearAdminCookie = () => `${ADMIN_COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

export async function adminPrincipal(services: Services, key: string | null | undefined): Promise<ApiKeyPrincipal | null> {
  if (!key) return null;
  const p = await services.auth.verify(decodeURIComponent(key));
  return p && p.scopes.includes("admin") ? p : null;
}
