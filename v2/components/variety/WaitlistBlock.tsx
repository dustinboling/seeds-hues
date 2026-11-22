"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Turnstile } from "@/components/ui/Turnstile";
import { callApi, deliveryNote } from "@/components/account/api";
import { CodeEntry } from "@/components/account/CodeEntry";
import { SignupFields, signupBody } from "@/components/account/SignupFields";

type Channel = "email" | "sms";

type Status = {
  signed_in: boolean;
  variety: { slug: string; name: string; listed: boolean };
  on_list: boolean;
  user?: { name: string; email_verified: boolean; sms_opt_in: boolean; alert_phone_verified: boolean };
  channels?: Channel[];
  held?: string[];
  turnstile_site_key: string | null;
};

/** Alert channels in reader words: "email", "text", or "email and text" — never "sms", never "+". */
function channelsText(channels: readonly Channel[] | undefined): string {
  return (channels ?? []).map((c) => (c === "sms" ? "text" : "email")).join(" and ");
}

/** The API's held reasons run together, with the sentence's closing period added only if it is missing. */
function heldSentence(held: readonly string[]): string {
  const text = held.join(" ");
  return text.endsWith(".") ? text : `${text}.`;
}

/**
 * The waiting-list panel under "No sellers yet" on zero-seller variety pages (design §4). The
 * page stays ISR-cached; this block asks /api/v1/account/waitlist for the visitor's state.
 *  - signed out → inline mini-form that creates the account AND joins in one submission;
 *  - signed in, not on the list → one-click join;
 *  - on the list → the success moment (UX spec 2026-11-19 §3): a celebration on the paper ground
 *    (heading + per-state line), then a card with the next step and the leave / alerts
 *    actions. States, in precedence order: B/C unverified email (code entry; B carries this
 *    session's delivery status), D verified but alerts held, A verified and alerts on.
 * Focus moves to the success heading (or back to the join heading after leaving) only after a
 * user action in this session — never on page load.
 */
export function WaitlistBlock({ varietySlug, varietyName }: { varietySlug: string; varietyName: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  /** The email code's DeliveryStatus from this session's account creation (not an address). */
  const [createdDelivery, setCreatedDelivery] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((n) => n + 1), []);

  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const joinHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocusRef = useRef<"success" | "join" | null>(null);

  useEffect(() => {
    let live = true;
    void callApi<Status>(`/api/v1/account/waitlist?variety=${encodeURIComponent(varietySlug)}`, undefined, "GET").then((r) => {
      if (live && r.ok) setStatus(r.data);
    });
    return () => {
      live = false;
    };
  }, [varietySlug, version]);

  // Focus rescue after an in-session transition: the control that held focus has unmounted.
  useEffect(() => {
    if (!status) return;
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = null;
    if (pending === "success" && status.on_list) successHeadingRef.current?.focus();
    if (pending === "join" && status.signed_in && !status.on_list) joinHeadingRef.current?.focus();
  }, [status]);

  async function join() {
    setBusy(true);
    setError(null);
    const r = await callApi("/api/v1/account/waitlist/join", { variety: varietySlug });
    setBusy(false);
    if (!r.ok) setError(r.message);
    else pendingFocusRef.current = "success";
    load();
  }

  async function leave() {
    setBusy(true);
    setError(null);
    const r = await callApi("/api/v1/account/waitlist/leave", { variety: varietySlug });
    setBusy(false);
    if (!r.ok) setError(r.message);
    else {
      setNote(`You’ve left the waiting list for ${varietyName}.`);
      pendingFocusRef.current = "join";
    }
    load();
  }

  async function createAndJoin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await callApi<{ verification: { email: string; phone: string | null }; waitlist: { error?: string; message?: string } | null }>(
      "/api/v1/account",
      {
        ...signupBody(new FormData(e.currentTarget)),
        join_variety: varietySlug,
        ...(token ? { turnstile_token: token } : {}),
      },
    );
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      setReset((n) => n + 1);
      return;
    }
    if (r.data.waitlist?.error) setError(r.data.waitlist.message ?? "We couldn’t add you to this list.");
    setCreatedDelivery(r.data.verification.email);
    pendingFocusRef.current = "success";
    load();
  }

  function handleVerified() {
    pendingFocusRef.current = "success";
    load();
  }

  if (status?.variety.listed) return null;

  const noteBlock = note ? (
    <p role="status" className="font-medium">
      {note}
    </p>
  ) : null;
  const errorBlock = error ? (
    <p role="alert" className="font-medium text-warn">
      {error}
    </p>
  ) : null;

  if (status && status.signed_in && status.on_list) {
    const unverified = status.user?.email_verified === false;
    const held = status.held ?? [];
    const channels = channelsText(status.channels);

    let celebration: ReactNode;
    let nextTitle: string;
    let nextBody: ReactNode = null;

    if (unverified) {
      // States B (createdDelivery set this session) and C (returning, nothing sent this session).
      celebration = (
        <p className="mt-3 max-w-xl">
          Your place is saved now, and once your email is confirmed we’ll send one alert when a seller first lists {varietyName} — until
          then, alerts are held.
        </p>
      );
      nextTitle = "One last step so your alerts can reach you";
      nextBody = (
        <>
          {createdDelivery === "sent" ? (
            <p className="text-sm">
              Enter the 6-digit code from that email in the box below — that’s how we know this address is yours, and your alerts can
              reach you.
            </p>
          ) : createdDelivery === "mail_not_configured" ? (
            <p className="text-sm">
              We can’t email your code just yet, so there’s nothing to check in your inbox. Your place on the list is safe — ask for a new
              code from this page or your account later, once email sending is switched on.
            </p>
          ) : null}
          <CodeEntry
            channel="email"
            idPrefix="waitlist-email"
            initialNote={createdDelivery !== null ? deliveryNote(createdDelivery, "email") : null}
            onVerified={handleVerified}
          />
        </>
      );
    } else if (held.length > 0) {
      // State D: verified, alerts held for another reason — the API's strings, verbatim.
      celebration = <p className="mt-3 max-w-xl">Your place is saved, and your alerts are waiting for now: {heldSentence(held)}</p>;
      nextTitle = "Why your alerts are held";
    } else {
      // State A: verified, alerts genuinely on.
      celebration = (
        <>
          <p className="mt-3 max-w-xl">
            When a seller first lists {varietyName}, we’ll send you one alert by {channels} — and that’s all.
          </p>
          <p className="text-sm text-muted">Alerts on: {channels}.</p>
        </>
      );
      nextTitle = "Your waiting list";
    }

    return (
      <div className="mt-4" data-testid="waitlist-block">
        {/* Celebration — on the PAPER ground: no .card, no border, no background. */}
        <section aria-labelledby="waitlist-success-title" className="mt-10 flex flex-col items-center text-center">
          <h3 id="waitlist-success-title" ref={successHeadingRef} tabIndex={-1} className="text-2xl font-semibold text-leaf">
            You’re on the waiting list for {varietyName} — glad to have you here.
          </h3>
          {celebration}
        </section>
        <section aria-labelledby="waitlist-next-title" className="card mt-8 flex flex-col gap-3 p-4">
          <h4 id="waitlist-next-title" className="text-base font-semibold">
            {nextTitle}
          </h4>
          {nextBody}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={leave} disabled={busy}>
              Leave the waiting list
            </button>
            <Link href="/account" className="btn btn-secondary">
              Your alerts
            </Link>
          </div>
        </section>
        {noteBlock}
        {errorBlock}
      </div>
    );
  }

  return (
    <section aria-labelledby="waitlist-title" className="card mt-4 flex flex-col gap-3 p-4" data-testid="waitlist-block">
      <h3 id="waitlist-title" ref={joinHeadingRef} tabIndex={-1} className="text-xl font-semibold">
        Join the waiting list — we’ll let you know when a seller lists {varietyName}.
      </h3>
      <p className="text-sm text-muted">You can also choose a text alert. One alert when it’s first found; leave the list any time.</p>
      {noteBlock}
      {!status ? (
        <div>
          <p className="sr-only" role="status">
            Loading waiting-list status…
          </p>
          <div aria-hidden="true" className="skeleton-delayed flex flex-col gap-3">
            <div className="skeleton h-11 w-52 max-w-full rounded-xl" />
            <div className="skeleton h-4 w-64 max-w-full" />
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
      {errorBlock}
    </section>
  );
}
