/** Accounts workspace links (server + client share these pure builders). */

export interface AccountLinkParams {
  account?: number | string | null;
  q?: string | null;
  show?: number | null;
}

export function accountHref(p: AccountLinkParams): string {
  const params = new URLSearchParams();
  if (p.account) params.set("account", String(p.account));
  if (p.q) params.set("q", p.q);
  if (p.show && p.show !== 50) params.set("show", String(p.show));
  const query = params.toString();
  return `/admin/accounts${query ? `?${query}` : ""}`;
}
