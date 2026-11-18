import type { Metadata } from "next";
import Link from "next/link";
import { UnsubscribeButton } from "@/components/account/UnsubscribeButton";
import { pageMetadata } from "@/lib/seo/metadata";
import { getServices } from "@/lib/services/context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Unsubscribe",
  description: "Stop Seed Directory waiting-list alerts for one variety or for everything.",
  path: "/unsubscribe",
  noindex: true,
  follow: false,
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * GET /unsubscribe?token=… — the per-variety and global unsubscribe links in every alert email.
 * Signed token, no sign-in. The page names what the link does and asks for one click to confirm
 * (a GET never changes anything, so mail link-scanners can’t unsubscribe anyone); mail clients
 * use the RFC 8058 one-click POST at /api/v1/unsubscribe.
 */
export default async function UnsubscribePage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = (Array.isArray(sp.token) ? sp.token[0] : sp.token) ?? "";
  const { accounts } = await getServices();
  const scope = token && token.length <= 200 ? await accounts.describeUnsubscribe(token) : null;
  return (
    <article className="max-w-2xl" aria-labelledby="unsub-title">
      <h1 id="unsub-title" className="text-3xl font-semibold text-leaf">
        Unsubscribe
      </h1>
      {!scope ? (
        <p className="mt-3">
          This unsubscribe link isn’t valid. You can manage every alert from <Link href="/account">your account</Link>.
        </p>
      ) : scope.kind === "all" ? (
        <>
          <p className="mt-3">Stop every Seed Directory waiting-list alert (email and text) for this account? Your lists are kept, and you can switch alerts back on from your account.</p>
          <UnsubscribeButton token={token} label="Unsubscribe from all alerts" doneText="Done — you won’t get any more waiting-list alerts." />
        </>
      ) : (
        <>
          <p className="mt-3">
            Leave the waiting list for <strong>{scope.variety?.name ?? "this variety"}</strong>? You won’t get alerts for it any more.
          </p>
          <UnsubscribeButton token={token} label="Leave this waiting list" doneText="Done — you’ve left that waiting list." />
        </>
      )}
      <p className="mt-6 text-sm text-muted">
        Manage all your lists in <Link href="/account">your account</Link>.
      </p>
    </article>
  );
}
