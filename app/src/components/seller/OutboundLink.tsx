import type { ReactNode } from "react";

/**
 * Direct link to a seller's own site (seller page "Visit" link) +
 * fire-and-forget legacy beacon to /api/track. Shop buttons for listings
 * go through /go/{listing_id} instead (R7). Outbound links carry
 * rel="nofollow noopener" (R6). Ported from v2's OutboundLink.
 */
export function OutboundLink({
  href,
  seller,
  variety,
  className,
  children,
}: {
  href: string;
  seller: string;
  variety?: string | null;
  className?: string;
  children: ReactNode;
}) {
  function track() {
    try {
      const body = JSON.stringify({ seller, variety: variety ?? null, href });
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      }
    } catch {
      /* never interfere with navigation */
    }
  }
  return (
    <a href={href} rel="nofollow noopener noreferrer" target="_blank" className={className} onClick={track} onAuxClick={track}>
      {children}
      <span className="sr-only"> (opens the seller’s site in a new tab)</span>
    </a>
  );
}
