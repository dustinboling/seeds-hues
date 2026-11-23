/**
 * Tranche 3.3 — account-form mapping layers (COPY-3-3 §3.1–§3.6 + §1): every code maps to its
 * sentence, unmapped codes render the mapped generic, and raw API detail never renders
 * (check 3.3-C). Fails on pre-build code: components/account/account-errors.ts does not exist.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALERT_PHONE_SUMMARY_HEADING,
  CHANGE_EMAIL_SUMMARY_HEADING,
  CREATE_SUMMARY_HEADING,
  SIGNIN_SUMMARY_HEADING,
  alertPhoneFailure,
  changeEmailFailure,
  codeFailure,
  createAccountFailure,
  deleteAccountFailure,
  signInFailure,
  type MappedFormFailure,
} from "@/components/account/account-errors";

const ROOT = process.cwd();

const messages = (m: MappedFormFailure) => [...m.fields.map((f) => f.message), ...(m.form === null ? [] : [m.form])];

describe("3.3 — create-account mapping (COPY-3-3 §3.1)", () => {
  it("maps every field code to its sentence", () => {
    expect(createAccountFailure(400, "validation_error", "name: enter your name")).toEqual({
      fields: [{ key: "name", message: "Enter your name." }],
      form: null,
    });
    expect(createAccountFailure(400, "validation_error", "email: enter a valid email address")).toEqual({
      fields: [{ key: "email", message: "Enter a valid email address." }],
      form: null,
    });
    expect(createAccountFailure(400, "validation_error", "phone: Invalid input")).toEqual({
      fields: [{ key: "phone", message: "Enter your phone number as a 10-digit US number." }],
      form: null,
    });
    expect(createAccountFailure(422, "invalid_phone", "Enter a 10-digit US phone number.")).toEqual({
      fields: [{ key: "phone", message: "Enter your phone number as a 10-digit US number." }],
      form: null,
    });
    expect(createAccountFailure(400, "validation_error", "zip: enter a 5-digit US ZIP code")).toEqual({
      fields: [{ key: "zip", message: "Enter your ZIP code as 5 digits." }],
      form: null,
    });
    expect(createAccountFailure(422, "unknown_zip", "We don’t recognise that ZIP code")).toEqual({
      fields: [{ key: "zip", message: "Your ZIP code isn't one we recognize — check the 5 digits and try again." }],
      form: null,
    });
    expect(createAccountFailure(409, "email_taken", "That email already has an account")).toEqual({
      fields: [{ key: "email", message: "That email already has an account — sign in with your email and phone number instead, or use a different email address." }],
      form: null,
    });
  });

  it("returns every failing field at once and falls back to the mapped generic, never raw detail", () => {
    const multi = createAccountFailure(400, "validation_error", "name: enter your name; zip: enter a 5-digit US ZIP code");
    expect(multi.fields.map((f) => f.key)).toEqual(["name", "zip"]);
    expect(createAccountFailure(403, "turnstile_failed", "Turnstile verification failed").form).toBe("The human check didn't pass — please complete it and try again.");
    expect(createAccountFailure(429, "rate_limited", "Too many requests").form).toBe("That's a lot of requests in a short time — please wait a minute and try again.");
    expect(createAccountFailure(0, "network", "fetch failed").form).toBe("Could not create your account. Check your connection and try again.");
    expect(createAccountFailure(500, "internal", "Internal error").form).toBe("Something went wrong on our side. Please try again in a few minutes.");
    expect(createAccountFailure(400, "invalid_json", "body must be JSON").form).toBe("We couldn't create your account. Please check the form and try again.");
    for (const [s, c, d] of [
      [400, "validation_error", "phone: Invalid input: expected string"],
      [422, "unknown_zip", "We don’t recognise that ZIP code"],
      [400, "invalid_json", "body must be JSON"],
    ] as const) {
      for (const m of messages(createAccountFailure(s, c, d))) expect(m).not.toContain(d);
    }
    expect(CREATE_SUMMARY_HEADING).toBe("Some fields need attention before creating your account.");
  });
});

describe("3.3 — sign-in mapping (COPY-3-3 §3.2)", () => {
  it("keeps format failures per-field and the credential failure pair-neutral and form-level", () => {
    expect(signInFailure(400, "validation_error", "email: enter a valid email address")).toEqual({
      fields: [{ key: "email", message: "Enter a valid email address." }],
      form: null,
    });
    expect(signInFailure(400, "validation_error", "phone: Invalid input")).toEqual({
      fields: [{ key: "phone", message: "Enter your phone number." }],
      form: null,
    });
    // The pair failure names neither half: identical whichever half is wrong.
    const pair = signInFailure(401, "no_match", "We couldn’t find that email + phone pair");
    expect(pair).toEqual({ fields: [], form: "We couldn't find an account with that email and phone number together — check both and try again." });
    expect(pair.form).not.toMatch(/email address|phone number as|which/i);
  });

  it("maps lockouts and shared failures, falling back to the mapped generic", () => {
    expect(signInFailure(429, "too_many_attempts", "Too many sign-in attempts").form).toBe("You've tried to sign in too many times — please wait a while and try again.");
    expect(signInFailure(403, "turnstile_failed", "nope").form).toBe("The human check didn't pass — please complete it and try again.");
    expect(signInFailure(429, "rate_limited", "nope").form).toBe("That's a lot of requests in a short time — please wait a minute and try again.");
    expect(signInFailure(0, "network", "nope").form).toBe("Could not sign you in. Check your connection and try again.");
    expect(signInFailure(500, "internal", "nope").form).toBe("Something went wrong on our side. Please try again in a few minutes.");
    expect(signInFailure(400, "invalid_json", "body must be JSON").form).toBe("We couldn't sign you in. Please check the form and try again.");
    expect(SIGNIN_SUMMARY_HEADING).toBe("Some fields need attention before signing in.");
  });
});

describe("3.3 — code mapping (COPY-3-3 §3.3)", () => {
  it("maps every verify and resend code to the code field's sentence", () => {
    const field = (message: string) => ({ fields: [{ key: "code", message }], form: null });
    expect(codeFailure(400, "validation_error", "code: enter the 6-digit code")).toEqual(field("Enter the 6-digit code."));
    expect(codeFailure(400, "code_incorrect", "That code isn’t right")).toEqual(field("That code isn't right — check it and try again."));
    expect(codeFailure(410, "code_expired", "expired")).toEqual(field("That code has expired — use “Send a new code” to get a fresh one."));
    expect(codeFailure(409, "code_dead", "dead")).toEqual(field("Too many wrong tries — that code no longer works. Use “Send a new code” to get a fresh one."));
    expect(codeFailure(409, "no_code", "none")).toEqual(field("There's no active code — use “Send a new code” to get one."));
    expect(codeFailure(429, "resend_too_soon", "soon")).toEqual(field("A code was just sent — wait a minute, then use “Send a new code” again."));
    expect(codeFailure(429, "resend_limit", "limit")).toEqual(field("That's the most codes we can send in an hour — please try again later."));
    expect(codeFailure(409, "no_alert_phone", "none")).toEqual(field("Add an alert number first, then ask for a code."));
  });

  it("keeps the service's tries-left count with the mapped sentence, and signed_out form-level", () => {
    expect(codeFailure(400, "code_incorrect", "That code isn’t right — check it and try again. (4 tries left)").fields[0]?.message).toBe(
      "That code isn't right — check it and try again. (4 tries left)",
    );
    expect(codeFailure(401, "signed_out", "Please sign in first")).toEqual({ fields: [], form: "You've signed out — sign in again, then enter the code." });
    expect(codeFailure(429, "rate_limited", "nope").fields[0]?.message).toBe("That's a lot of requests in a short time — please wait a minute and try again.");
    expect(codeFailure(0, "network", "nope").fields[0]?.message).toBe("Could not reach Seed Directory. Check your connection and try again.");
    expect(codeFailure(500, "internal", "nope").fields[0]?.message).toBe("Something went wrong on our side. Please try again in a few minutes.");
    expect(codeFailure(400, "invalid_json", "body must be JSON").fields[0]?.message).toBe("We couldn't complete that just now. Please try again.");
  });
});

describe("3.3 — account-panel mappings (COPY-3-3 §3.4–§3.6)", () => {
  it("maps change-email failures to the field or the form", () => {
    expect(changeEmailFailure(400, "validation_error", "email: enter a valid email address")).toEqual({
      fields: [{ key: "email", message: "Enter a valid email address." }],
      form: null,
    });
    expect(changeEmailFailure(409, "email_taken", "belongs to another account")).toEqual({
      fields: [{ key: "email", message: "That email already belongs to another account — use a different email address." }],
      form: null,
    });
    expect(changeEmailFailure(401, "signed_out", "nope").form).toBe("You've signed out — sign in again and try again.");
    expect(changeEmailFailure(429, "rate_limited", "nope").form).toBe("That's a lot of requests in a short time — please wait a minute and try again.");
    expect(changeEmailFailure(0, "network", "nope").form).toBe("Could not update your email. Check your connection and try again.");
    expect(changeEmailFailure(500, "internal", "nope").form).toBe("Something went wrong on our side. Please try again in a few minutes.");
    expect(changeEmailFailure(400, "invalid_json", "body must be JSON").form).toBe("We couldn't update your email. Please check the form and try again.");
    expect(CHANGE_EMAIL_SUMMARY_HEADING).toBe("Some fields need attention before updating.");
  });

  it("maps alert-phone failures to the field or the form", () => {
    expect(alertPhoneFailure(400, "validation_error", "alert_phone: Invalid input")).toEqual({
      fields: [{ key: "alert_phone", message: "Enter your alert number as a 10-digit US phone number." }],
      form: null,
    });
    expect(alertPhoneFailure(422, "invalid_phone", "nope")).toEqual({
      fields: [{ key: "alert_phone", message: "Enter your alert number as a 10-digit US phone number." }],
      form: null,
    });
    expect(alertPhoneFailure(401, "signed_out", "nope").form).toBe("You've signed out — sign in again and try again.");
    expect(alertPhoneFailure(0, "network", "nope").form).toBe("Could not save your text settings. Check your connection and try again.");
    expect(alertPhoneFailure(500, "internal", "nope").form).toBe("Something went wrong on our side. Please try again in a few minutes.");
    expect(alertPhoneFailure(400, "invalid_json", "body must be JSON").form).toBe("We couldn't save your text settings. Please check the form and try again.");
    expect(ALERT_PHONE_SUMMARY_HEADING).toBe("Some fields need attention before saving.");
  });

  it("maps a mistyped delete confirmation to the field and server failures to the form", () => {
    expect(deleteAccountFailure(400, "validation_error", 'confirm: Invalid input: expected "DELETE"')).toEqual({
      fields: [{ key: "confirm", message: "That confirmation doesn't match — type DELETE in capitals, exactly as shown, to confirm." }],
      form: null,
    });
    expect(deleteAccountFailure(401, "signed_out", "nope").form).toBe("You've signed out — sign in again and try again.");
    expect(deleteAccountFailure(500, "internal", "nope").form).toBe("We couldn't delete your account. Please try again in a few minutes.");
  });
});

describe("3.3 — every mapped sentence is Wren's verbatim (COPY-3-3.md)", () => {
  it("finds each account sentence byte-identical in the copy pack", () => {
    const pack = readFileSync(join(ROOT, "..", "backlog-2026-11-21", "tranche-3", "COPY-3-3.md"), "utf8");
    const sentences = [
      CREATE_SUMMARY_HEADING,
      SIGNIN_SUMMARY_HEADING,
      CHANGE_EMAIL_SUMMARY_HEADING,
      ALERT_PHONE_SUMMARY_HEADING,
      ...messages(createAccountFailure(400, "validation_error", "name: x; email: x; phone: x; zip: x")),
      ...messages(createAccountFailure(422, "unknown_zip", "x")),
      ...messages(createAccountFailure(409, "email_taken", "x")),
      ...messages(createAccountFailure(403, "turnstile_failed", "x")),
      ...messages(createAccountFailure(429, "rate_limited", "x")),
      ...messages(createAccountFailure(0, "network", "x")),
      ...messages(createAccountFailure(500, "internal", "x")),
      ...messages(createAccountFailure(400, "invalid_json", "x")),
      ...messages(signInFailure(400, "validation_error", "email: x; phone: x")),
      ...messages(signInFailure(401, "no_match", "x")),
      ...messages(signInFailure(429, "too_many_attempts", "x")),
      ...messages(signInFailure(400, "invalid_json", "x")),
      ...messages(codeFailure(400, "validation_error", "code: x")),
      ...messages(codeFailure(400, "code_incorrect", "x")),
      ...messages(codeFailure(410, "code_expired", "x")),
      ...messages(codeFailure(409, "code_dead", "x")),
      ...messages(codeFailure(409, "no_code", "x")),
      ...messages(codeFailure(429, "resend_too_soon", "x")),
      ...messages(codeFailure(429, "resend_limit", "x")),
      ...messages(codeFailure(409, "no_alert_phone", "x")),
      ...messages(codeFailure(401, "signed_out", "x")),
      ...messages(codeFailure(400, "invalid_json", "x")),
      ...messages(changeEmailFailure(409, "email_taken", "x")),
      ...messages(changeEmailFailure(400, "invalid_json", "x")),
      ...messages(alertPhoneFailure(400, "validation_error", "alert_phone: x")),
      ...messages(alertPhoneFailure(400, "invalid_json", "x")),
      ...messages(deleteAccountFailure(400, "validation_error", "confirm: x")),
      ...messages(deleteAccountFailure(500, "internal", "x")),
    ];
    expect(sentences.length).toBeGreaterThan(30);
    for (const sentence of sentences) expect(pack, JSON.stringify(sentence)).toContain(sentence);
  });
});
