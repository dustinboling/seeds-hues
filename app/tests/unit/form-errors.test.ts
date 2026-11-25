/**
 * Slice 6: the plain-language failure mappers, ported from v2's
 * report-errors, farm-errors, and account-errors (Tranche 1.5/3.3
 * wording, Wren's sentences verbatim). Every expectation is hardcoded
 * from the v2 modules — raw validator detail must never leak through.
 */
import { describe, expect, it } from "vitest";
import { reportFailure } from "../../src/components/report/report-errors";
import { farmFailure } from "../../src/components/farm/farm-errors";
import {
  alertPhoneFailure,
  changeEmailFailure,
  codeFailure,
  createAccountFailure,
  deleteAccountFailure,
  profileFailure,
  signInCodeFailure,
  signInFailure,
  waitlistJoinFailure,
} from "../../src/components/account/account-errors";

describe("reportFailure", () => {
  it("maps every failing field at once, never raw validator detail", () => {
    expect(reportFailure(400, "validation_error", "target_ref: a variety or seller slug; contact: enter a valid email address")).toEqual({
      fields: [
        { key: "target_ref", message: "Check the page address name — use the last part of the page’s URL, e.g. songbird-seed-co." },
        { key: "contact", message: "Please enter a valid email address so we can reply." },
      ],
      form: null,
    });
    // Unknown field names fall through to the form-level fallback.
    expect(reportFailure(400, "validation_error", "mystery: something")).toEqual({
      fields: [],
      form: "Some of the details didn’t look right — please check the form and try again.",
    });
  });

  it("attaches unknown_target to the page-address field; Turnstile/rate-limit/network are form-level", () => {
    expect(reportFailure(404, "unknown_target", "seller nope not found").fields).toEqual([
      {
        key: "target_ref",
        message: "We couldn’t find a page with that address name. Check the seller or variety and the spelling, then try again.",
      },
    ]);
    expect(reportFailure(403, "turnstile_failed", "Turnstile verification failed").form).toBe(
      "The human check didn’t pass — please complete it and try again.",
    );
    expect(reportFailure(429, "rate_limited", "Too many requests").form).toBe(
      "That’s a lot of requests in a short time — please wait a minute and try again.",
    );
    expect(reportFailure(0, "network", "Could not reach Seed Directory.")).toEqual({
      fields: [],
      form: "Could not send. Check your connection and try again.",
    });
    expect(reportFailure(500, "internal", "Internal error").form).toBe("Something went wrong on our side. Please try again in a few minutes.");
  });
});

describe("farmFailure", () => {
  it("maps every failing field at once with the Tranche 1.5 sentences", () => {
    const mapped = farmFailure(400, "validation_error", "farm_name: enter the farm's name; website: enter a full web address starting with https://");
    expect(mapped.fields).toEqual([
      { key: "farm_name", message: "Enter your farm’s name." },
      { key: "website", message: "Enter your full website address starting with https:// — for example https://www.myfarm.com." },
    ]);
    expect(mapped.form).toBeNull();
  });

  it("names the varieties format sibling and the state/phone codes", () => {
    expect(farmFailure(400, "validation_error", "varieties: expected array").fields).toEqual([
      { key: "varieties", message: "List your varieties one per line." },
    ]);
    expect(farmFailure(400, "validation_error", "varieties: list at least one variety").fields).toEqual([
      { key: "varieties", message: "List at least one variety you want listed." },
    ]);
    expect(farmFailure(422, "invalid_state", "Choose the farm's state from the list.").fields).toEqual([
      { key: "state", message: "Choose your farm’s state from the list." },
    ]);
    expect(farmFailure(422, "invalid_phone", "Enter the farm's business phone.").fields).toEqual([
      { key: "business_phone", message: "Enter your farm’s business phone as a 10-digit US number." },
    ]);
  });

  it("maps not_farm_owner instead of the misleading fallback; shared form-level outcomes", () => {
    expect(farmFailure(403, "not_farm_owner", "This page is only for the verified owner of this farm.").form).toContain("isn’t the verified owner");
    expect(farmFailure(403, "turnstile_failed", "x").form).toBe("The human check didn’t pass — please complete it and try again.");
    expect(farmFailure(429, "rate_limited", "x").form).toBe("That’s a lot of requests in a short time — please wait a minute and try again.");
    expect(farmFailure(0, "network", "x").form).toBe("Could not send. Check your connection and try again.");
  });
});

describe("signInFailure", () => {
  it("keeps the credential failure pair-neutral and formats per-field", () => {
    const pair = signInFailure(401, "no_match", "We couldn't find that email + phone pair");
    expect(pair.fields).toEqual([]);
    expect(pair.form).toBe("We couldn't find an account with that email and phone number together — check both and try again.");
    expect(signInFailure(400, "validation_error", "email: enter a valid email address").fields).toEqual([
      { key: "email", message: "Enter a valid email address." },
    ]);
    expect(signInFailure(429, "too_many_attempts", "Too many sign-in attempts.").form).toContain("too many times");
  });
});

describe("signInCodeFailure (§11.1)", () => {
  it("maps the phone-less path's outcomes onto the email field", () => {
    expect(signInCodeFailure(404, "no_account", "x").fields).toEqual([
      { key: "email", message: "We couldn't find an account with that email — check it and try again." },
    ]);
    expect(signInCodeFailure(409, "has_phone", "x").fields).toEqual([
      { key: "email", message: "This account has a phone number — sign in with your email and phone number instead." },
    ]);
    expect(signInCodeFailure(400, "validation_error", "email: enter a valid email address").fields).toEqual([
      { key: "email", message: "Enter a valid email address." },
    ]);
  });
});

describe("codeFailure", () => {
  it("maps code outcomes to the code field, carrying the tries-left count", () => {
    expect(codeFailure(400, "code_incorrect", "That code isn't right. (4 tries left)").fields).toEqual([
      { key: "code", message: "That code isn't right — check it and try again. (4 tries left)" },
    ]);
    expect(codeFailure(410, "code_expired", "x").fields[0]!.message).toContain("has expired");
    expect(codeFailure(409, "code_dead", "x").fields[0]!.message).toContain("no longer works");
    expect(codeFailure(409, "no_code", "x").fields[0]!.message).toContain("no active code");
    expect(codeFailure(401, "signed_out", "x")).toEqual({ fields: [], form: "You've signed out — sign in again, then enter the code." });
  });
});

describe("createAccountFailure / waitlistJoinFailure / profileFailure", () => {
  it("maps create outcomes per-field", () => {
    expect(createAccountFailure(409, "email_taken", "x").fields[0]).toMatchObject({ key: "email" });
    expect(createAccountFailure(409, "email_taken", "x").fields[0]!.message).toContain("already has an account");
    expect(createAccountFailure(422, "unknown_zip", "x").fields).toEqual([
      { key: "zip", message: "Your ZIP code isn't one we recognize — check the 5 digits and try again." },
    ]);
    expect(createAccountFailure(422, "invalid_phone", "x").fields).toEqual([
      { key: "phone", message: "Enter your phone number as a 10-digit US number." },
    ]);
  });

  it("passes the listed race through; maps join + profile fields", () => {
    const race = "Good news — Lonely Bloom is already listed by a seller. Reload the page to see where to buy it.";
    expect(waitlistJoinFailure(409, "already_listed", race)).toEqual({ fields: [], form: race });
    expect(waitlistJoinFailure(422, "invalid_phone", "x").fields).toEqual([
      { key: "phone", message: "Enter your phone number as a 10-digit US number." },
    ]);
    expect(profileFailure(422, "unknown_zip", "x").fields).toEqual([
      { key: "zip", message: "Your ZIP code isn't one we recognize — check the 5 digits and try again." },
    ]);
  });
});

describe("changeEmailFailure / alertPhoneFailure / deleteAccountFailure", () => {
  it("maps the panel forms per-field", () => {
    expect(changeEmailFailure(409, "email_taken", "x").fields).toEqual([
      { key: "email", message: "That email already belongs to another account — use a different email address." },
    ]);
    expect(alertPhoneFailure(422, "invalid_phone", "x").fields).toEqual([
      { key: "alert_phone", message: "Enter your alert number as a 10-digit US phone number." },
    ]);
    expect(deleteAccountFailure(400, "validation_error", "confirm: Invalid literal").fields).toEqual([
      { key: "confirm", message: "That confirmation doesn't match — type DELETE in capitals, exactly as shown, to confirm." },
    ]);
    expect(deleteAccountFailure(401, "signed_out", "x").form).toBe("You've signed out — sign in again and try again.");
  });
});
