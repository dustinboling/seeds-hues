/**
 * Admin sign-in, step 2: code entry (spec §7 A2). The code field states the real TTL from
 * the shared constant; wrong/expired/dead codes get the designed inline states, and the
 * typed email carries through from step 1. A live admin session skips to the return path.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServices } from "@/lib/services/context";
import { ADMIN_CODE_MESSAGES, ADMIN_RESEND_MESSAGES } from "@/lib/services/admin-auth";
import { ADMIN_CODE_TTL_MINUTES, ADMIN_SESSION_COOKIE, firstParam, safeAdminNext } from "@/lib/admin-auth";
import { BusyForm } from "@/components/admin/BusyForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Enter your code", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminCodePage({ searchParams }: Props) {
  const sp = await searchParams;
  const services = await getServices();
  const next = safeAdminNext(firstParam(sp.next)) ?? "/admin";
  if (await services.adminAuth.userForAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value)) redirect(next);

  const email = firstParam(sp.email);
  if (!email) redirect(next === "/admin" ? "/admin/sign-in" : `/admin/sign-in?next=${encodeURIComponent(next)}`);
  const sent = firstParam(sp.sent) === "1";
  const errorKey = firstParam(sp.error);
  const tries = Number(firstParam(sp.tries) ?? "");
  const error =
    errorKey === "missing_code"
      ? "Enter the 6-digit code."
      : errorKey && errorKey in ADMIN_CODE_MESSAGES
        ? ADMIN_CODE_MESSAGES[errorKey as keyof typeof ADMIN_CODE_MESSAGES] + (errorKey === "code_incorrect" && Number.isInteger(tries) && tries > 0 ? ` (${tries} ${tries === 1 ? "try" : "tries"} left)` : "")
        : errorKey === "resend_too_soon" || errorKey === "resend_limit"
          ? ADMIN_RESEND_MESSAGES[errorKey]
          : null;

  return (
    <div className="admin-root mx-auto w-full max-w-[420px] pt-8">
      <div className="card flex flex-col gap-3 p-5 min-[744px]:p-6">
        <p className="text-center font-sans text-sm font-semibold text-muted">Seed Directory</p>
        <div aria-hidden="true" className="divider-stem" />
        <h1 className="text-[28px] font-semibold leading-[1.15]">Enter your code</h1>
        <p className="font-serif text-[17px] leading-[1.6]">
          We sent a 6-digit code to <strong>{email}</strong>. It works for {ADMIN_CODE_TTL_MINUTES} minutes.
        </p>
        {sent ? (
          <p role="status" className="rounded-[10px] bg-paper-deep p-3 font-sans text-[15px]">
            We sent a new code to {email}.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-[10px] bg-warn-50 p-3 font-sans text-[15px] font-medium text-warn">
            {error}
          </p>
        ) : null}
        <BusyForm action="/admin/sign-in/verify" submitLabel="Verify" busyLabel="Verifying…">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <label htmlFor="admin-code" className="font-sans text-sm font-semibold">
            6-digit code
          </label>
          <input
            id="admin-code"
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            className="field max-w-[9rem] font-mono text-[20px] tracking-[0.2em]"
          />
        </BusyForm>
        <form method="post" action="/admin/sign-in/request" className="flex flex-col gap-3">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="resend" value="1" />
          <div>
            <button type="submit" className="btn btn-secondary">
              Send a new code
            </button>
          </div>
        </form>
        <p className="font-sans text-sm">
          <a href={next === "/admin" ? "/admin/sign-in" : `/admin/sign-in?next=${encodeURIComponent(next)}`}>Use a different email</a>
        </p>
      </div>
    </div>
  );
}
