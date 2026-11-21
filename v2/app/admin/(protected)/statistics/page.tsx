/**
 * Statistics section (Slice D, spec §7 H): how the site is doing (the four site
 * stat cards — Visitors in its not-connected state, the other three live) and
 * which varieties are popular (the Views · Clicks · Waitlist · Searches signal
 * switcher over one ranking centerpiece). Server-rendered and read-only; identical
 * for Admin and Reviewer. The header band is not sticky (gate Finding 7) — every
 * card caption restates the range instead. One card's failure never blanks the
 * section: the read model degrades per signal to its error state.
 */
import type { Metadata } from "next";
import { adminPageData } from "@/lib/admin-current-user";
import { firstParam } from "@/lib/admin-auth";
import { getServices } from "@/lib/services/context";
import { parseStatisticsParams } from "@/lib/admin/statistics";
import { AdminShell } from "@/components/admin/AdminShell";
import { PopularityTables } from "./_components/popularity";
import { SignalControl, TimeRangeControl } from "./_components/time-range-control";
import { SiteStatCard } from "./_components/site-stat-card";
import { statisticsHref } from "./_components/urls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Statistics" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminStatisticsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const params = parseStatisticsParams({ range: firstParam(sp.range), signal: firstParam(sp.signal), show: firstParam(sp.show) });
  const returnTo = statisticsHref(params);
  const { viewer, totalWaiting } = await adminPageData(returnTo);
  const services = await getServices();
  const [overview, popularity] = await Promise.all([
    services.adminStatistics.overview(params.range),
    services.adminStatistics.popularity(params.range, params.signal, params.show),
  ]);

  return (
    <AdminShell viewer={viewer} section="statistics" reviewTotal={totalWaiting}>
      <header className="flex flex-col gap-3">
        <h1 className="text-[28px] font-semibold leading-[1.15]">Statistics</h1>
        <TimeRangeControl range={params.range} signal={params.signal} show={params.show} words={overview.period.words} />
      </header>

      <div className="mt-4 grid grid-cols-1 gap-4 min-[744px]:grid-cols-2">
        {overview.cards.map((card) => (
          <SiteStatCard key={card.key} card={card} retryHref={returnTo} />
        ))}
      </div>

      <section aria-labelledby="popularity-heading" className="mt-6">
        <h2 id="popularity-heading" className="text-xl font-semibold">
          Variety popularity
        </h2>
        <div className="mt-3">
          <SignalControl range={params.range} signal={params.signal} show={params.show} />
        </div>
        <div className="mt-4">
          <PopularityTables data={popularity} range={params.range} signal={params.signal} show={params.show} retryHref={returnTo} />
        </div>
      </section>
    </AdminShell>
  );
}
