/**
 * Dashboard stats snapshot band, wired (spec §7 B, Slice D): the four site cards over
 * the fixed 7-day window — Visitors live from Web Analytics when its read token is
 * set, else its designed no-data state — with Stat number, delta-or-thin-line and a
 * 7-bar mini trend on the live cards. The
 * whole card is the tap target. A failed band degrades to its error card with Retry;
 * one failed card never blanks the other three.
 */
import type { DeltaKind, SiteCardData, StatisticsSnapshot as SnapshotData } from "@/lib/admin/statistics";
import { TrendBars } from "./TrendBars";

function deltaClass(kind: DeltaKind): string {
  if (kind === "up") return "text-leaf";
  if (kind === "down") return "text-ink-soft";
  return "text-muted";
}

function SnapshotCard({ card }: { card: SiteCardData }) {
  if (card.error) {
    return (
      <div role="alert" className="card flex flex-col gap-1 p-4 min-[744px]:p-5">
        <p className="font-sans text-base font-semibold">{card.label}</p>
        <p className="font-sans text-[15px] text-ink">These stats didn&apos;t load.</p>
        <p className="mt-1 font-sans text-[15px]">
          <a href="/admin" className="font-semibold text-link underline">
            Try again
          </a>
        </p>
      </div>
    );
  }
  if (card.noData || card.total === null || !card.trend) {
    return (
      <a href={card.href} className="card flex min-h-[44px] flex-col gap-1 p-4 min-[744px]:p-5">
        <p className="font-sans text-base font-semibold">{card.label}</p>
        <p className="font-serif text-[17px] leading-[1.6] text-ink-soft">{card.noData}</p>
      </a>
    );
  }
  const comparison = card.delta ? card.delta.text : (card.thinLine ?? "");
  const accessible = `${card.label}, ${card.total.toLocaleString("en-US")}${comparison ? `, ${comparison}` : ""}, ${card.trend.summary}`;
  return (
    <a href={card.href} aria-label={accessible} className="card flex min-h-[44px] flex-col gap-1 p-4 min-[744px]:p-5">
      <p className="font-sans text-base font-semibold">{card.label}</p>
      <p className="font-sans text-[32px] font-semibold leading-[1.1] tabular-nums">{card.total.toLocaleString("en-US")}</p>
      {card.delta ? (
        <p className={`font-sans text-sm font-semibold ${deltaClass(card.delta.kind)}`}>{card.delta.text}</p>
      ) : (
        <p className="font-sans text-sm text-muted">{card.thinLine}</p>
      )}
      <div className="mt-1">
        <TrendBars label={card.label} buckets={card.trend.buckets} summary={card.trend.summary} size="mini" hideSummary />
      </div>
    </a>
  );
}

export function StatsSnapshot({ snapshot }: { snapshot: SnapshotData | null }) {
  if (!snapshot) {
    return (
      <div role="alert" className="rounded-[18px] border border-line-strong bg-warn-50 p-4 min-[744px]:p-5">
        <p className="font-sans text-base font-semibold text-warn">These stats didn&apos;t load.</p>
        <p className="mt-1 font-sans text-[15px] text-ink">Check your connection and try again.</p>
        <p className="mt-3">
          <a href="/admin" className="btn btn-secondary">
            Try again
          </a>
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 min-[744px]:grid-cols-2 min-[1024px]:grid-cols-4">
      {snapshot.cards.map((card) => (
        <SnapshotCard key={card.key} card={card} />
      ))}
    </div>
  );
}
