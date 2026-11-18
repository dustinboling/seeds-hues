/**
 * Opaque cursor pagination (spec §4.2). A cursor encodes the next offset plus a fingerprint of
 * the query it belongs to, so it cannot be replayed against a different filter/sort (→ 400).
 * Ordering is always stable (name, then slug), and the catalog only changes at publish time.
 */
import { validationError } from "./errors";

export const DEFAULT_LIMIT = 24;
export const MAX_LIMIT = 100;

export function parseLimit(raw: string | null, fallback = DEFAULT_LIMIT, max = MAX_LIMIT): number {
  if (raw === null || raw === "") return fallback;
  if (!/^-?\d+$/.test(raw.trim())) throw validationError("limit must be an integer");
  const n = Number.parseInt(raw, 10);
  return Math.min(max, Math.max(1, n));
}

/** FNV-1a 32-bit — a fingerprint, not a security boundary. */
export function fingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

export function encodeCursor(offset: number, queryKey: string): string {
  return b64urlEncode(JSON.stringify({ o: offset, f: fingerprint(queryKey) }));
}

export function decodeCursor(raw: string | null, queryKey: string): number {
  if (raw === null || raw === "") return 0;
  let parsed: unknown;
  try {
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(raw)) throw new Error("charset");
    parsed = JSON.parse(b64urlDecode(raw));
  } catch {
    throw validationError("cursor is malformed");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { o?: unknown }).o !== "number" ||
    !Number.isInteger((parsed as { o: number }).o) ||
    (parsed as { o: number }).o < 0
  ) {
    throw validationError("cursor is malformed");
  }
  if ((parsed as { f?: unknown }).f !== fingerprint(queryKey)) {
    throw validationError("cursor does not belong to this query");
  }
  return (parsed as { o: number }).o;
}

export interface CursorPage {
  offset: number;
  limit: number;
  queryKey: string;
}

/** Read cursor/limit from a URL. `queryKey` covers path + every non-pagination param. */
export function readCursorPage(url: URL): CursorPage {
  const params = [...url.searchParams.entries()]
    .filter(([k]) => k !== "cursor" && k !== "limit")
    .sort(([a], [b]) => a.localeCompare(b));
  const queryKey = `${url.pathname}?${new URLSearchParams(params).toString()}`;
  const limit = parseLimit(url.searchParams.get("limit"));
  const offset = decodeCursor(url.searchParams.get("cursor"), queryKey);
  return { offset, limit, queryKey };
}

export function pageMeta(page: CursorPage, returned: number, total: number) {
  const next = page.offset + returned;
  return {
    nextCursor: returned > 0 && next < total ? encodeCursor(next, page.queryKey) : null,
    count: returned,
    total,
  };
}
