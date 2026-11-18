import type { Metadata } from "next";
import Link from "next/link";
import { AddYourFarmForm } from "@/components/farm/AddYourFarmForm";
import { getRuntimeEnv } from "@/lib/api/runtime-env";
import { stateByCode, US_STATES } from "@/lib/data/states";
import { pageMetadata } from "@/lib/seo/metadata";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Add Your Farm",
  description: "Sell flower seed from your small farm? Add your farm to the Seed Directory — free, reviewed by hand, never pay-for-placement.",
  path: "/add-your-farm",
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AddYourFarmPage({ searchParams }: Props) {
  const [sp, user, env] = await Promise.all([searchParams, getCurrentUser(), getRuntimeEnv()]);
  const rawState = Array.isArray(sp.state) ? sp.state[0] : sp.state;
  const state = stateByCode(rawState?.toUpperCase())?.code ?? null;
  const states = [...US_STATES].sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ code: s.code, name: s.name }));
  return (
    <article className="max-w-3xl" aria-labelledby="farm-title">
      <h1 id="farm-title" className="text-3xl font-semibold text-leaf">
        Add Your Farm
      </h1>
      <p className="mt-3 text-lg">
        Grow and sell flower seed? Put your farm in front of gardeners looking for exactly the varieties you grow. Listing is free, sellers never pay for placement, and every farm is reviewed by a person.
      </p>
      <p className="mt-2 text-muted">
        {user ? (
          <>Signed in as {user.email} — we’ve filled in your contact details.</>
        ) : (
          <>
            Have a Seed Directory account? <Link href="/account">Sign in</Link> first and we’ll link this farm to it.
          </>
        )}
      </p>
      <AddYourFarmForm siteKey={env.turnstileSiteKey ?? null} states={states} defaults={{ contactName: user?.name ?? "", contactEmail: user?.email ?? "", state }} />
    </article>
  );
}
