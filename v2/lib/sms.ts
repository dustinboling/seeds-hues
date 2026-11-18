/**
 * sendSms() beside sendEmail() (USER-ACCOUNTS-DESIGN §4a). Texts are used for exactly two things
 * in Phase 3: the one-time alert-number verification code and the waiting-list "found" alert.
 *
 * Provider switch: SMS_PROVIDER = 'twilio' | 'pinpoint' | 'mock' (unset = not configured).
 *  - twilio   — the real adapter (provider lean 2026-11-16: Twilio also carries the Phase 4 IVR).
 *               Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (Worker secrets). Sender:
 *               SMS_SENDER_ID = the registered toll-free/10DLC number in E.164, or a Messaging
 *               Service SID ("MG…").
 *  - pinpoint — AWS End User Messaging: a stub behind the same interface (reports not configured).
 *  - mock     — records messages in memory (tests, local dev); never leaves the process.
 * No provider configured → sms rows stay queued and the drain reports `sms_not_configured`.
 * STOP/HELP keywords are handled by the provider; /api/v1/webhooks/twilio/sms also clears
 * sms_opt_in the moment Twilio forwards a STOP.
 */

export const SMS_PROVIDERS = ["twilio", "pinpoint", "mock"] as const;
export type SmsProviderName = (typeof SMS_PROVIDERS)[number];

export type SmsResult = { ok: true; id: string } | { ok: false; code: string; message?: string };

export interface SmsProvider {
  readonly name: SmsProviderName;
  send(toE164: string, body: string): Promise<SmsResult>;
}

export interface SmsConfig {
  provider: string | null;
  senderId: string | null;
  twilioAccountSid?: string | null;
  twilioAuthToken?: string | null;
  fetchFn?: typeof fetch;
}

/** 10-digit US number → E.164. */
export const toE164 = (digits10: string) => `+1${digits10}`;

/** Messages accepted by every mock provider instance in this isolate (tests read + clear it). */
export const MOCK_SMS_OUTBOX: { to: string; body: string; at: string }[] = [];

export function mockSmsProvider(opts: { fail?: boolean } = {}): SmsProvider {
  return {
    name: "mock",
    async send(to, body) {
      if (opts.fail) return { ok: false, code: "mock_failure" };
      MOCK_SMS_OUTBOX.push({ to, body, at: new Date().toISOString() });
      if (typeof process !== "undefined" && process.env.NODE_ENV === "development") console.log(`[mock sms] → ${to}: ${body}`);
      return { ok: true, id: `mock-${MOCK_SMS_OUTBOX.length}` };
    },
  };
}

export function twilioSmsProvider(cfg: { accountSid: string; authToken: string; senderId: string; fetchFn?: typeof fetch }): SmsProvider {
  const f = cfg.fetchFn ?? fetch;
  return {
    name: "twilio",
    async send(to, body) {
      const form = new URLSearchParams({ To: to, Body: body });
      if (cfg.senderId.startsWith("MG")) form.set("MessagingServiceSid", cfg.senderId);
      else form.set("From", cfg.senderId);
      try {
        const res = await f(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${btoa(`${cfg.accountSid}:${cfg.authToken}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: form,
        });
        const out = (await res.json().catch(() => ({}))) as { sid?: string; code?: number; message?: string };
        if (res.ok && out.sid) return { ok: true, id: out.sid };
        return { ok: false, code: `twilio_${out.code ?? res.status}`, message: out.message?.slice(0, 200) };
      } catch (err) {
        return { ok: false, code: "twilio_unreachable", message: err instanceof Error ? err.message.slice(0, 200) : undefined };
      }
    },
  };
}

/** The configured provider, or null (→ sms_not_configured). */
export function getSmsProvider(cfg: SmsConfig): SmsProvider | null {
  switch (cfg.provider?.trim().toLowerCase()) {
    case "mock":
      return mockSmsProvider();
    case "twilio":
      if (!cfg.twilioAccountSid || !cfg.twilioAuthToken || !cfg.senderId) return null;
      return twilioSmsProvider({ accountSid: cfg.twilioAccountSid, authToken: cfg.twilioAuthToken, senderId: cfg.senderId, fetchFn: cfg.fetchFn });
    case "pinpoint":
      // AWS End User Messaging adapter: stub only (provider decision leans Twilio; FREE-plan
      // availability unverified). Reported as not configured so rows stay queued.
      return null;
    default:
      return null;
  }
}

export async function sendSms(provider: SmsProvider | null, toDigits10: string, body: string): Promise<SmsResult> {
  if (!provider) return { ok: false, code: "sms_not_configured" };
  return provider.send(toE164(toDigits10), body);
}

/**
 * Twilio webhook signature (X-Twilio-Signature): base64(HMAC-SHA1(authToken, url + each POST
 * param name+value in name order)). WebCrypto only.
 */
export async function twilioSignature(authToken: string, url: string, params: Record<string, string>): Promise<string> {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  return btoa(String.fromCharCode(...sig));
}

/** Carrier/Twilio opt-out keywords (Twilio "Advanced Opt-Out" defaults). */
export const STOP_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"];
