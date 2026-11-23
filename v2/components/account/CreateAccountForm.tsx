"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Turnstile } from "@/components/ui/Turnstile";
import { FieldSuccessIcon } from "@/components/layout/icons";
import { FieldSummary, focusFailureTarget } from "@/components/ui/field-states";
import { callApi, deliveryNote } from "./api";
import { CREATE_SUMMARY_HEADING, createAccountFailure, type MappedFormFailure } from "./account-errors";
import { CodeEntry } from "./CodeEntry";
import { SignupFields, signupBody } from "./SignupFields";

type Created = { verification: { email: string; phone: string | null }; next: string };

/** Create an account: name, email, phone, ZIP, account type, Turnstile → session → email code step. */
export function CreateAccountForm({ siteKey }: { siteKey: string | null }) {
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<MappedFormFailure>({ fields: [], form: null });
  const [created, setCreated] = useState<Created | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const successHeadingRef = useRef<HTMLParagraphElement | null>(null);

  const entries = failure.fields.map((f) => ({
    fieldId: f.key === "account_type" ? "create-account-type-gardener" : `create-${f.key}`,
    message: f.message,
  }));
  const showSummary = failure.form !== null || entries.length >= 2;

  // Failed submits move focus to the summary (2+ errors, or a form-level message) or the one
  // invalid field — refs only, no state writes in the effect body.
  useEffect(() => {
    if (!showSummary && entries.length === 0) return;
    focusFailureTarget(summaryRef.current, entries, failure.form);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entries/showSummary derive from failure
  }, [failure]);

  // The code step mounts after the creating submit: focus its heading, per the waitlist discipline.
  useEffect(() => {
    if (created) successHeadingRef.current?.focus();
  }, [created]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFailure({ fields: [], form: null });
    const r = await callApi<Created>("/api/v1/account", { ...signupBody(new FormData(e.currentTarget)), ...(token ? { turnstile_token: token } : {}) });
    setBusy(false);
    if (r.ok) {
      setCreated(r.data);
      return;
    }
    setFailure(createAccountFailure(r.status, r.code, r.message));
    setReset((n) => n + 1);
  }

  if (created) {
    const done = () => window.location.assign(created.next);
    return (
      <div className="card flex flex-col gap-3 p-4" data-testid="signup-code-step">
        <p className="flex items-center gap-2 font-semibold">
          <FieldSuccessIcon className="size-5 shrink-0 text-leaf" />
          <span ref={successHeadingRef} tabIndex={-1} data-field-success-heading>
            Your account is ready and you’re signed in.
          </span>
        </p>
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
    <form onSubmit={submit} aria-busy={busy || undefined} className="flex flex-col gap-4" aria-labelledby="create-title">
      {showSummary ? <FieldSummary heading={failure.form ?? CREATE_SUMMARY_HEADING} entries={entries} summaryRef={summaryRef} /> : null}
      <SignupFields
        idPrefix="create"
        variant="cards"
        errors={Object.fromEntries(failure.fields.filter((f) => f.key !== "account_type").map((f) => [f.key, f.message]))}
        accountTypeError={failure.fields.find((f) => f.key === "account_type")?.message}
      />
      <p className="text-sm text-muted">
        We use these to sign you in and to tell you when a variety you’re waiting for is found. See <Link href="/privacy">Privacy</Link>.
      </p>
      <Turnstile siteKey={siteKey} onToken={setToken} resetKey={reset} action="create-account" />
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </div>
    </form>
  );
}
