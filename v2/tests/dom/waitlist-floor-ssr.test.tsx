/**
 * Tranche 3.2 — the no-JS floor as the server sends it (renderToStaticMarkup of the block's
 * pre-fetch render, which is exactly the server document): the real plain form on the resting
 * page with no loading shell anywhere, and every redirect-back floor state with its copy,
 * preserved values, and error dialect. Fails on pre-build code, whose server output is the
 * "Loading waiting-list status…" skeleton with no form.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WaitlistBlock } from "@/components/variety/WaitlistBlock";
import { parseFloorState } from "@/lib/waitlist-floor";

const html = (query: Record<string, string | string[] | undefined> = {}) =>
  renderToStaticMarkup(<WaitlistBlock varietySlug="sunset" varietyName="Sunset" floor={parseFloorState(query)} />);

describe("3.2 — server-rendered floor (3.2-E)", () => {
  it("the resting page carries the real plain form and no loading shell", () => {
    const h = html();
    expect(h).toContain('action="/api/v1/account/waitlist/join-form"');
    expect(h).toContain('name="email"');
    expect(h).toContain('name="channel"');
    expect(h).toContain('name="phone"');
    expect(h).toContain('name="variety"');
    expect(h).toContain("How should we tell you?");
    expect(h).toContain('id="waitlist-block"');
    expect(h).not.toContain("Loading waiting-list status");
    expect(h).not.toContain("skeleton");
    // The floor phone field is visible and never required.
    expect(h).toContain("Phone number (only needed for text alerts)");
    const phoneTag = /<input[^>]*name="phone"[^>]*>/.exec(h)![0];
    expect(phoneTag).not.toContain("required");
  });

  it("the error floor preserves values + channel and speaks the enhanced error dialect", () => {
    const h = html({ waitlist: "error", err: "email_invalid,phone_invalid", email: "typed-value", channel: "sms", phone: "555" });
    expect(h).toContain("Some fields need attention before joining the waiting list.");
    expect(h).toContain("Enter a valid email address.");
    expect(h).toContain("Enter your phone number as a 10-digit US number.");
    expect(h).toContain('value="typed-value"');
    expect(h).toContain('value="555"');
    expect(h).toContain('aria-invalid="true"');
    expect(h).toContain("waitlist-floor-email-error");
    expect(h).toContain("waitlist-floor-phone-hint waitlist-floor-phone-error");
  });

  it("the recognized floor carries §3.2.4's copy and the plain code form with the hidden email", () => {
    const h = html({ waitlist: "recognized", email: "ada@example.com" });
    expect(h).toContain("This email already has an account — we&#x27;ve sent a 6-digit code to ada@example.com. Enter it to join this waiting list.");
    expect(h).toContain('action="/api/v1/account/waitlist/verify-form"');
    expect(h).toContain('name="code"');
    expect(h).toContain('value="ada@example.com"');
    expect(h).toContain("It works for 30 minutes.");
  });

  it("the verify and active floors carry their copy obligations", () => {
    const verify = html({ waitlist: "verify" });
    expect(verify).toContain("You&#x27;re on the waiting list for Sunset. Alerts start once your email is confirmed — enter the 6-digit code from your email:");
    expect(verify).toContain('action="/api/v1/account/waitlist/verify-form"');
    const wrong = html({ waitlist: "verify", cerr: "code_incorrect" });
    expect(wrong).toContain("That code isn&#x27;t right — check it and try again.");
    expect(wrong).toContain('aria-invalid="true"');
    const active = html({ waitlist: "active", channels: "email,sms" });
    expect(active).toContain("You’re on the waiting list for Sunset — glad to have you here.");
    expect(active).toContain("we’ll send you one alert by email and text — and that’s all.");
  });
});
