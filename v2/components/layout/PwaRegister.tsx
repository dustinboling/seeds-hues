"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js (production only) with self-applying updates (spec §5 P6):
 *  - updateViaCache "none" so the SW script is always revalidated;
 *  - checks for a new SW on load, when the tab becomes visible, and hourly;
 *  - the new SW calls skipWaiting()+clients.claim(); on `controllerchange` the page reloads
 *    ONCE so the user lands on the new shell (never stranded on a stale one). The first install
 *    (no previous controller) does not reload.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reloading = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let registration: ServiceWorkerRegistration | undefined;
    const check = () => {
      registration?.update().catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
        check();
      })
      .catch(() => {});
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, 60 * 60 * 1000);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
