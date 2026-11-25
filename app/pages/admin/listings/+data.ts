import type { PageContextServer } from "vike/types";
import { adminMeForPage } from "../../../src/server/admin-page";

// https://vike.dev/data — the listings shell read: the viewer frame
// plus the selected listing id (the list + detail load client-side).
export async function data(pageContext: PageContextServer): Promise<{
  viewer: { name: string; email: string; role: string } | null;
  selected: number | null;
}> {
  const search = new URLSearchParams(pageContext.urlParsed.searchOriginal ?? "");
  const me = await adminMeForPage(pageContext);
  const raw = search.get("listing") ?? "";
  return {
    viewer: me.user ? { name: me.user.name, email: me.user.email, role: me.user.role } : null,
    selected: /^\d+$/.test(raw) ? Number(raw) : null,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
