import { useState } from "react";
import { callAdmin } from "./api";

/**
 * Admin sign-in steps 1–2 (spec §7 A1–A2) — ported from v2's sign-in
 * pages. Native POST forms enhanced with fetch: success follows the
 * handler's redirect, failure renders the message with the typed values
 * preserved. Only the submit button ever busies.
 */
export function AdminEmailForm({ next, initialEmail, onSent }: { next: string; initialEmail?: string; onSent: (email: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      method="post"
      action="/admin/sign-in/request"
      aria-busy={busy || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const email = String(data.get("email") ?? "");
        setBusy(true);
        setError(null);
        void callAdmin("/admin/sign-in/request", { email, next }).then((r) => {
          setBusy(false);
          if (r.ok) onSent(email);
          else setError(r.message);
        });
      }}
    >
      <fieldset className="admin-fieldset">
        <input type="hidden" name="next" value={next} />
        {error ? (
          <p role="alert" className="admin-alert">
            {error}
          </p>
        ) : null}
        <label htmlFor="admin-email" className="admin-label">
          Email
        </label>
        <input id="admin-email" name="email" type="email" required autoComplete="email" defaultValue={initialEmail ?? ""} className="field" />
        <div>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export function AdminCodeForm({ email, next, ttlMinutes, onVerified }: { email: string; next: string; ttlMinutes: number; onVerified: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  return (
    <div className="admin-stack">
      <p className="admin-prose">
        We sent a 6-digit code to <strong>{email}</strong>. It works for {ttlMinutes} minutes.
      </p>
      {resent ? (
        <p role="status" className="admin-note-line">
          We sent a new code to {email}.
        </p>
      ) : null}
      <form
        method="post"
        action="/admin/sign-in/verify"
        aria-busy={busy || undefined}
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const code = String(new FormData(form).get("code") ?? "");
          setBusy(true);
          setError(null);
          void callAdmin("/admin/sign-in/verify", { email, code, next }).then((r) => {
            setBusy(false);
            if (r.ok) onVerified();
            else setError(r.message);
          });
        }}
      >
        <fieldset className="admin-fieldset">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          {error ? (
            <p role="alert" className="admin-alert">
              {error}
            </p>
          ) : null}
          <label htmlFor="admin-code" className="admin-label">
            6-digit code
          </label>
          <input id="admin-code" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="field admin-code-field" />
          <div>
            <button type="submit" disabled={busy} className="btn btn-primary">
              {busy ? "Verifying…" : "Verify"}
            </button>
          </div>
        </fieldset>
      </form>
      <form
        method="post"
        action="/admin/sign-in/request"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          void callAdmin("/admin/sign-in/request", { email, next }).then((r) => {
            if (r.ok) setResent(true);
            else setError(r.message);
          });
        }}
      >
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="resend" value="1" />
        <div>
          <button type="submit" className="btn btn-secondary">
            Send a new code
          </button>
        </div>
      </form>
    </div>
  );
}
