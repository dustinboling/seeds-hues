/**
 * Shared +data helper for the admin Vike routes: resolves the admin
 * session for the incoming request (the same /me read the POST
 * handlers gate on) so shells server-render the viewer frame.
 *
 * Redirects are NOT thrown here — Vike's abort only speaks 301/302
 * while the admin gate is 303 throughout (v2 parity). The Node
 * server (serve.ts) enforces the 303 gate before renderPage; +data
 * only needs the viewer for the frame.
 */
import { apiBaseUrl, apiOrigin } from "../data/load";
import { fetchMe, type AdminMe, type ServiceFetch } from "./admin-handlers";

export async function adminMeForPage(pageContext: { adminApiBase?: string; requestCookie?: string | null }): Promise<AdminMe> {
  const origin = pageContext.adminApiBase ?? apiOrigin(apiBaseUrl());
  const cookie = pageContext.requestCookie ?? undefined;
  const serviceFetch: ServiceFetch = async (path, init) => {
    const res = await fetch(`${origin}${path}`, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        ...(init.cookie ? { Cookie: init.cookie } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, json, setCookie: res.headers.get("set-cookie") };
  };
  return fetchMe(serviceFetch, cookie);
}
