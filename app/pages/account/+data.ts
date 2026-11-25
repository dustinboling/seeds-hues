import type { PageContextServer } from "vike/types";
import { turnstileSiteKey } from "../../src/data/load";

// https://vike.dev/data — the /account shell read: the Turnstile site
// key and the ?deleted=1 notice flag. No session read server-side (the
// app never renders another user's state into shared HTML); the client
// resolves the session itself.
export async function data(pageContext: PageContextServer): Promise<{ siteKey: string | null; deleted: boolean }> {
  const search = new URLSearchParams(pageContext.urlParsed.searchOriginal ?? "");
  return { siteKey: turnstileSiteKey(pageContext), deleted: search.get("deleted") === "1" };
}

export type Data = Awaited<ReturnType<typeof data>>;
