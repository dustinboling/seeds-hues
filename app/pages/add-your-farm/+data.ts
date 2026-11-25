import type { PageContextServer } from "vike/types";
import { turnstileSiteKey } from "../../src/data/load";
import { stateByCode, US_STATES } from "../../src/lib/states";
import type { FarmFloorOutcome } from "../../src/server/form-posts";

// https://vike.dev/data — the /add-your-farm read: the state list
// (alphabetical, v2's page shape), the ?state= prefill (bogus codes
// fall back to no prefill, never an error), the Turnstile site key,
// and the floor POST's outcome when this render answers one.
export async function data(pageContext: PageContextServer): Promise<{
  states: { code: string; name: string }[];
  defaults: { contactName: string; contactEmail: string; state: string | null };
  siteKey: string | null;
  outcome: FarmFloorOutcome | null;
}> {
  const search = new URLSearchParams(pageContext.urlParsed.searchOriginal ?? "");
  const rawState = search.get("state");
  const state = stateByCode(rawState?.toUpperCase())?.code ?? null;
  const states = [...US_STATES].sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ code: s.code, name: s.name }));
  return {
    states,
    defaults: { contactName: "", contactEmail: "", state },
    siteKey: turnstileSiteKey(pageContext),
    outcome: (pageContext.formOutcome as FarmFloorOutcome | undefined) ?? null,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
