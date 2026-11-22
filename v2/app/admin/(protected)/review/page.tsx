/**
 * Review section (Slice A): the queue workspace (spec §7 C0–C5). Master–detail on
 * iPad/desktop (340px list column + detail pane), stacked list → detail on phones.
 * Queues are processed oldest-first through windowed lists; decisions post to the
 * session-authorized decide handler and advance the pane with a status line.
 */
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-current-user";
import { getServices } from "@/lib/services/context";
import { firstParam, formatAdminDate, timeAgo } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  ageWords,
  DECIDED_PAGE_SIZE,
  parseItemRef,
  QUEUES,
  QUEUE_WINDOW,
  queueDef,
  statusLine,
  type ItemRef,
  type QueueKey,
} from "@/lib/admin/review-queues";
import { QueueNav } from "./_components/queue-nav";
import { QueueList, type ListedDecidedRow, type ListedRow } from "./_components/queue-list";
import { StatusBanner } from "./_components/status-banner";
import { reviewHref } from "./_components/urls";
import { isFarmDetail, isHoldDetail, isHuntDetail, isReportDetail } from "./_components/detail-types";
import { FarmDetailView, HuntDetailView } from "./_components/detail-seller";
import { ListingDetailView } from "./_components/detail-listing";
import { DuplicateDetailView } from "./_components/detail-duplicate";
import { ReportDetailView } from "./_components/detail-report";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Review" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function clampShow(v: string | null): number {
  const n = /^\d{1,4}$/.test(v ?? "") ? Number(v) : QUEUE_WINDOW;
  return Math.min(200, Math.max(QUEUE_WINDOW, Math.ceil(n / QUEUE_WINDOW) * QUEUE_WINDOW));
}

function clampPage(v: string | null): number {
  const n = /^\d{1,6}$/.test(v ?? "") ? Number(v) : 1;
  return Math.max(1, n);
}

function parseAfter(v: string | null): { createdAt: string; kind: ItemRef["kind"]; id: number } | null {
  if (!v) return null;
  const m = /^(\d{4}-\d{2}-\d{2}T[^\s~]+)~(review|farm)~(\d{1,12})$/.exec(v);
  if (!m) return null;
  return { createdAt: m[1]!, kind: m[2] as ItemRef["kind"], id: Number(m[3]) };
}

function ErrorCard({ label, retry }: { label: string; retry: string }) {
  return (
    <div role="alert" className="rounded-card border border-line-strong bg-warn-50 p-4 admin:p-5">
      <p className="font-sans text-base font-semibold text-warn">{label} didn&apos;t load.</p>
      <p className="mt-1 font-sans text-[15px] text-ink">Check your connection and try again.</p>
      <p className="mt-3">
        <a href={retry} className="btn btn-secondary">
          Retry
        </a>
      </p>
    </div>
  );
}

export default async function AdminReviewPage({ searchParams }: Props) {
  const sp = await searchParams;
  const itemRef = parseItemRef(firstParam(sp.item));
  const decided = firstParam(sp.decided) === "1";
  const show = clampShow(firstParam(sp.show));
  const page = clampPage(firstParam(sp.page));
  const after = parseAfter(firstParam(sp.after));
  const paramStatus = statusLine({
    status: firstParam(sp.status),
    name: firstParam(sp.name),
    variety: firstParam(sp.variety),
    existing: firstParam(sp.existing),
    held: firstParam(sp.held),
    seller: firstParam(sp.seller),
  });

  const requestedQueue = queueDef(firstParam(sp.queue) ?? "");
  const returnTo = reviewHref({ queue: requestedQueue?.key ?? "duplicates", item: itemRef, decided, show, page });
  const viewer = await requireAdmin(returnTo);
  const services = await getServices();
  const now = new Date();

  const { cards, totalWaiting } = await services.adminAuth.queueCards();
  const counts = Object.fromEntries(cards.map((c) => [c.key, c.count])) as Record<QueueKey, number>;
  let queue: QueueKey = requestedQueue?.key ?? QUEUES.find((q) => (counts[q.key] ?? 0) > 0)?.key ?? "duplicates";

  // A deep-linked item wins over the queue param: it lands in its own queue.
  if (itemRef) {
    const itemQueue = await services.adminReview.queueForRef(itemRef).catch(() => null);
    if (itemQueue) queue = itemQueue;
  }
  const retry = reviewHref({ queue, item: itemRef, decided, show, page });

  // ─── list pane ────────────────────────────────────────────────────────────
  let rows: ListedRow[] = [];
  let total = 0;
  let decidedRows: ListedDecidedRow[] = [];
  let decidedTotal = 0;
  let listError = false;
  try {
    const [waiting, history] = await Promise.all([
      services.adminReview.waitingList(queue, show),
      services.adminReview.decidedList(queue, decided ? page : 1, decided ? DECIDED_PAGE_SIZE : 1),
    ]);
    rows = waiting.rows.map((r) => ({ ...r, age: ageWords(r.createdAt, now) }));
    total = waiting.total;
    decidedRows = history.rows.map((r) => ({ ...r, time: timeAgo(r.at, now) }));
    decidedTotal = history.total;
  } catch {
    listError = true;
  }

  // ─── selection ────────────────────────────────────────────────────────────
  let selected: ItemRef | null = null;
  let landedDecided: { name: string | null } | null = null;
  if (!listError) {
    if (decided) {
      selected = itemRef && decidedRows.some((r) => r.ref.kind === itemRef.kind && r.ref.id === itemRef.id) ? itemRef : (decidedRows[0]?.ref ?? null);
    } else if (itemRef) {
      const loc = await services.adminReview.locate(itemRef).catch(() => ({ status: "missing" }) as const);
      if (loc.status === "pending") {
        selected = itemRef;
      } else if (loc.status === "decided") {
        landedDecided = { name: loc.decidedByName };
        selected = (await services.adminReview.selectedAfter(queue, null, show).catch(() => null))?.ref ?? null;
      } else {
        selected = (await services.adminReview.selectedAfter(queue, null, show).catch(() => null))?.ref ?? null;
      }
    } else {
      selected = (await services.adminReview.selectedAfter(queue, after, show).catch(() => null))?.ref ?? null;
    }
  }

  // ─── detail pane ──────────────────────────────────────────────────────────
  let detail: Awaited<ReturnType<typeof services.adminReview.detail>> = null;
  let rank: { rank: number; total: number } | null = null;
  let detailError = false;
  if (!listError && !decided && selected) {
    try {
      detail = await services.adminReview.detail(selected);
      if (!detail) {
        // Decided between locate and render: the A5 wording, then advance.
        const loc = await services.adminReview.locate(selected).catch(() => ({ status: "missing" }) as const);
        landedDecided = loc.status === "decided" ? { name: loc.decidedByName } : { name: null };
        selected = (await services.adminReview.selectedAfter(queue, null, show).catch(() => null))?.ref ?? null;
        if (selected) detail = await services.adminReview.detail(selected).catch(() => null);
      }
      if (selected) rank = await services.adminReview.rank(queue, selected).catch(() => null);
    } catch {
      detailError = true;
    }
  }

  const status = paramStatus ?? (landedDecided ? statusLine({ status: "already_decided", ...(landedDecided.name ? { name: landedDecided.name } : {}) }) : null);
  const nextQueue = QUEUES.find((q) => q.key !== queue && (counts[q.key] ?? 0) > 0) ?? null;
  const decidedSelected = decided && selected ? (decidedRows.find((r) => r.ref.kind === selected.kind && r.ref.id === selected.id) ?? null) : null;

  return (
    <AdminShell viewer={viewer} section="review" reviewTotal={totalWaiting}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-[28px] font-semibold leading-[1.15]">Review</h1>
        {!decided && rank && selected ? (
          <p className="font-sans text-sm tabular-nums text-muted" aria-label={`Item ${rank.rank} of ${rank.total}`}>
            {rank.rank} of {rank.total}
          </p>
        ) : null}
      </header>

      <div className="mt-4 grid grid-cols-1 gap-4 admin:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3 admin:max-h-[calc(100dvh-10rem)] admin:overflow-y-auto">
          <QueueNav active={queue} counts={counts} />
          {listError ? (
            <ErrorCard label="This queue" retry={retry} />
          ) : (
            <QueueList queue={queue} show={show} decided={decided} rows={rows} total={total} selected={selected} decidedRows={decidedRows} decidedTotal={decidedTotal} decidedPage={page} />
          )}
        </div>

        <section aria-label="Decision" id="detail" className="min-w-0 scroll-mt-4">
          {status ? (
            <div className="mb-3">
              <StatusBanner status={status} />
            </div>
          ) : null}
          {detailError ? (
            <ErrorCard label="This item" retry={retry} />
          ) : decided ? (
            decidedSelected ? (
              <article aria-labelledby="review-detail-title" className="card flex flex-col gap-1 p-4 admin:p-5">
                <h2 id="review-detail-title" className="text-[28px] font-semibold leading-[1.15]">
                  {decidedSelected.name}
                </h2>
                <p className="font-sans text-[15px] text-ink-soft">{decidedSelected.outcome}</p>
                <p className="font-sans text-sm text-muted">
                  {decidedSelected.decider ? `${decidedSelected.decider} · ` : null}
                  {decidedSelected.time}
                </p>
              </article>
            ) : (
              <div className="card p-4 admin:p-5">
                <div aria-hidden="true" className="divider-stem" />
                <p className="mt-3 font-serif text-[17px] leading-[1.6]">{decidedTotal === 0 ? "No decisions in this queue yet." : "Select a decided item to read it."}</p>
              </div>
            )
          ) : !detail ? (
            <div className="card p-4 admin:p-5">
              <div aria-hidden="true" className="divider-stem" />
              <p className="mt-3 font-serif text-[17px] leading-[1.6]">{queueDef(queue)?.empty ?? "Nothing waiting here."}</p>
              {nextQueue ? (
                <p className="mt-2 font-sans text-[15px]">
                  <a href={reviewHref({ queue: nextQueue.key })} className="text-link underline">
                    Next: {nextQueue.name} ({counts[nextQueue.key]})
                  </a>
                </p>
              ) : null}
            </div>
          ) : isHuntDetail(detail) ? (
            <HuntDetailView detail={detail} role={viewer.role} queue={queue} show={show} submittedOn={formatAdminDate(detail.createdAt)} />
          ) : isFarmDetail(detail) ? (
            <FarmDetailView detail={detail} role={viewer.role} queue={queue} show={show} submittedOn={formatAdminDate(detail.createdAt)} />
          ) : isHoldDetail(detail) ? (
            <DuplicateDetailView detail={detail} role={viewer.role} queue={queue} show={show} submittedOn={formatAdminDate(detail.createdAt)} />
          ) : isReportDetail(detail) ? (
            <ReportDetailView detail={detail} role={viewer.role} queue={queue} show={show} submittedOn={formatAdminDate(detail.createdAt)} />
          ) : (
            <ListingDetailView detail={detail} role={viewer.role} queue={queue} show={show} submittedOn={formatAdminDate(detail.createdAt)} />
          )}
        </section>
      </div>
    </AdminShell>
  );
}
