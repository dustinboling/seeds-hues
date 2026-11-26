import { useData } from "vike-react/useData";
import "../../../src/components/admin/admin.css";
import "../../../src/forms.css";
import { BusyForm } from "../../../src/components/admin/BusyForm";
import type { Data } from "./+data";

const ERRORS: Record<string, string> = {
  send_failed: "We couldn’t send the email — check the address and try again.",
  missing_email: "Enter your email address.",
  resend_too_soon: "A code was just sent — please wait a minute before asking for another.",
  resend_limit: "That’s the most codes we can send in an hour — please try again later.",
};

export default function Page() {
  const { next, email, expired, signedOut, error } = useData<Data>();
  const message = error ? (ERRORS[error] ?? null) : null;
  return (
    <div className="admin-root admin-narrow">
      <div className="card admin-flow-card">
        <p className="admin-eyebrow">Seed Directory</p>
        <div aria-hidden="true" className="divider-stem" />
        <h1 className="admin-title">Admin sign-in</h1>
        {expired ? (
          <p role="status" className="admin-note-card">
            Your admin session ended — admin sessions last a week. Sign in again to pick up where you left off.
          </p>
        ) : null}
        {signedOut ? (
          <p role="status" className="admin-note-card">
            You signed out of admin.
          </p>
        ) : null}
        <p className="admin-prose">Sign in with the email on your Seed Directory account.</p>
        {message ? (
          <p role="alert" className="admin-alert">
            {message}
          </p>
        ) : null}
        <BusyForm action="/admin/sign-in/request" submitLabel="Email me a code" busyLabel="Sending…">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="admin-email" className="admin-label">
            Email
          </label>
          <input id="admin-email" name="email" type="email" required autoComplete="email" defaultValue={email ?? ""} className="field" />
        </BusyForm>
        <p className="admin-prose">
          <a href="/">Back to seeds.hues.flowers</a>
        </p>
      </div>
    </div>
  );
}
