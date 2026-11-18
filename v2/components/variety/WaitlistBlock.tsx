"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Turnstile } from "@/components/ui/Turnstile";
import { callApi, deliveryNote } from "@/components/account/api";
import { CodeEntry } from "@/components/account/CodeEntry";
import { SignupFields, signupBody } from "@/components/account/SignupFields";

type Status = {
  signed_in: boolean;
  variety: { slug: string; name: string; listed: boolean };
  on_list: boolean;
  user?: { name: string; email_verified: boolean; sms_opt_in: boolean; alert_phone_verified: boolean };
  channels?: ("email" | "sms")[];
  held?: string[];
  turnstile_site_key: string | null;
};

/**
 * The waiting-list panel under "No sellers yet" on zero-seller variety pages (design §4). The
 * page stays ISR-cached; this block asks /api/v1/account/waitlist for the visitor's state.
 *  - signed out → inline mini-form that creates the account AND joins in one submission;
 *  - signed in → one-click join / leave; "You’re on the waiting list" when already waiting;
 *  - email not verified yet → "Check your inbox for a 6-digit code to activate notifications".
 */
export function WaitlistBlock({ varietySlug, varietyName }: { varietySlug: string; varietyName: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [created, setCreated] = useState<{ email: string } | null>(null);

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    void callApi<Status>(`/api/v1/account/waitlist?variety=${encodeURIComponent(varietySlug)}`, undefined, "GET").then((r) => {
      if (live && r.ok) setStatus(r.data);
    });
    return () => {
      live = false;
    };
  }, [varietySlug, version]);

  async function join() {
    setBusy(true);
    setError(null);
    const r = await callApi("/api/v1/account/waitlist/join", { variety: varietySlug });
    setBusy(false);
    if (!r.ok) setError(r.message);
    load();
  }

  async function leave() {
    setBusy(true);
    setError(null);
    const r = await callApi("/api/v1/account/waitlist/leave", { variety: varietySlug });
    setBusy(false);
    if (!r.ok) setError(r.message);
    else setNote(`You’ve left the waiting list for ${varietyName}.`);
    load();
  }

  async function createAndJoin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await callApi<{ verification: { email: string }; waitlist: { error?: string; message?: string } | null }>("/api/v1/account", {
      ...signupBody(new FormData(e.currentTarget)),
      join_variety: varietySlug,
      ...(token ? { turnstile_token: token } : {}),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      setReset((n) => n + 1);
      return;
    }
    if (r.data.waitlist?.error) setError(r.data.waitlist.message ?? "We couldn’t add you to this list.");
    setCreated({ email: r.data.verification.email });
    load();
  }

  if (status?.variety.listed) return null;

  return (
    <section aria-labelledby="waitlist-title" className="card mt-4 flex flex-col gap-3 p-4" data-testid="waitlist-block">
      <h3 id="waitlist-title" className="text-xl font-semibold">
        Join the waiting list — we’ll email you when a farm lists {varietyName}.
      </h3>
      <p className="text-sm text-muted">You can also choose a text alert. One alert when it’s first found; leave the list any time.</p>
      {note ? (
        <p role="status" className="font-medium">
          {note}
        </p>
      ) : null}
      {!status ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : status.signed_in && status.on_list ? (
        <div className="flex flex-col gap-3">
          <p className="font-semibold text-leaf">You’re on the waiting list.</p>
          {status.user && !status.user.email_verified ? (
            <>
              <p>Check your inbox for a 6-digit code to activate notifications.</p>
              <CodeEntry channel="email" idPrefix="waitlist-email" initialNote={created ? deliveryNote(created.email, "email") : null} onVerified={load} />
            </>
          ) : status.held && status.held.length ? (
            <p className="text-sm">Your alerts are held: {status.held.join(" ")}.</p>
          ) : (
            <p className="text-sm text-muted">Alerts on: {(status.channels ?? []).map((c) => (c === "sms" ? "text" : "email")).join(" + ")}.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={leave} disabled={busy}>
              Leave the waiting list
            </button>
            <Link href="/account" className="btn btn-secondary">
              Your alerts
            </Link>
          </div>
        </div>
      ) : status.signed_in ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={join} disabled={busy}>
            Join the waiting list
          </button>
          <Link href="/account">Text alerts and settings</Link>
        </div>
      ) : (
        <form onSubmit={createAndJoin} className="flex flex-col gap-4" aria-label={`Join the waiting list for ${varietyName}`}>
          <p className="text-sm">
            Joining creates a free Seed Directory account. Already have one? <Link href="/account">Sign in</Link>, then come back.
          </p>
          <SignupFields idPrefix="waitlist" smsOptIn />
          <Turnstile siteKey={status.turnstile_site_key} onToken={setToken} resetKey={reset} action="waitlist-join" />
          <div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Joining…" : "Join the waiting list"}
            </button>
          </div>
        </form>
      )}
      {error ? (
        <p role="alert" className="font-medium text-warn">
          {error}
        </p>
      ) : null}
    </section>
  );
}
