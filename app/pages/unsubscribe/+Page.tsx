import { useData } from "vike-react/useData";
import "../../src/forms.css";
import { UnsubscribeButton } from "../../src/components/account/UnsubscribeButton";
import type { Data } from "./+data";

/**
 * GET /unsubscribe?token=… — the per-variety and global unsubscribe
 * links in every alert email, ported from v2/app/unsubscribe/page.tsx.
 * Signed token, no sign-in. The page names what the link does and asks
 * for one click to confirm (a GET never changes anything, so mail
 * link-scanners can’t unsubscribe anyone); mail clients use the RFC
 * 8058 one-click POST at /api/v1/unsubscribe.
 */
export default function Page() {
  const { token, scope } = useData<Data>();
  return (
    <article className="form-page-narrow" aria-labelledby="unsub-title">
      <h1 id="unsub-title" className="page-title">
        Unsubscribe
      </h1>
      {!scope ? (
        <p className="page-lede">
          This unsubscribe link isn’t valid. You can manage every alert from <a href="/account">your account</a>.
        </p>
      ) : scope.kind === "all" ? (
        <>
          <p className="page-lede">Stop every Seed Directory waiting-list alert (email and text) for this account? Your lists are kept, and you can switch alerts back on from your account.</p>
          <UnsubscribeButton token={token} label="Unsubscribe from all alerts" doneText="Done — you won’t get any more waiting-list alerts." />
        </>
      ) : (
        <>
          <p className="page-lede">
            Leave the waiting list for <strong>{scope.variety?.name ?? "this variety"}</strong>? You won’t get alerts for it any more.
          </p>
          <UnsubscribeButton token={token} label="Leave this waiting list" doneText="Done — you’ve left that waiting list." />
        </>
      )}
      <p className="form-note-spaced">
        Manage all your lists in <a href="/account">your account</a>.
      </p>
    </article>
  );
}
