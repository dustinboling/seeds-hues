/**
 * Phase 3 primitives without a database: phone/email normalisation, the ZIP → zone table,
 * session cookies, signed unsubscribe tokens, verification-code shape, Turnstile (fail-closed,
 * mocked siteverify), the SMS provider switch (mock + Twilio adapter with a mocked fetch) and
 * robots.txt evaluation for the farm-summary fetcher.
 */
import { describe, expect, it, vi } from "vitest";
import {
  clearSessionCookie,
  hashSessionToken,
  isSessionTokenShape,
  newSessionToken,
  newVerificationCode,
  normalizeEmail,
  normalizePhone,
  readCookie,
  sessionCookie,
  signUnsubscribe,
  verifyUnsubscribe,
} from "@/lib/accounts";
import { lookupZone, ZONE_DATA_SOURCE } from "@/lib/data/zones";
import { TURNSTILE_TEST_KEYS, TURNSTILE_VERIFY_URL, turnstileOutcome, verifyTurnstile } from "@/lib/turnstile";
import { getSmsProvider, MOCK_SMS_OUTBOX, sendSms, twilioSignature } from "@/lib/sms";
import { robotsAllows } from "@/lib/robots";
import { sendEmail } from "@/lib/mail";

describe("identity normalisation", () => {
  it("email is trimmed + lowercased; phone is 10 US digits (leading 1 dropped) or null", () => {
    expect(normalizeEmail("  Ann@Example.COM ")).toBe("ann@example.com");
    expect(normalizePhone("(541) 555-0123")).toBe("5415550123");
    expect(normalizePhone("+1 541.555.0123")).toBe("5415550123");
    expect(normalizePhone("555-0123")).toBeNull();
    expect(normalizePhone("0415550123")).toBeNull();
  });
});

describe("ZIP → USDA zone (self-hosted 2023 PHZM table)", () => {
  it("derives half-zones for known ZIPs; unknown and malformed ZIPs give null", () => {
    expect(lookupZone("97448")).toBe("8b"); // Junction City, OR (the farm's ZIP)
    expect(lookupZone("10001")).toBe("7b");
    expect(lookupZone("99501")).toBe("5a"); // Anchorage (AK file)
    expect(lookupZone("96813")).toBe("12b"); // Honolulu (HI file)
    expect(lookupZone("00901")).toBe("13b"); // San Juan (PR file)
    expect(lookupZone("00000")).toBeNull();
    expect(lookupZone("9744")).toBeNull();
    expect(lookupZone("abcde")).toBeNull();
    expect(ZONE_DATA_SOURCE.count).toBeGreaterThan(40_000);
  });
});

describe("session cookie + token", () => {
  it("is a 256-bit base64url token in an HttpOnly, Secure, SameSite=Lax, 30-day cookie; only a hash is stored", async () => {
    const t = newSessionToken();
    expect(isSessionTokenShape(t)).toBe(true);
    expect(newSessionToken()).not.toBe(t);
    const c = sessionCookie(t);
    expect(c).toMatch(new RegExp(`^sf_session=${t}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax$`));
    expect(clearSessionCookie()).toMatch(/Max-Age=0/);
    expect(readCookie(`a=1; sf_session=${t}; b=2`, "sf_session")).toBe(t);
    const h = await hashSessionToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(t);
  });

  it("verification codes are 6 crypto-random digits", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = newVerificationCode();
      expect(c).toMatch(/^\d{6}$/);
      seen.add(c);
    }
    expect(seen.size).toBeGreaterThan(190);
  });
});

describe("signed unsubscribe tokens", () => {
  it("round-trip per-variety and global scopes; tampering or the wrong key fails", async () => {
    const v = await signUnsubscribe("k1", { kind: "variety", userId: 7, varietyId: 42 });
    const a = await signUnsubscribe("k1", { kind: "all", userId: 7 });
    expect(await verifyUnsubscribe("k1", v)).toEqual({ kind: "variety", userId: 7, varietyId: 42 });
    expect(await verifyUnsubscribe("k1", a)).toEqual({ kind: "all", userId: 7 });
    expect(await verifyUnsubscribe("k2", v)).toBeNull();
    expect(await verifyUnsubscribe("k1", v.replace("u7.", "u8."))).toBeNull();
    expect(await verifyUnsubscribe("k1", v.replace(".v42.", ".v43."))).toBeNull();
    expect(await verifyUnsubscribe("k1", "garbage")).toBeNull();
  });
});

describe("Turnstile (lib/turnstile.ts)", () => {
  it("fails closed without a secret outside local dev; passes as dev_bypass under next dev", async () => {
    expect(await verifyTurnstile("tok", null, { secret: null, localDev: false })).toBe(false);
    expect(await turnstileOutcome("tok", null, { secret: null, localDev: true })).toBe("dev_bypass");
  });

  it("POSTs secret + token (+ remoteip) to siteverify; success → verified, anything else → refused", async () => {
    const fetchFn = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
      const f = init!.body as URLSearchParams;
      return Response.json({ success: f.get("secret") === TURNSTILE_TEST_KEYS.secretKey && f.get("response") === "XXXX.DUMMY.TOKEN.XXXX" });
    }) as unknown as typeof fetch;
    const cfg = { secret: TURNSTILE_TEST_KEYS.secretKey, fetchFn, localDev: false };
    expect(await turnstileOutcome("XXXX.DUMMY.TOKEN.XXXX", "203.0.113.9", cfg)).toBe("verified");
    const call = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[0]).toBe(TURNSTILE_VERIFY_URL);
    expect((call[1] as RequestInit).body!.toString()).toContain("remoteip=203.0.113.9");
    expect(await verifyTurnstile("wrong", null, cfg)).toBe(false);
    expect(await verifyTurnstile("", null, cfg)).toBe(false);
    expect(await verifyTurnstile(undefined, null, cfg)).toBe(false);
    const throwing = (async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    expect(await verifyTurnstile("x", null, { ...cfg, fetchFn: throwing })).toBe(false);
  });
});

describe("SMS provider switch (lib/sms.ts)", () => {
  it("unset / pinpoint stub / twilio without secrets → not configured; mock records", async () => {
    expect(getSmsProvider({ provider: null, senderId: null })).toBeNull();
    expect(getSmsProvider({ provider: "pinpoint", senderId: "+15555550100" })).toBeNull();
    expect(getSmsProvider({ provider: "twilio", senderId: "+15555550100" })).toBeNull();
    expect(await sendSms(null, "5415550123", "hi")).toEqual({ ok: false, code: "sms_not_configured" });
    const mock = getSmsProvider({ provider: "mock", senderId: null })!;
    MOCK_SMS_OUTBOX.length = 0;
    expect(await sendSms(mock, "5415550123", "hello")).toMatchObject({ ok: true });
    expect(MOCK_SMS_OUTBOX).toEqual([expect.objectContaining({ to: "+15415550123", body: "hello" })]);
    MOCK_SMS_OUTBOX.length = 0;
  });

  it("the Twilio adapter posts To/From/Body with basic auth (mocked fetch; no network)", async () => {
    const fetchFn = vi.fn(async () => Response.json({ sid: "SM123" }, { status: 201 })) as unknown as typeof fetch;
    const p = getSmsProvider({ provider: "twilio", senderId: "+15555550100", twilioAccountSid: "AC_test", twilioAuthToken: "tok", fetchFn })!;
    expect(p.name).toBe("twilio");
    expect(await p.send("+15415550123", "Seed Directory: hi")).toEqual({ ok: true, id: "SM123" });
    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC_test/Messages.json");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa("AC_test:tok")}`);
    expect(String(init.body)).toBe(new URLSearchParams({ To: "+15415550123", Body: "Seed Directory: hi", From: "+15555550100" }).toString());
    const failing = getSmsProvider({ provider: "twilio", senderId: "MGabc", twilioAccountSid: "AC", twilioAuthToken: "t", fetchFn: (async () => Response.json({ code: 21610, message: "unsubscribed" }, { status: 400 })) as unknown as typeof fetch })!;
    expect(await failing.send("+15415550123", "x")).toMatchObject({ ok: false, code: "twilio_21610" });
  });

  it("webhook signatures are deterministic HMAC-SHA1 over url + sorted params", async () => {
    const a = await twilioSignature("secret", "https://seeds.hues.flowers/api/v1/webhooks/twilio/sms", { From: "+15415550123", Body: "STOP" });
    const b = await twilioSignature("secret", "https://seeds.hues.flowers/api/v1/webhooks/twilio/sms", { Body: "STOP", From: "+15415550123" });
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]{27}=$/);
    expect(await twilioSignature("other", "https://seeds.hues.flowers/api/v1/webhooks/twilio/sms", { From: "+15415550123", Body: "STOP" })).not.toBe(a);
  });
});

describe("mail (lib/mail.ts)", () => {
  it("no binding → mail_not_configured; binding errors surface their code", async () => {
    const msg = { to: "a@example.com", subject: "s", html: "<p>h</p>", text: "t" };
    expect(await sendEmail(null, msg)).toEqual({ ok: false, status: "mail_not_configured" });
    const ok = await sendEmail({ send: async () => ({ messageId: "m1" }) }, msg);
    expect(ok).toEqual({ ok: true, messageId: "m1" });
    const failing = await sendEmail(
      {
        send: async () => {
          throw Object.assign(new Error("nope"), { code: "E_SENDER_NOT_VERIFIED" });
        },
      },
      msg,
    );
    expect(failing).toMatchObject({ ok: false, status: "send_failed", code: "E_SENDER_NOT_VERIFIED" });
  });
});

describe("robots.txt (farm-summary fetcher)", () => {
  it("own group beats *, longest match wins, Allow wins ties, empty Disallow allows", () => {
    const txt = `User-agent: *\nDisallow: /\n\nUser-agent: HuesSeedFinderBot\nDisallow: /private\nAllow: /private/about\n`;
    expect(robotsAllows(txt, "HuesSeedFinderBot", "/")).toBe(true);
    expect(robotsAllows(txt, "HuesSeedFinderBot", "/private/x")).toBe(false);
    expect(robotsAllows(txt, "HuesSeedFinderBot", "/private/about")).toBe(true);
    expect(robotsAllows(txt, "OtherBot", "/")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow:\n", "HuesSeedFinderBot", "/anything")).toBe(true);
    expect(robotsAllows("", "HuesSeedFinderBot", "/")).toBe(true);
    expect(robotsAllows("User-agent: *\nDisallow: /*.pdf$\n", "HuesSeedFinderBot", "/a.pdf")).toBe(false);
  });
});
