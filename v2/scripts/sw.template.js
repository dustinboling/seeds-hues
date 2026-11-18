/*
 * seeds.hues.flowers service worker — hand-rolled (spec §5 P4/P5/P6). Generated into
 * public/sw.js by scripts/build-sw.mjs, which stamps a per-build version below.
 *
 * Strategies:
 *   precache   app shell: /, /offline, manifest, icons + the /_next/static assets /offline uses
 *   pages      stale-while-revalidate (falls back to /offline when nothing is cached)
 *   /api/*     network-first, last-good cached copy offline
 *   statics    cache-first (/_next/static is content-hashed and immutable)
 *   cross-origin requests (seller links, analytics) are never intercepted.
 *   per-user pages + endpoints (/account, /admin, /add-your-farm, /unsubscribe, /api/v1/account …)
 *              are never intercepted or cached.
 *
 * Self-applying updates: every build has a new VERSION → new cache names. install() calls
 * skipWaiting(); activate() deletes every older cache and calls clients.claim(); the page-side
 * registration reloads once on `controllerchange`. Nobody is stranded on a stale shell.
 */
const VERSION = "__SW_VERSION__";
const SHELL = `seeds-shell-${VERSION}`;
const PAGES = `seeds-pages-${VERSION}`;
const STATIC = `seeds-static-${VERSION}`;
const API = `seeds-api-${VERSION}`;
const CURRENT = [SHELL, PAGES, STATIC, API];
const OFFLINE_URL = "/offline";
const PRECACHE = ["/", OFFLINE_URL, "/manifest.webmanifest", "/icons/hues-icon.svg", "/icons/hues-icon-192.png", "/icons/hues-icon-512.png"];
const MAX_PAGES = 150;
const MAX_API = 200;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      await shell.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" })));
      // Precache the CSS/JS chunks the offline page needs so it renders fully offline.
      try {
        const res = await shell.match(OFFLINE_URL);
        const html = res ? await res.text() : "";
        const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) || [])];
        const stat = await caches.open(STATIC);
        await Promise.all(assets.map((a) => stat.add(a).catch(() => undefined)));
      } catch {
        /* best effort */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("seeds-") && !CURRENT.includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "GET_VERSION" && event.source) event.source.postMessage({ type: "SW_VERSION", version: VERSION });
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirstApi(request) {
  const cache = await caches.open(API);
  try {
    const res = await fetch(request);
    if (res.ok) {
      cache.put(request, res.clone()).then(() => trim(API, MAX_API));
    }
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    return new Response(
      JSON.stringify({ data: null, meta: null, error: { code: "internal", message: "You are offline and this response is not saved." } }),
      { status: 503, headers: { "Content-Type": "application/json; charset=utf-8", "X-Robots-Tag": "noindex" } },
    );
  }
}

async function staleWhileRevalidatePage(event) {
  const request = event.request;
  const cache = await caches.open(PAGES);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok && res.type === "basic" && !res.redirected) {
        cache.put(request, res.clone()).then(() => trim(PAGES, MAX_PAGES));
      }
      return res;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(network);
    return hit;
  }
  const res = await network;
  if (res) return res;
  const shell = await caches.open(SHELL);
  return (await shell.match(request)) || (await shell.match(OFFLINE_URL)) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept seller links / third parties
  if (url.pathname === "/sw.js") return;
  // Click redirects and key-gated API trees are never cached or intercepted.
  if (url.pathname.startsWith("/go/") || /^\/api\/v1\/(ingest|admin|reports)(\/|$)/.test(url.pathname)) return;
  // Per-user pages and endpoints (Phase 3 accounts / alerts) are never cached: a stale copy could
  // show one person's account after sign-out, or keep personal data on the device.
  if (/^\/(account|admin|add-your-farm|unsubscribe)(\/|$)/.test(url.pathname)) return;
  if (/^\/api\/v1\/(account|internal|farm-submissions|unsubscribe|webhooks)(\/|$)/.test(url.pathname)) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstApi(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // React Server Component payloads for client navigations: network only. If offline the
  // router falls back to a document navigation, which the page strategy below serves.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate" || (request.headers.get("Accept") || "").includes("text/html")) {
    event.respondWith(staleWhileRevalidatePage(event));
  }
});
