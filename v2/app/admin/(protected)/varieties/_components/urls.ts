/** Varieties workspace links (server + client share these pure builders). */

export interface VarietyLinkParams {
  tab?: string | null;
  variety?: string | null;
  q?: string | null;
  crop?: string | null;
  show?: number | null;
}

export function varietyHref(p: VarietyLinkParams): string {
  const params = new URLSearchParams();
  if (p.tab && p.tab !== "varieties") params.set("tab", p.tab);
  if (p.variety) params.set("variety", p.variety);
  if (p.q) params.set("q", p.q);
  if (p.crop) params.set("crop", p.crop);
  if (p.show && p.show !== 50) params.set("show", String(p.show));
  const query = params.toString();
  return `/admin/varieties${query ? `?${query}` : ""}`;
}
