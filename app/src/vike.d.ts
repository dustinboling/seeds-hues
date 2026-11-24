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
    }
  }
}

export {};
