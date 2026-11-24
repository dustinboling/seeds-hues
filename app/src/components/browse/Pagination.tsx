/**
 * Crawlable ?page= pagination — ported from v2/components/ui/Pagination.tsx
 * (same windowing, same rel prev/next, same labels; plain anchors instead
 * of next/link). Page 1 is the bare path (canonical). The hydrated
 * in-place layer intercepts these anchors (go) so paging swaps in place
 * with the pending cue; without JavaScript they are ordinary navigation.
 */
import type { MouseEvent } from "react";

/** Crawlable ?page= href (X5). Page 1 is the bare path (canonical). */
export function pageHref(basePath: string, page: number, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({
  basePath,
  page,
  totalPages,
  extra,
  label = "Pagination",
  onNavigate,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  extra?: Record<string, string>;
  label?: string;
  /** Hydrated interception: in-place navigation to the href (plain navigation when absent). */
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );
  const link = (href: string, rel: "prev" | "next" | undefined, content: React.ReactNode, key: string) => (
    <a
      key={key}
      className="btn btn-secondary"
      href={href}
      {...(rel ? { rel } : {})}
      onClick={onNavigate ? (event) => onNavigate(event, href) : undefined}
    >
      {content}
    </a>
  );
  return (
    <nav aria-label={label} className="pagination">
      {page > 1 ? link(pageHref(basePath, page - 1, extra), "prev", "← Previous", "prev") : null}
      <ol className="pagination-list">
        {pages.map((p, i) => {
          const gap = i > 0 && p - (pages[i - 1] ?? p) > 1;
          return (
            <li key={p} className="pagination-item">
              {gap ? (
                <span aria-hidden="true" className="pagination-gap">
                  …
                </span>
              ) : null}
              {p === page ? (
                <span aria-current="page" className="btn pagination-current">
                  <span className="sr-only">Page </span>
                  {p}
                </span>
              ) : (
                <a
                  className="btn btn-secondary"
                  href={pageHref(basePath, p, extra)}
                  onClick={onNavigate ? (event) => onNavigate(event, pageHref(basePath, p, extra)) : undefined}
                >
                  <span className="sr-only">Page </span>
                  {p}
                </a>
              )}
            </li>
          );
        })}
      </ol>
      {page < totalPages ? link(pageHref(basePath, page + 1, extra), "next", "Next →", "next") : null}
    </nav>
  );
}
