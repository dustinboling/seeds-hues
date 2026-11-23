// @vitest-environment jsdom
/**
 * Tranche 3.3 — the public field-state set, driven in a real DOM: the CodeEntry association
 * and spaced-paste path, each form's mapping layer rendering (verbatim copy, generic fallback,
 * never raw detail), the pair-neutral sign-in failure, multi-field failures at once, the
 * delete-confirm rerouting, filled/selected states, and the busy discipline on the create and
 * waitlist forms (check 3.3-E). Each test fails on pre-build code for its own reason: the base
 * components render single raw role="alert" lines with no association, no summary, no lifetime
 * line, and maxLength/pattern blockers on the code field.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CODE_TTL_MINUTES } from "@/lib/accounts";
import type { AlertItem, PublicUser } from "@/lib/services/accounts";
import { CodeEntry } from "@/components/account/CodeEntry";
import { CreateAccountForm } from "@/components/account/CreateAccountForm";
import { SignInForm } from "@/components/account/SignInForm";
import { AccountPanel } from "@/components/account/AccountPanel";
import { ReportForm } from "@/components/report/ReportForm";
import { AddYourFarmForm } from "@/components/farm/AddYourFarmForm";
import { WaitlistBlock } from "@/components/variety/WaitlistBlock";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/" }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockFailure(status: number, code: string, detail: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ status, code, detail }), { status, headers: { "Content-Type": "application/problem+json" } })),
  );
}

function fieldInput(id: string): HTMLInputElement {
  return document.getElementById(id) as HTMLInputElement;
}

describe("3.3 — CodeEntry association, lifetime, and spaced paste", () => {
  it("renders the lifetime line from the constant and the hint-first association on failure", async () => {
    render(<CodeEntry channel="email" idPrefix="t" onVerified={() => {}} />);
    expect(screen.getByText(`It works for ${CODE_TTL_MINUTES} minutes.`).id).toBe("t-code-hint");
    const input = fieldInput("t-code");
    expect(input.getAttribute("aria-describedby")).toBe("t-code-hint");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    // The spaced-paste blockers are gone (each stopped a spaced paste before the strip ran).
    expect(input.hasAttribute("maxlength")).toBe(false);
    expect(input.getAttribute("pattern")).toBeNull();

    mockFailure(400, "code_incorrect", "That code isn’t right — check it and try again.");
    fireEvent.change(input, { target: { value: "000000" } });
    fireEvent.submit(input.closest("form")!);
    const line = await screen.findByText("That code isn't right — check it and try again.");
    expect(line.closest("p")?.id).toBe("t-code-error");
    expect(line.closest("p")?.className).toContain("field-error");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("t-code-hint t-code-error");
    expect(document.activeElement).toBe(input);
  });

  it("verifies a pasted spaced code whole: '123 456' submits as 123456", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
        seen.push(String(init?.body ?? ""));
        return new Response(JSON.stringify({ status: 400, code: "code_incorrect", detail: "nope" }), { status: 400 });
      }),
    );
    render(<CodeEntry channel="email" idPrefix="t" onVerified={() => {}} />);
    const input = fieldInput("t-code");
    fireEvent.change(input, { target: { value: "123 456" } });
    // Nothing truncates before the strip: the whole spaced form sits in the field.
    expect(input.value).toBe("123 456");
    fireEvent.submit(input.closest("form")!);
    await screen.findByText("That code isn't right — check it and try again.");
    expect(JSON.parse(seen[0] as string).code).toBe("123456");

    fireEvent.change(input, { target: { value: "1 2 3 4 5 6" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(seen.length).toBe(2));
    expect(JSON.parse(seen[1] as string).code).toBe("123456");
  });

  it("swaps the Verify label in flight and lands resend outcomes in the note slot", async () => {
    let resolve!: (v: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((r) => { resolve = r; })),
    );
    const onVerified = vi.fn();
    render(<CodeEntry channel="email" idPrefix="t" onVerified={onVerified} />);
    const input = fieldInput("t-code");
    fireEvent.change(input, { target: { value: "000000" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("button", { name: "Verifying…" })).toBeDefined();
    expect((screen.getByRole("button", { name: "Send a new code" }) as HTMLButtonElement).disabled).toBe(true);
    resolve(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    cleanup();

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { delivery: "sent" } }), { status: 200 })));
    render(<CodeEntry channel="email" idPrefix="t2" onVerified={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
    const note = await screen.findByRole("status");
    expect(note.textContent).toBe("We’ve emailed you a 6-digit code.");
  });
});

describe("3.3 — create-account form: summary, inline errors, generic fallback, busy", () => {
  it("shows per-field errors plus a matching summary on multi-field failure", async () => {
    render(<CreateAccountForm siteKey={null} />);
    fireEvent.change(fieldInput("create-email"), { target: { value: "kept@example.com" } });
    mockFailure(400, "validation_error", "name: enter your name; zip: enter a 5-digit US ZIP code");
    fireEvent.submit(document.querySelector("form")!);
    const summary = await screen.findByRole("alert");
    expect(within(summary).getByText("Some fields need attention before creating your account.")).toBeDefined();
    expect(within(summary).getAllByRole("link").map((e) => [e.getAttribute("href"), e.textContent])).toEqual([
      ["#create-name", "Enter your name."],
      ["#create-zip", "Enter your ZIP code as 5 digits."],
    ]);
    expect(document.getElementById("create-name-error")?.textContent).toBe("Enter your name.");
    expect(document.getElementById("create-zip-error")?.textContent).toBe("Enter your ZIP code as 5 digits.");
    expect(fieldInput("create-name").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(summary);
    // Entered data is never the price of an error.
    expect(fieldInput("create-email").value).toBe("kept@example.com");
  });

  it("shows a lone field error with no summary, and the mapped generic for unmapped codes", async () => {
    render(<CreateAccountForm siteKey={null} />);
    mockFailure(409, "email_taken", "That email already has a Seed Directory account");
    fireEvent.submit(document.querySelector("form")!);
    const line = await screen.findByText("That email already has an account — sign in with your email and phone number instead, or use a different email address.");
    expect(line.closest("p")?.id).toBe("create-email-error");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.activeElement).toBe(fieldInput("create-email"));
    cleanup();

    render(<CreateAccountForm siteKey={null} />);
    mockFailure(400, "invalid_json", "body must be JSON");
    fireEvent.submit(document.querySelector("form")!);
    const summary = await screen.findByRole("alert");
    expect(summary.textContent).toBe("We couldn't create your account. Please check the form and try again.");
    expect(summary.textContent).not.toContain("body must be JSON");
  });

  it("busy never strands: fields stay enabled, focus stays out of <body>, label swaps (3.3-E)", async () => {
    let resolve!: (v: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((r) => { resolve = r; })),
    );
    render(<CreateAccountForm siteKey={null} />);
    const name = fieldInput("create-name");
    name.focus();
    fireEvent.submit(document.querySelector("form")!);
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDefined();
    for (const id of ["create-name", "create-email", "create-phone", "create-zip"]) expect(fieldInput(id).disabled).toBe(false);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.querySelector("form")?.getAttribute("aria-busy")).toBe("true");
    resolve(new Response(JSON.stringify({ data: { verification: { email: "sent", phone: null }, next: "/account" } }), { status: 200 }));
    await screen.findByTestId("signup-code-step");
  });
});

describe("3.3 — sign-in stays pair-neutral", () => {
  const PAIR_MESSAGE = "We couldn't find an account with that email and phone number together — check both and try again.";

  it("renders one identical form-level message whichever half of the pair is wrong", async () => {
    for (const [email, phone] of [["wrong@example.com", "5550100"], ["right@example.com", "wrongphone"]]) {
      cleanup();
      render(<SignInForm siteKey={null} />);
      mockFailure(401, "no_match", "We couldn’t find that email + phone pair");
      fireEvent.change(fieldInput("signin-email"), { target: { value: email } });
      fireEvent.change(fieldInput("signin-phone"), { target: { value: phone } });
      fireEvent.submit(document.querySelector("form")!);
      const summary = await screen.findByRole("alert");
      expect(summary.textContent, `${email} / ${phone}`).toBe(PAIR_MESSAGE);
      expect(document.querySelectorAll(".field-error")).toHaveLength(0);
      expect(fieldInput("signin-email").hasAttribute("aria-invalid")).toBe(false);
      expect(fieldInput("signin-phone").hasAttribute("aria-invalid")).toBe(false);
    }
  });

  it("keeps a malformed email as a field error on Email only", async () => {
    render(<SignInForm siteKey={null} />);
    mockFailure(400, "validation_error", "email: enter a valid email address");
    fireEvent.submit(document.querySelector("form")!);
    const line = await screen.findByText("Enter a valid email address.");
    expect(line.closest("p")?.id).toBe("signin-email-error");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("3.3 — report form: multi-field failures, target placement, success panel", () => {
  it("returns every field's message at once with identical summary entries", async () => {
    render(<ReportForm type="correct" targetType="seller" targetRef="songbird-seed-co" siteKey={null} />);
    mockFailure(400, "validation_error", "message: Too small; contact: Invalid email address");
    fireEvent.submit(document.querySelector("form")!);
    const summary = await screen.findByRole("alert");
    expect(within(summary).getByText("Some fields need attention before sending.")).toBeDefined();
    expect(within(summary).getAllByRole("link").map((e) => e.textContent)).toEqual([
      "Please add a few words of detail (at least 5 characters, at most 4,000).",
      "Please enter a valid email address so we can reply.",
    ]);
    expect(document.getElementById("message-error")?.textContent).toBe("Please add a few words of detail (at least 5 characters, at most 4,000).");
    expect(document.activeElement).toBe(summary);
  });

  it("attaches unknown_target to the Page address name field", async () => {
    render(<ReportForm type="correct" targetType="seller" targetRef="nope" siteKey={null} />);
    mockFailure(404, "unknown_target", "seller nope not found");
    fireEvent.submit(document.querySelector("form")!);
    const line = await screen.findByText("We couldn’t find a page with that address name. Check the seller or variety and the spelling, then try again.");
    expect(line.closest("p")?.id).toBe("target_ref-error");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.activeElement).toBe(document.getElementById("target_ref"));
  });

  it("succeeds into a headed panel with the onward link to the reported page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 })));
    render(<ReportForm type="correct" targetType="seller" targetRef="songbird-seed-co" siteKey={null} />);
    fireEvent.submit(document.querySelector("form")!);
    const heading = await screen.findByText("Thank you — your request is in our review queue. We reply by email.");
    expect(heading.closest(".field-success")).not.toBeNull();
    expect(heading.closest("p")?.querySelector("svg")).not.toBeNull();
    const onward = screen.getByRole("link", { name: "Back to the seller page" });
    expect(onward.getAttribute("href")).toBe("/seller/songbird-seed-co");
    expect(document.activeElement).toBe(heading);
  });
});

const PANEL_USER: PublicUser = {
  name: "Test Gardener",
  email: "t@example.com",
  phone: "5555550100",
  phone_display: "(555) 555-0100",
  usda_zone: "8b",
  email_verified: true,
  notify_opt_out: false,
  farm_owner_declared: false,
  is_farm_owner: false,
  alert_phone: null,
  alert_phone_display: null,
  alert_phone_verified: false,
  sms_opt_in: false,
};

describe("3.3 — account panel: inline field errors and the delete rerouting", () => {
  it("renders change-email failures inline with the hint kept first in describedby", async () => {
    render(<AccountPanel user={PANEL_USER} alerts={[]} />);
    mockFailure(409, "email_taken", "That email already belongs to another account.");
    const input = fieldInput("change-email");
    fireEvent.change(input, { target: { value: "taken@example.com" } });
    fireEvent.submit(input.closest("form")!);
    const line = await screen.findByText("That email already belongs to another account — use a different email address.");
    expect(line.closest("p")?.id).toBe("change-email-error");
    expect(input.getAttribute("aria-describedby")).toBe("change-email-hint change-email-error");
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders a mistyped delete confirmation as a field error with focus, panel-head silent", async () => {
    render(<AccountPanel user={PANEL_USER} alerts={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    const input = fieldInput("delete-confirm");
    fireEvent.change(input, { target: { value: "delete" } });
    mockFailure(400, "validation_error", 'confirm: Invalid input: expected "DELETE"');
    fireEvent.submit(input.closest("form")!);
    const line = await screen.findByText("That confirmation doesn't match — type DELETE in capitals, exactly as shown, to confirm.");
    expect(line.closest("p")?.id).toBe("delete-confirm-error");
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders delete server failures in a box inside the delete form", async () => {
    render(<AccountPanel user={PANEL_USER} alerts={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    const form = fieldInput("delete-confirm").closest("form")!;
    fireEvent.change(fieldInput("delete-confirm"), { target: { value: "DELETE" } });
    mockFailure(500, "internal", "Internal error");
    fireEvent.submit(form);
    const summary = await screen.findByRole("alert");
    expect(summary.textContent).toBe("We couldn't delete your account. Please try again in a few minutes.");
    expect(form.contains(summary)).toBe(true);
  });

  it("keeps non-field feedback on the panel-head line", async () => {
    const alerts: AlertItem[] = [{ variety: { slug: "sunset", name: "Sunset", crop: "Zinnia" }, joined_at: "2026-01-01", notified_at: null, status: { state: "waiting", channels: ["email"] } }];
    render(<AccountPanel user={PANEL_USER} alerts={alerts} />);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 })));
    fireEvent.click(screen.getByRole("button", { name: /Leave list\s*for Sunset/ }));
    const note = await screen.findByRole("status");
    expect(note.textContent).toBe("You’ve left the waiting list for Sunset.");
    expect(note.closest("form")).toBeNull();
  });
});

describe("3.3 — filled and selected states", () => {
  it("tracks filled on entry and renders prefilled contact fields filled at rest", () => {
    render(<CreateAccountForm siteKey={null} />);
    const name = fieldInput("create-name");
    expect(name.classList.contains("field-filled")).toBe(false);
    fireEvent.change(name, { target: { value: "Jo" } });
    expect(name.classList.contains("field-filled")).toBe(true);
    fireEvent.blur(name);
    expect(name.classList.contains("field-filled")).toBe(true);
    fireEvent.change(name, { target: { value: "" } });
    expect(name.classList.contains("field-filled")).toBe(false);
    cleanup();

    render(<AddYourFarmForm siteKey={null} states={[{ code: "CA", name: "California" }]} defaults={{ contactName: "Jo", contactEmail: "jo@farm.com", state: null }} />);
    expect(fieldInput("contact_name").classList.contains("field-filled")).toBe(true);
    expect(fieldInput("contact_email").classList.contains("field-filled")).toBe(true);
    expect(fieldInput("farm_name").classList.contains("field-filled")).toBe(false);
  });

  it("moves the selected card dress with the account-type choice, values unchanged", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
        seen.push(String(init?.body ?? ""));
        return new Response(JSON.stringify({ data: { verification: { email: "sent", phone: null }, next: "/account" } }), { status: 200 });
      }),
    );
    render(<CreateAccountForm siteKey={null} />);
    const gardenerCard = fieldInput("create-account-type-gardener").closest("label")!;
    expect(gardenerCard.className).toContain("field-option-selected");
    const farmRadio = fieldInput("create-account-type-farm-owner");
    fireEvent.click(farmRadio);
    expect(farmRadio.closest("label")!.className).toContain("field-option-selected");
    expect(gardenerCard.className).not.toContain("field-option-selected");
    fireEvent.submit(document.querySelector("form")!);
    await screen.findByTestId("signup-code-step");
    // Same names, values, and body shape the rows submitted.
    expect(JSON.parse(seen[0] as string).farm_owner).toBe(true);
  });
});

describe("3.3 — waitlist busy discipline on the current form (3.3-E)", () => {
  it("disables only the submit, keeps fields live and focus out of <body>", async () => {
    const status = { signed_in: false, variety: { slug: "sunset", name: "Sunset", listed: false }, on_list: false, turnstile_site_key: null };
    let resolvePost!: (v: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).includes("/waitlist?")) return new Response(JSON.stringify({ data: status }), { status: 200 });
        return new Promise<Response>((r) => { resolvePost = r; });
      }),
    );
    render(<WaitlistBlock varietySlug="sunset" varietyName="Sunset" />);
    // The floor renders first; the human-check note marks the enhanced alert step's arrival.
    await screen.findByText(/The human check isn’t set up on this server yet/);
    fireEvent.click(fieldInput("waitlist-channel-sms"));
    const email = fieldInput("waitlist-email");
    email.focus();
    fireEvent.submit(email.closest("form")!);
    expect(await screen.findByRole("button", { name: "Joining…" })).toBeDefined();
    expect(email.disabled).toBe(false);
    expect(fieldInput("waitlist-phone").disabled).toBe(false);
    expect(document.activeElement).not.toBe(document.body);
    resolvePost(new Response(JSON.stringify({ status: 400, code: "invalid_json", detail: "body must be JSON" }), { status: 400 }));
    await screen.findByRole("alert");
  });
});
