"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Turnstile } from "@/components/ui/Turnstile";
import { callApi } from "./api";

/** Sign in with the email + phone pair (no password, no code) + Turnstile. */
export function SignInForm({ siteKey }: { siteKey: string | null }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
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
    setError(r.message);
    setReset((n) => n + 1);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-labelledby="signin-title">
      <div className="flex flex-col gap-1">
        <label htmlFor="signin-email" className="text-sm font-semibold">
          Email
        </label>
        <input id="signin-email" name="email" type="email" required maxLength={320} autoComplete="email" className="field" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="signin-phone" className="text-sm font-semibold">
          Phone number
        </label>
        <input id="signin-phone" name="phone" type="tel" required maxLength={32} autoComplete="tel-national" inputMode="tel" className="field" />
      </div>
      <Turnstile siteKey={siteKey} onToken={setToken} resetKey={reset} action="sign-in" />
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
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
