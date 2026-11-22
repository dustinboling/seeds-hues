/**
 * The queue switcher (spec C0/C1): the four queues with live waiting counts. One nav, two
 * shells — a chip strip on phones (the C0 index surface), the list column's header on
 * iPad/desktop. Fixed decision-urgency order; zero-count queues stay tappable (their
 * Decided history lives there).
 */
import { QUEUES, type QueueKey } from "@/lib/admin/review-queues";
import { reviewHref } from "./urls";

export function QueueNav({ active, counts }: { active: QueueKey; counts: Record<QueueKey, number> }) {
  return (
    <nav aria-label="Queues">
      <ul className="flex gap-2 overflow-x-auto pb-1 admin:flex-col admin:overflow-visible admin:pb-0">
        {QUEUES.map((q) => {
          const current = q.key === active;
          const n = counts[q.key] ?? 0;
          return (
            <li key={q.key} className="shrink-0">
              <a
                href={reviewHref({ queue: q.key })}
                aria-current={current ? "true" : undefined}
                className="chip-filter gap-2"
              >
                <span>{q.name}</span>
                <span className="text-sm tabular-nums text-muted">{n === 0 ? "All clear" : n}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
