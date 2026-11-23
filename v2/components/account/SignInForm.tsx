"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Turnstile } from "@/components/ui/Turnstile";
import { FieldErrorLine, FieldSummary, focusFailureTarget, syncFilledClass } from "@/components/ui/field-states";
import { callApi } from "./api";
import { SIGNIN_SUMMARY_HEADING, signInFailure, type MappedFormFailure } from "./account-errors";

/** Sign in with the email + phone pair (no password, no code) + Turnstile. */
export function SignInForm({ siteKey }: { siteKey: string | null }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<MappedFormFailure>({ fields: [], form: null });
  const summaryRef = useRef<HTMLDivElement | null>(null);

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
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
