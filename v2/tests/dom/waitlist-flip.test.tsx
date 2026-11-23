// @vitest-environment jsdom
/**
 * Tranche 3.2 — the waitlist flip, driven in a real DOM: the alert step's shape (email +
 * channel, nothing else), the text-channel reveal discipline, the recognized-contact in-place
 * transition, the finish-your-account step in both homes, the floor-first render with its
 * failed-fetch note, and the /account email-code accommodation. Each test fails on pre-build
 * code: the base block renders the full SignupFields wall with the "Sign in, then come back"
 * line and a loading skeleton, has no recognized/finish/floor states, and the base sign-in
 * form has no code path.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AlertItem, PublicUser } from "@/lib/services/accounts";
import { WaitlistBlock } from "@/components/variety/WaitlistBlock";
import { SignInForm } from "@/components/account/SignInForm";
import { AccountPanel } from "@/components/account/AccountPanel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/" }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SIGNED_OUT = { signed_in: false, variety: { slug: "sunset", name: "Sunset", listed: false }, on_list: false, turnstile_site_key: null };
const ON_LIST = (over: Record<string, unknown> = {}) => ({
  signed_in: true,
  variety: { slug: "sunset", name: "Sunset", listed: false },
  on_list: true,
  user: { name: "", email_verified: false, sms_opt_in: false, alert_phone_verified: false, profile_complete: false },
  channels: [],
  held: ["Verify your email (enter the 6-digit code we emailed you)"],
  turnstile_site_key: null,
  ...over,
});

function fieldInput(id: string): HTMLInputElement {
  return document.getElementById(id) as HTMLInputElement;
}

function mockApi(impl: (url: string, init?: RequestInit) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => new Response(JSON.stringify(impl(String(url), init)), { status: 200 })),
  );
}

describe("3.2 — the alert step (email + channel, nothing else)", () => {
  it("asks email + channel choice and no name/ZIP/account type; text reveals phone without moving focus", async () => {
    mockApi((url) => (url.includes("/waitlist?") ? { data: SIGNED_OUT } : {}));
    render(<WaitlistBlock varietySlug="sunset" varietyName="Sunset" />);
    await screen.findByText(/The human check isn’t set up on this server yet/);
    expect(fieldInput("waitlist-email")).toBeDefined();
    const group = document.querySelector("fieldset legend");
    expect(group?.textContent).toBe("How should we tell you?");
    expect(fieldInput("waitlist-channel-email").checked).toBe(true);
    expect(fieldInput("waitlist-channel-sms").checked).toBe(false);
    expect(screen.getByRole("button", { name: "Join the waiting list" })).toBeDefined();
    // The wall is gone.
    expect(document.getElementById("waitlist-name")).toBeNull();
    expect(document.getElementById("waitlist-zip")).toBeNull();
    expect(document.getElementById("waitlist-account-type-gardener")).toBeNull();
    expect(document.getElementById("waitlist-phone")).toBeNull();
    expect(screen.queryByText(/then come back/)).toBeNull();
    // Choosing text reveals the phone field; focus stays on the radio just chosen.
    const sms = fieldInput("waitlist-channel-sms");
    sms.focus();
    fireEvent.click(sms);
    const phone = fieldInput("waitlist-phone");
    expect(phone.required).toBe(true);
    expect(document.activeElement).toBe(sms);
    expect(phone.getAttribute("aria-describedby")).toBe("waitlist-phone-hint");
    // Switching back hides it.
    fireEvent.click(fieldInput("waitlist-channel-email"));
    expect(document.getElementById("waitlist-phone")).toBeNull();
  });

  it("the channel choice carries the sign-in explanation and the SMS consent (no opt-in checkbox)", async () => {
    mockApi((url) => (url.includes("/waitlist?") ? { data: SIGNED_OUT } : {}));
    render(<WaitlistBlock varietySlug="sunset" varietyName="Sunset" />);
    await screen.findByText(/The human check isn’t set up on this server yet/);
    fireEvent.click(fieldInput("waitlist-channel-sms"));
    expect(screen.getByText(/Your email \+ phone are how you sign in/)).toBeDefined();
    expect(screen.getByText(/Reply STOP to end, HELP for help/)).toBeDefined();
    expect(document.querySelector('input[name="sms_opt_in"]')).toBeNull();
  });
});

describe("3.2 — recognized contact verifies inline (never an error, never a link away)", () => {
  it("transitions in place to the code state with §3.2.4's copy and the shared CodeEntry", async () => {
    mockApi((url, init) => {
      if (url.includes("/waitlist?")) return { data: SIGNED_OUT };
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body).toMatchObject({ email: "ada@example.com", sms_opt_in: false, join_variety: "sunset" });
      expect(body).not.toHaveProperty("phone");
      return { data: { recognized: true, email: "ada@example.com", delivery: "sent" } };
    });
    render(<WaitlistBlock varietySlug="sunset" varietyName="Sunset" />);
    await screen.findByText(/The human check isn’t set up on this server yet/);
    fireEvent.change(fieldInput("waitlist-email"), { target: { value: "ada@example.com" } });
    fireEvent.submit(fieldInput("waitlist-email").closest("form")!);
    const copy = await screen.findByText("This email already has an account — we've sent a 6-digit code to ada@example.com. Enter it to join this waiting list.");
    expect(copy).toBeDefined();
    // The shared CodeEntry, in-block: label, lifetime line, resend — and focus on the heading.
    expect(screen.getByLabelText("6-digit code from your email")).toBeDefined();
    expect(screen.getByText(/It works for 30 minutes/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Send a new code" })).toBeDefined();
    expect(document.activeElement?.id).toBe("waitlist-code-title");
    // No error wording anywhere, and no link away to /account.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/then come back/)).toBeNull();
    for (const a of document.querySelectorAll("a")) expect(a.getAttribute("href")).not.toBe("/account");
  });
});

describe("3.2 — the finish-your-account step (in the success state, below the alert status)", () => {
  it("offers name/ZIP/type, never re-asks contact, and dismissal leaves the alert fully active", async () => {
    mockApi((url) => (url.includes("/waitlist?") ? { data: ON_LIST() } : {}));
    render(<WaitlistBlock varietySlug="sunset" varietyName="Sunset" />);
    await screen.findByText("Want to finish your account? A name and ZIP set your growing zone — you can do this any time, or not at all.");
    expect(fieldInput("waitlist-finish-name")).toBeDefined();
    expect(fieldInput("waitlist-finish-zip")).toBeDefined();
    expect(fieldInput("waitlist-finish-account-type-gardener")).toBeDefined();
    // Email and phone are never re-asked.
    expect(document.querySelector("#waitlist-block input[name='email']")).toBeNull();
    expect(document.querySelector("#waitlist-block input[name='phone']")).toBeNull();
    // The step sits below the alert status, inside the next-step card — never interleaved.
    const card = screen.getByText("One last step so your alerts can reach you").closest("section")!;
    expect(card.textContent).toContain("Finish your account");
    expect(card.innerHTML.indexOf("Leave the waiting list")).toBeLessThan(card.innerHTML.indexOf("Finish your account"));
    // Dismissing changes nothing about the alert.
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByText(/Want to finish your account/)).toBeNull();
    expect(screen.getByRole("heading", { name: "You’re on the waiting list for Sunset — glad to have you here." })).toBeDefined();
    expect(screen.getByRole("button", { name: "Leave the waiting list" })).toBeDefined();
  });

  it("saving posts the deferred profile and confirms without leaving the page", async () => {
    const seen: unknown[] = [];
    mockApi((url, init) => {
      if (url.includes("/waitlist?")) return { data: ON_LIST() };
      if (url.includes("/account/profile")) {
        seen.push(JSON.parse(String(init?.body ?? "{}")));
        return { data: { user: {} } };
      }
      return {};
    });
    render(<WaitlistBlock varietySlug="sunset" varietyName="Sunset" />);
    await screen.findByText(/Want to finish your account/);
    fireEvent.change(fieldInput("waitlist-finish-name"), { target: { value: "Ada R" } });
    fireEvent.change(fieldInput("waitlist-finish-zip"), { target: { value: "97448" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Your account details are saved.");
    expect(seen).toEqual([{ name: "Ada R", zip: "97448", farm_owner: false }]);
  });

  it("stays hidden for profile-complete accounts", async () => {
    mockApi((url) =>
      url.includes("/waitlist?") ? { data: ON_LIST({ user: { name: "Ann", email_verified: true, sms_opt_in: false, alert_phone_verified: false, profile_complete: true } }) } : {},
    );
    render(<WaitlistBlock varietySlug="sunset" varietyName="Sunset" />);
    await screen.findByRole("heading", { name: "You’re on the waiting list for Sunset — glad to have you here." });
    expect(screen.queryByText(/Want to finish your account/)).toBeNull();
  });
});

describe("3.2 — the floor renders first (no skeleton, failed fetch keeps the form)", () => {
  it("server-renders the real plain form: action posting, phone visible and never required", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Promise<Response>(() => {})));
    const { container } = render(<WaitlistBlock varietySlug="sunset" varietyName="Sunset" />);
    const form = container.querySelector('form[action="/api/v1/account/waitlist/join-form"]')!;
    expect(form.getAttribute("method")).toBe("post");
    expect(form.querySelector('input[name="email"]')).toBeDefined();
    expect(form.querySelector('input[name="channel"]')).toBeDefined();
    const phone = form.querySelector('input[name="phone"]') as HTMLInputElement;
    expect(phone).toBeDefined();
    expect(phone.required).toBe(false);
    expect(container.innerHTML).not.toContain("Loading waiting-list status");
    expect(container.innerHTML).not.toContain("skeleton");
  });

  it("a failed status fetch leaves the floor form on screen with the brief status note", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "internal", detail: "boom" }), { status: 500 })));
    render(<WaitlistBlock varietySlug="sunset" varietyName="Sunset" />);
    await screen.findByText("We couldn't check your account status just now — you can still join the waiting list below.");
    expect(fieldInput("waitlist-floor-email")).toBeDefined();
    expect(screen.queryByText("Loading waiting-list status…")).toBeNull();
  });
});

describe("3.2 — the /account email-code accommodation (§11.1)", () => {
  it("offers 'Email me a code instead' and the code path signs in", async () => {
    const posts: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/sign-in/code")) {
          posts.push({ url: u, body: JSON.parse(String(init?.body ?? "{}")) });
          return new Response(JSON.stringify({ data: { delivery: "sent" } }), { status: 200 });
        }
        if (u.includes("/sign-in/verify")) {
          posts.push({ url: u, body: JSON.parse(String(init?.body ?? "{}")) });
          return new Response(JSON.stringify({ data: { user: {}, next: "/account" } }), { status: 200 });
        }
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
      }),
    );
    render(<SignInForm siteKey={null} />);
    fireEvent.change(fieldInput("signin-email"), { target: { value: "phoneless@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a code instead" }));
    await screen.findByText("We emailed a 6-digit code to phoneless@example.com. Enter it below to sign in.");
    expect(posts[0]).toMatchObject({ url: expect.stringContaining("/sign-in/code") });
    expect((posts[0]!.body as Record<string, unknown>).email).toBe("phoneless@example.com");
    fireEvent.change(fieldInput("signin-code-code"), { target: { value: "123456" } });
    fireEvent.submit(fieldInput("signin-code-code").closest("form")!);
    await vi.waitFor(() => expect(posts.some((p) => p.url.includes("/sign-in/verify"))).toBe(true));
    expect(posts.find((p) => p.url.includes("/sign-in/verify"))!.body).toMatchObject({ email: "phoneless@example.com", code: "123456" });
  });

  it("a phone-less account's email is not blocked by the empty phone field", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { delivery: "sent" } }), { status: 200 })));
    render(<SignInForm siteKey={null} />);
    fireEvent.change(fieldInput("signin-email"), { target: { value: "phoneless@example.com" } });
    expect(fieldInput("signin-phone").value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Email me a code instead" }));
    await screen.findByText(/We emailed a 6-digit code to phoneless@example.com/);
  });
});

describe("3.2 — the account panel's equivalent finish step + the unset sentinel", () => {
  const panelUser = (over: Partial<PublicUser> = {}): PublicUser => ({
    name: "",
    email: "flip@example.com",
    phone: "",
    phone_display: "",
    usda_zone: null,
    email_verified: false,
    notify_opt_out: false,
    farm_owner_declared: false,
    is_farm_owner: false,
    alert_phone: null,
    alert_phone_display: null,
    alert_phone_verified: false,
    sms_opt_in: false,
    ...over,
  });

  it("shows the finish step until completed, and never renders the empty-string sentinel as a value", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 })));
    const { container } = render(<AccountPanel user={panelUser()} alerts={[]} />);
    expect(screen.getByText("Want to finish your account? A name and ZIP set your growing zone — you can do this any time, or not at all.")).toBeDefined();
    expect(fieldInput("panel-finish-name")).toBeDefined();
    expect(fieldInput("panel-finish-zip")).toBeDefined();
    expect(fieldInput("panel-finish-account-type-farm-owner")).toBeDefined();
    // Email and phone are never re-asked in the step.
    const step = screen.getByText("Finish your account").closest("section")!;
    expect(step.querySelector("input[name='email']")).toBeNull();
    expect(step.querySelector("input[name='phone']")).toBeNull();
    // The sentinel reads as unset, in words.
    expect(container.innerHTML).toContain("Not set yet.");
    expect(container.innerHTML).toContain("No phone number on this account.");
    expect(container.innerHTML).toContain("This account has no phone number — you sign in with a code we email you.");
  });

  it("hides the step for complete accounts and keeps their details verbatim", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 })));
    const alerts: AlertItem[] = [];
    render(<AccountPanel user={panelUser({ name: "Ann Gardener", phone: "5415550100", phone_display: "(541) 555-0100", usda_zone: "8b" })} alerts={alerts} />);
    expect(screen.queryByText("Finish your account")).toBeNull();
    expect(screen.getByText("Ann Gardener")).toBeDefined();
    expect(screen.getByText("(541) 555-0100")).toBeDefined();
    expect(screen.getByText(/half of your sign-in/)).toBeDefined();
  });
});
