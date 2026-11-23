"use client";

import Link from "next/link";
import { cloneElement, useEffect, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { Turnstile } from "@/components/ui/Turnstile";
import { callApi } from "@/components/account/api";
import type { MappedFormFailure } from "@/components/account/account-errors";
import { FieldSuccessIcon } from "@/components/layout/icons";
import { FieldErrorLine, FieldSummary, focusFailureTarget, syncFilledClass } from "@/components/ui/field-states";
import { FARM_SUMMARY_HEADING, farmFailure } from "./farm-errors";

/** The props the field helper injects into every control: association, filled tracking. */
type FieldControlProps = {
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  onBlur?: (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement }) => void;
  onChange?: (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement }) => void;
};

/** DOM id for a mapped field key: the wholesale group focuses its first radio, every other key is its own id. */
const fieldDomId = (key: string) => (key === "wholesale" ? "wholesale-yes" : key);

/**
 * Add Your Farm (design §9, field list locked 2026-11-16). REQUIRED: farm name, contact name +
 * email (prefilled from the account), city, state (prefilled from ?state=), website or shop URL,
 * about, varieties (one per line), the authorization checkbox, business phone (deliberately
 * NOT prefilled — the account phone stays private). OPTIONAL: Google Business Profile,
 * Instagram, TikTok, Facebook, wholesale yes/no, notes. Turnstile. → pending review; nothing
 * auto-publishes.
 */
export function AddYourFarmForm(props: {
  siteKey: string | null;
  states: { code: string; name: string }[];
  defaults: { contactName: string; contactEmail: string; state: string | null };
}) {
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<MappedFormFailure>({ fields: [], form: null });
  const [done, setDone] = useState(false);
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

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    setBusy(true);
    setFailure({ fields: [], form: null });
    const r = await callApi("/api/v1/farm-submissions", {
      farm_name: s("farm_name"),
      contact_name: s("contact_name"),
      contact_email: s("contact_email"),
      city: s("city"),
      state: s("state"),
      website: s("website"),
      about: s("about"),
      varieties: s("varieties"),
      authorized: f.get("authorized") === "on",
      business_phone: s("business_phone"),
      gbp_url: s("gbp_url"),
      instagram_url: s("instagram_url"),
      tiktok_url: s("tiktok_url"),
      facebook_url: s("facebook_url"),
      wholesale: s("wholesale"),
      notes: s("notes"),
      ...(token ? { turnstile_token: token } : {}),
    });
    setBusy(false);
    if (r.ok) {
      setDone(true);
      return;
    }
    setFailure(farmFailure(r.status, r.code, r.message));
    setReset((n) => n + 1);
  }

  if (done) {
    return (
      <div role="status" className="card field-success mt-6" data-testid="farm-thanks">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <FieldSuccessIcon className="size-5 shrink-0 text-leaf" />
          <span ref={successHeadingRef} tabIndex={-1} data-field-success-heading>
            Thank you — your submission is in our review queue.
          </span>
        </p>
        <p>
          We review every submission by hand, usually within a few days, and we’ll email you at the contact address you gave. Nothing is published until we’ve checked it with you.
        </p>
        <p>
          <Link href="/seller">Browse the sellers already listed</Link>
        </p>
      </div>
    );
  }

  const field = (id: string, label: ReactNode, input: ReactElement<FieldControlProps>, hint?: string) => {
    const message = fieldMessage(id);
    const hintId = hint === undefined ? undefined : `${id}-hint`;
    const describedby = [hintId, message ? `${id}-error` : undefined].filter((v): v is string => v !== undefined).join(" ") || undefined;
    const control = cloneElement(input, {
      "aria-invalid": message ? true : undefined,
      "aria-describedby": describedby,
      onBlur: syncFilledClass,
      onChange: syncFilledClass,
    });
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {control}
        {hint ? (
          <span id={hintId} className="field-hint text-sm">
            {hint}
          </span>
        ) : null}
        {message ? <FieldErrorLine id={`${id}-error`} message={message} /> : null}
      </div>
    );
  };
  const opt = (label: string) => (
    <>
      {label} <span className="font-normal text-muted">(optional)</span>
    </>
  );

  const wholesaleError = fieldMessage("wholesale");
  const authorizedError = fieldMessage("authorized");

  return (
    <form onSubmit={submit} aria-busy={busy || undefined} className="mt-6 flex max-w-2xl flex-col gap-5" aria-label="Add your farm">
      {showSummary ? <FieldSummary heading={failure.form ?? FARM_SUMMARY_HEADING} entries={entries} summaryRef={summaryRef} /> : null}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-xl font-semibold">Your farm or company</legend>
        {field("farm_name", "Farm or company name", <input id="farm_name" name="farm_name" required maxLength={200} autoComplete="organization" className="field" />)}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_14rem]">
          {field("city", "City", <input id="city" name="city" required maxLength={120} autoComplete="address-level2" className="field" />)}
          {field(
            "state",
            "State",
            <select id="state" name="state" required defaultValue={props.defaults.state ?? ""} className="field">
              <option value="" disabled>
                Choose a state
              </option>
              {props.states.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>,
          )}
        </div>
        {field("website", "Website or online shop", <input id="website" name="website" type="url" required maxLength={500} placeholder="https://" className="field" />, "We use it to verify your business and to draft your profile for your review.")}
        {field(
          "business_phone",
          "Business phone",
          <input id="business_phone" name="business_phone" type="tel" required maxLength={32} inputMode="tel" className="field max-w-xs" />,
          "Your business’s public contact number, shown on your seller page. (Your account phone stays private.)",
        )}
        {field("about", "About your farm or company", <textarea id="about" name="about" required minLength={10} maxLength={2000} rows={4} className="field" />, "A few sentences: what you sell, and where you are. If you grow your own seed, tell us about that too. Your About must be at least 10 characters long.")}
        {field("varieties", "Varieties you want listed", <textarea id="varieties" name="varieties" required maxLength={5000} rows={5} className="field" />, "List one variety per line, e.g. “Zinnia — Queen Lime Blush”.")}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-xl font-semibold">Contact</legend>
        {field("contact_name", "Contact name", <input id="contact_name" name="contact_name" required maxLength={120} defaultValue={props.defaults.contactName} autoComplete="name" className={props.defaults.contactName ? "field field-filled" : "field"} />)}
        {field("contact_email", "Contact email", <input id="contact_email" name="contact_email" type="email" required maxLength={320} defaultValue={props.defaults.contactEmail} autoComplete="email" className={props.defaults.contactEmail ? "field field-filled" : "field"} />)}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-xl font-semibold">Online presence and more</legend>
        {field("gbp_url", opt("Google Business Profile link"), <input id="gbp_url" name="gbp_url" type="url" maxLength={500} className="field" />)}
        {field("instagram_url", opt("Instagram"), <input id="instagram_url" name="instagram_url" type="url" maxLength={500} placeholder="https://instagram.com/…" className="field" />)}
        {field("tiktok_url", opt("TikTok"), <input id="tiktok_url" name="tiktok_url" type="url" maxLength={500} placeholder="https://tiktok.com/@…" className="field" />)}
        {field("facebook_url", opt("Facebook business page"), <input id="facebook_url" name="facebook_url" type="url" maxLength={500} placeholder="https://facebook.com/…" className="field" />)}
        <fieldset className="flex flex-col gap-1" aria-describedby={wholesaleError ? "wholesale-error" : undefined}>
          <legend className="text-sm font-semibold">
            Do you sell wholesale too? <span className="font-normal text-muted">(optional)</span>
          </legend>
          {wholesaleError ? <FieldErrorLine id="wholesale-error" message={wholesaleError} /> : null}
          <div className="flex gap-4">
            <label className="flex min-h-target items-center gap-2">
              <input type="radio" name="wholesale" id="wholesale-yes" value="yes" /> Yes
            </label>
            <label className="flex min-h-target items-center gap-2">
              <input type="radio" name="wholesale" id="wholesale-no" value="no" /> No
            </label>
          </div>
        </fieldset>
        {field("notes", opt("Anything else"), <textarea id="notes" name="notes" maxLength={2000} rows={3} className="field" />)}
      </fieldset>

      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <input id="authorized" name="authorized" type="checkbox" required aria-invalid={authorizedError ? true : undefined} aria-describedby={authorizedError ? "authorized-error" : undefined} className="mt-1 h-5 w-5" />
          <label htmlFor="authorized" className="font-medium">
            I own or am authorized to represent this farm or company
          </label>
        </div>
        {authorizedError ? <FieldErrorLine id="authorized-error" message={authorizedError} /> : null}
      </div>

      <Turnstile siteKey={props.siteKey} onToken={setToken} resetKey={reset} action="add-your-farm" />
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send for review"}
        </button>
      </div>
    </form>
  );
}
