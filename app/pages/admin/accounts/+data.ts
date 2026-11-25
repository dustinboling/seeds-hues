import type { PageContextServer } from "vike/types";
import { adminMeForPage } from "../../../src/server/admin-page";

// https://vike.dev/data — the accounts shell read: the viewer frame
// plus the selected account id. Reviewers render the landing (no
// fetch); admins load list + detail client-side.
export async function data(pageContext: PageContextServer): Promise<{
  viewer: { id: number; name: string; email: string; role: string } | null;
  selected: number | null;
}> {
  const search = new URLSearchParams(pageContext.urlParsed.searchOriginal ?? "");
  const me = await adminMeForPage(pageContext);
  const raw = search.get("account") ?? "";
  return {
    viewer: me.user ? { id: me.user.id, name: me.user.name, email: me.user.email, role: me.user.role } : null,
    selected: /^\d+$/.test(raw) ? Number(raw) : null,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
