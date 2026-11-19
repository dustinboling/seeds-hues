import type { Metadata } from "next";
import Link from "next/link";
import { AccountPanel } from "@/components/account/AccountPanel";
import { CreateAccountForm } from "@/components/account/CreateAccountForm";
import { SignInForm } from "@/components/account/SignInForm";
import { ThemeArt } from "@/components/ui/ThemeArt";
import { getRuntimeEnv } from "@/lib/api/runtime-env";
import { pageMetadata } from "@/lib/seo/metadata";
import { getServices } from "@/lib/services/context";
import { publicUser } from "@/lib/services/accounts";
import { getCurrentUserRow } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Your account",
  description: "Sign in or create a Seed Directory account to join waiting lists and get an alert when a variety is found.",
  path: "/account",
  noindex: true,
  follow: true,
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AccountPage({ searchParams }: Props) {
  const [sp, row, env] = await Promise.all([searchParams, getCurrentUserRow(), getRuntimeEnv()]);
  if (row) {
    const { accounts } = await getServices();
    return (
      <article className="max-w-3xl" aria-labelledby="account-title">
        <AccountPanel user={publicUser(row)} alerts={await accounts.alerts(row)} />
      </article>
    );
  }
  const siteKey = env.turnstileSiteKey ?? null;
  return (
    <article className="max-w-3xl" aria-labelledby="account-title">
      {/* Page head (spot-slots §3, §5): text first, then the decorative seed-packet organiser —
          beside it from md up, centred below the intro on phones. Signed-out render only; the
          signed-in panel above carries no painting and reserves no space for one. */}
      <div className="md:grid md:grid-cols-[1fr_320px] md:items-center md:gap-8">
        <div>
          <h1 id="account-title" className="text-3xl font-semibold text-leaf">
            Your Seed Directory account
          </h1>
          {sp.deleted ? (
            <p role="status" className="card mt-4 p-4 font-medium">
              Your account and everything in it has been deleted.
            </p>
          ) : null}
          <p className="mt-3 text-lg">
            An account lets you join waiting lists: we’ll text and email you when a farm lists a variety you’re after. No password — you sign in with your email and phone number.
          </p>
        </div>
        <div>
          <ThemeArt name="account-organizer" priority className="art-frame mx-auto mt-4 h-auto w-full max-w-[280px] md:mt-0 md:max-w-none" />
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-10 md:grid-cols-2">
        <section aria-labelledby="create-title" className="flex flex-col gap-4">
          <h2 id="create-title" className="text-2xl font-semibold">
            New here? Create an account
          </h2>
          <CreateAccountForm siteKey={siteKey} />
        </section>
        <section aria-labelledby="signin-title" className="flex flex-col gap-4">
          <h2 id="signin-title" className="text-2xl font-semibold">
            Already have one? Sign in
          </h2>
          <SignInForm siteKey={siteKey} />
          <p className="text-sm text-muted">
            Changed your phone number? Create a fresh account and ask us (see <Link href="/about">About</Link>) to move your waiting lists across.
          </p>
        </section>
      </div>
    </article>
  );
}
