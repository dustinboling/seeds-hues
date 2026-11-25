import type { PageContextServer } from "vike/types";
import { adminMeForPage } from "../../../src/server/admin-page";

// https://vike.dev/data — the sellers shell read: the viewer frame
// plus the selected seller slug (the list + detail load client-side;
// the no-JS HTML carries no seller data).
export async function data(pageContext: PageContextServer): Promise<{
  viewer: { name: string; email: string; role: string } | null;
  selected: string | null;
}> {
  const search = new URLSearchParams(pageContext.urlParsed.searchOriginal ?? "");
  const me = await adminMeForPage(pageContext);
  return {
    viewer: me.user ? { name: me.user.name, email: me.user.email, role: me.user.role } : null,
    selected: search.get("seller"),
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
