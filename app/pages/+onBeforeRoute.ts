import { redirect } from "vike/abort";
import type { PageContextServer } from "vike/types";
import { redirectForUrl } from "../src/server/redirects";

// https://vike.dev/onBeforeRoute — the static 301 map (Bea §8.4's variety
// rows: plural legacy paths, legacy ?v=, the internal small-farms path)
// throws before routing, uniformly in dev, preview, and production. Every
// permanent redirect this slice ships is 301, one hop.
export async function onBeforeRoute(pageContext: PageContextServer) {
  const target = redirectForUrl(pageContext.urlOriginal);
  if (target) throw redirect(target, 301);
}
