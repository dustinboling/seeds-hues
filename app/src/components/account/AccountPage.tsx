import { useCallback, useEffect, useState } from "react";
import { ThemeArt } from "../ThemeArt";
import { callApi } from "./api";
import { AccountPanel } from "./AccountPanel";
import { CreateAccountForm } from "./CreateAccountForm";
import { SignInForm } from "./SignInForm";
import type { AlertItem, AccountPublicUser } from "./types";

/**
 * The /account SPA surface (Bea §6.1): the signed-out frame
 * server-renders (crawlers always see it — no per-user content in the
 * shell); the client reads the session (GET /api/v1/account/me) and
 * swaps to the signed-in panel without a reload. Copy and structure
 * follow v2/app/account/page.tsx; the session read replaces the
 * server's getCurrentUserRow (the app never renders another user's
 * state into shared HTML).
 */

type Session = { status: "unknown" } | { status: "signed-out" } | { status: "signed-in"; user: AccountPublicUser; alerts: AlertItem[] };

export function AccountPage({ siteKey, deleted: deletedInitial }: { siteKey: string | null; deleted: boolean }) {
  const [session, setSession] = useState<Session>({ status: "unknown" });
  const [deleted, setDeleted] = useState(deletedInitial);

  const load = useCallback(async (): Promise<Session> => {
    const me = await callApi<{ signed_in: boolean; user?: AccountPublicUser }>("/api/v1/account/me", undefined, "GET");
    if (!me.ok || !me.data.signed_in || !me.data.user) {
      return { status: "signed-out" };
    }
    const alerts = await callApi<AlertItem[]>("/api/v1/account/alerts", undefined, "GET");
    return { status: "signed-in", user: me.data.user, alerts: alerts.ok ? alerts.data : [] };
  }, []);

  useEffect(() => {
    let live = true;
    void load().then((next) => {
      if (live) setSession(next);
    });
    return () => {
      live = false;
    };
  }, [load]);

  if (session.status === "signed-in") {
    return (
      <article className="form-page" aria-labelledby="account-title">
        <AccountPanel
          user={session.user}
          alerts={session.alerts}
          onChanged={() => {
            void load().then((next) => setSession(next));
          }}
          onDeleted={() => {
            setDeleted(true);
            setSession({ status: "signed-out" });
          }}
        />
      </article>
    );
  }

  return (
    <article className="form-page" aria-labelledby="account-title">
      {/* Page head (spot-slots §3, §5): text first, then the decorative seed-packet organiser —
          beside it from md up, centred below the intro on phones. Signed-out render only; the
          signed-in panel above carries no painting and reserves no space for one. */}
      <div className="form-head-grid">
        <div>
          <h1 id="account-title" className="page-title">
            Your Seed Directory account
          </h1>
          {deleted ? (
            <p role="status" className="card field-pad form-message">
              Your account and everything in it has been deleted.
            </p>
          ) : null}
          <p className="page-lede">
            An account lets you join waiting lists: we’ll text and email you when a seller lists a variety you’re after. No password — you sign in with your email and phone number.
          </p>
        </div>
        <div>
          <ThemeArt name="account-organizer" priority className="form-head-art" />
        </div>
      </div>
      <div className="account-cols">
        <section aria-labelledby="create-title" className="form-stack">
          <h2 id="create-title" className="section-heading">
            New here? Create an account
          </h2>
          <CreateAccountForm siteKey={siteKey} />
        </section>
        <section aria-labelledby="signin-title" className="form-stack">
          <h2 id="signin-title" className="section-heading">
            Already have one? Sign in
          </h2>
          <SignInForm
            siteKey={siteKey}
            onSignedIn={() => {
              void load().then((next) => setSession(next));
            }}
          />
          <p className="form-note">
            Changed your phone number? Create a fresh account and ask us (see <a href="/about">About</a>) to move your waiting lists across.
          </p>
        </section>
      </div>
    </article>
  );
}
