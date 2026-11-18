import Link from "next/link";

/** Crawlable ?page= pagination (X5). Page 1 is the bare path (canonical). */
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
}: {
  basePath: string;
  page: number;
  totalPages: number;
  extra?: Record<string, string>;
  label?: string;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );
  return (
    <nav aria-label={label} className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link className="btn btn-secondary" href={pageHref(basePath, page - 1, extra)} rel="prev">
          ← Previous
        </Link>
      ) : null}
      <ol className="flex flex-wrap items-center gap-1">
        {pages.map((p, i) => {
          const gap = i > 0 && p - (pages[i - 1] ?? p) > 1;
          return (
            <li key={p} className="flex items-center gap-1">
              {gap ? <span aria-hidden="true" className="px-1 text-muted">…</span> : null}
              {p === page ? (
                <span aria-current="page" className="btn bg-leaf text-white">
                  <span className="sr-only">Page </span>
                  {p}
                </span>
              ) : (
                <Link className="btn btn-secondary" href={pageHref(basePath, p, extra)}>
                  <span className="sr-only">Page </span>
                  {p}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      {page < totalPages ? (
        <Link className="btn btn-secondary" href={pageHref(basePath, page + 1, extra)} rel="next">
          Next →
        </Link>
      ) : null}
    </nav>
  );
}
