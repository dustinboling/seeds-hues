/**
 * The list column (spec C1): Waiting/Decided segments, oldest-first rows with the item
 * name loudest, an in-place "Show more" window (never the whole queue at once), and the
 * read-only paginated decision history. Selection uses aria-current; counts stay exact.
 */
import { Pagination } from "@/components/ui/Pagination";
import { QUEUE_WINDOW, verifiedLine, type ItemRef, type QueueKey } from "@/lib/admin/review-queues";
import type { DecidedRow, QueueRow } from "@/lib/admin/review-service";
import { reviewHref } from "./urls";

export type ListedRow = QueueRow & { age: string };
export type ListedDecidedRow = DecidedRow & { time: string };

export function QueueList({
  queue,
  show,
  decided,
  rows,
  total,
  selected,
  decidedRows,
  decidedTotal,
  decidedPage,
}: {
  queue: QueueKey;
  show: number;
  decided: boolean;
  rows: ListedRow[];
  total: number;
  selected: ItemRef | null;
  decidedRows: ListedDecidedRow[];
  decidedTotal: number;
  decidedPage: number;
}) {
  const selectedParam = selected ? `${selected.kind}-${selected.id}` : null;
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="List segment" className="flex flex-wrap gap-2">
        <a href={reviewHref({ queue, show })} aria-current={!decided ? "true" : undefined} className="chip-filter">
          Waiting&nbsp;<span className="tabular-nums text-muted">({total})</span>
        </a>
        <a href={reviewHref({ queue, show, decided: true })} aria-current={decided ? "true" : undefined} className="chip-filter">
          Decided&nbsp;<span className="tabular-nums text-muted">({decidedTotal})</span>
        </a>
      </div>

      {decided ? (
        decidedRows.length === 0 ? (
          <p className="font-serif text-[17px] leading-[1.6] text-ink-soft">No decisions in this queue yet.</p>
        ) : (
          <>
            <ol className="flex flex-col">
              {decidedRows.map((r) => {
                const param = `${r.ref.kind}-${r.ref.id}`;
                const current = selected && param === `${selected.kind}-${selected.id}`;
                return (
                  <li key={param}>
                    <a
                      href={`${reviewHref({ queue, item: r.ref, show, decided: true, page: decidedPage > 1 ? decidedPage : undefined })}#detail`}
                      aria-current={current ? "true" : undefined}
                      className={`block rounded-control border-b border-line px-3 py-3 font-sans last:border-b-0 ${current ? "bg-leaf-50" : "hover:bg-paper-deep"}`}
                    >
                      <span className="block text-base font-semibold">{r.name}</span>
                      <span className="mt-0.5 block text-sm text-ink-soft">{r.outcome}</span>
                      <span className="mt-0.5 block text-[13px] text-muted">
                        {r.decider ? `${r.decider} · ` : null}
                        {r.time}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
            <Pagination basePath="/admin/review" page={decidedPage} totalPages={Math.max(1, Math.ceil(decidedTotal / 20))} extra={{ queue, decided: "1" }} label="Decided history pages" />
          </>
        )
      ) : rows.length === 0 ? (
        <p className="font-serif text-[17px] leading-[1.6] text-ink-soft">Nothing waiting here.</p>
      ) : (
        <>
          <ol className="flex flex-col">
            {rows.map((r) => {
              const param = `${r.ref.kind}-${r.ref.id}`;
              const current = param === selectedParam;
              const verified = verifiedLine(r.verifiedBy);
              return (
                <li key={param}>
                  <a
                    href={`${reviewHref({ queue, item: r.ref, show })}#detail`}
                    aria-current={current ? "true" : undefined}
                    className={`block rounded-control px-3 py-3 font-sans ${current ? "bg-leaf-50" : "hover:bg-paper-deep"}`}
                  >
                    <span className="block text-base font-semibold">{r.name}</span>
                    {r.facts ? <span className="mt-0.5 block text-sm text-ink-soft">{r.facts}</span> : null}
                    <span className="mt-0.5 block text-[13px] text-muted">
                      {r.age}
                      {r.source ? ` · ${r.source}` : null}
                    </span>
                    {verified ? <span className="mt-0.5 block text-[13px] font-medium text-leaf">{verified}</span> : null}
                  </a>
                </li>
              );
            })}
          </ol>
          <p className="font-sans text-[13px] tabular-nums text-muted">
            Showing {rows.length} of {total}
          </p>
          {rows.length < total ? (
            <p>
              <a href={reviewHref({ queue, item: selected, show: show + QUEUE_WINDOW })} className="btn btn-secondary">
                Show more
              </a>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
