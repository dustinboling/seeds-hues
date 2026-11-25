import type { PageContextServer } from "vike/types";
import { adminMeForPage } from "../../../src/server/admin-page";

// https://vike.dev/data — the hub shell read: the viewer frame only.
// The dashboard cards load client-side (the no-JS HTML carries no
// queue data). The auth gate is the server's 303 (serve.ts).
export async function data(pageContext: PageContextServer): Promise<{
  viewer: { name: string; email: string; role: string } | null;
}> {
  const me = await adminMeForPage(pageContext);
  return { viewer: me.user ? { name: me.user.name, email: me.user.email, role: me.user.role } : null };
}

export type Data = Awaited<ReturnType<typeof data>>;
