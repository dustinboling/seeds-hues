// @vitest-environment jsdom
/**
 * Slice 6 BusyForm standard: every form types real values, submits, and the
 * test asserts the payload the API receives contains those values — the
 * shipped v2 bug (a submit that disabled its own fieldset, so submissions
 * arrived empty) must be impossible here. Rejections render the
 * plain-language errors with the typed values preserved.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportForm } from "../../src/components/report/ReportForm";
import { AddYourFarmForm } from "../../src/components/farm/AddYourFarmForm";
import { WaitlistBlock } from "../../src/components/variety/WaitlistBlock";
import { SignInForm } from "../../src/components/account/SignInForm";

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

/** The Turnstile loader sees a ready widget that immediately issues a token. */
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

describe("ReportForm payload-intact (BusyForm)", () => {
  it("types real values, submits, and the API receives every value + the token", async () => {
    mockTurnstile();
    const { calls } = mockFetch({ "/api/v1/reports": { status: 201, json: { data: { report_id: 1, status: "open" } } } });
    render(<ReportForm type="correct" targetType="seller" targetRef="" siteKey="test-site-key" />);
    await flushWidget();

    fireEvent.change(field("target_type"), { target: { value: "variety" } });
    fireEvent.change(field("target_ref"), { target: { value: "Cosmos-Lonely-Bloom" } });
    fireEvent.change(field("message"), { target: { value: "The packet sizes look wrong here." } });
    fireEvent.change(field("contact"), { target: { value: "willa@example.com" } });
    fireEvent.submit(field("contact").closest("form")!);

    await screen.findByText("Thank you — your request is in our review queue. We reply by email.");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/api/v1/reports");
    expect(calls[0]!.body).toEqual({
      type: "correct",
      target_type: "variety",
      target_ref: "cosmos-lonely-bloom",
      message: "The packet sizes look wrong here.",
      contact: "willa@example.com",
      turnstile_token: "test-turnstile-token",
    });
  });

  it("a rejection renders the mapped errors with every typed value preserved", async () => {
    mockTurnstile();
    mockFetch({
      "/api/v1/reports": { status: 400, json: { code: "validation_error", detail: "target_ref: x; contact: y" } },
    });
    render(<ReportForm type="correct" targetType="seller" targetRef="" siteKey="test-site-key" />);
    await flushWidget();

    fireEvent.change(field("target_ref"), { target: { value: "cosmos-lonely-bloom" } });
    fireEvent.change(field("message"), { target: { value: "The packet sizes look wrong here." } });
    fireEvent.change(field("contact"), { target: { value: "willa@example.com" } });
    fireEvent.submit(field("contact").closest("form")!);

    await screen.findByText("Some fields need attention before sending.");
    // The set's character-identical rule: the summary link and the inline line carry the same words.
    expect(screen.getAllByText("Check the page address name — use the last part of the page’s URL, e.g. songbird-seed-co.")).toHaveLength(2);
    expect(screen.getAllByText("Please enter a valid email address so we can reply.")).toHaveLength(2);
    expect((field("target_ref") as HTMLInputElement).value).toBe("cosmos-lonely-bloom");
    expect((field("message") as HTMLTextAreaElement).value).toBe("The packet sizes look wrong here.");
    expect((field("contact") as HTMLInputElement).value).toBe("willa@example.com");
  });

  it("the busy submit never disables its own fields (the shipped v2 bug, structurally impossible)", async () => {
    mockTurnstile();
    const { fn } = mockFetch({ "/api/v1/reports": { status: 201, json: { data: { report_id: 1, status: "open" } } } });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => void (release = resolve));
    fn.mockImplementationOnce(async () => {
      await gate;
      return { ok: true, status: 201, json: async () => ({ data: { report_id: 1, status: "open" } }) };
    });
    render(<ReportForm type="correct" targetType="seller" targetRef="" siteKey="test-site-key" />);
    await flushWidget();
    const form = field("message").closest("form")!;
    fireEvent.change(field("message"), { target: { value: "The packet sizes look wrong here." } });
    fireEvent.change(field("contact"), { target: { value: "willa@example.com" } });
    fireEvent.submit(form);

    // Busy state has flushed: the button busies, the fields stay live, and
    // the FormData a browser would build now still carries every value.
    const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.textContent).toBe("Sending…");
    expect(submit.disabled).toBe(true);
    expect((field("message") as HTMLTextAreaElement).disabled).toBe(false);
    expect((field("contact") as HTMLInputElement).disabled).toBe(false);
    expect(form.querySelector("fieldset[disabled]")).toBeNull();
    const data = new FormData(form);
    expect(data.get("message")).toBe("The packet sizes look wrong here.");
    expect(data.get("contact")).toBe("willa@example.com");

    await act(async () => {
      release();
    });
    await screen.findByText("Thank you — your request is in our review queue. We reply by email.");
  });
});

describe("AddYourFarmForm payload-intact (BusyForm)", () => {
  const STATES = [
    { code: "OR", name: "Oregon" },
    { code: "CA", name: "California" },
  ];

  function fill() {
    fireEvent.change(field("farm_name"), { target: { value: "Songbird Seed Co" } });
    fireEvent.change(field("contact_name"), { target: { value: "Willa Gardener" } });
    fireEvent.change(field("contact_email"), { target: { value: "willa@example.com" } });
    fireEvent.change(field("city"), { target: { value: "Portland" } });
    fireEvent.change(field("state"), { target: { value: "OR" } });
    fireEvent.change(field("website"), { target: { value: "https://songbird.example.com" } });
    fireEvent.change(field("about"), { target: { value: "A small farm growing open-pollinated flower seed." } });
    fireEvent.change(field("varieties"), { target: { value: "Zinnia — Queen Lime Blush" } });
    fireEvent.click(field("authorized"));
    fireEvent.change(field("business_phone"), { target: { value: "(503) 555-0100" } });
    fireEvent.change(field("instagram_url"), { target: { value: "https://instagram.com/songbird" } });
    fireEvent.click(field("wholesale-yes"));
    fireEvent.change(field("notes"), { target: { value: "We grow everything ourselves." } });
  }

  it("types every field, submits, and the API receives the exact 16-field payload + token", async () => {
    mockTurnstile();
    const { calls } = mockFetch({ "/api/v1/farm-submissions": { status: 201, json: { data: { id: 1, status: "pending" } } } });
    render(<AddYourFarmForm siteKey="test-site-key" states={STATES} defaults={{ contactName: "", contactEmail: "", state: null }} />);
    await flushWidget();
    fill();
    fireEvent.submit(field("farm_name").closest("form")!);

    await screen.findByText("Thank you — your submission is in our review queue.");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({
      farm_name: "Songbird Seed Co",
      contact_name: "Willa Gardener",
      contact_email: "willa@example.com",
      city: "Portland",
      state: "OR",
      website: "https://songbird.example.com",
      about: "A small farm growing open-pollinated flower seed.",
      varieties: "Zinnia — Queen Lime Blush",
      authorized: true,
      business_phone: "(503) 555-0100",
      gbp_url: "",
      instagram_url: "https://instagram.com/songbird",
      tiktok_url: "",
      facebook_url: "",
      wholesale: "yes",
      notes: "We grow everything ourselves.",
      turnstile_token: "test-turnstile-token",
    });
  });

  it("a rejection renders the mapped errors with the typed values preserved", async () => {
    mockTurnstile();
    mockFetch({ "/api/v1/farm-submissions": { status: 400, json: { code: "validation_error", detail: "farm_name: x; website: y" } } });
    render(<AddYourFarmForm siteKey="test-site-key" states={STATES} defaults={{ contactName: "", contactEmail: "", state: null }} />);
    await flushWidget();
    fill();
    fireEvent.submit(field("farm_name").closest("form")!);

    await screen.findByText("Some fields need attention before sending for review.");
    expect(screen.getAllByText("Enter your farm’s name.")).toHaveLength(2);
    expect(screen.getAllByText("Enter your full website address starting with https:// — for example https://www.myfarm.com.")).toHaveLength(2);
    expect((field("farm_name") as HTMLInputElement).value).toBe("Songbird Seed Co");
    expect((field("website") as HTMLInputElement).value).toBe("https://songbird.example.com");
  });
});

describe("WaitlistBlock alert step payload-intact (BusyForm)", () => {
  const SIGNED_OUT = {
    status: 200,
    json: {
      data: {
        signed_in: false,
        variety: { slug: "cosmos-lonely-bloom", name: "Lonely Bloom", listed: false },
        on_list: false,
        turnstile_site_key: "test-site-key",
      },
    },
  };
  const SIGNED_IN_ON_LIST = {
    status: 200,
    json: {
      data: {
        signed_in: true,
        variety: { slug: "cosmos-lonely-bloom", name: "Lonely Bloom", listed: false },
        on_list: true,
        user: { name: "", email_verified: false, sms_opt_in: false, alert_phone_verified: false, profile_complete: true },
        channels: [],
        held: ["Verify your email (enter the 6-digit code we emailed you)"],
        turnstile_site_key: "test-site-key",
      },
    },
  };

  it("email-only join sends no phone key at all", async () => {
    mockTurnstile();
    const { calls } = mockFetch({
      "/api/v1/account/waitlist": [SIGNED_OUT, SIGNED_IN_ON_LIST],
      "/api/v1/account": { status: 201, json: { data: { verification: { email: "sent", phone: null }, waitlist: { joined: true } } } },
    });
    render(<WaitlistBlock varietySlug="cosmos-lonely-bloom" varietyName="Lonely Bloom" />);
    // The alert step (Turnstile mount) replaces the floor once the status fetch resolves.
    await screen.findByText(/A quick check from Cloudflare/);
    await flushWidget();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.submit((await screen.findByLabelText("Email")).closest("form")!);

    await screen.findByText(/You’re on the waiting list for Lonely Bloom/);
    const posts = calls.filter((c) => c.url === "/api/v1/account");
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body).toEqual({
      email: "ada@example.com",
      sms_opt_in: false,
      join_variety: "cosmos-lonely-bloom",
      turnstile_token: "test-turnstile-token",
    });
    expect(posts[0]!.body).not.toHaveProperty("phone");
  });

  it("text-channel join sends the typed phone", async () => {
    mockTurnstile();
    const { calls } = mockFetch({
      "/api/v1/account/waitlist": [SIGNED_OUT, SIGNED_IN_ON_LIST],
      "/api/v1/account": { status: 201, json: { data: { verification: { email: "sent", phone: "sent" }, waitlist: { joined: true } } } },
    });
    render(<WaitlistBlock varietySlug="cosmos-lonely-bloom" varietyName="Lonely Bloom" />);
    // The alert step (Turnstile mount) replaces the floor once the status fetch resolves.
    await screen.findByText(/A quick check from Cloudflare/);
    await flushWidget();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByLabelText(/Email and text/));
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "(503) 555-0100" } });
    fireEvent.submit((await screen.findByLabelText("Email")).closest("form")!);

    await screen.findByText(/You’re on the waiting list for Lonely Bloom/);
    const posts = calls.filter((c) => c.url === "/api/v1/account");
    expect(posts[0]!.body).toEqual({
      email: "ada@example.com",
      sms_opt_in: true,
      phone: "(503) 555-0100",
      join_variety: "cosmos-lonely-bloom",
      turnstile_token: "test-turnstile-token",
    });
  });

  it("switching back to email-only drops the phone from the payload", async () => {
    mockTurnstile();
    const { calls } = mockFetch({
      "/api/v1/account/waitlist": [SIGNED_OUT, SIGNED_IN_ON_LIST],
      "/api/v1/account": { status: 201, json: { data: { verification: { email: "sent", phone: null }, waitlist: { joined: true } } } },
    });
    render(<WaitlistBlock varietySlug="cosmos-lonely-bloom" varietyName="Lonely Bloom" />);
    // The alert step (Turnstile mount) replaces the floor once the status fetch resolves.
    await screen.findByText(/A quick check from Cloudflare/);
    await flushWidget();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByLabelText(/Email and text/));
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "(503) 555-0100" } });
    fireEvent.click(screen.getByLabelText("Email only"));
    expect(screen.queryByLabelText("Phone number")).toBeNull();
    fireEvent.submit((await screen.findByLabelText("Email")).closest("form")!);

    await screen.findByText(/You’re on the waiting list for Lonely Bloom/);
    const posts = calls.filter((c) => c.url === "/api/v1/account");
    expect(posts[0]!.body).not.toHaveProperty("phone");
  });
});

describe("SignInForm payload-intact (BusyForm)", () => {
  it("the pair submit sends the exact credentials + token, then signs in", async () => {
    mockTurnstile();
    const signedIn = vi.fn();
    const { calls } = mockFetch({ "/api/v1/account/sign-in": { status: 200, json: { data: { next: "/account" } } } });
    render(<SignInForm siteKey="test-site-key" onSignedIn={signedIn} />);
    await flushWidget();
    fireEvent.change(field("signin-email"), { target: { value: "willa@example.com" } });
    fireEvent.change(field("signin-phone"), { target: { value: "(503) 555-0114" } });
    fireEvent.submit(field("signin-email").closest("form")!);

    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ email: "willa@example.com", phone: "(503) 555-0114", turnstile_token: "test-turnstile-token" });
    expect(signedIn).toHaveBeenCalledTimes(1);
  });

  it("the §11.1 seam: code request + verify send the exact payloads, then signs in", async () => {
    mockTurnstile();
    const signedIn = vi.fn();
    const { calls } = mockFetch({
      "/api/v1/account/sign-in/code": { status: 200, json: { data: { delivery: "sent" } } },
      "/api/v1/account/sign-in/verify": { status: 200, json: { data: { next: "/account" } } },
    });
    render(<SignInForm siteKey="test-site-key" onSignedIn={signedIn} />);
    await flushWidget();
    fireEvent.change(field("signin-email"), { target: { value: "phoneless@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a code instead" }));

    await screen.findByText("Check your email for a code");
    expect(calls[0]).toMatchObject({ url: "/api/v1/account/sign-in/code", body: { email: "phoneless@example.com", turnstile_token: "test-turnstile-token" } });
    fireEvent.change(field("signin-code-code"), { target: { value: "654321" } });
    fireEvent.submit(field("signin-code-code").closest("form")!);

    await act(async () => {});
    const verifies = calls.filter((c) => c.url === "/api/v1/account/sign-in/verify");
    expect(verifies).toHaveLength(1);
    expect(verifies[0]!.body).toEqual({ email: "phoneless@example.com", code: "654321" });
    expect(signedIn).toHaveBeenCalledTimes(1);
  });
});
