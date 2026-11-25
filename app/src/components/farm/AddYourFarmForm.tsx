import { cloneElement, useEffect, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { Turnstile } from "../ui/Turnstile";
import { callApi } from "../account/api";
import type { MappedFormFailure } from "../account/account-errors";
import { FieldSuccessIcon } from "../icons";
import { FieldErrorLine, FieldSummary, focusFailureTarget, syncFilledClass } from "../ui/field-states";
import { farmJsonFromForm, type FarmFloorOutcome } from "../../server/form-posts";
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
 * Add Your Farm (design §9, field list locked 2026-11-16), ported from
 * v2/components/farm/AddYourFarmForm.tsx. REQUIRED: farm name, contact
 * name + email (prefilled from the account), city, state (prefilled
 * from ?state=), website or shop URL, about, varieties (one per line),
 * the authorization checkbox, business phone (deliberately NOT
 * prefilled — the account phone stays private). OPTIONAL: Google
 * Business Profile, Instagram, TikTok, Facebook, wholesale yes/no,
 * notes. Turnstile. → pending review; nothing auto-publishes.
 *
 * The SSR floor (a real form posting form-encoded to the page itself)
 * and the client enhancement share one field mapping
 * (server/form-posts), so both paths carry identical payloads. A floor
 * outcome from the POST render seeds the initial state; later client
 * submits replace it.
 */
export function AddYourFarmForm(props: {
  siteKey: string | null;
  states: { code: string; name: string }[];
  defaults: { contactName: string; contactEmail: string; state: string | null };
  outcome?: FarmFloorOutcome | null;
}) {
  const floor = props.outcome ?? null;
  const floorValues = floor?.kind === "failure" ? floor.values : null;
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<MappedFormFailure>(floorValues ? floor.values.failure : { fields: [], form: null });
  const [done, setDone] = useState(floor?.kind === "success");
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
    const fields: Record<string, string> = {};
    f.forEach((value, key) => {
      if (typeof value === "string") fields[key] = value;
    });
    if (token) fields.turnstile_token = token;
    setBusy(true);
    setFailure({ fields: [], form: null });
    const r = await callApi("/api/v1/farm-submissions", farmJsonFromForm(fields));
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
      <div role="status" className="card field-success" data-testid="farm-thanks">
        <p className="form-success-title">
          <FieldSuccessIcon className="field-success-icon" />
          <span ref={successHeadingRef} tabIndex={-1} data-field-success-heading>
            Thank you — your submission is in our review queue.
          </span>
        </p>
        <p>
          We review every submission by hand, usually within a few days, and we’ll email you at the contact address you gave. Nothing is published until we’ve checked it with you.
        </p>
        <p>
          <a href="/seller">Browse the sellers already listed</a>
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
      <div className="form-field">
        <label htmlFor={id} className="form-label">
          {label}
        </label>
        {control}
        {hint ? (
          <span id={hintId} className="field-hint">
            {hint}
          </span>
        ) : null}
        {message ? <FieldErrorLine id={`${id}-error`} message={message} /> : null}
      </div>
    );
  };
  const opt = (label: string) => (
    <>
      {label} <span className="form-muted-inline">(optional)</span>
    </>
  );

  const wholesaleError = fieldMessage("wholesale");
  const authorizedError = fieldMessage("authorized");
  const v = (key: keyof NonNullable<typeof floorValues>): string => floorValues?.[key] as string ?? "";
  const filled = (value: string): string => (value !== "" ? " field-filled" : "");

  return (
    <form method="post" action="/add-your-farm" onSubmit={submit} aria-busy={busy || undefined} className="form-stack" aria-label="Add your farm">
      {showSummary ? <FieldSummary heading={failure.form ?? FARM_SUMMARY_HEADING} entries={entries} summaryRef={summaryRef} /> : null}
      <fieldset className="form-stack-tight">
        <legend className="form-legend">Your farm or company</legend>
        {field("farm_name", "Farm or company name", <input id="farm_name" name="farm_name" required maxLength={200} autoComplete="organization" defaultValue={v("farm_name")} className={`field${filled(v("farm_name"))}`} />)}
        <div className="form-grid-2">
          {field("city", "City", <input id="city" name="city" required maxLength={120} autoComplete="address-level2" defaultValue={v("city")} className={`field${filled(v("city"))}`} />)}
          {field(
            "state",
            "State",
            <select id="state" name="state" required defaultValue={floorValues?.state ?? props.defaults.state ?? ""} className={`field${(floorValues?.state ?? props.defaults.state ?? "") !== "" ? " field-filled" : ""}`}>
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
        {field("website", "Website or online shop", <input id="website" name="website" type="url" required maxLength={500} placeholder="https://" defaultValue={v("website")} className={`field${filled(v("website"))}`} />, "We use it to verify your business and to draft your profile for your review.")}
        {field(
          "business_phone",
          "Business phone",
          <input id="business_phone" name="business_phone" type="tel" required maxLength={32} inputMode="tel" defaultValue={v("business_phone")} className={`field field-narrow${filled(v("business_phone"))}`} />,
          "Your business’s public contact number, shown on your seller page. (Your account phone stays private.)",
        )}
        {field("about", "About your farm or company", <textarea id="about" name="about" required minLength={10} maxLength={2000} rows={4} defaultValue={v("about")} className={`field${filled(v("about"))}`} />, "A few sentences: what you sell, and where you are. If you grow your own seed, tell us about that too. Your About must be at least 10 characters long.")}
        {field("varieties", "Varieties you want listed", <textarea id="varieties" name="varieties" required maxLength={5000} rows={5} defaultValue={v("varieties")} className={`field${filled(v("varieties"))}`} />, "List one variety per line, e.g. “Zinnia — Queen Lime Blush”.")}
      </fieldset>

      <fieldset className="form-stack-tight">
        <legend className="form-legend">Contact</legend>
        {field("contact_name", "Contact name", <input id="contact_name" name="contact_name" required maxLength={120} defaultValue={floorValues?.contact_name ?? props.defaults.contactName} autoComplete="name" className={`field${((floorValues?.contact_name ?? props.defaults.contactName) !== "" ? " field-filled" : "")}`} />)}
        {field("contact_email", "Contact email", <input id="contact_email" name="contact_email" type="email" required maxLength={320} defaultValue={floorValues?.contact_email ?? props.defaults.contactEmail} autoComplete="email" className={`field${((floorValues?.contact_email ?? props.defaults.contactEmail) !== "" ? " field-filled" : "")}`} />)}
      </fieldset>

      <fieldset className="form-stack-tight">
        <legend className="form-legend">Online presence and more</legend>
        {field("gbp_url", opt("Google Business Profile link"), <input id="gbp_url" name="gbp_url" type="url" maxLength={500} defaultValue={v("gbp_url")} className={`field${filled(v("gbp_url"))}`} />)}
        {field("instagram_url", opt("Instagram"), <input id="instagram_url" name="instagram_url" type="url" maxLength={500} placeholder="https://instagram.com/…" defaultValue={v("instagram_url")} className={`field${filled(v("instagram_url"))}`} />)}
        {field("tiktok_url", opt("TikTok"), <input id="tiktok_url" name="tiktok_url" type="url" maxLength={500} placeholder="https://tiktok.com/@…" defaultValue={v("tiktok_url")} className={`field${filled(v("tiktok_url"))}`} />)}
        {field("facebook_url", opt("Facebook business page"), <input id="facebook_url" name="facebook_url" type="url" maxLength={500} placeholder="https://facebook.com/…" defaultValue={v("facebook_url")} className={`field${filled(v("facebook_url"))}`} />)}
        <fieldset className="form-field" aria-describedby={wholesaleError ? "wholesale-error" : undefined}>
          <legend className="form-label">
            Do you sell wholesale too? <span className="form-muted-inline">(optional)</span>
          </legend>
          {wholesaleError ? <FieldErrorLine id="wholesale-error" message={wholesaleError} /> : null}
          <div className="form-row">
            <label className="form-choice-row">
              <input type="radio" name="wholesale" id="wholesale-yes" value="yes" defaultChecked={floorValues?.wholesale === "yes"} /> Yes
            </label>
            <label className="form-choice-row">
              <input type="radio" name="wholesale" id="wholesale-no" value="no" defaultChecked={floorValues?.wholesale === "no"} /> No
            </label>
          </div>
        </fieldset>
        {field("notes", opt("Anything else"), <textarea id="notes" name="notes" maxLength={2000} rows={3} defaultValue={v("notes")} className={`field${filled(v("notes"))}`} />)}
      </fieldset>

      <div className="form-field">
        <div className="form-choice-row-top">
          <input id="authorized" name="authorized" type="checkbox" required defaultChecked={floorValues?.authorized ?? false} aria-invalid={authorizedError ? true : undefined} aria-describedby={authorizedError ? "authorized-error" : undefined} className="field-checkbox" />
          <label htmlFor="authorized" className="form-label-inline">
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
