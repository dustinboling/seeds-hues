"use client";

import { useState, type FormEvent } from "react";
import { callApi } from "@/components/account/api";
import { Turnstile } from "@/components/ui/Turnstile";
import { REPORT_TURNSTILE_PENDING, reportErrorMessage } from "./report-errors";

type Intent = "correct" | "claim" | "remove";

const INTENTS: { value: Intent; label: string; hint: string }[] = [
  { value: "correct", label: "Correct something", hint: "A wrong fact, a dead link, a missing seller or variety." },
  { value: "claim", label: "Claim my seller page", hint: "You run this farm or company and want to manage its listing." },
  { value: "remove", label: "Remove my listing", hint: "We take the page and all listings down within 48 hours and stop checking your site." },
];

/**
 * One form, three intents (R8). Posts JSON to /api/v1/reports through the shared account-form
 * API helper. The human check is the shared explicit-render <Turnstile> widget (same pattern as
 * the account, waiting-list and Add Your Farm forms): its token arrives through onToken, is sent
 * as turnstile_token, and the widget is reset after every attempt because tokens are single-use.
 * When a site key is configured, the form refuses to send until a token exists and says why;
 * server-side verification (lib/services/reports.ts) is unchanged. API failures are shown as
 * plain copy (./report-errors), never as raw validator detail.
 */
export function ReportForm(props: { type: Intent; targetType: "variety" | "seller"; targetRef: string; siteKey: string | null }) {
  const [type, setType] = useState<Intent>(props.type);
  const [targetType, setTargetType] = useState(props.targetType);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; message: string }>({ status: "idle", message: "" });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (props.siteKey && !token) {
      setState({ status: "error", message: REPORT_TURNSTILE_PENDING });
      return;
    }
    const form = new FormData(e.currentTarget);
    setState({ status: "sending", message: "" });
    const r = await callApi("/api/v1/reports", {
      type,
      target_type: targetType,
      target_ref: String(form.get("target_ref") ?? "").trim().toLowerCase(),
      message: String(form.get("message") ?? ""),
      contact: String(form.get("contact") ?? "").trim(),
      ...(token ? { turnstile_token: token } : {}),
    });
    if (r.ok) {
      setState({ status: "done", message: "Thank you — your request is in our review queue. We reply by email." });
      return;
    }
    setState({ status: "error", message: reportErrorMessage(r.status, r.code, r.message) });
    setReset((n) => n + 1);
  }

  if (state.status === "done") {
    return (
      <p role="status" className="card mt-6 p-4 font-medium">
        {state.message}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 flex max-w-2xl flex-col gap-5" noValidate={false}>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-sans text-sm font-semibold">What would you like to do?</legend>
        {INTENTS.map((i) => (
          <label key={i.value} className="card flex cursor-pointer items-start gap-3 p-3">
            <input type="radio" name="type" value={i.value} checked={type === i.value} onChange={() => setType(i.value)} className="mt-1" />
            <span>
              <span className="block font-medium">{i.label}</span>
              <span className="block text-sm text-muted">{i.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold" htmlFor="target_type">
          About
        </label>
        <select id="target_type" value={targetType} onChange={(e) => setTargetType(e.target.value as "variety" | "seller")} className="tap rounded-field border border-line-strong bg-surface px-3">
          <option value="seller">A seller</option>
          <option value="variety">A variety</option>
        </select>
        <label className="text-sm text-muted" htmlFor="target_ref">
          Page address name (the last part of the URL, e.g. songbird-seed-co)
        </label>
        <input id="target_ref" name="target_ref" required defaultValue={props.targetRef} pattern="[a-z0-9]+(-[a-z0-9]+)*" className="tap rounded-field border border-line-strong bg-surface px-3" />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold" htmlFor="message">
          Details
        </label>
        <textarea id="message" name="message" required minLength={5} maxLength={4000} rows={5} className="rounded-field border border-line-strong bg-surface p-3" />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold" htmlFor="contact">
          Your email (so we can reply and, for claims and removals, confirm you run the seller)
        </label>
        <input id="contact" name="contact" type="email" required maxLength={320} className="tap rounded-field border border-line-strong bg-surface px-3" />
      </div>
      <Turnstile siteKey={props.siteKey} onToken={setToken} resetKey={reset} action="report" />
      <div>
        <button type="submit" className="btn btn-primary" disabled={state.status === "sending"}>
          {state.status === "sending" ? "Sending…" : "Send request"}
        </button>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="font-medium text-warn">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
