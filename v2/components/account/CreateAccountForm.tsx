"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Turnstile } from "@/components/ui/Turnstile";
import { callApi, deliveryNote } from "./api";
import { CodeEntry } from "./CodeEntry";
import { SignupFields, signupBody } from "./SignupFields";

type Created = { verification: { email: string; phone: string | null }; next: string };

/** Create an account: name, email, phone, ZIP, account type, Turnstile → session → email code step. */
export function CreateAccountForm({ siteKey }: { siteKey: string | null }) {
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await callApi<Created>("/api/v1/account", { ...signupBody(new FormData(e.currentTarget)), ...(token ? { turnstile_token: token } : {}) });
    setBusy(false);
    if (r.ok) {
      setCreated(r.data);
      return;
    }
    setError(r.message);
    setReset((n) => n + 1);
  }

  if (created) {
    const done = () => window.location.assign(created.next);
    return (
      <div className="card flex flex-col gap-3 p-4" data-testid="signup-code-step">
        <p className="font-semibold">Your account is ready and you’re signed in.</p>
        <p>Check your inbox for a 6-digit code to switch on your waiting-list alerts.</p>
        <CodeEntry channel="email" idPrefix="signup" initialNote={deliveryNote(created.verification.email, "email")} onVerified={done} />
        <p className="text-sm">
          {created.next === "/add-your-farm" ? (
            <Link href="/add-your-farm">Skip for now — next, add your farm’s details</Link>
          ) : (
            <Link href="/account">Skip for now — go to your account</Link>
          )}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-labelledby="create-title">
      <SignupFields idPrefix="create" />
      <p className="text-sm text-muted">
        We use these to sign you in and to tell you when a variety you’re waiting for is found. See <Link href="/privacy">Privacy</Link>.
      </p>
      <Turnstile siteKey={siteKey} onToken={setToken} resetKey={reset} action="create-account" />
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="font-medium text-warn">
          {error}
        </p>
      ) : null}
    </form>
  );
}
