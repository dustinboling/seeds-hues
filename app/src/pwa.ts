/**
 * PWA registration snippet. The shell inlines this exact script (production
 * builds only); the PWA assertion matches it in the built HTML, so the
 * registration code and its proof cannot drift apart.
 */
export const SW_URL = "/sw.js";

/** Idempotent registration: no-ops where service workers are unsupported. */
export function buildRegistrationScript(): string {
  return (
    `if("serviceWorker" in navigator){` +
    `window.addEventListener("load",function(){` +
    `navigator.serviceWorker.register("${SW_URL}").catch(function(){})` +
    `})}`
  );
}
