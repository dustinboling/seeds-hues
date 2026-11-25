import type { PageContextServer } from "vike/types";
import { adminMeForPage } from "../../../src/server/admin-page";
import { gateNoAccess } from "../../../src/server/admin-handlers";

// https://vike.dev/data — the no-access read: a signed-in visitor's
// identity comes from the session; a signed-out landing (after a
// no-role verify) names the account from the query. The privileged
// and bare-visit redirects are the server's 303 gate (serve.ts).
export async function data(pageContext: PageContextServer): Promise<{ name: string; email: string }> {
  const search = new URLSearchParams(pageContext.urlParsed.searchOriginal ?? "");
  const me = await adminMeForPage(pageContext);
  const shown = gateNoAccess(me, search.get("email"), search.get("name"));
  if (shown.kind === "show") return { name: shown.name, email: shown.email };
  return { name: search.get("name") ?? search.get("email") ?? "", email: search.get("email") ?? "" };
}

export type Data = Awaited<ReturnType<typeof data>>;
