/**
 * TrendBars (spec §9): leaf bars on a leaf-50 track (today full-strength, prior
 * buckets at 55%) for a site stat's trend. The chart is never the only carrier of
 * its numbers: every chart ships with a one-sentence summary in plain words plus a
 * visually-hidden data table. Pure render — no state, no clock.
 */
import type { TrendBucket } from "@/lib/admin/statistics";

export function TrendBars({
  label,
  buckets,
  summary,
  size,
  hideSummary = false,
}: {
  label: string;
  buckets: TrendBucket[];
  summary: string;
  /** Snapshot cards render the mini scale (the summary then lives in the card's accessible name). */
  size: "full" | "mini";
  hideSummary?: boolean;
}) {
  const max = buckets.reduce((m, b) => Math.max(m, b.value), 0);
  const last = buckets.length - 1;
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <div aria-hidden="true" className={`flex items-end gap-1 rounded-[10px] bg-leaf-50 p-2 ${size === "full" ? "h-28" : "h-12"}`}>
        {buckets.map((b, i) => (
          <div
            key={b.key}
            className="min-w-0 flex-1 rounded-sm bg-leaf"
            style={{ height: `${max > 0 ? Math.round((b.value / max) * 100) : 0}%`, opacity: i === last ? 1 : 0.55 }}
          />
        ))}
      </div>
      {hideSummary ? null : <figcaption className="font-sans text-[13px] leading-[1.4] text-muted">{summary}</figcaption>}
      <table className="sr-only">
        <caption>
          {label} — the numbers behind the chart
        </caption>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td>{b.value.toLocaleString("en-US")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
