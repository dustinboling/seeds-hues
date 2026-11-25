import type { PageContextServer } from "vike/types";
import { apiBaseUrl, apiOrigin } from "../../src/data/load";

export interface UnsubscribeScope {
  kind: "all" | "variety";
  variety: { name: string; slug: string } | null;
}

function isScope(value: unknown): value is UnsubscribeScope {
  if (typeof value !== "object" || value === null) return false;
  const scope = value as { kind?: unknown; variety?: unknown };
  if (scope.kind !== "all" && scope.kind !== "variety") return false;
  if (scope.variety === null) return true;
  if (typeof scope.variety !== "object" || scope.variety === null) return false;
  const variety = scope.variety as { name?: unknown; slug?: unknown };
  return typeof variety.name === "string" && typeof variety.slug === "string";
}

/**
 * What a link unsubscribes from, without changing anything (v2's
 * accounts.describeUnsubscribe, read through the new internal mount —
 * a Slice 9 carry: the backend has no such read today). Any failure
 * (bad signature, unknown shape, backend fault) reads as no scope —
 * the invalid-link state, by design (§6.2).
 */
async function describeToken(origin: string, token: string): Promise<UnsubscribeScope | null> {
  if (!token || token.length > 200) return null;
  try {
    const res = await fetch(`${origin}/api/internal/unsubscribe/describe?token=${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as { data?: unknown } | null;
    const scope = json?.data;
    return isScope(scope) ? scope : null;
  } catch {
    return null;
  }
}

// https://vike.dev/data — the /unsubscribe read: the signed token's
// scope, verified server-side. The page names what the link does and
// asks for one click to confirm; the flip itself is the client's POST.
export async function data(pageContext: PageContextServer): Promise<{ token: string; scope: UnsubscribeScope | null }> {
  const search = new URLSearchParams(pageContext.urlParsed.searchOriginal ?? "");
  const token = search.get("token") ?? "";
  return { token, scope: await describeToken(apiOrigin(apiBaseUrl()), token) };
}

export type Data = Awaited<ReturnType<typeof data>>;
