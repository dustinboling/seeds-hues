/**
 * Service-worker skeleton (Workbox injectManifest). Slice 1 scope: register,
 * take control on install, drop outdated precaches, and serve the injected
 * precache manifest (shell HTML + manifest + icons). Offline behaviour and
 * caching strategies are later slices.
 *
 * Deferred to cutover (Slice 9, ARCHITECTURE-BRIEF.md §3): purging the retired
 * Next-era caches (the seeds-shell, seeds-pages, seeds-static, and seeds-api
 * families) on activate so no visitor is stranded on the old shell.
 */
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Self-applying updates (mirrors v2's sw.template.js discipline): every build
// produces a new precache revision, the new worker activates immediately, and
// outdated precaches are dropped.
self.addEventListener("install", () => {
  void self.skipWaiting();
});
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
