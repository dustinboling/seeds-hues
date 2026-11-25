import { useEffect, useRef, useState } from "react";
import { ThemeArt } from "../ThemeArt";
import { callApi } from "../account/api";
import type { AccountPublicUser } from "../account/types";
import { AddYourFarmForm } from "./AddYourFarmForm";
import type { FarmFloorOutcome } from "../../server/form-posts";

/**
 * The /add-your-farm page body (Bea §5.1), ported from
 * v2/app/add-your-farm/page.tsx: the H1, the intro, the farm-gate
 * artwork, and the real form in the first HTML. One structural delta
 * from v2: the signed-in contact prefill lands client-side (the app's
 * SSR never reads the session, so the shell can't prefill it) —
 * fill-if-empty into the rendered fields, so a session that resolves
 * after the visitor starts typing never eats a typed value.
 */
export function FarmPage({
  siteKey,
  states,
  defaults,
  outcome,
}: {
  siteKey: string | null;
  states: { code: string; name: string }[];
  defaults: { contactName: string; contactEmail: string; state: string | null };
  outcome: FarmFloorOutcome | null;
}) {
  const [session, setSession] = useState<AccountPublicUser | null | "unknown">("unknown");
  const formWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void callApi<{ signed_in: boolean; user?: AccountPublicUser }>("/api/v1/account/me", undefined, "GET").then((r) => {
      if (!live) return;
      setSession(r.ok && r.data.signed_in && r.data.user ? r.data.user : null);
    });
    return () => {
      live = false;
    };
  }, []);

  // The signed-in contact prefill (v2 prefills server-side; the app
  // fills only empty fields, once the session is known).
  useEffect(() => {
    if (!session || session === "unknown") return;
    const root = formWrapRef.current;
    if (!root) return;
    const fill = (id: string, value: string) => {
      const input = root.querySelector<HTMLInputElement>(`#${id}`);
      if (input && input.value === "" && value !== "") {
        input.value = value;
        input.classList.add("field-filled");
      }
    };
    fill("contact_name", session.name);
    fill("contact_email", session.email);
  }, [session]);

  const signedIn = session !== null && session !== "unknown";
  return (
    <article className="form-page" aria-labelledby="farm-title">
      {/* Page head (spot-slots §3–§4): text first, then the decorative farm-gate painting — beside it
          from md up, centred below the note on phones. It lives here, outside AddYourFarmForm, so it
          persists unchanged through the form, error and success states. */}
      <div className="form-head-grid">
        <div>
          <h1 id="farm-title" className="page-title">
            Add Your Farm
          </h1>
          <p className="page-lede">
            Sell flower seed in the US? Farms and seed companies of any size are welcome here. Put your business in front of gardeners looking for exactly the varieties you sell. Listing is free, sellers never pay for placement, and every submission is reviewed by a person.
          </p>
          <p className="form-muted">
            {signedIn ? (
              <>Signed in as {session.email} — we’ve filled in your contact details.</>
            ) : (
              <>
                Have a Seed Directory account? <a href="/account">Sign in</a> first and we’ll link this farm to it.
              </>
            )}
          </p>
        </div>
        <div>
          <ThemeArt name="farm-gate" priority className="form-head-art" />
        </div>
      </div>
      <div ref={formWrapRef}>
        <AddYourFarmForm siteKey={siteKey} states={states} defaults={defaults} outcome={outcome} />
      </div>
    </article>
  );
}
