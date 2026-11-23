// @vitest-environment jsdom
/**
 * Add Your Farm plain-language errors (Tranche 1.5; Quinn D6.1): the form used to render
 * the API's raw validator `detail` verbatim into its role="alert" line. It maps every
 * /api/v1/farm-submissions failure through farmFailure (report-form parity), so raw
 * validator text never reaches the page. Tranche 3.3 rebuilt the rendering around that
 * mapping: per-field messages beside their fields, a summary box for multi-error failures,
 * focus to the problem. These tests submit the real form against canned API failures and
 * read the rendered summary and inline lines.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

describe("AddYourFarmForm field-state errors", () => {
  it("website rule failure renders the plain website message inline, with focus on the field", async () => {
    const form = renderForm();
    // The audit's real-world case: a farm owner types www.myfarm.com (no scheme).
    const website = document.getElementById("website") as HTMLInputElement;
    fireEvent.change(website, { target: { value: "www.myfarm.com" } });
    mockFailure(400, "validation_error", WEBSITE_DETAIL);
    fireEvent.submit(form);
    const line = await screen.findByText("Enter your full website address starting with https:// — for example https://www.myfarm.com.");
    expect(line.closest("p")?.id).toBe("website-error");
    expect(website.getAttribute("aria-invalid")).toBe("true");
    expect(website.getAttribute("aria-describedby")).toBe("website-hint website-error");
    // A single error has no summary box; focus goes to the field.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.activeElement).toBe(website);
    // Uncontrolled input is preserved on failure.
    expect(website.value).toBe("www.myfarm.com");
  });

  it("missing-field failure renders that field's plain line and nothing else", async () => {
    const form = renderForm();
    mockFailure(400, "validation_error", "contact_email: enter a valid email address");
    fireEvent.submit(form);
    const line = await screen.findByText("Enter a valid email address.");
    expect(line.closest("p")?.id).toBe("contact_email-error");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.activeElement).toBe(document.getElementById("contact_email"));
  });

  it("multi-field failure renders every field's message at once, with a matching summary", async () => {
    const form = renderForm();
    mockFailure(400, "validation_error", EMPTY_BODY_DETAIL);
    fireEvent.submit(form);
    const summary = await screen.findByRole("alert");
    expect(within(summary).getByText("Some fields need attention before sending for review.")).toBeDefined();
    // Every failing field has an inline line, and each summary entry is character-identical.
    const entries = within(summary).getAllByRole("link");
    expect(entries.length).toBe(10);
    for (const entry of entries) {
      const href = entry.getAttribute("href") ?? "";
      expect(href.startsWith("#")).toBe(true);
      const field = document.getElementById(href.slice(1));
      expect(field, href).not.toBeNull();
      const described = (field?.getAttribute("aria-describedby") ?? "").split(" ");
      const errorId = described.find((id) => id.endsWith("-error"));
      expect(errorId, href).toBeDefined();
      expect(document.getElementById(errorId!)?.textContent).toBe(entry.textContent);
    }
    expect(document.getElementById("farm_name-error")?.textContent).toBe("Enter your farm’s name.");
    expect(document.activeElement).toBe(summary);
  });

  it("5xx renders the plain server-error line in a form-level box", async () => {
    const form = renderForm();
    mockFailure(500, "internal", "Internal error");
    fireEvent.submit(form);
    const summary = await screen.findByRole("alert");
    expect(summary.textContent).toBe("Something went wrong on our side. Please try again in a few minutes.");
    expect(document.activeElement).toBe(summary);
  });

  it("network failure renders the plain connection line in a form-level box", async () => {
    const form = renderForm();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    fireEvent.submit(form);
    const summary = await screen.findByRole("alert");
    expect(summary.textContent).toBe("Could not send. Check your connection and try again.");
  });

  it("not_farm_owner renders the mapped ownership message, not the misleading fallback", async () => {
    const form = renderForm();
    mockFailure(403, "not_farm_owner", "This page is only for the verified owner of this farm.");
    fireEvent.submit(form);
    const summary = await screen.findByRole("alert");
    expect(summary.textContent).toBe(
      "This account isn’t the verified owner of your farm — sign in with the farm owner’s account, or submit your farm through Add Your Farm and we’ll verify it in review.",
    );
  });

  it("About states both bounds; Varieties splits empty from format", async () => {
    const form = renderForm();
    mockFailure(400, "validation_error", "about: tell us a little about the farm; varieties: list at least one variety");
    fireEvent.submit(form);
    expect((await screen.findByText("Tell us a little about your farm (at least 10 characters, at most 2,000).")).closest("p")?.id).toBe("about-error");
    expect(screen.getByText("List at least one variety you want listed.").closest("p")?.id).toBe("varieties-error");
    cleanup();

    const form2 = renderForm();
    mockFailure(400, "validation_error", "varieties: Too big: expected string to have <=5000 characters");
    fireEvent.submit(form2);
    expect((await screen.findByText("List your varieties one per line.")).closest("p")?.id).toBe("varieties-error");
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
      ["not farm owner", 403, "not_farm_owner", "This page is only for the verified owner of this farm."],
      ["rate limited", 429, "rate_limited", "Too many requests"],
      ["server error", 500, "internal", "Internal error"],
      ["unrecognized code", 400, "invalid_json", "body must be JSON"],
    ];
    for (const [name, status, code, detail] of cases) {
      cleanup();
      const form = renderForm();
      mockFailure(status, code, detail);
      fireEvent.submit(form);
      // The whole rendered failure surface: summary box if one exists, plus every inline line.
      await waitFor(() => {
        if (document.querySelector('[role="alert"], .field-error') === null) throw new Error("waiting for the failure surface");
      });
      const alert = document.querySelector('[role="alert"]');
      const lines = [...document.querySelectorAll(".field-error")].map((el) => el.textContent ?? "");
      const text = [alert?.textContent ?? "", ...lines].join("\n");
      expect(text, name).not.toContain("Invalid input");
      expect(text, name).not.toContain("expected string");
      expect(text, name).not.toContain("received undefined");
      expect(text, name).not.toContain(detail);
      expect(text.length, name).toBeGreaterThan(0);
    }
  });
});
