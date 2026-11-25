import type { PageContextServer } from "vike/types";
import { adminMeForPage } from "../../../src/server/admin-page";

// https://vike.dev/data — the varieties shell read: the viewer frame
// plus the selection (the list + detail load client-side).
export async function data(pageContext: PageContextServer): Promise<{
  viewer: { name: string; email: string; role: string } | null;
  selected: string | null;
  tab: string | null;
}> {
  const search = new URLSearchParams(pageContext.urlParsed.searchOriginal ?? "");
  const me = await adminMeForPage(pageContext);
  return {
    viewer: me.user ? { name: me.user.name, email: me.user.email, role: me.user.role } : null,
    selected: search.get("variety"),
    tab: search.get("tab"),
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
