"use client";

import { useState } from "react";
import { FieldErrorLine, syncFilledClass } from "@/components/ui/field-states";

/**
 * The signup fields (USER-ACCOUNTS-DESIGN header decisions + brief #3 addendum 7): name, email,
 * phone, ZIP (required), the farm-owner declaration and — on waiting-list forms — the unchecked
 * SMS opt-in with its consent copy. Plain labelled inputs; the parent form reads FormData.
 *
 * Field-state set member (Tranche 3.3): every field carries its error slot, the ZIP hint states
 * the 5-digit rule, and the account-type group renders in two presentation variants — selectable
 * cards in the create-account context, compact rows in waitlist contexts (fields, names, values,
 * and defaults unchanged between them).
 */
export const SMS_CONSENT =
  "Message frequency varies (one text per variety when it’s found). Msg & data rates may apply. Reply STOP to end, HELP for help. Consent is not a condition of purchase.";

export type SignupFieldErrors = { name?: string; email?: string; phone?: string; zip?: string };

export function SignupFields({
  idPrefix,
  smsOptIn = false,
  farmOwner = true,
  variant = "rows",
  errors,
  accountTypeError,
}: {
  idPrefix: string;
  smsOptIn?: boolean;
  farmOwner?: boolean;
  /** Cards in the create-account context, compact rows in waitlist contexts. */
  variant?: "cards" | "rows";
  errors?: SignupFieldErrors;
  accountTypeError?: string;
}) {
  const id = (s: string) => `${idPrefix}-${s}`;
  const [choice, setChoice] = useState<"gardener" | "farm_owner">("gardener");
  const groupErrorId = `${idPrefix}-account-type-error`;
  const errorId = (field: string) => `${id(field)}-error`;

  const accountTypeGroup =
    variant === "cards" ? (
      <fieldset className="flex flex-col gap-2" aria-describedby={accountTypeError ? groupErrorId : undefined}>
        <legend className="text-sm font-semibold">Account type</legend>
        {accountTypeError ? <FieldErrorLine id={groupErrorId} message={accountTypeError} /> : null}
        <label className={`card field-option flex cursor-pointer items-start gap-3 p-3${choice === "gardener" ? " field-option-selected" : ""}`}>
          <input type="radio" name="account_type" value="gardener" id={id("account-type-gardener")} checked={choice === "gardener"} onChange={() => setChoice("gardener")} className="mt-1" />
          <span>
            <span className={choice === "gardener" ? "block font-semibold text-leaf" : "block font-medium"}>I’m a gardener</span>
          </span>
        </label>
        <label className={`card field-option flex cursor-pointer items-start gap-3 p-3${choice === "farm_owner" ? " field-option-selected" : ""}`}>
          <input type="radio" name="account_type" value="farm_owner" id={id("account-type-farm-owner")} checked={choice === "farm_owner"} onChange={() => setChoice("farm_owner")} className="mt-1" />
          <span>
            <span className={choice === "farm_owner" ? "block font-semibold text-leaf" : "block font-medium"}>I’m a farm owner</span>
            <span className="block text-sm text-muted">Your account is ready to use right away. Farm-owner tools unlock after we review your farm — we’ll email you when it’s approved.</span>
          </span>
        </label>
      </fieldset>
    ) : (
      <fieldset className="flex flex-col gap-2" aria-describedby={accountTypeError ? groupErrorId : undefined}>
        <legend className="text-sm font-semibold">Account type</legend>
        {accountTypeError ? <FieldErrorLine id={groupErrorId} message={accountTypeError} /> : null}
        <label className="flex min-h-target items-center gap-2">
          <input type="radio" name="account_type" value="gardener" id={id("account-type-gardener")} defaultChecked />
          <span>I’m a gardener</span>
        </label>
        <label className="flex min-h-target items-start gap-2">
          <input type="radio" name="account_type" value="farm_owner" id={id("account-type-farm-owner")} className="mt-1" />
          <span>
            I’m a farm owner
            <span className="block text-sm text-muted">
              Your account is ready to use right away. Farm-owner tools unlock after we review your farm — we’ll email you when it’s approved.
            </span>
          </span>
        </label>
      </fieldset>
    );

  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor={id("name")} className="text-sm font-semibold">
          Your name
        </label>
        <input
          id={id("name")}
          name="name"
          required
          maxLength={120}
          autoComplete="name"
          aria-invalid={errors?.name ? true : undefined}
          aria-describedby={errors?.name ? errorId("name") : undefined}
          onBlur={syncFilledClass}
          onChange={syncFilledClass}
          className="field"
        />
        {errors?.name ? <FieldErrorLine id={errorId("name")} message={errors.name} /> : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id("email")} className="text-sm font-semibold">
          Email
        </label>
        <input
          id={id("email")}
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          aria-invalid={errors?.email ? true : undefined}
          aria-describedby={errors?.email ? errorId("email") : undefined}
          onBlur={syncFilledClass}
          onChange={syncFilledClass}
          className="field"
        />
        {errors?.email ? <FieldErrorLine id={errorId("email")} message={errors.email} /> : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id("phone")} className="text-sm font-semibold">
          Phone number
        </label>
        <input
          id={id("phone")}
          name="phone"
          type="tel"
          required
          maxLength={32}
          autoComplete="tel-national"
          inputMode="tel"
          aria-invalid={errors?.phone ? true : undefined}
          aria-describedby={errors?.phone ? `${id("phone-hint")} ${errorId("phone")}` : id("phone-hint")}
          onBlur={syncFilledClass}
          onChange={syncFilledClass}
          className="field"
        />
        <span id={id("phone-hint")} className="field-hint text-sm">
          US number. Your email + phone are how you sign in — there’s no password. We never show your phone number.
        </span>
        {errors?.phone ? <FieldErrorLine id={errorId("phone")} message={errors.phone} /> : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id("zip")} className="text-sm font-semibold">
          ZIP code
        </label>
        <input
          id={id("zip")}
          name="zip"
          required
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          autoComplete="postal-code"
          aria-invalid={errors?.zip ? true : undefined}
          aria-describedby={errors?.zip ? `${id("zip-hint")} ${errorId("zip")}` : id("zip-hint")}
          onBlur={syncFilledClass}
          onChange={syncFilledClass}
          className="field max-w-[10rem]"
        />
        <span id={id("zip-hint")} className="field-hint text-sm">
          Sets your USDA growing zone. Your ZIP stays private; only the zone is shown, to you. Enter it as a 5-digit ZIP code.
        </span>
        {errors?.zip ? <FieldErrorLine id={errorId("zip")} message={errors.zip} /> : null}
      </div>
      {farmOwner ? accountTypeGroup : null}
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
