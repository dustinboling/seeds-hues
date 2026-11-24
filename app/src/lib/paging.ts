/**
 * ?page= machinery for list pages — ported from v2/lib/paging.ts (same
 * rules, framework-free: the Next notFound() calls become a null the route
 * layer turns into Vike's render(404)).
 *
 * Missing → 1. Anything that is not a positive integer, or a page past the
 * end, is a real 404 so crawlers never find infinite empty pages. Page 1
 * lives at the bare path (canonical); page N > 1 at ?page=N.
 */
import { PAGE_SIZE } from "../site";

export type RawParam = string | string[] | undefined;

const firstValue = (raw: RawParam): string | undefined => (Array.isArray(raw) ? raw[0] : raw);

/**
 * Strict ?page= parse: the page number, or null when the route must 404
 * (non-positive-integer or, checked separately, past the end).
 */
export function parsePageParam(raw: RawParam): number | null {
  if (raw === undefined) return 1;
  const v = firstValue(raw);
  if (!v || !/^[1-9]\d{0,5}$/.test(v)) return null;
  return Number(v);
}

/** Client-side forgiving mirror for the popstate page check (missing/garbage → 1). */
export function pageFromSearch(search: string): number {
  const v = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("page");
  return v !== null && /^[1-9]\d{0,5}$/.test(v) ? Number(v) : 1;
}

export function pageWindow(page: number, size = PAGE_SIZE): { offset: number; limit: number } {
  return { offset: (page - 1) * size, limit: size };
}

export function totalPages(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/** True when the page exists within the total (false → the route 404s). */
export function pageInRange(page: number, total: number, size = PAGE_SIZE): boolean {
  return page <= totalPages(total, size);
}

export function pagePath(base: string, page: number): string {
  return page > 1 ? `${base}?page=${page}` : base;
}

export function pageTitleSuffix(page: number): string {
  return page > 1 ? ` — page ${page}` : "";
}
