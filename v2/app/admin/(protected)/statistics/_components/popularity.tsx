/**
 * Variety popularity (spec §7 H): the Views/Clicks ranking tables (rank, variety
 * with its F2 + public links, crop, value, movement), the waitlist ranking (current,
 * not period-bound — no movement), and the two searches tables. Real tables with
 * scoped headers; on phones rows reflow to stacked lines with no horizontal scroll.
 * Top 10 by default, widening in place via ?show=25.
 */
import {
  NO_FRUITLESS_LINE,
  NO_RESULTS_LINE,
  NO_SEARCHES_LINE,
  NO_WAITERS_LINE,
  SHOW_DEFAULT,
  SHOW_WIDE,
  statisticsHref,
  type MovementKind,
  type PopularityData,
  type RankRowData,
  type SearchesPopularity,
  type SearchRowData,
  type StatRange,
  type StatSignal,
  type ViewsClicksPopularity,
  type WaitlistPopularity,
  type WaitlistRowData,
} from "@/lib/admin/statistics";

export const WAITLIST_TITLE = "Most-waited varieties";
export const TOP_SEARCHES_TITLE = "Top searches";
export const NO_RESULTS_TITLE = "Searches with no results";

function movementClass(kind: MovementKind): string {
  if (kind === "up") return "text-leaf";
  if (kind === "down") return "text-ink-soft";
  return "text-muted";
}

/** The variety name (F2 link) with its public-page link beside it (new tab). */
function VarietyLinks({ slug, name }: { slug: string; name: string }) {
  return (
    <span>
      <a href={`/admin/varieties?variety=${slug}`} className="font-semibold text-link underline">
        {name}
      </a>{" "}
      <a href={`/variety/${slug}`} target="_blank" rel="noreferrer" aria-label={`${name} public page (opens in a new tab)`} className="whitespace-nowrap text-sm text-link underline">
        Public page
      </a>
    </span>
  );
}

function ShowControl({ range, signal, show, shown, total }: { range: StatRange; signal: StatSignal; show: number; shown: number; total: number }) {
  if (total <= SHOW_DEFAULT) return null;
  const wide = show >= SHOW_WIDE;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="font-sans text-sm tabular-nums text-muted">
        Showing {shown} of {total.toLocaleString("en-US")}.
      </p>
      <a href={wide ? statisticsHref({ range, signal }) : statisticsHref({ range, signal, show: SHOW_WIDE })} className="btn btn-secondary">
        {wide ? "Show top 10" : "Show top 25"}
      </a>
    </div>
  );
}

function ViewsClicksTable({ data, range, signal, show }: { data: ViewsClicksPopularity; range: StatRange; signal: StatSignal; show: number }) {
  const noun = data.valueLabel.toLowerCase();
  return (
    <section aria-labelledby="popularity-table" className="card p-4 admin:p-5">
      <h3 id="popularity-table" className="text-xl font-semibold">
        {data.title}
      </h3>
      {data.thinLine ? <p className="mt-1 font-sans text-[15px] text-ink">{data.thinLine}</p> : null}
      {data.rows.length === 0 ? (
        <p className="mt-2 font-serif text-[17px] leading-[1.6] text-ink-soft">{data.emptyLine}</p>
      ) : (
        <table className="mt-2 block w-full font-sans text-base admin:table">
          <caption className="sr-only">{data.title}</caption>
          <thead className="hidden admin:table-header-group">
            <tr className="border-b border-line text-left text-sm text-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Rank
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Variety
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Crop
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">
                {data.valueLabel}
              </th>
              {data.thin ? null : (
                <th scope="col" className="py-2 pl-3 text-right font-semibold">
                  Movement
                </th>
              )}
            </tr>
          </thead>
          <tbody className="block admin:table-row-group">
            {data.rows.map((r: RankRowData) => (
              <tr key={r.slug} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 border-b border-line py-3 align-top last:border-b-0 admin:table-row admin:py-0">
                <td className="tabular-nums text-muted admin:py-2 admin:pr-3">{r.rank}</td>
                <th scope="row" className="min-w-0 text-left font-normal admin:py-2 admin:pr-3">
                  <VarietyLinks slug={r.slug} name={r.name} />
                  <span className="mt-0.5 block text-sm text-muted admin:hidden">
                    {r.crop} · {r.value.toLocaleString("en-US")} {noun}
                    {r.movement ? ` · ${r.movement.text}` : ""}
                  </span>
                </th>
                <td className="hidden admin:table-cell admin:py-2 admin:pr-3">{r.crop}</td>
                <td className="hidden text-right tabular-nums admin:table-cell admin:py-2 admin:pl-3">{r.value.toLocaleString("en-US")}</td>
                {data.thin ? null : (
                  <td className={`hidden text-right tabular-nums admin:table-cell admin:py-2 admin:pl-3 ${r.movement ? movementClass(r.movement.kind) : ""}`}>
                    {r.movement?.text ?? ""}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ShowControl range={range} signal={signal} show={show} shown={data.shown} total={data.total} />
      {data.soldOutLine ? <p className="mt-3 font-sans text-[15px] text-ink">{data.soldOutLine}</p> : null}
      <p className="mt-2 font-sans text-[13px] leading-[1.4] text-muted">{data.caption}</p>
    </section>
  );
}

function WaitlistTable({ data, range, signal, show }: { data: WaitlistPopularity; range: StatRange; signal: StatSignal; show: number }) {
  return (
    <section aria-labelledby="waitlist-table" className="card p-4 admin:p-5">
      <h3 id="waitlist-table" className="text-xl font-semibold">
        {WAITLIST_TITLE}
      </h3>
      {data.rows.length === 0 ? (
        <p className="mt-2 font-serif text-[17px] leading-[1.6] text-ink-soft">{NO_WAITERS_LINE}</p>
      ) : (
        <table className="mt-2 block w-full font-sans text-base admin:table">
          <caption className="sr-only">{WAITLIST_TITLE}</caption>
          <thead className="hidden admin:table-header-group">
            <tr className="border-b border-line text-left text-sm text-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Rank
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Variety
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Crop
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">
                Waiters
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">
                Verified
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">
                Sellers
              </th>
            </tr>
          </thead>
          <tbody className="block admin:table-row-group">
            {data.rows.map((r: WaitlistRowData) => (
              <tr key={r.slug} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 border-b border-line py-3 align-top last:border-b-0 admin:table-row admin:py-0">
                <td className="tabular-nums text-muted admin:py-2 admin:pr-3">{r.rank}</td>
                <th scope="row" className="min-w-0 text-left font-normal admin:py-2 admin:pr-3">
                  <VarietyLinks slug={r.slug} name={r.name} />
                  <span className="mt-0.5 block text-sm text-muted admin:hidden">
                    {r.crop} · {r.waiters.toLocaleString("en-US")} waiting · {r.verified.toLocaleString("en-US")} verified · {r.sellers.toLocaleString("en-US")}{" "}
                    {r.sellers === 1 ? "seller" : "sellers"}
                  </span>
                </th>
                <td className="hidden admin:table-cell admin:py-2 admin:pr-3">{r.crop}</td>
                <td className="hidden text-right tabular-nums admin:table-cell admin:py-2 admin:pl-3">{r.waiters.toLocaleString("en-US")}</td>
                <td className="hidden text-right tabular-nums admin:table-cell admin:py-2 admin:pl-3">{r.verified.toLocaleString("en-US")}</td>
                <td className="hidden text-right tabular-nums admin:table-cell admin:py-2 admin:pl-3">{r.sellers.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ShowControl range={range} signal={signal} show={show} shown={data.shown} total={data.total} />
      <p className="mt-2 font-sans text-[13px] leading-[1.4] text-muted">{data.caption}</p>
    </section>
  );
}

function TopSearchesTable({ rows }: { rows: SearchRowData[] }) {
  return (
    <table className="mt-2 block w-full font-sans text-base admin:table">
      <caption className="sr-only">{TOP_SEARCHES_TITLE}</caption>
      <thead className="hidden admin:table-header-group">
        <tr className="border-b border-line text-left text-sm text-muted">
          <th scope="col" className="py-2 pr-3 font-semibold">
            Search
          </th>
          <th scope="col" className="py-2 px-3 text-right font-semibold">
            Searches
          </th>
          <th scope="col" className="py-2 pl-3 font-semibold">
            Usually finds
          </th>
        </tr>
      </thead>
      <tbody className="block admin:table-row-group">
        {rows.map((r) => (
          <tr key={r.term} className="grid grid-cols-[minmax(0,1fr)] items-baseline border-b border-line py-3 align-top last:border-b-0 admin:table-row admin:py-0">
            <th scope="row" className="min-w-0 break-words text-left font-semibold admin:py-2 admin:pr-3 admin:font-normal">
              <span className="font-semibold">{r.term}</span>
              <span className="mt-0.5 block text-sm font-normal text-muted admin:hidden">
                {r.count.toLocaleString("en-US")} {r.count === 1 ? "search" : "searches"}
                {r.finds ? ` · usually finds ${r.finds.name}` : ""}
              </span>
            </th>
            <td className="hidden text-right tabular-nums admin:table-cell admin:py-2 admin:px-3">{r.count.toLocaleString("en-US")}</td>
            <td className="hidden admin:table-cell admin:py-2 admin:pl-3">
              {r.finds ? (
                <span>
                  usually finds{" "}
                  <a href={`/admin/varieties?variety=${r.finds.slug}`} className="font-semibold text-link underline">
                    {r.finds.name}
                  </a>
                </span>
              ) : (
                <span className="text-muted">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SearchTables({ data, range, signal, show }: { data: SearchesPopularity; range: StatRange; signal: StatSignal; show: number }) {
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="top-searches" className="card p-4 admin:p-5">
        <h3 id="top-searches" className="text-xl font-semibold">
          {TOP_SEARCHES_TITLE}
        </h3>
        {data.top.length === 0 ? (
          <p className="mt-2 font-serif text-[17px] leading-[1.6] text-ink-soft">{NO_SEARCHES_LINE}</p>
        ) : (
          <TopSearchesTable rows={data.top} />
        )}
        <ShowControl range={range} signal={signal} show={show} shown={data.topShown} total={data.topTotal} />
        <p className="mt-2 font-sans text-[13px] leading-[1.4] text-muted">{data.caption}</p>
      </section>

      <section aria-labelledby="searches-no-results" className="card p-4 admin:p-5">
        <h3 id="searches-no-results" className="text-xl font-semibold">
          {NO_RESULTS_TITLE}
        </h3>
        <p className="mt-1 font-sans text-[15px] text-ink">{NO_RESULTS_LINE}</p>
        {data.noResults.length === 0 ? (
          <p className="mt-2 font-serif text-[17px] leading-[1.6] text-ink-soft">{NO_FRUITLESS_LINE}</p>
        ) : (
          <table className="mt-2 block w-full font-sans text-base admin:table">
            <caption className="sr-only">{NO_RESULTS_TITLE}</caption>
            <thead className="hidden admin:table-header-group">
              <tr className="border-b border-line text-left text-sm text-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Search
                </th>
                <th scope="col" className="py-2 pl-3 text-right font-semibold">
                  Searches
                </th>
              </tr>
            </thead>
            <tbody className="block admin:table-row-group">
              {data.noResults.map((r) => (
                <tr key={r.term} className="grid grid-cols-[minmax(0,1fr)] items-baseline border-b border-line py-3 align-top last:border-b-0 admin:table-row admin:py-0">
                  <th scope="row" className="min-w-0 break-words text-left font-semibold admin:py-2 admin:pr-3">
                    {r.term}
                    <span className="mt-0.5 block text-sm font-normal text-muted admin:hidden">
                      {r.count.toLocaleString("en-US")} {r.count === 1 ? "search" : "searches"}
                    </span>
                  </th>
                  <td className="hidden text-right tabular-nums admin:table-cell admin:py-2 admin:pl-3">{r.count.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <ShowControl range={range} signal={signal} show={show} shown={data.noResultsShown} total={data.noResultsTotal} />
        <p className="mt-2 font-sans text-[13px] leading-[1.4] text-muted">{data.caption}</p>
      </section>
    </div>
  );
}

export function PopularityTables({ data, range, signal, show, retryHref }: { data: PopularityData; range: StatRange; signal: StatSignal; show: number; retryHref: string }) {
  if (data.error) {
    return (
      <div role="alert" className="rounded-card border border-line-strong bg-warn-50 p-4 admin:p-5">
        <p className="font-sans text-base font-semibold text-warn">This ranking didn&apos;t load.</p>
        <p className="mt-1 font-sans text-[15px] text-ink">Check your connection and try again.</p>
        <p className="mt-3">
          <a href={retryHref} className="btn btn-secondary">
            Retry
          </a>
        </p>
      </div>
    );
  }
  switch (data.signal) {
    case "views":
    case "clicks":
      return <ViewsClicksTable data={data} range={range} signal={signal} show={show} />;
    case "waitlist":
      return <WaitlistTable data={data} range={range} signal={signal} show={show} />;
    case "searches":
      return <SearchTables data={data} range={range} signal={signal} show={show} />;
  }
}
