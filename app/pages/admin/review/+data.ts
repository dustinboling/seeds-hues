import type { PageContextServer } from "vike/types";
import { adminMeForPage } from "../../../src/server/admin-page";
import { queueDef, type QueueKey } from "../../../src/lib/admin/review";

// https://vike.dev/data — the review shell read: the viewer frame plus
// the queue/item segment from the query (the rows + detail load
// client-side; the no-JS HTML carries no queue data).
export async function data(pageContext: PageContextServer): Promise<{
  viewer: { name: string; email: string; role: string } | null;
  queue: QueueKey;
  item: string | null;
  decided: boolean;
}> {
  const search = new URLSearchParams(pageContext.urlParsed.searchOriginal ?? "");
  const me = await adminMeForPage(pageContext);
  return {
    viewer: me.user ? { name: me.user.name, email: me.user.email, role: me.user.role } : null,
    queue: queueDef(search.get("queue") ?? "")?.key ?? "duplicates",
    item: search.get("item"),
    decided: search.get("decided") === "1",
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
