/**
 * Legacy slug helpers — ported from v2/lib/legacy.ts (same rule, one
 * home): v1 query-string slugs and crop ?series= values normalize
 * (trim + lowercase, ≤160 chars) or read null. Client-safe.
 */
export function legacySlug(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const s = v.trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 160 ? s : null;
}
