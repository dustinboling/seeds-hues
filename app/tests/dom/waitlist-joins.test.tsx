// @vitest-environment jsdom
/**
 * Slice 6 waitlist join states: the signed-in one-click join, the
 * signed-out create-then-join, the recognized-contact inline transition
 * (never an error, never a link away), the listed race, the listed gate,
 * and the finish-your-account step.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WaitlistBlock } from "../../src/components/variety/WaitlistBlock";

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

const VARIETY = { slug: "cosmos-lonely-bloom", name: "Lonely Bloom", listed: false };

function signedInStatus(overrides: Record<string, unknown> = {}) {
  return {
    status: 200,
    json: {
      data: {
        signed_in: true,
        variety: VARIETY,
        on_list: false,
        user: { name: "Willa Gardener", email_verified: true, sms_opt_in: true, alert_phone_verified: true, profile_complete: true },
        channels: ["email", "sms"],
        held: [],
        turnstile_site_key: "test-site-key",
        ...overrides,
      },
    },
  };
}

describe("WaitlistBlock join states", () => {
  it("signed in, not on the list: one click joins and lands State A", async () => {
    mockTurnstile();
    const { calls } = mockFetch({
      "/api/v1/account/waitlist": [signedInStatus(), signedInStatus({ on_list: true })],
      "/api/v1/account/waitlist/join": { status: 200, json: { data: { variety: VARIETY.slug, joined: true, on_list: true } } },
    });
    render(<WaitlistBlock varietySlug={VARIETY.slug} varietyName={VARIETY.name} />);
    // The one-click view (the floor's submit button shares the join name — wait past it).
    await screen.findByRole("link", { name: "Text alerts and settings" });
    fireEvent.click(screen.getByRole("button", { name: "Join the waiting list" }));

    await screen.findByText("You’re on the waiting list for Lonely Bloom — glad to have you here.");
    expect(screen.getByText("When a seller first lists Lonely Bloom, we’ll send you one alert by email and text — and that’s all.")).toBeDefined();
    const joins = calls.filter((c) => c.url === "/api/v1/account/waitlist/join");
    expect(joins).toHaveLength(1);
    expect(joins[0]!.body).toEqual({ variety: "cosmos-lonely-bloom" });
  });

  it("signed out: create-then-join lands joined with the State B code step", async () => {
    mockTurnstile();
    mockFetch({
      "/api/v1/account/waitlist": [
        { status: 200, json: { data: { signed_in: false, variety: VARIETY, on_list: false, turnstile_site_key: "test-site-key" } } },
        signedInStatus({
          on_list: true,
          user: { name: "", email_verified: false, sms_opt_in: false, alert_phone_verified: false, profile_complete: true },
          channels: [],
          held: ["Verify your email (enter the 6-digit code we emailed you)"],
        }),
      ],
      "/api/v1/account": { status: 201, json: { data: { verification: { email: "sent", phone: null }, waitlist: { joined: true } } } },
    });
    render(<WaitlistBlock varietySlug={VARIETY.slug} varietyName={VARIETY.name} />);
    await screen.findByText(/A quick check from Cloudflare/);
    await flushWidget();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

    await screen.findByText("You’re on the waiting list for Lonely Bloom — glad to have you here.");
    expect(screen.getByText("One last step so your alerts can reach you")).toBeDefined();
    expect(screen.getByLabelText("6-digit code from your email")).toBeDefined();
  });

  it("recognized contact: the block transitions inline to the code state (never an error, never away)", async () => {
    mockTurnstile();
    const { calls } = mockFetch({
      "/api/v1/account/waitlist": [
        { status: 200, json: { data: { signed_in: false, variety: VARIETY, on_list: false, turnstile_site_key: "test-site-key" } } },
        signedInStatus({ on_list: true }),
      ],
      "/api/v1/account": { status: 200, json: { data: { recognized: true, email: "willa@example.com", delivery: "sent" } } },
      "/api/v1/account/waitlist/verify": {
        status: 200,
        json: { data: { variety: VARIETY.slug, joined: true, on_list: true, channels: ["email"], held: [], email_verified: true } },
      },
    });
    render(<WaitlistBlock varietySlug={VARIETY.slug} varietyName={VARIETY.name} />);
    await screen.findByText(/A quick check from Cloudflare/);
    await flushWidget();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "willa@example.com" } });
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

    await screen.findByText("This email already has an account — we've sent a 6-digit code to willa@example.com. Enter it to join this waiting list.");
    expect(document.querySelector('[role="alert"]')).toBeNull();
    const codeInput = screen.getByLabelText("6-digit code from your email");
    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.submit(codeInput.closest("form")!);

    await screen.findByText("You’re on the waiting list for Lonely Bloom — glad to have you here.");
    const verifies = calls.filter((c) => c.url === "/api/v1/account/waitlist/verify");
    expect(verifies).toHaveLength(1);
    expect(verifies[0]!.body).toEqual({ email: "willa@example.com", code: "123456" });
  });

  it("a join that races a listing states the good news (the API's message, verbatim)", async () => {
    mockTurnstile();
    const race = "Good news — Lonely Bloom is already listed by a seller. Reload the page to see where to buy it.";
    mockFetch({
      "/api/v1/account/waitlist": signedInStatus(),
      "/api/v1/account/waitlist/join": { status: 409, json: { code: "already_listed", detail: race } },
    });
    render(<WaitlistBlock varietySlug={VARIETY.slug} varietyName={VARIETY.name} />);
    await screen.findByRole("link", { name: "Text alerts and settings" });
    fireEvent.click(screen.getByRole("button", { name: "Join the waiting list" }));

    await screen.findByText(race);
  });

  it("a listed variety renders no block at all", async () => {
    mockTurnstile();
    const { fn } = mockFetch({ "/api/v1/account/waitlist": signedInStatus({ variety: { ...VARIETY, listed: true } }) });
    render(<WaitlistBlock varietySlug={VARIETY.slug} varietyName={VARIETY.name} />);
    await vi.waitFor(() => expect(fn).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId("waitlist-block")).toBeNull();
  });

  it("the finish-your-account step saves the deferred profile", async () => {
    mockTurnstile();
    const { calls } = mockFetch({
      "/api/v1/account/waitlist": [
        signedInStatus({
          on_list: true,
          user: { name: "", email_verified: true, sms_opt_in: false, alert_phone_verified: false, profile_complete: false },
          channels: ["email"],
          held: [],
        }),
        signedInStatus({
          on_list: true,
          user: { name: "Ada R", email_verified: true, sms_opt_in: false, alert_phone_verified: false, profile_complete: true },
          channels: ["email"],
          held: [],
        }),
      ],
      "/api/v1/account/profile": { status: 200, json: { data: { user: {} } } },
    });
    render(<WaitlistBlock varietySlug={VARIETY.slug} varietyName={VARIETY.name} />);
    await screen.findByText("Finish your account");
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ada R" } });
    fireEvent.change(screen.getByLabelText("ZIP code"), { target: { value: "97205" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Your account details are saved.");
    const saves = calls.filter((c) => c.url === "/api/v1/account/profile");
    expect(saves).toHaveLength(1);
    expect(saves[0]!.body).toEqual({ name: "Ada R", zip: "97205", farm_owner: false });
  });
});
