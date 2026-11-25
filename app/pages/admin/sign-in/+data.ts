import type { PageContextServer } from "vike/types";
import { safeAdminNext } from "../../../src/lib/admin/auth";

// https://vike.dev/data — the sign-in email step read: the safe return
// path, the email prefill (expired sessions carry it), the A3
// welcome-back flag, the signed-out confirmation, and the error key.
// The live-session skip is the server's 303 gate (serve.ts), not here.
export async function data(pageContext: PageContextServer): Promise<{
  next: string;
  email: string | null;
  expired: boolean;
  signedOut: boolean;
  error: string | null;
}> {
  const search = new URLSearchParams(pageContext.urlParsed.searchOriginal ?? "");
  const next = safeAdminNext(search.get("next")) ?? "/admin";
  return {
    next,
    email: search.get("email"),
    expired: search.get("expired") === "1",
    signedOut: search.get("signedout") === "1",
    error: search.get("error"),
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
