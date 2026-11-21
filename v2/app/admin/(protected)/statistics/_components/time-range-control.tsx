/**
 * Statistics controls (spec §7 H): the header band's time-range segmented control
 * (7 days · 30 days · 12 weeks, with the range restated in words beside it) and the
 * popularity signal switcher (Views · Clicks to sellers · Waitlist · Searches).
 * Links, not forms — range, signal and show compose (each preserves the others).
 */
import { RANGE_LABELS, SIGNAL_LABELS, statisticsHref, type StatRange, type StatSignal } from "@/lib/admin/statistics";

const RANGES: StatRange[] = ["7d", "30d", "12w"];
const SIGNALS: StatSignal[] = ["views", "clicks", "waitlist", "searches"];

function chipClass(active: boolean): string {
  return `chip tap flex min-h-[44px] items-center ${active ? "font-semibold" : ""}`;
}

export function TimeRangeControl({ range, signal, show, words }: { range: StatRange; signal: StatSignal; show: number; words: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="group" aria-label="Time range" className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <a key={r} href={statisticsHref({ range: r, signal, show })} aria-current={range === r ? "true" : undefined} className={chipClass(range === r)}>
            {RANGE_LABELS[r]}
          </a>
        ))}
      </div>
      <p className="font-sans text-[15px] text-muted">{words}</p>
    </div>
  );
}

export function SignalControl({ range, signal, show }: { range: StatRange; signal: StatSignal; show: number }) {
  return (
    <div role="group" aria-label="Popularity signal" className="flex flex-wrap gap-2">
      {SIGNALS.map((s) => (
        <a key={s} href={statisticsHref({ range, signal: s, show })} aria-current={signal === s ? "true" : undefined} className={chipClass(signal === s)}>
          {SIGNAL_LABELS[s]}
        </a>
      ))}
    </div>
  );
}
