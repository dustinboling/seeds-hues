import { useEffect, useRef, useState, type FormEvent } from "react";
import { callApi } from "../account/api";
import type { MappedFormFailure } from "../account/account-errors";
import { FieldSuccessIcon } from "../icons";
import { FieldErrorLine, FieldSummary, focusFailureTarget, syncFilledClass } from "../ui/field-states";
import { Turnstile } from "../ui/Turnstile";
import { reportJsonFromForm, type ReportFloorOutcome } from "../../server/form-posts";
import { REPORT_SUMMARY_HEADING, REPORT_TURNSTILE_PENDING, reportFailure } from "./report-errors";

type Intent = "correct" | "claim" | "remove";

const INTENTS: { value: Intent; label: string; hint: string }[] = [
  { value: "correct", label: "Correct something", hint: "A wrong fact, a dead link, a missing seller or variety." },
  { value: "claim", label: "Claim my seller page", hint: "You run this farm or company and want to manage its listing." },
  { value: "remove", label: "Remove my listing", hint: "We take the page and all listings down within 48 hours and stop checking your site." },
];

/** DOM id for a mapped field key: the intent group focuses its first radio, every other key is its own id. */
const fieldDomId = (key: string) => (key === "type" ? "report-intent-correct" : key);

const coerceIntent = (v: string): Intent => (v === "claim" || v === "remove" ? v : "correct");

/**
 * One form, three intents (R8), ported from
 * v2/components/report/ReportForm.tsx. The SSR floor (a real form
 * posting form-encoded to the page itself) and the client enhancement
 * (in-place submit, pending state, error surface) share one field
 * mapping (server/form-posts), so both paths carry identical payloads.
 * A floor outcome from the POST render seeds the initial state
 * (success, or errors with the typed values preserved); later client
 * submits replace it. One structural delta from v2: the About select
 * carries name="target_type" (v2's has none — the enhanced submit reads
 * state — but the native floor POST needs the name).
 *
 * Posts JSON to /api/v1/reports through the shared account-form API
 * helper. The human check is the shared explicit-render <Turnstile>
 * widget: its token arrives through onToken, is sent as
 * turnstile_token, and the widget is reset after every attempt because
 * tokens are single-use. When a site key is configured, the form
 * refuses to send until a token exists and says why; server-side
 * verification is unchanged. API failures are shown as plain copy
 * (./report-errors), never as raw validator detail.
 */
export function ReportForm(props: { type: Intent; targetType: "variety" | "seller"; targetRef: string; siteKey: string | null; outcome?: ReportFloorOutcome | null }) {
  const floor = props.outcome ?? null;
  const floorValues = floor?.kind === "failure" ? floor.values : null;
  const [type, setType] = useState<Intent>(floorValues ? coerceIntent(floorValues.type) : props.type);
  const [targetType, setTargetType] = useState<"variety" | "seller">(floorValues ? floorValues.targetType : props.targetType);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<MappedFormFailure>(floorValues ? floor.values.failure : { fields: [], form: null });
  const [done, setDone] = useState<{ targetType: "variety" | "seller"; targetRef: string } | null>(
    floor?.kind === "success" ? { targetType: floor.targetType, targetRef: floor.targetRef } : null,
  );
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const successHeadingRef = useRef<HTMLSpanElement | null>(null);

  const fieldMessage = (key: string) => failure.fields.find((f) => f.key === key)?.message ?? null;
  const entries = failure.fields.map((f) => ({ fieldId: fieldDomId(f.key), message: f.message }));
  const showSummary = failure.form !== null || entries.length >= 2;

  // Failed submits move focus to the summary (2+ errors, or a form-level message) or the one
  // invalid field — refs only, no state writes in the effect body.
  useEffect(() => {
    if (!showSummary && entries.length === 0) return;
    focusFailureTarget(summaryRef.current, entries, failure.form);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entries/showSummary derive from failure
  }, [failure]);

  // Success replaces the form in place: focus its heading, per the waitlist discipline.
  useEffect(() => {
    if (done) successHeadingRef.current?.focus();
  }, [done]);

  const invalid = (key: string, hintId?: string) => {
    const message = fieldMessage(key);
    return {
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? (hintId ? `${hintId} ${key}-error` : `${key}-error`) : hintId,
    } as const;
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (props.siteKey && !token) {
      setFailure({ fields: [], form: REPORT_TURNSTILE_PENDING });
      return;
    }
    const form = new FormData(e.currentTarget);
    const fields: Record<string, string> = {
      type,
      target_type: targetType,
      target_ref: String(form.get("target_ref") ?? ""),
      message: String(form.get("message") ?? ""),
      contact: String(form.get("contact") ?? ""),
    };
    if (token) fields.turnstile_token = token;
    setSending(true);
    setFailure({ fields: [], form: null });
    const payload = reportJsonFromForm(fields);
    const r = await callApi("/api/v1/reports", payload);
    setSending(false);
    if (r.ok) {
      setDone({ targetType, targetRef: String(payload.target_ref ?? "") });
      return;
    }
    setFailure(reportFailure(r.status, r.code, r.message));
    setReset((n) => n + 1);
  }

  if (done) {
    return (
      <div role="status" className="card field-success">
        <p className="form-success-title">
          <FieldSuccessIcon className="field-success-icon" />
          <span ref={successHeadingRef} tabIndex={-1} data-field-success-heading>
            Thank you — your request is in our review queue. We reply by email.
          </span>
        </p>
        <p>
          <a href={done.targetType === "variety" ? `/variety/${done.targetRef}` : `/seller/${done.targetRef}`}>
            {done.targetType === "variety" ? "Back to the variety page" : "Back to the seller page"}
          </a>
        </p>
      </div>
    );
  }

  const intentError = fieldMessage("type");
  return (
    <form method="post" action="/report" onSubmit={submit} aria-busy={sending || undefined} className="form-stack">
      {showSummary ? <FieldSummary heading={failure.form ?? REPORT_SUMMARY_HEADING} entries={entries} summaryRef={summaryRef} /> : null}
      <fieldset className="form-field" aria-describedby={intentError ? "report-intent-error" : undefined}>
        <legend className="form-label">What would you like to do?</legend>
        {intentError ? <FieldErrorLine id="report-intent-error" message={intentError} /> : null}
        {INTENTS.map((i) => (
          <label key={i.value} className={`card field-option${type === i.value ? " field-option-selected" : ""}`}>
            <input type="radio" name="type" value={i.value} id={`report-intent-${i.value}`} checked={type === i.value} onChange={() => setType(i.value)} className="field-option-radio" />
            <span>
              <span className={type === i.value ? "field-option-title-selected" : "field-option-title"}>{i.label}</span>
              <span className="field-option-hint">{i.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="form-field">
        <label className="form-label" htmlFor="target_type">
          About
        </label>
        <select id="target_type" name="target_type" value={targetType} onChange={(e) => setTargetType(e.target.value as "variety" | "seller")} {...invalid("target_type")} onBlur={syncFilledClass} className="field">
          <option value="seller">A seller</option>
          <option value="variety">A variety</option>
        </select>
        {fieldMessage("target_type") ? <FieldErrorLine id="target_type-error" message={fieldMessage("target_type") as string} /> : null}
        <label className="form-muted" htmlFor="target_ref">
          Page address name (the last part of the URL, e.g. songbird-seed-co)
        </label>
        <input id="target_ref" name="target_ref" required defaultValue={floorValues?.targetRef ?? props.targetRef} pattern="[a-z0-9]+(-[a-z0-9]+)*" {...invalid("target_ref")} onBlur={syncFilledClass} onChange={syncFilledClass} className={`field${(floorValues?.targetRef ?? props.targetRef) !== "" ? " field-filled" : ""}`} />
        {fieldMessage("target_ref") ? <FieldErrorLine id="target_ref-error" message={fieldMessage("target_ref") as string} /> : null}
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="message">
          Details
        </label>
        <textarea id="message" name="message" required minLength={5} maxLength={4000} rows={5} defaultValue={floorValues?.message ?? ""} {...invalid("message")} onBlur={syncFilledClass} onChange={syncFilledClass} className={`field${(floorValues?.message ?? "") !== "" ? " field-filled" : ""}`} />
        {fieldMessage("message") ? <FieldErrorLine id="message-error" message={fieldMessage("message") as string} /> : null}
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="contact">
          Your email (so we can reply and, for claims and removals, confirm you run the seller)
        </label>
        <input id="contact" name="contact" type="email" required maxLength={320} defaultValue={floorValues?.contact ?? ""} {...invalid("contact")} onBlur={syncFilledClass} onChange={syncFilledClass} className={`field${(floorValues?.contact ?? "") !== "" ? " field-filled" : ""}`} />
        {fieldMessage("contact") ? <FieldErrorLine id="contact-error" message={fieldMessage("contact") as string} /> : null}
      </div>
      <Turnstile siteKey={props.siteKey} onToken={setToken} resetKey={reset} action="report" />
      <div>
        <button type="submit" className="btn btn-primary" disabled={sending}>
          {sending ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}
