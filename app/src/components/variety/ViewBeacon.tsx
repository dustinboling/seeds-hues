import { useEffect } from "react";

/** Counts one page view per variety page load. No cookies. Ported from v2 (renders null). */
export function ViewBeacon({ varietySlug }: { varietySlug: string }) {
  useEffect(() => {
    try {
      const body = JSON.stringify({ type: "view", varietySlug });
      if ("sendBeacon" in navigator) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } catch {
      /* measurement never interferes with the page */
    }
  }, [varietySlug]);
  return null;
}
