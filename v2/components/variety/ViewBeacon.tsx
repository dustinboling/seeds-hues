"use client";

import { useEffect } from "react";

/** Counts one page view per variety page load (R14 → variety_view_counts). No cookies. */
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
