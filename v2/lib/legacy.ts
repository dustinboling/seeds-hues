/** v1 query-string URLs (`?v=` / `?s=`) → slug, for the R10 308 redirects. */
export function legacySlug(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const s = v.trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 160 ? s : null;
}
