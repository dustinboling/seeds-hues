import { useEffect, useState } from "react";

/**
 * The admin viewport bands (v2 §4): phone below 744px, iPad 744–1180px
 * (1180px belongs to the iPad band), desktop from 1181px. The admin is
 * iPad-first: master–detail from 744px up, the phone tab bar + single
 * pane below. The SSR default is the iPad band (1024) — the primary
 * surface — and the client corrects on mount.
 */
export type AdminViewportBand = "phone" | "ipad" | "desktop";

export function viewportBand(width: number): AdminViewportBand {
  if (width < 744) return "phone";
  if (width <= 1180) return "ipad";
  return "desktop";
}

export function useAdminViewport(): { width: number; band: AdminViewportBand } {
  const [width, setWidth] = useState<number>(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
  useEffect(() => {
    const onResize = (): void => setWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return { width, band: viewportBand(width) };
}
