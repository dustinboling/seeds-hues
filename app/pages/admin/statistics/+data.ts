import type { PageContextServer } from "vike/types";
import { adminMeForPage } from "../../../src/server/admin-page";
import { parseStatisticsParams, type StatRange, type StatSignal } from "../../../src/lib/admin/statistics";

// https://vike.dev/data — the statistics shell read: the viewer frame
// plus the range/signal/show segment (the numbers load client-side;
// the no-JS HTML carries headings only).
export async function data(pageContext: PageContextServer): Promise<{
  viewer: { name: string; email: string; role: string } | null;
  range: StatRange;
  signal: StatSignal;
  show: number;
}> {
  const search = new URLSearchParams(pageContext.urlParsed.searchOriginal ?? "");
  const me = await adminMeForPage(pageContext);
  const params = parseStatisticsParams({ range: search.get("range"), signal: search.get("signal"), show: search.get("show") });
  return {
    viewer: me.user ? { name: me.user.name, email: me.user.email, role: me.user.role } : null,
    range: params.range,
    signal: params.signal,
    show: params.show,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
