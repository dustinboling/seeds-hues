/**
 * The admin shell (spec §4, §6): one navigation model in two shells — the left rail at
 * ≥744px (216px iPad, 232px desktop), the bottom tab bar below that. 1180px belongs to
 * the iPad band; desktop starts at 1181px. Role rendering rule (§11): Act = absent —
 * items outside the role are not rendered at all (see navFor). Server-rendered links and
 * forms: no client state, fully keyboard-operable.
 */
import type { ReactNode } from "react";
import { ADMIN_MORE, navFor, type AdminNavItem, type AdminSectionKey } from "@/lib/admin-auth";
import { RoleChip } from "./RoleChip";

export interface AdminShellViewer {
  name: string;
  email: string;
  role: string;
}

function railLinkClass(active: boolean): string {
  const base = "flex min-h-target items-center justify-between gap-2 rounded-control px-3 py-2 font-sans";
  return active ? `${base} bg-leaf-50 font-semibold text-leaf` : `${base} text-ink hover:bg-paper-deep`;
}

function tabClass(active: boolean): string {
  const base = "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-2 font-sans text-[13px] leading-tight";
  return active ? `${base} font-semibold text-leaf` : `${base} text-ink-soft`;
}

function RailItem({ item, active, reviewTotal }: { item: AdminNavItem; active: boolean; reviewTotal: number }) {
  const badge = item.key === "review" && reviewTotal > 0;
  return (
    <a href={item.href} aria-current={active ? "page" : undefined} aria-label={badge ? `Review, ${reviewTotal} waiting` : undefined} className={railLinkClass(active)}>
      <span>{item.label}</span>
      {badge ? (
        <span aria-hidden="true" className="rounded-full bg-leaf px-2 py-0.5 text-[13px] font-semibold tabular-nums text-white">
          {reviewTotal}
        </span>
      ) : null}
    </a>
  );
}

function TabItem({ item, active, reviewTotal }: { item: AdminNavItem; active: boolean; reviewTotal: number }) {
  const badge = item.key === "review" && reviewTotal > 0;
  return (
    <a href={item.href} aria-current={active ? "page" : undefined} aria-label={badge ? `Review, ${reviewTotal} waiting` : undefined} className={tabClass(active)}>
      <span>{item.shortLabel ?? item.label}</span>
      {badge ? (
        <span aria-hidden="true" className="rounded-full bg-leaf px-2 py-0.5 text-[13px] font-semibold tabular-nums text-white">
          {reviewTotal}
        </span>
      ) : null}
    </a>
  );
}

export function AdminShell({ viewer, section, reviewTotal, children }: { viewer: AdminShellViewer; section: AdminSectionKey; reviewTotal: number; children?: ReactNode }) {
  const items = navFor(viewer.role);
  const tabs = [...items.filter((i) => i.key === "home" || i.key === "review" || i.key === "sellers" || i.key === "statistics"), ADMIN_MORE];
  return (
    <div className="admin-root flex items-start gap-6">
      <nav aria-label="Admin sections" className="hidden w-[216px] shrink-0 flex-col gap-1 rounded-card border border-line bg-paper-deep p-3 admin:sticky admin:top-6 admin:flex admin:max-h-[calc(100dvh-3rem)] admin:overflow-y-auto admin-wide:w-[232px]">
        <p className="px-3 pb-1 pt-2 font-sans text-[12px] font-bold uppercase tracking-[0.09em] text-muted">Seed Directory admin</p>
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.key}>
              <RailItem item={item} active={item.key === section} reviewTotal={reviewTotal} />
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-line px-3 pb-1 pt-4">
          <p className="font-sans font-semibold">{viewer.name}</p>
          <p className="mt-0.5 break-words font-sans text-sm text-muted">{viewer.email}</p>
          <p className="mt-2">
            <RoleChip role={viewer.role} />
          </p>
          <form method="post" action="/admin/sign-in/sign-out" className="mt-3">
            <button type="submit" className="btn btn-secondary w-full">
              Sign out of admin
            </button>
          </form>
        </div>
      </nav>
      <div className="min-w-0 flex-1 pb-28 admin:pb-12">
        <div className="mx-auto w-full max-w-[1080px] admin-wide:max-w-[1280px]">{children}</div>
      </div>
      <nav aria-label="Admin sections" className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-paper-deep admin:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="grid grid-cols-5">
          {tabs.map((item) => (
            <li key={item.key}>
              <TabItem item={item} active={item.key === section} reviewTotal={reviewTotal} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
