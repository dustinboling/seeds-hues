/**
 * The signup fields (USER-ACCOUNTS-DESIGN header decisions + brief #3 addendum 7): name, email,
 * phone, ZIP (required), the farm-owner declaration and — on waiting-list forms — the unchecked
 * SMS opt-in with its consent copy. Plain labelled inputs; the parent form reads FormData.
 */
export const SMS_CONSENT =
  "Message frequency varies (one text per variety when it’s found). Msg & data rates may apply. Reply STOP to end, HELP for help. Consent is not a condition of purchase.";

export function SignupFields({ idPrefix, smsOptIn = false, farmOwner = true }: { idPrefix: string; smsOptIn?: boolean; farmOwner?: boolean }) {
  const id = (s: string) => `${idPrefix}-${s}`;
  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor={id("name")} className="text-sm font-semibold">
          Your name
        </label>
        <input id={id("name")} name="name" required maxLength={120} autoComplete="name" className="field" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id("email")} className="text-sm font-semibold">
          Email
        </label>
        <input id={id("email")} name="email" type="email" required maxLength={320} autoComplete="email" className="field" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id("phone")} className="text-sm font-semibold">
          Phone number
        </label>
        <input id={id("phone")} name="phone" type="tel" required maxLength={32} autoComplete="tel-national" inputMode="tel" aria-describedby={id("phone-hint")} className="field" />
        <span id={id("phone-hint")} className="text-sm text-muted">
          US number. Your email + phone are how you sign in — there’s no password. We never show your phone number.
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id("zip")} className="text-sm font-semibold">
          ZIP code
        </label>
        <input id={id("zip")} name="zip" required inputMode="numeric" pattern="\d{5}" maxLength={5} autoComplete="postal-code" aria-describedby={id("zip-hint")} className="field max-w-[10rem]" />
        <span id={id("zip-hint")} className="text-sm text-muted">
          Sets your USDA growing zone. Your ZIP stays private; only the zone is shown, to you.
        </span>
      </div>
      {farmOwner ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">Account type</legend>
          <label className="flex min-h-[44px] items-center gap-2">
            <input type="radio" name="account_type" value="gardener" defaultChecked />
            <span>I’m a gardener</span>
          </label>
          <label className="flex min-h-[44px] items-start gap-2">
            <input type="radio" name="account_type" value="farm_owner" className="mt-1" />
            <span>
              I’m a farm owner
              <span className="block text-sm text-muted">
                Your account is ready to use right away. Farm-owner tools unlock after we review your farm — we’ll email you when it’s approved.
              </span>
            </span>
          </label>
        </fieldset>
      ) : null}
      {smsOptIn ? (
        <div className="flex items-start gap-2">
          <input id={id("sms")} name="sms_opt_in" type="checkbox" className="mt-1 h-5 w-5" aria-describedby={id("sms-consent")} />
          <label htmlFor={id("sms")}>
            <span className="font-medium">Text me when this variety is found</span>
            <span id={id("sms-consent")} className="block text-sm text-muted">
              We’ll text the phone number above (after a one-time code to confirm it). {SMS_CONSENT}
            </span>
          </label>
        </div>
      ) : null}
    </>
  );
}

/** Read the signup fields out of a form. */
export function signupBody(form: FormData) {
  return {
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? "").trim(),
    phone: String(form.get("phone") ?? ""),
    zip: String(form.get("zip") ?? "").trim(),
    farm_owner: form.get("account_type") === "farm_owner",
    sms_opt_in: form.get("sms_opt_in") === "on",
  };
}
