/** Review workspace links (server + client share these pure builders). */
import { itemRefParam, QUEUE_WINDOW, type ItemRef, type QueueKey } from "@/lib/admin/review-queues";

export interface ReviewParams {
  queue: QueueKey;
  item?: ItemRef | null;
  decided?: boolean;
  show?: number;
  page?: number;
  after?: string | null;
  status?: Record<string, string> | null;
}

export function reviewHref(p: ReviewParams): string {
  const params = new URLSearchParams({ queue: p.queue });
  if (p.item) params.set("item", itemRefParam(p.item));
  if (p.decided) params.set("decided", "1");
  if (p.show && p.show > QUEUE_WINDOW) params.set("show", String(p.show));
  if (p.page && p.page > 1) params.set("page", String(p.page));
  if (p.after) params.set("after", p.after);
  if (p.status) for (const [k, v] of Object.entries(p.status)) params.set(k, v);
  return `/admin/review?${params.toString()}`;
}
