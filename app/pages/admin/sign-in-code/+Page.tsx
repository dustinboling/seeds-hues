import { useData } from "vike-react/useData";
import "../../../src/components/admin/admin.css";
import "../../../src/forms.css";
import { ADMIN_CODE_TTL_MINUTES } from "../../../src/lib/admin/auth";
import { BusyForm } from "../../../src/components/admin/BusyForm";
import type { Data } from "./+data";

const CODE_MESSAGES: Record<string, string> = {
  no_code: "There’s no active code for this email — send a new one.",
  code_expired: "That code has expired. Send a new code.",
  code_dead: "Too many wrong tries — that code no longer works. Send a new code to try again.",
  code_incorrect: "That code doesn’t match. Check the email and try again.",
};

const RESEND_MESSAGES: Record<string, string> = {
  resend_too_soon: "A code was just sent — please wait a minute before asking for another.",
  resend_limit: "That’s the most codes we can send in an hour — please try again later.",
};

function errorFor(error: string | null, tries: number | null): string | null {
  if (!error) return null;
  if (error === "missing_code") return "Enter the 6-digit code.";
  if (error in CODE_MESSAGES) {
    const base = CODE_MESSAGES[error]!;
    if (error === "code_incorrect" && tries !== null && tries > 0) return `${base} (${tries} ${tries === 1 ? "try" : "tries"} left)`;
    return base;
  }
  if (error in RESEND_MESSAGES) return RESEND_MESSAGES[error]!;
  return null;
}

export default function Page() {
  const { email, next, sent, error, tries } = useData<Data>();
  const shown = email ?? "";
  const message = errorFor(error, tries);
  const backHref = next === "/admin" ? "/admin/sign-in" : `/admin/sign-in?next=${encodeURIComponent(next)}`;
  return (
    <div className="admin-root admin-narrow">
      <div className="card admin-flow-card">
        <p className="admin-eyebrow">Seed Directory</p>
        <div aria-hidden="true" className="divider-stem" />
        <h1 className="admin-title">Enter your code</h1>
        <p className="admin-prose">
          We sent a 6-digit code to <strong>{shown}</strong>. It works for {ADMIN_CODE_TTL_MINUTES} minutes.
        </p>
        {sent ? (
          <p role="status" className="admin-note-card">
            We sent a new code to {shown}.
          </p>
        ) : null}
        {message ? (
          <p role="alert" className="admin-alert">
            {message}
          </p>
        ) : null}
        <BusyForm action="/admin/sign-in/verify" submitLabel="Verify" busyLabel="Verifying…">
          <input type="hidden" name="email" value={shown} />
          <input type="hidden" name="next" value={next} />
          <label htmlFor="admin-code" className="admin-label">
            6-digit code
          </label>
          <input id="admin-code" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="field admin-code-field" />
        </BusyForm>
        <form method="post" action="/admin/sign-in/request" className="admin-stack">
          <input type="hidden" name="email" value={shown} />
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="resend" value="1" />
          <div>
            <button type="submit" className="btn btn-secondary">
              Send a new code
            </button>
          </div>
        </form>
        <p className="admin-prose">
          <a href={backHref}>Use a different email</a>
        </p>
      </div>
    </div>
  );
}
