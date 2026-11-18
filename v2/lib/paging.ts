import { notFound } from "next/navigation";
import { PAGE_SIZE } from "@/lib/config";
import {
  COLOR_FAMILIES,
  LIFE_CYCLE_PARAMS,
  METHOD_PARAMS,
  SEASON_PARAMS,
  type ColorFamily,
  type LifeCycleParam,
  type MethodParam,
  type SeasonParam,
} from "@/lib/validators";

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

/**
 * ?season= for list pages: "cool" | "warm", anything else is ignored (null = all seasons).
 * Unlike ?page=, an unknown value is not a 404 — the page just shows every season.
 */
export function parseSeasonParam(raw: string | string[] | undefined): SeasonParam | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v !== undefined && Object.hasOwn(SEASON_PARAMS, v) ? (v as SeasonParam) : null;
}

/** ?method= for list pages: "direct" | "trays" (single-select); anything else is ignored (null = all). */
export function parseMethodParam(raw: string | string[] | undefined): MethodParam | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v !== undefined && Object.hasOwn(METHOD_PARAMS, v) ? (v as MethodParam) : null;
}

/** ?color_family= for list pages: one of COLOR_FAMILIES; anything else is ignored (null = all hues). */
export function parseHueParam(raw: string | string[] | undefined): ColorFamily | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v !== undefined && (COLOR_FAMILIES as readonly string[]).includes(v) ? (v as ColorFamily) : null;
}

/** ?life_cycle= for list pages: "annual" | "biennial" | "perennial" (single-select); anything else is ignored (null = all). */
export function parseLifeCycleParam(raw: string | string[] | undefined): LifeCycleParam | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v !== undefined && (LIFE_CYCLE_PARAMS as readonly string[]).includes(v) ? (v as LifeCycleParam) : null;
}
