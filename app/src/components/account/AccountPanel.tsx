import { useEffect, useRef, useState, type FormEvent } from "react";
import { isProfileComplete, type AlertItem, type AccountPublicUser } from "./types";
import { callApi, deliveryNote } from "./api";
import {
  FINISH_PROFILE_SUMMARY_HEADING,
  alertPhoneFailure,
  changeEmailFailure,
  deleteAccountFailure,
  profileFailure,
  type MappedFormFailure,
} from "./account-errors";
import { FieldErrorLine, FieldSummary, focusFailureTarget, syncFilledClass } from "../ui/field-states";
import { CodeEntry } from "./CodeEntry";
import { FinishProfileFields, profileBody } from "./FinishProfileFields";
import { SMS_CONSENT } from "./SignupFields";

/**
 * The signed-in account surface, ported from
 * v2/components/account/AccountPanel.tsx: the finish-your-account step
 * for flip-created accounts, the Alerts section with Found/Waiting/Held
 * states, email + text-alert management, notification preferences,
 * account details, and sign-out/delete. The only structural delta is
 * the refresh handoff — onChanged/onDeleted callbacks the /account
 * shell uses to re-read the session, instead of Next's router refresh
 * (the panel is client-rendered here).
 */

const CHANNEL_LABEL = { email: "email", sms: "text" } as const;

function StatusLine({ s }: { s: AlertItem["status"] }) {
  if (s.state === "found") {
    return (
      <span className="alert-status">
        <span className="badge badge-in-stock alert-badge">Found</span>
        <span>
          Found at <a href={`/seller/${s.seller.slug}`}>{s.seller.name}</a>
          {s.seller_count > 1 ? ` and ${s.seller_count - 1} more` : ""} —{" "}
          <a href={`/go/${s.listing_id}`} rel="nofollow noopener noreferrer" target="_blank">
            shop
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </span>
      </span>
    );
  }
  if (s.state === "waiting") {
    return (
      <span className="alert-status">
        <span className="badge badge-preorder alert-badge">Waiting · active</span>
        <span className="form-muted">We’ll send {s.channels.map((c) => CHANNEL_LABEL[c]).join(" + ")} the moment a seller lists it.</span>
      </span>
    );
  }
  return (
    <span className="alert-status">
      <span className="badge badge-unknown alert-badge">Held</span>
      <span className="form-muted">Alerts are off until you: {s.reasons.join(" ")}.</span>
    </span>
  );
}

const EMPTY_FAILURE: MappedFormFailure = { fields: [], form: null };

export function AccountPanel({ user, alerts, onChanged, onDeleted }: { user: AccountPublicUser; alerts: AlertItem[]; onChanged: () => void; onDeleted: () => void }) {
  const refresh = onChanged;
  const [msg, setMsg] = useState<{ kind: "status" | "alert"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [phoneNote, setPhoneNote] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [emailFailure, setEmailFailure] = useState<MappedFormFailure>(EMPTY_FAILURE);
  const [emailDone, setEmailDone] = useState<string | null>(null);
  const [phoneFailure, setPhoneFailure] = useState<MappedFormFailure>(EMPTY_FAILURE);
  const [phoneDone, setPhoneDone] = useState<string | null>(null);
  const [deleteFailure, setDeleteFailure] = useState<MappedFormFailure>(EMPTY_FAILURE);
  const [finishDismissed, setFinishDismissed] = useState(false);
  const [profileFailureState, setProfileFailureState] = useState<MappedFormFailure>(EMPTY_FAILURE);
  const [profileDone, setProfileDone] = useState<string | null>(null);
  const emailSummaryRef = useRef<HTMLDivElement | null>(null);
  const phoneSummaryRef = useRef<HTMLDivElement | null>(null);
  const deleteSummaryRef = useRef<HTMLDivElement | null>(null);
  const profileSummaryRef = useRef<HTMLDivElement | null>(null);

  // Failed sub-form submits move focus to the in-form summary (form-level) or the field.
  useEffect(() => {
    if (emailFailure.form === null && emailFailure.fields.length === 0) return;
    focusFailureTarget(emailSummaryRef.current, emailFailure.fields.map((f) => ({ fieldId: "change-email", message: f.message })), emailFailure.form);
  }, [emailFailure]);
  useEffect(() => {
    if (phoneFailure.form === null && phoneFailure.fields.length === 0) return;
    focusFailureTarget(phoneSummaryRef.current, phoneFailure.fields.map((f) => ({ fieldId: "alert-phone", message: f.message })), phoneFailure.form);
  }, [phoneFailure]);
  useEffect(() => {
    if (deleteFailure.form === null && deleteFailure.fields.length === 0) return;
    focusFailureTarget(deleteSummaryRef.current, deleteFailure.fields.map((f) => ({ fieldId: "delete-confirm", message: f.message })), deleteFailure.form);
  }, [deleteFailure]);
  const profileEntries = profileFailureState.fields.map((f) => ({ fieldId: `panel-finish-${f.key}`, message: f.message }));
  const showProfileSummary = profileFailureState.form !== null || profileEntries.length >= 2;
  useEffect(() => {
    if (!showProfileSummary && profileEntries.length === 0) return;
    focusFailureTarget(profileSummaryRef.current, profileEntries, profileFailureState.form);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entries/showProfileSummary derive from profileFailureState
  }, [profileFailureState]);

  /** Non-field actions only (leave a list, preferences): the panel-head line keeps their feedback. */
  async function act(path: string, body: unknown, ok?: string, after?: (data: Record<string, unknown>) => void) {
    setBusy(true);
    setMsg(null);
    const r = await callApi(path, body);
    setBusy(false);
    if (!r.ok) {
      setMsg({ kind: "alert", text: r.message });
      return false;
    }
    if (ok) setMsg({ kind: "status", text: ok });
    after?.(r.data);
    refresh();
    return true;
  }

  async function changeEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setBusy(true);
    setEmailFailure(EMPTY_FAILURE);
    setEmailDone(null);
    const r = await callApi("/api/v1/account/email", { email });
    setBusy(false);
    if (!r.ok) {
      setEmailFailure(changeEmailFailure(r.status, r.code, r.message));
      return;
    }
    setEmailNote(deliveryNote((r.data as Record<string, unknown>).delivery as string | null, "email"));
    setEmailDone("Email updated — enter the code we sent to the new address.");
    refresh();
  }

  async function saveTexts(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setPhoneFailure(EMPTY_FAILURE);
    setPhoneDone(null);
    const r = await callApi("/api/v1/account/alert-phone", { alert_phone: String(f.get("alert_phone") ?? ""), sms_opt_in: f.get("sms_opt_in") === "on" });
    setBusy(false);
    if (!r.ok) {
      setPhoneFailure(alertPhoneFailure(r.status, r.code, r.message));
      return;
    }
    setPhoneNote(deliveryNote((r.data as Record<string, unknown>).delivery as string | null, "phone"));
    setPhoneDone("Text alert settings saved.");
    refresh();
  }

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setProfileFailureState(EMPTY_FAILURE);
    setProfileDone(null);
    const r = await callApi("/api/v1/account/profile", profileBody(new FormData(e.currentTarget)));
    setBusy(false);
    if (!r.ok) {
      setProfileFailureState(profileFailure(r.status, r.code, r.message));
      return;
    }
    setProfileDone("Your account details are saved.");
    refresh();
  }

  async function signOut() {
    setBusy(true);
    await callApi("/api/v1/account/sign-out", {});
    setBusy(false);
    refresh();
  }

  async function deleteAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const confirm = String(new FormData(e.currentTarget).get("confirm") ?? "").trim();
    setBusy(true);
    setDeleteFailure(EMPTY_FAILURE);
    const r = await callApi("/api/v1/account/delete", { confirm });
    setBusy(false);
    if (r.ok) {
      onDeleted();
    } else setDeleteFailure(deleteAccountFailure(r.status, r.code, r.message));
  }

  const first = user.name.trim().split(/\s+/)[0] ?? "";
  const emailError = emailFailure.fields[0]?.message ?? null;
  const phoneError = phoneFailure.fields[0]?.message ?? null;
  const confirmError = deleteFailure.fields[0]?.message ?? null;
  const profileIncomplete = !isProfileComplete(user.name, user.usda_zone);

  return (
    <div className="form-stack-loose">
      <header>
        <h1 id="account-title" className="page-title">
          {first ? `Hello, ${first}` : "Your account"}
        </h1>
        {user.usda_zone ? <p className="page-subtitle">Your zone: {user.usda_zone}</p> : null}
      </header>

      {msg ? (
        <p role={msg.kind} className={msg.kind === "alert" ? "form-message-alert" : "form-message"}>
          {msg.text}
        </p>
      ) : null}

      {profileIncomplete && !finishDismissed ? (
        <section aria-labelledby="finish-title" className="card form-stack-tight field-pad">
          <h2 id="finish-title" className="form-heading">
            Finish your account
          </h2>
          <p className="form-note">Want to finish your account? A name and ZIP set your growing zone — you can do this any time, or not at all.</p>
          <form onSubmit={saveProfile} aria-busy={busy || undefined} className="form-stack">
            {showProfileSummary ? <FieldSummary heading={profileFailureState.form ?? FINISH_PROFILE_SUMMARY_HEADING} entries={profileEntries} summaryRef={profileSummaryRef} /> : null}
            {profileDone ? (
              <p role="status" className="form-message">
                {profileDone}
              </p>
            ) : null}
            <FinishProfileFields
              idPrefix="panel-finish"
              errors={Object.fromEntries(profileFailureState.fields.map((f) => [f.key, f.message]))}
            />
            <div className="form-row">
              <button type="submit" className="btn btn-secondary" disabled={busy}>
                Save
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setFinishDismissed(true)}>
                Not now
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section aria-labelledby="alerts-title" className="form-stack-tight">
        <h2 id="alerts-title" className="section-heading">
          Alerts
        </h2>
        <p className="form-muted">
          The varieties you’ve asked us to find. When a seller lists one, we send a text (if you’ve switched texts on) and an email.
        </p>
        {alerts.length === 0 ? (
          <p className="card field-pad">
            You’re not waiting on any varieties yet. On any variety page with no sellers, choose “Join the waiting list”. <a href="/variety">Browse varieties</a>.
          </p>
        ) : (
          <ul className="alerts-list" data-testid="alerts-list">
            {alerts.map((a) => (
              <li key={a.variety.slug} className="alerts-row">
                <div className="alerts-main">
                  <a href={`/variety/${a.variety.slug}`} className="alerts-name">
                    {a.variety.name} <span className="form-muted">({a.variety.crop})</span>
                  </a>
                  <StatusLine s={a.status} />
                </div>
                <button type="button" className="btn btn-secondary alerts-leave" disabled={busy} onClick={() => act("/api/v1/account/waitlist/leave", { variety: a.variety.slug }, `You’ve left the waiting list for ${a.variety.name}.`)}>
                  Leave list<span className="sr-only"> for {a.variety.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="email-title" className="card form-stack-tight field-pad">
        <h2 id="email-title" className="form-heading">
          Email alerts
        </h2>
        <p>
          {user.email} —{" "}
          {user.email_verified ? <strong className="text-verified">verified</strong> : <strong className="text-unverified">not verified yet</strong>}
        </p>
        {!user.email_verified ? (
          <>
            <p className="form-note">Check your inbox for a 6-digit code to activate email alerts.</p>
            <CodeEntry channel="email" idPrefix="account-email" initialNote={emailNote} onVerified={() => {
                setMsg({ kind: "status", text: "Email verified — alerts are on." });
                refresh();
              }} />
          </>
        ) : null}
        <form onSubmit={changeEmail} aria-busy={busy || undefined} className="form-field">
          {emailFailure.form ? <FieldSummary heading={emailFailure.form} entries={[]} summaryRef={emailSummaryRef} /> : null}
          {emailDone ? (
            <p role="status" className="form-message">
              {emailDone}
            </p>
          ) : null}
          <label htmlFor="change-email" className="form-label">
            Change email
          </label>
          <div className="form-row">
            <input
              id="change-email"
              name="email"
              type="email"
              required
              maxLength={320}
              autoComplete="email"
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "change-email-hint change-email-error" : "change-email-hint"}
              onBlur={syncFilledClass}
              onChange={syncFilledClass}
              className="field"
            />
            <button type="submit" className="btn btn-secondary" disabled={busy}>
              Update email
            </button>
          </div>
          <span id="change-email-hint" className="field-hint">
            A new address needs its own 6-digit code before email alerts resume.
          </span>
          {emailError ? <FieldErrorLine id="change-email-error" message={emailError} /> : null}
        </form>
      </section>

      <section aria-labelledby="texts-title" className="card form-stack-tight field-pad">
        <h2 id="texts-title" className="form-heading">
          Text alerts
        </h2>
        <p className="form-note">
          {user.sms_opt_in
            ? user.alert_phone_verified
              ? `Texts are on, to ${user.alert_phone_display}.`
              : `Texts are held until you confirm ${user.alert_phone_display} with the code we text you.`
            : "Texts are off."}
        </p>
        <form onSubmit={saveTexts} aria-busy={busy || undefined} className="form-stack">
          {phoneFailure.form ? <FieldSummary heading={phoneFailure.form} entries={[]} summaryRef={phoneSummaryRef} /> : null}
          {phoneDone ? (
            <p role="status" className="form-message">
              {phoneDone}
            </p>
          ) : null}
          <div className="form-choice-row-top">
            <input id="sms-opt-in" name="sms_opt_in" type="checkbox" defaultChecked={user.sms_opt_in} className="field-checkbox" aria-describedby="sms-consent" />
            <label htmlFor="sms-opt-in">
              <span className="form-label-inline">Text me when a variety I’m waiting for is found</span>
              <span id="sms-consent" className="field-option-hint">
                {SMS_CONSENT}
              </span>
            </label>
          </div>
          <div className="form-field">
            <label htmlFor="alert-phone" className="form-label">
              Alert number
            </label>
            <input
              id="alert-phone"
              name="alert_phone"
              type="tel"
              inputMode="tel"
              maxLength={32}
              defaultValue={user.alert_phone_display ?? user.phone_display}
              aria-invalid={phoneError ? true : undefined}
              aria-describedby={phoneError ? "alert-phone-hint alert-phone-error" : "alert-phone-hint"}
              onBlur={syncFilledClass}
              onChange={syncFilledClass}
              className="field field-narrow"
            />
            <span id="alert-phone-hint" className="field-hint">
              Starts as your account phone. A new number gets its own one-time code.
            </span>
            {phoneError ? <FieldErrorLine id="alert-phone-error" message={phoneError} /> : null}
          </div>
          <div>
            <button type="submit" className="btn btn-secondary" disabled={busy}>
              Save text settings
            </button>
          </div>
        </form>
        {user.sms_opt_in && !user.alert_phone_verified ? (
          <CodeEntry channel="phone" idPrefix="account-phone" initialNote={phoneNote} onVerified={() => {
              setMsg({ kind: "status", text: "Alert number confirmed — texts are on." });
              refresh();
            }} />
        ) : null}
      </section>

      <section aria-labelledby="prefs-title" className="card form-stack-tight field-pad">
        <h2 id="prefs-title" className="form-heading">
          All notifications
        </h2>
        <p className="form-note">
          {user.notify_opt_out ? "All waiting-list alerts are turned off. Your lists are kept." : "Waiting-list alerts are on for every channel you’ve verified."}
        </p>
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            aria-pressed={!user.notify_opt_out}
            disabled={busy}
            onClick={() => act("/api/v1/account/preferences", { notify_opt_out: !user.notify_opt_out }, user.notify_opt_out ? "Alerts turned back on." : "All alerts turned off.")}
          >
            {user.notify_opt_out ? "Turn alerts back on" : "Turn off all alerts"}
          </button>
        </div>
      </section>

      <section aria-labelledby="details-title" className="form-stack-tight">
        <h2 id="details-title" className="form-heading">
          Your details
        </h2>
        <dl className="details-grid">
          <dt className="form-muted">Name</dt>
          <dd>{user.name === "" ? "Not set yet." : user.name}</dd>
          <dt className="form-muted">Email</dt>
          <dd>{user.email}</dd>
          <dt className="form-muted">Phone (sign-in)</dt>
          <dd>{user.phone === "" ? "No phone number on this account." : user.phone_display}</dd>
          {user.farm_owner_declared || user.is_farm_owner ? (
            <>
              <dt className="form-muted">Farm owner</dt>
              <dd>
                {user.is_farm_owner ? (
                  "Verified farm owner."
                ) : (
                  <>
                    Declared — farm-owner tools unlock after we review your farm. <a href="/add-your-farm">Add your farm’s details</a>.
                  </>
                )}
              </dd>
            </>
          ) : null}
        </dl>
        <p className="form-muted">
          {user.phone === "" ? "This account has no phone number — you sign in with a code we email you." : "Your phone number is half of your sign-in and is never shown publicly."}
        </p>
      </section>

      <section aria-labelledby="session-title" className="form-stack-tight">
        <h2 id="session-title" className="form-heading">
          Sign out or delete
        </h2>
        <div className="form-row">
          <button type="button" className="btn btn-secondary" onClick={signOut} disabled={busy}>
            Sign out
          </button>
          {!confirmDelete ? (
            <button type="button" className="btn btn-secondary" onClick={() => { setDeleteFailure(EMPTY_FAILURE); setConfirmDelete(true); }} disabled={busy}>
              Delete my account
            </button>
          ) : null}
        </div>
        {confirmDelete ? (
          <form onSubmit={deleteAccount} aria-busy={busy || undefined} className="card form-stack-tight field-pad" aria-label="Confirm account deletion">
            {deleteFailure.form ? <FieldSummary heading={deleteFailure.form} entries={[]} summaryRef={deleteSummaryRef} /> : null}
            <p>This permanently deletes your account, your waiting lists and any queued alerts. It can’t be undone.</p>
            <label htmlFor="delete-confirm" className="form-label">
              Type DELETE to confirm
            </label>
            <div className="form-row">
              <input
                id="delete-confirm"
                name="confirm"
                required
                autoComplete="off"
                aria-invalid={confirmError ? true : undefined}
                aria-describedby={confirmError ? "delete-confirm-error" : undefined}
                onBlur={syncFilledClass}
                onChange={syncFilledClass}
                className="field field-narrow"
              />
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Delete my account
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
            {confirmError ? <FieldErrorLine id="delete-confirm-error" message={confirmError} /> : null}
          </form>
        ) : null}
      </section>
    </div>
  );
}
