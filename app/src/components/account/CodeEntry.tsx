import { useEffect, useRef, useState, type FormEvent } from "react";
import { CODE_TTL_MINUTES } from "../../lib/accounts";
import { callApi, deliveryNote } from "./api";
import { codeFailure } from "./account-errors";
import { FieldErrorLine, FieldSummary, focusFailureTarget, syncFilledClass } from "../ui/field-states";

/**
 * Enter a one-time 6-digit code (email or alert number) + "Send a new
 * code", ported from v2/components/account/CodeEntry.tsx. Sessioned uses
 * prove an address/number; the Tranche 3.2 unauthenticated uses (the
 * waitlist's recognized-contact path and the /account phone-less
 * sign-in, Dustin's P2 + §11.1 rulings) establish the session at verify
 * time — the one bounded amendment to the old "codes never sign in"
 * rule. Same component, same field treatment, in every context: no
 * forks.
 *
 * Field-state set member (Tranche 3.3, FIELD-STATES-DESIGN.md §8.5):
 * W-2 association (aria-invalid + hint-first-error-second describedby,
 * Ada Ruling 5), the lifetime hint in every context, spaced-paste
 * acceptance (no length cap or pattern truncates before the strip), and
 * mapped copy (COPY-3-3 §3.3) keyed by error code.
 */
export function CodeEntry(props: {
  channel: "email" | "phone";
  idPrefix: string;
  initialNote?: string | null;
  onVerified: () => void;
  compact?: boolean;
  /**
   * Unauthenticated mode (Tranche 3.2): verify and resend post the email
   * alongside the code to the given sessionless paths instead of the
   * sessioned ones. Everything else — dress, association, lifetime
   * line, paste behavior, mapped copy — is identical.
   */
  unauth?: { email: string; verifyPath: string; resendPath: string; resendExtra?: Record<string, unknown> };
  /** Called after every resend attempt settles (the /account code state refreshes its human-check token from this). */
  notifyResend?: () => void;
}) {
  const [state, setState] = useState<{ busy: "verify" | "resend" | null; fieldError: string | null; formError: string | null; note: string | null }>({
    busy: null,
    fieldError: null,
    formError: null,
    note: props.initialNote ?? null,
  });
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const base = props.channel === "email" ? "/api/v1/account/email" : "/api/v1/account/alert-phone";
  const id = `${props.idPrefix}-code`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // Failed attempts move focus to the summary (form-level) or the code field — refs only.
  useEffect(() => {
    if (state.fieldError === null && state.formError === null) return;
    focusFailureTarget(
      summaryRef.current,
      state.fieldError === null ? [] : [{ fieldId: id, message: state.fieldError }],
      state.formError,
    );
  }, [state.fieldError, state.formError, id]);

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setState((s) => ({ ...s, busy: "verify", fieldError: null, formError: null }));
    const r = await callApi(props.unauth?.verifyPath ?? `${base}/verify`, props.unauth ? { email: props.unauth.email, code } : { code });
    if (r.ok) {
      setState({ busy: null, fieldError: null, formError: null, note: null });
      props.onVerified();
      return;
    }
    const mapped = codeFailure(r.status, r.code, r.message);
    setState((s) => ({ ...s, busy: null, fieldError: mapped.fields[0]?.message ?? null, formError: mapped.form }));
  }

  async function resend() {
    setState((s) => ({ ...s, busy: "resend", fieldError: null, formError: null }));
    const r = await callApi<{ delivery: string | null }>(props.unauth?.resendPath ?? `${base}/resend`, props.unauth ? { email: props.unauth.email, ...props.unauth.resendExtra } : {});
    props.notifyResend?.();
    if (r.ok) setState({ busy: null, fieldError: null, formError: null, note: deliveryNote(r.data.delivery, props.channel) ?? "Already verified." });
    else {
      const mapped = codeFailure(r.status, r.code, r.message);
      setState((s) => ({ ...s, busy: null, fieldError: mapped.fields[0]?.message ?? null, formError: mapped.form }));
    }
  }

  return (
    <form onSubmit={verify} aria-busy={state.busy !== null || undefined} className="form-stack-tight" aria-label={props.channel === "email" ? "Verify your email" : "Verify your alert number"}>
      {state.formError ? <FieldSummary heading={state.formError} entries={[]} summaryRef={summaryRef} /> : null}
      {state.note ? (
        <p role="status" className="form-note">
          {state.note}
        </p>
      ) : null}
      <div className="form-field">
        <label htmlFor={id} className="form-label">
          {props.channel === "email" ? "6-digit code from your email" : "6-digit code from the text"}
        </label>
        <div className="form-row">
          <input
            id={id}
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-invalid={state.fieldError ? true : undefined}
            aria-describedby={state.fieldError ? `${hintId} ${errorId}` : hintId}
            onBlur={syncFilledClass}
            onChange={syncFilledClass}
            className="field field-code"
          />
          <button type="submit" className="btn btn-primary" disabled={state.busy !== null}>
            {state.busy === "verify" ? "Verifying…" : "Verify"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={resend} disabled={state.busy !== null}>
            Send a new code
          </button>
        </div>
        <span id={hintId} className="field-hint">
          It works for {CODE_TTL_MINUTES} minutes.
        </span>
        {state.fieldError ? <FieldErrorLine id={errorId} message={state.fieldError} /> : null}
      </div>
    </form>
  );
}
