import { notFound } from "next/navigation";
import { PAGE_SIZE } from "@/lib/config";

/**
 * ?page= parsing for list pages (X5). Missing → 1. Anything that is not a positive integer, or a
 * page past the end, is a real 404 so crawlers never find infinite empty pages.
 */
export function parsePage(raw: string | string[] | undefined): number {
  if (raw === undefined) return 1;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !/^[1-9]\d{0,5}$/.test(v)) notFound();
  return Number(v);
}

export function pageWindow(page: number, size = PAGE_SIZE) {
  return { offset: (page - 1) * size, limit: size };
}

export function totalPages(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

export function assertPageInRange(page: number, total: number, size = PAGE_SIZE): void {
  if (page > totalPages(total, size)) notFound();
}

export function pagePath(base: string, page: number): string {
  return page > 1 ? `${base}?page=${page}` : base;
}

export function pageTitleSuffix(page: number): string {
  return page > 1 ? ` — page ${page}` : "";
}

// Filter-param parsing (season, method, life_cycle, color_family) lives in lib/browse.ts with
// the rest of the browse-filter model it serves; this module keeps the ?page= machinery only.
