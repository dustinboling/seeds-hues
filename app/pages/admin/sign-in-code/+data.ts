import type { PageContextServer } from "vike/types";
import { safeAdminNext } from "../../../src/lib/admin/auth";

// https://vike.dev/data — the code step read: the email carried from
// step 1, the safe return path, the resend confirmation, and the
// error/tries pair for the designed inline states.
export async function data(pageContext: PageContextServer): Promise<{
  email: string | null;
  next: string;
  sent: boolean;
  error: string | null;
  tries: number | null;
}> {
  const search = new URLSearchParams(pageContext.urlParsed.searchOriginal ?? "");
  const triesRaw = search.get("tries") ?? "";
  const tries = /^\d+$/.test(triesRaw) ? Number(triesRaw) : null;
  return {
    email: search.get("email"),
    next: safeAdminNext(search.get("next")) ?? "/admin",
    sent: search.get("sent") === "1",
    error: search.get("error"),
    tries,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
