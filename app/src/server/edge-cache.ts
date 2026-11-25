/**
 * The in-memory edge mock's keying, shared by the Node harness
 * (server/serve.ts) and the Worker entry (server/worker.ts) — one
 * implementation so the two can never disagree on what caches under
 * which key. Only 200s are stored; redirects and errors bypass.
 */
export interface EdgeEntry {
  status: number;
  headers: [string, string][];
  body: string;
}

/**
 * Edge key for a variety URL: the pathname plus the variant marker when the
 * forgiving parse is on (?small_farm=true exactly once). All other query
 * strings are ignored — the route renders identically without them.
 */
export function edgeKey(pathname: string, search: string): string {
  const values = new URLSearchParams(search).getAll("small_farm");
  const variant = values.length === 1 && values[0] === "true";
  return variant ? `${pathname}?small_farm=true` : pathname;
}

/** Single-segment shop/hub detail paths (the browse indexes stay uncached, Slice 4's rule). */
export const DETAIL_PATTERN = /^\/(?:seller|crop|series|state)\/[^/]+$/;

/**
 * Edge key for a shop/hub URL: the pathname plus the FULL query string.
 * Every filtered, searched, sorted, and paged view keys separately from
 * the clean page (and from each other), so a variant can never serve as
 * the clean page — at the cost of one entry per distinct URL.
 */
export function detailKey(pathname: string, search: string): string {
  return search ? `${pathname}${search}` : pathname;
}

/**
 * Drop an edge entry and every variant keyed under its pathname (a page's
 * filtered/paged views purge with the page itself).
 */
export function purgeEdge(edge: Map<string, EdgeEntry>, path: string): void {
  edge.delete(path);
  for (const key of [...edge.keys()]) {
    if (key.startsWith(`${path}?`)) edge.delete(key);
  }
}
