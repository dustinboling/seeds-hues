"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Turnstile } from "@/components/ui/Turnstile";
import { FieldErrorLine, FieldSummary, focusFailureTarget, syncFilledClass } from "@/components/ui/field-states";
import { callApi, deliveryNote } from "./api";
import { SIGNIN_SUMMARY_HEADING, signInCodeFailure, signInFailure, type MappedFormFailure } from "./account-errors";
import { CodeEntry } from "./CodeEntry";

/**
 * Sign in with the email + phone pair (no password) + Turnstile — plus, for accounts with no
 * phone on file, the §11.1 accommodation (ruled (a)): "Email me a code instead" completes
 * sign-in by the emailed code the product already trusts, so a flip-created account is never
 * a dead end at /account.
 */
export function SignInForm({ siteKey }: { siteKey: string | null }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<MappedFormFailure>({ fields: [], form: null });
  const [codeState, setCodeState] = useState<{ email: string; delivery: string | null } | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const codeHeadingRef = useRef<HTMLHeadingElement>(null);

  const fieldMessage = (key: string) => failure.fields.find((f) => f.key === key)?.message ?? null;
  const emailError = fieldMessage("email");
  const phoneError = fieldMessage("phone");
  const entries = failure.fields.map((f) => ({ fieldId: `signin-${f.key}`, message: f.message }));
  const showSummary = failure.form !== null || entries.length >= 2;

  // Failed submits move focus to the summary (2 errors, or the pair-neutral form message) or the
  // one invalid field — refs only, no state writes in the effect body.
  useEffect(() => {
    if (!showSummary && entries.length === 0) return;
    focusFailureTarget(summaryRef.current, entries, failure.form);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entries/showSummary derive from failure
  }, [failure]);

  // The code state mounts after this session's issue submit: focus its heading.
  useEffect(() => {
    if (codeState) codeHeadingRef.current?.focus();
  }, [codeState]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setFailure({ fields: [], form: null });
    const r = await callApi("/api/v1/account/sign-in", {
      email: String(f.get("email") ?? "").trim(),
      phone: String(f.get("phone") ?? ""),
      ...(token ? { turnstile_token: token } : {}),
    });
    setBusy(false);
    if (r.ok) {
      router.push("/account");
      router.refresh();
      return;
    }
    setFailure(signInFailure(r.status, r.code, r.message));
    setReset((n) => n + 1);
  }

  /**
   * "Email me a code instead": a plain button, not a submit — the phone field stays empty for
   * exactly the accounts this path serves, so native submit validation must never run here.
   * The email is validated strictly server-side; the client checks only presence.
   */
  async function requestCode() {
    const email = (document.getElementById("signin-email") as HTMLInputElement | null)?.value.trim() ?? "";
    if (email === "") {
      setFailure({ fields: [{ key: "email", message: "Enter a valid email address." }], form: null });
      return;
    }
    setBusy(true);
    setFailure({ fields: [], form: null });
    const r = await callApi<{ delivery: string | null }>("/api/v1/account/sign-in/code", { email, ...(token ? { turnstile_token: token } : {}) });
    setBusy(false);
    // The token is single-use: refresh it for the resends the code state may need.
    setReset((n) => n + 1);
    if (!r.ok) {
      setFailure(signInCodeFailure(r.status, r.code, r.message));
      return;
    }
    setCodeState({ email, delivery: r.data.delivery });
  }

  function signedIn() {
    router.push("/account");
    router.refresh();
  }

  if (codeState) {
    return (
      <div className="flex flex-col gap-4">
        <h3 ref={codeHeadingRef} tabIndex={-1} className="text-xl font-semibold">
          Check your email for a code
        </h3>
        <p className="text-sm">We emailed a 6-digit code to {codeState.email}. Enter it below to sign in.</p>
        <CodeEntry
          channel="email"
          idPrefix="signin-code"
          initialNote={deliveryNote(codeState.delivery, "email")}
          onVerified={signedIn}
          unauth={{
            email: codeState.email,
            verifyPath: "/api/v1/account/sign-in/verify",
            resendPath: "/api/v1/account/sign-in/code",
            ...(token ? { resendExtra: { turnstile_token: token } } : {}),
          }}
          notifyResend={() => setReset((n) => n + 1)}
        />
        <Turnstile siteKey={siteKey} onToken={setToken} resetKey={reset} action="sign-in" />
        <p className="text-sm">
          <button
            type="button"
            className="underline"
            onClick={() => {
              setCodeState(null);
              setFailure({ fields: [], form: null });
            }}
          >
            Back to email and phone sign in
          </button>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} aria-busy={busy || undefined} className="flex flex-col gap-4" aria-labelledby="signin-title">
      {showSummary ? <FieldSummary heading={failure.form ?? SIGNIN_SUMMARY_HEADING} entries={entries} summaryRef={summaryRef} /> : null}
      <div className="flex flex-col gap-1">
        <label htmlFor="signin-email" className="text-sm font-semibold">
          Email
        </label>
        <input
          id="signin-email"
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "signin-email-error" : undefined}
          onBlur={syncFilledClass}
          onChange={syncFilledClass}
          className="field"
        />
        {emailError ? <FieldErrorLine id="signin-email-error" message={emailError} /> : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="signin-phone" className="text-sm font-semibold">
          Phone number
        </label>
        <input
          id="signin-phone"
          name="phone"
          type="tel"
          required
          maxLength={32}
          autoComplete="tel-national"
          inputMode="tel"
          aria-invalid={phoneError ? true : undefined}
          aria-describedby={phoneError ? "signin-phone-error" : undefined}
          onBlur={syncFilledClass}
          onChange={syncFilledClass}
          className="field"
        />
        {phoneError ? <FieldErrorLine id="signin-phone-error" message={phoneError} /> : null}
      </div>
      <Turnstile siteKey={siteKey} onToken={setToken} resetKey={reset} action="sign-in" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <button type="button" className="underline" disabled={busy} onClick={requestCode}>
          Email me a code instead
        </button>
      </div>
      <p className="text-sm text-muted">No phone number on your account? Emailing a code signs you in without one.</p>
    </form>
  );
}
