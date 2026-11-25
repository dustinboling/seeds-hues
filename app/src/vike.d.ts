import type { CatalogApi } from "./data/api";
import type { DataCache } from "./data/cache";

declare global {
  // The server (Node harness now, the Worker at cutover) passes its ONE
  // catalog client + data cache per render via pageContextInit, so +data
  // hooks and the revalidate purge share a single instance. Absent during
  // prerender builds, where the hooks fall back to the process singletons.
  // https://vike.dev/pageContext#typescript
  namespace Vike {
    interface PageContext {
      catalogApi?: CatalogApi;
      dataCache?: DataCache;
      /** The Turnstile site key, passed per render (the Worker-safe path — no process.env). */
      turnstileSiteKey?: string | null;
      /** A floor POST's outcome, passed to the POST render only (report/farm forms). */
      formOutcome?: unknown;
      /** The admin service origin (the backend's internal admin endpoints), passed per render. */
      adminApiBase?: string;
      /** The request's Cookie header, passed per render for the admin gate. */
      requestCookie?: string | null;
    }
  }
}

export {};
