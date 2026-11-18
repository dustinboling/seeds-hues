"use client";

import { useState, type FormEvent } from "react";

type Intent = "correct" | "claim" | "remove";

const INTENTS: { value: Intent; label: string; hint: string }[] = [
  { value: "correct", label: "Correct something", hint: "A wrong fact, a dead link, a missing farm or variety." },
  { value: "claim", label: "Claim my farm’s page", hint: "You run this farm and want to manage its listing." },
  { value: "remove", label: "Remove my farm", hint: "We take the page and all listings down within 48 hours and stop checking your site." },
];

/**
 * One form, three intents (R8). Posts JSON to /api/v1/reports. Turnstile renders only when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set at build time (the server verifies only when its secret
 * is configured).
 */
export function ReportForm(props: { type: Intent; targetType: "variety" | "seller"; targetRef: string; siteKey: string | null }) {
  const [type, setType] = useState<Intent>(props.type);
  const [targetType, setTargetType] = useState(props.targetType);
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; message: string }>({ status: "idle", message: "" });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState({ status: "sending", message: "" });
    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          target_type: targetType,
          target_ref: String(form.get("target_ref") ?? "").trim().toLowerCase(),
          message: String(form.get("message") ?? ""),
          contact: String(form.get("contact") ?? "").trim(),
          ...(form.get("cf-turnstile-response") ? { turnstile_token: String(form.get("cf-turnstile-response")) } : {}),
        }),
      });
      if (res.ok) {
        setState({ status: "done", message: "Thank you — your request is in our review queue. We reply by email." });
        return;
      }
      const p = (await res.json().catch(() => ({}))) as { detail?: string };
      setState({ status: "error", message: p.detail ?? `Something went wrong (${res.status}).` });
    } catch {
      setState({ status: "error", message: "Could not send. Check your connection and try again." });
    }
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
        <select id="target_type" value={targetType} onChange={(e) => setTargetType(e.target.value as "variety" | "seller")} className="tap rounded-[10px] border border-line-strong bg-surface px-3">
          <option value="seller">A farm (seller)</option>
          <option value="variety">A variety</option>
        </select>
        <label className="text-sm text-muted" htmlFor="target_ref">
          Page address name (the last part of the URL, e.g. songbird-seed-co)
        </label>
        <input id="target_ref" name="target_ref" required defaultValue={props.targetRef} pattern="[a-z0-9]+(-[a-z0-9]+)*" className="tap rounded-[10px] border border-line-strong bg-surface px-3" />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold" htmlFor="message">
          Details
        </label>
        <textarea id="message" name="message" required minLength={5} maxLength={4000} rows={5} className="rounded-[10px] border border-line-strong bg-surface p-3" />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold" htmlFor="contact">
          Your email (so we can reply and, for claims and removals, confirm you run the farm)
        </label>
        <input id="contact" name="contact" type="email" required maxLength={320} className="tap rounded-[10px] border border-line-strong bg-surface px-3" />
      </div>
      {props.siteKey ? (
        <>
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={props.siteKey} />
        </>
      ) : null}
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
