"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AlertItem, PublicUser } from "@/lib/services/accounts";
import { callApi, deliveryNote } from "./api";
import { alertPhoneFailure, changeEmailFailure, deleteAccountFailure, type MappedFormFailure } from "./account-errors";
import { FieldErrorLine, FieldSummary, focusFailureTarget, syncFilledClass } from "@/components/ui/field-states";
import { CodeEntry } from "./CodeEntry";
import { SMS_CONSENT } from "./SignupFields";

const CHANNEL_LABEL = { email: "email", sms: "text" } as const;

function StatusLine({ s }: { s: AlertItem["status"] }) {
  if (s.state === "found") {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="badge badge-in-stock px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em]">Found</span>
        <span>
          Found at <Link href={`/seller/${s.seller.slug}`}>{s.seller.name}</Link>
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
      <span className="flex flex-wrap items-center gap-2">
        <span className="badge badge-preorder px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em]">Waiting · active</span>
        <span className="text-sm text-muted">We’ll send {s.channels.map((c) => CHANNEL_LABEL[c]).join(" + ")} the moment a seller lists it.</span>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="badge badge-unknown px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em]">Held</span>
      <span className="text-sm text-muted">Alerts are off until you: {s.reasons.join(" ")}.</span>
    </span>
  );
}

const EMPTY_FAILURE: MappedFormFailure = { fields: [], form: null };

export function AccountPanel({ user, alerts }: { user: PublicUser; alerts: AlertItem[] }) {
  const router = useRouter();
  const refresh = () => router.refresh();
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
  const emailSummaryRef = useRef<HTMLDivElement | null>(null);
  const phoneSummaryRef = useRef<HTMLDivElement | null>(null);
  const deleteSummaryRef = useRef<HTMLDivElement | null>(null);

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
      router.push("/account?deleted=1");
      router.refresh();
    } else setDeleteFailure(deleteAccountFailure(r.status, r.code, r.message));
  }

  const first = user.name.trim().split(/\s+/)[0] ?? "";
  const emailError = emailFailure.fields[0]?.message ?? null;
  const phoneError = phoneFailure.fields[0]?.message ?? null;
  const confirmError = deleteFailure.fields[0]?.message ?? null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 id="account-title" className="text-3xl font-semibold text-leaf">
          {first ? `Hello, ${first}` : "Your account"}
        </h1>
        {user.usda_zone ? <p className="mt-1 text-lg">Your zone: {user.usda_zone}</p> : null}
      </header>

      {msg ? (
        <p role={msg.kind} className={msg.kind === "alert" ? "font-medium text-warn" : "font-medium"}>
          {msg.text}
        </p>
      ) : null}

      <section aria-labelledby="alerts-title" className="flex flex-col gap-3">
        <h2 id="alerts-title" className="text-2xl font-semibold">
          Alerts
        </h2>
        <p className="text-muted">
          The varieties you’ve asked us to find. When a seller lists one, we send a text (if you’ve switched texts on) and an email.
        </p>
        {alerts.length === 0 ? (
          <p className="card p-4">
            You’re not waiting on any varieties yet. On any variety page with no sellers, choose “Join the waiting list”. <Link href="/variety">Browse varieties</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card" data-testid="alerts-list">
            {alerts.map((a) => (
              <li key={a.variety.slug} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <Link href={`/variety/${a.variety.slug}`} className="font-semibold">
                    {a.variety.name} <span className="font-normal text-muted">({a.variety.crop})</span>
                  </Link>
                  <StatusLine s={a.status} />
                </div>
                <button type="button" className="btn btn-secondary shrink-0" disabled={busy} onClick={() => act("/api/v1/account/waitlist/leave", { variety: a.variety.slug }, `You’ve left the waiting list for ${a.variety.name}.`)}>
                  Leave list<span className="sr-only"> for {a.variety.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="email-title" className="card flex flex-col gap-3 p-4">
        <h2 id="email-title" className="text-xl font-semibold">
          Email alerts
        </h2>
        <p>
          {user.email} —{" "}
          {user.email_verified ? <strong className="text-leaf">verified</strong> : <strong className="text-warn">not verified yet</strong>}
        </p>
        {!user.email_verified ? (
          <>
            <p className="text-sm">Check your inbox for a 6-digit code to activate email alerts.</p>
            <CodeEntry channel="email" idPrefix="account-email" initialNote={emailNote} onVerified={() => {
                setMsg({ kind: "status", text: "Email verified — alerts are on." });
                refresh();
              }} />
          </>
        ) : null}
        <form onSubmit={changeEmail} aria-busy={busy || undefined} className="flex flex-col gap-1">
          {emailFailure.form ? <FieldSummary heading={emailFailure.form} entries={[]} summaryRef={emailSummaryRef} /> : null}
          {emailDone ? (
            <p role="status" className="font-medium">
              {emailDone}
            </p>
          ) : null}
          <label htmlFor="change-email" className="text-sm font-semibold">
            Change email
          </label>
          <div className="flex flex-wrap gap-2">
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
              className="field max-w-sm"
            />
            <button type="submit" className="btn btn-secondary" disabled={busy}>
              Update email
            </button>
          </div>
          <span id="change-email-hint" className="field-hint text-sm">
            A new address needs its own 6-digit code before email alerts resume.
          </span>
          {emailError ? <FieldErrorLine id="change-email-error" message={emailError} /> : null}
        </form>
      </section>

      <section aria-labelledby="texts-title" className="card flex flex-col gap-3 p-4">
        <h2 id="texts-title" className="text-xl font-semibold">
          Text alerts
        </h2>
        <p className="text-sm">
          {user.sms_opt_in
            ? user.alert_phone_verified
              ? `Texts are on, to ${user.alert_phone_display}.`
              : `Texts are held until you confirm ${user.alert_phone_display} with the code we text you.`
            : "Texts are off."}
        </p>
        <form onSubmit={saveTexts} aria-busy={busy || undefined} className="flex flex-col gap-3">
          {phoneFailure.form ? <FieldSummary heading={phoneFailure.form} entries={[]} summaryRef={phoneSummaryRef} /> : null}
          {phoneDone ? (
            <p role="status" className="font-medium">
              {phoneDone}
            </p>
          ) : null}
          <div className="flex items-start gap-2">
            <input id="sms-opt-in" name="sms_opt_in" type="checkbox" defaultChecked={user.sms_opt_in} className="mt-1 h-5 w-5" aria-describedby="sms-consent" />
            <label htmlFor="sms-opt-in">
              <span className="font-medium">Text me when a variety I’m waiting for is found</span>
              <span id="sms-consent" className="block text-sm text-muted">
                {SMS_CONSENT}
              </span>
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="alert-phone" className="text-sm font-semibold">
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
              className="field max-w-xs"
            />
            <span id="alert-phone-hint" className="field-hint text-sm">
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

      <section aria-labelledby="prefs-title" className="card flex flex-col gap-3 p-4">
        <h2 id="prefs-title" className="text-xl font-semibold">
          All notifications
        </h2>
        <p className="text-sm">
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

      <section aria-labelledby="details-title" className="flex flex-col gap-2">
        <h2 id="details-title" className="text-xl font-semibold">
          Your details
        </h2>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_1fr]">
          <dt className="text-sm text-muted">Name</dt>
          <dd>{user.name}</dd>
          <dt className="text-sm text-muted">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-sm text-muted">Phone (sign-in)</dt>
          <dd>{user.phone_display}</dd>
          {user.farm_owner_declared || user.is_farm_owner ? (
            <>
              <dt className="text-sm text-muted">Farm owner</dt>
              <dd>
                {user.is_farm_owner ? (
                  "Verified farm owner."
                ) : (
                  <>
                    Declared — farm-owner tools unlock after we review your farm. <Link href="/add-your-farm">Add your farm’s details</Link>.
                  </>
                )}
              </dd>
            </>
          ) : null}
        </dl>
        <p className="text-sm text-muted">Your phone number is half of your sign-in and is never shown publicly.</p>
      </section>

      <section aria-labelledby="session-title" className="flex flex-col gap-3">
        <h2 id="session-title" className="text-xl font-semibold">
          Sign out or delete
        </h2>
        <div className="flex flex-wrap gap-2">
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
          <form onSubmit={deleteAccount} aria-busy={busy || undefined} className="card flex flex-col gap-2 p-4" aria-label="Confirm account deletion">
            {deleteFailure.form ? <FieldSummary heading={deleteFailure.form} entries={[]} summaryRef={deleteSummaryRef} /> : null}
            <p>This permanently deletes your account, your waiting lists and any queued alerts. It can’t be undone.</p>
            <label htmlFor="delete-confirm" className="text-sm font-semibold">
              Type DELETE to confirm
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="delete-confirm"
                name="confirm"
                required
                autoComplete="off"
                aria-invalid={confirmError ? true : undefined}
                aria-describedby={confirmError ? "delete-confirm-error" : undefined}
                onBlur={syncFilledClass}
                onChange={syncFilledClass}
                className="field max-w-[12rem]"
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
