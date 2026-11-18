"use client";

import { useState, type FormEvent } from "react";
import { callApi, deliveryNote } from "./api";

/**
 * Enter a one-time 6-digit code (email or alert number) + "Send a new code". These codes only
 * prove an address/number — they are never used to sign in.
 */
export function CodeEntry(props: { channel: "email" | "phone"; idPrefix: string; initialNote?: string | null; onVerified: () => void; compact?: boolean }) {
  const [state, setState] = useState<{ busy: boolean; error: string | null; note: string | null }>({ busy: false, error: null, note: props.initialNote ?? null });
  const base = props.channel === "email" ? "/api/v1/account/email" : "/api/v1/account/alert-phone";
  const id = `${props.idPrefix}-code`;

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setState((s) => ({ ...s, busy: true, error: null }));
    const r = await callApi(`${base}/verify`, { code });
    if (r.ok) {
      setState({ busy: false, error: null, note: null });
      props.onVerified();
      return;
    }
    setState((s) => ({ ...s, busy: false, error: r.message }));
  }

  async function resend() {
    setState((s) => ({ ...s, busy: true, error: null }));
    const r = await callApi<{ delivery: string | null }>(`${base}/resend`, {});
    if (r.ok) setState({ busy: false, error: null, note: deliveryNote(r.data.delivery, props.channel) ?? "Already verified." });
    else setState((s) => ({ ...s, busy: false, error: r.message }));
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-2" aria-label={props.channel === "email" ? "Verify your email" : "Verify your alert number"}>
      {state.note ? (
        <p role="status" className="text-sm">
          {state.note}
        </p>
      ) : null}
      <label htmlFor={id} className="text-sm font-semibold">
        {props.channel === "email" ? "6-digit code from your email" : "6-digit code from the text"}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input id={id} name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="field max-w-[9rem] font-mono tracking-[0.2em]" />
        <button type="submit" className="btn btn-primary" disabled={state.busy}>
          Verify
        </button>
        <button type="button" className="btn btn-secondary" onClick={resend} disabled={state.busy}>
          Send a new code
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-warn">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
