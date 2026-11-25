import { NO_FRUITLESS_LINE, NO_RESULTS_LINE, RANGE_LABELS, SIGNAL_LABELS, statisticsHref, type StatRange, type StatSignal } from "../../lib/admin/statistics";
import type { HubSnapshotCard } from "./HubView";

/**
 * Statistics section (spec §7 H) — ported from v2's statistics page: how
 * the site is doing (the four site stat cards — Visitors in its designed
 * no-data state when Web Analytics isn't connected) and which varieties
 * are popular (the Views · Clicks · Waitlist · Searches ranking
 * centerpiece). Server-rendered frame, read-only; identical for both
 * roles. Prop-driven: the page container fetches overview + popularity
 * client-side.
 */
export interface RankRow {
  rank: number;
  slug: string;
  name: string;
  crop: string;
  value: number;
  movement: { kind: string; text: string } | null;
}

export interface ViewsClicksData {
  signal: "views" | "clicks";
  title: string;
  valueLabel: string;
  rows: RankRow[];
  shown: number;
  total: number;
  thin: boolean;
  thinLine: string | null;
  emptyLine: string;
  soldOutLine: string | null;
  caption: string;
  error: boolean;
}

export interface WaitlistData {
  signal: "waitlist";
  rows: { rank: number; slug: string; name: string; crop: string; waiters: number; verified: number; sellers: number }[];
  shown: number;
  total: number;
  caption: string;
  error: boolean;
}

export interface SearchesData {
  signal: "searches";
  top: { term: string; count: number; finds: { slug: string; name: string } | null }[];
  topShown: number;
  topTotal: number;
  noResults: { term: string; count: number }[];
  noResultsShown: number;
  noResultsTotal: number;
  caption: string;
  error: boolean;
}

export type PopularityData = ViewsClicksData | WaitlistData | SearchesData;

const RANGES: StatRange[] = ["7d", "30d", "12w"];
const SIGNALS: StatSignal[] = ["views", "clicks", "waitlist", "searches"];

export function TrendBars({ buckets, summary }: { buckets: { key: string; label: string; value: number }[]; summary: string }) {
  const max = Math.max(1, ...buckets.map((b) => b.value));
  return (
    <div className="admin-trend">
      <div aria-hidden="true" className="admin-trend-bars">
        {buckets.map((b) => (
          <span key={b.key} className="admin-trend-bar" style={{ height: `${Math.round((100 * b.value) / max)}%` }} />
        ))}
      </div>
      <p className="admin-stat-summary">{summary}</p>
      <table className="admin-visually-hidden">
        <tbody>
          {buckets.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td>{b.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SiteStatCard({ card }: { card: HubSnapshotCard }) {
  return (
    <section aria-label={card.label} className="card admin-stat-card">
      <h3 className="admin-stat-label">{card.label}</h3>
      {card.error ? (
        <p className="admin-prose-muted">This card didn’t load.</p>
      ) : card.noData ? (
        <p className="admin-stat-nodata">{card.noData}</p>
      ) : card.total !== null ? (
        <>
          <p className="admin-stat-total">{card.total.toLocaleString("en-US")}</p>
          {card.delta ? <p className="admin-stat-delta">{card.delta.text}</p> : null}
          {card.trend ? <TrendBars buckets={card.trend.buckets} summary={card.trend.summary} /> : null}
          {card.thinLine ? <p className="admin-muted-line">{card.thinLine}</p> : null}
        </>
      ) : null}
      <p className="admin-stat-caption">{card.caption}</p>
    </section>
  );
}

function PopularityTables({ data }: { data: PopularityData }) {
  if (data.signal === "views" || data.signal === "clicks") {
    if (data.rows.length === 0) return <p className="admin-prose-lg">{data.emptyLine}</p>;
    return (
      <div className="admin-stack">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Variety</th>
              <th scope="col">{data.valueLabel}</th>
              <th scope="col">Movement</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.slug}>
                <td>{r.rank}</td>
                <th scope="row">
                  {r.name} <span className="admin-muted">· {r.crop}</span>
                </th>
                <td>{r.value.toLocaleString("en-US")}</td>
                <td>{r.movement?.text ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.soldOutLine ? <p className="admin-muted-line">{data.soldOutLine}</p> : null}
        <p className="admin-muted-line">{data.caption}</p>
      </div>
    );
  }
  if (data.signal === "waitlist") {
    if (data.rows.length === 0) return <p className="admin-prose-lg">No one is waiting on a variety yet.</p>;
    return (
      <div className="admin-stack">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Variety</th>
              <th scope="col">Waiting</th>
              <th scope="col">Verified</th>
              <th scope="col">Sellers</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.slug}>
                <td>{r.rank}</td>
                <th scope="row">
                  {r.name} <span className="admin-muted">· {r.crop}</span>
                </th>
                <td>{r.waiters}</td>
                <td>{r.verified}</td>
                <td>{r.sellers}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="admin-muted-line">{data.caption}</p>
      </div>
    );
  }
  return (
    <div className="admin-stack">
      {data.top.length === 0 ? (
        <p className="admin-prose-lg">No searches recorded in this period.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Search</th>
              <th scope="col">Count</th>
              <th scope="col">Usually finds</th>
            </tr>
          </thead>
          <tbody>
            {data.top.map((r) => (
              <tr key={r.term}>
                <th scope="row">{r.term}</th>
                <td>{r.count}</td>
                <td>{r.finds ? r.finds.name : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3 className="admin-heading">Fruitless searches</h3>
      {data.noResults.length === 0 ? (
        <p className="admin-prose-lg">{NO_FRUITLESS_LINE}</p>
      ) : (
        <div className="admin-stack">
          <p className="admin-muted-line">{NO_RESULTS_LINE}</p>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Search</th>
                <th scope="col">Count</th>
              </tr>
            </thead>
            <tbody>
              {data.noResults.map((r) => (
                <tr key={r.term}>
                  <th scope="row">{r.term}</th>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="admin-muted-line">{data.caption}</p>
    </div>
  );
}

export function StatisticsView({
  range,
  signal,
  show,
  period,
  cards,
  popularity,
}: {
  range: StatRange;
  signal: StatSignal;
  show: number;
  period: { words: string; caption: string };
  cards: HubSnapshotCard[];
  popularity: PopularityData;
}) {
  return (
    <div className="admin-stack">
      <header className="admin-stack-sm">
        <h1 className="admin-title-lg">Statistics</h1>
        <div role="group" aria-label="Date range" className="admin-row">
          {RANGES.map((r) => (
            <a key={r} href={statisticsHref({ range: r, signal, show })} aria-current={r === range ? "true" : undefined} className="admin-chip">
              {RANGE_LABELS[r]}
            </a>
          ))}
        </div>
        <p className="admin-muted-line">{period.words}</p>
      </header>
      <div className="admin-stat-grid">
        {cards.map((card) => (
          <SiteStatCard key={card.key} card={card} />
        ))}
      </div>
      <section aria-labelledby="popularity-heading">
        <h2 id="popularity-heading" className="admin-heading">
          Variety popularity
        </h2>
        <div role="group" aria-label="Popularity signal" className="admin-row">
          {SIGNALS.map((s) => (
            <a key={s} href={statisticsHref({ range, signal: s, show })} aria-current={s === signal ? "true" : undefined} className="admin-chip">
              {SIGNAL_LABELS[s]}
            </a>
          ))}
        </div>
        <div className="admin-section-body">
          <PopularityTables data={popularity} />
        </div>
      </section>
    </div>
  );
}
