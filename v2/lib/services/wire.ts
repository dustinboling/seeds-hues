/** Services wired to the Worker bindings — shared by requests (context.ts) and the cron handler. */
import type { Db } from "@/lib/db/client";
import type { RuntimeEnv } from "@/lib/api/env-config";
import { bindingMailer } from "@/lib/mail";
import { getSmsProvider } from "@/lib/sms";
import { createServices, type Services } from "./index";

export function servicesFor(db: Db, env: RuntimeEnv): Services {
  return createServices(db, {
    snapshots: env.snapshots,
    turnstileSecret: env.turnstileSecret,
    mailer: bindingMailer(env.mail),
    sms: env.sms ? getSmsProvider(env.sms) : null,
    siteUrl: env.siteUrl,
    unsubscribeKey: env.unsubscribeKey ?? null,
    adminNotifyEmail: env.adminNotifyEmail ?? null,
    analyticsToken: env.analyticsToken ?? null,
  });
}
