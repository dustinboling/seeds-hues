"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Turnstile } from "@/components/ui/Turnstile";
import { callApi } from "@/components/account/api";

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
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    setBusy(true);
    setError(null);
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
    setError(r.message);
    setReset((n) => n + 1);
  }

  if (done) {
    return (
      <div role="status" className="card mt-6 flex flex-col gap-2 p-4" data-testid="farm-thanks">
        <p className="text-lg font-semibold">Thank you — your farm is in our review queue.</p>
        <p>
          We review every farm by hand, usually within a few days, and we’ll email you at the contact address you gave. Nothing is published until we’ve checked it with you.
        </p>
        <p>
          <Link href="/seller">Browse the farms already listed</Link>
        </p>
      </div>
    );
  }

  const field = (id: string, label: ReactNode, input: ReactNode, hint?: string) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {input}
      {hint ? (
        <span id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
  const opt = (label: string) => (
    <>
      {label} <span className="font-normal text-muted">(optional)</span>
    </>
  );

  return (
    <form onSubmit={submit} className="mt-6 flex max-w-2xl flex-col gap-5" aria-label="Add your farm">
      <fieldset className="flex flex-col gap-4">
        <legend className="text-xl font-semibold">Your farm</legend>
        {field("farm_name", "Farm name", <input id="farm_name" name="farm_name" required maxLength={200} autoComplete="organization" className="field" />)}
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
        {field("website", "Website or online shop", <input id="website" name="website" type="url" required maxLength={500} placeholder="https://" aria-describedby="website-hint" className="field" />, "We use it to verify the farm and to draft your profile for your review.")}
        {field(
          "business_phone",
          "Business phone",
          <input id="business_phone" name="business_phone" type="tel" required maxLength={32} inputMode="tel" aria-describedby="business_phone-hint" className="field max-w-xs" />,
          "The farm’s public contact number, shown on your farm’s page. (Your account phone stays private.)",
        )}
        {field("about", "About your farm", <textarea id="about" name="about" required minLength={10} maxLength={2000} rows={4} aria-describedby="about-hint" className="field" />, "A few sentences: what you grow, how, and where.")}
        {field("varieties", "Varieties you want listed", <textarea id="varieties" name="varieties" required maxLength={5000} rows={5} aria-describedby="varieties-hint" className="field" />, "One per line, e.g. “Zinnia — Queen Lime Blush”.")}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-xl font-semibold">Contact</legend>
        {field("contact_name", "Contact name", <input id="contact_name" name="contact_name" required maxLength={120} defaultValue={props.defaults.contactName} autoComplete="name" className="field" />)}
        {field("contact_email", "Contact email", <input id="contact_email" name="contact_email" type="email" required maxLength={320} defaultValue={props.defaults.contactEmail} autoComplete="email" className="field" />)}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-xl font-semibold">Online presence and more</legend>
        {field("gbp_url", opt("Google Business Profile link"), <input id="gbp_url" name="gbp_url" type="url" maxLength={500} className="field" />)}
        {field("instagram_url", opt("Instagram"), <input id="instagram_url" name="instagram_url" type="url" maxLength={500} placeholder="https://instagram.com/…" className="field" />)}
        {field("tiktok_url", opt("TikTok"), <input id="tiktok_url" name="tiktok_url" type="url" maxLength={500} placeholder="https://tiktok.com/@…" className="field" />)}
        {field("facebook_url", opt("Facebook business page"), <input id="facebook_url" name="facebook_url" type="url" maxLength={500} placeholder="https://facebook.com/…" className="field" />)}
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-semibold">
            Do you sell wholesale too? <span className="font-normal text-muted">(optional)</span>
          </legend>
          <div className="flex gap-4">
            <label className="flex min-h-[44px] items-center gap-2">
              <input type="radio" name="wholesale" value="yes" /> Yes
            </label>
            <label className="flex min-h-[44px] items-center gap-2">
              <input type="radio" name="wholesale" value="no" /> No
            </label>
          </div>
        </fieldset>
        {field("notes", opt("Anything else"), <textarea id="notes" name="notes" maxLength={2000} rows={3} className="field" />)}
      </fieldset>

      <div className="flex items-start gap-2">
        <input id="authorized" name="authorized" type="checkbox" required className="mt-1 h-5 w-5" />
        <label htmlFor="authorized" className="font-medium">
          I own or am authorized to represent this farm
        </label>
      </div>

      <Turnstile siteKey={props.siteKey} onToken={setToken} resetKey={reset} action="add-your-farm" />
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send for review"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="font-medium text-warn">
          {error}
        </p>
      ) : null}
    </form>
  );
}
