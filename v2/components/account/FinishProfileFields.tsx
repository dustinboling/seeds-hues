"use client";

import { FieldErrorLine, syncFilledClass } from "@/components/ui/field-states";

/**
 * The finish-your-account step's deferred fields (Tranche 3.2, SPEC §3.2.5): name, ZIP, and
 * account type — and only those. Email and phone are never re-asked. One shared component for
 * the step's two homes (the waitlist block's success state and the account panel), so the
 * fields, names, values, defaults, and optionality are identical in both.
 *
 * Field-state set member: every field carries its error slot, the ZIP hint states the 5-digit
 * rule (SignupFields' sentence, verbatim), and account type renders as compact rows per the
 * §8.6 ruling (cards belong to the create context only).
 */
export type FinishProfileFieldErrors = { name?: string; zip?: string };

export function FinishProfileFields({ idPrefix, errors }: { idPrefix: string; errors?: FinishProfileFieldErrors }) {
  const id = (s: string) => `${idPrefix}-${s}`;
  const errorId = (field: string) => `${id(field)}-error`;

  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor={id("name")} className="text-sm font-semibold">
          Your name
        </label>
        <input
          id={id("name")}
          name="name"
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
        <label htmlFor={id("zip")} className="text-sm font-semibold">
          ZIP code
        </label>
        <input
          id={id("zip")}
          name="zip"
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
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Account type</legend>
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
    </>
  );
}

/** Read the deferred fields out of a form. */
export function profileBody(form: FormData) {
  return {
    name: String(form.get("name") ?? ""),
    zip: String(form.get("zip") ?? "").trim(),
    farm_owner: form.get("account_type") === "farm_owner",
  };
}
