import type { PageContextServer } from "vike/types";
import { turnstileSiteKey } from "../../src/data/load";
import { legacySlug } from "../../src/lib/legacy";
import type { ReportFloorOutcome } from "../../src/server/form-posts";

export interface ReportPrefill {
  type: "correct" | "claim" | "remove";
  targetType: "variety" | "seller";
  targetRef: string;
}

// https://vike.dev/data — the /report read: ?type=/ ?seller=/ ?variety=
// prefill (v2/app/report/page.tsx's logic — a seller wins for
// claim/remove, a variety alone targets the variety, bogus values
// degrade to the default form, never an error), the Turnstile site key,
// and the floor POST's outcome when this render answers one (passed
// via pageContextInit by the server's POST handler).
export async function data(pageContext: PageContextServer): Promise<{
  prefill: ReportPrefill;
  siteKey: string | null;
  outcome: ReportFloorOutcome | null;
}> {
  const search = new URLSearchParams(pageContext.urlParsed.searchOriginal ?? "");
  const rawType = search.get("type");
  const type = rawType === "claim" || rawType === "remove" ? rawType : "correct";
  const seller = legacySlug(search.get("seller") ?? undefined);
  const variety = legacySlug(search.get("variety") ?? undefined);
  // A seller in the query wins for claim/remove; a variety alone targets the variety.
  const targetType = seller && (type !== "correct" || !variety) ? "seller" : variety ? "variety" : "seller";
  const targetRef = (targetType === "seller" ? seller : variety) ?? "";
  return {
    prefill: { type, targetType, targetRef },
    siteKey: turnstileSiteKey(pageContext),
    outcome: (pageContext.formOutcome as ReportFloorOutcome | undefined) ?? null,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
