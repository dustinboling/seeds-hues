/**
 * One H site stat card: label, Stat number (tabular), delta-or-thin-line, the trend
 * chart with its sentence summary + visually-hidden table, and the caption restating
 * the range. No-data cards (visitors always; others before their first record) show
 * the composed line and no number. One card's failure degrades to its error state.
 */
import type { DeltaKind, SiteCardData } from "@/lib/admin/statistics";
import { TrendBars } from "@/components/admin/TrendBars";

function deltaClass(kind: DeltaKind): string {
  if (kind === "up") return "text-leaf";
  if (kind === "down") return "text-ink-soft";
  return "text-muted";
}

export function SiteStatCard({ card, retryHref }: { card: SiteCardData; retryHref: string }) {
  return (
    <section aria-labelledby={`stat-${card.key}`} className="card flex min-w-0 flex-col gap-1 p-4 admin:p-5">
      <h2 id={`stat-${card.key}`} className="font-sans text-base font-semibold">
        {card.label}
      </h2>
      {card.error ? (
        <div role="alert" className="flex flex-col gap-1">
          <p className="font-sans text-[15px] text-ink">These stats didn&apos;t load.</p>
          <p className="mt-1">
            <a href={retryHref} className="btn btn-secondary">
              Retry
            </a>
          </p>
        </div>
      ) : card.noData || card.total === null || !card.trend ? (
        <>
          <p className="font-serif text-[17px] leading-[1.6] text-ink-soft">{card.noData}</p>
          <p className="mt-2 font-sans text-[13px] leading-[1.4] text-muted">{card.caption}</p>
        </>
      ) : (
        <>
          <p className="font-sans text-[32px] font-semibold leading-[1.1] tabular-nums">{card.total.toLocaleString("en-US")}</p>
          {card.delta ? (
            <p className={`font-sans text-sm font-semibold ${deltaClass(card.delta.kind)}`}>{card.delta.text}</p>
          ) : (
            <p className="font-sans text-sm text-muted">{card.thinLine}</p>
          )}
          <div className="mt-2">
            <TrendBars label={card.label} buckets={card.trend.buckets} summary={card.trend.summary} size="full" />
          </div>
          <p className="mt-2 font-sans text-[13px] leading-[1.4] text-muted">{card.caption}</p>
        </>
      )}
    </section>
  );
}
