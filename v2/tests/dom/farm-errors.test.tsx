// @vitest-environment jsdom
/**
 * Add Your Farm plain-language errors (Tranche 1.5; Quinn D6.1): the form used to render
 * the API's raw validator `detail` verbatim into its role="alert" line. It now maps every
 * /api/v1/farm-submissions failure through farmErrorMessage (report-form parity), so raw
 * validator text never reaches the page. These tests submit the real form against canned
 * API failures and read the rendered alert.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AddYourFarmForm } from "@/components/farm/AddYourFarmForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * The audit's empty-body detail string, verbatim: parseBody(FarmSubmissionSchema, {})
 * ("field: message; field: message", code validation_error). Regenerated from the repo's
 * own zod schema — paste matches parseBody output exactly.
 */
const EMPTY_BODY_DETAIL =
  "farm_name: Invalid input: expected string, received undefined; " +
  "contact_name: Invalid input: expected string, received undefined; " +
  "contact_email: enter a valid email address; " +
  "city: Invalid input: expected string, received undefined; " +
  "state: Invalid input: expected string, received undefined; " +
  "website: Invalid input: expected string, received undefined; " +
  "about: Invalid input: expected string, received undefined; " +
  "varieties: Invalid input: expected string, received undefined; " +
  "authorized: please confirm you own or represent this farm; " +
  "business_phone: Invalid input: expected string, received undefined";

const WEBSITE_DETAIL = "website: enter a full web address starting with https://; website: enter a full web address starting with https://";

function renderForm() {
  render(<AddYourFarmForm siteKey={null} states={[{ code: "CA", name: "California" }]} defaults={{ contactName: "", contactEmail: "", state: null }} />);
  return document.querySelector("form") as HTMLFormElement;
}

function mockFailure(status: number, code: string, detail: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ status, code, detail }), { status, headers: { "Content-Type": "application/problem+json" } })),
  );
}

async function submitAndReadAlert(form: HTMLFormElement): Promise<string> {
  fireEvent.submit(form);
  const alert = await screen.findByRole("alert");
  return alert.textContent ?? "";
}

describe("AddYourFarmForm plain-language errors", () => {
  it("website rule failure renders the plain website message, not validator text", async () => {
    const form = renderForm();
    // The audit's real-world case: a farm owner types www.myfarm.com (no scheme).
    const website = document.getElementById("website") as HTMLInputElement;
    fireEvent.change(website, { target: { value: "www.myfarm.com" } });
    mockFailure(400, "validation_error", WEBSITE_DETAIL);
    const text = await submitAndReadAlert(form);
    expect(text).toContain("https://www.myfarm.com");
    expect(text).not.toContain("enter a full web address");
    // Uncontrolled input is preserved on failure.
    expect((document.getElementById("website") as HTMLInputElement).value).toBe("www.myfarm.com");
  });

  it("missing-field failure renders that field's plain line", async () => {
    const form = renderForm();
    mockFailure(400, "validation_error", "contact_email: enter a valid email address");
    const text = await submitAndReadAlert(form);
    expect(text).toBe("Enter a valid email address.");
  });

  it("multi-field failure names the first field in plain words", async () => {
    const form = renderForm();
    mockFailure(400, "validation_error", EMPTY_BODY_DETAIL);
    const text = await submitAndReadAlert(form);
    expect(text).toBe("Enter your farm’s name.");
  });

  it("5xx renders the plain server-error line", async () => {
    const form = renderForm();
    mockFailure(500, "internal", "Internal error");
    const text = await submitAndReadAlert(form);
    expect(text).toBe("Something went wrong on our side. Please try again in a few minutes.");
  });

  it("network failure renders the plain connection line", async () => {
    const form = renderForm();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const text = await submitAndReadAlert(form);
    expect(text).toBe("Could not send. Check your connection and try again.");
  });

  it("sweep: no rendered message contains validator fragments or echoes raw detail", async () => {
    const cases: [string, number, string, string][] = [
      ["empty body (audit verbatim)", 400, "validation_error", EMPTY_BODY_DETAIL],
      ["website rule", 400, "validation_error", WEBSITE_DETAIL],
      ["single missing field", 400, "validation_error", "business_phone: Invalid input: expected string, received undefined"],
      ["optional URL rule", 400, "validation_error", "instagram_url: Invalid input"],
      ["turnstile refusal", 403, "turnstile_failed", "We couldn’t verify that you’re a person — please try again."],
      ["invalid state", 422, "invalid_state", "Choose the farm’s state from the list."],
      ["invalid phone", 422, "invalid_phone", "Enter the farm’s business phone as a 10-digit US number."],
      ["rate limited", 429, "rate_limited", "Too many requests"],
      ["server error", 500, "internal", "Internal error"],
      ["unrecognized code", 400, "invalid_json", "body must be JSON"],
    ];
    for (const [name, status, code, detail] of cases) {
      cleanup();
      const form = renderForm();
      mockFailure(status, code, detail);
      const text = await submitAndReadAlert(form);
      expect(text, name).not.toContain("Invalid input");
      expect(text, name).not.toContain("expected string");
      expect(text, name).not.toContain("received undefined");
      expect(text, name).not.toBe(detail);
      expect(text.length, name).toBeGreaterThan(0);
    }
  });
});
