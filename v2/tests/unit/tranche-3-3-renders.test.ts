/**
 * Tranche 3.3 — rendered output of the reworked components at rest (server markup): the
 * account-type presentation variant, the ZIP hint rule, CodeEntry's lifetime line and
 * association, and ReportForm's retired longhand. Each test fails on pre-build code for its
 * own reason: the base components render the old markup (all imported modules exist there).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CODE_TTL_MINUTES } from "@/lib/accounts";
import { CodeEntry } from "@/components/account/CodeEntry";
import { SignupFields } from "@/components/account/SignupFields";
import { ReportForm } from "@/components/report/ReportForm";

describe("3.3 — SignupFields presentation variant (D-8)", () => {
  it("renders account type as selectable cards in the create context", () => {
    const html = renderToStaticMarkup(createElement(SignupFields, { idPrefix: "create", variant: "cards" }));
    expect(html).toContain("field-option");
    expect(html).toContain("field-option-selected");
    expect(html).toContain("text-leaf");
  });

  it("renders account type as compact rows in waitlist contexts, with identical fields", () => {
    const cards = renderToStaticMarkup(createElement(SignupFields, { idPrefix: "create", variant: "cards" }));
    const rows = renderToStaticMarkup(createElement(SignupFields, { idPrefix: "waitlist", smsOptIn: true, variant: "rows" }));
    expect(rows).not.toContain("field-option");
    // Fields, names, values, and defaults unchanged between variants.
    for (const html of [cards, rows]) {
      expect(html).toContain('name="account_type"');
      expect(html).toContain('value="gardener"');
      expect(html).toContain('value="farm_owner"');
    }
    expect(cards.match(/checked=""/g)).toHaveLength(1);
    expect(rows.match(/checked=""/g)).toHaveLength(1);
    expect(cards).toContain('value="gardener"');
    // The SMS opt-in stays a compact row: no card dress, leaf accent only.
    expect(rows).toContain('name="sms_opt_in"');
  });

  it("states the 5-digit ZIP rule in the hint and renders error slots when fed", () => {
    const html = renderToStaticMarkup(createElement(SignupFields, { idPrefix: "create", variant: "cards", errors: { zip: "Enter your ZIP code as 5 digits." } }));
    expect(html).toContain("Enter it as a 5-digit ZIP code.");
    expect(html).toContain('id="create-zip-error"');
    expect(html).toContain("Enter your ZIP code as 5 digits.");
    expect(html).toMatch(/<input[^>]*id="create-zip"[^>]*aria-invalid="true"/);
    expect(html).toContain('aria-describedby="create-zip-hint create-zip-error"');
  });
});

describe("3.3 — CodeEntry rest state", () => {
  const html = renderToStaticMarkup(createElement(CodeEntry, { channel: "email", idPrefix: "t", onVerified: () => {} }));

  it("renders the lifetime line from the service constant in every context", () => {
    expect(html).toContain(`It works for ${CODE_TTL_MINUTES} minutes.`);
    expect(html).toContain('id="t-code-hint"');
    const phone = renderToStaticMarkup(createElement(CodeEntry, { channel: "phone", idPrefix: "p", onVerified: () => {} }));
    expect(phone).toContain(`It works for ${CODE_TTL_MINUTES} minutes.`);
  });

  it("associates hint-first with present-true-or-absent invalid, and keeps the code dress", () => {
    expect(html).toContain('aria-describedby="t-code-hint"');
    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain("maxlength");
    expect(html).not.toMatch(/pattern=/);
    expect(html).toContain("max-w-[11rem]");
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('autoComplete="one-time-code"');
  });
});

describe("3.3 — ReportForm rest state", () => {
  const html = renderToStaticMarkup(createElement(ReportForm, { type: "correct", targetType: "seller", targetRef: "songbird-seed-co", siteKey: null }));

  it("consumes .field on all four controls with no hand-rolled field string", () => {
    expect(html).not.toContain("rounded-field border border-line-strong bg-surface");
    expect(html).toMatch(/<select[^>]*id="target_type"[^>]*class="field"/);
    expect(html).toMatch(/<input[^>]*id="target_ref"[^>]*class="field"/);
    expect(html).toMatch(/<textarea[^>]*id="message"[^>]*class="field"/);
    expect(html).toMatch(/<input[^>]*id="contact"[^>]*class="field"/);
  });

  it("renders the intent group as selectable cards with the checked card selected", () => {
    expect(html).toContain("field-option");
    expect(html).toContain("field-option-selected");
    expect(html).toContain("What would you like to do?");
  });
});
