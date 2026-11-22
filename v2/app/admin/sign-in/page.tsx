/**
 * Admin sign-in, step 1: email (spec §7 A1) + the expired-session welcome back (A3) and the
 * signed-out confirmation. A single centered card — a flow, not a page. Unknown and known
 * emails behave identically (no account enumeration): the flow always advances to the code
 * step. A live admin session skips straight to the return path.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServices } from "@/lib/services/context";
import { SESSION_COOKIE } from "@/lib/accounts";
import { ADMIN_RESEND_MESSAGES } from "@/lib/services/admin-auth";
import { ADMIN_SESSION_COOKIE, firstParam, safeAdminNext } from "@/lib/admin-auth";
import { BusyForm } from "@/components/admin/BusyForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const ERRORS: Record<string, string> = {
  send_failed: "We couldn’t send the email — check the address and try again.",
  missing_email: "Enter your email address.",
  resend_too_soon: ADMIN_RESEND_MESSAGES.resend_too_soon,
  resend_limit: ADMIN_RESEND_MESSAGES.resend_limit,
};

export default async function AdminSignInPage({ searchParams }: Props) {
  const sp = await searchParams;
  const services = await getServices();
  const jar = await cookies();
  const next = safeAdminNext(firstParam(sp.next)) ?? "/admin";
  if (await services.adminAuth.userForAdminSession(jar.get(ADMIN_SESSION_COOKIE)?.value)) redirect(next);

  const email = firstParam(sp.email);
  const expired = firstParam(sp.expired) === "1";
  const signedOut = firstParam(sp.signedout) === "1";
  const errorKey = firstParam(sp.error);
  const error = errorKey ? (ERRORS[errorKey] ?? null) : null;
  const visitor = signedOut ? await services.accounts.userForSession(jar.get(SESSION_COOKIE)?.value) : null;

  return (
    <div className="admin-root mx-auto w-full max-w-[420px] pt-8">
      <div className="card flex flex-col gap-3 p-5 admin:p-6">
        <p className="text-center font-sans text-sm font-semibold text-muted">Seed Directory</p>
        <div aria-hidden="true" className="divider-stem" />
        <h1 className="text-[28px] font-semibold leading-[1.15]">Admin sign-in</h1>
        {expired ? (
          <p role="status" className="rounded-field bg-paper-deep p-3 font-sans text-[15px]">
            Your admin session ended — admin sessions last a week. Sign in again to pick up where you left off.
          </p>
        ) : null}
        {signedOut ? (
          <p role="status" className="rounded-field bg-paper-deep p-3 font-sans text-[15px]">
            {visitor ? "You signed out of admin — you’re still signed in to your Seed Directory account." : "You signed out of admin."}
          </p>
        ) : null}
        <p className="font-serif text-[17px] leading-[1.6]">Sign in with the email on your Seed Directory account.</p>
        {error ? (
          <p role="alert" className="rounded-field bg-warn-50 p-3 font-sans text-[15px] font-medium text-warn">
            {error}
          </p>
        ) : null}
        <BusyForm action="/admin/sign-in/request" submitLabel="Email me a code" busyLabel="Sending…">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="admin-email" className="font-sans text-sm font-semibold">
            Email
          </label>
          <input id="admin-email" name="email" type="email" required autoComplete="email" defaultValue={email ?? ""} className="field" />
        </BusyForm>
        <p className="font-sans text-sm">
          <a href="/">Back to seeds.hues.flowers</a>
        </p>
      </div>
    </div>
  );
}
