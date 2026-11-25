import { formatAdminDate, oldestLine, timeAgo } from "../../lib/admin/auth";
import { RoleChip } from "./Banner";

/**
 * Admin home — the dashboard (spec §7B) — ported from v2's admin home:
 * what needs a decision (queue cards with real counts + oldest age, and
 * the designed all-clear zero state), the stats snapshot band, most-wanted
 * varieties, and recent decisions. Identical content for both roles.
 * Prop-driven: the page container fetches the home read client-side.
 */
export interface HubQueueCard {
  key: string;
  name: string;
  description: string;
  count: number;
  oldest: string | null;
  href: string;
}

export interface HubSnapshotCard {
  key: string;
  label: string;
  href: string;
  caption: string;
  total: number | null;
  delta: { kind: string; text: string } | null;
  trend: { buckets: { key: string; label: string; value: number }[]; summary: string } | null;
  thinLine: string | null;
  noData: string | null;
  error: boolean;
}

export function QueueCard({ name, description, count, oldest, href }: { name: string; description: string; count: number; oldest: string | null; href: string }) {
  return (
    <a href={href} className="card admin-queue-card">
      <p className="admin-queue-name">{name}</p>
      <p className="admin-queue-desc">{description}</p>
      <p className="admin-queue-count">
        {count} waiting{oldest ? ` · ${oldest}` : ""}
      </p>
    </a>
  );
}

export function StatsSnapshot({ cards }: { cards: HubSnapshotCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="admin-snapshot-grid">
      {cards.map((card) => (
        <section key={card.key} aria-label={card.label} className="card admin-stat-card">
          <h3 className="admin-stat-label">{card.label}</h3>
          {card.noData ? (
            <p className="admin-stat-nodata">{card.noData}</p>
          ) : card.total !== null ? (
            <>
              <p className="admin-stat-total">{card.total.toLocaleString("en-US")}</p>
              {card.delta ? <p className="admin-stat-delta">{card.delta.text}</p> : null}
              {card.trend ? <p className="admin-stat-summary">{card.trend.summary}</p> : null}
            </>
          ) : null}
          <p className="admin-stat-caption">{card.caption}</p>
        </section>
      ))}
    </div>
  );
}

export function HubView({
  viewer,
  cards,
  totalWaiting,
  decisions,
  wanted,
  snapshot,
}: {
  viewer?: { name: string; role: string };
  cards: HubQueueCard[];
  totalWaiting: number;
  decisions: { text: string; at: string }[];
  wanted: { slug: string; name: string; waiters: number }[];
  snapshot: { cards: HubSnapshotCard[] };
}) {
  const now = new Date();
  return (
    <div className="admin-stack-lg">
      <header className="admin-page-head">
        <h1 className="admin-title-lg">Admin home</h1>
        {viewer ? (
          <p className="admin-page-meta">
            <RoleChip role={viewer.role} />
            <span>{formatAdminDate(now.toISOString(), "")}</span>
          </p>
        ) : null}
      </header>

      <section aria-labelledby="admin-needs-decision">
        <h2 id="admin-needs-decision" className="admin-heading">
          Needs a decision
        </h2>
        <div className="admin-queue-grid">
          {cards.map((c) => (
            <QueueCard key={c.key} name={c.name} description={c.description} count={c.count} oldest={oldestLine(c.oldest, now)} href={c.href} />
          ))}
        </div>
        {totalWaiting === 0 ? <p className="admin-prose">Nothing waiting. The directory is up to date.</p> : null}
      </section>

      <section aria-labelledby="admin-site-doing">
        <h2 id="admin-site-doing" className="admin-heading">
          How the site is doing
        </h2>
        <div className="admin-section-body">
          <StatsSnapshot cards={snapshot.cards} />
        </div>
      </section>

      <div className="admin-two-col">
        <section aria-labelledby="admin-most-wanted" className="card admin-panel-card">
          <h2 id="admin-most-wanted" className="admin-panel-title">
            Most wanted
          </h2>
          {wanted.length === 0 ? (
            <p className="admin-prose-muted">No one is waiting on a variety yet.</p>
          ) : (
            <ol className="admin-ranked-list">
              {wanted.map((v, i) => (
                <li key={v.slug} className="admin-ranked-row">
                  <span>
                    <span className="admin-rank">{i + 1}</span>
                    {v.name}
                  </span>
                  <span className="admin-ranked-value">{v.waiters} waiting</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="admin-recent-decisions" className="card admin-panel-card">
          <h2 id="admin-recent-decisions" className="admin-panel-title">
            Recent decisions
          </h2>
          {decisions.length === 0 ? (
            <p className="admin-prose-muted">Decisions your team makes will appear here.</p>
          ) : (
            <ol className="admin-plain-list">
              {decisions.map((d, i) => (
                <li key={`${d.at}-${i}`} className="admin-plain-row">
                  {d.text} <span className="admin-muted">· {timeAgo(d.at, now)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
