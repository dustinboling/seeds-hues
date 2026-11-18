import type { Db } from "@/lib/db/client";
import { createAdminService } from "./admin";
import { createAuthService } from "./auth";
import { createCatalogService } from "./catalog";
import { createClickService } from "./clicks";
import { createIngestService } from "./ingest";
import { createReportService } from "./reports";
import { createSyncService } from "./sync";
import { createAccountService } from "./accounts";
import { createFarmService } from "./farms";
import { createNotificationService } from "./notifications";
import { createVerificationService, type CodeChannel } from "./verification";
import { idempotentResponse, storeIdempotentResponse } from "@/lib/repositories/reports";
import { NO_MAILER, type Mailer } from "@/lib/mail";
import type { SmsProvider } from "@/lib/sms";
import { SITE_URL } from "@/lib/config";

export interface ServiceDeps {
  /** SNAPSHOTS R2 bucket (ingest snapshots at fetch/{hash}.txt). */
  snapshots?: R2Bucket | null;
  /**
   * TURNSTILE_SECRET_KEY. /report verifies only when this is set (R8); the Phase 3 forms
   * (accounts, waiting lists, Add Your Farm) FAIL CLOSED without it (lib/turnstile.ts).
   */
  turnstileSecret?: string | null;
  /** siteverify fetch override (tests). */
  turnstileFetch?: typeof fetch;
  /** sendEmail() behind the Workers send_email binding; NO_MAILER when unbound. */
  mailer?: Mailer;
  /** The configured SMS provider, or null (sms_not_configured). */
  sms?: SmsProvider | null;
  siteUrl?: string;
  /** HMAC key for unsubscribe links (UNSUBSCRIBE_SIGNING_KEY). Alert email needs it. */
  unsubscribeKey?: string | null;
  /** Where Add Your Farm admin notices go (ADMIN_NOTIFY_EMAIL); null = not sent. */
  adminNotifyEmail?: string | null;
  now?: () => Date;
  /** Test hook: plaintext verification codes at issue time. */
  onCode?: (channel: CodeChannel, userId: number, code: string) => void;
}

export function createServices(db: Db, deps: ServiceDeps = {}) {
  const mailer = deps.mailer ?? NO_MAILER;
  const sms = deps.sms ?? null;
  const siteUrl = (deps.siteUrl ?? SITE_URL).replace(/\/$/, "");
  const now = deps.now ?? (() => new Date());
  const turnstile = { secret: deps.turnstileSecret ?? null, fetchFn: deps.turnstileFetch };
  const verification = createVerificationService(db, { mailer, sms, siteUrl, now, onCode: deps.onCode });
  return {
    catalog: createCatalogService(db),
    clicks: createClickService(db),
    sync: createSyncService(db),
    admin: createAdminService(db),
    auth: createAuthService(db),
    ingest: createIngestService(db, { snapshots: deps.snapshots ?? null }),
    reports: createReportService(db, { turnstileSecret: deps.turnstileSecret ?? null, fetchFn: deps.turnstileFetch }),
    accounts: createAccountService(db, { turnstile, verification, unsubscribeKey: deps.unsubscribeKey ?? null, now }),
    farms: createFarmService(db, { turnstile, mailer, siteUrl, adminNotifyEmail: deps.adminNotifyEmail ?? null, now }),
    notifications: createNotificationService(db, { mailer, sms, siteUrl, unsubscribeKey: deps.unsubscribeKey ?? null, now }),
    /** Idempotency-Key replay store for ingest/admin POSTs. */
    idempotency: {
      get: (key: string) => idempotentResponse(db, key),
      put: (row: { key: string; endpoint: string; response: string; createdAt: string }) => storeIdempotentResponse(db, row),
    },
  };
}

export type Services = ReturnType<typeof createServices>;
