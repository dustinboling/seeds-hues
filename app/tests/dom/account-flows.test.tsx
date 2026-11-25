// @vitest-environment jsdom
/**
 * Slice 6 account drives: the sign-in panel (pair + the §11.1 email-code
 * seam), the create-account code step, the signed-in panel's Found /
 * Waiting / Held waitlist states, sign-out, and session persistence
 * across a client-side route change (remount without reload).
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "../../src/components/account/SignInForm";
import { CreateAccountForm } from "../../src/components/account/CreateAccountForm";
import { AccountPage } from "../../src/components/account/AccountPage";

interface MockRoute {
  status: number;
  json: unknown;
}

function mockFetch(routes: Record<string, MockRoute | MockRoute[]>) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const queues: Record<string, MockRoute[]> = Object.fromEntries(
    Object.entries(routes).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]]),
  );
  const fn = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const body = init?.body ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ url: String(url), method: init?.method ?? "GET", body });
    const path = String(url).split("?")[0]!;
    const queue = queues[path] ?? queues[String(url)];
    const route = queue && queue.length > 1 ? queue.shift()! : (queue?.[0] ?? { status: 404, json: { code: "not_found", detail: "no mock" } });
    return { ok: route.status >= 200 && route.status < 300, status: route.status, json: async () => route.json };
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn };
}

function mockTurnstile(token = "test-turnstile-token"): void {
  window.turnstile = {
    render: (_el: HTMLElement, opts: Record<string, unknown>) => {
      (opts.callback as (t: string) => void)(token);
      return "widget-1";
    },
    reset: () => {},
    remove: () => {},
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.turnstile;
});

/** Flush the Turnstile loader microtask + widget render + token callback. */
async function flushWidget(): Promise<void> {
  await act(async () => {});
}

const field = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  expect(el, `field #${id}`).not.toBeNull();
  return el!;
};

const WILLA = {
  name: "Willa Gardener",
  email: "willa@example.com",
  phone: "5035550114",
  phone_display: "(503) 555-0114",
  usda_zone: "8b",
  email_verified: true,
  notify_opt_out: false,
  farm_owner_declared: false,
  is_farm_owner: false,
  alert_phone: "5035550114",
  alert_phone_display: "(503) 555-0114",
  alert_phone_verified: true,
  sms_opt_in: true,
};

const ALERTS = [
  {
    variety: { slug: "cosmos-lonely-bloom", name: "Lonely Bloom", crop: "Cosmos" },
    joined_at: "2026-11-10T09:00:00.000Z",
    notified_at: "2026-11-21T08:00:00.000Z",
    status: { state: "found", seller: { name: "Blue Ridge Seeds", slug: "blue-ridge-seeds" }, listing_id: 1, seller_count: 2, alerted: true },
  },
  {
    variety: { slug: "cosmos-candy-stripe", name: "Candy Stripe", crop: "Cosmos" },
    joined_at: "2026-11-12T09:00:00.000Z",
    notified_at: null,
    status: { state: "waiting", channels: ["email", "sms"] },
  },
  {
    variety: { slug: "cosmos-mystery-bloom", name: "Mystery Bloom", crop: "Cosmos" },
    joined_at: "2026-11-13T09:00:00.000Z",
    notified_at: null,
    status: { state: "held", reasons: ["Verify your email (enter the 6-digit code we emailed you)"] },
  },
];

describe("SignInForm outcomes", () => {
  it("a wrong pair renders the pair-neutral form message (never a field error)", async () => {
    mockTurnstile();
    mockFetch({ "/api/v1/account/sign-in": { status: 401, json: { code: "no_match", detail: "We couldn't find that email + phone pair" } } });
    render(<SignInForm siteKey="test-site-key" onSignedIn={vi.fn()} />);
    await flushWidget();
    fireEvent.change(field("signin-email"), { target: { value: "willa@example.com" } });
    fireEvent.change(field("signin-phone"), { target: { value: "(503) 555-9999" } });
    fireEvent.submit(field("signin-email").closest("form")!);

    await screen.findByText("We couldn't find an account with that email and phone number together — check both and try again.");
    // Form-level: neither field carries an inline error.
    expect(document.getElementById("signin-email-error")).toBeNull();
    expect(document.getElementById("signin-phone-error")).toBeNull();
  });

  it("the seam refuses a phone-carrying account with the mapped email error", async () => {
    mockTurnstile();
    mockFetch({ "/api/v1/account/sign-in/code": { status: 409, json: { code: "has_phone", detail: "This account has a phone number." } } });
    render(<SignInForm siteKey="test-site-key" onSignedIn={vi.fn()} />);
    await flushWidget();
    expect(screen.getByRole("button", { name: "Email me a code instead" })).toBeDefined();
    expect(screen.getByText("No phone number on your account? Emailing a code signs you in without one.")).toBeDefined();
    fireEvent.change(field("signin-email"), { target: { value: "willa@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a code instead" }));

    await screen.findByText("This account has a phone number — sign in with your email and phone number instead.");
    expect(document.getElementById("signin-email-error")).not.toBeNull();
  });
});

describe("CreateAccountForm", () => {
  it("creates, then the 6-digit code verifies NEW accounts", async () => {
    mockTurnstile();
    const navigateFn = vi.fn();
    const { calls } = mockFetch({
      "/api/v1/account": { status: 201, json: { data: { verification: { email: "sent", phone: null }, next: "/account" } } },
      "/api/v1/account/email/verify": { status: 200, json: { data: { email_verified: true } } },
    });
    render(<CreateAccountForm siteKey="test-site-key" navigateFn={navigateFn} />);
    await flushWidget();
    fireEvent.change(field("create-name"), { target: { value: "Ada R" } });
    fireEvent.change(field("create-email"), { target: { value: "ada@example.com" } });
    fireEvent.change(field("create-phone"), { target: { value: "(503) 555-0100" } });
    fireEvent.change(field("create-zip"), { target: { value: "97205" } });
    fireEvent.submit(field("create-name").closest("form")!);

    await screen.findByText("Your account is ready and you’re signed in.");
    const posts = calls.filter((c) => c.url === "/api/v1/account");
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body).toEqual({
      name: "Ada R",
      email: "ada@example.com",
      phone: "(503) 555-0100",
      zip: "97205",
      farm_owner: false,
      sms_opt_in: false,
      turnstile_token: "test-turnstile-token",
    });
    fireEvent.change(field("signup-code"), { target: { value: "123456" } });
    fireEvent.submit(field("signup-code").closest("form")!);
    await act(async () => {});
    const verifies = calls.filter((c) => c.url === "/api/v1/account/email/verify");
    expect(verifies).toHaveLength(1);
    expect(verifies[0]!.body).toEqual({ code: "123456" });
    expect(navigateFn).toHaveBeenCalledWith("/account");
  });
});

describe("AccountPage session + panel", () => {
  it("signed out: the create + sign-in panels render, no user data", async () => {
    mockTurnstile();
    mockFetch({ "/api/v1/account/me": { status: 200, json: { data: { signed_in: false } } } });
    render(<AccountPage siteKey="test-site-key" deleted={false} />);
    await flushWidget();
    await screen.findByText("New here? Create an account");
    expect(screen.getByText("Already have one? Sign in")).toBeDefined();
    expect(screen.queryByText("Hello, Willa")).toBeNull();
  });

  it("signed in: the panel shows the account's waitlists with Found/Waiting/Held states", async () => {
    mockTurnstile();
    mockFetch({
      "/api/v1/account/me": { status: 200, json: { data: { signed_in: true, user: WILLA } } },
      "/api/v1/account/alerts": { status: 200, json: { data: ALERTS } },
    });
    render(<AccountPage siteKey="test-site-key" deleted={false} />);
    await flushWidget();
    await screen.findByText("Hello, Willa");
    // Found: badge + seller link + shop link through /go (nofollow).
    expect(screen.getByText("Found")).toBeDefined();
    expect(screen.getByRole("link", { name: "Blue Ridge Seeds" })).toBeDefined();
    const shop = screen.getByRole("link", { name: /shop/ });
    expect(shop.getAttribute("href")).toBe("/go/1");
    expect(shop.getAttribute("rel")).toContain("nofollow");
    // Waiting + Held.
    expect(screen.getByText("Waiting · active")).toBeDefined();
    expect(screen.getByText("Held")).toBeDefined();
    expect(screen.getByText(/Verify your email \(enter the 6-digit code we emailed you\)/)).toBeDefined();
    // Details + zone.
    expect(screen.getByText("Your zone: 8b")).toBeDefined();
  });

  it("leave-a-list posts and refreshes; sign-out returns to the signed-out state", async () => {
    mockTurnstile();
    const { calls } = mockFetch({
      "/api/v1/account/me": [
        { status: 200, json: { data: { signed_in: true, user: WILLA } } },
        { status: 200, json: { data: { signed_in: true, user: WILLA } } },
        { status: 200, json: { data: { signed_in: false } } },
      ],
      "/api/v1/account/alerts": [
        { status: 200, json: { data: ALERTS } },
        { status: 200, json: { data: ALERTS.slice(1) } },
      ],
      "/api/v1/account/waitlist/leave": { status: 200, json: { data: { variety: "cosmos-lonely-bloom", left: true, on_list: false } } },
      "/api/v1/account/sign-out": { status: 200, json: { data: { signed_out: true } } },
    });
    render(<AccountPage siteKey="test-site-key" deleted={false} />);
    await flushWidget();
    await screen.findByText("Hello, Willa");

    fireEvent.click(screen.getByRole("button", { name: /Leave list.*Lonely Bloom/ }));
    await screen.findByText("You’ve left the waiting list for Lonely Bloom.");
    const leaves = calls.filter((c) => c.url === "/api/v1/account/waitlist/leave");
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.body).toEqual({ variety: "cosmos-lonely-bloom" });

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByText("New here? Create an account");
    expect(calls.filter((c) => c.url === "/api/v1/account/sign-out")).toHaveLength(1);
  });

  it("phone-less end-to-end: code request → verify → the signed-in panel with its waitlists", async () => {
    mockTurnstile();
    const { calls } = mockFetch({
      "/api/v1/account/me": [
        { status: 200, json: { data: { signed_in: false } } },
        { status: 200, json: { data: { signed_in: true, user: WILLA } } },
      ],
      "/api/v1/account/sign-in/code": { status: 200, json: { data: { delivery: "sent" } } },
      "/api/v1/account/sign-in/verify": { status: 200, json: { data: { next: "/account" } } },
      "/api/v1/account/alerts": { status: 200, json: { data: ALERTS } },
    });
    render(<AccountPage siteKey="test-site-key" deleted={false} />);
    await flushWidget();
    await screen.findByText("Already have one? Sign in");

    fireEvent.change(field("signin-email"), { target: { value: "phoneless@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a code instead" }));
    await screen.findByText("Check your email for a code");
    expect(calls.filter((c) => c.url === "/api/v1/account/sign-in/code")[0]!.body).toMatchObject({ email: "phoneless@example.com" });

    fireEvent.change(field("signin-code-code"), { target: { value: "654321" } });
    fireEvent.submit(field("signin-code-code").closest("form")!);
    await screen.findByText("Hello, Willa");
    expect(calls.filter((c) => c.url === "/api/v1/account/sign-in/verify")[0]!.body).toEqual({
      email: "phoneless@example.com",
      code: "654321",
    });
    expect(screen.getByText("Found")).toBeDefined();
    expect(screen.getByText("Waiting · active")).toBeDefined();
    expect(screen.getByText("Held")).toBeDefined();
  });

  it("the session persists across a client-side route change (remount, no reload)", async () => {
    mockTurnstile();
    const { calls, fn } = mockFetch({
      "/api/v1/account/me": { status: 200, json: { data: { signed_in: true, user: WILLA } } },
      "/api/v1/account/alerts": { status: 200, json: { data: ALERTS } },
    });
    const ui = render(<AccountPage siteKey="test-site-key" deleted={false} />);
    await flushWidget();
    await screen.findByText("Hello, Willa");
    expect(fn).toHaveBeenCalled();
    const meCalls = () => calls.filter((c) => c.url === "/api/v1/account/me").length;
    expect(meCalls()).toBe(1);
    // A client-side route change away and back: new mount, same session.
    ui.unmount();
    render(<AccountPage siteKey="test-site-key" deleted={false} />);
    await flushWidget();
    await screen.findByText("Hello, Willa");
    expect(meCalls()).toBe(2);
  });
});
