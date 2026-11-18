/**
 * Non-DB Worker bindings/vars used by the API layer, built from the raw Worker env. Kept free of
 * the request-context import so the cron handler (lib/jobs/scheduled.ts) can use it too.
 * (The D1 binding is read only in lib/db/client.)
 */
import { SITE_URL } from "@/lib/config";
import { DEV_CLICK_SALT } from "@/lib/services/clicks";
import { DEV_UNSUBSCRIBE_KEY } from "@/lib/accounts";
import type { SendEmailBinding } from "@/lib/mail";
import type { SmsConfig } from "@/lib/sms";

export interface RuntimeEnv {
  siteUrl: string;
  corsOrigins: string[];
  rateLimiter: RateLimit | null;
  /** Per-bucket limiters (canonical §3 rate limits): search 60/min, reports 3/min, ingest 600/min. */
  limiters?: { search: RateLimit | null; reports: RateLimit | null; ingest: RateLimit | null };
  snapshots: R2Bucket | null;
  revalidateToken: string | null;
  turnstileSecret?: string | null;
  /** Public Turnstile site key (TURNSTILE_SITE_KEY var, else NEXT_PUBLIC_TURNSTILE_SITE_KEY). */
  turnstileSiteKey?: string | null;
  /** Salt for click_events.visitor_day_hash; a dev constant when CLICK_HASH_SALT is unset. */
  clickSalt?: string;
  /** Cloudflare Email Sending `send_email` binding (EMAIL) — absent until the domain is onboarded. */
  mail?: SendEmailBinding | null;
  sms?: SmsConfig;
  /** UNSUBSCRIBE_SIGNING_KEY (a dev constant under `next dev` only). */
  unsubscribeKey?: string | null;
  adminNotifyEmail?: string | null;
}

type Env = CloudflareEnv & {
  REVALIDATE_TOKEN?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  CLICK_HASH_SALT?: string;
  EMAIL?: SendEmailBinding;
  SMS_PROVIDER?: string;
  SMS_SENDER_ID?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  UNSUBSCRIBE_SIGNING_KEY?: string;
  ADMIN_NOTIFY_EMAIL?: string;
};

/** Build the RuntimeEnv from raw Worker bindings (request context or the scheduled handler). */
export function runtimeEnvFrom(env: unknown): RuntimeEnv {
  const e = env as Env;
  const dev = typeof process !== "undefined" && process.env.NODE_ENV === "development";
  return {
    siteUrl: (e.SITE_URL || SITE_URL).replace(/\/$/, ""),
    corsOrigins: String(e.CORS_ALLOWED_ORIGINS ?? SITE_URL)
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0 && o !== "*"),
    rateLimiter: e.API_RATE_LIMITER ?? null,
    limiters: {
      search: e.SEARCH_RATE_LIMITER ?? null,
      reports: e.REPORTS_RATE_LIMITER ?? null,
      ingest: e.INGEST_RATE_LIMITER ?? null,
    },
    snapshots: e.SNAPSHOTS ?? null,
    revalidateToken: e.REVALIDATE_TOKEN?.trim() || null,
    turnstileSecret: e.TURNSTILE_SECRET_KEY?.trim() || null,
    turnstileSiteKey: e.TURNSTILE_SITE_KEY?.trim() || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null,
    clickSalt: e.CLICK_HASH_SALT?.trim() || DEV_CLICK_SALT,
    mail: e.EMAIL ?? null,
    sms: {
      provider: e.SMS_PROVIDER?.trim() || null,
      senderId: e.SMS_SENDER_ID?.trim() || null,
      twilioAccountSid: e.TWILIO_ACCOUNT_SID?.trim() || null,
      twilioAuthToken: e.TWILIO_AUTH_TOKEN?.trim() || null,
    },
    unsubscribeKey: e.UNSUBSCRIBE_SIGNING_KEY?.trim() || (dev ? DEV_UNSUBSCRIBE_KEY : null),
    adminNotifyEmail: e.ADMIN_NOTIFY_EMAIL?.trim() || null,
  };
}
